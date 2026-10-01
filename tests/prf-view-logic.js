/**
 * tests/prf-view-logic.js - dev only, no dependencies: node tests/prf-view-logic.js
 *
 * js/views/prf.js needs a real browser (File System Access, DOM) for the
 * folder picking and rendering - that part is for Prince to try in Edge.
 * But the part that turns settings + already-read files into report rows
 * (resolveSideConfig, runAll, the sheet layout) touches no DOM and no
 * adapter, so it is checked here the same way tests/run-tests.js checks
 * store.js's _pure functions: against a fake scan result, in Node.
 */
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const win = { console, Object, String, Number, RegExp, Error, JSON, Array, Math, Date, Promise, isFinite, isNaN };
win.window = win;
const ctx = vm.createContext(win);
['js/config.js', 'js/domain.js', 'js/adapters/prf-folder.js', 'js/prf.js', 'js/views/prf.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

const view = win.window.MRT.views.prf;
const T = view._test;
let failures = 0, passed = 0;
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++; else { failures++; console.log('FAIL', name, '-> expected', e, 'got', a); }
}
function ok(name, cond, detail) { if (cond) passed++; else { failures++; console.log('FAIL', name, detail || ''); } }

/* ---------------- fixtures ---------------- */

const ROUGH_LINES = ['Ra\tRq\tRz\tRpv\tRku', '1\t2\t5\t6\t3', '1.2\t2.2\t6\t7\t3.1'];
const VIA_LINES = ['Index,CenterX,CenterY,MajorAxis,MinorAxis,AvgHeight,MinHeight,MaxHeight',
  '1,0,0,100,96,0,0,0', '2,0,0,60,56,-50,-51,-49'];

function fakeResult() {
  return {
    lots: { '12345': { project: 'ProjX', part: 'PN1' } },
    sides: [
      { lot: '12345', bu: 1, buLabel: 'BU01', panel: 1, side: 'Front', refs: ['p1f'], tooMany: false,
        counts: { roughness: 1, via: 2, unknown: 1, total: 4 },
        files: { roughness: [{ name: 'r10.txt', site: 10, lines: ROUGH_LINES }],
                 via: [{ name: 'v11.txt', site: 11, lines: VIA_LINES }, { name: 'v12.txt', site: 12, lines: VIA_LINES }],
                 unknown: [{ name: 'junk13.txt', site: 13, lines: ['???'] }] } },
      { lot: '12345', bu: 1, buLabel: 'BU01', panel: 2, side: 'Front', refs: ['p2f'], tooMany: false,
        counts: { roughness: 0, via: 0, unknown: 0, total: 0 },
        files: { roughness: [], via: [], unknown: [] } }
    ],
    problems: []
  };
}

function fakeSettings(result) {
  const s = T.defaultSettings(result);
  s.lotName = 'MyLot';
  s.panelsOn = [1];                                  // panel 2 is left unticked
  s.sides.Front.enabled = true;
  s.sides.Front.roughness = { enabled: true, units: [5], positions: 'P1' };
  s.sides.Front.via = { enabled: true, units: [], sameAsRoughness: true, split: T.VIA_SPLIT.EVEN, perUnit: '', perCoupon: '', sequenceText: '' };
  s.sides.Back.enabled = false;
  return s;
}

/* ---------------- resolveSideConfig ---------------- */

