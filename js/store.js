/**
 * Metrology Request Tracker - store.js
 *
 * The ONLY module that writes data. Screens never touch the collections.
 * Every write checks the result first (domain.validateEntry), then changes,
 * audits and saves. Every write returns a Promise - a server call later is
 * async too, so screens already handle it that way.
 *
 * Where the data lives is the storage adapter's business (today
 * adapters/storage-folder.js; later an API). The store only reads and
 * writes text through it.
 *
 * Save rule (from ABF Tracker): re-read the file first; if its revision is
 * higher than the one we loaded, STOP and offer a reload. Never overwrite
 * a newer file. The first save of each day copies the file on disk into
 * backups/ first.
 */
window.MRT = window.MRT || {};
window.MRT.store = (function () {
  'use strict';

  var cfg = window.MRT.config;
  var D = window.MRT.domain;

  var SCHEMA_VERSION = 11;

  var COLLECTIONS = [
    'users', 'settings', 'tools', 'measurement_types', 'tool_fields', 'bkms',
    'projects', 'part_numbers', 'buildups', 'process_steps', 'hold_reasons', 'priorities', 'holidays', 'lot_fields', 'magazines', 'lots', 'requests', 'request_events', 'templates', 'audit_log'
  ];

  /** In-memory state. `data` is the loaded file; never mutate it from a screen. */
  var state = {
    adapter: null,
    data: null,
    loadedRevision: 0,
    currentUserId: null,
    pendingSave: false,   // true when a save failed and the change is only in memory
    lastError: null,
    upgradedFrom: null    // schema version the file had before this load upgraded it
  };

  /* ------------------------------------------------------------------ *
   * Errors and small helpers
   * ------------------------------------------------------------------ */

  function StoreError(message, code, detail) {
    var e = new Error(message);
    e.name = 'StoreError';
    e.code = code || 'store_error';
    e.detail = detail || null;
    return e;
  }

  function assert(condition, message, code, detail) {
    if (!condition) throw StoreError(message, code || 'validation', detail);
  }

  function isStr(v) { return typeof v === 'string' && v.trim() !== ''; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  /** Run a write; a thrown check becomes a rejected Promise, so callers need one .catch. */
  function guard(fn) {
    try { return Promise.resolve(fn()); }
    catch (e) { return Promise.reject(e); }
  }

  /** Stored timestamps are always UTC ISO strings. */
  function nowIso() { return new Date().toISOString(); }

  /** Record ID, e.g. tool_mf3k1a_8a2c91. Stable forever; one SQLite key later. */
  function newId(prefix) {
    var rnd;
    if (window.crypto && window.crypto.getRandomValues) {
      var a = new Uint32Array(1);
      window.crypto.getRandomValues(a);
      rnd = a[0].toString(36);
    } else {
      rnd = Math.floor(Math.random() * 0xffffffff).toString(36);
    }
    return prefix + '_' + Date.now().toString(36) + '_' + rnd;
  }

  /* ------------------------------------------------------------------ *
   * First-run data. The VALUES live in js/seed.js (reference data, in the
   * repo, sample entries marked). This only turns them into records.
   * ------------------------------------------------------------------ */

  /** Settings every file has; the lab calendar defaults come from seed.js. */
  var SEED_SETTINGS = {
    lab_days: [1, 2, 3, 4, 5],
    lab_start: '07:00',
    lab_end: '18:00',
    calendar_confirmed: false,        // setup to-do until an admin saves or confirms the calendar
    admin_pin_salt: null,
    admin_pin_hash: null,
    last_backup_date: null,
    default_theme: null               // the office's theme (a key of js/themes.js); null = the app's default
  };

  /** Lot fields as records, from seed.js (shape as tool fields, no tool). */
  function lotFieldsFromSeed(S) {
    return ((S && S.lot_fields) || []).map(function (x, j) {
      var row = { id: newId('lfld'), label: x.label, type: x.type, required: !!x.required, help: x.help || '', unit: x.unit || '',
        min: x.min === undefined ? null : x.min, max: x.max === undefined ? null : x.max,
        choices: (x.choices || []).map(function (c) { return { id: newId('ch'), label: c, active: true }; }),
        active: true, sort: j + 1, version: 1 };
      if (x.sample) row.sample = true;
      return row;
    });
  }

  /** A brand-new data file from js/seed.js. No people: the first person becomes Admin (M1-5). */
  function seedData(now_ts, seed) {
    var S = seed || window.MRT.seed;
    assert(S && Array.isArray(S.tools), 'js/seed.js is missing - it holds the starting data', 'no_seed');
    var now = now_ts === undefined ? Date.now() : now_ts;
    var iso = new Date(now).toISOString();
    var data = { schema_version: SCHEMA_VERSION, revision: 0, created_ts: iso, saved_ts: iso, saved_by: null };
    COLLECTIONS.forEach(function (c) { data[c] = []; });

    var settings = clone(SEED_SETTINGS);
    if (S.calendar) { settings.lab_days = S.calendar.days; settings.lab_start = S.calendar.start; settings.lab_end = S.calendar.end; }
    data.settings = Object.keys(settings).map(function (k) {
      return { key: k, value_json: JSON.stringify(settings[k]), version: 1 };
    });

    function sampleFlag(row, x) { if (x && x.sample) row.sample = true; return row; }

    S.tools.forEach(function (t, i) {
      var tool = { id: newId('tool'), code: t.code, name: t.name, glyph: t.glyph || 'generic', destructive: !!t.destructive, status: 'up', status_until: null,
                   status_note: '', primary_operator_id: null, backup_operator_id: null, results_root: t.results_root || '',
                   active: true, sort: i + 1, version: 1 };
      data.tools.push(tool);
      var typeIds = {};
      (t.types || []).forEach(function (x, j) {
        var type = sampleFlag({ id: newId('mtype'), tool_id: tool.id, name: x.name, active: true, sort: j + 1, version: 1 }, x);
        typeIds[x.name] = type.id;
        data.measurement_types.push(type);
      });
      (t.bkms || []).forEach(function (x) {
        assert(!x.type || typeIds[x.type], 'seed.js: BKM "' + x.name + '" names an unknown type "' + x.type + '"', 'bad_seed');
        data.bkms.push(sampleFlag({ id: newId('bkm'), tool_id: tool.id, type_id: x.type ? typeIds[x.type] : null, name: x.name,
                                    path: x.path, doc_version: x.doc_version || '', active: true, version: 1 }, x));
      });
      (t.fields || []).forEach(function (x, j) {
        (x.only_for || []).forEach(function (n) { assert(typeIds[n], 'seed.js: field "' + x.label + '" names an unknown type "' + n + '"', 'bad_seed'); });
        data.tool_fields.push(sampleFlag({ id: newId('fld'), tool_id: tool.id, label: x.label, type: x.type, required: !!x.required,
          help: x.help || '', unit: x.unit || '', min: x.min === undefined ? null : x.min, max: x.max === undefined ? null : x.max,
          choices: (x.choices || []).map(function (c) { return { id: newId('ch'), label: c, active: true }; }),
          type_ids: (x.only_for || []).map(function (n) { return typeIds[n]; }), active: true, sort: j + 1, version: 1 }, x));
      });
    });

    data.priorities = (S.priorities || []).map(function (p) {
      return { id: newId('prio'), code: p.code, name: p.name, level: p.level, needs_reason: !!p.needs_reason,
               is_default: !!p.is_default, active: true, version: 1 };
    });
    data.projects = (S.projects || []).map(function (p) {
      return { id: newId('prj'), code: p.code, name: p.name || '', active: true, version: 1 };
    });
    var prjIds = {};
    data.projects.forEach(function (p) { prjIds[p.code] = p.id; });
    data.part_numbers = (S.part_numbers || []).map(function (x) {
      (x.projects || []).forEach(function (c) { assert(prjIds[c], 'seed.js: part number "' + x.code + '" names an unknown project "' + c + '"', 'bad_seed'); });
      return sampleFlag({ id: newId('pn'), code: x.code, description: x.description || '',
                          project_ids: (x.projects || []).map(function (c) { return prjIds[c]; }), active: true, version: 1 }, x);
    });
    data.lot_fields = lotFieldsFromSeed(S);
    data.hold_reasons = holdReasonsFromSeed(S);
    data.magazines = magazinesFromSeed(S);
    data.process_steps = (S.process_steps || []).map(function (n, i) {
      return { id: newId('pstep'), name: n, active: true, sort: i + 1, version: 1 };
    });
    data.buildups = (S.buildups || []).map(function (c) {
      return { id: newId('bld'), code: c, name: '', active: true, version: 1 };
    });

    var year = parseInt(D.viennaYmd(now).slice(0, 4), 10);
    [year, year + 1].forEach(function (y) {
      D.austrianHolidays(y).forEach(function (h) {
        data.holidays.push({ id: newId('hol'), date: h.date, name: h.name, kind: 'public', source: 'rule', version: 1 });
      });
    });
    (S.closing_days || []).forEach(function (c) {
      if (data.holidays.some(function (h) { return h.date === c.date; })) return;
      data.holidays.push({ id: newId('hol'), date: c.date, name: c.name, kind: 'closing', source: 'seed', version: 1 });
    });
    data.holidays.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return data;
  }

  /* ------------------------------------------------------------------ *
   * Settings access
   * ------------------------------------------------------------------ */

  function getSetting(key) {
    var row = (state.data.settings || []).filter(function (s) { return s.key === key; })[0];
    if (!row) return (key in SEED_SETTINGS) ? clone(SEED_SETTINGS[key]) : undefined;
    try { return JSON.parse(row.value_json); }
    catch (e) { throw StoreError('Setting "' + key + '" holds invalid JSON', 'bad_setting'); }
  }

  /** Write a setting into memory (no audit - internal, or after the caller audited). */
  function setSettingValue(key, value) {
    var row = state.data.settings.filter(function (s) { return s.key === key; })[0];
    if (row) { row.value_json = JSON.stringify(value); row.version = (row.version || 1) + 1; }
    else state.data.settings.push({ key: key, value_json: JSON.stringify(value), version: 1 });
  }

  /** The lab calendar as one object: {days, start, end}. */
  function calendar() {
    return { days: getSetting('lab_days'), start: getSetting('lab_start'), end: getSetting('lab_end') };
  }

  /* ------------------------------------------------------------------ *
   * Storage adapter
   * ------------------------------------------------------------------ */

  /** Pick the storage adapter (app.js does this from config; tests pass a memory one). */
  function init(adapter) {
    state.adapter = adapter;
    state.data = null;
    state.loadedRevision = 0;
    state.currentUserId = null;
    state.pendingSave = false;
    state.lastError = null;
    state.upgradedFrom = null;
    return api;
  }

  function adapter() {
    if (!state.adapter) state.adapter = window.MRT.adapters.storageFolder;
    return state.adapter;
  }

  function isSupported() { return adapter().isSupported(); }
  function unsupportedMessage() { return adapter().unsupportedMessage(); }
  function hasSavedConnection() { return adapter().hasSaved(); }

  /** First use: ask for the data folder, then load. */
  function connect() {
    assert(isSupported(), unsupportedMessage(), 'unsupported_browser');
    return adapter().connect().then(load);
  }

  /**
   * Later visits: reuse the remembered folder. Resolves null when it must be
   * picked or allowed again. {silent: true} never shows a browser prompt
   * (a prompt needs a click, so the app tries silently first).
   */
  function reconnect(o) {
    assert(isSupported(), unsupportedMessage(), 'unsupported_browser');
    return adapter().reconnect(o).then(function (ok) { return ok ? load() : null; });
  }

  /** Name of the remembered data folder (for a "Reconnect <name>" button), or null. */
  function savedConnectionLabel() { return adapter().savedLabel(); }

  function parseFile(text, label) {
    try { return JSON.parse(text); }
    catch (e) {
      throw StoreError((label || cfg.data_file) + ' is not valid JSON. It may be damaged - restore a file from ' +
                       cfg.backup_dir + '/.', 'bad_json');
    }
  }

  function readDataFile() {
    return adapter().read(cfg.data_file).then(function (text) {
      return text === null ? null : { text: text, data: parseFile(text) };
    });
  }

  /** The file looks like ours; missing collections are added empty rather than failing. */
  function validateAndFill(data) {
    assert(data && typeof data === 'object' && !Array.isArray(data), 'The data file is empty or not an object', 'bad_file');
    assert(isNum(data.schema_version), 'The data file has no schema_version', 'bad_file');
    assert(isNum(data.revision), 'The data file has no revision', 'bad_file');
    COLLECTIONS.forEach(function (c) { if (!Array.isArray(data[c])) data[c] = []; });
    return data;
  }

  /**
   * Schema upgrades, one numbered step each: MIGRATIONS[n] turns version n
   * into n + 1. Add steps here, with a test.
   */
  var MIGRATIONS = {
    // 1 -> 2: part numbers, linked to projects (DECISIONS M1-13). Old files have none.
    1: function (d) { if (!Array.isArray(d.part_numbers)) d.part_numbers = []; },
    // 2 -> 3: process-step list (M2-7); "destructive" per tool, FIB on (M2-11).
    2: function (d) {
      if (!Array.isArray(d.process_steps)) d.process_steps = [];
      (d.tools || []).forEach(function (t) { if (typeof t.destructive !== 'boolean') t.destructive = t.code === 'FIB'; });
    },
    // 3 -> 4: lots (M2-1). Old files have none.
    3: function (d) { if (!Array.isArray(d.lots)) d.lots = []; },
    // 4 -> 5: lot fields (admin-defined, like tool extra fields); the starting ones from seed.js, marked sample.
    4: function (d) { if (!Array.isArray(d.lot_fields)) d.lot_fields = lotFieldsFromSeed(window.MRT.seed); },
    // 5 -> 6: requests and their timeline (M2 step 4). Old files have none.
    5: function (d) {
      if (!Array.isArray(d.requests)) d.requests = [];
      if (!Array.isArray(d.request_events)) d.request_events = [];
    },
    // 6 -> 7: on-hold reasons (M3-4) from seed.js; requests get "assigned to" (M3-7).
    6: function (d) {
      if (!Array.isArray(d.hold_reasons)) d.hold_reasons = holdReasonsFromSeed(window.MRT.seed);
      (d.requests || []).forEach(function (r) {
        if (r.assigned_to === undefined) {
          var t = (d.tools || []).filter(function (x) { return x.id === r.tool_id; })[0];
          r.assigned_to = r.status === 'draft' || !t ? null : (t.primary_operator_id || t.backup_operator_id || null);
        }
      });
    },
    // 7 -> 8: magazines and racks (M2-23): the list from seed.js; lots get magazines + a loading map;
    // requests get magazine + rack.
    7: function (d) {
      if (!Array.isArray(d.magazines)) d.magazines = magazinesFromSeed(window.MRT.seed);
      (d.lots || []).forEach(function (l) { if (!l.magazine_ids) l.magazine_ids = []; if (!l.load) l.load = []; if (!l.scrapped) l.scrapped = []; });
      (d.requests || []).forEach(function (r) { if (r.magazine_id === undefined) r.magazine_id = null; if (r.rack === undefined) r.rack = null; });
    },
    // 8 -> 9: request form v2 (F-1..F-3). Panels become Hirata IDs (strings); a request keeps its
    // panel count; the old free "layer" moves into layers when it is one of the build-up's; the
    // magazine gets slots (from the lot's old loading map); lots drop magazines and the loading map.
    8: function (d) {
      var lots = {};
      (d.lots || []).forEach(function (l) { lots[l.id] = l; });
      (d.requests || []).forEach(function (r) {
        var lot = lots[r.lot_id];
        var nums = (r.panels || []).slice();
        if (r.magazine_id && lot && lot.load) {
          r.slots = nums.map(function (n) { var x = lot.load.filter(function (y) { return y.panel === n && y.magazine_id === r.magazine_id; })[0]; return x ? x.slot : null; })
            .filter(function (x) { return x !== null; });
        } else r.slots = [];
        r.panels = nums.map(String);
        r.panel_count = r.panels.length || null;
        var bu = lot ? (d.buildups || []).filter(function (b) { return b.id === lot.buildup_id; })[0] : null;
        r.layers = r.layer && D.layersFor(bu).indexOf(String(r.layer).toUpperCase()) !== -1 ? [String(r.layer).toUpperCase()] : [];
        if (r.layer && !r.layers.length) r.panel_location = [r.panel_location, 'layer ' + r.layer].filter(Boolean).join(' - ');
        delete r.layer; delete r.rack;
        r.new_lot = null;
        if (r.put_back) delete r.put_back.rack;
      });
      (d.lots || []).forEach(function (l) {
        l.scrapped = (l.scrapped || []).map(String);
        delete l.magazine_ids; delete l.load;
      });
      (d.magazines || []).forEach(function (m) { delete m.rack; });
    },
    // 9 -> 10 (F-6): project, part number and build-up belong to the request, not the lot - one lot
    // runs through every build-up. Requests take them over from their lot; lots drop them.
    9: function (d) {
      var lots = {};
      (d.lots || []).forEach(function (l) { lots[l.id] = l; });
      (d.requests || []).forEach(function (r) {
        var lot = lots[r.lot_id] || {};
        var nl = r.new_lot || {};
        r.project_id = r.project_id || lot.project_id || nl.project_id || null;
        r.part_number_id = r.part_number_id || lot.part_number_id || nl.part_number_id || null;
        r.buildup_id = r.buildup_id || lot.buildup_id || nl.buildup_id || null;
        r.new_lot = r.new_lot ? { lot_number: r.new_lot.lot_number } : null;
      });
      (d.lots || []).forEach(function (l) { delete l.project_id; delete l.part_number_id; delete l.buildup_id; });
      // a file whose magazine list stayed empty (made before magazines, or never filled) gets the sample ones
      if (!Array.isArray(d.magazines) || !d.magazines.length) d.magazines = magazinesFromSeed(window.MRT.seed);
    },
    // 10 -> 11: personal request templates (Q28, DECISIONS T-1). Old files have none.
    10: function (d) { if (!Array.isArray(d.templates)) d.templates = []; }
  };

  function magazinesFromSeed(S) {
    return ((S && S.magazines) || []).map(function (m) {
      var row = { id: newId('mag'), code: m.code, slots: m.slots || 24, active: true, version: 1 };
      if (m.sample) row.sample = true;
      return row;
    });
  }

  function holdReasonsFromSeed(S) {
    return ((S && S.hold_reasons) || []).map(function (n, i) { return { id: newId('hold'), name: n, active: true, sort: i + 1, version: 1 }; });
  }

  function migrate(data) {
    assert(data.schema_version <= SCHEMA_VERSION,
      'This file was written by a newer version of the app (schema ' + data.schema_version +
      '). Please update the program files.', 'newer_schema');
    while (data.schema_version < SCHEMA_VERSION) {
      var step = MIGRATIONS[data.schema_version];
      assert(step, 'No upgrade step from schema ' + data.schema_version, 'no_migration');
      step(data);
      data.schema_version += 1;
    }
    return data;
  }

  /**
   * Load the file. A missing file is a first run: the seed file is written.
   * An older schema is upgraded - but only after a copy of the old file is
   * kept in backups/ (README "Updating the app"); the upgraded data is written
   * on the next save.
   */
  function load() {
    return readDataFile().then(function (onDisk) {
      if (onDisk === null) {
        state.data = seedData();
        state.loadedRevision = 0;
        state.upgradedFrom = null;
        resetUndo();
        return adapter().write(cfg.data_file, JSON.stringify(state.data, null, 2)).then(function () { return state.data; });
      }
      var raw = validateAndFill(onDisk.data);
      var from = raw.schema_version;
      var copy = from < SCHEMA_VERSION
        ? adapter().write(cfg.backup_dir + '/' + cfg.backup_prefix + 'before-upgrade_v' + from + '-to-v' + SCHEMA_VERSION +
                          '_' + stamp() + '.json', onDisk.text)
        : Promise.resolve();
      return copy.then(function () {
        state.data = migrate(raw);
        state.loadedRevision = state.data.revision;
        state.upgradedFrom = from < SCHEMA_VERSION ? from : null;
        state.pendingSave = false;
        state.lastError = null;
        resetUndo();
        return state.data;
      });
    });
  }

  function stamp() { return new Date().toISOString().replace(/[:.]/g, '-'); }

  /**
   * Save the whole file.
   * 1. Re-read it. A higher revision means someone else saved - stop.
   * 2. First save of the day: copy the file on disk (the state before this
   *    change) to backups/, keep the last cfg.backup_keep.
   * 3. Write with revision + 1.
   */
  var save = function () {
    assert(state.data, 'No data is loaded', 'not_loaded');
    return readDataFile().then(function (onDisk) {
      if (onDisk && isNum(onDisk.data.revision) && onDisk.data.revision > state.loadedRevision) {
        throw StoreError('Data was changed by ' + (userName(onDisk.data.saved_by, onDisk.data) || 'someone else') +
          ' at ' + (onDisk.data.saved_ts || 'an unknown time') + '. Reload?', 'revision_conflict',
          { saved_by: onDisk.data.saved_by, saved_ts: onDisk.data.saved_ts, revision: onDisk.data.revision });
      }
      return dailyBackup(onDisk ? onDisk.text : null);
    }).then(function () {
      state.data.revision = state.loadedRevision + 1;
      state.data.saved_ts = nowIso();
      state.data.saved_by = state.currentUserId;
      state.data.schema_version = SCHEMA_VERSION;
      return adapter().write(cfg.data_file, JSON.stringify(state.data, null, 2));
    }).then(function () {
      state.loadedRevision = state.data.revision;
      state.pendingSave = false;
      state.lastError = null;
      state.upgradedFrom = null;
      return state.data.revision;
    }).catch(function (e) {
      state.pendingSave = true;       // the change stays in memory: Retry / Download
      state.lastError = e;
      throw e;
    });
  };

  function userName(id, data) {
    var u = ((data || state.data || {}).users || []).filter(function (x) { return x.id === id; })[0];
    return u ? u.name : null;
  }

  function backupName(ymd) { return cfg.backup_prefix + ymd + '.json'; }
  function isDailyBackup(name) { return new RegExp('^' + cfg.backup_prefix + '\\d{4}-\\d{2}-\\d{2}\\.json$').test(name); }
  /** The copy kept before "Fill with demo data" / "Start empty" (replaceData): restorable, never pruned. */
  function isSwapCopy(name) { return new RegExp('^' + cfg.backup_prefix + 'before-(demo|empty)_\\d{4}-\\d{2}-\\d{2}T[\\d-]+Z\\.json$').test(name); }

  function dailyBackup(diskText) {
    var today = D.viennaYmd(Date.now());
    if (getSetting('last_backup_date') === today || diskText === null) return Promise.resolve(false);
    return adapter().write(cfg.backup_dir + '/' + backupName(today), diskText)
      .then(pruneBackups)
      .then(function () { setSettingValue('last_backup_date', today); return true; })
      .catch(function (e) {
        // A failed backup must not block the save; log it and go on.
        console.error('MRT: daily backup failed', e);
        return false;
      });
  }

  function pruneBackups() {
    return adapter().list(cfg.backup_dir).then(function (files) {
      var names = files.map(function (f) { return f.name; }).filter(isDailyBackup).sort();
      var extra = names.slice(0, Math.max(0, names.length - cfg.backup_keep));
      return extra.reduce(function (p, n) {
        return p.then(function () { return adapter().remove(cfg.backup_dir + '/' + n); });
      }, Promise.resolve());
    });
  }

  /** Daily backups, newest first: [{name, date, size_kb}]. Safety copies are not listed. */
  function listBackups() {
    return adapter().list(cfg.backup_dir).then(function (files) {
      return files.filter(function (f) { return isDailyBackup(f.name) || isSwapCopy(f.name); }).map(function (f) {
        var swap = isSwapCopy(f.name);
        var rest = f.name.slice(cfg.backup_prefix.length);
        return { name: f.name, date: swap ? rest.replace(/^before-(demo|empty)_/, '').slice(0, 10) : rest.slice(0, 10),
                 kind: swap ? (/before-demo/.test(f.name) ? 'before demo data' : 'before starting empty') : 'daily',
                 size_kb: Math.round(f.size / 1024) };
      }).sort(function (a, b) { return a.date !== b.date ? (a.date < b.date ? 1 : -1) : (a.kind === 'daily' ? 1 : -1); });
    });
  }

  /**
   * Put a daily backup back as the live data (admin, audited).
   * The current file is copied to backups/..._before-restore_<time>.json first
   * (never pruned). The audit log is not rolled back: it keeps every entry and
   * gains a "restore" entry; the revision continues so other PCs see it.
   */
  function restoreBackup(name, reason) {
    return guard(function () {
      requireAdmin();
      assert(isStr(reason), 'A reason is required to restore a backup');
      assert(isDailyBackup(name) || isSwapCopy(name), 'Not a backup file: ' + name);
      return adapter().read(cfg.backup_dir + '/' + name).then(function (text) {
        assert(text !== null, 'Backup not found: ' + name, 'not_found');
        var restored = migrate(validateAndFill(parseFile(text, name)));
        var safety = cfg.backup_prefix + 'before-restore_' + stamp() + '.json';
        return adapter().write(cfg.backup_dir + '/' + safety, JSON.stringify(state.data, null, 2)).then(function () {
          // a daily backup keeps today's audit log; the copy kept before a demo / empty swap keeps its own
          // (the demo's made-up history must not stay in a real file)
          if (!isSwapCopy(name)) restored.audit_log = state.data.audit_log;
          restored.revision = state.data.revision;
          restored.saved_ts = state.data.saved_ts;
          restored.saved_by = state.data.saved_by;
          state.data = restored;
          audit('file', cfg.data_file, 'restore', 'backup', safety, name, reason.trim());
          return commit({ undo: false });
        }).then(function () { return { restored: name, safety_copy: cfg.backup_dir + '/' + safety }; });
      });
    });
  }

  /**
   * Replace the whole data file, for testing (admin, audited): 'demo' puts the big made-up demo
   * (js/demo-data.js) in, 'empty' starts again like a first run (the lists from seed.js, no lots,
   * requests or other people). Either way the admin keeps their PIN and stays the signed-in admin:
   * in the demo they become its Prince Khurana (admin + engineer) with their own Windows ID, so the
   * launcher recognises them. The current file is copied to backups/..._before-<kind>_<time>.json
   * first (never pruned); the revision continues so other PCs see the change.
   * @param {'demo'|'empty'} kind
   * @param {string} reason
   */
  function replaceData(kind, reason) {
    return guard(function () {
      var me = requireAdmin();
      assert(kind === 'demo' || kind === 'empty', 'Unknown kind: ' + kind);
      assert(isStr(reason), 'A reason is required');
      assert(kind === 'empty' || typeof window.MRT.demoData === 'function', 'The demo data (js/demo-data.js) is not loaded', 'not_found');
      var next = kind === 'demo' ? migrate(validateAndFill(clone(window.MRT.demoData({ now_ts: Date.now() })))) : seedData();
      var keep = ['admin_pin_salt', 'admin_pin_hash'];
      (next.settings || []).forEach(function (st) {
        if (keep.indexOf(st.key) === -1) return;
        var mine = (state.data.settings || []).filter(function (x) { return x.key === st.key; })[0];
        if (mine) st.value_json = mine.value_json;
      });
      var meNow;
      if (kind === 'demo') {
        meNow = next.users.filter(function (u) { return u.id === 'usr_demo_prince'; })[0];
        assert(meNow, 'The demo has no admin');
        if (me.windows_id) {
          next.users.forEach(function (u) { if (u !== meNow && u.windows_id === me.windows_id) u.windows_id = null; });
          meNow.windows_id = me.windows_id; meNow.domain = me.domain || null;
        }
        if (me.email) meNow.email = me.email;
        if ((meNow.roles || []).indexOf('admin') === -1) meNow.roles = (meNow.roles || []).concat(['admin']);
      } else {
        meNow = clone(me);
        delete meNow.away_from; delete meNow.away_until; delete meNow.away_note;
        next.users = [meNow];
      }
      var safety = cfg.backup_prefix + 'before-' + kind + '_' + stamp() + '.json';
      return adapter().write(cfg.backup_dir + '/' + safety, JSON.stringify(state.data, null, 2)).then(function () {
        next.revision = state.data.revision;
        next.saved_ts = state.data.saved_ts;
        next.saved_by = state.data.saved_by;
        state.data = next;
        state.currentUserId = meNow.id;
        resetUndo();                                   // nothing before the swap can be taken back
        audit('file', cfg.data_file, 'replace', 'data', safety, kind === 'demo' ? 'demo data' : 'empty', reason.trim());
        return commit({ undo: false });
      }).then(function () { return { kind: kind, safety_copy: cfg.backup_dir + '/' + safety, user: meNow }; });
    });
  }

  /**
   * Admin: the theme everyone starts with (Settings > Look). Each person can still pick their
   * own in the user menu. key: a theme key of js/themes.js, or null for the app's default.
   */
  function setDefaultTheme(key, reason) {
    return guard(function () {
      requireAdmin();
      var T = window.MRT.themes;
      assert(key === null || (T ? !!T.byKey(key) : /^[a-z0-9-]{1,24}$/.test(key)), 'Unknown theme: ' + key, 'invalid');
      var old = getSetting('default_theme');
      assert(old !== key, 'Nothing was changed', 'no_change');
      setSettingValue('default_theme', key);
      audit('setting', 'default_theme', 'update', 'default_theme', old, key, reason ? String(reason).trim() : null);
      return commit().then(function () { return key; });
    });
  }

  function retrySave() { return save(); }

  /** A failed save's escape hatch: the file as it is in memory, for the app to offer as a download. */
  function exportText() {
    assert(state.data, 'No data is loaded', 'not_loaded');
    return { name: cfg.backup_prefix + 'recovered_' + D.viennaYmd(Date.now()) + '.json',
             text: JSON.stringify(state.data, null, 2) };
  }

  /** Has someone else written the file since we loaded it? (polled by the app) */
  function checkForExternalChange() {
    if (!state.data) return Promise.resolve(null);
    return readDataFile().then(function (onDisk) {
      if (onDisk && isNum(onDisk.data.revision) && onDisk.data.revision > state.loadedRevision) {
        return { saved_by: onDisk.data.saved_by, saved_by_name: userName(onDisk.data.saved_by, onDisk.data),
                 saved_ts: onDisk.data.saved_ts, revision: onDisk.data.revision };
      }
      return null;
    }).catch(function () { return null; });
  }

  /* ------------------------------------------------------------------ *
   * People, identity and audit
   * ------------------------------------------------------------------ */

  function findUser(id) {
    return (state.data && state.data.users || []).filter(function (u) { return u.id === id; })[0] || null;
  }

  /** The active user this identity ({windows_id, domain}) belongs to, or null. */
  function findUserByIdentity(ident) {
    if (!state.data || !ident) return null;
    return state.data.users.filter(function (u) { return u.active && D.identityMatches(u, ident); })[0] || null;
  }

  /** Users whose name matches, for "Is this you?" (active ones only). */
  function nameMatches(name) {
    return D.findNameMatches(state.data.users.filter(function (u) { return u.active; }), name);
  }

  function setCurrentUser(userId) {
    var u = findUser(userId);
    assert(u, 'Unknown user: ' + userId, 'unknown_user');
    assert(u.active, u.name + ' is deactivated. Ask an admin.', 'inactive_user');
    state.currentUserId = userId;
    return u;
  }

  function currentUser() { return findUser(state.currentUserId); }

  /** "Change user": nobody is signed in until the next setCurrentUser / sign-up. */
  function signOut() { state.currentUserId = null; }

  function requireUser() {
    assert(state.currentUserId && findUser(state.currentUserId), 'Nobody is signed in', 'no_user');
    return findUser(state.currentUserId);
  }

  /** Settings writes need the Admin role (the PIN is asked by the screen on top). */
  function requireAdmin() {
    var u = requireUser();
    assert(D.hasRole(u, 'admin'), 'Only an admin can change this', 'not_admin');
    return u;
  }

  /** Append one audit entry. Called by every write - never by a screen. */
  function audit(entity, entity_id, action, field, old_value, new_value, reason) {
    state.data.audit_log.push({
      id: newId('aud'),
      ts: nowIso(),
      user_id: state.currentUserId,
      entity: entity,
      entity_id: entity_id,
      action: action,
      field: field || null,
      old_value: old_value === undefined ? null : old_value,
      new_value: new_value === undefined ? null : new_value,
      reason: reason || null
    });
  }

  function cleanIdentity(o) {
    var ident = D.parseWindowsLogin((o.domain ? o.domain + '\\' : '') + (o.windows_id || ''));
    assert(ident, 'That Windows ID does not look right: ' + (o.windows_id || '(empty)'), 'bad_identity');
    return ident;
  }

  function hashPin(pin, salt) {
    var bytes = new TextEncoder().encode(String(salt || '') + ':' + String(pin));
    return window.crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }

  function checkPinFormat(pin) {
    assert(/^[0-9]{4,12}$/.test(String(pin || '').trim()), 'The PIN must be 4 to 12 digits', 'bad_pin');
    return String(pin).trim();
  }

  /** Soft protection (the file is readable by everyone anyway): a salted SHA-256 of the PIN. */
  function verifyPin(pin) {
    var stored = getSetting('admin_pin_hash');
    if (!stored) return Promise.resolve(false);
    return hashPin(String(pin || '').trim(), getSetting('admin_pin_salt')).then(function (h) { return h === stored; });
  }

  function hasPin() { return !!getSetting('admin_pin_hash'); }

  function storePin(pin) {
    var salt = newId('salt');
    return hashPin(pin, salt).then(function (hash) {
      setSettingValue('admin_pin_salt', salt);
      setSettingValue('admin_pin_hash', hash);
    });
  }

  /**
   * First run (M1-5a): the file has no people yet. The first person becomes
   * Admin and sets the PIN in the same step.
   * @param {Object} o {name, windows_id, domain, email, pin}
   */
  function createFirstAdmin(o) {
    return guard(function () {
      assert(state.data, 'No data is loaded', 'not_loaded');
      assert(!state.data.users.length, 'There are users already - ask an admin to add you', 'not_first');
      var ident = cleanIdentity(o);
      var pin = checkPinFormat(o.pin);
      var user = { id: newId('usr'), name: String(o.name || '').trim(), windows_id: ident.windows_id,
                   domain: ident.domain, email: String(o.email || '').trim() || null, roles: ['admin'],
                   active: true, self_added: false, needs_review: false, created_ts: nowIso(), version: 1 };
      var problems = D.validateEntry('users', user, state.data);
      assert(!problems.length, problems.join('. '), 'invalid', problems);
      return storePin(pin).then(function () {
        state.data.users.push(user);
        state.currentUserId = user.id;
        audit('user', user.id, 'create', 'name', null, user.name, 'First run: first admin');
        audit('setting', 'admin_pin_hash', 'update', 'admin_pin_hash', null, '(set)', 'First run');
        return commit({ undo: false });
      }).then(function () { return user; });
    });
  }

  /**
   * Unknown Windows ID adds themselves (M1-5b): Engineer role only, marked New
   * for the admins. When users with the same name exist the screen asks
   * "Is this you?" first; to create a separate person anyway it passes
   * confirmed_new: true.
   * @param {Object} o {name, windows_id, domain, email, confirmed_new}
   */
  function selfRegister(o) {
    return guard(function () {
      assert(state.data, 'No data is loaded', 'not_loaded');
      assert(state.data.users.length, 'No admin yet - the first person sets up the app', 'no_admin');
      var ident = cleanIdentity(o);
      assert(!state.data.users.some(function (u) { return D.identityMatches(u, ident); }),
        'This Windows ID already belongs to a user. Ask an admin.', 'identity_taken');
      var matches = nameMatches(o.name);
      assert(!matches.length || o.confirmed_new === true,
        'Someone called ' + String(o.name).trim() + ' exists already', 'name_match',
        matches.map(function (u) { return { id: u.id, name: u.name, linked: !!u.windows_id }; }));
      var user = { id: newId('usr'), name: String(o.name || '').trim(), windows_id: ident.windows_id,
                   domain: ident.domain, email: String(o.email || '').trim() || null, roles: ['engineer'],
                   active: true, self_added: true, needs_review: true, created_ts: nowIso(), version: 1 };
      var problems = D.validateEntry('users', user, state.data);
      assert(!problems.length, problems.join('. '), 'invalid', problems);
      state.data.users.push(user);
      state.currentUserId = user.id;
      audit('user', user.id, 'self_register', 'windows_id', null, user.windows_id, 'Added themselves as Engineer');
      return commit({ undo: false }).then(function () { return user; });
    });
  }

  /**
   * "Is this you?" - yes: link this Windows ID to an existing user that has
   * none yet. A user already linked to another ID is never relinked (M1-5).
   */
  function linkIdentity(userId, o) {
    return guard(function () {
      var user = findUser(userId);
      assert(user && user.active, 'That user was not found or is deactivated', 'not_found');
      assert(!user.windows_id, user.name + ' is already linked to another Windows ID. Ask an admin.', 'already_linked');
      var ident = cleanIdentity(o);
      assert(!state.data.users.some(function (u) { return D.identityMatches(u, ident); }),
        'This Windows ID already belongs to a user. Ask an admin.', 'identity_taken');
      state.currentUserId = user.id;
      audit('user', user.id, 'link_identity', 'windows_id', null, ident.windows_id, '"Is this you?" - yes');
      user.windows_id = ident.windows_id;
      if (ident.domain && !user.domain) user.domain = ident.domain;
      user.version += 1;
      return commit({ undo: false }).then(function () { return user; });
    });
  }

  /** An admin has looked at a self-added user: the New mark goes. */
  /* ------------------------------------------------------------------ *
   * Personal request templates (Q28, DECISIONS T-1..T-3): only their owner
   * sees, starts, renames and deletes them. Audited like any change.
   * ------------------------------------------------------------------ */

  function myTemplates(userId) {
    return (state.data.templates || []).filter(function (t) { return t.owner_id === userId; })
      .sort(function (a, b) { return D.normalizeName(a.name) < D.normalizeName(b.name) ? -1 : 1; });
  }

  /** Save a request or draft (or plain fields) as a template. o: {name, request_id} or {name, fields}. */
  function saveTemplate(o) {
    return guard(function () {
      var me = requireUser();
      assert(D.canRequest(me), 'Only engineers keep request templates', 'not_allowed');
      var src = o.request_id ? need('requests', o.request_id, 'Request') : null;
      assert(!src || src.requester_id === me.id || D.hasRole(me, 'admin'), 'Save templates from your own requests', 'not_allowed');
      var fields = D.templateFieldsOf(src || o.fields || {});
      assert(fields.tool_id && byId('tools', fields.tool_id), 'A template needs a tool', 'invalid');
      var problems = D.templateNameProblems(o.name, myTemplates(me.id));
      assert(!problems.length, problems.join('. '), 'invalid', problems);
      var t = { id: newId('tpl'), owner_id: me.id, name: String(o.name).trim(), fields: fields, from_request_id: src ? src.id : null,
                created_ts: nowIso(), updated_ts: null, version: 1 };
      state.data.templates.push(t);
      audit('template', t.id, 'create', 'name', null, t.name, src ? 'From ' + (src.request_no || 'a draft') : null);
      return commit().then(function () { return t; });
    });
  }

  function ownTemplate(id) {
    var me = requireUser();
    var t = need('templates', id, 'Template');
    assert(t.owner_id === me.id, 'This is not your template', 'not_allowed');
    return t;
  }

  function renameTemplate(id, name) {
    return guard(function () {
      var t = ownTemplate(id);
      var problems = D.templateNameProblems(name, myTemplates(t.owner_id).filter(function (x) { return x.id !== id; }));
      assert(!problems.length, problems.join('. '), 'invalid', problems);
      assert(String(name).trim() !== t.name, 'Nothing was changed', 'no_change');
      audit('template', t.id, 'update', 'name', t.name, String(name).trim(), null);
      t.name = String(name).trim(); t.updated_ts = nowIso(); t.version += 1;
      return commit().then(function () { return t; });
    });
  }

  function deleteTemplate(id) {
    return guard(function () {
      var t = ownTemplate(id);
      state.data.templates = state.data.templates.filter(function (x) { return x.id !== id; });
      audit('template', id, 'delete', 'name', t.name, null, null);
      return commit();
    });
  }

  /**
   * Away (DECISIONS M1-14): the person themselves, or an admin, records one
   * period - dates and an optional note, never a reason. period null = back / clear.
   * @param {string} userId
   * @param {Object|null} period {from: 'YYYY-MM-DD', until: 'YYYY-MM-DD' | null, note}
   */
  function setAway(userId, period, reason) {
    return guard(function () {
      var me = requireUser();
      var user = need('users', userId, 'User');
      assert(me.id === user.id || D.hasRole(me, 'admin'), 'Only the person themselves or an admin can set this', 'not_allowed');
      var next = period
        ? { away_from: period.from || null, away_until: period.until || null, away_note: String(period.note || '').trim() || null }
        : { away_from: null, away_until: null, away_note: null };
      if (period) {
        var problems = D.validateAway({ from: next.away_from, until: next.away_until, note: next.away_note });
        assert(!problems.length, problems.join('. '), 'invalid', problems);
      }
      var keys = ['away_from', 'away_until', 'away_note'].filter(function (k) { return (user[k] || null) !== (next[k] || null); });
      assert(keys.length, 'Nothing was changed', 'no_change');
      keys.forEach(function (k) { audit('user', user.id, 'away', k, user[k] || null, next[k], reason || null); });
      Object.assign(user, next);
      user.version += 1;
      return commit().then(function () { return user; });
    });
  }

  function markUserReviewed(userId, reason) {
    return guard(function () {
      requireAdmin();
      var user = need('users', userId, 'User');
      assert(user.needs_review, 'This user needs no review', 'no_change');
      audit('user', user.id, 'review', 'needs_review', true, false, reason || null);
      user.needs_review = false;
      user.version += 1;
      return commit().then(function () { return user; });
    });
  }

  function setAdminPin(pin, reason) {
    return guard(function () {
      requireAdmin();
      var p = checkPinFormat(pin);
      return storePin(p).then(function () {
        audit('setting', 'admin_pin_hash', 'update', 'admin_pin_hash', '(set)', '(set)', reason || null);
        return commit();
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Lists (Settings) - one generic save, per-list rules in domain.js
   * ------------------------------------------------------------------ */

  function byId(collection, id) {
    return (state.data[collection] || []).filter(function (r) { return r.id === id; })[0] || null;
  }

  function need(collection, id, label) {
    var row = byId(collection, id);
    assert(row, (label || collection) + ' not found: ' + id, 'not_found');
    return row;
  }

  /** Optimistic locking: a caller that sends the version it read gets a clear error if it changed. */
  function checkVersion(row, expected, label) {
    if (expected === undefined || expected === null) return;
    assert(row.version === expected, label + ' was changed by someone else in the meantime. Reload and try again.', 'stale_version');
  }

  var LISTS = {
    users:             { prefix: 'usr',   label: 'user',             fields: ['name', 'windows_id', 'domain', 'email', 'roles', 'active'] },
    tools:             { prefix: 'tool',  label: 'tool',             fields: ['code', 'name', 'glyph', 'destructive', 'status', 'status_until', 'status_note', 'primary_operator_id', 'backup_operator_id', 'results_root', 'active', 'sort'] },
    measurement_types: { prefix: 'mtype', label: 'measurement type', fields: ['tool_id', 'name', 'active', 'sort'] },
    lot_fields:        { prefix: 'lfld',  label: 'lot field',        fields: ['label', 'type', 'required', 'help', 'unit', 'min', 'max', 'choices', 'active', 'sort'] },
    tool_fields:       { prefix: 'fld',   label: 'field',            fields: ['tool_id', 'label', 'type', 'required', 'help', 'unit', 'min', 'max', 'choices', 'type_ids', 'active', 'sort'] },
    bkms:              { prefix: 'bkm',   label: 'BKM',              fields: ['tool_id', 'type_id', 'name', 'path', 'doc_version', 'active'] },
    projects:          { prefix: 'prj',   label: 'project',          fields: ['code', 'name', 'active'] },
    part_numbers:      { prefix: 'pn',    label: 'part number',      fields: ['code', 'description', 'project_ids', 'active'] },
    buildups:          { prefix: 'bld',   label: 'build-up',         fields: ['code', 'name', 'layers', 'active'] },
    process_steps:     { prefix: 'pstep', label: 'process step',     fields: ['name', 'active', 'sort'] },
    hold_reasons:      { prefix: 'hold',  label: 'on-hold reason',   fields: ['name', 'active', 'sort'] },
    magazines:         { prefix: 'mag',   label: 'magazine',         fields: ['code', 'slots', 'active'] },
    priorities:        { prefix: 'prio',  label: 'priority',         fields: ['code', 'name', 'level', 'needs_reason', 'is_default', 'active'] },
    holidays:          { prefix: 'hol',   label: 'holiday',          fields: ['date', 'name', 'kind'] }
  };

  /** Defaults for a new entry, before the caller's fields. */
  var NEW_DEFAULTS = {
    users: { windows_id: null, domain: null, email: null, roles: ['engineer'], active: true, self_added: false, needs_review: false },
    tools: { glyph: 'generic', destructive: false, status: 'up', status_until: null, status_note: '', primary_operator_id: null,
             backup_operator_id: null, results_root: '', active: true },
    measurement_types: { active: true },
    tool_fields: { required: false, help: '', unit: '', min: null, max: null, choices: [], type_ids: [], active: true },
    lot_fields: { required: false, help: '', unit: '', min: null, max: null, choices: [], active: true },
    bkms: { type_id: null, doc_version: '', active: true },
    projects: { name: '', active: true },
    part_numbers: { description: '', project_ids: [], active: true },
    buildups: { name: '', active: true },
    process_steps: { active: true },
    hold_reasons: { active: true },
    magazines: { slots: 24, active: true },
    priorities: { needs_reason: false, is_default: false, active: true },
    holidays: { kind: 'closing', source: 'manual' }
  };

  /** Tidy what people type: codes upper case, IDs lower case, text trimmed. */
  function normalize(collection, f) {
    var o = clone(f);
    ['name', 'label', 'help', 'unit', 'status_note', 'doc_version', 'results_root', 'path', 'description'].forEach(function (k) {
      if (typeof o[k] === 'string') o[k] = o[k].trim();
    });
    if (typeof o.code === 'string') o.code = o.code.trim().toUpperCase();
    if (collection === 'users') {
      if (typeof o.windows_id === 'string') o.windows_id = o.windows_id.trim().toLowerCase() || null;
      if (typeof o.domain === 'string') o.domain = o.domain.trim().toUpperCase() || null;
      if (typeof o.email === 'string') o.email = o.email.trim() || null;
    }
    ['status_until', 'type_id', 'primary_operator_id', 'backup_operator_id'].forEach(function (k) {
      if (o[k] === '') o[k] = null;
    });
    ['min', 'max'].forEach(function (k) { if (o[k] === '') o[k] = null; });
    if (Array.isArray(o.project_ids)) o.project_ids = o.project_ids.filter(function (id, i) { return id && o.project_ids.indexOf(id) === i; });
    if (Array.isArray(o.choices)) {
      o.choices = o.choices.map(function (c) {
        return { id: c.id || newId('ch'), label: String(c.label || '').trim(), active: c.active !== false };
      });
    }
    return o;
  }

  /**
   * Create or change one list entry (admin). Checks the entry AS IT WOULD BE,
   * against the lists as they would be, before anything is changed - a
   * refused change never lingers in memory.
   * @param {string} collection  a key of LISTS
   * @param {Object} o {id?, version?, fields: {...}, reason?}
   * @returns Promise<row>
   */
  function saveEntry(collection, o) {
    return guard(function () {
      requireAdmin();
      var spec = LISTS[collection];
      assert(spec, 'Unknown list: ' + collection);
      var fields = normalize(collection, o.fields || {});
      Object.keys(fields).forEach(function (k) { assert(spec.fields.indexOf(k) !== -1, 'Unknown field: ' + k); });

      var existing = o.id ? need(collection, o.id, spec.label) : null;
      if (existing) checkVersion(existing, o.version, spec.label);
      var next = existing ? clone(existing) : Object.assign({ id: newId(spec.prefix) }, clone(NEW_DEFAULTS[collection]));
      if (!existing && (collection === 'measurement_types' || collection === 'tool_fields' || collection === 'tools' || collection === 'process_steps' || collection === 'hold_reasons' || collection === 'lot_fields') && !('sort' in fields)) {
        next.sort = state.data[collection].filter(function (r) { return !fields.tool_id || r.tool_id === fields.tool_id; }).length + 1;
      }
      if (existing && 'tool_id' in fields) {
        assert(fields.tool_id === existing.tool_id, 'The tool of an existing ' + spec.label + ' cannot change - add a new one instead');
      }
      // removed choices stay, hidden, so old requests keep their answers (Q47)
      if (existing && Array.isArray(fields.choices)) {
        (existing.choices || []).forEach(function (c) {
          if (!fields.choices.some(function (n) { return n.id === c.id; })) fields.choices.push({ id: c.id, label: c.label, active: false });
        });
      }
      Object.assign(next, fields);
      if (collection === 'tools' && next.status === 'up') next.status_until = null;

      var changes = [];
      if (existing) {
        Object.keys(fields).forEach(function (k) {
          if (JSON.stringify(existing[k]) !== JSON.stringify(next[k])) changes.push({ field: k, from: existing[k], to: next[k] });
        });
        // saving a sample entry unchanged confirms it as real (the engineers said it is right)
        assert(changes.length || existing.sample, 'Nothing was changed', 'no_change');
        if (existing.sample) { next.sample = false; changes.push({ field: 'sample', from: true, to: false }); }
      }

      // would-be lists
      var wouldBe = {};
      COLLECTIONS.forEach(function (c) { wouldBe[c] = state.data[c]; });
      wouldBe[collection] = existing
        ? state.data[collection].map(function (r) { return r.id === next.id ? next : r; })
        : state.data[collection].concat([next]);
      if (collection === 'priorities' && next.is_default) {
        wouldBe.priorities = wouldBe.priorities.map(function (r) { return r.id === next.id || !r.is_default ? r : Object.assign({}, r, { is_default: false }); });
      }
      var problems = D.validateEntry(collection, next, wouldBe);
      if (collection === 'priorities') problems = problems.concat(D.validatePriorities(wouldBe.priorities));
      if (collection === 'users') problems = problems.concat(adminProblems(wouldBe.users));
      assert(!problems.length, problems.join('. '), 'invalid', problems);

      // apply
      var reason = o.reason ? String(o.reason).trim() : null;
      if (existing) {
        changes.forEach(function (c) { audit(spec.label.replace(/ /g, '_'), next.id, 'update', c.field, c.from, c.to, reason); });
        next.version = existing.version + 1;
        Object.keys(existing).forEach(function (k) { delete existing[k]; });
        Object.assign(existing, next);
      } else {
        next.version = 1;
        if (collection === 'users') next.created_ts = nowIso();
        state.data[collection].push(next);
        audit(spec.label.replace(/ /g, '_'), next.id, 'create', null, null, next.code || next.name || next.label || next.date, reason);
      }
      if (collection === 'priorities' && next.is_default) {
        state.data.priorities.forEach(function (r) {
          if (r.id !== next.id && r.is_default) {
            audit('priority', r.id, 'update', 'is_default', true, false, reason);
            r.is_default = false; r.version += 1;
          }
        });
      }
      return commit().then(function () { return byId(collection, next.id); });
    });
  }

  /** At least one active admin must remain. */
  function adminProblems(users) {
    return users.some(function (u) { return u.active && D.hasRole(u, 'admin'); }) ? [] : ['At least one active admin must remain'];
  }

  /**
   * What points at a list entry. An entry can be deleted only while nothing
   * does; otherwise it is hidden instead (Q47). Requests and lots join this
   * table in M2: lots point at projects, part numbers and build-ups; requests
   * at tools, types, BKMs, priorities, process steps and tool fields.
   */
  var USES = {
    tools: [['measurement_types', 'tool_id', 'measurement type'], ['tool_fields', 'tool_id', 'field'], ['bkms', 'tool_id', 'BKM'], ['requests', 'tool_id', 'request']],
    measurement_types: [['bkms', 'type_id', 'BKM'], ['tool_fields', 'type_ids', 'field'], ['requests', 'type_id', 'request']],
    projects: [['part_numbers', 'project_ids', 'part number'], ['requests', 'project_id', 'request']],
    part_numbers: [['requests', 'part_number_id', 'request']],
    buildups: [['requests', 'buildup_id', 'request']],
    lot_fields: [['lots', 'extra', 'lot']],
    tool_fields: [['requests', 'extra', 'request']],
    bkms: [['requests', 'bkm_id', 'request']],
    process_steps: [['requests', 'process_step_id', 'request']],
    hold_reasons: [['requests', 'hold_reason_id', 'request']],
    magazines: [['requests', 'magazine_id', 'request']],
    priorities: [['requests', 'priority_id', 'request']],
    holidays: []
  };

  /** {count, text} - text like "5 measurement types, 1 BKM". */
  function entryUsage(collection, id) {
    assert(USES[collection], 'Entries of this list cannot be deleted: ' + collection);
    var count = 0, parts = [];
    USES[collection].forEach(function (u) {
      var n = (state.data[u[0]] || []).filter(function (r) {
        if (u[1] === 'extra') return !!r.extra && !D.isEmptyAnswer(r.extra[id]);   // an answer to that field
        return Array.isArray(r[u[1]]) ? r[u[1]].indexOf(id) !== -1 : r[u[1]] === id;
      }).length;
      if (n) { count += n; parts.push(n + ' ' + u[2] + (n === 1 ? '' : 's')); }
    });
    return { count: count, text: parts.join(', ') };
  }

  function deleteEntry(collection, id, reason) {
    return guard(function () {
      requireAdmin();
      assert(collection !== 'users', 'People are never deleted - deactivate them instead (untick Active)');
      var spec = LISTS[collection];
      assert(spec && USES[collection], 'Unknown list: ' + collection);
      assert(isStr(reason), 'A reason is required');
      var row = need(collection, id, spec.label);
      var usage = entryUsage(collection, id);
      assert(!usage.count, 'This ' + spec.label + ' is still used by ' + usage.text + '. Hide it instead (untick Active).', 'in_use');
      if (collection === 'priorities') {
        var rest = state.data.priorities.filter(function (r) { return r.id !== id; });
        var pp = D.validatePriorities(rest);
        assert(!pp.length, pp.join('. '), 'invalid');
      }
      state.data[collection] = state.data[collection].filter(function (r) { return r.id !== id; });
      audit(spec.label.replace(/ /g, '_'), id, 'delete', null, row.code || row.name || row.label || row.date || id, null, reason.trim());
      return commit();
    });
  }

  /* ------------------------------------------------------------------ *
   * Requests (M2 step 4): drafts (private, Q33), submit with the request ID
   * (Q29), a timeline of events per request (Q11; shown in step 5).
   * ------------------------------------------------------------------ */

  var REQUEST_FIELDS = ['tool_id', 'type_id', 'lot_id', 'panels', 'priority_id', 'priority_reason', 'needed_by',
    'bkm_id', 'bkm_path', 'purpose', 'process_step_id', 'process_step_other', 'panel_location',
    'destructive_ok', 'after', 'after_other', 'extra', 'duplicated_from', 'magazine_id', 'slots', 'layers', 'panel_count', 'new_lot',
    'project_id', 'part_number_id', 'buildup_id'];

  function tidyRequest(f) {
    var o = clone(f || {});
    Object.keys(o).forEach(function (k) { assert(REQUEST_FIELDS.indexOf(k) !== -1, 'Unknown field: ' + k); });
    ['priority_reason', 'bkm_path', 'purpose', 'process_step_other', 'panel_location', 'after_other'].forEach(function (k) {
      if (typeof o[k] === 'string') o[k] = o[k].trim();
    });
    ['type_id', 'lot_id', 'priority_id', 'needed_by', 'bkm_id', 'process_step_id', 'after', 'magazine_id', 'panel_count', 'project_id', 'part_number_id', 'buildup_id'].forEach(function (k) { if (o[k] === '') o[k] = null; });
    if (Array.isArray(o.slots)) o.slots = o.slots.map(Number).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort(function (a, b) { return a - b; });
    if (Array.isArray(o.layers)) o.layers = o.layers.map(function (x) { return String(x).trim().toUpperCase(); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    if (o.panel_count !== null && o.panel_count !== undefined) o.panel_count = Number(o.panel_count);
    if (o.new_lot) o.new_lot = { lot_number: String(o.new_lot.lot_number || '').trim() };
    if ('new_lot' in o && o.new_lot && o.lot_id) o.new_lot = null;
    if (Array.isArray(o.panels)) {
      o.panels = o.panels.map(function (x) { return String(x).trim(); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
      if (o.panels.length) o.panel_count = o.panels.length;       // with IDs, the count is theirs
    }
    if ('extra' in o) o.extra = tidyExtra(o.extra);
    if ('destructive_ok' in o) o.destructive_ok = o.destructive_ok === true;
    return o;
  }

  function event(requestId, kind, from, to, text) {
    state.data.request_events.push({ id: newId('rev'), request_id: requestId, ts: nowIso(), user_id: state.currentUserId,
                                     kind: kind, from: from || null, to: to || null, text: text || null });
  }

  /** The draft as it would be after o (create or update); checks rights and version. */
  function draftFrom(o, me) {
    var f = tidyRequest(o.fields);
    var existing = o.id ? need('requests', o.id, 'Request') : null;
    if (existing) {
      assert(D.canEditDraft(me, existing), existing.status === 'draft' ? 'Only the author can change a draft' : 'This request is submitted already', 'not_allowed');
      checkVersion(existing, o.version, 'This draft');
      return { existing: existing, next: Object.assign(clone(existing), f) };
    }
    assert(D.canRequest(me), 'Only engineers can request measurements', 'not_allowed');
    var blank = { id: newId('req'), request_no: null, status: 'draft', tool_id: null, type_id: null, lot_id: null, panels: [],
      priority_id: null, priority_reason: '', needed_by: null, bkm_id: null, bkm_path: '', purpose: '', process_step_id: null,
      process_step_other: '', layers: [], panel_count: null, new_lot: null, project_id: null, part_number_id: null, buildup_id: null, panel_location: '', magazine_id: null, slots: [], destructive_ok: false, after: null, after_other: '', extra: {},
      duplicated_from: null, requester_id: me.id, created_ts: nowIso(), updated_ts: null, submitted_ts: null, version: 0 };
    return { existing: null, next: Object.assign(blank, f) };
  }

  function putDraft(x) {
    var n = x.next;
    n.updated_ts = nowIso();
    if (x.existing) {
      var changed = REQUEST_FIELDS.filter(function (k) { return JSON.stringify(x.existing[k]) !== JSON.stringify(n[k]); });
      n.version = x.existing.version + 1;
      Object.keys(x.existing).forEach(function (k) { delete x.existing[k]; });
      Object.assign(x.existing, n);
      return { row: x.existing, changed: changed };
    }
    n.version = 1;
    state.data.requests.push(n);
    event(n.id, 'created', null, 'draft', n.duplicated_from ? 'Copied from ' + ((byId('requests', n.duplicated_from) || {}).request_no || 'another request') : null);
    return { row: n, changed: null };
  }

  /**
   * Save a draft (create or change). Needs only a tool; everything else can
   * wait for the submit.
   * @param {Object} o {id?, version?, fields}
   */
  function saveDraft(o) {
    return guard(function () {
      var me = requireUser();
      var x = draftFrom(o, me);
      var problems = D.requestProblems(x.next, state.data, { submit: false });
      assert(!problems.length, problems.join('. '), 'invalid', problems);
      if (x.existing) {
        var same = REQUEST_FIELDS.every(function (k) { return JSON.stringify(x.existing[k]) === JSON.stringify(x.next[k]); });
        assert(!same, 'Nothing was changed', 'no_change');
      }
      var res = putDraft(x);
      if (!x.existing) audit('request', res.row.id, 'create', 'status', null, 'draft', null);
      return commit().then(function () { return res.row; });
    });
  }

  /**
   * Submit (create or change the draft, then submit in one save): every
   * required field checked, the request ID given (Q29), the timeline starts.
   * Warnings (Q44) are for the screen to show before; they never block.
   * @param {Object} o {id?, version?, fields}
   */
  /** A lot typed in the form is registered when the request is sent (F-5). */
  function registerNewLot(r, me) {
    var nl = r.new_lot;
    if (!nl) return;
    assert(D.canRegisterLot(me), 'Only engineers can register lots', 'not_allowed');
    var lot = { id: newId('lot'), lot_number: nl.lot_number, panel_count: null, note: '', extra: {}, scrapped: [], owner_id: me.id, created_ts: nowIso(), version: 1 };
    var lp = D.validateEntry('lots', lot, state.data);
    assert(!lp.length, lp.join('. '), 'invalid', lp);
    state.data.lots.push(lot);
    audit('lot', lot.id, 'create', null, null, lot.lot_number, 'Registered with a request');
    r.lot_id = lot.id; r.new_lot = null;
  }

  function submitRequest(o) {
    return guard(function () {
      var me = requireUser();
      var x = draftFrom(o, me);
      var problems = D.requestProblems(x.next, state.data, { submit: true });
      assert(!problems.length, problems.join('. '), 'invalid', problems);
      var tool = byId('tools', x.next.tool_id);
      var taken = state.data.requests.map(function (r) { return r.request_no; });
      registerNewLot(x.next, me);
      var res = putDraft(x);
      var r = res.row;
      r.request_no = D.nextRequestNo(tool.code, D.viennaYmd(Date.now()), taken);
      r.status = 'submitted';
      r.submitted_ts = nowIso();
      event(r.id, 'status', 'draft', 'submitted', null);
      var who = D.assignOnSubmit(tool, state.data.users, D.viennaYmd(Date.now()));
      r.assigned_to = who.id;
      if (who.note) event(r.id, 'assign', null, who.id, who.note);
      audit('request', r.id, 'submit', 'status', 'draft', 'submitted', r.request_no);
      return commit().then(function () { return r; });
    });
  }

  /** A draft can be thrown away by its author; submitted requests never are (Q35: cancel instead). */
  function deleteDraft(id) {
    return guard(function () {
      var me = requireUser();
      var r = need('requests', id, 'Request');
      assert(D.canEditDraft(me, r), r.status === 'draft' ? 'Only the author can delete a draft' : 'Submitted requests are never deleted - cancel them instead', 'not_allowed');
      state.data.requests = state.data.requests.filter(function (x) { return x.id !== id; });
      state.data.request_events = state.data.request_events.filter(function (e) { return e.request_id !== id; });
      audit('request', id, 'delete', 'status', 'draft', null, 'Draft deleted');
      return commit();
    });
  }

  /**
   * A comment on the timeline (Q11). @mentions are stored with it; the bell
   * and emails come in M4.
   */
  function addComment(requestId, text) {
    return guard(function () {
      var me = requireUser();
      var r = need('requests', requestId, 'Request');
      assert(D.canComment(me, r), 'Comments are for submitted requests', 'not_allowed');
      var t = String(text || '').trim();
      assert(t, 'Write something first', 'invalid');
      assert(t.length <= D.COMMENT_MAX, 'Keep a comment under ' + D.COMMENT_MAX + ' characters', 'invalid');
      var mentions = D.findMentions(t, state.data.users);
      state.data.request_events.push({ id: newId('rev'), request_id: r.id, ts: nowIso(), user_id: me.id, kind: 'comment',
                                       from: null, to: null, text: t, mentions: mentions });
      audit('request', r.id, 'comment', null, null, t.length > 80 ? t.slice(0, 80) + '...' : t, null);
      return commit().then(function () { return r; });
    });
  }

  /** Cancel with a reason (Q35). A cancelled request stays, never deleted. */
  function cancelRequest(requestId, reason) {
    return guard(function () {
      var me = requireUser();
      var r = need('requests', requestId, 'Request');
      assert(D.canCancel(me, r, byId('tools', r.tool_id)), D.isOpen(r) ? 'Only the requester, the tool\'s quality engineers or an admin can cancel' : 'This request is not open', 'not_allowed');
      assert(isStr(reason), 'A reason is required', 'invalid');
      var from = r.status;
      r.status = 'cancelled';
      r.cancelled_ts = nowIso();
      r.version += 1;
      event(r.id, 'status', from, 'cancelled', reason.trim());
      audit('request', r.id, 'status', 'status', from, 'cancelled', reason.trim());
      return commit().then(function () { return r; });
    });
  }

  /**
   * A workflow action (DECISIONS M3-9, domain.TRANSITIONS): accept, start,
   * hold, resume, clarify, answer, complete, reopen, results_ok.
   * @param {string} requestId
   * @param {string} action
   * @param {Object} x  what the action needs: {expected_done} accept, {received_where, received} start,
   *                    {hold_reason_id, note} hold, {text} clarify/answer/reopen,
   *                    {results_path, panels_outcome, note} complete
   */
  function requestAction(requestId, action, x) {
    return guard(function () {
      var me = requireUser();
      var r = need('requests', requestId, 'Request');
      var tool = byId('tools', r.tool_id);
      var t = D.TRANSITIONS[action];
      assert(t, 'Unknown action: ' + action);
      assert(D.canAct(me, action, r, tool, Date.now()), t.from.indexOf(r.status) === -1
        ? t.label + ' is not possible while the request is ' + D.REQUEST_STATUS_LABEL[r.status]
        : 'Only ' + (t.who === 'measurer' ? 'the tool\'s quality engineers or an admin' : 'the requester or an admin') + ' can do this', 'not_allowed');
      x = x || {};
      var problems = D.actionProblems(action, x, state.data);
      assert(!problems.length, problems.join('. '), 'invalid', problems);
      var from = r.status;
      var to = t.back ? (r.return_to || 'submitted') : t.to;
      var text = x.text ? String(x.text).trim() : null;
      var now = nowIso();

      if (action === 'accept') { r.expected_done = x.expected_done || null; r.accepted_ts = now; if (!r.assigned_to) r.assigned_to = me.id; }
      if (action === 'start') {
        r.started_ts = now;
        if (x.received && !r.received_ts) { r.received_ts = now; r.received_by = me.id; r.received_where = String(x.received_where || '').trim(); }
      }
      if (action === 'hold') {
        r.return_to = from; r.hold_reason_id = x.hold_reason_id; r.hold_note = String(x.note || '').trim();
        var hr = byId('hold_reasons', x.hold_reason_id);
        text = hr.name + (r.hold_note ? ': ' + r.hold_note : '');
      }
      if (action === 'clarify') r.return_to = from;
      if (action === 'resume' || action === 'answer') { r.return_to = null; if (action === 'resume') { r.hold_reason_id = null; r.hold_note = ''; } }
      if (action === 'complete') {
        r.completed_ts = now; r.completed_by = me.id; r.results_path = String(x.results_path).trim();
        r.panels_outcome = x.panels_outcome; r.panels_outcome_note = String(x.note || '').trim();
        putBack(r, x.panels_outcome, x.put_back);
        text = D.PANEL_OUTCOME_LABEL[x.panels_outcome] + (r.panels_outcome_note ? ': ' + r.panels_outcome_note : '') + ' - results in ' + r.results_path;
      }
      if (action === 'reopen') { r.reopened = (r.reopened || 0) + 1; r.completed_ts = null; r.results_ok_ts = null; }
      if (action === 'results_ok') r.results_ok_ts = now;

      r.status = to;
      r.version += 1;
      event(r.id, action === 'results_ok' ? 'results_ok' : 'status', from, to, text);
      if (action === 'accept' && r.expected_done) state.data.request_events[state.data.request_events.length - 1].expected_done = r.expected_done;
      // the reason as an ID too, so analytics can count on-hold reasons (Q20, M5)
      if (action === 'hold') state.data.request_events[state.data.request_events.length - 1].hold_reason_id = r.hold_reason_id;
      audit('request', r.id, action, 'status', from, to, text);
      return commit().then(function () { return r; });
    });
  }

  /** Panels received (Q25): who, when, kept where. */
  function receivePanels(requestId, where) {
    return guard(function () {
      var me = requireUser();
      var r = need('requests', requestId, 'Request');
      assert(D.canReceive(me, r, byId('tools', r.tool_id)), r.received_ts ? 'The panels are marked received already' : 'Only the tool\'s quality engineers or an admin', 'not_allowed');
      r.received_ts = nowIso(); r.received_by = me.id; r.received_where = String(where || '').trim();
      r.version += 1;
      event(r.id, 'panels', null, null, r.received_where ? 'Kept at ' + r.received_where : null);
      audit('request', r.id, 'panels_received', 'received_where', null, r.received_where || '-', null);
      return commit().then(function () { return r; });
    });
  }

  /** "Take it" (M3-7): the tool's other quality engineer takes the request over. */
  function takeRequest(requestId) {
    return guard(function () {
      var me = requireUser();
      var r = need('requests', requestId, 'Request');
      assert(D.canTake(me, r, byId('tools', r.tool_id)), 'Only the tool\'s quality engineers can take an open request', 'not_allowed');
      var from = r.assigned_to;
      r.assigned_to = me.id;
      r.version += 1;
      event(r.id, 'assign', from, me.id, null);
      audit('request', r.id, 'assign', 'assigned_to', from, me.id, null);
      return commit().then(function () { return r; });
    });
  }

  /**
   * Complete: where the panels go back (M3-13, F-3). Scrapped panels are
   * marked scrapped on the lot (they cannot be requested again); others go
   * into the chosen magazine slots.
   */
  function putBack(r, outcome, pb) {
    var lot = byId('lots', r.lot_id);
    if (outcome === 'scrapped') {
      if (lot && (r.panels || []).length) {
        lot.scrapped = lot.scrapped || [];
        r.panels.forEach(function (n) { if (lot.scrapped.indexOf(n) === -1) lot.scrapped.push(n); });
        lot.version += 1;
      }
      return;
    }
    if (!pb || !pb.magazine_id) return;
    var m = need('magazines', pb.magazine_id, 'Magazine');
    var slots = (pb.slots || []).map(Number).filter(function (x, i, a) { return x >= 1 && x <= m.slots && a.indexOf(x) === i; }).sort(function (a, b) { return a - b; });
    var taken = D.takenSlots(state.data.requests, m.id, r.id);
    var clash = slots.filter(function (x) { return taken[x]; });
    assert(!clash.length, m.code + ' slot ' + clash.join(', ') + ' is taken by ' + taken[clash[0]], 'invalid');
    r.put_back = { magazine_id: m.id, slots: slots };
  }

  /** "panels 1-4 -> 1-6" style lines for the timeline. */
  function describeChange(k, a, b) {
    function show(v) {
      if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return '-';
      if (k === 'panels' || k === 'layers') return v.join(', ');
      if (k === 'slots') return D.formatPanels(v);
      if (k === 'magazine_id') { var mg = byId('magazines', v); return mg ? mg.code : '?'; }
      var coll = { type_id: 'measurement_types', lot_id: 'lots', priority_id: 'priorities', bkm_id: 'bkms', process_step_id: 'process_steps',
                   project_id: 'projects', part_number_id: 'part_numbers', buildup_id: 'buildups' }[k];
      if (coll) { var row = byId(coll, v); return row ? (row.lot_number || row.name || row.code) : '?'; }
      if (k === 'after') return D.AFTER_LABEL[v] || v;
      if (k === 'destructive_ok') return v ? 'yes' : 'no';
      if (k === 'extra') return 'changed';
      return String(v);
    }
    var names = { type_id: 'type', lot_id: 'lot', priority_id: 'priority', priority_reason: 'priority reason', needed_by: 'needed by',
      bkm_id: 'BKM', bkm_path: 'BKM path', process_step_id: 'process step', process_step_other: 'process step', panel_location: 'panels are now',
      destructive_ok: 'destructive OK', after_other: 'afterwards (other)', extra: 'tool fields', magazine_id: 'magazine', panel_count: 'how many panels',
      project_id: 'project', part_number_id: 'part number', buildup_id: 'build-up' };
    return (names[k] || k) + ' ' + show(a) + ' -> ' + show(b);
  }

  /**
   * Edit a submitted request (Q14, M3-5): everything but the tool, with a
   * reason; each change shows in the timeline.
   * @param {Object} o {id, version?, fields, reason}
   */
  function editRequest(o) {
    return guard(function () {
      var me = requireUser();
      var r = need('requests', o.id, 'Request');
      assert(D.canEditSubmitted(me, r), 'Only the requester or an admin can change an open request', 'not_allowed');
      checkVersion(r, o.version, 'This request');
      assert(isStr(o.reason), 'Say why you change it', 'invalid');
      var f = tidyRequest(o.fields);
      assert(!('tool_id' in f) || f.tool_id === r.tool_id, 'The tool cannot change - cancel and copy the request instead', 'invalid');
      delete f.tool_id; delete f.duplicated_from;
      var next = Object.assign(clone(r), f);
      var problems = D.requestProblems(next, state.data, { submit: true });
      assert(!problems.length, problems.join('. '), 'invalid', problems);
      var changed = REQUEST_FIELDS.filter(function (k) { return k !== 'tool_id' && k !== 'duplicated_from' && JSON.stringify(r[k]) !== JSON.stringify(next[k]); });
      assert(changed.length, 'Nothing was changed', 'no_change');
      registerNewLot(next, me);
      changed = changed.filter(function (k) { return k !== 'new_lot'; });
      if (changed.indexOf('lot_id') === -1 && next.lot_id !== r.lot_id) changed.push('lot_id');
      var lines = changed.map(function (k) { return describeChange(k, r[k], next[k]); });
      changed.forEach(function (k) { audit('request', r.id, 'update', k, r[k], next[k], o.reason.trim()); r[k] = next[k]; });
      r.updated_ts = nowIso();
      r.version += 1;
      event(r.id, 'edit', null, null, lines.join('; ') + '. Reason: ' + o.reason.trim());
      return commit().then(function () { return r; });
    });
  }

  /** Requests the signed-in person may see (drafts only their own), newest first. */
  function visibleRequests(filter) {
    var me = currentUser();
    return (state.data.requests || []).filter(function (r) { return D.canSeeRequest(me, r) && (!filter || filter(r)); })
      .sort(function (a, b) { var x = a.submitted_ts || a.created_ts, y = b.submitted_ts || b.created_ts; return x < y ? 1 : x > y ? -1 : 0; });
  }

  /** The timeline of one request, oldest first. */
  function requestEvents(requestId) {
    return (state.data.request_events || []).filter(function (e) { return e.request_id === requestId; });
  }

  /* ------------------------------------------------------------------ *
   * Lots (Q7/Q8, DECISIONS M2-1): any engineer registers one; its owner
   * or an admin changes or deletes it (delete only while no request uses it).
   * ------------------------------------------------------------------ */

  var LOT_FIELDS = ['lot_number', 'panel_count', 'note', 'extra'];     // project, part number, build-up: on the request (F-6)

  /** Tidy the answers to lot fields: text trimmed, empty answers dropped. */
  function tidyExtra(ex) {
    var out = {};
    Object.keys(ex || {}).forEach(function (k) {
      var v = ex[k];
      if (typeof v === 'string') v = v.trim();
      if (!D.isEmptyAnswer(v)) out[k] = v;
    });
    return out;
  }

  /**
   * Register or change a lot.
   * @param {Object} o {id?, version?, fields: {lot_number, panel_count, note, extra}, reason?}
   * @returns Promise<lot>
   */
  function saveLot(o) {
    return guard(function () {
      var me = requireUser();
      var f = clone(o.fields || {});
      Object.keys(f).forEach(function (k) { assert(LOT_FIELDS.indexOf(k) !== -1, 'Unknown field: ' + k); });
      if (typeof f.lot_number === 'string') f.lot_number = f.lot_number.trim();
      if (typeof f.note === 'string') f.note = f.note.trim();
      if ('extra' in f) f.extra = tidyExtra(f.extra);
      if (f.panel_count === '' || f.panel_count === undefined && 'panel_count' in f) f.panel_count = null;
      var existing = o.id ? need('lots', o.id, 'Lot') : null;
      var next;
      if (existing) {
        assert(D.canEditLot(me, existing), 'Only the lot owner or an admin can change this lot', 'not_allowed');
        checkVersion(existing, o.version, 'This lot');
        next = Object.assign(clone(existing), f);
      } else {
        assert(D.canRegisterLot(me), 'Only engineers can register lots', 'not_allowed');
        next = Object.assign({ id: newId('lot'), panel_count: null, note: '', extra: {}, scrapped: [], owner_id: me.id, created_ts: nowIso() }, f);
      }
      var problems = D.validateEntry('lots', next, state.data);
      assert(!problems.length, problems.join('. '), 'invalid', problems);
      var reason = o.reason ? String(o.reason).trim() : null;
      if (existing) {
        var changes = LOT_FIELDS.filter(function (k) { return JSON.stringify(existing[k]) !== JSON.stringify(next[k]); });
        assert(changes.length, 'Nothing was changed', 'no_change');
        changes.forEach(function (k) { audit('lot', existing.id, 'update', k, existing[k], next[k], reason); existing[k] = next[k]; });
        existing.version += 1;
        return commit().then(function () { return existing; });
      }
      next.version = 1;
      state.data.lots.push(next);
      audit('lot', next.id, 'create', null, null, next.lot_number, reason);
      return commit().then(function () { return next; });
    });
  }

  /**
   * Three made-up lots to try the app with a real data file (admin). Marked
   * sample (a Sample tag, listed in Health), owned by the admin, deletable.
   * Numbers 99901, 99902, 99902.01 - any already taken are skipped.
   */
  function addSampleLots() {
    return guard(function () {
      var me = requireAdmin();
      var plan = [['99901', 0, 12, 'Sample lot - delete when done'], ['99902', 1, 24, 'Sample lot'], ['99902.01', 1, 6, 'Sample split lot of 99902']];
      var added = 0;
      plan.forEach(function (x) {
        if (state.data.lots.some(function (l) { return l.lot_number === x[0]; })) return;
        var lot = { id: newId('lot'), lot_number: x[0], panel_count: x[2], note: x[3], extra: {}, scrapped: [], owner_id: me.id, created_ts: nowIso(), sample: true, version: 1 };
        var problems = D.validateEntry('lots', lot, state.data);
        assert(!problems.length, problems.join('. '), 'invalid', problems);
        state.data.lots.push(lot);
        audit('lot', lot.id, 'create', null, null, lot.lot_number, 'Sample lot');
        added++;
      });
      assert(added, 'The sample lots are there already', 'no_change');
      return commit().then(function () { return added; });
    });
  }

  /**
   * Admin: the 20 sample magazines of seed.js (M70345 ...), for a data file that has none -
   * e.g. one made before magazines existed, whose list stayed empty. Codes already there are skipped.
   */
  function addSampleMagazines() {
    return guard(function () {
      requireAdmin();
      var have = {};
      state.data.magazines.forEach(function (m) { have[m.code] = true; });
      var rows = magazinesFromSeed(window.MRT.seed).filter(function (m) { return !have[m.code]; });
      assert(rows.length, 'The sample magazines are there already', 'no_change');
      rows.forEach(function (m) { state.data.magazines.push(m); audit('magazine', m.id, 'create', null, null, m.code, 'Sample magazine'); });
      return commit().then(function () { return rows.length; });
    });
  }

  /**
   * Admin: register several lots at once that share panel count, note and
   * lot fields (Settings > Lots). All or nothing - a number
   * already registered stops the whole batch and is named.
   * @param {Object} o {numbers: ['18178', ...], fields: {panel_count, note, extra}}
   * @returns Promise<lots>
   */
  function addLots(o) {
    return guard(function () {
      var me = requireAdmin();
      var nums = (o.numbers || []).map(function (n) { return String(n).trim(); }).filter(Boolean);
      assert(nums.length, 'Enter at least one lot number', 'invalid');
      assert(nums.length <= 200, 'At most 200 lots at once', 'invalid');
      var taken = nums.filter(function (n) { return state.data.lots.some(function (l) { return l.lot_number === n; }); });
      assert(!taken.length, 'Already registered: ' + taken.join(', '), 'invalid');
      var f = clone(o.fields || {});
      Object.keys(f).forEach(function (k) { assert(LOT_FIELDS.indexOf(k) !== -1 && k !== 'lot_number', 'Unknown field: ' + k); });
      if (typeof f.note === 'string') f.note = f.note.trim();
      f.extra = tidyExtra(f.extra);
      var rows = [], wouldBe = Object.assign({}, state.data, { lots: state.data.lots.slice() });
      nums.forEach(function (n) {
        var lot = Object.assign({ id: newId('lot'), panel_count: null, note: '', extra: {}, scrapped: [], owner_id: me.id, created_ts: nowIso(), version: 1 },
                                clone(f), { lot_number: n });
        var problems = D.validateEntry('lots', lot, wouldBe);
        assert(!problems.length, 'Lot ' + n + ': ' + problems.join('. '), 'invalid', problems);
        wouldBe.lots.push(lot);
        rows.push(lot);
      });
      rows.forEach(function (lot) { state.data.lots.push(lot); audit('lot', lot.id, 'create', null, null, lot.lot_number, 'Added in Settings (' + rows.length + ' at once)'); });
      return commit().then(function () { return rows; });
    });
  }

  /** Admin: give a lot to another person (e.g. its owner left). */
  function setLotOwner(lotId, userId, reason) {
    return guard(function () {
      requireAdmin();
      var lot = need('lots', lotId, 'Lot');
      var u = need('users', userId, 'Person');
      assert(u.active !== false, u.name + ' is switched off', 'invalid');
      assert(lot.owner_id !== u.id, 'Nothing was changed', 'no_change');
      assert(isStr(reason), 'A reason is required', 'invalid');
      audit('lot', lot.id, 'update', 'owner_id', lot.owner_id, u.id, reason.trim());
      lot.owner_id = u.id;
      lot.version += 1;
      return commit().then(function () { return lot; });
    });
  }

  /** What uses a lot (requests from M2 step 4). */
  function lotUsage(id) {
    var n = (state.data.requests || []).filter(function (r) { return r.lot_id === id; }).length;
    return { count: n, text: n ? n + ' request' + (n === 1 ? '' : 's') : '' };
  }

  function deleteLot(id, reason) {
    return guard(function () {
      var me = requireUser();
      var lot = need('lots', id, 'Lot');
      assert(D.canEditLot(me, lot), 'Only the lot owner or an admin can delete this lot', 'not_allowed');
      assert(isStr(reason), 'A reason is required');
      var usage = lotUsage(id);
      assert(!usage.count, 'Lot ' + lot.lot_number + ' is used by ' + usage.text + ' and cannot be deleted.', 'in_use');
      state.data.lots = state.data.lots.filter(function (r) { return r.id !== id; });
      audit('lot', id, 'delete', null, lot.lot_number, null, reason.trim());
      return commit();
    });
  }

  /**
   * Tool status Up / Down / Maintenance (Q27): the tool's operators or an admin.
   * @param {Object} o {tool_id, status, until (YYYY-MM-DD or null), note, reason}
   */
  function setToolStatus(o) {
    return guard(function () {
      var u = requireUser();
      var tool = need('tools', o.tool_id, 'Tool');
      assert(D.canSetToolStatus(u, tool), 'Only this tool\'s operators or an admin can change its status', 'not_allowed');
      var next = Object.assign(clone(tool), {
        status: o.status, status_until: o.status === 'up' ? null : (o.until || null),
        status_note: String(o.note || '').trim()
      });
      var problems = D.validateEntry('tools', next, state.data);
      assert(!problems.length, problems.join('. '), 'invalid', problems);
      var changed = ['status', 'status_until', 'status_note'].filter(function (k) { return tool[k] !== next[k]; });
      assert(changed.length, 'Nothing was changed', 'no_change');
      changed.forEach(function (k) { audit('tool', tool.id, 'status', k, tool[k], next[k], o.reason || null); tool[k] = next[k]; });
      tool.version += 1;
      return commit().then(function () { return tool; });
    });
  }

  /** Lab days and hours (M1-9), admin. cal: {days, start, end}. */
  function updateCalendar(cal, reason) {
    return guard(function () {
      requireAdmin();
      var next = { days: (cal.days || []).slice().sort(), start: cal.start, end: cal.end };
      var problems = D.validateCalendar(next);
      assert(!problems.length, problems.join('. '), 'invalid', problems);
      var before = calendar();
      var map = { lab_days: next.days, lab_start: next.start, lab_end: next.end };
      var old = { lab_days: before.days, lab_start: before.start, lab_end: before.end };
      var keys = Object.keys(map).filter(function (k) { return JSON.stringify(old[k]) !== JSON.stringify(map[k]); });
      assert(keys.length, 'Nothing was changed', 'no_change');
      keys.forEach(function (k) { audit('setting', k, 'update', k, old[k], map[k], reason || null); setSettingValue(k, map[k]); });
      if (!getSetting('calendar_confirmed')) setSettingValue('calendar_confirmed', true);
      return commit().then(calendar);
    });
  }

  /** "These days and hours are right" - clears the setup to-do without changing them. */
  function confirmCalendar(reason) {
    return guard(function () {
      requireAdmin();
      assert(!getSetting('calendar_confirmed'), 'The calendar is already confirmed', 'no_change');
      audit('setting', 'calendar_confirmed', 'update', 'calendar_confirmed', false, true, reason || 'Lab days and hours confirmed');
      setSettingValue('calendar_confirmed', true);
      return commit().then(calendar);
    });
  }

  /** Health and the setup to-do list (Settings > Health), as of today in Vienna. */
  function health() {
    var o = { today_ymd: D.viennaYmd(Date.now()), calendar_confirmed: !!getSetting('calendar_confirmed') };
    return { todo: D.setupTodo(state.data, o), issues: D.healthIssues(state.data, o) };
  }

  /** Add the Austrian public holidays of a year (admin). Dates already listed are skipped. */
  function addPublicHolidays(year, reason) {
    return guard(function () {
      requireAdmin();
      assert(isNum(year) && year >= 2000 && year <= 2100, 'Pick a year between 2000 and 2100');
      var have = {};
      state.data.holidays.forEach(function (h) { have[h.date] = true; });
      var add = D.austrianHolidays(year).filter(function (h) { return !have[h.date]; });
      assert(add.length, 'All public holidays of ' + year + ' are listed already', 'no_change');
      add.forEach(function (h) {
        var row = { id: newId('hol'), date: h.date, name: h.name, kind: 'public', source: 'rule', version: 1 };
        state.data.holidays.push(row);
        audit('holiday', row.id, 'create', null, null, row.date, reason || 'Public holidays ' + year);
      });
      return commit().then(function () { return add.length; });
    });
  }

  /* ------------------------------------------------------------------ *
   * Undo: the last change can be taken back for cfg.undo_ms.
   * The file as it was before each change is kept as JSON text, so undo puts
   * every collection back exactly - except the audit log, which only grows:
   * the original entries stay and an "undo" entry is added.
   * ------------------------------------------------------------------ */

  function resetUndo() {
    state.baseline = state.data ? JSON.stringify(state.data) : null;
    state.auditLen = state.data ? state.data.audit_log.length : 0;
    state.undo = null;
  }

  function recordUndo() {
    var added = state.data.audit_log.slice(state.auditLen || 0);
    if (state.undoing || state.noUndo || !state.baseline || !added.length) state.undo = null;
    else {
      var e = added[added.length - 1];
      state.undo = { before: state.baseline, ts: Date.now(),
                     label: String(e.action || 'change').replace(/_/g, ' ') + ' ' + String(e.entity || '').replace(/_/g, ' ') };
    }
    state.baseline = JSON.stringify(state.data);
    state.auditLen = state.data.audit_log.length;
  }

  /** {label, ms_left} while the last change can still be undone, else null. */
  function undoInfo() {
    var u = state.undo;
    if (!u) return null;
    var left = cfg.undo_ms - (Date.now() - u.ts);
    return left > 0 ? { label: u.label, ms_left: left } : null;
  }

  /** Take back the last change. Audited; cannot itself be undone. */
  function undoLast() {
    return guard(function () {
      requireUser();
      var info = undoInfo();
      assert(info, 'There is nothing to undo any more (undo works for ' + cfg.undo_ms / 1000 + ' s after a change).', 'no_undo');
      var before = JSON.parse(state.undo.before);
      before.audit_log = state.data.audit_log;       // history only grows
      before.revision = state.data.revision;
      before.saved_ts = state.data.saved_ts;
      before.saved_by = state.data.saved_by;
      state.data = before;
      audit('undo', null, 'undo', null, info.label, null, 'Undo of the last change');
      state.undoing = true;
      var p = commit();
      state.undoing = false;
      return p.then(function () { return info.label; });
    });
  }

  function emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail })); }
    catch (ignored) { /* no DOM (node tests) */ }
  }

  /**
   * Save after a change. On failure the change stays in memory and the shell
   * offers Retry / Download. commit({undo: false}) for changes that must not
   * be taken back with Undo (who you are, a restore).
   */
  function commit(o) {
    state.noUndo = !!(o && o.undo === false);
    recordUndo();
    state.noUndo = false;
    state.changeSeq = (state.changeSeq || 0) + 1;    // read caches key on this
    if (!state.undoing) emit('mrt:committed');
    return save().catch(function (e) {
      console.error('MRT: save failed', e);
      emit('mrt:save-failed', e);
      throw e;
    });
  }

  /* ------------------------------------------------------------------ *
   * Read-only access for screens
   * ------------------------------------------------------------------ */

  function data() { return state.data; }

  /** A list, active entries only unless {all: true}; sorted by sort/level/code/name. */
  function list(collection, o) {
    var rows = (state.data && state.data[collection]) || [];
    if (!(o && o.all)) rows = rows.filter(function (r) { return r.active !== false; });
    return rows.slice().sort(function (a, b) {
      var ka = [a.sort, a.level, a.date, a.code, a.name, a.label], kb = [b.sort, b.level, b.date, b.code, b.name, b.label];
      for (var i = 0; i < ka.length; i++) {
        if (ka[i] === undefined || kb[i] === undefined || ka[i] === kb[i]) continue;
        return ka[i] < kb[i] ? -1 : 1;
      }
      return 0;
    });
  }

  function status() {
    var a = state.adapter;
    return {
      storage: a ? a.id : null,
      connected: !!(a && a.label && a.label()),
      loaded: !!state.data,
      revision: state.loadedRevision,
      changeSeq: state.changeSeq || 0,
      folderName: a && a.label ? a.label() : null,
      savedTs: state.data ? state.data.saved_ts || null : null,
      savedBy: state.data ? state.data.saved_by || null : null,
      pendingSave: state.pendingSave,
      upgradedFrom: state.upgradedFrom,
      currentUserId: state.currentUserId,
      lastError: state.lastError
    };
  }

  var api = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    COLLECTIONS: COLLECTIONS,
    LISTS: LISTS,
    SEED_SETTINGS: SEED_SETTINGS,

    // storage and file
    init: init,
    isSupported: isSupported,
    unsupportedMessage: unsupportedMessage,
    hasSavedConnection: hasSavedConnection,
    savedConnectionLabel: savedConnectionLabel,
    connect: connect,
    reconnect: reconnect,
    load: load,
    retrySave: retrySave,
    exportText: exportText,
    checkForExternalChange: checkForExternalChange,
    listBackups: listBackups,
    restoreBackup: restoreBackup,

    // people and identity
    findUserByIdentity: findUserByIdentity,
    nameMatches: nameMatches,
    setCurrentUser: setCurrentUser,
    currentUser: currentUser,
    signOut: signOut,
    createFirstAdmin: createFirstAdmin,
    selfRegister: selfRegister,
    linkIdentity: linkIdentity,
    markUserReviewed: markUserReviewed,
    setAway: setAway,
    saveLot: saveLot,
    saveDraft: saveDraft,
    submitRequest: submitRequest,
    deleteDraft: deleteDraft,
    addComment: addComment,
    cancelRequest: cancelRequest,
    requestAction: requestAction,
    receivePanels: receivePanels,
    takeRequest: takeRequest,
    editRequest: editRequest,
    visibleRequests: visibleRequests,
    requestEvents: requestEvents,
    addSampleLots: addSampleLots,
    addSampleMagazines: addSampleMagazines,
    replaceData: replaceData,
    setDefaultTheme: setDefaultTheme,
    addLots: addLots,
    setLotOwner: setLotOwner,
    deleteLot: deleteLot,
    lotUsage: lotUsage,
    hasPin: hasPin,
    verifyPin: verifyPin,
    setAdminPin: setAdminPin,

    // lists and settings
    saveEntry: saveEntry,
    deleteEntry: deleteEntry,
    entryUsage: entryUsage,
    setToolStatus: setToolStatus,
    myTemplates: myTemplates,
    saveTemplate: saveTemplate,
    renameTemplate: renameTemplate,
    deleteTemplate: deleteTemplate,
    updateCalendar: updateCalendar,
    confirmCalendar: confirmCalendar,
    health: health,
    addPublicHolidays: addPublicHolidays,

    // undo
    undoInfo: undoInfo,
    undoLast: undoLast,

    // reads
    data: data,
    list: list,
    byId: byId,
    getSetting: getSetting,
    calendar: calendar,
    status: status,

    // pure helpers, exposed for tests/tests.js only
    _pure: { seedData: seedData, migrate: migrate, validateAndFill: validateAndFill, MIGRATIONS: MIGRATIONS }
  };
  return api;
})();
