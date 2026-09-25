/**
 * tests/preview-smoke.js - dev only, no dependencies:  node tests/preview-smoke.js
 *
 * Checks the dev preview works: tests/preview.html is up to date with
 * index.html, and preview.js + the real app boot on the demo data (as
 * admin, as a quality engineer, and on an empty folder). Flows only.
 */
const vm = require('vm'), fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
let failures = 0, passed = 0;
function check(name, cond, detail) { if (cond) passed++; else { failures++; console.log('FAIL', name, detail !== undefined ? '-> ' + detail : ''); } }

const upToDate = cp.spawnSync(process.execPath, [path.join(__dirname, 'make-preview.js'), '--check']).status === 0;
check('tests/preview.html is up to date with index.html', upToDate);

// the scripts preview.html loads, in its order
const html = fs.readFileSync(path.join(__dirname, 'preview.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => s.indexOf('vendor/') === -1)
  .map(s => path.join(__dirname, s));

const IDS = ['gate', 'gateCard', 'shell', 'brandMark', 'brandVer', 'saveLed', 'undoBtn', 'searchIcon', 'search', 'bellBtn', 'bellIcon', 'bellCount', 'helpBtn', 'keysBtn',
  'userBtn', 'userAvatar', 'userName', 'userCaret', 'alertBanner', 'conflictBanner', 'navItems', 'navFolder', 'navRev', 'navCollapse',
  'main', 'toasts', 'dialogHost'];

async function boot(query, hash) {
  const dom = require('./fake-dom')({ ids: IDS, url: 'file:///x/tests/preview.html' + query + (hash || '') });
  const { win, doc, flush } = dom;
  doc.getElementById('gate').hidden = true; doc.getElementById('shell').hidden = true;
  const loadFns = [];
  const addEv = win.addEventListener.bind(win);
  win.addEventListener = (t, f) => { if (t === 'load') loadFns.push(f); else addEv(t, f); };
  const ctx = vm.createContext(win);
  scripts.forEach(f => vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: path.relative(ROOT, f) }));
  win.MRT.app.boot();
  for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 3)); flush(); }
  loadFns.forEach(f => f());
  for (let i = 0; i < 25; i++) { await new Promise(r => setTimeout(r, 3)); flush(); }
  return dom;
}

(async function () {
  let d = await boot('?theme=light');
  check('as admin + engineer: the shell opens on My requests (M3-12)', !d.doc.getElementById('shell').hidden && /My requests/.test(d.doc.getElementById('main').textContent));
  check('...signed in as Prince', d.win.MRT.store.currentUser().name === 'Prince Khurana');
  check('...with the theme from ?theme=', d.doc.documentElement.getAttribute('data-theme') === 'carbon-white');
  d = await boot('?theme=light', '#/lab');
  check('...demo tool states: FIB in Maintenance, PRF Down', /Maintenance/.test(d.doc.getElementById('main').textContent) && /Down/.test(d.doc.getElementById('main').textContent));
  check('...the data file name shows "preview"', /preview/.test(d.doc.getElementById('navFolder').textContent));

  d = await boot('', '#/settings/users');
  check('Settings unlock by themselves (demo PIN)', /People/.test(d.doc.getElementById('main').textContent) && /Nora Steiner/.test(d.doc.getElementById('main').textContent));

  d = await boot('?as=quality');
  check('?as=quality: a quality engineer starts on My queue (M3-12)', /My queue/.test(d.doc.getElementById('main').textContent));
  d = await boot('?as=quality', '#/lab');
  const btns = d.doc.getElementById('main').querySelectorAll('button').filter(b => /Set status/.test(b.textContent));
  check('?as=quality: Olga, who may set FIB and QVM only', d.win.MRT.store.currentUser().name === 'Olga Berger' && btns.length === 2, btns.length);

  d = await boot('?demo=big');
  check('?demo=big: Prince on My requests of the big demo file', /My requests/.test(d.doc.getElementById('main').textContent) &&
        d.win.MRT.store.data().requests.length > 200 && d.win.MRT.store.currentUser().name === 'Prince Khurana');
  d = await boot('?demo=big&as=mia', '#/queue');
  check('?demo=big&as=mia: Mia\'s queue is full (FIB backup while Olga is away)', d.win.MRT.store.currentUser().name === 'Mia Gruber' &&
        d.doc.getElementById('main').querySelectorAll('.q-row').length >= 10);

  // every page with the big file: nothing may break, and each render is timed (fake DOM - a rough guide only)
  d = await boot('?demo=big');
  const errs = [];
  const origErr = d.win.console.error;
  d.win.console.error = (...a) => { errs.push(a.map(String).join(' ')); };
  const someReq = d.win.MRT.store.data().requests.filter(r => r.status === 'in_progress')[0];
  const someLot = d.win.MRT.store.data().lots.filter(l => l.scrapped.length)[0];
  const myDraft = d.win.MRT.store.data().requests.filter(r => r.status === 'draft' && r.requester_id === d.win.MRT.store.currentUser().id)[0];
  const routes = ['#/lab', '#/queue', '#/requests', '#/new', '#/new/' + myDraft.id, '#/new?from=' + someReq.id, '#/lots', '#/lots/' + someLot.id, '#/board', '#/request/' + someReq.id, '#/slip/' + someReq.id,
    '#/settings/health', '#/settings/users', '#/settings/tools', '#/settings/lists', '#/settings/lots', '#/settings/calendar', '#/settings/audit', '#/settings/data', '#/help'];
  let slowest = ['', 0];
  for (const h of routes) {
    const t0 = Date.now();
    d.win.setHash(h);
    for (let i = 0; i < 6; i++) { await new Promise(r => setTimeout(r, 2)); d.flush(); }
    const ms = Date.now() - t0;
    if (ms > slowest[1]) slowest = [h, ms];
  }
  d.win.console.error = origErr;
  check('?demo=big: all ' + routes.length + ' pages render without an error', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log('  slowest page with the big file (fake DOM): ' + slowest[0] + ' ' + slowest[1] + ' ms');

  d = await boot('?empty=1');
  check('?empty=1: the first-run screen', /Set up the app/.test(d.doc.getElementById('gateCard').textContent));

  console.log(failures ? failures + ' of ' + (passed + failures) + ' PREVIEW CHECKS FAILED' : 'preview smoke ok (' + passed + ' checks)');
  if (failures) process.exitCode = 1;
})().catch(e => { console.log('CRASH', e.stack); process.exitCode = 1; });