{
  const result = fakeResult(), settings = fakeSettings(result);
  const cfg = T.resolveSideConfig(settings.sides.Front);
  eq('roughness units/positions come from the form', [cfg.roughnessUnits, cfg.positions], [[5], ['P1']]);
  eq('"same units as roughness" resolves the via units from the roughness list', cfg.viaUnits, [5]);
  eq('evenly split: no sequence, no fixed counts', [cfg.sequence, cfg.counts], [null, null]);

  const fixed = JSON.parse(JSON.stringify(settings));
  fixed.sides.Front.via.sameAsRoughness = false;
  fixed.sides.Front.via.units = [7, 'C1'];
  fixed.sides.Front.via.split = T.VIA_SPLIT.FIXED;
  fixed.sides.Front.via.perUnit = '3'; fixed.sides.Front.via.perCoupon = '2';
  const cfg2 = T.resolveSideConfig(fixed.sides.Front);
  eq('fixed per unit/coupon -> countsFromDefaults, in the typed via unit order', cfg2.counts, [[7, 3], ['C1', 2]]);

  const seq = JSON.parse(JSON.stringify(settings));
  seq.sides.Front.via.split = T.VIA_SPLIT.SEQUENCE;
  seq.sides.Front.via.sequenceText = '3x3, 2x4';
  const cfg3 = T.resolveSideConfig(seq.sides.Front);
  eq('custom sequence parsed in order', cfg3.sequence, [['3', 3], ['2', 4]]);

  const badSeq = JSON.parse(JSON.stringify(settings));
  badSeq.sides.Front.via.split = T.VIA_SPLIT.SEQUENCE;
  badSeq.sides.Front.via.sequenceText = 'not a sequence';
  const cfg4 = T.resolveSideConfig(badSeq.sides.Front);
  ok('a bad sequence is reported, not silently dropped', cfg4.sequence === null && /Bad via sequence/.test(cfg4.seqError));
}

/* ---------------- runAll: aggregation across panels ---------------- */

{
  const result = fakeResult();
  view._state.result = result;
  view._state.settings = fakeSettings(result);
  const out = T.runAll();

  eq('only the ticked panel (1) is processed; panel 2 is left out entirely', out.rough.concat(out.t2b).map(r => r.Panel).filter((v, i, a) => a.indexOf(v) === i), [1]);
  ok('roughness: one row (1 unit x 1 position)', out.rough.length === 1 && out.rough[0].Unit === 5 && out.rough[0].Measurement_Position === 'P1');
  ok('via: two rows (2 files / 1 unit = 2 vias)', out.t2b.length === 2 && out.t2b.every(r => r.Unit === 5));
  eq('meta is read from the panel/side (auto): project, part, lot', [out.rough[0].Project_Name, out.rough[0].Part_Number, out.rough[0].Lot_Number, out.rough[0].Lot_Name],
    ['ProjX', 'PN1', '12345', 'MyLot']);
  eq('the unknown file is collected with its panel/side', out.unknown, [{ Lot_Number: '12345', Buildup: 'BU01', Panel: 1, Side: 'Front', File: 'junk13.txt' }]);
  ok('the unknown file is also logged as a WARNING', out.log.some(m => m.Level === 'WARNING' && /Unknown file type: junk13.txt/.test(m.Message)));
  ok('check_sites ran: a gap below site 10 is reported', out.log.some(m => /Missing sites/.test(m.Message)));

  const manual = JSON.parse(JSON.stringify(result));
  view._state.result = manual;
  view._state.settings = fakeSettings(manual);
  view._state.settings.metaAuto = false;
  view._state.settings.metaOverride = { project: 'Typed', part: 'TPN', lot: '', buildup: 'TBU' };
  const out2 = T.runAll();
  eq('Edit > typed metadata overrides the path-read values', [out2.rough[0].Project_Name, out2.rough[0].Part_Number, out2.rough[0].Buildup], ['Typed', 'TPN', 'TBU']);

  const filtered = JSON.parse(JSON.stringify(result));
  filtered.sides.push({ lot: '99999', bu: 1, buLabel: 'BU01', panel: 1, side: 'Back', refs: ['x'], tooMany: false,
    counts: { roughness: 0, via: 0, unknown: 0, total: 0 }, files: { roughness: [], via: [], unknown: [] } });
  view._state.result = filtered;
  const fs2 = fakeSettings(filtered);
  fs2.metaAuto = false;
  fs2.metaOverride = { project: '', part: '', lot: '12345', buildup: '' };   // a typed lot filters to that lot only
  view._state.settings = fs2;
  const out3 = T.runAll();
  ok('a typed lot number processes only that lot (py lot_number forces one lot)', out3.rough.every(r => r.Lot_Number === '12345'));
}

/* ---------------- planRows: the live Plan table ---------------- */

