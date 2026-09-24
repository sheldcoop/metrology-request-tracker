/**
 * tests/app-smoke.js - dev only, no dependencies:  node tests/app-smoke.js
 *
 * Boots the real app (the scripts of index.html) in a fake browser
 * (tests/fake-dom.js) on an in-memory data folder, as if opened by the
 * launcher, and walks the M1 shell: first run, the menu, search, a page
 * still to come, tool status + Undo, "Who are you?" sign-up, change user,
 * a failed save with Retry, and "someone else saved".
 * Catches script errors and broken flows - not looks, layout or focus:
 * Prince checks those in Edge. Exits 1 on any failure.
 */
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

const IDS = ['gate', 'gateCard', 'shell', 'brandMark', 'brandVer', 'saveLed', 'undoBtn', 'searchIcon', 'search',
  'helpBtn', 'keysBtn', 'userBtn', 'userAvatar', 'userName', 'userCaret', 'alertBanner', 'conflictBanner',
  'navItems', 'navFolder', 'navRev', 'navCollapse', 'main', 'toasts', 'dialogHost'];
const { win, doc, flush, tick, storage, El } = require('./fake-dom')({ ids: IDS, url: 'file:///Z:/Lab/MRT/index.html?who=CORP%5CPKhurana' });
// the data-action hooks index.html puts on the top bar
[['saveLed', 'save-state'], ['undoBtn', 'undo'], ['keysBtn', 'show-keys'], ['userBtn', 'user-menu'], ['navCollapse', 'nav-collapse']]
  .forEach(p => { doc.getElementById(p[0]).dataset.action = p[1]; });
doc.getElementById('undoBtn').hidden = true;
doc.getElementById('gate').hidden = true;
doc.getElementById('shell').hidden = true;
// the search box is an <input> inside .search in index.html
const search = doc.getElementById('search');
const searchWrap = new El('div'); searchWrap.setAttribute('class', 'search');
doc.body.removeChild(search); searchWrap.appendChild(search); doc.body.appendChild(searchWrap);

let failures = 0, passed = 0;
function check(name, cond, detail) {
  if (cond) passed++; else { failures++; console.log('FAIL', name, detail !== undefined ? '-> ' + detail : ''); }
}
let rejections = 0;
process.on('unhandledRejection', e => { rejections++; console.log('UNHANDLED', e && e.stack || e); });
const errors = [];
const realError = console.error;
console.error = (...a) => { errors.push(a.map(String).join(' ')); };

const ctx = vm.createContext(win);
['js/config.js', 'js/domain.js', 'js/adapters/storage-folder.js', 'js/seed.js', 'js/store.js', 'js/identity.js',
 'js/ui/core.js', 'js/ui/components.js', 'js/ui/glyphs.js', 'js/ui/heatmap.js', 'js/ui/overlays.js', 'js/ui/charts.js',
 'js/views/lab.js', 'js/views/settings.js', 'js/views/settings-health.js', 'js/views/settings-users.js',
 'js/views/settings-tools.js', 'js/views/settings-lists.js', 'js/views/settings-calendar.js', 'js/views/settings-audit.js',
 'js/views/settings-data.js', 'js/views/help.js', 'js/app.js', 'tests/memory-storage.js'
].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

const MRT = win.MRT;
const folder = MRT.adapters.storageMemory({});
MRT.adapters.storageFolder = folder;          // the app talks to the memory folder

/** Let promises, timers and the PIN hashing (off-thread in Node) finish. */
async function settle() {
  for (let i = 0; i < 15; i++) { await new Promise(r => setTimeout(r, 2)); flush(); }
}
const $ = sel => doc.querySelector(sel);
const $$ = sel => doc.querySelectorAll(sel);
const text = id => doc.getElementById(id).textContent;
const visible = id => !doc.getElementById(id).hidden;
function gateInputs() { return doc.getElementById('gateCard').querySelectorAll('input'); }
function submitGate() { doc.getElementById('gateCard').querySelector('form').dispatch('submit'); }
function action(name) { const b = new El('button'); b.dataset.action = name; doc.body.appendChild(b); b.click(); doc.body.removeChild(b); }
function buttonByText(root, t) { return root.querySelectorAll('button').filter(b => b.textContent.trim() === t)[0]; }

