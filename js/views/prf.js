/**
 * Metrology Request Tracker - views/prf.js
 *
 * PRF data (#/prf, DECISIONS PRF-1..PRF-7): a port of PRF_Insight.py so
 * nobody needs YAML or Python to turn a Zeta/PRF log folder into the Excel
 * report. Open to everyone (PRF-5).
 *
 * This step: pick the ROOT folder, scan it and show what was found - lots,
 * build-ups, panels, and per panel+side the file counts (roughness / via /
 * unknown), the way the script's --preview does. The settings form (units,
 * via split, positions, spec limits), Run and the output folder are later
 * steps. Nothing here writes to the data file; all the real work (parsing,
 * labelling, stats) is in js/prf.js (pure) and js/adapters/prf-folder.js
 * (file access).
 */
window.MRT = window.MRT || {};
window.MRT.views = window.MRT.views || {};
window.MRT.views.prf = (function () {
  'use strict';

  var ui = window.MRT.ui;
  var P = window.MRT.prf;
  var adapter = window.MRT.adapters.prfFolder;
  var pcfg = window.MRT.config.prf;

  var state = {
    connected: false,
    rootLabel: null,
    scanning: false,
    progress: null,     // {done, total} while reading files
    result: null,       // {sides: [...], problems: [], lots: {}} once scanned
    scan: null,         // {entries, files: {ref: {counts, files}}, problems} - every file read once
    rootPath: '',       // pasted full path of the picked folder (names only, see applyPath)
    error: null,
    savedRootHint: null, // name of a remembered root folder whose permission lapsed
    settings: null,     // built once from result (defaultSettings) - see below
    advancedOpen: false,
    outputConnected: false, outputLabel: null, savedOutputHint: null,
    running: false, runResult: null   // {out, summary, comparison, status, written} after Run
  };

  /* --- settings, built once from the scan result (PRF-2..PRF-7) --------- */

  var VIA_SPLIT = { EVEN: 'even', FIXED: 'fixed', SEQUENCE: 'sequence' };

  function emptySideSettings(found) {
    return {
      enabled: found.side,
      roughness: { enabled: found.roughness, units: [], positions: 'Next to Via, Next to Via' },
      via: { enabled: found.via, units: [], sameAsVia: true, split: VIA_SPLIT.EVEN,
             perUnit: '', perCoupon: '', sequenceText: '' }
    };
  }

  /** Build the starting settings from what the scan found (one lot run). */
  function defaultSettings(result) {
    var panelSet = {};
    var foundBySide = { Front: { side: false, roughness: false, via: false }, Back: { side: false, roughness: false, via: false } };
    result.sides.forEach(function (row) {
      panelSet[row.panel] = true;
      if (row.side !== 'Front' && row.side !== 'Back') return;
      foundBySide[row.side].side = true;
      if (row.counts.roughness > 0) foundBySide[row.side].roughness = true;
      if (row.counts.via > 0) foundBySide[row.side].via = true;
    });
    var panelsList = Object.keys(panelSet).map(Number).sort(function (a, b) { return a - b; });
    var lots = Object.keys(result.lots);
    var firstLot = lots.length ? result.lots[lots[0]] : { project: '', part: '' };

    return {
      lotName: '', process: 'Post DSM', buFilter: [],   // chosen build-ups, [] = all
      metaAuto: true, metaOverride: { project: firstLot.project || '', part: firstLot.part || '', lot: lots[0] || '', buildup: '' },
      panelsFound: panelsList, panelsOn: panelsList.slice(),
      sides: { Front: emptySideSettings(foundBySide.Front), Back: emptySideSettings(foundBySide.Back) },
      decimals: 3, fileEnding: '.txt', filterOutliers: false, nrSigma: 2, flagFactor: 1.5, specLimits: {}
    };
  }

  /* --- scanning: adapter (files) + prf.js (pure rules) ------------------ */

  function emptyCounts() { return { roughness: 0, via: 0, unknown: 0, total: 0 }; }

  /**
   * Read and classify every file in dir, in chunks, reporting progress.
   * Keeps the lines (not just the count) so Preview and Run never need to
   * read the folder again - one read per file for the whole visit.
   * -> {counts, files: {roughness: [{name, site, lines}], via: [...], unknown: [...]}}
   * each list sorted by site, same order the script reads them in (py 1298).
   */
  function readSideFiles(dir, ending, onProgress) {
    return adapter.listFiles(dir, ending).then(function (files) {
      var counts = emptyCounts();
      var byKind = { roughness: [], via: [], unknown: [] };
      var i = 0;
      function chunk() {
        var end = Math.min(i + pcfg.read_chunk, files.length);
        var reads = [];
        var _loop = function (f) {
          reads.push(adapter.readFile(f.handle).then(function (text) {
            var lines = P.textToLines(text);
            var kind = P.classify(lines);
            counts[kind] += 1;
            counts.total += 1;
            byKind[kind].push({ name: f.name, site: P.siteNumber(f.name), lines: lines });
          }));
        };
        for (; i < end; i++) _loop(files[i]);
        return Promise.all(reads).then(function () {
          if (onProgress) onProgress();
          if (i < files.length) return new Promise(function (r) { setTimeout(r, 0); }).then(chunk);
        });
      }
      return chunk().then(function () {
        Object.keys(byKind).forEach(function (k) { byKind[k].sort(function (a, b) { return a.site - b.site; }); });
        return { counts: counts, files: byKind };
      });
    });
  }

  /* --- the pasted full path of the picked folder ------------------------ */

  // The browser cannot see folders above the one picked (File System Access
  // rule), so Project / Part number / Lot above it are unknown - unless the
  // person pastes the folder's full path from Explorer. Only its folder NAMES
  // are used (the script reads the same names from its full root path); it
  // never gives access to anything. Remembered on this PC (localStorage).
  var PATH_KEY = pcfg.local_prefix + 'root_path';

  function savedPath() { try { return window.localStorage.getItem(PATH_KEY) || ''; } catch (e) { return ''; } }
  function savePath(text) { try { window.localStorage.setItem(PATH_KEY, text); } catch (e) { /* private window: not remembered */ } }

  /** The pasted path's folder names, or null when empty or not ending in the picked folder. */
  function rootPathParts() {
    var parts = P.splitPath(state.rootPath);
    return parts.length && P.pathEndsWith(parts, state.rootLabel) ? parts : null;
  }

  /** After a folder is picked: pre-fill the remembered path when it fits this folder. */
  function prefillPath() {
    var text = savedPath();
    state.rootPath = text && P.pathEndsWith(P.splitPath(text), state.rootLabel) ? text : '';
  }

  /**
   * Scan + files (cached in state.scan) -> state.result. No file is read
   * here, so a changed path re-sorts the names in an instant.
   */
  function buildResult() {
    var scan = state.scan;
    var idx = P.indexLogs(state.rootLabel || 'root', scan.entries, rootPathParts());
    var problems = scan.problems.concat(idx.problems);
    var sides = Object.keys(idx.index).map(function (key) {
      var entry = idx.index[key];
      var row = { lot: entry.lot, bu: entry.bu, buLabel: P.buLabel(entry.bu), panel: entry.panel, side: entry.side,
        refs: entry.refs, counts: emptyCounts(), files: null, tooMany: entry.refs.length > 1 };
      if (row.tooMany) {
        problems.push(entry.refs.length + ' log folders found for Panel ' + entry.panel + ' ' + entry.side +
          (entry.lot ? ' (lot ' + entry.lot : ' (no lot') + (row.buLabel ? ', ' + row.buLabel : '') + '), skipped: ' + entry.refs.join(' | '));
      } else {
        var read = scan.files[entry.refs[0]];
        row.counts = read.counts;
        row.files = read.files;
      }
      return row;
    });
    sides.sort(function (a, b) {
      return String(a.lot || '') < String(b.lot || '') ? -1 : String(a.lot || '') > String(b.lot || '') ? 1
        : (a.bu || 0) - (b.bu || 0) || a.panel - b.panel || (a.side < b.side ? -1 : 1);
    });
    state.result = { sides: sides, problems: problems, lots: idx.lots };
  }

  /** A new path: rebuild the result, keep what was typed, refresh only what came from the path. */
  function applyPath(text) {
    state.rootPath = text;
    var parts = P.splitPath(text);
    if (text.trim() && P.pathEndsWith(parts, state.rootLabel)) savePath(text);
    if (!state.scan) { draw(); return; }
    buildResult();
    var fresh = defaultSettings(state.result), s = state.settings;
    if (s) {
      var keep = s.panelsOn.filter(function (p) { return fresh.panelsFound.indexOf(p) !== -1; });
      s.panelsFound = fresh.panelsFound;
      s.panelsOn = keep.length ? keep : fresh.panelsFound.slice();
      if (s.metaAuto) s.metaOverride = fresh.metaOverride;
    } else {
      state.settings = fresh;
    }
    state.runResult = null;
    draw();
  }

  function runScan() {
    state.scanning = true;
    state.error = null;
    state.progress = { done: 0, total: 0 };
    state.runResult = null;
    draw();

    return adapter.scanRoot(pcfg.log_folder_name).then(function (scan) {
      var ending = (state.settings && state.settings.fileEnding) || '.txt';
      var cache = { entries: scan.entries.map(function (e) { return { rel: e.rel, ref: e.ref }; }), files: {}, problems: scan.problems };
      state.progress.total = scan.entries.length;

      function next(i) {
        if (i >= scan.entries.length) return Promise.resolve();
        var e = scan.entries[i];
        return readSideFiles(e.dir, ending, function () { draw(); }).then(function (out) {
          cache.files[e.ref] = out;
          state.progress.done = i + 1;
          draw();
          return next(i + 1);
        });
      }

      return next(0).then(function () {
        state.scan = cache;
        buildResult();
        state.settings = defaultSettings(state.result);
      });
    }).catch(function (e) {
      state.error = e.message || String(e);
    }).then(function () {
      state.scanning = false;
      state.progress = null;
      draw();
    });
  }

  /* --- folder connect ---------------------------------------------------- */

  function connectRoot() {
    state.error = null;
    return adapter.connectRoot().then(function () {
      state.connected = true;
      state.rootLabel = adapter.rootLabel();
      state.result = null;
      prefillPath();
      draw();
      return runScan();
    }).catch(function (e) {
      if (e && e.name === 'AbortError') return;    // the person cancelled the picker
      state.error = e.message || String(e);
      draw();
    });
  }

  /**
   * A folder was picked before (IndexedDB remembers the handle), but Chrome's
   * PERMISSION on it can lapse between visits - that is Chrome's rule, not
   * something this page controls. Try a silent reconnect first (no prompt at
   * all); if that fails, offer one-click Reconnect (just the permission
   * prompt) instead of making the person navigate the whole folder tree
   * again. "Choose a different folder" always stays next to it.
   */
  function trySilentReconnect() {
    return adapter.hasSavedRoot().then(function (has) {
      if (!has) return;
      return adapter.savedRootLabel().then(function (name) { state.savedRootHint = name; })
        .then(function () { return adapter.reconnectRoot({ silent: true }); })
        .then(function (ok) { if (ok) { state.connected = true; state.rootLabel = adapter.rootLabel(); prefillPath(); } });
    }).catch(function () {});
  }

  function reconnectRoot() {
    state.error = null;
    return adapter.reconnectRoot({ silent: false }).then(function (ok) {
      if (!ok) { state.error = 'Permission was not given. Use "Choose root folder" instead.'; draw(); return; }
      state.connected = true;
      state.rootLabel = adapter.rootLabel();
      state.result = null;
      prefillPath();
      draw();
      return runScan();
    }).catch(function (e) {
      state.error = e.message || String(e);
      draw();
    });
  }

  /* --- rendering ----------------------------------------------------------- */

  var mainEl = null;
  var holder = null;

  function folderPanel() {
    var body = [];
    if (!adapter.isSupported()) {
      body.push(ui.emptyState({ icon: 'alert', title: 'Not available in this browser', text: adapter.unsupportedMessage() }));
    } else {
      body.push(ui.el('p', { class: 'muted', text: 'Pick the project folder - the scan finds every "log" folder underneath ' +
        'and Project, Part number and Lot fill in by themselves. The full path below is only needed ' +
        'when you pick a folder deep inside (then pick from the lot down).' }));
      body.push(ui.el('div', { class: 'prf-folder-row' }, [
        state.connected ? ui.el('span', { class: 'mono' }, state.rootLabel || '(connected)') : null,
        !state.connected && state.savedRootHint ? ui.el('span', { class: 'muted' }, 'Last used: ' + state.savedRootHint) : null,
        !state.connected && state.savedRootHint ? ui.button('Reconnect', { kind: 'primary', icon: 'refresh', onClick: reconnectRoot }) : null,
        ui.button(state.connected ? 'Change root folder' : 'Choose root folder', {
          kind: state.connected ? undefined : (state.savedRootHint ? undefined : 'primary'), icon: 'folder', onClick: connectRoot
        }),
        state.connected ? ui.button('Scan again', { icon: 'refresh', disabled: state.scanning, onClick: runScan }) : null
      ]));
      if (state.connected) body.push(pathField());
    }
    if (state.error) body.push(ui.el('p', { class: 'ifield-msg' }, [ui.icon('alert', 14), ' ' + state.error]));
    return ui.panel({ title: 'Folder', icon: 'folder', body: body }).node;
  }

  /** "Full path of this folder": names above the picked folder, for Project / Part number / Lot. */
  function pathField() {
    var f = ui.field({ label: 'Full path of this folder (optional)', value: state.rootPath, mono: true,
      placeholder: 'L:\\...\\Chiplet4Future\\FHR0020\\19197\\' + (state.rootLabel || 'BU-01'),
      hint: 'The browser cannot see the folders above the one you picked. Paste its path from the Explorer address bar ' +
            'and Project, Part number and Lot are read from it, like the script does. Remembered on this PC.' });
    f.input.addEventListener('change', function () { applyPath(f.input.value); });
    var parts = P.splitPath(state.rootPath);
    if (state.rootPath.trim() && !P.pathEndsWith(parts, state.rootLabel)) {
      f.setState('invalid', 'This path ends in "' + (parts[parts.length - 1] || '') + '", but the picked folder is "' +
        state.rootLabel + '". Not used - paste the path of the folder you picked.');
    } else if (rootPathParts()) {
      f.setState('valid', 'Used for Project, Part number and Lot.');
    }
    return f.node;
  }

  function previewPanel() {
    if (state.scanning) {
      var p = state.progress;
      return ui.panel({ title: 'Findings', icon: 'search', body: [
        ui.el('div', { class: 'prf-scan-progress', 'aria-live': 'polite' },
          p && p.total ? 'Reading files: log folder ' + p.done + ' of ' + p.total + '...' : 'Scanning...'),
        ui.skeleton(4)
      ] }).node;
    }
    if (!state.result) return null;
    var r = state.result;
    var lotsLine = Object.keys(r.lots).map(function (lot) {
      return (lot || 'no lot') + (r.lots[lot].project ? ' · ' + r.lots[lot].project : '') + (r.lots[lot].part ? ' · ' + r.lots[lot].part : '');
    }).join(' | ');
    var showUnknown = r.sides.some(function (s) { return !s.tooMany && s.counts.unknown; });
    var head = ['Project', 'Lot', 'Build-up', 'Panel', 'Side', 'Roughness', 'Via'];
    if (showUnknown) head.push('Unknown');
    var body = [ui.el('p', { class: 'muted', text: (lotsLine || 'No lot in path') + ' — ' + r.sides.length + ' panel+side combination(s) found.' })];
    body.push(ui.el('div', { class: 'table-wrap' }, ui.el('table', { class: 'grid' }, [
      ui.el('thead', {}, ui.el('tr', {}, head.map(function (h) { return ui.el('th', { scope: 'col', text: h }); }))),
      ui.el('tbody', {}, r.sides.map(function (row) {
        var project = (row.lot && r.lots[row.lot] && r.lots[row.lot].project) || '-';
        var cells = [project, row.lot || '-', row.buLabel || '-', String(row.panel), row.side];
        if (row.tooMany) {
          cells.push(ui.el('span', { class: 'chip warning', text: String(row.refs.length) + ' log folders - skipped' }), '-', '-');
          if (showUnknown) cells.push('-');
        } else {
          cells.push(String(row.counts.roughness), String(row.counts.via));
          if (showUnknown) cells.push(String(row.counts.unknown));
        }
        return ui.el('tr', {}, cells.map(function (v) { return typeof v === 'string' ? ui.el('td', { text: v }) : ui.el('td', {}, v); }));
      }))
    ])));
    if (!r.sides.length) {
      body.push(ui.emptyState({ icon: 'search', title: 'No log folders found',
        text: 'No folder named "' + pcfg.log_folder_name + '" was found under the root folder.' }));
    }
    if (r.problems.length) body.push(ui.el('div', { class: 'prf-problems' }, [
      ui.el('h3', { text: 'Problems' }),
      ui.el('ul', {}, r.problems.map(function (msg) { return ui.el('li', {}, [ui.icon('alert', 14), ' ' + msg]); }))
    ]));
    return ui.el('div', { class: 'prf-findings' }, body);
  }

  /* --- settings panel: metadata, panels, sides, units, via split -------- */

  function metaPanel() {
    var s = state.settings;
    var lots = Object.keys(state.result.lots);
    var body = [];
    if (s.metaAuto) {
      var busFound = unique(state.result.sides.map(function (row) { return row.buLabel; }).filter(Boolean));
      body.push(ui.el('dl', { class: 'prf-meta' }, [
        ui.el('dt', { text: 'Project' }), ui.el('dd', { text: s.metaOverride.project || '-' }),
        ui.el('dt', { text: 'Part number' }), ui.el('dd', { text: s.metaOverride.part || '-' }),
        ui.el('dt', { text: 'Lot' }), ui.el('dd', { text: lots.join(', ') || '(none in path - paste the full path under Step 1)' }),
        ui.el('dt', { text: 'Build-up' }), ui.el('dd', { text: busFound.join(', ') || '-' })
      ]));
      body.push(ui.el('p', {}, ui.el('a', { href: '#', class: 'link', text: 'Edit',
        onclick: function (e) { e.preventDefault(); s.metaAuto = false; draw(); } })));
    } else {
      ['project', 'part', 'lot', 'buildup'].forEach(function (k) {
        var f = ui.field({ label: k.charAt(0).toUpperCase() + k.slice(1), value: s.metaOverride[k] });
        f.input.addEventListener('input', function () { s.metaOverride[k] = f.input.value; });
        body.push(f.node);
      });
      body.push(ui.el('p', { class: 'ifield-msg' }, 'A typed lot number means only that lot is processed (as in the script).'));
      body.push(ui.el('p', {}, ui.el('a', { href: '#', class: 'link', text: 'Back to automatic',
        onclick: function (e) { e.preventDefault(); s.metaAuto = true; draw(); } })));
    }
    var lotName = ui.field({ label: 'Lot name (optional)', value: s.lotName, hint: 'Typed, not read from the folder. Goes into the Lot name column; may stay empty.' });
    lotName.input.addEventListener('input', function () { s.lotName = lotName.input.value; });
    body.push(lotName.node);
    body.push(ui.el('p', { class: 'ifield-msg', text: 'Process: ' + s.process + ' (change under Advanced)' }));
    return ui.el('div', {}, body);
  }

  /** A choice button (panels, build-ups): pressed = chosen. */
  function pickBtn(label, on, onClick, title) {
    var b = ui.button(label, { size: 'sm', cls: 'prf-pick' + (on ? ' is-picked' : ''), onClick: onClick, title: title || null });
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    return b;
  }

  function panelsIn(bus) {
    return state.settings.panelsFound.filter(function (p) {
      return !bus.length || state.result.sides.some(function (r) { return r.panel === p && bus.indexOf(r.bu) !== -1; });
    });
  }

  function panelsBox() {
    var s = state.settings;
    if (!s.buFilter) s.buFilter = [];
    var bus = unique(state.result.sides.map(function (r) { return r.bu; })
      .filter(function (b) { return b !== null && b !== undefined; })).sort(function (a, b) { return a - b; });
    function tick(p) {
      var i = s.panelsOn.indexOf(p);
      if (i === -1) s.panelsOn.push(p); else s.panelsOn.splice(i, 1);
      s.panelsOn.sort(function (a, b) { return a - b; });
      refreshRun();
    }
    var shown = panelsIn(s.buFilter);
    var body = [];
    if (bus.length > 1) {
      body.push(ui.el('div', { class: 'prf-panel-actions' }, [{ value: null, label: 'All' }]
        .concat(bus.map(function (b) { return { value: b, label: P.buLabel(b) }; }))
        .map(function (o) {
          var on = o.value === null ? !s.buFilter.length : s.buFilter.indexOf(o.value) !== -1;
          return pickBtn(o.label, on, function () {
            if (o.value === null) s.buFilter = [];
            else if (s.buFilter.indexOf(o.value) === -1) s.buFilter = s.buFilter.concat([o.value]);
            else s.buFilter = s.buFilter.filter(function (b) { return b !== o.value; });
            draw();
          }, o.value === null ? 'Every build-up' : 'Toggle this build-up');
        })));
    }
    body.push(ui.el('div', { class: 'prf-panel-actions' }, [
      ui.button('All', { size: 'sm', onClick: function () { s.panelsOn = shown.slice(); refreshRun(); } }),
      ui.button('None', { size: 'sm', onClick: function () { s.panelsOn = []; refreshRun(); } })
    ]));
    body.push(ui.el('div', { class: 'prf-panel-grid' }, shown.map(function (p) {
      return pickBtn('Panel ' + p, s.panelsOn.indexOf(p) !== -1, function () { tick(p); });
    })));
    if (!shown.length) body.push(ui.el('p', { class: 'muted', text: 'No panels in this build-up.' }));
    return ui.el('div', {}, body);
  }

  function settingsPanel() {
    if (!state.result || !state.settings) return null;
    return ui.el('div', { class: 'prf-settings' }, [
      ui.el('div', { class: 'prf-sides2' }, [
        ui.panel({ title: 'Metadata', icon: 'tag', body: [metaPanel()] }).node,
        ui.panel({ title: 'Build-up & panels', icon: 'grid', body: [panelsBox()] }).node
      ]),
      sidesPanel()
    ]);
  }

  /** Plain units: comma or space separated, coupons allowed (C1); order is measurement order. */
  function unitsField(side, kind, label) {
    var cfg = state.settings.sides[side][kind];
    var f = ui.field({ label: label, value: (cfg.units || []).join(', '), mono: true,
      placeholder: 'e.g. 5, 4, 2, 3, 6 or 5 4 2 3 6',
      hint: 'Unit numbers in measurement order, separated by commas or spaces.' });
    f.input.addEventListener('input', function () {
      var parsed = P.parseUnits(f.input.value);
      if (parsed.bad.length) f.setState('invalid', 'Not a unit: ' + parsed.bad.join(', '));
      else f.setState(f.input.value.trim() ? 'valid' : null, null);
      cfg.units = parsed.units;
    });
    return f.node;
  }

  function roughnessSubsection(side, shared) {
    var s = state.settings.sides[side];
    var r = s.roughness;
    if (!r.enabled) return null;   // no roughness files on this side: nothing to set up
    var inner = [];
    if (!shared) inner.push(unitsField(side, 'roughness', 'Roughness units (measurement order)'));
    var pos = ui.field({ label: 'Position names (in order, comma separated)', value: r.positions,
      hint: 'One name per roughness site in a unit, e.g. "Next to Via, Next to Via".' });
    pos.input.addEventListener('input', function () { r.positions = pos.input.value; });
    inner.push(pos.node);
    return ui.el('div', { class: 'prf-subsection' }, [ui.el('h3', { class: 'prf-advanced-sub', text: shared ? 'Roughness (same units as via)' : 'Roughness' }),
      ui.el('div', { class: 'prf-subsection-body' }, inner)]);
  }

  function viaSubsection(side) {
    var s = state.settings.sides[side];
    var v = s.via;
    if (!v.enabled) return null;   // no via files on this side: nothing to set up
    var r = s.roughness;
    var inner = [unitsField(side, 'via', 'Via units (measurement order)')];
    if (r.enabled) {
      var seg = ui.segmented({ label: 'Same for roughness?', value: v.sameAsVia ? 'yes' : 'no', options: [
        { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No, own units' }
      ], onChange: function (val) { v.sameAsVia = val === 'yes'; draw(); } });
      inner.push(seg.node);
    }
    {
      var split = ui.segmented({ label: 'How are vias split', value: v.split, options: [
        { value: VIA_SPLIT.EVEN, label: 'Evenly' }, { value: VIA_SPLIT.FIXED, label: 'Fixed per unit' },
        { value: VIA_SPLIT.SEQUENCE, label: 'Custom sequence' }
      ], onChange: function (val) { v.split = val; draw(); } });
      inner.push(split.node);
      if (v.split === VIA_SPLIT.FIXED) {
        var pu = ui.field({ label: 'Vias per unit', type: 'number', value: v.perUnit });
        pu.input.addEventListener('input', function () { v.perUnit = pu.input.value; });
        var pc = ui.field({ label: 'Vias per coupon (blank = same as per unit)', type: 'number', value: v.perCoupon });
        pc.input.addEventListener('input', function () { v.perCoupon = pc.input.value; });
        inner.push(ui.el('div', { class: 'prf-field-row' }, [pu.node, pc.node]));
      } else if (v.split === VIA_SPLIT.SEQUENCE) {
        var seqField = ui.field({ label: 'Sequence (label x count, in order)', value: v.sequenceText,
          placeholder: '3x3, 2x4, C1x5', hint: 'A label starting with a letter (C1) is a coupon.' });
        seqField.input.addEventListener('input', function () {
          v.sequenceText = seqField.input.value;
          var parsed = P.parseSequence(v.sequenceText);
          seqField.setState(parsed.error ? 'invalid' : (v.sequenceText.trim() ? 'valid' : null), parsed.error || null);
        });
        inner.push(seqField.node);
      }
    }
    return ui.el('div', { class: 'prf-subsection' }, [ui.el('h3', { class: 'prf-advanced-sub', text: 'Via' }),
      ui.el('div', { class: 'prf-subsection-body' }, inner)]);
  }

  function sidePanel(side) {
    // no switches: the scan found this side's files, so it is set up; sides without data are not shown at all.
    // Via first: the engineer types the via units, then says whether roughness shares them.
    var cfg = state.settings.sides[side];
    var shared = cfg.via.enabled && cfg.roughness.enabled && cfg.via.sameAsVia;
    return ui.el('div', { class: 'prf-side' }, [viaSubsection(side), roughnessSubsection(side, shared)].filter(Boolean));
  }

  function sidesPanel() {
    var sides = ['Front', 'Back'].filter(function (side) { return state.settings.sides[side].enabled; });
    if (!sides.length) return ui.el('p', { class: 'muted', text: 'No measurement files found - nothing to set up.' });
    return ui.el('div', { class: 'prf-sides2' }, sides.map(function (side) {
      return ui.panel({ title: side, icon: 'sliders', body: [sidePanel(side)] }).node;
    }));
  }

  function advancedPanel() {
    var s = state.settings;
    var filterToggle = ui.toggle({ label: 'Remove outlier lines before Mean/Std/Min/Max', checked: s.filterOutliers,
      onChange: function (on) { s.filterOutliers = on; } });
    var sigma = ui.field({ label: 'nr_sigma (z-score cut-off)', type: 'number', value: s.nrSigma });
    sigma.input.addEventListener('input', function () { s.nrSigma = sigma.input.value; });
    var flag = ui.field({ label: 'flag_factor (Rz vs median Rz)', type: 'number', value: s.flagFactor });
    flag.input.addEventListener('input', function () { s.flagFactor = flag.input.value; });
    var decimals = ui.field({ label: 'Decimals shown', type: 'number', value: s.decimals, min: 0, max: 6 });
    decimals.input.addEventListener('input', function () { s.decimals = decimals.input.value; });
    var ending = ui.segmented({ label: 'File ending', value: s.fileEnding,
      options: [{ value: '.txt', label: '.txt' }, { value: '.csv', label: '.csv' }],
      onChange: function (v) { s.fileEnding = v; } });
    var process = ui.field({ label: 'Process', value: s.process });
    process.input.addEventListener('input', function () { s.process = process.input.value; });

    var specRows = P.SPEC_KEYS.map(function (key) {
      var lim = s.specLimits[key] || [null, null];
      var lo = ui.field({ label: 'min', type: 'number', value: lim[0], mono: true });
      var hi = ui.field({ label: 'max', type: 'number', value: lim[1], mono: true });
      function commit() {
        var a = lo.input.value === '' ? null : Number(lo.input.value);
        var b = hi.input.value === '' ? null : Number(hi.input.value);
        if (a === null && b === null) delete s.specLimits[key]; else s.specLimits[key] = [a, b];
      }
      lo.input.addEventListener('input', commit);
      hi.input.addEventListener('input', commit);
      return ui.el('div', { class: 'prf-spec-row' }, [ui.el('span', { class: 'prf-spec-label', text: key }), lo.node, hi.node]);
    });

    return ui.panel({ title: 'Advanced', icon: 'sliders', collapsible: true, collapsed: !state.advancedOpen,
      onToggle: function (collapsed) { state.advancedOpen = !collapsed; },
      body: [process.node, filterToggle.node, sigma.node, flag.node, decimals.node, ending.node,
             ui.el('h3', { class: 'prf-advanced-sub', text: 'Spec limits (blank = no limit)' }),
             ui.el('div', { class: 'prf-spec-grid' }, specRows)] }).node;
  }

  /* =====================================================================
   * Running: resolve one side's settings into js/prf.js inputs, process it
   * with the real (already-read) files, and aggregate every ticked
   * panel+side. The SAME function builds the Preview (just shown as the
   * plan, no numbers) and the Run (the full tables + the Excel) - so
   * Preview can never show something Run would not actually produce.
   * ===================================================================== */

  /** Comma/space separated position names, in order, blanks dropped. */
  function parsePositions(text) {
    return String(text || '').split(/[,;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /** Form state for one side -> the arguments js/prf.js's functions take. */
  function resolveSideConfig(sideSettings) {
    var r = sideSettings.roughness, v = sideSettings.via;
    // the engineer types the via units first; roughness either shares them or has its own
    var viaUnits = v.enabled ? v.units.slice() : [];
    var roughnessUnits = r.enabled ? (v.enabled && v.sameAsVia ? viaUnits.slice() : r.units.slice()) : [];
    var positions = r.enabled ? parsePositions(r.positions) : [];
    if (r.enabled && !roughnessUnits.length) roughnessUnits = viaUnits.slice();   // py: each side falls back to the other
    var sequence = null, counts = null, seqError = null;
    if (v.enabled && v.split === VIA_SPLIT.SEQUENCE && v.sequenceText.trim()) {
      var parsed = P.parseSequence(v.sequenceText);
      if (parsed.error) seqError = parsed.error; else sequence = parsed.items;
    } else if (v.enabled && v.split === VIA_SPLIT.FIXED && Number(v.perUnit)) {
      counts = P.countsFromDefaults(viaUnits, Number(v.perUnit), Number(v.perCoupon) || 0);
    }
    return { roughnessUnits: roughnessUnits, positions: positions, viaUnits: viaUnits, sequence: sequence, counts: counts, seqError: seqError };
  }

  /** One panel+side's meta row fields (py meta dict, process_panel). */
  function sideMeta(panel, row) {
    var s = state.settings;
    var lot = s.metaAuto ? (row ? row.lot : null) : (s.metaOverride.lot || (row ? row.lot : null));
    var fromLot = (row && row.lot && state.result.lots[row.lot]) || { project: '', part: '' };
    return {
      Project_Name: s.metaAuto ? fromLot.project : s.metaOverride.project,
      Part_Number: s.metaAuto ? fromLot.part : s.metaOverride.part,
      Lot_Number: lot || '', Lot_Name: s.lotName, Process: s.process,
      Buildup: s.metaAuto ? (row ? row.buLabel : '') : (s.metaOverride.buildup || (row ? row.buLabel : '')),
      Panel: panel
    };
  }

  /**
   * Process every ticked panel, enabled side. Always computes the full
   * result (cheap - the files are already in memory); Preview only shows
   * the assignment columns of it, Run shows everything and writes the file.
   * -> {t2b, t2bRaw, rough, roughRaw, unknown, log, flagged}
   */
  function runAll() {
    var s = state.settings;
    var byPanelSide = {};
    state.result.sides.forEach(function (row) { byPanelSide[row.panel + '|' + row.side] = row; });
    var t2b = [], t2bRaw = [], rough = [], roughRaw = [], unknown = [], log = [];
    var lotFilter = (!s.metaAuto && s.metaOverride.lot) ? s.metaOverride.lot : null;

    function addLog(panel, side, level, text, lot, bu) {
      log.push({ Level: level, Lot: lot || '', Buildup: bu || '', Panel: panel, Side: side, Message: text });
    }

    s.panelsOn.forEach(function (panel) {
      ['Front', 'Back'].forEach(function (side) {
        var sideSettings = s.sides[side];
        if (!sideSettings.enabled) return;
        var row = byPanelSide[panel + '|' + side];
        if (!row) { addLog(panel, side, 'WARNING', 'No log folder found. Side skipped.'); return; }
        if (lotFilter && row.lot !== lotFilter) return;
        if (s.buFilter && s.buFilter.length && row.bu !== null && row.bu !== undefined && s.buFilter.indexOf(row.bu) === -1) return;
        if (row.tooMany) return;    // already a problem from the scan; side skipped

        var meta = sideMeta(panel, row);
        var cfg = resolveSideConfig(sideSettings);
        if (cfg.seqError) addLog(panel, side, 'WARNING', cfg.seqError + ' Sequence ignored.', meta.Lot_Number, meta.Buildup);

        var r = sideSettings.roughness.enabled
          ? P.processRoughness(row.files.roughness, cfg.roughnessUnits, cfg.positions,
              { flagFactor: Number(s.flagFactor), filterOutliers: !!s.filterOutliers, nrSigma: Number(s.nrSigma) }, meta, side)
          : { rows: [], raw: [], messages: [] };
        var v = sideSettings.via.enabled
          ? P.processVia(row.files.via, cfg.viaUnits, meta, side, cfg.sequence, cfg.counts)
          : { rows: [], raw: [], messages: [] };

        var typed = row.files.roughness.map(function (f) { return [f.site, 'R']; })
          .concat(row.files.via.map(function (f) { return [f.site, 'V']; }))
          .concat(row.files.unknown.map(function (f) { return [f.site, '?']; }))
          .sort(function (a, b) { return a[0] - b[0]; });
        P.checkSites(typed, cfg.roughnessUnits, cfg.viaUnits, cfg.positions.length, cfg.sequence)
          .forEach(function (m) { addLog(panel, side, m.level, m.text, meta.Lot_Number, meta.Buildup); });

        row.files.unknown.forEach(function (f) {
          unknown.push({ Lot_Number: meta.Lot_Number, Buildup: meta.Buildup, Panel: panel, Side: side, File: f.name });
          addLog(panel, side, 'WARNING', 'Unknown file type: ' + f.name, meta.Lot_Number, meta.Buildup);
        });

        rough = rough.concat(r.rows); roughRaw = roughRaw.concat(r.raw);
        t2b = t2b.concat(v.rows); t2bRaw = t2bRaw.concat(v.raw);
        r.messages.concat(v.messages).forEach(function (m) { addLog(panel, side, m.level, m.text, meta.Lot_Number, meta.Buildup); });
      });
    });

    var flagged = rough.concat(t2b).some(function (r) { return r.Flag; });
    return { t2b: t2b, t2bRaw: t2bRaw, rough: rough, roughRaw: roughRaw, unknown: unknown, log: log, flagged: flagged };
  }

  /* --- Excel / CSV write (SheetJS when available, CSV otherwise) -------- */

  var SHEET_COLS = {
    Summary: ['Lot_Number', 'Buildup', 'Panel', 'Side', 'Measurement', 'Parameter', 'N', 'Mean', 'Std', 'Min', 'Max', 'LSL', 'USL', 'Result'],
    Comparison: ['Lot_Number', 'Buildup', 'Panel', 'Measurement', 'Parameter', 'Front Mean', 'Back Mean', 'Difference (Back - Front)', 'Difference (%)'],
    T2B: ['Project_Name', 'Part_Number', 'Lot_Number', 'Lot_Name', 'Buildup', 'Process', 'Panel', 'Side', 'Type', 'Unit', 'Via', 'Site',
          'Average_Via_Depth_um', 'Bottom_Diameter_um', 'Top_Diameter_um', 'Bottom_Roundness_pct', 'Top_Roundness_pct', 'Aspect_Ratio',
          'Bottom_Top_Ratio_pct', 'Taper_um', 'Taper_Angle_deg', 'Wall_Angle_deg', 'Flag'],
    Roughness: ['Project_Name', 'Part_Number', 'Lot_Number', 'Lot_Name', 'Buildup', 'Process', 'Panel', 'Side', 'Type', 'Unit',
                'Measurement_Position', 'Site', 'Ra_Mean_nm', 'Ra_Std_nm', 'Ra_Min_nm', 'Ra_Max_nm', 'Rz_Mean_nm', 'Rz_Std_nm', 'Rz_Min_nm',
                'Rz_Max_nm', 'Lines_Used', 'Lines_Flagged', 'Flag'],
    T2B_raw: ['Lot_Number', 'Buildup', 'Panel', 'Side', 'Type', 'Unit', 'Via', 'Site', 'File', 'Circle_Type', 'CenterX', 'CenterY',
              'Long_Axis_um', 'Short_Axis_um', 'Diameter_um', 'Roundness_pct', 'AvgHeight_um', 'MinHeight_um', 'MaxHeight_um', 'Flag'],
    Roughness_raw: ['Lot_Number', 'Buildup', 'Panel', 'Side', 'Unit', 'Measurement_Position', 'Site', 'File', 'Line', 'Ra_nm', 'Rq_nm',
                    'Rz_nm', 'Rpv_nm', 'Rku', 'Used', 'Flag'],
    Unknown_files: ['Lot_Number', 'Buildup', 'Panel', 'Side', 'File'],
    Log: ['Level', 'Lot', 'Buildup', 'Panel', 'Side', 'Message']
  };

  /** rows (array of objects) + a fixed column order -> [[header...], [cells...]], decimals applied. */
  function sheetRows(rows, cols, decimals) {
    var header = cols.map(function (c) { return P.pretty(c); });
    var body = rows.map(function (r) {
      return cols.map(function (c) {
        var v = r[c];
        if (v === undefined || v === null) return '';
        if (typeof v === 'number') return isFinite(v) ? P.round(v, decimals) : '';
        if (typeof v === 'boolean') return v ? 'Yes' : 'No';
        return v;
      });
    });
    return [header].concat(body);
  }

  function buildSheets(out, summary, comparison, decimals) {
    return [
      { name: 'Summary', rows: sheetRows(summary, SHEET_COLS.Summary, decimals) },
      { name: 'Comparison', rows: sheetRows(comparison, SHEET_COLS.Comparison, decimals) },
      { name: 'T2B', rows: sheetRows(out.t2b, SHEET_COLS.T2B, decimals) },
      { name: 'Roughness', rows: sheetRows(out.rough, SHEET_COLS.Roughness, decimals) },
      { name: 'T2B_raw', rows: sheetRows(out.t2bRaw, SHEET_COLS.T2B_raw, decimals) },
      { name: 'Roughness_raw', rows: sheetRows(out.roughRaw, SHEET_COLS.Roughness_raw, decimals) },
      { name: 'Unknown_files', rows: sheetRows(out.unknown, SHEET_COLS.Unknown_files, decimals) },
      { name: 'Log', rows: sheetRows(out.log, SHEET_COLS.Log, decimals) }
    ];
  }

  var exporter = window.MRT.exporter;

  function writeReport(baseName, sheets) {
    if (exporter.hasXlsx()) {
      var X = window.XLSX, wb = X.utils.book_new(), used = {};
      sheets.forEach(function (s) {
        if (s.rows.length < 2) return;    // header only = nothing to show
        var nm = String(s.name).slice(0, 31);
        while (used[nm]) nm = nm.slice(0, 28) + ' ' + (Object.keys(used).length + 1);
        used[nm] = true;
        X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(s.rows), nm);
      });
      var buf = X.write(wb, { bookType: 'xlsx', type: 'array' });
      return adapter.writeOutput(baseName + '.xlsx', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
        .then(function () { return { format: 'xlsx', name: baseName + '.xlsx' }; });
    }
    var withRows = sheets.filter(function (s) { return s.rows.length > 1; });
    return withRows.reduce(function (p, s) {
      return p.then(function () { return adapter.writeOutput(baseName + '_' + s.name + '.csv', exporter.csvOf(s.rows)); });
    }, Promise.resolve()).then(function () { return { format: 'csv (no vendor/xlsx.full.min.js found)', name: baseName + '_*.csv' }; });
  }

  /** baseName.xlsx (or _Summary.csv) already there? baseName_2, _3, ... (py output_path's while loop). */
  function freeBaseName(baseName, probeExt) {
    function tryName(name, n) {
      var candidate = n === 1 ? name : name + '_' + n;
      return adapter.outputExists(candidate + probeExt).then(function (exists) {
        return exists ? tryName(name, n + 1) : candidate;
      });
    }
    return tryName(baseName, 1);
  }

  /* --- output folder (step 2) -------------------------------------------- */

  function connectOutput() {
    state.error = null;
    return adapter.connectOutput().then(function () { state.outputConnected = true; state.outputLabel = adapter.outputLabel(); draw(); })
      .catch(function (e) { if (!(e && e.name === 'AbortError')) { state.error = e.message || String(e); draw(); } });
  }

  function reconnectOutput() {
    state.error = null;
    return adapter.reconnectOutput({ silent: false }).then(function (ok) {
      if (!ok) { state.error = 'Permission was not given. Use "Choose output folder" instead.'; draw(); return; }
      state.outputConnected = true; state.outputLabel = adapter.outputLabel(); draw();
    }).catch(function (e) { state.error = e.message || String(e); draw(); });
  }

  /* --- Preview and Run ---------------------------------------------------- */

  function runReport() {
    state.running = true;
    state.error = null;
    draw();
    var out = runAll();
    var s = state.settings;
    var limitsOut = P.getLimits(s.specLimits);
    var summary = P.buildSummary(out.t2b, out.rough, limitsOut.limits);
    var comparison = P.buildComparison(summary);
    var errors = out.log.some(function (m) { return m.Level === 'ERROR'; });
    var specFail = summary.some(function (r) { return r.Result === 'FAIL'; });
    var siteWarn = out.log.some(function (m) { return m.Level === 'WARNING' && /Missing sites|Duplicate site|pattern differs|not consecutive/.test(m.Message); });
    var status = P.runStatus({ errors: errors, flagged: out.flagged, specFail: specFail, siteWarn: siteWarn });

    var bus = unique(out.t2b.concat(out.rough).map(function (r) { return r.Buildup; }).filter(Boolean));
    var lots = unique(out.t2b.concat(out.rough).map(function (r) { return r.Lot_Number; }).filter(Boolean));
    var parts = unique(out.t2b.concat(out.rough).map(function (r) { return r.Part_Number; }).filter(Boolean));
    var panels = unique(out.t2b.concat(out.rough).map(function (r) { return r.Panel; }));
    var dateYmd = window.MRT.domain.viennaYmd(Date.now());
    var baseName = P.buildOutputName({ parts: parts, lots: lots, bus: bus, process: s.process, panels: panels,
      flagged: out.flagged || specFail || errors || siteWarn, dateYmd: dateYmd });
    var sheets = buildSheets(out, summary, comparison, Number(s.decimals) || 3);
    var probeExt = exporter.hasXlsx() ? '.xlsx' : '_Summary.csv';

    return freeBaseName(baseName, probeExt).then(function (name) { return writeReport(name, sheets); }).then(function (written) {
      state.running = false;
      state.runResult = { out: out, summary: summary, comparison: comparison, status: status, written: written };
      draw();
      ui.toast({ kind: 'success', message: 'Saved ' + written.name + '.' });
    }).catch(function (e) {
      state.running = false;
      state.error = e.message || String(e);
      draw();
    });
  }

  function unique(list) { return list.filter(function (x, i) { return list.indexOf(x) === i; }); }

  /* --- panels: output folder, Preview plan, Run, results ----------------- */

  /** Output folder picker + Run on one line; warnings sit in the Run label itself. */
  function outputBits() {
    return [
      state.outputConnected ? ui.el('span', { class: 'mono' }, state.outputLabel || '(connected)') : null,
      !state.outputConnected && state.savedOutputHint ? ui.el('span', { class: 'muted' }, 'Last used: ' + state.savedOutputHint) : null,
      !state.outputConnected && state.savedOutputHint ? ui.button('Reconnect', { kind: 'primary', icon: 'refresh', onClick: reconnectOutput }) : null,
      ui.button(state.outputConnected ? 'Change output folder' : 'Choose output folder', {
        kind: state.outputConnected ? undefined : (state.savedOutputHint ? undefined : 'primary'), icon: 'folder', onClick: connectOutput
      })
    ];
  }

  /**
   * One trend point per site for the charts: Ra from roughness rows, ABF
   * height (average via depth) plus via top/bottom diameters from T2B rows.
   * Pure - the view groups these into chart datasets.
   */
  function trendSeries(out) {
    function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
    var pts = [];
    (out.rough || []).forEach(function (r) {
      pts.push({ label: 'P' + r.Panel + ' ' + r.Side, site: r.Site, ra: num(r.Ra_Mean_nm), abf: null, top: null, bottom: null });
    });
    (out.t2b || []).forEach(function (r) {
      pts.push({ label: 'P' + r.Panel + ' ' + r.Side, site: r.Site, ra: null,
        abf: num(r.Average_Via_Depth_um), top: num(r.Top_Diameter_um), bottom: num(r.Bottom_Diameter_um) });
    });
    pts.sort(function (a, b) { return a.site - b.site || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0); });
    return pts;
  }

  function planRows(out) {
    var rows = [];
    out.t2b.forEach(function (r) { rows.push({ panel: r.Panel, side: r.Side, kind: 'Via', site: r.Site, unit: (r.Type === 'Coupon' ? 'Coupon ' : 'Unit ') + r.Unit, detail: 'Via ' + r.Via }); });
    out.rough.forEach(function (r) { rows.push({ panel: r.Panel, side: r.Side, kind: 'Roughness', site: r.Site, unit: (r.Type === 'Coupon' ? 'Coupon ' : 'Unit ') + r.Unit, detail: r.Measurement_Position }); });
    rows.sort(function (a, b) { return a.panel - b.panel || (a.side < b.side ? -1 : a.side > b.side ? 1 : a.site - b.site); });
    return rows;
  }

  var planHost = null;   // the live Plan slot, refreshed with the Run slot on every change

  /** The plan, computed live from the current ticks and settings - what Run would do. */
  function previewPlanPanel() {
    if (!state.result || !state.settings || state.scanning) { planHost = null; return null; }
    planHost = ui.el('div', {}, planPanelBody());
    return planHost;
  }

  function planPanelBody() {
    var out = null;
    try { out = runAll(); } catch (e) { out = null; }
    if (!out) return ui.panel({ title: 'Plan', icon: 'search', body: [
      ui.emptyState({ icon: 'search', title: 'Nothing would be assigned', text: 'Check the ticked panels, sides and units above.' })
    ] }).node;
    var rows = planRows(out);
    var panels = unique(out.t2b.concat(out.rough).map(function (r) { return r.Panel; }));
    var body = [ui.el('p', { class: 'muted', text: rows.length
      ? out.t2b.length + ' via + ' + out.rough.length + ' roughness rows across ' + panels.length + ' panel(s)' +
        (out.log.length ? ', ' + out.log.length + ' message(s)' : '') + '.'
      : 'Nothing would be assigned - check the ticked panels, sides and units above.' })];
    if (rows.length) {
      body.push(ui.panel({ title: 'Details (' + rows.length + ' rows)', icon: 'search', collapsible: true, collapsed: true, body: [
        ui.el('div', { class: 'table-wrap' }, ui.el('table', { class: 'grid' }, [
          ui.el('thead', {}, ui.el('tr', {}, ['Panel', 'Side', 'Site', 'Kind', 'Unit', 'Detail'].map(function (h) { return ui.el('th', { scope: 'col', text: h }); }))),
          ui.el('tbody', {}, rows.map(function (r) {
            return ui.el('tr', {}, [r.panel, r.side, r.site, r.kind, r.unit, r.detail].map(function (v) { return ui.el('td', {}, String(v)); }));
          }))
        ]))
      ] }).node);
    }
    if (out.log.length) body.push(logList(out.log, 'Messages'));
    return ui.panel({ title: 'Plan', icon: 'search', body: body }).node;
  }

  function logList(log, title) {
    return ui.el('div', { class: 'prf-problems' }, [
      ui.el('h3', { text: title || 'Log' }),
      ui.el('ul', {}, log.map(function (m) {
        return ui.el('li', { class: m.Level === 'ERROR' ? 'is-error' : null }, [ui.icon(m.Level === 'ERROR' ? 'alert' : 'info', 14),
          ' ' + (m.Panel !== '' && m.Panel !== undefined ? 'Panel ' + m.Panel + (m.Side ? ' ' + m.Side : '') + ': ' : '') + m.Message]);
      }))
    ]);
  }

  /** What still stops Run, in plain words ([] = ready). Lot name is optional (Prince, 2026-10-01). Sides follow the scan, not switches. */
  function runBlockers() {
    var s = state.settings, reasons = [];
    if (!s) return ['scan a folder first'];
    if (!s.panelsOn.length) reasons.push('pick at least one panel');
    if (!state.outputConnected) reasons.push('pick an output folder');
    return reasons;
  }

  function canRun() { return !runBlockers().length; }

  var runHost = null;   // the Run panel's slot, refreshed alone on every change (refreshRun)

  /** Trend charts over the run's rows: Ra, ABF height (average via depth), via top/bottom. One series per panel+side. */
  function trendCharts(out) {
    var pts = trendSeries(out).filter(function (p) { return p.ra !== null || p.abf !== null || p.top !== null || p.bottom !== null; });
    if (!pts.length) return null;
    var sites = unique(pts.map(function (p) { return p.site; })).sort(function (a, b) { return a - b; });
    var series = unique(pts.map(function (p) { return p.label; }));
    function chartFor(field, title, unit) {
      var c = ui.chart(function (t) {
        return { type: 'line', data: { labels: sites.map(String), datasets: series.map(function (s, i) {
          var col = t.series(i);
          var bySite = {};
          pts.forEach(function (p) { if (p.label === s && p[field] !== null) bySite[p.site] = p[field]; });
          return { label: s, data: sites.map(function (site) { return bySite[site] === undefined ? null : bySite[site]; }),
            borderColor: t.color(col), backgroundColor: t.alpha(col, .15), fill: false, spanGaps: true };
        }) }, options: { plugins: { legend: { display: series.length > 1 } },
          scales: { x: { title: { display: true, text: 'Site' } }, y: { title: { display: true, text: unit } } } } };
      }, { height: 220, label: title, expand: true });
      return ui.el('div', {}, [ui.el('h3', { class: 'prf-advanced-sub', text: title }), c.node]);
    }
    // a run with only via files (the usual Zeta run) shows no Ra chart, and vice versa
    function hasPoints(field) { return pts.some(function (p) { return p[field] !== null; }); }
    var charts = [];
    if (hasPoints('ra')) charts.push(chartFor('ra', 'Roughness Ra by site', 'nm'));
    if (hasPoints('abf')) charts.push(chartFor('abf', 'ABF height (average via depth) by site', 'µm'));
    if (hasPoints('top')) charts.push(chartFor('top', 'Via top diameter by site', 'µm'));
    if (hasPoints('bottom')) charts.push(chartFor('bottom', 'Via bottom diameter by site', 'µm'));
    return ui.el('div', {}, charts);
  }

  function runPanelBody() {
    if (state.runResult && !state.running) {
      var r = state.runResult;
      return ui.panel({ title: 'Output & run', icon: 'save', body: [
        ui.el('div', { class: 'prf-folder-row' }, outputBits().concat([
          ui.button('Run again', { kind: 'primary', icon: 'save', onClick: runReport })
        ])),
        ui.el('p', {}, [ui.el('span', { class: 'chip ' + (r.status === 'OK' ? 'ok' : 'warning'), text: r.status }),
          ' Saved as ' + r.written.name + ' (' + r.written.format + ').']),
        trendCharts(r.out),
        statTable(r.summary, SHEET_COLS.Summary, 'Summary'),
        statTable(r.comparison, SHEET_COLS.Comparison, 'Front vs Back'),
        statTable(r.out.t2b, SHEET_COLS.T2B, 'T2B'),
        statTable(r.out.rough, SHEET_COLS.Roughness, 'Roughness'),
        r.out.log.length ? logList(r.out.log, 'Log') : null
      ].filter(Boolean) }).node;
    }
    var reasons = runBlockers();
    return ui.panel({ title: 'Output & run', icon: 'save', body: [
      ui.el('div', { class: 'prf-folder-row' }, outputBits().concat([
        ui.button(reasons.length ? 'Run — ' + reasons.join(', ') : 'Run', { kind: 'primary', icon: 'save',
          disabled: !!reasons.length || state.running, onClick: runReport })
      ])),
      state.running ? ui.el('p', { class: 'muted' }, 'Working...') : null
    ] }).node;
  }

  function runPanel() {
    if (!state.result || !state.settings) { runHost = null; return null; }
    if (!adapter.isSupported()) return null;   // the folder step already explains this
    runHost = ui.el('div', {}, runPanelBody());
    return runHost;
  }

  /** Re-paint the Run + Plan slots: ticking must not rebuild the page (focus would jump). */
  function refreshRun() {
    if (runHost) ui.mount(runHost, runPanelBody());
    if (planHost) ui.mount(planHost, planPanelBody());
  }

  function statTable(rows, cols, title) {
    if (!rows.length) return null;
    return ui.el('div', {}, [
      title ? ui.el('h3', { class: 'prf-advanced-sub', text: title }) : null,
      ui.el('div', { class: 'table-wrap' }, ui.el('table', { class: 'grid' }, [
        ui.el('thead', {}, ui.el('tr', {}, cols.map(function (c) { return ui.el('th', { scope: 'col', text: P.pretty(c) }); }))),
        ui.el('tbody', {}, rows.map(function (r) {
          return ui.el('tr', { class: r.Flag ? 'is-bad' : (r.Result === 'FAIL' ? 'is-bad' : null) }, cols.map(function (c) {
            var v = r[c];
            return ui.el('td', {}, v === undefined || v === null ? '' : (typeof v === 'number' ? (isFinite(v) ? String(P.round(v, Number(state.settings.decimals) || 3)) : '') : String(v)));
          }));
        }))
      ]))
    ]);
  }

  /** Three steps across the top: Folder, What to run, Run. Done states follow the state. */
  function stepHead() {
    var s = state.settings;
    var done1 = !!state.result;
    var done2 = done1 && !!s && s.panelsOn.length > 0;
    var done3 = !!state.runResult;
    var now = done1 ? (done2 ? 3 : 2) : 1;
    var steps = [['Folder', done1], ['What to run', done2], ['Run', done3]];
    var body = [];
    steps.forEach(function (st, i) {
      if (i) body.push(ui.el('span', { class: 'prf-step-link' }));
      body.push(ui.el('span', { class: 'prf-step' + (st[1] ? ' is-done' : '') + (i + 1 === now && !st[1] ? ' is-now' : '') }, [
        ui.el('span', { class: 'prf-step-n', text: String(i + 1) }),
        ui.el('span', { text: st[0] })
      ]));
    });
    return ui.el('div', { class: 'prf-steps' }, body);
  }

  function draw() {
    if (!holder) return;
    ui.mount(holder, [stepHead(),
      ui.el('p', { class: 'prf-step-label', text: 'Step 1 · Folder' }), folderPanel(),
      ui.el('p', { class: 'prf-step-label', text: 'Step 2 · What to run' }), previewPanel(), settingsPanel(),
      ui.el('p', { class: 'prf-step-label', text: 'Step 3 · Run' }), previewPlanPanel(), runPanel(),
      (state.result && state.settings) ? advancedPanel() : null
    ].filter(Boolean));
  }

  function render(main) {
    mainEl = main;
    main.appendChild(ui.pageHead('PRF data', 'Turn a PRF / Zeta log folder into the Excel report - no YAML, no Python.'));
    holder = ui.el('div', { class: 'prf-page' });
    main.appendChild(holder);
    state.error = null;
    draw();
    // leaving and coming back to the page keeps the scan and the settings
    // (DECISIONS PRF-6 "remember what was used"); only the first visit tries
    // to silently pick up an already-granted folder and scans it.
    if (!state.connected && !state.result && adapter.isSupported()) {
      trySilentReconnect().then(function () { draw(); if (state.connected) runScan(); });
    }
    if (!state.outputConnected && adapter.isSupported()) {
      adapter.hasSavedOutput().then(function (has) {
        if (!has) return;
        return adapter.savedOutputLabel().then(function (name) { state.savedOutputHint = name; })
          .then(function () { return adapter.reconnectOutput({ silent: true }); })
          .then(function (ok) { if (ok) { state.outputConnected = true; state.outputLabel = adapter.outputLabel(); } });
      }).catch(function () {}).then(draw);
    }
  }

  return {
    render: render, _state: state,
    // exposed for tests/prf-view-logic.js only (same pattern as store.js's
    // _pure): pure-enough functions that touch no DOM, so the aggregation
    // and the sheet layout can be checked without a real browser/adapter.
    _test: { resolveSideConfig: resolveSideConfig, runAll: runAll, buildResult: buildResult, applyPath: applyPath, runBlockers: runBlockers, sheetRows: sheetRows, buildSheets: buildSheets,
             planRows: planRows, trendSeries: trendSeries,
             defaultSettings: defaultSettings, SHEET_COLS: SHEET_COLS, VIA_SPLIT: VIA_SPLIT }
  };
})();
