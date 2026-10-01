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
    error: null,
    savedRootHint: null, // name of a remembered root folder whose permission lapsed
    settings: null,     // built once from result (defaultSettings) - see below
    advancedOpen: false,
    outputConnected: false, outputLabel: null, savedOutputHint: null,
    previewOut: null,    // runAll() result, shown as the plan (Preview button)
    running: false, runResult: null   // {out, summary, comparison, status, written} after Run
  };

  /* --- settings, built once from the scan result (PRF-2..PRF-7) --------- */

  var VIA_SPLIT = { EVEN: 'even', FIXED: 'fixed', SEQUENCE: 'sequence' };

  function emptySideSettings(found) {
    return {
      enabled: found.side,
      roughness: { enabled: found.roughness, units: [], positions: 'Next to Via, Next to Via' },
      via: { enabled: found.via, units: [], sameAsRoughness: true, split: VIA_SPLIT.EVEN,
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
      lotName: '', process: 'Post DSM',
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

  function runScan() {
    state.scanning = true;
    state.error = null;
    state.progress = { done: 0, total: 0 };
    draw();

    return adapter.scanRoot(pcfg.log_folder_name).then(function (scan) {
      var refToDir = {};
      scan.entries.forEach(function (e) { refToDir[e.ref] = e.dir; });
      var idx = P.indexLogs(state.rootLabel || 'root', scan.entries.map(function (e) { return { rel: e.rel, ref: e.ref }; }));
      var problems = scan.problems.concat(idx.problems);

      var keys = Object.keys(idx.index);
      state.progress.total = keys.length;
      var sides = [];
      var ending = (state.settings && state.settings.fileEnding) || '.txt';

      function next(i) {
        if (i >= keys.length) return Promise.resolve();
        var entry = idx.index[keys[i]];
        var row = { lot: entry.lot, bu: entry.bu, buLabel: P.buLabel(entry.bu), panel: entry.panel, side: entry.side,
          refs: entry.refs, counts: emptyCounts(), files: null, tooMany: entry.refs.length > 1 };
        if (row.tooMany) {
          problems.push(entry.refs.length + ' log folders found for Panel ' + entry.panel + ' ' + entry.side +
            (entry.lot ? ' (lot ' + entry.lot : ' (no lot') + (row.buLabel ? ', ' + row.buLabel : '') + '), skipped: ' + entry.refs.join(' | '));
          sides.push(row);
          state.progress.done = i + 1;
          draw();
          return next(i + 1);
        }
        return readSideFiles(refToDir[entry.refs[0]], ending, function () { draw(); }).then(function (out) {
          row.counts = out.counts;
          row.files = out.files;
          sides.push(row);
          state.progress.done = i + 1;
          draw();
          return next(i + 1);
        });
      }

      return next(0).then(function () {
        sides.sort(function (a, b) {
          return String(a.lot || '') < String(b.lot || '') ? -1 : String(a.lot || '') > String(b.lot || '') ? 1
            : (a.bu || 0) - (b.bu || 0) || a.panel - b.panel || (a.side < b.side ? -1 : 1);
        });
        state.result = { sides: sides, problems: problems, lots: idx.lots };
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
        .then(function (ok) { if (ok) { state.connected = true; state.rootLabel = adapter.rootLabel(); } });
    }).catch(function () {});
  }

  function reconnectRoot() {
    state.error = null;
    return adapter.reconnectRoot({ silent: false }).then(function (ok) {
      if (!ok) { state.error = 'Permission was not given. Use "Choose root folder" instead.'; draw(); return; }
      state.connected = true;
      state.rootLabel = adapter.rootLabel();
      state.result = null;
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
      body.push(ui.el('p', { class: 'muted', text: 'Pick the folder that contains the panels - any layout works, ' +
        'the scan finds every "log" folder underneath. For Project/Part number/Lot to be read automatically, point here ' +
        'at the Lot folder or above it; lower than that, type them in under Metadata > Edit. You can pick a different folder any time.' }));
      body.push(ui.el('div', { class: 'prf-folder-row' }, [
        state.connected ? ui.el('span', { class: 'mono' }, state.rootLabel || '(connected)') : null,
        !state.connected && state.savedRootHint ? ui.el('span', { class: 'muted' }, 'Last used: ' + state.savedRootHint) : null,
        !state.connected && state.savedRootHint ? ui.button('Reconnect', { kind: 'primary', icon: 'refresh', onClick: reconnectRoot }) : null,
        ui.button(state.connected ? 'Change root folder' : 'Choose root folder', {
          kind: state.connected ? undefined : (state.savedRootHint ? undefined : 'primary'), icon: 'folder', onClick: connectRoot
        }),
        state.connected ? ui.button('Scan again', { icon: 'refresh', disabled: state.scanning, onClick: runScan }) : null
      ]));
    }
    if (state.error) body.push(ui.el('p', { class: 'ifield-msg' }, [ui.icon('alert', 14), ' ' + state.error]));
    return ui.panel({ title: '1. Root folder', icon: 'folder', body: body }).node;
  }

  function countsCell(c) {
    if (!c || !c.total) return ui.el('span', { class: 'muted', text: 'no files' });
    return ui.el('span', { class: 'mono' }, c.roughness + ' roughness, ' + c.via + ' via' + (c.unknown ? ', ' + c.unknown + ' unknown' : ''));
  }

  function previewPanel() {
    if (state.scanning) {
      var p = state.progress;
      return ui.panel({ title: '2. What was found', icon: 'search', body: [
        ui.el('div', { class: 'prf-scan-progress', 'aria-live': 'polite' },
          p && p.total ? 'Reading files ' + p.done + ' / ' + p.total + ' panel+side folders...' : 'Scanning...'),
        ui.skeleton(4)
      ] }).node;
    }
    if (!state.result) return null;
    var r = state.result;
    var lotRows = Object.keys(r.lots).map(function (lot) {
      return ui.el('li', {}, (lot || '(no lot in path)') + ' - project "' + (r.lots[lot].project || '') + '", part "' + (r.lots[lot].part || '') + '"');
    });
    var tableRows = r.sides.map(function (row) {
      return ui.el('tr', { class: row.tooMany ? 'is-bad' : null }, [
        ui.el('td', {}, row.lot || '-'),
        ui.el('td', {}, row.buLabel || '-'),
        ui.el('td', {}, String(row.panel)),
        ui.el('td', {}, row.side),
        ui.el('td', {}, row.tooMany ? ui.el('span', { class: 'chip warning', text: String(row.refs.length) + ' log folders' }) : countsCell(row.counts))
      ]);
    });
    var body = [
      r.sides.length ? ui.el('p', { class: 'muted' }, (Object.keys(r.lots).length || (r.sides.some(function (s) { return !s.lot; }) ? 1 : 0)) +
        ' lot(s), ' + r.sides.length + ' panel+side combination(s) found.') : null,
      lotRows.length ? ui.el('ul', { class: 'prf-lot-list' }, lotRows) : null,
      r.sides.length ? ui.el('div', { class: 'table-wrap' }, ui.el('table', { class: 'grid' }, [
        ui.el('thead', {}, ui.el('tr', {}, ['Lot', 'Build-up', 'Panel', 'Side', 'Files'].map(function (h) { return ui.el('th', { scope: 'col', text: h }); }))),
        ui.el('tbody', {}, tableRows)
      ])) : ui.emptyState({ icon: 'search', title: 'No log folders found', text: 'No folder named "' + pcfg.log_folder_name + '" was found under the root folder.' }),
      r.problems.length ? ui.el('div', { class: 'prf-problems' }, [
        ui.el('h3', { text: 'Problems' }),
        ui.el('ul', {}, r.problems.map(function (msg) { return ui.el('li', {}, [ui.icon('alert', 14), ' ' + msg]); }))
      ]) : null
    ];
    return ui.panel({ title: '2. What was found', icon: 'search', body: body }).node;
  }

  /* --- settings panel: metadata, panels, sides, units, via split -------- */

  function metaPanel() {
    var s = state.settings;
    var lots = Object.keys(state.result.lots);
    var body = [];
    if (s.metaAuto) {
      body.push(ui.el('dl', { class: 'prf-meta' }, [
        ui.el('dt', { text: 'Project' }), ui.el('dd', { text: s.metaOverride.project || '-' }),
        ui.el('dt', { text: 'Part number' }), ui.el('dd', { text: s.metaOverride.part || '-' }),
        ui.el('dt', { text: 'Lot' }), ui.el('dd', { text: lots.join(', ') || '(none in path)' }),
        ui.el('dt', { text: 'Build-up' }), ui.el('dd', { text: s.metaOverride.buildup || '(read per panel)' })
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
    var lotName = ui.field({ label: 'Lot name', required: true, value: s.lotName, hint: 'Required - typed, not read from the folder.' });
    lotName.input.addEventListener('input', function () { s.lotName = lotName.input.value; });
    body.push(lotName.node);
    body.push(ui.el('p', { class: 'ifield-msg', text: 'Process: ' + s.process + ' (change under Advanced)' }));
    return ui.panel({ title: '3. Metadata', icon: 'tag', body: body }).node;
  }

  function panelsPanel() {
    var s = state.settings;
    var boxes = s.panelsFound.map(function (p) {
      var t = ui.toggle({ label: 'Panel ' + p, checked: s.panelsOn.indexOf(p) !== -1,
        onChange: function (on) {
          var i = s.panelsOn.indexOf(p);
          if (on && i === -1) s.panelsOn.push(p);
          if (!on && i !== -1) s.panelsOn.splice(i, 1);
        } });
      return t.node;
    });
    var body = [
      ui.el('div', { class: 'prf-panel-actions' }, [
        ui.button('All', { size: 'sm', onClick: function () { s.panelsOn = s.panelsFound.slice(); draw(); } }),
        ui.button('None', { size: 'sm', onClick: function () { s.panelsOn = []; draw(); } })
      ]),
      ui.el('div', { class: 'prf-panel-grid' }, boxes)
    ];
    return ui.panel({ title: '4. Panels', icon: 'grid', body: body }).node;
  }

  function unitsField(side, kind, label) {
    var cfg = state.settings.sides[side][kind];
    var chips = ui.reorderChips({ label: label, value: cfg.units, placeholder: 'e.g. 5, 4, 2, 3, 6',
      onChange: function (v) { cfg.units = v; } });
    return chips.node;
  }

  function roughnessSubsection(side) {
    var s = state.settings.sides[side];
    var r = s.roughness;
    var t = ui.toggle({ label: 'Roughness', checked: r.enabled, onChange: function (on) { r.enabled = on; draw(); } });
    var inner = [];
    if (r.enabled) {
      inner.push(unitsField(side, 'roughness', 'Units (measurement order)'));
      var pos = ui.field({ label: 'Position names (in order, comma separated)', value: r.positions,
        hint: 'One name per roughness site in a unit, e.g. "Next to Via, Next to Via".' });
      pos.input.addEventListener('input', function () { r.positions = pos.input.value; });
      inner.push(pos.node);
    }
    return ui.el('div', { class: 'prf-subsection' }, [t.node, inner.length ? ui.el('div', { class: 'prf-subsection-body' }, inner) : null]);
  }

  function viaSubsection(side) {
    var s = state.settings.sides[side];
    var v = s.via;
    var t = ui.toggle({ label: 'Via', checked: v.enabled, onChange: function (on) { v.enabled = on; draw(); } });
    var inner = [];
    if (v.enabled) {
      var same = ui.toggle({ label: 'Same units as roughness', checked: v.sameAsRoughness,
        onChange: function (on) { v.sameAsRoughness = on; draw(); } });
      inner.push(same.node);
      if (!v.sameAsRoughness) inner.push(unitsField(side, 'via', 'Via units (measurement order)'));
      var seg = ui.segmented({ label: 'How are vias split', value: v.split, options: [
        { value: VIA_SPLIT.EVEN, label: 'Evenly' }, { value: VIA_SPLIT.FIXED, label: 'Fixed per unit' },
        { value: VIA_SPLIT.SEQUENCE, label: 'Custom sequence' }
      ], onChange: function (val) { v.split = val; draw(); } });
      inner.push(seg.node);
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
    return ui.el('div', { class: 'prf-subsection' }, [t.node, inner.length ? ui.el('div', { class: 'prf-subsection-body' }, inner) : null]);
  }

  function sidePanel(side) {
    var s = state.settings.sides[side];
    var t = ui.toggle({ label: side, kind: 'switch', checked: s.enabled, onChange: function (on) { s.enabled = on; draw(); } });
    var body = [t.node];
    if (s.enabled) { body.push(roughnessSubsection(side)); body.push(viaSubsection(side)); }
    return ui.el('div', { class: 'prf-side' }, body);
  }

  function sidesPanel() {
    return ui.panel({ title: '5. Sides', icon: 'sliders', body: [sidePanel('Front'), sidePanel('Back')] }).node;
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

  function settingsPanel() {
    if (!state.result || !state.settings) return null;
    return ui.el('div', { class: 'prf-settings' }, [metaPanel(), panelsPanel(), sidesPanel(), advancedPanel()]);
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
    var roughnessUnits = r.enabled ? r.units.slice() : [];
    var positions = r.enabled ? parsePositions(r.positions) : [];
    var viaUnits = v.enabled ? (v.sameAsRoughness || !v.units.length ? roughnessUnits.slice() : v.units.slice()) : [];
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

  function runPreview() {
    state.previewOut = runAll();
    draw();
  }

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

  function outputPanel() {
    if (!state.result || !state.settings) return null;
    var body = [];
    if (!adapter.isSupported()) return null;   // the root panel already explains this
    body.push(ui.el('p', { class: 'muted', text: 'Where the Excel report is saved.' }));
    body.push(ui.el('div', { class: 'prf-folder-row' }, [
      state.outputConnected ? ui.el('span', { class: 'mono' }, state.outputLabel || '(connected)') : null,
      !state.outputConnected && state.savedOutputHint ? ui.el('span', { class: 'muted' }, 'Last used: ' + state.savedOutputHint) : null,
      !state.outputConnected && state.savedOutputHint ? ui.button('Reconnect', { kind: 'primary', icon: 'refresh', onClick: reconnectOutput }) : null,
      ui.button(state.outputConnected ? 'Change output folder' : 'Choose output folder', {
        kind: state.outputConnected ? undefined : (state.savedOutputHint ? undefined : 'primary'), icon: 'folder', onClick: connectOutput
      })
    ]));
    return ui.panel({ title: '6. Output folder', icon: 'folder', body: body }).node;
  }

  function planRows(out) {
    var rows = [];
    out.t2b.forEach(function (r) { rows.push({ panel: r.Panel, side: r.Side, kind: 'Via', site: r.Site, unit: (r.Type === 'Coupon' ? 'Coupon ' : 'Unit ') + r.Unit, detail: 'Via ' + r.Via }); });
    out.rough.forEach(function (r) { rows.push({ panel: r.Panel, side: r.Side, kind: 'Roughness', site: r.Site, unit: (r.Type === 'Coupon' ? 'Coupon ' : 'Unit ') + r.Unit, detail: r.Measurement_Position }); });
    rows.sort(function (a, b) { return a.panel - b.panel || (a.side < b.side ? -1 : a.side > b.side ? 1 : a.site - b.site); });
    return rows;
  }

  function previewPlanPanel() {
    if (!state.result || !state.settings) return null;
    var body = [ui.button('Preview the plan', { icon: 'search', onClick: runPreview })];
    if (state.previewOut) {
      var out = state.previewOut;
      var rows = planRows(out);
      if (rows.length) {
        body.push(ui.el('div', { class: 'table-wrap' }, ui.el('table', { class: 'grid' }, [
          ui.el('thead', {}, ui.el('tr', {}, ['Panel', 'Side', 'Site', 'Kind', 'Unit', 'Detail'].map(function (h) { return ui.el('th', { scope: 'col', text: h }); }))),
          ui.el('tbody', {}, rows.map(function (r) {
            return ui.el('tr', {}, [r.panel, r.side, r.site, r.kind, r.unit, r.detail].map(function (v) { return ui.el('td', {}, String(v)); }));
          }))
        ])));
      } else {
        body.push(ui.emptyState({ icon: 'search', title: 'Nothing would be assigned', text: 'Check the ticked panels, sides and units below.' }));
      }
      if (out.log.length) body.push(logList(out.log, 'Messages for this plan'));
    }
    return ui.panel({ title: '7. Preview', icon: 'search', body: body }).node;
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

  function canRun() {
    var s = state.settings;
    if (!s) return false;
    if (!s.lotName.trim()) return false;
    if (!s.panelsOn.length) return false;
    if (!state.outputConnected) return false;
    return s.sides.Front.enabled || s.sides.Back.enabled;
  }

  function runPanel() {
    if (!state.result || !state.settings) return null;
    var s = state.settings;
    var reasons = [];
    if (!s.lotName.trim()) reasons.push('type a Lot name');
    if (!s.panelsOn.length) reasons.push('tick at least one panel');
    if (!(s.sides.Front.enabled || s.sides.Back.enabled)) reasons.push('tick Front or Back');
    if (!state.outputConnected) reasons.push('pick an output folder');
    var body = [
      ui.button('Run', { kind: 'primary', icon: 'save', disabled: !canRun() || state.running, onClick: runReport }),
      state.running ? ui.el('p', { class: 'muted' }, 'Working...') : null,
      !canRun() && reasons.length ? ui.el('p', { class: 'ifield-msg', text: 'Before Run: ' + reasons.join(', ') + '.' }) : null
    ];
    return ui.panel({ title: '8. Run', icon: 'save', body: body }).node;
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

  function resultsPanel() {
    if (!state.runResult) return null;
    var r = state.runResult;
    var body = [
      ui.el('p', {}, [ui.el('span', { class: 'chip ' + (r.status === 'OK' ? 'ok' : 'warning'), text: r.status }),
        ' Saved as ' + r.written.name + ' (' + r.written.format + ').']),
      statTable(r.summary, SHEET_COLS.Summary, 'Summary'),
      statTable(r.comparison, SHEET_COLS.Comparison, 'Front vs Back'),
      statTable(r.out.t2b, SHEET_COLS.T2B, 'T2B'),
      statTable(r.out.rough, SHEET_COLS.Roughness, 'Roughness'),
      r.out.log.length ? logList(r.out.log, 'Log') : null
    ].filter(Boolean);
    return ui.panel({ title: '9. Results', icon: 'check', body: body }).node;
  }

  function draw() {
    if (!holder) return;
    ui.mount(holder, [folderPanel(), previewPanel(), settingsPanel(), outputPanel(), previewPlanPanel(), runPanel(), resultsPanel()].filter(Boolean));
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
    _test: { resolveSideConfig: resolveSideConfig, runAll: runAll, sheetRows: sheetRows, buildSheets: buildSheets,
             defaultSettings: defaultSettings, SHEET_COLS: SHEET_COLS, VIA_SPLIT: VIA_SPLIT }
  };
})();