{
  const result = fakeResult();
  view._state.result = result;
  view._state.settings = fakeSettings(result);
  const rows = T.planRows(T.runAll());
  eq('the plan lists every assignment row: 1 roughness + 2 via, panel 1 Front, site order',
    rows.map(r => [r.panel, r.side, r.site, r.kind, r.unit]),
    [[1, 'Front', 10, 'Roughness', 'Unit 5'], [1, 'Front', 11, 'Via', 'Unit 5'], [1, 'Front', 12, 'Via', 'Unit 5']]);
}

/* ---------------- Run: what blocks it (Lot name is optional, 2026-10-01) ---------------- */

{
  const result = fakeResult();
  view._state.result = result;
  view._state.settings = fakeSettings(result);
  view._state.settings.lotName = '';
  view._state.outputConnected = true;
  eq('an empty Lot name does NOT block Run', T.runBlockers(), []);
  eq('...and the rows just carry an empty Lot name', T.runAll().rough[0].Lot_Name, '');
  view._state.outputConnected = false;
  eq('no output folder blocks Run, and says so', T.runBlockers(), ['pick an output folder']);
  view._state.settings.panelsOn = [];
  view._state.settings.sides.Front.enabled = false;
  eq('every reason is listed', T.runBlockers(), ['tick at least one panel', 'tick Front or Back', 'pick an output folder']);
}

/* ---------------- picked BU-01 + the pasted full path (Prince's case) ---------------- */

{
  const st = view._state;
  st.rootLabel = 'BU-01';
  st.rootPath = '';
  st.result = null; st.settings = null;
  st.scan = {
    entries: [{ rel: ['Panel 3', 'Front'], ref: 'Panel 3/Front/log' }],
    files: { 'Panel 3/Front/log': { counts: { roughness: 1, via: 0, unknown: 0, total: 1 },
      files: { roughness: [{ name: 'r1.txt', site: 1, lines: ROUGH_LINES }], via: [], unknown: [] } } },
    problems: []
  };
  T.buildResult();
  st.settings = T.defaultSettings(st.result);
  eq('picked BU-01, no path: no lot, project or part known', [Object.keys(st.result.lots), st.settings.metaOverride.project, st.settings.metaOverride.part], [[], '', '']);

  st.settings.lotName = 'kept';
  st.settings.sides.Front.roughness.units = [4];
  T.applyPath('"L:\\ale\\ics_htb3_rnd\\130 - measurement results\\02_Engineering lots\\Chiplet4Future\\FHR0020\\19197\\BU-01"');
  eq('...after pasting the path: lot 19197, part FHR0020, project Chiplet4Future, BU-01',
    [Object.keys(st.result.lots), st.settings.metaOverride.project, st.settings.metaOverride.part, st.result.sides[0].buLabel],
    [['19197'], 'Chiplet4Future', 'FHR0020', 'BU-01']);
  eq('...what was already typed stays (lot name, units)', [st.settings.lotName, st.settings.sides.Front.roughness.units], ['kept', [4]]);
  ok('...the files were not read again (same cached lines)', st.result.sides[0].files.roughness[0].lines === ROUGH_LINES);

  T.applyPath('L:\\somewhere\\else');
  eq('a path that does not end in the picked folder is not used', Object.keys(st.result.lots), []);
}

/* ---------------- sheetRows / buildSheets ---------------- */

{
  const rows = [{ A: 1.23456, B: 'x', C: true, D: NaN, E: null }];
  const sheet = T.sheetRows(rows, ['A', 'B', 'C', 'D', 'E'], 2);
  eq('sheetRows: numbers rounded to the chosen decimals, booleans as Yes/No, NaN/null blank', sheet, [['A', 'B', 'C', 'D', 'E'], [1.23, 'x', 'Yes', '', '']]);

  const out = { t2b: [], t2bRaw: [], rough: [], roughRaw: [], unknown: [], log: [] };
  const sheets = T.buildSheets(out, [], [], 3);
  eq('every sheet in the decided list is built, even empty', sheets.map(s => s.name),
    ['Summary', 'Comparison', 'T2B', 'Roughness', 'T2B_raw', 'Roughness_raw', 'Unknown_files', 'Log']);
}

console.log(failures ? failures + ' of ' + (passed + failures) + ' PRF VIEW-LOGIC CHECKS FAILED' : 'prf view logic ok (' + passed + ' checks)');
if (failures) process.exitCode = 1;