(async function run() {
  MRT.app.boot();
  await settle();

  // --- first run: the launcher's ID is picked up and taken out of the address
  check('first run shows "Set up the app"', visible('gate') && /Set up the app/.test(text('gateCard')), text('gateCard').slice(0, 80));
  check('?who= is removed from the address bar', win.location.search === '', win.location.search);
  check('the identity is remembered on this PC', /pkhurana/.test(storage['mrt.identity'] || ''));
  let inp = gateInputs();
  check('five fields: name, Windows ID, email, PIN, PIN again', inp.length === 5, inp.length);
  check('Windows ID prefilled from the launcher', inp[1].value === 'CORP\\pkhurana', inp[1].value);
  inp[0].value = 'Prince Khurana'; inp[3].value = '2468'; inp[4].value = '2469';
  submitGate(); await settle();
  check('different PINs are refused at the field', /not the same/.test(text('gateCard')) && !visible('shell'));
  inp[4].value = '2468';
  submitGate(); await settle();
  check('set up: the shell opens', visible('shell') && !visible('gate'));
  check('one user, an Admin', MRT.store.data().users.length === 1 && MRT.store.currentUser().roles[0] === 'admin');
  check('the file was saved', JSON.parse(folder.files['mrt_data.json']).revision === 1);
  check('the top bar shows the name', text('userName') === 'Prince Khurana');
  check('milestone tag M1', text('brandVer') === 'M1');

  // --- the side menu (M1-6)
  const items = doc.getElementById('navItems').children;
  check('nine menu entries', items.length === 9, items.length);
  check('three live: Lab status, Settings, Help', items.filter(i => i.tagName === 'A').map(i => i.dataset.route).join() === 'lab,settings,help');
  check('six greyed with their milestone', items.filter(i => i.classList.contains('is-soon')).map(i => i.textContent.slice(-2)).join() === 'M3,M3,M2,M2,M3,M5');
  check('greyed entries are announced as unavailable', items.filter(i => i.getAttribute('aria-disabled') === 'true').length === 6);

  // --- Lab status
  check('start page is Lab status', win.location.hash === '#/lab', win.location.hash);
  check('five tool plates', $$('.tool-plate').length === 5, $$('.tool-plate').length);
  check('each plate draws its tool glyph', $$('.tool-plate').filter(p => p.querySelector('svg.tool-glyph')).length === 5);
  check('an admin may set every status', doc.getElementById('main').querySelectorAll('button').filter(b => /Set status/.test(b.textContent)).length === 5);
  check('sample entries are flagged', $$('.tool-plate-sample').length === 5);

  // --- a page still to come
  win.setHash('#/queue'); await settle();
  check('#/queue says it comes in M3', /My queue comes in M3/.test(text('main')), text('main').slice(0, 80));
  win.setHash('#/settings'); await settle();
  check('Settings opens (placeholder until step 4)', /Settings/.test(text('main')));

  // --- search
  search.value = 'prf'; search.dispatch('input'); await settle();
  check('search finds PRF and its types', $$('.search-hit').length >= 2, $$('.search-hit').length);
  search.value = 'khurana'; search.dispatch('input'); await settle();
  check('search finds people', $$('.search-hit').some(h => /Person/.test(h.textContent)));
  search.value = 'zzzz'; search.dispatch('input'); await settle();
  check('search says when nothing matches', /Nothing matches/.test($('.search-results').textContent));

  // --- tool status + Undo
  win.setHash('#/lab'); await settle();
  const fibPlate = $$('.tool-plate').filter(p => /FIB/.test(p.textContent))[0];
  buttonByText(fibPlate, 'Set status').click(); await settle();
  const dlg = doc.getElementById('dialogHost').querySelector('dialog');
  check('the status dialog opens', !!dlg && dlg.open);
  const maint = dlg.querySelectorAll('input').filter(i => i.getAttribute('value') === 'maintenance')[0];
  maint.checked = true; maint.dispatch('change');
  const until = dlg.querySelectorAll('input').filter(i => i.getAttribute('type') === 'date')[0];
  until.value = '2026-10-02';
  buttonByText(dlg, 'Save').click(); await settle();
  const fib = () => MRT.store.data().tools.filter(t => t.code === 'FIB')[0];
  check('FIB is in Maintenance until 2 Oct', fib().status === 'maintenance' && fib().status_until === '2026-10-02', fib().status + ' ' + fib().status_until);
  check('the page shows it', /Maintenance/.test($$('.tool-plate').filter(p => /FIB/.test(p.textContent))[0].textContent));
  check('Undo appears', visible('undoBtn'));
  doc.getElementById('undoBtn').click(); await settle();
  check('Undo puts FIB back Up', fib().status === 'up');

  // --- user menu, shortcuts, collapsing the menu
  doc.getElementById('userBtn').click(); await settle();
  const menu = doc.body.querySelector('.menu');
  check('the user menu opens with theme, start page and Change user', !!menu && /Theme/.test(menu.textContent) && /Start page/.test(menu.textContent) && /Change user/.test(menu.textContent));
  check('...and shows the roles', !!menu && /Admin/.test(menu.textContent));
  const light = menu.querySelectorAll('input').filter(i => i.getAttribute('value') === 'light')[0];
  light.checked = true; light.dispatch('change');
  check('the theme switches and is remembered per user', doc.documentElement.getAttribute('data-theme') === 'light' &&
        storage['mrt.theme.' + MRT.store.currentUser().id] === 'light');
  doc.dispatch('keydown', { key: 'Escape', target: doc.body });
  doc.getElementById('keysBtn').click(); await settle();
  const keys = doc.getElementById('dialogHost').querySelectorAll('dialog').filter(d => d.open).slice(-1)[0];
  check('the shortcut list opens and lists only live pages', !!keys && /Lab status/.test(keys.textContent) && !/My queue/.test(keys.textContent));
  if (keys) { buttonByText(keys, 'Close').click(); await settle(); }
  doc.dispatch('keydown', { key: '[', target: doc.body });
  check('[ collapses the side menu', doc.documentElement.getAttribute('data-nav') === 'collapsed');
  doc.dispatch('keydown', { key: '[', target: doc.body });
  doc.dispatch('keydown', { key: 'g', target: doc.body }); doc.dispatch('keydown', { key: 'h', target: doc.body }); await settle();
  check('g h goes to Help', win.location.hash === '#/help');
  doc.dispatch('keydown', { key: 'g', target: doc.body }); doc.dispatch('keydown', { key: 'q', target: doc.body }); await settle();
  check('g q does nothing yet (My queue is M3)', win.location.hash === '#/help');
  win.setHash('#/lab'); await settle();

  // --- change user; an unknown Windows ID signs up
  action('change-user'); await settle();
  check('change user asks who you are', visible('gate') && /Who are you\?/.test(text('gateCard')));
  gateInputs()[0].value = 'thuber'; submitGate(); await settle();
  check('an unknown ID is asked for a name', /not known here yet/.test(text('gateCard')), text('gateCard').slice(0, 120));
  gateInputs()[0].value = 'Tom Huber'; submitGate(); await settle();
  check('Tom is in, as Engineer only', visible('shell') && MRT.store.currentUser().name === 'Tom Huber' && MRT.store.currentUser().roles.join() === 'engineer');
  check('...marked New for the admins', MRT.store.currentUser().needs_review === true);
  check('an engineer cannot set tool status', doc.getElementById('main').querySelectorAll('button').filter(b => /Set status/.test(b.textContent)).length === 0);

  // --- "Is this you?"
  action('change-user'); await settle();
  gateInputs()[0].value = 'thuber2'; submitGate(); await settle();
  gateInputs()[0].value = 'tom  HUBER'; submitGate(); await settle();
  check('a known name asks "Is this you?"', /Is this you\?/.test(text('gateCard')));
  check('...and shows Tom as already linked', /linked to another Windows ID/.test(text('gateCard')));
  buttonByText(doc.getElementById('gateCard'), 'Back').click(); await settle();
  check('Back returns to the name form', /not known here yet/.test(text('gateCard')));

  // --- back to Prince by typing the Windows ID
  action('change-user'); await settle();
  gateInputs()[0].value = 'pkhurana'; submitGate(); await settle();
  check('a known ID goes straight in', visible('shell') && MRT.store.currentUser().name === 'Prince Khurana');

  // --- Settings: PIN lock, then every tab (step 4)
  const openDialog = () => doc.getElementById('dialogHost').querySelectorAll('dialog').filter(d => d.open).slice(-1)[0];
  function fieldIn(root, label) {
    const f = root.querySelectorAll('.ifield').filter(x => (x.querySelector('.ifield-label') || { textContent: '' }).textContent.indexOf(label) === 0)[0];
    return f ? f.querySelector('input') || f.querySelector('select') || f.querySelector('textarea') : null;
  }
  function tickIn(root, label) { return root.querySelectorAll('label').filter(l => l.textContent.trim().indexOf(label) === 0).map(l => l.querySelector('input'))[0]; }
  function setVal(input, v) { input.value = v; input.dispatch('input'); input.dispatch('change'); }
  async function tab(key) { win.setHash('#/settings/' + key); await settle(); }
  const mainText = () => text('main');

  win.setHash('#/settings'); await settle();
  check('Settings asks for the PIN', /Admin area/.test(mainText()));
  let pinBox = fieldIn(doc.getElementById('main'), 'Admin PIN');
  pinBox.value = '1111'; doc.getElementById('main').querySelector('form').dispatch('submit'); await settle();
  check('a wrong PIN is refused', /Wrong PIN/.test(mainText()));
  pinBox.value = '2468'; doc.getElementById('main').querySelector('form').dispatch('submit'); await settle();
  check('the right PIN opens Health first', /Still to do before real use/.test(mainText()) && /Data health/.test(mainText()));
  check('...listing sample entries, missing quality engineers, the calendar', /still sample/.test(mainText()) && /FIB has no primary quality engineer/.test(mainText()) && /not confirmed/.test(mainText()));
  check('...with links to fix each', $$('#main a').filter(a => /^#\/settings\/tools/.test(a.getAttribute('href') || '')).length > 5);
  const todoBefore = MRT.store.health().todo.length;

  await tab('users');
  check('People lists Prince and Tom (New)', /Prince Khurana/.test(mainText()) && /Tom Huber/.test(mainText()) && /New/.test(mainText()));
  buttonByText(doc.getElementById('main'), 'Add person').click(); await settle();
  let dlg2 = openDialog();
  check('five roles to tick, Quality engineer among them', ['Engineer', 'Quality engineer', 'Operator', 'Manager', 'Admin'].every(r => !!tickIn(dlg2, r)));
  setVal(fieldIn(dlg2, 'Name'), 'Olga Quality'); setVal(fieldIn(dlg2, 'Windows user name'), 'olga');
  tickIn(dlg2, 'Engineer').checked = false; tickIn(dlg2, 'Quality engineer').checked = true;
  buttonByText(dlg2, 'Save').click(); await settle();
  const olga = MRT.store.data().users.filter(u => u.name === 'Olga Quality')[0];
  check('an admin adds Olga as Quality engineer', !!olga && olga.roles.join() === 'quality' && olga.windows_id === 'olga');
  buttonByText(doc.getElementById('main'), 'Reviewed').click(); await settle();
  check('Reviewed clears Tom\'s New mark', MRT.store.data().users.filter(u => u.name === 'Tom Huber')[0].needs_review === false);

  await tab('tools');
  check('Tools lists all five', ['HRM', 'AOI', 'PRF', 'QVM', 'FIB'].every(c => mainText().indexOf(c) !== -1));
  const fibRow = doc.getElementById('main').querySelectorAll('tr').filter(r => /FIB/.test(r.textContent) && r.querySelector('button'))[0];
  fibRow.querySelectorAll('button').filter(b => /Edit FIB/.test(b.getAttribute('aria-label') || ''))[0].click(); await settle();
  dlg2 = openDialog();
  check('only quality engineers are offered as primary', fieldIn(dlg2, 'Primary quality engineer').querySelectorAll('option').map(o => o.textContent).join() === '- none -,Olga Quality');
  setVal(fieldIn(dlg2, 'Primary quality engineer'), olga.id);
  setVal(fieldIn(dlg2, 'Results root folder'), 'results');
  buttonByText(dlg2, 'Save').click(); await settle();
  check('a bad results root keeps the dialog open with the reason', openDialog() === dlg2 && /share path/.test(dlg2.textContent));
  setVal(fieldIn(dlg2, 'Results root folder'), '\\\\srv\\lab\\FIB');
  buttonByText(dlg2, 'Save').click(); await settle();
  check('FIB gets Olga and a results root', fib().primary_operator_id === olga.id && fib().results_root === '\\\\srv\\lab\\FIB');

  // the FIB setup below the tool list: pick FIB
  const fibOpt = doc.getElementById('main').querySelectorAll('input').filter(i => i.getAttribute('value') === fib().id)[0];
  fibOpt.checked = true; fibOpt.dispatch('change'); await settle();
  check('FIB\'s types, fields and BKMs are shown', /Measurement types - FIB/.test(mainText()) && /Extra fields - FIB/.test(mainText()) && /BKM library - FIB/.test(mainText()));
  const viaType = MRT.store.data().measurement_types.filter(m => m.name === 'Via cross-section')[0];
  doc.getElementById('main').querySelectorAll('button').filter(b => b.getAttribute('aria-label') === 'Edit Via cross-section')[0].click(); await settle();
  dlg2 = openDialog();
  check('a sample type explains how to confirm it', /Save it - changed or not/.test(dlg2.textContent));
  buttonByText(dlg2, 'Save').click(); await settle();
  check('saving it unchanged confirms it as real', MRT.store.byId('measurement_types', viaType.id).sample === false);
  doc.getElementById('main').querySelectorAll('button').filter(b => b.getAttribute('aria-label') === 'Delete Via cross-section')[0].click(); await settle();
  check('a used type cannot be deleted - and says why', /Cannot delete/.test(openDialog().textContent) && /1 BKM/.test(openDialog().textContent));
  buttonByText(openDialog(), 'Close').click(); await settle();

  buttonByText(doc.getElementById('main'), 'Add field').click(); await settle();
  dlg2 = openDialog();
  setVal(fieldIn(dlg2, 'Label'), 'Cut side');
  setVal(fieldIn(dlg2, 'Type'), 'choice');
  setVal(fieldIn(dlg2, 'Choices'), 'Front\nBack\n\nEdge');
  buttonByText(dlg2, 'Save').click(); await settle();
  const cut = MRT.store.data().tool_fields.filter(f => f.label === 'Cut side')[0];
  check('a choice field with three choices is added to FIB', !!cut && cut.tool_id === fib().id && cut.choices.map(c => c.label).join() === 'Front,Back,Edge');

  buttonByText(doc.getElementById('main'), 'Add BKM').click(); await settle();
  dlg2 = openDialog();
  setVal(fieldIn(dlg2, 'Name'), 'FIB lamella BKM'); setVal(fieldIn(dlg2, 'Path on the share'), 'bkm.pdf');
  buttonByText(dlg2, 'Save').click(); await settle();
  check('a BKM without a share path is refused in the dialog', openDialog() === dlg2 && /share path/.test(dlg2.textContent));
  setVal(fieldIn(dlg2, 'Path on the share'), 'Z:\\BKM\\FIB\\lamella.pdf');
  buttonByText(dlg2, 'Save').click(); await settle();
  check('...a real path is accepted', MRT.store.data().bkms.some(b => b.name === 'FIB lamella BKM' && !b.sample));
  doc.getElementById('main').querySelectorAll('button').filter(b => b.getAttribute('aria-label') === 'Copy BKM path')[0].click(); await settle();
  check('Copy puts a BKM path on the clipboard', /SAMPLE-SHARE|Z:/.test(win.navigator.clipboard.text || ''));

  await tab('lists');
  buttonByText(doc.getElementById('main').querySelectorAll('section')[0], 'Add').click(); await settle();
  dlg2 = openDialog(); setVal(fieldIn(dlg2, 'Code'), 'nova'); buttonByText(dlg2, 'Save').click(); await settle();
  check('a project is added, code in capitals', MRT.store.list('projects').some(p => p.code === 'NOVA'));
  doc.getElementById('main').querySelectorAll('button').filter(b => b.getAttribute('aria-label') === 'Edit NOVA')[0].click(); await settle();
  dlg2 = openDialog(); buttonByText(dlg2, 'Save').click(); await settle();
  check('saving unchanged closes quietly (no error in a dialog)', !openDialog() && !/could not|Could not/.test(text('toasts')));

  await tab('calendar');
  check('the calendar says it is not confirmed', /Not confirmed yet/.test(mainText()));
  buttonByText(doc.getElementById('main'), 'These are right').click(); await settle();
  check('"These are right" confirms it', MRT.store.getSetting('calendar_confirmed') === true && !/Not confirmed yet/.test(mainText()));
  buttonByText(doc.getElementById('main'), 'Add closing day').click(); await settle();
  dlg2 = openDialog(); setVal(fieldIn(dlg2, 'Date'), '2026-12-24'); setVal(fieldIn(dlg2, 'Name'), 'Christmas Eve');
  buttonByText(dlg2, 'Save').click(); await settle();
  check('a closing day is added', MRT.store.data().holidays.some(h => h.date === '2026-12-24' && h.kind === 'closing'));

  await tab('health');
  check('the to-do list got shorter', MRT.store.health().todo.length < todoBefore, todoBefore + ' -> ' + MRT.store.health().todo.length);

  await tab('audit');
  check('the audit log shows the changes', /Christmas Eve/.test(mainText()) && /Olga Quality/.test(mainText()));
  const af = fieldIn(doc.getElementById('main'), 'Filter'); setVal(af, 'nova'); await settle();
  check('...and filters', /1 match/.test(mainText()));

  await tab('data');
  check('Data & PIN shows the file and today\'s backup', /mrt_data.json/.test(mainText()) && /latest/.test(mainText()));
  buttonByText(doc.getElementById('main'), 'Download a copy now').click(); await settle();

  // a non-admin is kept out
  const saved = MRT.store.currentUser().id;
  MRT.store.setCurrentUser(MRT.store.data().users.filter(u => u.name === 'Tom Huber')[0].id);
  win.setHash('#/settings/users'); await settle();
  check('Settings are closed to engineers', /Settings are for admins/.test(mainText()) && /Prince Khurana/.test(mainText()));
  MRT.store.setCurrentUser(saved);

  // Change data folder (user menu)
  win.setHash('#/lab'); await settle();
  doc.getElementById('userBtn').click(); await settle();
  buttonByText(doc.body.querySelector('.menu'), 'Change data folder').click(); await settle();
  check('Change data folder reconnects and signs in again', visible('shell') && MRT.store.currentUser().name === 'Prince Khurana');

  // --- a failed save: the lamp and a toast with Retry
  folder.failWrites = true;
  await MRT.store.setToolStatus({ tool_id: fib().id, status: 'down' }).catch(() => {});
  await settle();
  check('a failed save turns the lamp red', doc.getElementById('saveLed').classList.contains('failed'));
  const toast = doc.getElementById('toasts').children.filter(t => /could not be saved/.test(t.textContent)).slice(-1)[0];
  check('...and says so with Retry', !!toast && /Retry/.test(toast.textContent));
  folder.failWrites = false;
  buttonByText(toast, 'Retry').click(); await settle();
  check('Retry saves it', JSON.parse(folder.files['mrt_data.json']).tools.filter(t => t.code === 'FIB')[0].status === 'down');

  // --- someone else saves: the banner offers Reload
  const f = JSON.parse(folder.files['mrt_data.json']); f.revision += 3; folder.files['mrt_data.json'] = JSON.stringify(f);
  tick(); await settle();
  check('a newer file on the share shows the banner', visible('conflictBanner') && /Reload/.test(text('conflictBanner')));
  buttonByText(doc.getElementById('conflictBanner'), 'Reload').click(); await settle();
  check('Reload takes the new file', !visible('conflictBanner') && MRT.store.status().revision === f.revision);

  // --- nothing unexpected went wrong
  const unexpected = errors.filter(e => !/save failed|read-only/.test(e));
  check('no unexpected console errors', unexpected.length === 0, unexpected.join(' | ').slice(0, 300));
  check('no unhandled promise rejections', rejections === 0, rejections);

  console.error = realError;
  console.log(failures ? failures + ' of ' + (passed + failures) + ' APP CHECKS FAILED' : 'app smoke ok (' + passed + ' checks)');
  if (failures) process.exitCode = 1;
})().catch(e => { console.error = realError; console.log('CRASH', e.stack); process.exitCode = 1; });
