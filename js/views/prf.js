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
    error: null
  };

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

  function trySilentReconnect() {
    return adapter.hasSavedRoot().then(function (has) {
      if (!has) return;
      return adapter.reconnectRoot({ silent: true }).then(function (ok) {
        if (ok) { state.connected = true; state.rootLabel = adapter.rootLabel(); }
      });
    }).catch(function () {});
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
        'the scan finds every "log" folder underneath. You can pick a different folder each time; nothing is remembered that you have to clear.' }));
      body.push(ui.el('div', { class: 'prf-folder-row' }, [
        state.connected ? ui.el('span', { class: 'mono' }, state.rootLabel || '(connected)') : null,
        ui.button(state.connected ? 'Change root folder' : 'Choose root folder', {
          kind: state.connected ? undefined : 'primary', icon: 'folder', onClick: connectRoot
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

  function draw() {
    if (!holder) return;
    ui.mount(holder, [folderPanel(), previewPanel()].filter(Boolean));
  }

  function render(main) {
    mainEl = main;
    main.appendChild(ui.pageHead('PRF data', 'Turn a PRF / Zeta log folder into the Excel report - no YAML, no Python.'));
    holder = ui.el('div', { class: 'prf-page' });
    main.appendChild(holder);
    state.result = null;
    state.error = null;
    draw();
    if (!state.connected && adapter.isSupported()) {
      trySilentReconnect().then(function () { draw(); if (state.connected) runScan(); });
    }
  }

  return { render: render, _state: state };
})();
