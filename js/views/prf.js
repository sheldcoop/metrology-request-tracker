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
    advancedOpen: false
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

  /** One [panel, side] summary row, built from the files in its log folder(s). */
  function sideKey(lot, bu, panel, side) { return [lot, bu, panel, side].join('|'); }

  function emptyCounts() { return { roughness: 0, via: 0, unknown: 0, total: 0 }; }

  /** Read and classify every file in dir, in chunks, reporting progress. */
  function countFiles(dir, onProgress) {
    return adapter.listFiles(dir, '.txt').then(function (txtFiles) {
      return adapter.listFiles(dir, '.csv').then(function (csvFiles) {
        var files = txtFiles.concat(csvFiles);
        var counts = emptyCounts();
        var i = 0;
        function chunk() {
          var end = Math.min(i + pcfg.read_chunk, files.length);
          var reads = [];
          for (; i < end; i++) {
            reads.push(adapter.readFile(files[i].handle).then(function (text) {
              var kind = P.classify(P.textToLines(text));
              counts[kind] += 1;
              counts.total += 1;
            }));
          }
          return Promise.all(reads).then(function () {
            if (onProgress) onProgress();
            if (i < files.length) return new Promise(function (r) { setTimeout(r, 0); }).then(chunk);
          });
        }
        return chunk().then(function () { return counts; });
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

      function next(i) {
        if (i >= keys.length) return Promise.resolve();
        var entry = idx.index[keys[i]];
        var row = { lot: entry.lot, bu: entry.bu, buLabel: P.buLabel(entry.bu), panel: entry.panel, side: entry.side,
          refs: entry.refs, counts: emptyCounts(), tooMany: entry.refs.length > 1 };
        if (row.tooMany) {
          problems.push(entry.refs.length + ' log folders found for Panel ' + entry.panel + ' ' + entry.side +
            (entry.lot ? ' (lot ' + entry.lot : ' (no lot') + (row.buLabel ? ', ' + row.buLabel : '') + '), skipped: ' + entry.refs.join(' | '));
          sides.push(row);
          state.progress.done = i + 1;
          draw();
          return next(i + 1);
        }
        return countFiles(refToDir[entry.refs[0]], function () { draw(); }).then(function (counts) {
          row.counts = counts;
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

  function draw() {
    if (!holder) return;
    ui.mount(holder, [folderPanel(), previewPanel(), settingsPanel()].filter(Boolean));
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
  }

  return { render: render, _state: state };
})();
