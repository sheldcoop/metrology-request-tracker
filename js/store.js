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

  var SCHEMA_VERSION = 1;

  var COLLECTIONS = [
    'users', 'settings', 'tools', 'measurement_types', 'tool_fields', 'bkms',
    'projects', 'buildups', 'priorities', 'holidays', 'audit_log'
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
    last_backup_date: null
  };

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
      var tool = { id: newId('tool'), code: t.code, name: t.name, glyph: t.glyph || 'generic', status: 'up', status_until: null,
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
   * into n + 1. None yet - version 1 is the first. Add steps here, with a test.
   */
  var MIGRATIONS = {};

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
      return files.filter(function (f) { return isDailyBackup(f.name); }).map(function (f) {
        return { name: f.name, date: f.name.slice(cfg.backup_prefix.length, cfg.backup_prefix.length + 10),
                 size_kb: Math.round(f.size / 1024) };
      }).sort(function (a, b) { return a.name < b.name ? 1 : -1; });
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
      assert(isDailyBackup(name), 'Not a backup file: ' + name);
      return adapter().read(cfg.backup_dir + '/' + name).then(function (text) {
        assert(text !== null, 'Backup not found: ' + name, 'not_found');
        var restored = migrate(validateAndFill(parseFile(text, name)));
        var safety = cfg.backup_prefix + 'before-restore_' + stamp() + '.json';
        return adapter().write(cfg.backup_dir + '/' + safety, JSON.stringify(state.data, null, 2)).then(function () {
          restored.audit_log = state.data.audit_log;
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
    tools:             { prefix: 'tool',  label: 'tool',             fields: ['code', 'name', 'glyph', 'status', 'status_until', 'status_note', 'primary_operator_id', 'backup_operator_id', 'results_root', 'active', 'sort'] },
    measurement_types: { prefix: 'mtype', label: 'measurement type', fields: ['tool_id', 'name', 'active', 'sort'] },
    tool_fields:       { prefix: 'fld',   label: 'field',            fields: ['tool_id', 'label', 'type', 'required', 'help', 'unit', 'min', 'max', 'choices', 'type_ids', 'active', 'sort'] },
    bkms:              { prefix: 'bkm',   label: 'BKM',              fields: ['tool_id', 'type_id', 'name', 'path', 'doc_version', 'active'] },
    projects:          { prefix: 'prj',   label: 'project',          fields: ['code', 'name', 'active'] },
    buildups:          { prefix: 'bld',   label: 'build-up',         fields: ['code', 'name', 'active'] },
    priorities:        { prefix: 'prio',  label: 'priority',         fields: ['code', 'name', 'level', 'needs_reason', 'is_default', 'active'] },
    holidays:          { prefix: 'hol',   label: 'holiday',          fields: ['date', 'name', 'kind'] }
  };

  /** Defaults for a new entry, before the caller's fields. */
  var NEW_DEFAULTS = {
    users: { windows_id: null, domain: null, email: null, roles: ['engineer'], active: true, self_added: false, needs_review: false },
    tools: { glyph: 'generic', status: 'up', status_until: null, status_note: '', primary_operator_id: null,
             backup_operator_id: null, results_root: '', active: true },
    measurement_types: { active: true },
    tool_fields: { required: false, help: '', unit: '', min: null, max: null, choices: [], type_ids: [], active: true },
    bkms: { type_id: null, doc_version: '', active: true },
    projects: { name: '', active: true },
    buildups: { name: '', active: true },
    priorities: { needs_reason: false, is_default: false, active: true },
    holidays: { kind: 'closing', source: 'manual' }
  };

  /** Tidy what people type: codes upper case, IDs lower case, text trimmed. */
  function normalize(collection, f) {
    var o = clone(f);
    ['name', 'label', 'help', 'unit', 'status_note', 'doc_version', 'results_root', 'path'].forEach(function (k) {
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
      if (!existing && (collection === 'measurement_types' || collection === 'tool_fields' || collection === 'tools')) {
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
   * table in M2.
   */
  var USES = {
    tools: [['measurement_types', 'tool_id', 'measurement type'], ['tool_fields', 'tool_id', 'field'], ['bkms', 'tool_id', 'BKM']],
    measurement_types: [['bkms', 'type_id', 'BKM'], ['tool_fields', 'type_ids', 'field']],
    tool_fields: [], bkms: [], projects: [], buildups: [], priorities: [], holidays: []
  };

  /** {count, text} - text like "5 measurement types, 1 BKM". */
  function entryUsage(collection, id) {
    assert(USES[collection], 'Entries of this list cannot be deleted: ' + collection);
    var count = 0, parts = [];
    USES[collection].forEach(function (u) {
      var n = (state.data[u[0]] || []).filter(function (r) {
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
    hasPin: hasPin,
    verifyPin: verifyPin,
    setAdminPin: setAdminPin,

    // lists and settings
    saveEntry: saveEntry,
    deleteEntry: deleteEntry,
    entryUsage: entryUsage,
    setToolStatus: setToolStatus,
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
