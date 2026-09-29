/**
 * tests/dom-budget.js - dev only, no dependencies:  node tests/dom-budget.js
 *
 * M8 guard: boots the real app in the fake browser on demo data (107
 * requests), renders each heavy view, logs render ms + #main node counts,
 * and fails when a view tops 5000 nodes or the queue shows over 100 rows.
 * Fake-DOM numbers measure JS render cost (no layout/paint); Prince checks
 * real feel in Edge.
 */
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const IDS = ['gate', 'gateCard', 'shell', 'brandMark', 'brandVer', 'saveLed', 'undoBtn', 'searchIcon', 'search',
  'bellBtn', 'bellIcon', 'bellCount', 'helpBtn', 'keysBtn', 'userBtn', 'userAvatar', 'userName', 'userCaret', 'alertBanner', 'conflictBanner',
  'navItems', 'navFolder', 'navRev', 'navCollapse', 'main', 'toasts', 'dialogHost'];
const { win, doc, flush, El } = require(ROOT + '/tests/fake-dom')({ ids: IDS, url: 'file:///x/index.html' });
[['saveLed', 'save-state'], ['undoBtn', 'undo'], ['keysBtn', 'show-keys'], ['bellBtn', 'bell'], ['userBtn', 'user-menu'], ['navCollapse', 'nav-collapse']]
  .forEach(p => { doc.getElementById(p[0]).dataset.action = p[1]; });
doc.getElementById('undoBtn').hidden = true;
const ctx = vm.createContext(win);
['js/config.js', 'js/themes.js', 'js/domain.js', 'js/adapters/storage-folder.js', 'js/adapters/mail.js', 'js/seed.js', 'js/store.js', 'js/demo-data.js', 'js/identity.js', 'js/analytics.js',
 'js/ui/core.js', 'js/ui/components.js', 'js/ui/glyphs.js', 'js/ui/heatmap.js', 'js/ui/overlays.js', 'js/ui/charts.js', 'js/ui/panelmap.js', 'js/ui/barcode.js', 'js/ui/magazine.js', 'js/ui/traveller.js', 'js/ui/hirata.js', 'js/ui/theme-gallery.js', 'js/exporter.js',
 'js/views/lab.js', 'js/views/settings.js', 'js/views/settings-health.js', 'js/views/settings-users.js',
 'js/views/settings-tools.js', 'js/views/settings-lists.js', 'js/views/settings-lots.js', 'js/views/settings-calendar.js', 'js/views/settings-audit.js',
 'js/views/settings-data.js', 'js/views/settings-look.js', 'js/views/settings-emails.js', 'js/views/extra-fields.js', 'js/views/lots.js', 'js/views/new.js', 'js/views/request-actions.js', 'js/views/request.js', 'js/views/queue.js', 'js/views/requests.js', 'js/views/board.js', 'js/views/slip.js', 'js/views/templates.js', 'js/views/analytics.js', 'js/views/hirata.js', 'js/views/help.js', 'js/app.js', 'tests/memory-storage.js'
].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const MRT = win.MRT;
const folder = MRT.adapters.storageMemory({});
MRT.adapters.storageFolder = folder;
async function settle() { for (let i = 0; i < 15; i++) { await new Promise(r => setTimeout(r, 2)); flush(); } }
function nodes(el) { let n = 0; const w = x => x.children.forEach(c => { n++; w(c); }); w(el); return n; }
(async () => {
  MRT.store.init(folder);
  await MRT.store.connect();
  await MRT.store.createFirstAdmin({ name: 'Admin', windows_id: 'admin', pin: '1234', pin2: '1234' });
  const me = MRT.store.data().users[0].id;
  MRT.store.setCurrentUser(me);
  await MRT.store.replaceData('demo', 'perf');
  MRT.store.setCurrentUser(MRT.store.data().users[0].id);
  const N = MRT.store.data().requests.length;
  console.log('demo requests:', N);
  const main = doc.getElementById('main');
  const ui = MRT.ui;
  let fails = 0;
  async function measure(label, route, sub) {
    ui.clear(main); flush();
    const t0 = performance.now();
    MRT.views[route].render(main, { subpath: sub || '', query: '', params: {} });
    await settle();
    const ms = performance.now() - t0, n = nodes(main);
    console.log(label + ': ' + ms.toFixed(1) + ' ms, ' + n + ' nodes in #main');
    if (n > 5000) { fails++; console.log('FAIL ' + label.trim() + ': over the 5000-node view budget'); }
    return n;
  }
  await measure('lab       ', 'lab');
  await measure('queue     ', 'queue');
  await measure('requests  ', 'requests');
  await measure('board     ', 'board');
  await measure('analytics ', 'analytics');
  await measure('lots      ', 'lots');
  await measure('new       ', 'new');
  const r1 = MRT.store.data().requests.filter(r => r.status !== 'draft')[0];
  await measure('request   ', 'request', r1.id);
  await measure('health    ', 'settings', 'health');
  // paging guard: pad the open queue past 100 in memory, expect exactly 100 rows + a more-button
  const open = MRT.store.data().requests.filter(r => MRT.domain.isOpen(r));
  for (let i = 0; i < 110 - open.length; i++) {
    const c = JSON.parse(JSON.stringify(open[i % open.length]));
    c.id = 'pad' + i; c.request_no = 'PAD-' + i;
    MRT.store.data().requests.push(c);
  }
  ui.clear(main); flush();
  MRT.views.queue.render(main, { subpath: '', query: '', params: {} });
  await settle();
  const rows = main.querySelectorAll('.q-row').length;
  const more = main.querySelectorAll('button').some(b => /more/i.test(b.textContent));
  console.log('queue rows shown: ' + rows + ' (padded past 100), more-button: ' + more);
  if (rows !== 100 || !more) { fails++; console.log('FAIL queue paging: expected 100 rows + more-button'); }
  if (fails) process.exit(1);
  console.log('dom budget ok');
})().catch(e => { console.log('PERF-ERR', e.stack.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
