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

const IDS = ['gate', 'gateCard', 'shell', 'brandMark', 'brandVer', 'saveLed', 'undoBtn', 'searchIcon', 'search', 'helpBtn', 'keysBtn',
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
  check('as admin: the shell opens on Lab status', !d.doc.getElementById('shell').hidden && /Lab status/.test(d.doc.getElementById('main').textContent));
  check('...signed in as Prince', d.win.MRT.store.currentUser().name === 'Prince Khurana');
  check('...with the theme from ?theme=', d.doc.documentElement.getAttribute('data-theme') === 'light');
  check('...demo tool states: FIB in Maintenance, PRF Down', /Maintenance/.test(d.doc.getElementById('main').textContent) && /Down/.test(d.doc.getElementById('main').textContent));
  check('...the data file name shows "preview"', /preview/.test(d.doc.getElementById('navFolder').textContent));

  d = await boot('', '#/settings/users');
  check('Settings unlock by themselves (demo PIN)', /People/.test(d.doc.getElementById('main').textContent) && /Nora Steiner/.test(d.doc.getElementById('main').textContent));

  d = await boot('?as=quality');
  const btns = d.doc.getElementById('main').querySelectorAll('button').filter(b => /Set status/.test(b.textContent));
  check('?as=quality: Olga, who may set FIB and QVM only', d.win.MRT.store.currentUser().name === 'Olga Berger' && btns.length === 2, btns.length);

  d = await boot('?empty=1');
  check('?empty=1: the first-run screen', /Set up the app/.test(d.doc.getElementById('gateCard').textContent));

  console.log(failures ? failures + ' of ' + (passed + failures) + ' PREVIEW CHECKS FAILED' : 'preview smoke ok (' + passed + ' checks)');
  if (failures) process.exitCode = 1;
})().catch(e => { console.log('CRASH', e.stack); process.exitCode = 1; });
