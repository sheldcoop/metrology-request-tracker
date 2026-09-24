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
 'js/ui/core.js', 'js/ui/components.js', 'js/ui/glyphs.js', 'js/ui/heatmap.js', 'js/ui/overlays.js', 'js/ui/charts.js', 'js/ui/panelmap.js',
 'js/views/lab.js', 'js/views/settings.js', 'js/views/settings-health.js', 'js/views/settings-users.js',
 'js/views/settings-tools.js', 'js/views/settings-lists.js', 'js/views/settings-lots.js', 'js/views/settings-calendar.js', 'js/views/settings-audit.js',
 'js/views/settings-data.js', 'js/views/extra-fields.js', 'js/views/lots.js', 'js/views/new.js', 'js/views/request-actions.js', 'js/views/request.js', 'js/views/queue.js', 'js/views/help.js', 'js/app.js', 'tests/memory-storage.js'
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
  check('six live: Lab status, My queue, New request, Lots, Settings, Help', items.filter(i => i.tagName === 'A').map(i => i.dataset.route).join() === 'lab,queue,new,lots,settings,help');
  check('three greyed with their milestone', items.filter(i => i.classList.contains('is-soon')).map(i => i.textContent.slice(-2)).join() === 'M3,M3,M5');
  check('greyed entries are announced as unavailable', items.filter(i => i.getAttribute('aria-disabled') === 'true').length === 3);

  // --- Lab status
  check('start page is Lab status', win.location.hash === '#/lab', win.location.hash);
  check('five tool plates', $$('.tool-plate').length === 5, $$('.tool-plate').length);
  check('each plate draws its tool glyph', $$('.tool-plate').filter(p => p.querySelector('svg.tool-glyph')).length === 5);
  check('an admin may set every status', doc.getElementById('main').querySelectorAll('button').filter(b => /Set status/.test(b.textContent)).length === 5);
  check('sample entries are flagged', $$('.tool-plate-sample').length === 5);

  // --- a page still to come
  win.setHash('#/board'); await settle();
  check('#/board says it comes in M3', /Board comes in M3/.test(text('main')), text('main').slice(0, 80));
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
  check('the shortcut list opens and lists only live pages', !!keys && /Lab status/.test(keys.textContent) && !/Board/.test(keys.textContent));
  if (keys) { buttonByText(keys, 'Close').click(); await settle(); }
  doc.dispatch('keydown', { key: '[', target: doc.body });
  check('[ collapses the side menu', doc.documentElement.getAttribute('data-nav') === 'collapsed');
  doc.dispatch('keydown', { key: '[', target: doc.body });
  doc.dispatch('keydown', { key: 'g', target: doc.body }); doc.dispatch('keydown', { key: 'h', target: doc.body }); await settle();
  check('g h goes to Help', win.location.hash === '#/help');
  doc.dispatch('keydown', { key: 'g', target: doc.body }); doc.dispatch('keydown', { key: 'b', target: doc.body }); await settle();
  check('g b does nothing yet (the board comes later in M3)', win.location.hash === '#/help');
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
  check('FIB is marked destructive (M2-11)', fib().destructive === true && /Destructive/.test(doc.getElementById('main').querySelectorAll('tr').filter(r => /FIB/.test(r.textContent))[0].textContent));

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
  const pnPanel = doc.getElementById('main').querySelectorAll('section').filter(x => /Part numbers/.test(x.textContent))[0];
  check('Lists has a Part numbers panel, empty at first', !!pnPanel && /None yet/.test(pnPanel.textContent));
  buttonByText(pnPanel, 'Add').click(); await settle();
  dlg2 = openDialog(); setVal(fieldIn(dlg2, 'Part number'), 'pn-77'); buttonByText(dlg2, 'Save').click(); await settle();
  check('a part number without a project is refused in the dialog', openDialog() === dlg2 && /at least one project/.test(dlg2.textContent));
  tickIn(dlg2, 'C4F').checked = true; tickIn(dlg2, 'NOVA').checked = true; buttonByText(dlg2, 'Save').click(); await settle();
  const pn77 = MRT.store.list('part_numbers').filter(x => x.code === 'PN-77')[0];
  check('...with two projects it is added (M1-13)', !!pn77 && pn77.project_ids.length === 2 && !openDialog());
  check('...and shown with its project codes', /PN-77/.test(mainText()) && /NOVA/.test(mainText()));
  const psPanel = doc.getElementById('main').querySelectorAll('section').filter(x => /Process steps/.test(x.textContent))[0];
  check('Lists has a Process steps panel (M2-7)', !!psPanel && /None yet/.test(psPanel.textContent));
  buttonByText(psPanel, 'Add').click(); await settle();
  dlg2 = openDialog(); setVal(fieldIn(dlg2, 'Name'), 'After desmear'); buttonByText(dlg2, 'Save').click(); await settle();
  check('...a step is added at position 1', MRT.store.list('process_steps').map(x => x.name + ':' + x.sort).join() === 'After desmear:1' && /After desmear/.test(mainText()));

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

  // --- Lots (M2-1)
  win.setHash('#/lots'); await settle();
  check('Lots is live, empty at first, with Register lot', /No lots yet/.test(mainText()) && !!buttonByText(doc.getElementById('main'), 'Register lot'));
  buttonByText(doc.getElementById('main'), 'Register lot').click(); await settle();
  dlg2 = openDialog();
  check('...the part number waits for the project', /pick the project first/.test(fieldIn(dlg2, 'Part number').textContent));
  check('...the lot fields are asked too (Purpose, Started on, Lot status ...)', !!fieldIn(dlg2, 'Purpose of the lot') && !!fieldIn(dlg2, 'Started on') && !!fieldIn(dlg2, 'Lot status'));
  setVal(fieldIn(dlg2, 'Lot number'), '18178-A'); buttonByText(dlg2, 'Save').click(); await settle();
  check('...a bad lot number is refused in the dialog', openDialog() === dlg2 && /split lot adds .01/.test(dlg2.textContent));
  const c4f = MRT.store.list('projects').filter(p => p.code === 'C4F')[0], bu1 = MRT.store.list('buildups')[0];
  setVal(fieldIn(dlg2, 'Lot number'), '18178'); setVal(fieldIn(dlg2, 'Panels'), '12');
  setVal(fieldIn(dlg2, 'Project'), c4f.id); await settle();
  check('...picking C4F offers its one part number, already picked', fieldIn(dlg2, 'Part number').value === pn77.id);
  setVal(fieldIn(dlg2, 'Build-up'), bu1.id);
  const purposeF = MRT.store.list('lot_fields').filter(f => f.label === 'Purpose of the lot')[0];
  setVal(fieldIn(dlg2, 'Purpose of the lot'), purposeF.choices[1].id);
  buttonByText(dlg2, 'Save').click(); await settle();
  const lot1 = (MRT.store.data().lots || []).filter(l => l.lot_number === '18178')[0];
  check('...lot 18178 is registered with project, part number, build-up, 12 panels, owner',
        !!lot1 && lot1.project_id === c4f.id && lot1.part_number_id === pn77.id && lot1.buildup_id === bu1.id && lot1.panel_count === 12 &&
        lot1.owner_id === MRT.store.currentUser().id && !openDialog());
  check('...and listed', /18178/.test(mainText()) && /PN-77/.test(mainText()) && /1 of 1 lots/.test(mainText()));
  check('...with its purpose (DOE) stored', lot1.extra[purposeF.id] === purposeF.choices[1].id);
  $$('#main a.lot-link').filter(a => a.textContent === '18178')[0].click(); await settle();
  check('the lot number opens all its details, lot fields included', !!openDialog() && /Purpose of the lot/.test(openDialog().textContent) && /DOE/.test(openDialog().textContent));
  buttonByText(openDialog(), 'Close').click(); await settle();
  buttonByText(doc.getElementById('main'), 'Register lot').click(); await settle();
  dlg2 = openDialog();
  setVal(fieldIn(dlg2, 'Lot number'), '18178'); setVal(fieldIn(dlg2, 'Panels'), '4');
  setVal(fieldIn(dlg2, 'Project'), c4f.id); setVal(fieldIn(dlg2, 'Build-up'), bu1.id);
  buttonByText(dlg2, 'Save').click(); await settle();
  check('...the same lot number twice is refused', openDialog() === dlg2 && /already registered/.test(dlg2.textContent));
  setVal(fieldIn(dlg2, 'Lot number'), '18178.01'); buttonByText(dlg2, 'Save').click(); await settle();
  check('...a split lot 18178.01 is fine', (MRT.store.data().lots || []).some(l => l.lot_number === '18178.01') && !openDialog());
  const sbox = doc.getElementById('search'); sbox.value = '18178.0'; sbox.dispatch('input'); await settle();
  check('the search finds lots', /Lot/.test(text('main') + doc.body.querySelector('.search-results').textContent) && /18178.01/.test(doc.body.querySelector('.search-results').textContent));
  sbox.value = ''; sbox.dispatch('input');
  const me0 = MRT.store.currentUser().id;
  MRT.store.setCurrentUser(MRT.store.data().users.filter(u => u.name === 'Tom Huber')[0].id);
  win.setHash('#/lab'); await settle(); win.setHash('#/lots'); await settle();
  check('an engineer sees the lots but cannot edit someone else\'s', /18178/.test(mainText()) && !doc.getElementById('main').querySelectorAll('button').some(b => /Edit lot/.test(b.getAttribute('aria-label') || '')));
  MRT.store.setCurrentUser(me0);
  await tab('data');
  buttonByText(doc.getElementById('main'), 'Add 3 sample lots').click(); await settle();
  check('Data: "Add 3 sample lots" adds 99901, 99902, 99902.01 tagged Sample', ['99901', '99902', '99902.01'].every(n => MRT.store.data().lots.some(l => l.lot_number === n && l.sample)));
  // --- New request (M2 step 4)
  win.setHash('#/new'); await settle();
  const toolOpt = code => $$('#main .tool-pick-opt').filter(b => b.textContent.indexOf(code) === 0)[0];
  check('New request shows the five tools as glyph buttons', $$('#main .tool-pick-opt').length === 5 && /Pick the tool first/.test(mainText()));
  buttonByText(doc.getElementById('main'), 'Submit').click(); await settle();
  check('Submit with nothing picked lists what is missing', !$('#main .req-errors').hidden && /Pick a tool/.test($('#main .req-errors').textContent));
  toolOpt('FIB').click(); await settle();
  check('picking FIB: its types, the destructive tick, afterwards fixed to scrap', !!fieldIn(doc.getElementById('main'), 'Measurement type') &&
        /destroys these panels/.test(mainText()) && fieldIn(doc.getElementById('main'), 'After measuring').value === 'scrap');
  check('...and its extra field (Cut side)', !!fieldIn(doc.getElementById('main'), 'Cut side'));
  setVal(fieldIn(doc.getElementById('main'), 'Measurement type'), MRT.store.list('measurement_types').filter(m => m.tool_id === fib().id)[0].id); await settle();
  setVal(fieldIn(doc.getElementById('main'), 'Lot'), lot1.id); await settle();
  check('picking the lot draws its panel map (12 panels)', $$('#main .pm-cell').length === 12 && /Project/.test($('#main .lot-info').textContent));
  $$('#main .pm-cell')[0].click(); $$('#main .pm-cell')[3].dispatch('click', { shiftKey: true }); await settle();
  check('...panels 1-4 picked, shown on the traveller preview', /1-4/.test($('#main .traveller-mini').textContent) && /FIB-YYMMDD-NN/.test($('#main .traveller-mini').textContent));
  buttonByText(doc.getElementById('main'), 'Submit').click(); await settle();
  const errs = $('#main .req-errors').textContent;
  check('...still missing: where the panels are, the destructive tick', /where the panels are now/.test(errs) && /tick that they may be scrapped/.test(errs) && !/Pick a tool/.test(errs));
  setVal(fieldIn(doc.getElementById('main'), 'Where are the panels now'), 'Magazine 14, rack B2');
  const dTick = tickIn(doc.getElementById('main'), 'I know FIB'); dTick.checked = true; dTick.dispatch('change');
  setVal(fieldIn(doc.getElementById('main'), 'Purpose'), 'Check voids after the new plating recipe');
  buttonByText(doc.getElementById('main'), 'Submit').click(); await settle();
  check('complete, but no BKM: a warning asks first (Q44)', !!openDialog() && /Submit anyway/.test(openDialog().textContent) && /No BKM/.test(openDialog().textContent));
  buttonByText(openDialog(), 'Submit anyway').click(); await settle();
  const req1 = MRT.store.data().requests.filter(r => r.status === 'submitted')[0];
  check('submitted: ID FIB-YYMMDD-01, panels, scrap, destructive ok', !!req1 && /^FIB-\d{6}-01$/.test(req1.request_no) && req1.panels.join() === '1,2,3,4' &&
        req1.after === 'scrap' && req1.destructive_ok === true && req1.panel_location === 'Magazine 14, rack B2');
  check('...its request page opens (M2 step 5)', win.location.hash === '#/request/' + req1.id && mainText().indexOf(req1.request_no) !== -1 && /Magazine 14/.test(mainText()));
  check('the traveller card: ID, stamp "Submitted", priority stripe, panel map with panels 1-4', !!$('#main .traveller.prio-3') &&
        $('#main .tr-stamp').textContent === 'Submitted' && $$('#main .traveller .pm-cell').length === 12 && $$('#main .traveller .pm-cell.is-picked').length === 4);
  check('...no date: "the priority says how urgent it is"', /priority says how urgent/.test($('#main .tr-clock').textContent));
  check('the status rail: Submitted now, by whom and when', $$('#main .rail-step').length === 4 && $('#main .rail-step.is-now').textContent.indexOf('Submitted') === 0 && /Prince Khurana/.test($('#main .rail-step.is-now').textContent));
  check('the results folder is proposed from the tool root (Q30)', mainText().indexOf('\\\\srv\\lab\\FIB\\') !== -1 && mainText().indexOf(req1.request_no + '\\') !== -1);
  setVal(fieldIn(doc.getElementById('main'), 'Add a comment'), 'Please cut near via 3, @olga');
  buttonByText(doc.getElementById('main'), 'Add comment').click(); await settle();
  const com = MRT.store.requestEvents(req1.id).filter(e => e.kind === 'comment')[0];
  check('a comment joins the timeline, @olga is found as a mention', !!com && com.mentions.length === 1 && $$('#main .tl-item').length === 3 && !!$('#main .mention'));
  const sbox2 = doc.getElementById('search'); sbox2.value = req1.request_no.slice(0, 8); sbox2.dispatch('input'); await settle();
  check('the search finds the request by (part of) its ID (Q41)', doc.body.querySelector('.search-results').textContent.indexOf(req1.request_no) !== -1);
  sbox2.value = ''; sbox2.dispatch('input');
  check('...and its timeline has "created", "submitted", then the comment', MRT.store.requestEvents(req1.id).map(e => e.kind + ':' + (e.to || '')).join() === 'created:draft,status:submitted,comment:');
  buttonByText(doc.getElementById('main'), 'Copy this request').click(); await settle();
  check('"Copy this request" prefills tool, lot and panels, not where the panels are', $$('#main .tool-pick-opt.is-on').length === 1 &&
        fieldIn(doc.getElementById('main'), 'Lot').value === lot1.id && $$('#main .pm-cell.is-picked').length === 4 && fieldIn(doc.getElementById('main'), 'Where are the panels now').value === '');
  win.setHash('#/new'); await settle();
  toolOpt('QVM').click(); await settle();
  buttonByText(doc.getElementById('main'), 'Save draft').click(); await settle();
  const draft1 = MRT.store.data().requests.filter(r => r.status === 'draft')[0];
  check('Save draft needs only the tool, and opens the draft', !!draft1 && win.location.hash === '#/new/' + draft1.id && /Draft/.test(mainText()));
  check('...listed under your drafts', /QVM draft/.test($('#main .req-side').textContent));
  MRT.store.setCurrentUser(MRT.store.data().users.filter(u => u.name === 'Tom Huber')[0].id);
  win.setHash('#/new/' + draft1.id); await settle();
  check('someone else\'s draft stays private (Q33)', /not your draft/.test(mainText()) && MRT.store.visibleRequests().every(r => r.status !== 'draft'));
  MRT.store.setCurrentUser(me0);
  win.setHash('#/new/' + draft1.id); await settle();
  buttonByText(doc.getElementById('main'), 'Delete draft').click(); await settle();
  buttonByText(openDialog(), 'Delete').click(); await settle();
  check('the author deletes the draft', !MRT.store.data().requests.some(r => r.id === draft1.id));
  win.setHash('#/request/' + req1.id); await settle();
  buttonByText(doc.getElementById('main'), 'Cancel request').click(); await settle();
  const rdlg = openDialog(); setVal(rdlg.querySelector('textarea') || rdlg.querySelector('input'), 'Wrong lot');
  buttonByText(rdlg, 'Cancel request').click(); await settle();
  check('the requester cancels with a reason (Q35): stamp Cancelled, rail shows it, never deleted',
        MRT.store.byId('requests', req1.id).status === 'cancelled' && $('#main .tr-stamp').textContent === 'Cancelled' && !!$('#main .rail-side') && /Wrong lot/.test(mainText()));

  // --- the workflow on the request page (M3 step 1)
  buttonByText(doc.getElementById('main'), 'Copy this request').click(); await settle();
  setVal(fieldIn(doc.getElementById('main'), 'Where are the panels now'), 'Magazine 15');
  const dT2 = tickIn(doc.getElementById('main'), 'I know FIB'); dT2.checked = true; dT2.dispatch('change');
  buttonByText(doc.getElementById('main'), 'Submit').click(); await settle();
  if (openDialog()) { buttonByText(openDialog(), 'Submit anyway').click(); await settle(); }
  const req2 = MRT.store.data().requests.filter(r => r.status === 'submitted').slice(-1)[0];
  check('a second FIB request gets -02 and is assigned to Olga (primary, M3-7)', /-02$/.test(req2.request_no) && req2.assigned_to === olga.id && /Olga Quality/.test(mainText()));
  check('...the requester sees Edit request', !!buttonByText(doc.getElementById('main'), 'Edit request'));
  buttonByText(doc.getElementById('main'), 'Edit request').click(); await settle();
  check('Edit request opens the form, tool locked', mainText().indexOf('Edit ' + req2.request_no) !== -1 && $$('#main .tool-pick-opt').filter(b => b.disabled).length === 4);
  setVal(fieldIn(doc.getElementById('main'), 'Layer'), 'L2');
  buttonByText(doc.getElementById('main'), 'Save changes').click(); await settle();
  const edlg = openDialog(); setVal(edlg.querySelector('textarea') || edlg.querySelector('input'), 'Layer was missing');
  buttonByText(edlg, 'Save changes').click(); await settle();
  check('...saved with a reason, the timeline says what changed', MRT.store.byId('requests', req2.id).layer === 'L2' && /layer - -> L2\. Reason: Layer was missing/.test(mainText()));
  const meP = MRT.store.currentUser().id;
  MRT.store.setCurrentUser(olga.id); win.setHash('#/lab'); await settle(); win.setHash('#/request/' + req2.id); await settle();
  check('Olga sees Accept, Start, Hold, Needs clarification, Panels received', ['Accept', 'Start', 'Hold', 'Needs clarification', 'Panels received'].every(t => !!buttonByText($('#main .req-actbar'), t)));
  buttonByText($('#main .req-actbar'), 'Accept').click(); await settle();
  setVal(fieldIn(openDialog(), 'Expected done'), '2030-01-10'); buttonByText(openDialog(), 'Save').click(); await settle();
  check('Accept with an expected done date: stamp Accepted, date on the card', MRT.store.byId('requests', req2.id).status === 'accepted' && $('#main .tr-stamp').textContent === 'Accepted' && /Expected done/.test($('#main .traveller').textContent));
  buttonByText($('#main .req-actbar'), 'Start').click(); await settle();
  check('Start asks "Panels received?" once, ticked (M3-3)', !!openDialog() && tickIn(openDialog(), 'Panels received').checked === true);
  setVal(fieldIn(openDialog(), 'Kept where'), 'FIB cabinet'); buttonByText(openDialog(), 'Save').click(); await settle();
  const r2 = MRT.store.byId('requests', req2.id);
  check('...In progress, panels received with the place', r2.status === 'in_progress' && r2.received_where === 'FIB cabinet' && /FIB cabinet/.test($('#main .traveller').textContent));
  buttonByText($('#main .req-actbar'), 'Complete').click(); await settle();
  check('Complete: results folder proposed, panels Scrapped for FIB (M3-6)', /\\\\srv\\lab\\FIB\\/.test(fieldIn(openDialog(), 'Results folder').value) && fieldIn(openDialog(), 'The panels').value === 'scrapped');
  buttonByText(openDialog(), 'Save').click(); await settle();
  check('...Completed, the results path shown with Copy', MRT.store.byId('requests', req2.id).status === 'completed' && $('#main .tr-stamp').textContent === 'Completed' &&
        !!$$('#main button').filter(b => b.getAttribute('aria-label') === 'Copy Results path')[0]);
  MRT.store.setCurrentUser(meP); win.setHash('#/lab'); await settle(); win.setHash('#/request/' + req2.id); await settle();
  check('the requester now sees Results OK and Reopen (Q34)', !!buttonByText($('#main .req-actbar'), 'Results OK') && !!buttonByText($('#main .req-actbar'), 'Reopen'));
  buttonByText($('#main .req-actbar'), 'Results OK').click(); await settle();
  check('...Results OK: stamp Closed', $('#main .tr-stamp').textContent === 'Closed' && !$('#main .req-actbar'));

  // --- My queue (M3 step 2)
  const fibType = MRT.store.list('measurement_types').filter(m => m.tool_id === fib().id)[0].id;
  const prioBy = code => MRT.store.list('priorities').filter(p => p.code === code)[0].id;
  const base = { tool_id: fib().id, type_id: fibType, lot_id: lot1.id, panel_location: 'Rack A', destructive_ok: true, after: 'scrap', purpose: 'x' };
  const qN = await MRT.store.submitRequest({ fields: Object.assign({}, base, { panels: [5], priority_id: prioBy('P3') }) });
  const qL = await MRT.store.submitRequest({ fields: Object.assign({}, base, { panels: [6], priority_id: prioBy('P1'), priority_reason: 'line 2 down' }) });
  MRT.store.setCurrentUser(olga.id); win.setHash('#/lab'); await settle(); win.setHash('#/queue'); await settle();
  const qRows = $$('#main .q-row');
  check('My queue: Olga\'s FIB requests, the Line stop on top (M2-5)', qRows.length === 2 && qRows[0].textContent.indexOf(qL.request_no) !== -1 && qRows[0].classList.contains('prio-1'));
  check('..."assigned to you" first, one-click Accept / Start on the row', /Assigned to you/.test(mainText()) && !!buttonByText(qRows[0], 'Accept') && !!buttonByText(qRows[0], 'Start'));
  qRows.forEach(tr => { const cb = tr.querySelector('input'); cb.checked = true; cb.dispatch('change'); });
  await settle();
  check('...ticking two offers Accept all (2)', !!buttonByText($('#main .queue-bulk'), 'Accept all (2)'));
  buttonByText($('#main .queue-bulk'), 'Accept all (2)').click(); await settle(); await settle();
  check('...Accept all accepts both', [qN.id, qL.id].every(id => MRT.store.byId('requests', id).status === 'accepted'));
  MRT.store.setCurrentUser(meP);

  win.setHash('#/lots'); await settle();
  check('...shown on Lots with the Sample tag', /99902.01/.test(mainText()) && $$('#main .sample-tag').length === 3);
  await tab('lots');
  check('Settings > Lots: the same list as the Lots page', /18178.01/.test(mainText()) && /99902.01/.test(mainText()) && /same list as the/.test(mainText()));
  buttonByText(doc.getElementById('main'), 'Add several lots').click(); await settle();
  dlg2 = openDialog();
  setVal(fieldIn(dlg2, 'Lot numbers'), '30001-30003'); setVal(fieldIn(dlg2, 'Panels (each lot)'), '6');
  setVal(fieldIn(dlg2, 'Project'), c4f.id); await settle(); setVal(fieldIn(dlg2, 'Build-up'), bu1.id);
  buttonByText(dlg2, 'Add lots').click(); await settle();
  check('..."Add several lots" adds 30001-30003 with 6 panels each', ['30001', '30002', '30003'].every(n => MRT.store.data().lots.some(l => l.lot_number === n && l.panel_count === 6)) && !openDialog());
  win.setHash('#/lots'); await settle();
  check('...and they show on the Lots page too', /30002/.test(mainText()));

  // a non-admin is kept out
  const saved = MRT.store.currentUser().id;
  MRT.store.setCurrentUser(MRT.store.data().users.filter(u => u.name === 'Tom Huber')[0].id);
  win.setHash('#/settings/users'); await settle();
  check('Settings are closed to engineers', /Settings are for admins/.test(mainText()) && /Prince Khurana/.test(mainText()));
  MRT.store.setCurrentUser(saved);

  // Away (M1-14): an admin for someone else in People, then yourself in the user menu
  await tab('users');
  doc.getElementById('main').querySelectorAll('button').filter(b => b.getAttribute('aria-label') === 'Away: Olga Quality')[0].click(); await settle();
  dlg2 = openDialog();
  check('People: the away dialog starts today, no reason field', !!dlg2 && !!fieldIn(dlg2, 'First day away').value && !fieldIn(dlg2, 'Reason'));
  setVal(fieldIn(dlg2, 'Last day away'), '2000-01-01'); buttonByText(dlg2, 'Save').click(); await settle();
  check('...a last day before the first stays open with the reason', openDialog() === dlg2 && /before the first/.test(dlg2.textContent));
  const todayYmd = fieldIn(dlg2, 'First day away').value;
  setVal(fieldIn(dlg2, 'Last day away'), todayYmd); setVal(fieldIn(dlg2, 'Note'), 'Tom covers FIB');
  buttonByText(dlg2, 'Save').click(); await settle();
  const olgaNow = MRT.store.data().users.filter(u => u.name === 'Olga Quality')[0];
  check('...an admin sets Olga away for today', !openDialog() && olgaNow.away_from === todayYmd && olgaNow.away_until === todayYmd && olgaNow.away_note === 'Tom covers FIB');
  check('...People shows it', /Away on /.test(mainText()));
  win.setHash('#/lab'); await settle();
  check('Lab status marks the FIB primary as away', /Away until/.test($$('.tool-plate').filter(p => /FIB/.test(p.textContent))[0].textContent));
  doc.getElementById('userBtn').click(); await settle();
  buttonByText(doc.body.querySelector('.menu'), 'I\'m away...').click(); await settle();
  dlg2 = openDialog(); buttonByText(dlg2, 'Save').click(); await settle();
  check('user menu: "I\'m away..." saves your own away dates', !!MRT.store.currentUser().away_from && !MRT.store.currentUser().away_until);
  doc.getElementById('userBtn').click(); await settle();
  const awayItem = doc.body.querySelector('.menu').querySelectorAll('button').filter(b => /^Away from/.test(b.textContent.trim()))[0];
  check('...the menu then says so', !!awayItem);
  awayItem.click(); await settle();
  dlg2 = openDialog(); buttonByText(dlg2, 'I\'m back').click(); await settle();
  check('..."I\'m back" clears it', !openDialog() && !MRT.store.currentUser().away_from);

  // Change data folder (user menu)
  win.setHash('#/lab'); await settle();
  doc.getElementById('userBtn').click(); await settle();
  buttonByText(doc.body.querySelector('.menu'), 'Change data folder').click(); await settle();
  check('Change data folder reconnects and signs in again', visible('shell') && MRT.store.currentUser().name === 'Prince Khurana');

  // --- Help (step 5)
  win.setHash('#/help'); await settle();
  const guides = $$('.help-guide');
  check('Help shows every guide, with a table of contents', guides.length === MRT.views.help.GUIDES.length && $('.help-toc').children.length === guides.length);
  check('...including the admin setup checklist', /Admin: setting up the office/.test(mainText()) && /These are right/.test(mainText()));
  check('...and the five roles', ['Engineer', 'Quality engineer', 'Operator', 'Manager', 'Admin'].every(r => $('.help-roles').textContent.indexOf(r) !== -1));
  const hs = $('.help-search'); hs.value = 'restore'; hs.dispatch('input'); await settle();
  check('Help search narrows the guides', guides.filter(g => !g.hidden).length < guides.length && guides.filter(g => !g.hidden).length > 0);
  hs.value = 'zzzqqq'; hs.dispatch('input'); await settle();
  check('...and says when nothing is found', guides.every(g => g.hidden) && /Nothing found/.test(mainText()));
  win.setHash('#/help/admin-setup'); await settle();
  check('#/help/admin-setup opens that guide', $$('.help-guide').filter(g => g.classList.contains('is-selected')).map(g => g.id).join() === 'help-admin-setup');
  check('every guide link goes to a live page', $$('.help-open').every(a => !!MRT.views[(a.getAttribute('href') || '').replace(/^#\//, '').split('/')[0]]));

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
