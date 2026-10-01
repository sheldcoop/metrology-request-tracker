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

const IDS = ['gate', 'gateCard', 'shell', 'brandMark', 'saveLed', 'undoBtn', 'searchIcon', 'search',
  'bellBtn', 'bellIcon', 'bellCount', 'themeBtn', 'newBtn', 'userBtn', 'userAvatar', 'userName', 'userCaret', 'alertBanner', 'conflictBanner',
  'navItems', 'navFolder', 'navRev', 'navCollapse', 'main', 'toasts', 'dialogHost'];
const { win, doc, flush, tick, storage, El } = require('./fake-dom')({ ids: IDS, url: 'file:///Z:/Lab/MRT/index.html?who=ATS%5CPKhurana' });
// the data-action hooks index.html puts on the top bar
[['saveLed', 'save-state'], ['undoBtn', 'undo'], ['bellBtn', 'bell'], ['themeBtn', 'theme-menu'], ['userBtn', 'user-menu'], ['navCollapse', 'nav-collapse']]
  .forEach(p => { doc.getElementById(p[0]).dataset.action = p[1]; });
doc.getElementById('undoBtn').hidden = true;
doc.getElementById('newBtn').setAttribute('href', '#/new');   // static markup in index.html, like the data-actions below
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
['js/config.js', 'js/themes.js', 'js/domain.js', 'js/adapters/storage-folder.js', 'js/adapters/prf-folder.js', 'js/adapters/mail.js', 'js/seed.js', 'js/store.js', 'js/demo-data.js', 'js/identity.js', 'js/analytics.js',
 'js/ui/core.js', 'js/ui/components.js', 'js/ui/glyphs.js', 'js/ui/heatmap.js', 'js/ui/overlays.js', 'js/ui/chips.js', 'js/ui/charts.js', 'js/ui/panelmap.js', 'js/ui/barcode.js', 'js/ui/magazine.js', 'js/ui/traveller.js', 'js/ui/request-box.js', 'js/ui/hirata.js', 'js/ui/theme-gallery.js', 'js/ui/scene3d.js',
    'js/ui/scenes/aoi.js', 'js/ui/scenes/bars.js', 'js/ui/scenes/dice.js',
    'js/ui/scenes/new.js', 'js/ui/scenes/mine.js', 'js/ui/scenes/queue.js', 'js/ui/scenes/board.js', 'js/exporter.js',
 'js/views/lab.js', 'js/views/settings.js', 'js/views/settings-health.js', 'js/views/settings-users.js',
 'js/views/settings-tools.js', 'js/views/settings-lists.js', 'js/views/settings-lots.js', 'js/views/settings-calendar.js', 'js/views/settings-audit.js',
 'js/views/settings-data.js', 'js/views/settings-look.js', 'js/views/settings-emails.js', 'js/views/extra-fields.js', 'js/views/lots.js', 'js/views/new.js', 'js/views/request-actions.js', 'js/views/request.js', 'js/views/queue.js', 'js/views/requests.js', 'js/views/board.js', 'js/views/results.js', 'js/views/slip.js', 'js/views/templates.js', 'js/views/analytics.js', 'js/views/hirata.js', 'js/views/help.js', 'js/views/home.js', 'js/app.js', 'tests/memory-storage.js'
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
function openMore() { buttonByText($('#main .req-actbar'), '...').click(); }
function menuItem(t) { const m = doc.body.querySelector('.menu'); return m && buttonByText(m, t); }
async function closeMore() { if (doc.body.querySelector('.menu')) openMore(); await settle(); }

(async function run() {
  MRT.app.boot();
  await settle();

  // --- first run: the launcher's ID is picked up and taken out of the address
  check('first run shows "Set up the app"', visible('gate') && /Set up the app/.test(text('gateCard')), text('gateCard').slice(0, 80));
  check('?who= is removed from the address bar', win.location.search === '', win.location.search);
  check('the identity is remembered on this PC', /pkhurana/.test(storage['mrt.identity'] || ''));
  let inp = gateInputs();
  check('five fields: name, Windows ID, email, PIN, PIN again', inp.length === 5, inp.length);
  check('Windows ID prefilled from the launcher', inp[1].value === 'ATS\\pkhurana', inp[1].value);
  inp[0].value = 'Prince Khurana'; inp[3].value = '2468'; inp[4].value = '2469';
  submitGate(); await settle();
  check('different PINs are refused at the field', /not the same/.test(text('gateCard')) && !visible('shell'));
  inp[4].value = '2468';
  submitGate(); await settle();
  check('set up: the shell opens', visible('shell') && !visible('gate'));
  check('one user, an Admin', MRT.store.data().users.length === 1 && MRT.store.currentUser().roles[0] === 'admin');
  check('the file was saved', JSON.parse(folder.files['mrt_data.json']).revision === 1);
  check('the top bar shows the name', text('userName') === 'Prince Khurana');
  check('top bar has the mark, no milestone pill', !doc.getElementById('brandVer') && !!doc.getElementById('brandMark').querySelector('svg'));

  // --- the side menu (M1-6, grouped in Step 3)
  const items = doc.getElementById('navItems').querySelectorAll('.nav-item');
  check('twelve menu entries', items.length === 12, items.length);
  check('grouped order: Home | request pages | lab pages | Analytics | Settings, Help',
    items.map(i => i.dataset.route).join() === 'home,new,requests,queue,board,lab,lots,results,hirata,analytics,settings,help');
  check('thin dividers between the five groups', doc.getElementById('navItems').querySelectorAll('.nav-div').length === 4);
  check('nothing greyed any more', items.filter(i => i.classList.contains('is-soon') || i.getAttribute('aria-disabled') === 'true').length === 0);

  // --- Home is the start page (Step 9), Lab status one click away
  check('start page is Home', win.location.hash === '#/home', win.location.hash);
  check('Home opens with his doors', $$('#main .home-card').length > 0);
  win.setHash('#/lab'); await settle();
  check('five tool plates', $$('.tool-plate').length === 5, $$('.tool-plate').length);
  check('each plate draws its tool glyph', $$('.tool-plate').filter(p => p.querySelector('svg.tool-glyph')).length === 5);
  check('the destructive FIB plate draws the cut variant at base rate', (function () { var g = $$('.tool-plate').filter(p => /FIB/.test(p.textContent))[0].querySelector('svg.tool-glyph'); return g.dataset.glyph === 'fib-destructive' && g.style['--tx-rate'] === 1; })());
  check('an admin may set every status', doc.getElementById('main').querySelectorAll('button').filter(b => /Set status/.test(b.textContent)).length === 5);
  check('sample entries are flagged', $$('.tool-plate-sample').length === 5);

  // --- Analytics is live (M5); its own checks come later
  win.setHash('#/analytics'); await settle();
  check('#/analytics opens the Analytics page', /Analytics/.test(text('main')) && /Lab time/.test(text('main')), text('main').slice(0, 80));
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
  check('the user menu opens with theme, start page, Help and Sign out', !!menu && /Theme/.test(menu.textContent) && /Start page/.test(menu.textContent) && /Help/.test(menu.textContent) && /Sign out/.test(menu.textContent));
  check('...and shows the roles', !!menu && /Admin/.test(menu.textContent));
  buttonByText(menu, 'Theme: AT&S...').click(); await settle();
  const thDlg = doc.getElementById('dialogHost').querySelectorAll('dialog').filter(d => d.open).slice(-1)[0];
  const tcard = k => thDlg.querySelectorAll('.tg-card').filter(c => c.dataset.key === k)[0];
  check('Theme... opens the gallery: every theme of js/themes.js as a live sample, plus "Office default"',
        !!thDlg && thDlg.querySelectorAll('.tg-card').length === MRT.themes.list.length + 1 && thDlg.querySelectorAll('.tg-sample[data-theme="ats"]').length === 1);
  tcard('dark-teal').click();
  check('...a click switches at once (theme, scheme) and is remembered per user', doc.documentElement.getAttribute('data-theme') === 'dark-teal' &&
        doc.documentElement.getAttribute('data-scheme') === 'dark' && storage['mrt.theme.' + MRT.store.currentUser().id] === 'dark-teal' && storage['mrt.theme.last'] === 'dark-teal');
  tcard('pure-white').click();
  check('...Pure White (light)', doc.documentElement.getAttribute('data-theme') === 'pure-white' && doc.documentElement.getAttribute('data-scheme') === 'light' &&
        doc.documentElement.getAttribute('data-contrast') === 'normal');
  buttonByText(thDlg, 'Done').click(); await settle();
  doc.getElementById('userBtn').click(); await settle();
  const hcSw = doc.body.querySelector('.menu').querySelectorAll('label').filter(l => /High contrast/.test(l.textContent))[0].querySelector('input');
  hcSw.checked = true; hcSw.dispatch('change'); await settle();
  check('...High contrast works on top of any theme and is remembered per user', doc.documentElement.getAttribute('data-contrast') === 'high' &&
        doc.documentElement.getAttribute('data-theme') === 'pure-white' && storage['mrt.contrast.' + MRT.store.currentUser().id] === 'high');
  hcSw.checked = false; hcSw.dispatch('change'); await settle();
  check('...switching it back off restores normal contrast', doc.documentElement.getAttribute('data-contrast') === 'normal');
  doc.getElementById('userBtn').click(); await settle();
  doc.getElementById('themeBtn').click(); await settle();
  const tmMenu = doc.body.querySelector('.menu');
  const tcard2 = k => (tmMenu.querySelectorAll('.tg-card').filter(c => c.dataset.key === k))[0];
  check('the topbar theme button opens a compact gallery: one card per theme, keyboard roles, no Office default',
        !!tmMenu && tmMenu.querySelectorAll('.tg-card').length === MRT.themes.list.length &&
        tmMenu.querySelectorAll('.tg-card[role="radio"]').length === MRT.themes.list.length && !tcard2(''));
  check('...the current theme is marked', !!tmMenu.querySelector('.tg-card.is-on') &&
        tmMenu.querySelector('.tg-card.is-on').dataset.key === 'pure-white');
  tcard2('slate').click(); await settle();
  check('...one click switches at once and is remembered per user', doc.documentElement.getAttribute('data-theme') === 'slate' &&
        storage['mrt.theme.' + MRT.store.currentUser().id] === 'slate');
  tcard2('pure-white').click(); await settle();
  check('...every theme is one click away, no cycling', doc.documentElement.getAttribute('data-theme') === 'pure-white');
  doc.getElementById('themeBtn').click(); await settle();
  check('...clicking the button again closes it', !doc.body.querySelector('.menu'));
  win.setHash('#/home'); await settle();
  const homeCards = doc.getElementById('main').querySelectorAll('.home-card').map(c => c.getAttribute('href'));
  check('Home shows his doors (no queue/board/analytics without those roles)',
        homeCards.join() === '#/new,#/requests,#/lab,#/lots,#/help,#/settings', homeCards.join());
  check('...each card has an icon, a line and a live count', homeCards.length > 0 && doc.getElementById('main').querySelectorAll('.home-card')
        .every(c => !!c.querySelector('svg') && /^\d+$/.test(c.querySelector('.home-n').querySelector('b').textContent)));
  check('...the + New button links to New request', doc.getElementById('newBtn').getAttribute('href') === '#/new' && !doc.getElementById('newBtn').hidden);
  check('...hover engine falls back to static where WebGL is missing', doc.getElementById('main').querySelectorAll('.home-card[data-scene]').length > 0 &&
        doc.getElementById('main').querySelectorAll('.home-card canvas').length === 0);
  win.setHash('#/lab'); await settle();
  doc.dispatch('keydown', { key: 'Escape', target: doc.body });
  doc.getElementById('userBtn').click(); await settle();
  doc.body.querySelector('.menu').querySelectorAll('button').filter(b => /Keyboard shortcuts/.test(b.textContent))[0].click(); await settle();
  const keys = doc.getElementById('dialogHost').querySelectorAll('dialog').filter(d => d.open).slice(-1)[0];
  check('the shortcut list opens from the user menu and lists only live pages', !!keys && /Lab status/.test(keys.textContent) && /Analytics/.test(keys.textContent));
  if (keys) { buttonByText(keys, 'Close').click(); await settle(); }
  doc.dispatch('keydown', { key: '[', target: doc.body });
  check('[ collapses the side menu', doc.documentElement.getAttribute('data-nav') === 'collapsed');
  doc.dispatch('keydown', { key: '[', target: doc.body });
  doc.dispatch('keydown', { key: 'g', target: doc.body }); doc.dispatch('keydown', { key: 'h', target: doc.body }); await settle();
  check('g h goes to Help', win.location.hash === '#/help');
  doc.dispatch('keydown', { key: 'g', target: doc.body }); doc.dispatch('keydown', { key: 'a', target: doc.body }); await settle();
  check('g a goes to Analytics', win.location.hash === '#/analytics');
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
  check('...listing each tool on one line, the calendar, sample entries and sample magazines', /still sample/.test(mainText()) && /FIB: no primary quality engineer, no backup quality engineer/.test(mainText()) && /magazines are sample numbers/.test(mainText()) && /not confirmed/.test(mainText()));
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
  MRT.store.setCurrentUser(olga.id); MRT.app.recheckUser(); win.setHash('#/lab'); await settle();
  win.setHash('#/new'); await settle();
  check('New request is closed without the engineer role', /You don't have access, ask an admin/.test(mainText()));
  check('...and the + New button hides too', !!doc.getElementById('newBtn').hidden);
  win.setHash('#/home'); await settle();
  check('Home shows only her doors (queue, no new/lots/settings)',
        doc.getElementById('main').querySelectorAll('.home-card').map(c => c.getAttribute('href')).join() === '#/requests,#/queue,#/lab,#/board,#/help');
  MRT.store.setCurrentUser(MRT.store.data().users.filter(u => u.name === 'Prince Khurana')[0].id); MRT.app.recheckUser();
  win.setHash('#/settings/tools'); await settle();

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
  check('...panel logistics lists live here', /Panel locations/.test(mainText()) && /Destinations/.test(mainText()));
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
  check('a part number without a project is refused in the dialog', openDialog() === dlg2 && /one project/.test(dlg2.textContent));
  const c4fId = MRT.store.list('projects').filter(p => p.code === 'C4F')[0].id;
  setVal(fieldIn(dlg2, 'Project'), c4fId); buttonByText(dlg2, 'Save').click(); await settle();
  const pn77 = MRT.store.list('part_numbers').filter(x => x.code === 'PN-77')[0];
  check('...with its one project it is added (P-1)', !!pn77 && pn77.project_id === c4fId && !openDialog());
  check('...and shown with its project code', /PN-77/.test(mainText()) && /C4F/.test(mainText()));
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
  check('...with a Download for the auditors', !!buttonByText(doc.getElementById('main'), 'Download'));
  const af = fieldIn(doc.getElementById('main'), 'Filter'); setVal(af, 'nova'); await settle();
  check('...and filters', /1 match/.test(mainText()));

  await tab('look');
  const lookCard = k => doc.getElementById('main').querySelectorAll('.tg-card').filter(c => c.dataset.key === k)[0];
  check('Settings > Look: every theme as a live sample, the office default marked, old keys still resolve', doc.getElementById('main').querySelectorAll('.tg-card').length === MRT.themes.list.length && lookCard('ats').classList.contains('is-on') && MRT.themes.byKey('hc').key === 'dark-teal' && MRT.themes.byKey('carbon-g100').key === 'dark-teal' && MRT.themes.byKey('gruvbox-light').key === 'pure-white' && MRT.themes.byKey('minimal').key === 'pure-white' && MRT.themes.byKey('deep-lab').key === 'dark-teal' && MRT.themes.byKey('cleanroom').key === 'pure-white' && MRT.themes.byKey('signal').key === 'dark-teal' && MRT.themes.byKey('frost').key === 'pure-white');
  lookCard('slate').click(); await settle();
  check('...a click makes Slate the office default (audited)', MRT.store.getSetting('default_theme') === 'slate' && MRT.store.data().audit_log.slice(-1)[0].field === 'default_theme');
  doc.getElementById('userBtn').click(); await settle();
  buttonByText(doc.body.querySelector('.menu'), 'Theme: Pure White...').click(); await settle();
  const thDlg2 = doc.getElementById('dialogHost').querySelectorAll('dialog').filter(d => d.open).slice(-1)[0];
  thDlg2.querySelectorAll('.tg-card').filter(c => c.dataset.key === '')[0].click();
  check('..."Office default" in the gallery follows it again', doc.documentElement.getAttribute('data-theme') === 'slate' && !storage['mrt.theme.' + MRT.store.currentUser().id]);
  buttonByText(thDlg2, 'Done').click(); await settle();
  lookCard('ats').click(); await settle();
  check('...back to AT&S: stored as "the app default", and I follow it at once', MRT.store.getSetting('default_theme') === null &&
        doc.documentElement.getAttribute('data-theme') === 'ats');
  await tab('data');
  check('Data & PIN shows the file and today\'s backup', /mrt_data.json/.test(mainText()) && /latest/.test(mainText()));
  buttonByText(doc.getElementById('main'), 'Download a copy now').click(); await settle();

  // --- Lots (M2-1)
  win.setHash('#/lots'); await settle();
  check('Lots is live, empty at first, with Register lot', /No lots yet/.test(mainText()) && !!buttonByText(doc.getElementById('main'), 'Register lot'));
  buttonByText(doc.getElementById('main'), 'Register lot').click(); await settle();
  dlg2 = openDialog();
  check('...a lot links project + part number (optional, F-7), still no build-up asked', !!fieldIn(dlg2, 'Project') && !!fieldIn(dlg2, 'Part number') && !fieldIn(dlg2, 'Build-up'));
  check('...the lot fields are asked too (Purpose, Started on, Lot status ...)', !!fieldIn(dlg2, 'Purpose of the lot') && !!fieldIn(dlg2, 'Started on') && !!fieldIn(dlg2, 'Lot status'));
  setVal(fieldIn(dlg2, 'Lot number'), '18178-A'); buttonByText(dlg2, 'Save').click(); await settle();
  check('...a bad lot number is refused in the dialog', openDialog() === dlg2 && /split lot adds .01/.test(dlg2.textContent));
  const c4f = MRT.store.list('projects').filter(p => p.code === 'C4F')[0], bu1 = MRT.store.list('buildups')[0];
  setVal(fieldIn(dlg2, 'Lot number'), '18178'); setVal(fieldIn(dlg2, 'Panels'), '12');
  const purposeF = MRT.store.list('lot_fields').filter(f => f.label === 'Purpose of the lot')[0];
  setVal(fieldIn(dlg2, 'Purpose of the lot'), purposeF.choices[1].id);
  buttonByText(dlg2, 'Save').click(); await settle();
  const lot1 = (MRT.store.data().lots || []).filter(l => l.lot_number === '18178')[0];
  check('...lot 18178 is registered with 12 panels and its owner - empty links, no build-up on it',
        !!lot1 && lot1.panel_count === 12 && lot1.project_id === null && lot1.part_number_id === null && !('buildup_id' in lot1) && lot1.owner_id === MRT.store.currentUser().id && !openDialog());
  check('...and listed', /18178/.test(mainText()) && /1 of 1 lots/.test(mainText()));
  check('...with its purpose (DOE) stored', lot1.extra[purposeF.id] === purposeF.choices[1].id);
  await MRT.store.saveLot({ id: lot1.id, version: lot1.version, fields: { project_id: c4f.id } });
  check('...linking its project (F-7)', MRT.store.byId('lots', lot1.id).project_id === c4f.id);
  $$('#main a.lot-link').filter(a => a.textContent === '18178')[0].click(); await settle();
  check('the lot number opens all its details, lot fields included', !!openDialog() && /Purpose of the lot/.test(openDialog().textContent) && /DOE/.test(openDialog().textContent));
  buttonByText(openDialog(), 'Close').click(); await settle();
  buttonByText(doc.getElementById('main'), 'Register lot').click(); await settle();
  dlg2 = openDialog();
  setVal(fieldIn(dlg2, 'Lot number'), '18178'); setVal(fieldIn(dlg2, 'Panels'), '4');
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
  const M = () => doc.getElementById('main');
  const toolOpt = code => $$('#main .tool-pick-opt').filter(b => b.textContent.indexOf(code) === 0)[0];
  const stepOf = k => $$('#main .wz-step').filter(x => x.dataset.step === k)[0];
  const isOpenStep = k => !stepOf(k).querySelector('.wz-body').hidden;
  const segPick = (label, v) => { const i = M().querySelectorAll('.seg').filter(x => x.getAttribute('aria-label') === label)[0].querySelectorAll('input').filter(x => x.value === v)[0]; i.checked = true; i.dispatch('change'); };
  const mag1 = MRT.store.list('magazines')[0];
      check('New request, tool first: five tool drawings in their own bank (not the board pills), equal cards, no repeated names (AOI / AOI), five steps + Review, only the tool step open', $$('#main .tool-pick-opt').length === 5 && !!$('#main .tool-bench .tool-bank') && !$('#main .tool-pick') && $$('#main .tool-pick-opt').every(b => !!b.querySelector('.led')) && $$('#main .tool-pick-opt').every(b => { const n = b.querySelector('.tool-pick-name'); return !n || n.textContent !== b.querySelector('b').textContent; }) && $$('#main .wz-step').length === 6 &&
        isOpenStep('tool') && !isOpenStep('lot') && !isOpenStep('where') && /Pick the tool first/.test(mainText()));
  buttonByText(M(), 'Submit').click(); await settle();
  check('Submit with nothing picked lists what is missing', !$('#main .req-errors').hidden && /Pick a tool/.test($('#main .req-errors').textContent));
  toolOpt('FIB').click(); await settle();
  check('picking FIB: its types, the destructive tick, afterwards free (Back to me default)', !!fieldIn(M(), 'Measurement type') &&
        /destroys these panels/.test(mainText()) && fieldIn(M(), 'Where the panels go after measuring').value === 'Back to me');
  check('...and its extra field (Cut side)', !!fieldIn(M(), 'Cut side'));
      setVal(fieldIn(M(), 'Measurement type'), MRT.store.list('measurement_types').filter(m => m.tool_id === fib().id)[0].name); await settle();
  setVal(fieldIn(M(), 'Cut side'), fieldIn(M(), 'Cut side').querySelectorAll('option')[1].value); await settle();
  toolOpt('QVM').click(); await settle();
  check('switching tool resets tool-specific type/extras and destructive state', fieldIn(M(), 'Measurement type').value === '' && !fieldIn(M(), 'Cut side') &&
        !/destroys these panels/.test(mainText()) && fieldIn(M(), 'Where the panels go after measuring').value === 'Back to me');
  toolOpt('FIB').click(); await settle();
  check('...switching back to FIB starts its type/extras clean', fieldIn(M(), 'Measurement type').value === '' && !!fieldIn(M(), 'Cut side') &&
        /destroys these panels/.test(mainText()) && fieldIn(M(), 'Where the panels go after measuring').value === 'Back to me');
      setVal(fieldIn(M(), 'Measurement type'), MRT.store.list('measurement_types').filter(m => m.tool_id === fib().id)[0].name); await settle();
  buttonByText(M(), 'Next: Lot and panels').click(); await settle();
  check('Next opens step 2; step 1 folds into one line with the tool and type, ticked', isOpenStep('lot') && !isOpenStep('tool') &&
        /^FIB/.test(stepOf('tool').querySelector('.wz-sum').textContent) && stepOf('tool').classList.contains('is-done'));
  check('step 2 leads to "Where panels are", not straight to priority', !!buttonByText(M(), 'Next: Where panels are'));
  stepOf('urgency').querySelector('.wz-head').click(); await settle();
  const prioSeg = M().querySelectorAll('.seg').filter(x => x.getAttribute('aria-label') === 'Priority')[0];
  const normalId = MRT.store.list('priorities').filter(p => p.is_default)[0].id, hotId = MRT.store.list('priorities').filter(p => p.code === 'P2')[0].id;
  check('priority is tabs, one per priority, Normal picked by default', prioSeg.querySelectorAll('input').length === 4 &&
        prioSeg.querySelectorAll('input').filter(i => i.checked).map(i => i.value).join() === normalId);
  segPick('Priority', hotId); await settle();
  check('...picking Hot asks why, and the preview stripe follows at once', !!fieldIn(M(), 'Why Hot?') &&
        $('#main .traveller-mini').classList.contains('prio-2'));
  setVal(fieldIn(M(), 'Why Hot?'), 'line 2 down'); await settle();
  segPick('Priority', normalId); await settle();
  check('...back to Normal: no reason asked, stripe back', !fieldIn(M(), 'Why Hot?') && !fieldIn(M(), 'Why Line stop?') &&
        $('#main .traveller-mini').classList.contains('prio-3'));
  segPick('Priority', MRT.store.list('priorities').filter(p => p.code === 'P1')[0].id); await settle();
  check('...Line stop: red stripe that pulses, reason asked', $('#main .traveller-mini').classList.contains('prio-1') &&
        $('#main .traveller-mini').classList.contains('is-urgent') && !!fieldIn(M(), 'Why Line stop?'));
  segPick('Priority', normalId); await settle();
  stepOf('lot').querySelector('.wz-head').click(); await settle();
  setVal(fieldIn(M(), 'Lot'), '18178'); await settle();
  check('typing a registered lot finds it - and inherits its project (F-7), build-up stays separate', /Lot found/.test(mainText()) &&
        !fieldIn(M(), 'Project').disabled && fieldIn(M(), 'Project').value === 'C4F' && fieldIn(M(), 'Build-up').value === '');
  setVal(fieldIn(M(), 'Project'), c4f.code); await settle();
  setVal(fieldIn(M(), 'Part number'), pn77.code); await settle();
  check('...part number is searchable and accepted', fieldIn(M(), 'Part number').value === pn77.code);
  const lyAll = $$('#main .layer-chip').length;
  setVal(fieldIn(M(), 'Build-up'), bu1.code); await settle();
      check('...no build-up: all layers; BU-01 picked: only 2F / 2B', lyAll === 10 && $$('#main .layer-chip').length === 2);
  setVal(fieldIn(M(), 'Hirata IDs'), '3252-3255'); await settle();
  check('Hirata IDs: "3252-3255" becomes four chips, and the traveller card shows them', $$('#main .panel-chip').length === 4 &&
        /3252, 3253, 3254, 3255/.test($('#main .traveller-mini').textContent) && /FIB-YYMMDD-NN/.test($('#main .traveller-mini').textContent));
  setVal(fieldIn(M(), 'Hirata IDs'), '3252, abc'); await settle();
  check('...a typo is named at the field', /"abc" is not a Hirata ID/.test(mainText()));
  setVal(fieldIn(M(), 'Hirata IDs'), '3252-3255'); await settle();
  check('each typed Hirata ID shows its copper panel to the right (H-3)', $$('#main .panel-chips .panel-hirata-item').length === 4 &&
        $$('#main .panel-chips .panel-hirata-item')[0].children[1].classList.contains('cu-panel'));
  setVal(fieldIn(M(), 'Hirata IDs'), '7, 3252, 32525'); await settle();
  check('...1, 4 and 5 digits are all accepted (no forced length)', $$('#main .panel-chip').length === 3 && !/"32525" is not/.test(mainText()));
  setVal(fieldIn(M(), 'Hirata IDs'), '3252, 1612345070'); await settle();
  check('...10 digits are refused at the field, the good ID is kept', /"1612345070" is not a Hirata ID/.test(mainText()) &&
        $$('#main .panel-chip').length === 1);
  setVal(fieldIn(M(), 'Hirata IDs'), '3252-3255'); await settle();
  $$('#main .panel-chips .panel-hirata-item')[0].click(); await settle();
  check('...tapping a panel shows it large with its ID (H-5)', !!openDialog() && !!openDialog().querySelector('.panel-zoom') &&
        /3252/.test(openDialog().querySelector('.panel-zoom-id').textContent));
  buttonByText(openDialog(), 'Close').click(); await settle();
  const lyNames = $$('#main .layer-chip').map(b => b.textContent);
  check('layers come from recognised build-up values (BU-01 -> 2F / 2B)', lyNames.length === 2 && lyNames[0] === '2F' && lyNames[1] === '2B');
  $$('#main .layer-chip').filter(b => b.textContent === '2F')[0].click(); await settle();
  check('...a click ticks one; the card shows it', $$('#main .layer-chip.is-on').length === 1 && /2F/.test($('#main .traveller-mini').textContent));
  buttonByText(M(), 'Submit').click(); await settle();
  const errs = $('#main .req-errors').textContent;
  check('Submit: still missing where the panels are and the destructive tick - and the where step opens', /where the panels are now/.test(errs) && /tick that they may be scrapped/.test(errs) &&
        !/Pick a tool/.test(errs) && isOpenStep('where') && stepOf('where').classList.contains('is-missing'));
  setVal(fieldIn(M(), 'Magazine'), mag1.code); await settle();
  const mzs = () => $('#main .wz-mag').querySelectorAll('.mz-slot');
  check('picking the magazine draws it from the front: 24 slots', mzs().length === 24);
  mzs()[2].dispatch('mousedown'); mzs()[3].dispatch('mouseover'); mzs()[4].dispatch('mouseover'); mzs()[5].dispatch('mouseover'); doc.dispatch('mouseup'); await settle();
  check('...press and drag picks slots 3-6; each shows its panel\'s Hirata ID in order', mzs().filter(x => x.classList.contains('is-picked')).length === 4 &&
        /3252/.test(mzs()[2].textContent) && /3255/.test(mzs()[5].textContent) && /M70345 · slots 3-6/.test($('#main .traveller-mini').textContent));
  const dTick = tickIn(M(), 'I know FIB'); dTick.checked = true; dTick.dispatch('change');
  setVal(fieldIn(M(), 'Purpose'), 'Check voids after the new plating recipe');
  stepOf('review').querySelector('.wz-head').click(); await settle();
  check('Review: every step ticked, "Ready to submit"', /All there/.test(stepOf('review').textContent) && $$('#main .wz-rev.is-missing').length === 0);
  buttonByText(M(), 'Submit').click(); await settle();
  check('complete, but no BKM: a warning asks first (Q44)', !!openDialog() && /Submit anyway/.test(openDialog().textContent) && /No BKM/.test(openDialog().textContent));
  buttonByText(openDialog(), 'Submit anyway').click(); await settle();
  const req1 = MRT.store.data().requests.filter(r => r.status === 'submitted')[0];
  check('submitted: ID FIB-YYMMDD-01, Hirata IDs, layer, magazine slots, Back-to-me default, destructive ok', !!req1 && /^FIB-\d{6}-01$/.test(req1.request_no) &&
        req1.panels.join() === '3252,3253,3254,3255' && req1.project_id === c4f.id && req1.part_number_id === pn77.id && req1.buildup_id === bu1.id && req1.panel_count === 4 && req1.layers.join() === '2F' && req1.lot_id === lot1.id &&
        req1.magazine_id === mag1.id && req1.slots.join() === '3,4,5,6' && MRT.store.byId('destinations', req1.destination_id).name === 'Back to me' && req1.destructive_ok === true);
  check('...its request page opens (M2 step 5)', win.location.hash === '#/request/' + req1.id && mainText().indexOf(req1.request_no) !== -1 && /M70345 · slots 3-6/.test(mainText()));
  check('the traveller card: ID, stamp "Submitted", priority stripe, the magazine with 4 slots', !!$('#main .traveller.prio-3') &&
        $('#main .tr-stamp').textContent === 'Submitted' && $$('#main .traveller .mz-slot.is-picked').length === 4 && /3252, 3253/.test($('#main .traveller').textContent));
  check('the request page shows each panel as copper with its decoded fields (H-3)', $$('#main .traveller .cu-panel').length === req1.panels.length &&
        !$('#main .traveller .panel-lot-head'));
  check('...no date: "the priority says how urgent it is"', /priority says how urgent/.test($('#main .tr-clock').textContent));
  check('the status rail: Submitted now, by whom and when', $$('#main .rail-step').length === 6 && $('#main .rail-step.is-now').textContent.indexOf('Submitted') === 0 && /Prince Khurana/.test($('#main .rail-step.is-now').textContent));
  check('no path is proposed on the page (only confirmed folders show)', mainText().indexOf(req1.request_no + String.fromCharCode(92)) === -1);
  check('...three areas: info, Hirata codes + maps, reserved path block', $$('#main .tr-stack').length === 2 && !!$('#main .path-block'));
  check('...unset folders show a dash, no Copy buttons, no "Not set yet"', $$('#main .folder-row').length === 2 && !/Not set yet/.test(mainText()) &&
        !buttonByText($('#main .path-block'), 'Copy path'));
  check('...Hirata codes listed above the visual maps, cards carry no header', $('#main .hirata-codes').querySelectorAll('li').length === req1.panels.length &&
        $('#main .traveller').querySelectorAll('.cu-panel').length === req1.panels.length &&
        $('#main .traveller').querySelectorAll('.panel-lp').length === req1.panels.length);
  check('...one Lot + Panel Number block per card, no repeated code text', $$('#main .traveller .panel-lp').length === req1.panels.length &&
        $$('#main .traveller .panel-lp-row').length === req1.panels.length * 2 &&
        /Lot/.test($('#main .traveller .panel-lp').textContent) && /Panel Number/.test($('#main .traveller .panel-lp').textContent) &&
        $$('#main .panel-hirata-item').every(it => it.querySelectorAll('.mono').every(n => req1.panels.indexOf(n.textContent) === -1)));
  check('...Lot reads Project / Part / Lot / Build-up top to bottom', $$('#main .traveller .lot-row').length === 4 &&
        $$('#main .traveller .lot-row').map(n => n.textContent).join('|') ===
        'Project' + MRT.store.byId('projects', req1.project_id).code + '|Part' + MRT.store.byId('part_numbers', req1.part_number_id).code +
        '|Lot18178|Build-up' + MRT.store.byId('buildups', req1.buildup_id).code);
  const who = (id, empty) => id ? MRT.store.byId('users', id).name : empty;
  check('...People box on the card right: Requested by, Assigned to, Analyzed by', $$('#main .traveller .people-row').length === 3 &&
        $$('#main .traveller .people-row').map(n => n.textContent).join('|') ===
        'Requested by' + who(req1.requester_id, '?') + '|Assigned to' + who(req1.assigned_to, 'nobody yet') +
        '|Analyzed by' + who(req1.analyzed_by, 'not analyzed yet') && !!$('#main .traveller .tr-cell.tr-right .people-stack'));
  check('...below the rail keeps only the Quality engineers, no doubled names', ['Primary QE', 'Backup QE']
        .every(t => $$('#main .req-stack dt').map(n => n.textContent).indexOf(t) !== -1) &&
        ['Requested by', 'Assigned to', 'Analyzed by'].every(t => $$('#main .req-stack dt').map(n => n.textContent).indexOf(t) === -1));
  check('...paths, rail, details, people, timeline, comments in that order', (function () {
    const kids = Array.prototype.slice.call($('#main .req-stack').children)
      .map(n => n.getAttribute('aria-label') || n.getAttribute('class'));
    return kids.join('|') === 'BKM and results|Status|Details|Quality engineers|Timeline|Comments'; })());
  setVal(fieldIn(doc.getElementById('main'), 'Add a comment'), 'Please cut near via 3, @olga');
  buttonByText(doc.getElementById('main'), 'Add comment').click(); await settle();
  const com = MRT.store.requestEvents(req1.id).filter(e => e.kind === 'comment')[0];
  check('a comment joins the comments last, @olga is found as a mention', !!com && com.mentions.length === 1 && $$('#main .tl-item').length === 3 && !!$('#main .mention') &&
        mainText().indexOf('Timeline') < mainText().indexOf('Comments'));
  const sbox2 = doc.getElementById('search'); sbox2.value = req1.request_no.slice(0, 8); sbox2.dispatch('input'); await settle();
  check('the search finds the request by (part of) its ID (Q41)', doc.body.querySelector('.search-results').textContent.indexOf(req1.request_no) !== -1);
  sbox2.value = ''; sbox2.dispatch('input');
  sbox2.value = 'near via 3'; sbox2.dispatch('input'); await settle();
  check('...and by words in its comments (Q41)', doc.body.querySelector('.search-results').textContent.indexOf(req1.request_no) !== -1);
  sbox2.value = ''; sbox2.dispatch('input');
  check('...and its timeline has "created", "submitted", then the comment', MRT.store.requestEvents(req1.id).map(e => e.kind + ':' + (e.to || '')).join() === 'created:draft,status:submitted,comment:');
  openMore(); await settle();
  buttonByText(doc.body.querySelector('.menu'), 'Copy this request').click(); await settle();
  check('"Copy this request" prefills tool, lot, panels and layers - not where the panels are', $$('#main .tool-pick-opt.is-on').length === 1 &&
        fieldIn(M(), 'Lot').value === '18178' && fieldIn(M(), 'Hirata IDs').value === '3252, 3253, 3254, 3255' && $$('#main .layer-chip.is-on').length === 1 &&
        fieldIn(M(), 'Magazine').value === '' && fieldIn(M(), 'Where the panels are now').value === '');
  check('...and opens at the first step that needs something: where panels are', isOpenStep('where'));
  win.setHash('#/new'); await settle();
  toolOpt('QVM').click(); await settle();
  buttonByText(doc.getElementById('main'), 'Save draft').click(); await settle();
  const draft1 = MRT.store.data().requests.filter(r => r.status === 'draft')[0];
  check('Save draft needs only the tool, and opens the draft', !!draft1 && win.location.hash === '#/new/' + draft1.id && /Draft/.test(mainText()));
  check('...listed under your drafts', /QVM draft/.test($('#main .req-stack').textContent));
  MRT.store.setCurrentUser(MRT.store.data().users.filter(u => u.name === 'Tom Huber')[0].id);
  win.setHash('#/new/' + draft1.id); await settle();
  check('someone else\'s draft stays private (Q33)', /not your draft/.test(mainText()) && MRT.store.visibleRequests().every(r => r.status !== 'draft'));
  MRT.store.setCurrentUser(me0);
  win.setHash('#/new/' + draft1.id); await settle();
  buttonByText(doc.getElementById('main'), 'Delete draft').click(); await settle();
  buttonByText(openDialog(), 'Delete').click(); await settle();
  check('the author deletes the draft', !MRT.store.data().requests.some(r => r.id === draft1.id));
  // a lot that is not registered yet, typed in the form (F-5); just how many panels (F-1); a note instead of a magazine
  win.setHash('#/new?tool=' + MRT.store.list('tools').filter(t => t.code === 'QVM')[0].id); await settle();
  check('?tool= picks the tool and opens step 2', $$('#main .tool-pick-opt.is-on').length === 1 && isOpenStep('lot'));
  const prevPanel = $$('#main .req-stack .panel').filter(p => /What the lab will see/.test((p.querySelector('.panel-title') || { textContent: '' }).textContent))[0];
  prevPanel.querySelector('.panel-collapse').click(); await settle();
  check('...the lab preview collapses', prevPanel.classList.contains('is-collapsed') && prevPanel.querySelector('.panel-collapse').getAttribute('aria-expanded') === 'false');
  win.setHash('#/lab'); await settle(); win.setHash('#/new?tool=' + MRT.store.list('tools').filter(t => t.code === 'QVM')[0].id); await settle();
  const prevPanel2 = $$('#main .req-stack .panel').filter(p => /What the lab will see/.test((p.querySelector('.panel-title') || { textContent: '' }).textContent))[0];
  check('...and stays collapsed (remembered on this PC)', prevPanel2.classList.contains('is-collapsed'));
  prevPanel2.querySelector('.panel-collapse').click(); await settle();
  check('...panel logistics sit on one row', $('#main .where-row').querySelectorAll('.ifield').length === 3);
  setVal(fieldIn(M(), 'Where the panels go after measuring'), 'Back to'); await settle();
  check('...a near-miss suggests the close matches', /Close to: Back to me, Back to the line/.test(mainText()));
  setVal(fieldIn(M(), 'Where the panels go after measuring'), 'Back to me'); await settle();
  setVal(fieldIn(M(), 'Lot'), '1917x'); await settle();
  check('a lot number that is not one is named at the field', /Lot numbers are digits/.test(mainText()));
  setVal(fieldIn(M(), 'Lot'), '19170'); await settle();
  check('...a new one says "New lot", the project and build-up stay open to pick', /New lot/.test(mainText()) && !fieldIn(M(), 'Project').disabled);
      setVal(fieldIn(M(), 'Project'), c4f.code); await settle(); setVal(fieldIn(M(), 'Build-up'), bu1.code); await settle();
      segPick('Hirata IDs / How many', 'count'); await settle();
      check('..."How many" asks a number, 2 by default, with no Hirata box', fieldIn(M(), 'Number of panels').value === '2' && !fieldIn(M(), 'Hirata IDs'));
      setVal(fieldIn(M(), 'Number of panels'), '3'); await settle();
      setVal(fieldIn(M(), 'Measurement type'), MRT.store.list('measurement_types').filter(m => m.tool_id === MRT.store.list('tools').filter(t => t.code === 'QVM')[0].id)[0].name); await settle();
      setVal(fieldIn(M(), 'Where the panels are now'), 'with Anna'); setVal(fieldIn(M(), 'Purpose'), 'Pad size');
  buttonByText(M(), 'Submit').click(); await settle();
  if (openDialog()) { buttonByText(openDialog(), 'Submit anyway').click(); await settle(); }
  const lotNew = MRT.store.data().lots.filter(l => l.lot_number === '19170')[0];
  const reqNew = MRT.store.data().requests.filter(r => r.status === 'submitted').slice(-1)[0];
  check('...Submit registers lot 19170 and the request uses it: C4F, the build-up, 3 panels, no IDs, the new place', !!lotNew && reqNew.project_id === c4f.id && reqNew.buildup_id === bu1.id &&
        reqNew.lot_id === lotNew.id && reqNew.panel_count === 3 && reqNew.panels.length === 0 &&
        MRT.store.byId('panel_locations', reqNew.panel_location_id).name === 'with Anna' &&
        MRT.store.list('panel_locations').some(x => x.name === 'with Anna'));
  await MRT.store.cancelRequest(reqNew.id, 'test only');
  win.setHash('#/request/' + req1.id); await settle();
  check('...the bar holds only "..." plus the primary when there is one', !!buttonByText($('#main .req-actbar'), '...'));
  openMore(); await settle();
  buttonByText(doc.body.querySelector('.menu'), 'Cancel request').click(); await settle();
  const rdlg = openDialog(); setVal(rdlg.querySelector('textarea') || rdlg.querySelector('input'), 'Wrong lot');
  buttonByText(rdlg, 'Cancel request').click(); await settle();
  check('the requester cancels with a reason (Q35): stamp Cancelled, rail shows it, never deleted',
        MRT.store.byId('requests', req1.id).status === 'cancelled' && $('#main .tr-stamp').textContent === 'Cancelled' && !!$('#main .rail-side') && /Wrong lot/.test(mainText()));

  // --- the workflow on the request page (M3 step 1)
  openMore(); await settle();
  buttonByText(doc.body.querySelector('.menu'), 'Copy this request').click(); await settle();
      setVal(fieldIn(M(), 'Where the panels are now'), 'Magazine 15, top shelf');
  const dT2 = tickIn(doc.getElementById('main'), 'I know FIB'); dT2.checked = true; dT2.dispatch('change');
  buttonByText(doc.getElementById('main'), 'Submit').click(); await settle();
  if (openDialog()) { buttonByText(openDialog(), 'Submit anyway').click(); await settle(); }
  const req2 = MRT.store.data().requests.filter(r => r.status === 'submitted').slice(-1)[0];
  check('a second FIB request gets -02 and is assigned to Olga (primary, M3-7)', /-02$/.test(req2.request_no) && req2.assigned_to === olga.id && /Olga Quality/.test(mainText()));
  openMore(); await settle();
  check('...the requester finds Edit request behind "..."', !!menuItem('Edit request'));
  menuItem('Edit request').click(); await settle();
  check('Edit request opens the form, tool locked', mainText().indexOf('Edit ' + req2.request_no) !== -1 && $$('#main .tool-pick-opt').filter(b => b.disabled).length === 4);
      $$('#main .layer-chip').filter(b => b.textContent === '2B')[0].click(); await settle();
  buttonByText(doc.getElementById('main'), 'Save changes').click(); await settle();
  const edlg = openDialog(); setVal(edlg.querySelector('textarea') || edlg.querySelector('input'), 'Core too');
  buttonByText(edlg, 'Save changes').click(); await settle();
      check('...saved with a reason, the timeline says what changed', MRT.store.byId('requests', req2.id).layers.join() === '2F,2B' && /layers 2F -> 2F, 2B\. Reason: Core too/.test(mainText()));
  const meP = MRT.store.currentUser().id;
  MRT.store.setCurrentUser(olga.id); win.setHash('#/lab'); await settle(); win.setHash('#/request/' + req2.id); await settle();
  check('Olga sees Accept up front, Hold and Needs clarification behind "..." - Start waits for the panels', !!buttonByText($('#main .req-actbar'), 'Accept') &&
    !buttonByText($('#main .req-actbar'), 'Hold') && !buttonByText($('#main .req-actbar'), 'Start'));
  openMore(); await settle();
  check('......', !!menuItem('Hold') && !!menuItem('Needs clarification'));
  await closeMore();
  buttonByText($('#main .req-actbar'), 'Accept').click(); await settle();
  setVal(fieldIn(openDialog(), 'Expected done'), '2030-01-10'); buttonByText(openDialog(), 'Save').click(); await settle();
  check('Accept with an expected done date: stamp Accepted, date on the card', MRT.store.byId('requests', req2.id).status === 'accepted' && $('#main .tr-stamp').textContent === 'Accepted' && /Expected done/.test($('#main .traveller').textContent));
  check('...the card shows the queue place (1st of 1 on FIB)', /Queue/.test($('#main .traveller').textContent) && /1st of 1/.test($('#main .traveller').textContent));
  check('...the new stamp presses on and the rail fills (P3)', $('#main .tr-stamp').classList.contains('is-stamping') && $('#main .status-rail').classList.contains('is-filling'));
  check('...now Receive & start, no separate Panels received, still no Start', !!buttonByText($('#main .req-actbar'), 'Receive & start') &&
        !buttonByText($('#main .req-actbar'), 'Panels received') && !buttonByText($('#main .req-actbar'), 'Start'));
  buttonByText($('#main .req-actbar'), 'Receive & start').click(); await settle();
  setVal(fieldIn(openDialog(), 'Kept where'), 'FIB cabinet'); buttonByText(openDialog(), 'Save').click(); await settle(); await settle();
  const r2 = MRT.store.byId('requests', req2.id);
  check('...one step: the place stored, In progress', r2.status === 'in_progress' && /FIB cabinet/.test($('#main .traveller').textContent));
  const hasCu = !!$('#main .panel-hirata');
  check('...the panels slide into the lab tray (P4)' + (hasCu ? '' : ' [no Hirata IDs here]'), !hasCu || (!!$('#main .panel-tray.is-animating') && /lab tray/i.test($('#main .panel-tray').textContent)));
  let filedToast = null; const realToast = MRT.ui.toast;
  MRT.ui.toast = o => { if (o && o.cls === 'is-filed') filedToast = o; return realToast(o); };
  buttonByText($('#main .req-actbar'), 'Complete').click(); await settle();
  check('Complete: results folder proposed, panels Scrapped for FIB (M3-6)', /\\\\srv\\lab\\FIB\\/.test(fieldIn(openDialog(), 'Results folder').value) && fieldIn(openDialog(), 'The panels').value === 'scrapped');
  buttonByText(openDialog(), 'Save').click(); await settle();
  check('...Completed, the results path shown with Copy', MRT.store.byId('requests', req2.id).status === 'completed' && $('#main .tr-stamp').textContent === 'Completed' &&
        !!$$('#main button').filter(b => b.getAttribute('aria-label') === 'Copy Results path')[0]);
  check('...the results path itself is a clickable file link', $$('#main .req-side a.path-link').some(a => /^file:/.test(a.getAttribute('href'))));
  MRT.ui.toast = realToast;
  check('...scrapped panels are crossed out (P4)' + (hasCu ? '' : ' [no Hirata IDs here]'), !hasCu || (!$('#main .panel-tray') && !!$('#main .panel-hirata-item.is-scrapped .panel-mark')));
  check('Complete: the toast files the folder and offers Copy results path (P6)', !!filedToast && filedToast.cls === 'is-filed' && filedToast.icon === 'folder' &&
        filedToast.actions.some(a => a.label === 'Copy results path'));
  MRT.store.setCurrentUser(meP); win.setHash('#/lab'); await settle(); win.setHash('#/request/' + req2.id); await settle();
  check('the requester now sees Reopen (Analyze is the analyst\'s, admins excepted)', !!buttonByText($('#main .req-actbar'), 'Reopen'));
  win.setHash('#/requests/completed'); await settle();
  const cBoxes = $$('#main .qbox');
  check('...completed requests keep Reopen and the results folder link on the box', cBoxes.length === 1 && cBoxes[0].textContent.indexOf(req2.request_no) !== -1 &&
    !!buttonByText(cBoxes[0], 'Reopen') && $$('#main a.path-link').some(a => /^file:/.test(a.getAttribute('href'))));
  const ruth = await MRT.store.saveEntry('users', { fields: { name: 'Ruth Adler', roles: ['analyst'] } });
  MRT.store.setCurrentUser(ruth.id); win.setHash('#/lab'); await settle(); win.setHash('#/request/' + req2.id); await settle();
  check('the analyst sees Mark analyzed across tools', !!buttonByText($('#main .req-actbar'), 'Mark analyzed'));
  win.setHash('#/requests/toanalyze'); await settle();
  check('...found from My requests: the "To analyze" tab lists it with Mark analyzed (M7)', mainText().indexOf(req2.request_no) !== -1 &&
    !!buttonByText($('#main'), 'Mark analyzed'));
  win.setHash('#/request/' + req2.id); await settle();
  buttonByText($('#main .req-actbar'), 'Mark analyzed').click(); await settle();
  check('...a dialog asks the analyzed data folder, prefilled with the results folder', !!openDialog() && fieldIn(openDialog(), 'Analyzed data folder').value === MRT.store.byId('requests', req2.id).results_path);
  setVal(fieldIn(openDialog(), 'Analyzed data folder'), '\\\\srv\\lab\\FIB\\analysis'); buttonByText(openDialog(), 'Save').click(); await settle();
  check('...Analyzed: stamp Closed, Copy results path up front', MRT.store.byId('requests', req2.id).status === 'analyzed' && $('#main .tr-stamp').textContent === 'Closed' &&
    !!buttonByText($('#main .req-actbar'), 'Copy results path') && !buttonByText($('#main .req-actbar'), 'Mark analyzed'));
  win.setHash('#/results'); await settle();
  check('Results tab: the request with both paths, clickable', mainText().indexOf(req2.request_no) !== -1 && $$('#main a.path-link').length === 2 &&
        $$('#main a.path-link').every(a => /^file:/.test(a.getAttribute('href'))));
  setVal(fieldIn(doc.getElementById('main'), 'Request ID'), req2.request_no.slice(0, 8)); await settle();
  check('...ID search keeps the match', mainText().indexOf(req2.request_no) !== -1);
  setVal(fieldIn(doc.getElementById('main'), 'Request ID'), 'zzz-no-such'); await settle();
  check('...ID search with no match shows the empty state', /No requests match/.test(mainText()));
  setVal(fieldIn(doc.getElementById('main'), 'Request ID'), ''); await settle();
  setVal(fieldIn(doc.getElementById('main'), 'Tool'), req2.tool_id); await settle();
  check('...tool filter keeps its own requests', mainText().indexOf(req2.request_no) !== -1);
  const otherTool = MRT.store.list('tools').filter(t => t.id !== req2.tool_id)[0];
  setVal(fieldIn(doc.getElementById('main'), 'Tool'), otherTool.id); await settle();
  check('...tool filter hides other tools', mainText().indexOf(req2.request_no) === -1);
  setVal(fieldIn(doc.getElementById('main'), 'Tool'), ''); await settle();
  MRT.store.setCurrentUser(meP); win.setHash('#/lab'); await settle(); win.setHash('#/request/' + req2.id); await settle();
  check('no top banner (paths live in the card block only)', !$('#main .res-banner'));
  check('...path block: both folders with big Copy path buttons', $('#main .path-block').querySelectorAll('a.path-link').length === 2 &&
        $$('#main .path-block .folder-row').every(n => !!buttonByText(n, 'Copy path')));
  openMore(); await settle();
  menuItem('Print slip').click(); await settle();
  check('Print slip: the A6 traveller slip with the ID, its barcode and the panels (Q38)', !!$('#main .slip') && $('#main .slip-id').textContent === req2.request_no &&
        $('#main .barcode').querySelectorAll('rect').length > 30 && /DESTROYS THESE PANELS/.test($('#main .slip').textContent));
  check('...each panel drawn compactly in one row: copper + ID, no decoded fields (horizontal slip panels)', (req2.panels || []).length > 0 &&
        $$('#main .slip .cu-panel').length === req2.panels.length && !$('#main .slip .hf-list') &&
        req2.panels.every(id => $('#main .slip').textContent.indexOf(id) !== -1));
  check('...both folders printed big on the slip', $$('#main .slip .slip-path').length === 2 &&
        $$('#main .slip .slip-path').map(n => n.textContent).join('|').indexOf(MRT.store.byId('requests', req2.id).results_path) !== -1 &&
        $$('#main .slip .slip-path').map(n => n.textContent).join('|').indexOf(MRT.store.byId('requests', req2.id).analyzed_path) !== -1);
  check('...Requested by, Assigned to, Analyzed by on the slip', ['Requested by', 'Assigned to', 'Analyzed by',
        MRT.store.byId('users', MRT.store.byId('requests', req2.id).requester_id).name,
        MRT.store.byId('users', MRT.store.byId('requests', req2.id).analyzed_by).name]
        .every(t => $('#main .slip').textContent.indexOf(t) !== -1));
  win.setHash('#/lab'); await settle();
  req2.request_no.split('').concat(['Enter']).forEach(k => doc.dispatch('keydown', { key: k, target: doc.body })); await settle();
  check('a scanner typing the ID + Enter anywhere opens the request (Q38)', win.location.hash === '#/request/' + req2.id);

  // --- My queue (M3 step 2)
  const fibType = MRT.store.list('measurement_types').filter(m => m.tool_id === fib().id)[0].id;
  const prioBy = code => MRT.store.list('priorities').filter(p => p.code === code)[0].id;
  const dstScrap = MRT.store.list('destinations').filter(x => x.name === 'Lab may scrap them')[0].id;
  const dstBackToMe = MRT.store.list('destinations').filter(x => x.name === 'Back to me')[0].id;
  const base = { project_id: c4f.id, tool_id: fib().id, type_id: fibType, lot_id: lot1.id, new_location: { name: 'Rack A' }, destructive_ok: true, destination_id: dstScrap, purpose: 'x' };
  const qN = await MRT.store.submitRequest({ fields: Object.assign({}, base, { panels: [5], priority_id: prioBy('P3') }) });
  const rackA = MRT.store.list('panel_locations').filter(x => x.name === 'Rack A')[0].id;
  const qL = await MRT.store.submitRequest({ fields: Object.assign({}, base, { panel_location_id: rackA, new_location: null, panels: [6], priority_id: prioBy('P1'), priority_reason: 'line 2 down' }) });
  MRT.store.setCurrentUser(olga.id); win.setHash('#/lab'); await settle(); win.setHash('#/queue'); await settle();
  check('the bell shows Olga a dot, the count in its label (M4)', visible('bellCount') && (function () {
    var m = /Notifications, (\d+) new/.exec(doc.getElementById('bellBtn').getAttribute('aria-label') || '');
    return !!m && +m[1] >= 2;
  })());
  const qBadge = doc.getElementById('navItems').querySelectorAll('.nav-item').filter(a => a.dataset.route === 'queue')[0].querySelector('.nav-badge');
  check('...her queue badge carries line stop + late on her tools', !qBadge.hidden && +qBadge.textContent >= 1 && /line stop or late/.test(qBadge.title));
  doc.getElementById('bellBtn').click(); await settle();
  const bellMenu = doc.body.querySelector('.menu');
  check('...opening it lists them with the count inside, new request from Prince first', !!bellMenu && (function () {
    var m = /(\d+) new/.exec(bellMenu.textContent);
    return !!m && +m[1] >= 2;
  })() && bellMenu.textContent.indexOf('New request ' + qL.request_no) !== -1);
  buttonByText(bellMenu, 'Mark all as read').click(); await settle();
  check('..."Mark all as read" clears the dot', !visible('bellCount'));
  check('...the queue badge keeps its attention count', !qBadge.hidden && +qBadge.textContent >= 1);
  // --- Pure engineer: Edit, Cancel, Copy, Print (+ Answer only when asked)
  MRT.store.setCurrentUser(meP);
  const ed = await MRT.store.saveEntry('users', { fields: { name: 'Ed Engineer', roles: ['engineer'] } });
  MRT.store.setCurrentUser(ed.id);
  const edReq = await MRT.store.submitRequest({ fields: Object.assign({}, base, { panel_location_id: rackA, new_location: null, panels: [7], priority_id: prioBy('P3') }) });
  win.setHash('#/request/' + edReq.id); await settle();
  openMore(); await settle();
  check('engineer on own request: a lone "...", Edit, Cancel, Copy, Print behind it',
    $('#main .req-actbar').querySelectorAll('button').length === 1 &&
    ['Edit request', 'Print slip', 'Copy this request', 'Cancel request'].every(t => !!menuItem(t)));
  await closeMore();
  MRT.store.setCurrentUser(olga.id);
  await MRT.store.requestAction(edReq.id, 'clarify', { text: 'Which panels?' });
  MRT.store.setCurrentUser(ed.id); win.setHash('#/lab'); await settle(); win.setHash('#/request/' + edReq.id); await settle();
  const edBar = () => $('#main .req-actbar');
  check('...asked a question: Answered up front, the rest behind "..."',
    !!edBar() && !!buttonByText(edBar(), 'Answered') && edBar().querySelectorAll('button').length === 2);
  buttonByText(edBar(), 'Answered').click(); await settle();
  setVal(fieldIn(openDialog(), 'Your answer'), 'Panel 7'); buttonByText(openDialog(), 'Save').click(); await settle();
  check('...answered: back with the lab, Answered gone again', MRT.store.byId('requests', edReq.id).status === 'submitted' && !buttonByText($('#main .req-actbar'), 'Answered'));
  openMore(); await settle();
  menuItem('Cancel request').click(); await settle();
  setVal(openDialog().querySelector('textarea'), 'ordered twice'); buttonByText(openDialog(), 'Cancel request').click(); await settle();
  check('...cancel works, request closed for the engineer', MRT.store.byId('requests', edReq.id).status === 'cancelled');
  MRT.store.setCurrentUser(olga.id); win.setHash('#/lab'); await settle(); win.setHash('#/queue'); await settle();
  const qBoxes = $$('#main .qbox');
  check('My queue: Olga\'s FIB requests as boxes, the Line stop on top (M2-5)', qBoxes.length === 2 && qBoxes[0].textContent.indexOf(qL.request_no) !== -1 && qBoxes[0].classList.contains('prio-1'));
  check('...grouped under Line stop, one-click Accept on the box (Start waits for the panels)', /Line stop/.test(mainText()) && !!buttonByText(qBoxes[0], 'Accept') && !buttonByText(qBoxes[0], 'Start'));
  qBoxes.forEach(b => { const cb = b.querySelector('input'); cb.checked = true; cb.dispatch('change'); });
  await settle();
  check('...ticking two shows "2 selected" with Accept all (2)', /2 selected:/.test($('#main .queue-bulk').textContent) && !!buttonByText($('#main .queue-bulk'), 'Accept all (2)'));
  buttonByText($('#main .queue-bulk'), 'Accept all (2)').click(); await settle(); await settle();
  check('...Accept all accepts both', [qN.id, qL.id].every(id => MRT.store.byId('requests', id).status === 'accepted'));
  check('...one undo unit for the bulk', MRT.store.undoInfo() && MRT.store.undoInfo().label === '2 requests accepted');
  await MRT.store.undoLast();
  check('...Undo takes both back to Submitted (M2)', [qN.id, qL.id].every(id => MRT.store.byId('requests', id).status === 'submitted'));
  $$('#main .qbox').forEach(b => { const cb = b.querySelector('input'); cb.checked = true; cb.dispatch('change'); });
  await settle();
  buttonByText($('#main .queue-bulk'), 'Accept all (2)').click(); await settle(); await settle();
  check('...re-accepting restores both', [qN.id, qL.id].every(id => MRT.store.byId('requests', id).status === 'accepted'));
  const qBoxA = $$('#main .qbox')[0].textContent;
  check('...box order: Receive & start, then Hold and Clarify', ['Receive & start', 'Hold', 'Needs clarification'].every((t, i, a) => !i || qBoxA.indexOf(a[i - 1]) < qBoxA.indexOf(t)));
  const qLBox = $$('#main .qbox').filter(b => b.textContent.indexOf(qL.request_no) !== -1)[0];
  { const cb = qLBox.querySelector('input'); cb.checked = true; cb.dispatch('change'); }
  await settle();
  check('...ticking one accepted shows "1 selected" with Receive & start all (1)', /1 selected:/.test($('#main .queue-bulk').textContent) && !!buttonByText($('#main .queue-bulk'), 'Receive & start all (1)'));
  buttonByText($('#main .queue-bulk'), 'Receive & start all (1)').click(); await settle();
  setVal(fieldIn(openDialog(), 'Kept where'), 'FIB cabinet'); buttonByText(openDialog(), 'Receive & start all').click(); await settle(); await settle();
  check('...one shared place, received and started, the other untouched', MRT.store.byId('requests', qL.id).status === 'in_progress' &&
        MRT.store.byId('requests', qL.id).received_where === 'FIB cabinet' && MRT.store.byId('requests', qN.id).status === 'accepted');
  const qLDone = $$('#main .qbox').filter(b => b.textContent.indexOf(qL.request_no) !== -1)[0];
  buttonByText(qLDone, 'Complete').click(); await settle();
  setVal(fieldIn(openDialog(), 'Results folder'), 'Z:\\lab\\fib'); buttonByText(openDialog(), 'Save').click();
  // No settle() here: one flush() fires every fake timer at once, so the
  // dialog close, the 1.2 s fade and the toast timeouts would all run
  // together and the transient state could never be seen. Step by hand: one
  // flush lets the dialog close, real time lets the promise chain finish.
  // (The fade itself is Prince's browser check.)
  let guard = 0;
  while (guard++ < 20 && !$$('#main .qbox.is-done').length) { flush(); await new Promise(r => setTimeout(r, 5)); }
  check('...Complete shows "Completed" on the box, an Undo toast and Done today (1)', $$('#main .qbox.is-done').length === 1 &&
        $$('#toasts .toast').some(t => /completed/.test(t.textContent) && buttonByText(t, 'Undo')) && /Done today \(1\)/.test(mainText()));
  buttonByText($$('#toasts .toast').filter(t => buttonByText(t, 'Undo'))[0], 'Undo').click();
  guard = 0;
  while (guard++ < 200 && MRT.store.byId('requests', qL.id).status !== 'in_progress') await new Promise(r => setTimeout(r, 3));
  await settle();
  check('...Undo brings it back In progress and withdraws Done today', MRT.store.byId('requests', qL.id).status === 'in_progress' &&
        $$('#main .qbox').some(b => b.textContent.indexOf(qL.request_no) !== -1) && !/Done today/.test(mainText()));
  MRT.store.setCurrentUser(meP); await MRT.store.saveEntry('users', { id: meP, fields: { email: 'prince@example.com' } }); MRT.store.setCurrentUser(olga.id);
  const offer = MRT.requestActions.emailOffer(MRT.store.byId('requests', qN.id), 'clarify');
  check('Clarify offers a ready Outlook draft to the requester (M4-4)', !!offer && /^Email Prince/.test(offer.label));
  check('...the draft: to, subject with the ID', /^mailto:prince@example\.com\?subject=%5B/.test(MRT.adapters.mail.mailtoUrl({ to: ['prince@example.com'], subject: '[' + qN.request_no + '] Question about', body: 'x' })));
  await MRT.store.requestAction(qN.id, 'clarify', { text: 'Which side should we cut?' });
  MRT.store.setCurrentUser(meP);

  // --- My requests (M3 step 3, Step 5 boxes)
  win.setHash('#/requests/active'); await settle();
  const mBoxes = $$('#main .qbox');
  check('My requests: open ones shown as boxes, the one waiting on me first', mBoxes.length === 2 && mBoxes[0].textContent.indexOf(qN.request_no) !== -1 &&
    /Needs clarification/.test(mBoxes[0].textContent) && /1 waiting on you/.test(mainText()));
  check('...line 2 carries lot 18178', mBoxes[0].textContent.indexOf('18178') !== -1);
  buttonByText(mBoxes[0], 'Answered').click(); await settle();
  setVal(fieldIn(openDialog(), 'Your answer'), 'Front side, via row 3'); buttonByText(openDialog(), 'Save').click(); await settle();
  check('...Answered right there: back to Accepted (M3-2)', MRT.store.byId('requests', qN.id).status === 'accepted' && !/waiting on you/.test(mainText()));
  setVal(fieldIn(doc.getElementById('main'), 'Show'), 'history'); await settle();
  const hBoxes = $$('#main .qbox');
  const r2step = (function () { var r = MRT.store.byId('requests', req2.id); var s = r.process_step_id ? MRT.store.byId('process_steps', r.process_step_id) : null; return s ? s.name : r.process_step_other || ''; })();
  check('...History holds the analyzed one, stamped Closed, with its process step', hBoxes.length === 1 && hBoxes[0].textContent.indexOf(req2.request_no) !== -1 &&
    /Closed/.test(hBoxes[0].textContent) && (!r2step || hBoxes[0].textContent.indexOf(r2step) !== -1));
  check('...and the analyzed data folder as a file link', $$('#main a.path-link').some(a => /^file:/.test(a.getAttribute('href'))));
  setVal(fieldIn(doc.getElementById('main'), 'Show'), 'all'); await settle();
  check('..."All": cancelled and closed ones too, the closed one stamped Closed', $$('#main .qbox').length === 5 && /Closed/.test(mainText()) && /Cancelled/.test(mainText()));
  setVal(fieldIn(doc.getElementById('main'), 'Lot or request number'), req2.request_no); await settle();
  check('...find by request number', $$('#main .qbox').length === 1);
  const rowDraft = await MRT.store.saveDraft({ fields: { tool_id: fib().id } });
  win.setHash('#/lab'); await settle(); win.setHash('#/requests/drafts'); await settle();
  setVal(fieldIn(doc.getElementById('main'), 'Lot or request number'), ''); await settle();
  const rowDel = doc.getElementById('main').querySelectorAll('button').filter(b => (b.getAttribute('aria-label') || '').indexOf('Delete draft') === 0)[0];
  check('...a draft box has a delete button', !!rowDel && $$('#main .qbox').length === 1);
  rowDel.click(); await settle();
  buttonByText(openDialog(), 'Delete').click(); await settle();
  check('...delete from the box removes the draft', !MRT.store.data().requests.some(r => r.id === rowDraft.id) && $$('#main .qbox').length === 0);

  // --- the board (Step 6b: lane headers, slim cards, done off by default)
  MRT.store.setCurrentUser(olga.id); win.setHash('#/lab'); await settle(); win.setHash('#/board'); await settle();
  check('Board: a lane header per tool, five numbered stations, one accepted + one in-progress FIB card', $$('#main .board-lanehead').length === 5 &&
        $$('#main .board-colhead').length === 5 && $$('#main .board-colhead')[0].textContent.indexOf('01') !== -1 &&
        $$('#main .board-cell').filter(c => c.dataset.col === 'accepted' && c.dataset.tool === fib().id)[0].querySelectorAll('.bcard').length === 1 &&
        $$('#main .board-cell').filter(c => c.dataset.col === 'in_progress' && c.dataset.tool === fib().id)[0].querySelectorAll('.bcard').length === 1);
  const lsCard = $$('#main .bcard').filter(c => c.dataset.id === qL.id)[0];
  const lsShort = qL.request_no.split('-').slice(1).join('-');
  check('...the Line stop card: stripe, short ID, count, lot, P1 - tooltip carries the rest, nothing draggable',
    lsCard.classList.contains('is-urgent') && lsCard.classList.contains('prio-1') &&
    lsCard.querySelector('.bcard-id').textContent === lsShort && lsShort.indexOf('FIB') === -1 &&
    /1 pnl/.test(lsCard.textContent) && /18178/.test(lsCard.textContent) &&
    lsCard.querySelector('.bcard-prio').textContent === 'P1' &&
    lsCard.getAttribute('title').indexOf(qL.request_no + ' · ') === 0 && /panels 6/.test(lsCard.getAttribute('title')) &&
    !lsCard.querySelector('.q-clock') && !lsCard.querySelector('.bgauge') && !lsCard.querySelector('.bcard-who') &&
    $$('#main .bcard').every(c => c.getAttribute('draggable') !== 'true'));
  check('...empty cells say Nothing here', $$('#main .board-cell').some(c => /Nothing here/.test(c.textContent)));
  await MRT.store.requestAction(qN.id, 'hold', { hold_reason_id: MRT.store.list('hold_reasons')[0].id, note: 'test only' });
  win.setHash('#/lab'); await settle(); win.setHash('#/board'); await settle();
  const holdCard = $$('#main .bcard').filter(c => c.dataset.id === qN.id)[0];
  check('...fresh on hold: On hold chip, no Stuck yet', /On hold/.test(holdCard.textContent) && !/Stuck/.test(holdCard.textContent));
  await MRT.store.requestAction(qN.id, 'resume', {});
  win.setHash('#/lab'); await settle(); win.setHash('#/board'); await settle();
  check('...resumed back to Accepted', MRT.store.byId('requests', qN.id).status === 'accepted');
  $$('#main .bcard').filter(c => c.dataset.id === qN.id)[0].dispatch('click'); await settle();
  const drw = win.document.querySelector('dialog.drawer');
  check('...a click opens the side panel with the traveller, Receive & start and an Open page link (P5-3)', !!drw && !!buttonByText(drw, 'Receive & start') && /Open page/.test(drw.textContent));
  buttonByText(drw, 'Receive & start').click(); await settle();
  setVal(fieldIn(openDialog(), 'Kept where'), 'FIB cabinet'); buttonByText(openDialog(), 'Save').click(); await settle(); await settle();
  check('...received and started, both cards In progress, the panel closes', MRT.store.byId('requests', qN.id).status === 'in_progress' && !win.document.querySelector('dialog.drawer') &&
        $$('#main .board-cell').filter(c => c.dataset.col === 'in_progress' && c.dataset.tool === fib().id)[0].querySelectorAll('.bcard').length === 2);
  check('...tools with nothing on them are a thin header strip', $$('#main .board-lanehead').length === 5 &&
        $$('#main .board-lanehead').filter(h => !/ open/.test(h.textContent) || /^[^0-9]*0 open/.test(h.textContent)).length >= 1);
  setVal(fieldIn(doc.getElementById('main'), 'Tool'), fib().id); await settle();
  check('Board tool dropdown: one tool shows only its lane', $$('#main .board-lanehead').length === 1 && /FIB/.test($$('#main .board-lanehead')[0].textContent));
  setVal(fieldIn(doc.getElementById('main'), 'Tool'), ''); await settle();
  check('...All tools brings every lane back', $$('#main .board-lanehead').length === 5);
  $$('#main .tool-pick').filter(b => b.dataset.only === 'linestop')[0].click(); await settle();
  check('Board "Show Line stop": only Line stop cards (P5-5)', $$('#main .bcard').length >= 1 && $$('#main .bcard').every(c => c.classList.contains('prio-1')));
  $$('#main .tool-pick').filter(b => b.dataset.only === 'all')[0].click(); await settle();
  const bs = $('#main .board-search'); bs.value = qL.request_no; bs.dispatch('input');
  check('Board search: the match stays, the rest dims (P5-6)', !$$('#main .bcard').filter(c => c.dataset.id === qL.id)[0].classList.contains('is-miss') &&
        $$('#main .bcard.is-miss').length === $$('#main .bcard').length - 1);
  bs.value = ''; bs.dispatch('input');
  const doneSw = $$('#main input').filter(i => i.getAttribute('role') === 'switch')[0];
  doneSw.checked = true; doneSw.dispatch('change'); await settle();
  check('Board: the done columns can be shown (P5-7)', $$('#main .board-colhead').length === 7 &&
        $$('#main .board-cell').filter(c => c.dataset.col === 'analyzed' && c.dataset.tool === fib().id)[0].querySelectorAll('.bcard').length === 1 &&
        $$('#main .board-cell').filter(c => c.dataset.col === 'analyzed' && c.dataset.tool === fib().id)[0].querySelectorAll('.bcard')[0].dataset.id === req2.id);
  const doneSw2 = $$('#main input').filter(i => i.getAttribute('role') === 'switch')[0];
  doneSw2.checked = false; doneSw2.dispatch('change'); await settle();
  MRT.store.setCurrentUser(MRT.store.data().users.filter(u => u.name === 'Tom Huber')[0].id); win.setHash('#/lab'); await settle(); win.setHash('#/board'); await settle();
  win.setHash('#/lab'); await settle();
  const fibPlateQ = $$('#main .tool-plate').filter(p => /FIB/.test(p.textContent))[0];
  check('Lab status shows each tool\'s queue: open, oldest open, typical wait (Q46)', /2 open/.test(fibPlateQ.textContent) && /Oldest open/.test(fibPlateQ.textContent) && /lab time \(last/.test(fibPlateQ.textContent));
  win.setHash('#/board'); await settle();
  check('an engineer with no own requests sees no cards (own only)', $$('#main .bcard').length === 0);
  MRT.store.setCurrentUser(meP);

  win.setHash('#/lots'); await settle();
  check('...shown on Lots with the Sample tag', /99902.01/.test(mainText()) && $$('#main .sample-tag').length === 3);
  await tab('lots');
  check('Settings > Lots: the same list as the Lots page', /18178.01/.test(mainText()) && /99902.01/.test(mainText()) && /same list as the/.test(mainText()));
  buttonByText(doc.getElementById('main'), 'Add several lots').click(); await settle();
  dlg2 = openDialog();
  setVal(fieldIn(dlg2, 'Lot numbers'), '30001-30003'); setVal(fieldIn(dlg2, 'Panels per lot'), '6');
  buttonByText(dlg2, 'Add lots').click(); await settle();
  check('..."Add several lots" adds 30001-30003 with 6 panels each', ['30001', '30002', '30003'].every(n => MRT.store.data().lots.some(l => l.lot_number === n && l.panel_count === 6)) && !openDialog());
  win.setHash('#/lots'); await settle();
  check('...and they show on the Lots page too', /30002/.test(mainText()));
  check('...a lot shows its own project link (F-7)', $$('#main tr').filter(r => /18178/.test(r.textContent) && !/18178\.01/.test(r.textContent))[0].textContent.indexOf('C4F') !== -1);

  // --- magazines and build-up layers (M2-23, F-2, F-3)
  await tab('data');
  buttonByText(M(), 'Add the sample magazines').click(); await settle();
  check('Data: "Add the sample magazines" - all 20 there already, none doubled', /20 magazines in this file/.test(mainText()) && MRT.store.list('magazines', { all: true }).length === 20);
  await tab('lists');
  const magPanel = M().querySelectorAll('section').filter(x => /Magazines/.test(x.textContent))[0];
  check('Settings > Lists > Magazines: M70345-M70364, 24 slots, no racks any more', !!magPanel && /M70345/.test(magPanel.textContent) && /M70364/.test(magPanel.textContent) && !fieldIn(magPanel, 'Racks'));
  const buPanel = M().querySelectorAll('section').filter(x => /Build-ups/.test(x.querySelector('.panel-title') ? x.querySelector('.panel-title').textContent : ''))[0];
  check('...Build-ups show their layers: BU-01 up to 2F / 2B, TEST up to 5F / 5B', /up to 2F \/ 2B/.test(buPanel.textContent) && /up to 5F \/ 5B/.test(buPanel.textContent));
  buPanel.querySelectorAll('button').filter(x => x.getAttribute('aria-label') === 'Edit TEST')[0].click(); await settle();
  setVal(fieldIn(openDialog(), 'Build-up layers'), '2'); buttonByText(openDialog(), 'Save').click(); await settle();
  check('...an admin sets TEST to 2 layers: up to 3F / 3B', MRT.store.list('buildups').filter(x => x.code === 'TEST')[0].layers === 2 && MRT.domain.layersFor(MRT.store.list('buildups').filter(x => x.code === 'TEST')[0]).slice(-1)[0] === '3B');
  const fibT = MRT.store.list('measurement_types').filter(m => m.tool_id === fib().id)[0].id;
  const inMag = await MRT.store.submitRequest({ fields: { project_id: c4f.id, tool_id: fib().id, type_id: fibT, lot_id: lot1.id, panels: ['3260', '3261'], priority_id: MRT.store.list('priorities')[2].id,
    magazine_id: mag1.id, slots: [1, 2], destructive_ok: true, destination_id: dstScrap, purpose: 'x' } });
  win.setHash('#/new?lot=' + lot1.id); await settle();
  toolOpt('QVM').click(); await settle();
  setVal(fieldIn(M(), 'Magazine'), mag1.code); await settle();
  check('the form greys out slots another open request holds, with its ID', mzs()[0].classList.contains('is-taken') && mzs()[0].tagName === 'DIV' && mzs()[0].textContent.indexOf(inMag.request_no) !== -1);
  await MRT.store.requestAction(inMag.id, 'accept', {});
  win.setHash('#/request/' + inMag.id); await settle();
  check('only Receive & start, no separate Panels received', !!buttonByText($('#main .req-actbar'), 'Receive & start') && !buttonByText($('#main .req-actbar'), 'Panels received'));
  buttonByText($('#main .req-actbar'), 'Receive & start').click(); await settle();
  setVal(fieldIn(openDialog(), 'Kept where'), 'FIB cabinet'); buttonByText(openDialog(), 'Save').click(); await settle();
  const inMagTo = MRT.store.requestEvents(inMag.id).filter(e => e.kind === 'status').map(e => e.to).slice(-2).join();
  check('...one dialog receives and starts, two timeline entries', MRT.store.byId('requests', inMag.id).status === 'in_progress' &&
        MRT.store.byId('requests', inMag.id).received_where === 'FIB cabinet' && inMagTo === 'panels_received,in_progress');
  check('...the magazine on the card folds the empty slots away', $$('#main .mz-skip').length === 1 && /21 empty/.test($('#main .mz').textContent) &&
        $$('#main .mz-slot.is-picked').length === 2);
  const qvmReq = await MRT.store.submitRequest({ fields: { project_id: c4f.id, tool_id: MRT.store.list('tools').filter(t => t.code === 'QVM')[0].id,
    type_id: MRT.store.list('measurement_types').filter(m => m.tool_id === MRT.store.list('tools').filter(t => t.code === 'QVM')[0].id)[0].id, lot_id: lot1.id,
    panels: ['3270'], priority_id: MRT.store.list('priorities')[2].id, magazine_id: mag1.id, slots: [7], destination_id: dstBackToMe, purpose: 'x' } });
  const qvmT = MRT.store.list('tools').filter(t => t.code === 'QVM')[0];
  await MRT.store.saveEntry('tools', { id: qvmT.id, fields: { primary_operator_id: olga.id } });
  MRT.store.setCurrentUser(olga.id);
  await MRT.store.requestAction(qvmReq.id, 'accept', {});
  await MRT.store.requestAction(qvmReq.id, 'receive', { received_where: 'QVM bench' });
  await MRT.store.requestAction(qvmReq.id, 'start', {});
  win.setHash('#/lab'); await settle(); win.setHash('#/request/' + qvmReq.id); await settle();
  buttonByText($('#main .req-actbar'), 'Complete').click(); await settle();
  const cdlg = openDialog();
  check('Complete offers the same magazine, its slot picked, the other request\'s slots taken', fieldIn(cdlg, 'Put them back').value === mag1.id &&
        cdlg.querySelectorAll('.mz-slot.is-picked').length === 1 && cdlg.querySelectorAll('.mz-slot')[6].classList.contains('is-picked') && cdlg.querySelectorAll('.mz-slot.is-taken').length === 2);
  cdlg.querySelectorAll('.mz-slot')[6].click(); cdlg.querySelectorAll('.mz-slot')[9].click();
  setVal(fieldIn(cdlg, 'Results folder'), 'Z:\\results\\QVM');
  buttonByText(cdlg, 'Save').click(); await settle();
  check('...put back into slot 10 instead; the page says where', JSON.stringify(MRT.store.byId('requests', qvmReq.id).put_back) === JSON.stringify({ magazine_id: mag1.id, slots: [10] }) &&
        /back in M70345 · slot 10/.test(mainText()));
  MRT.store.setCurrentUser(meP);

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
  check('...and says when nothing is found', guides.every(g => g.hidden) && /Nothing found/.test(mainText()) && !!doc.getElementById('main').querySelector('.empty'));
  check('...the status-lamp legend names all five lamps', ['OK', 'Warning', 'Line stop', 'Late', 'Blocked'].every(w =>
        doc.getElementById('help-lamps').textContent.indexOf(w) !== -1) && doc.getElementById('help-lamps').querySelectorAll('.led').length === 5);
  win.setHash('#/help/admin-setup'); await settle();
  check('#/help/admin-setup opens that guide', $$('.help-guide').filter(g => g.classList.contains('is-selected')).map(g => g.id).join() === 'help-admin-setup');
  check('every guide link goes to a live page', $$('.help-open').every(a => !!MRT.views[(a.getAttribute('href') || '').replace(/^#\//, '').split('/')[0]]));

  // --- exports (M5-2, Q48): CSV without SheetJS, a real workbook with it
  const downloads = [];
  const RealBlob = win.Blob;
  win.Blob = class { constructor(parts) { downloads.push(parts.join('')); } };
  win.setHash('#/requests/all'); await settle();
  buttonByText(doc.getElementById('main'), 'Download').click(); await settle();
  const myCsv = downloads.slice(-1)[0] || '';
  const myCount = +((mainText().match(/(\d+) shown/) || [])[1]);   // exactly what the list shows, filters included
  check('My requests > Download: a CSV of the list as filtered, same columns everywhere', /^\ufeffRequest ID,Status,Tool/.test(myCsv) &&
        myCsv.split('\r\n').length === myCount + 1, myCsv.split('\r\n').length + ' vs ' + (myCount + 1));
  win.setHash('#/settings/data'); await settle();
  const before = downloads.length;
  buttonByText(doc.getElementById('main'), 'Download the request history').click(); await settle();
  check('Settings > Data: the full request history - Requests and Timeline (2 CSV files)', downloads.length === before + 2 &&
        /Turnaround \(lab h, hold out\)/.test(downloads[before]) && /^\ufeffRequest ID,When,Who,What,From,To,Text/.test(downloads[before + 1]));
  win.Blob = RealBlob;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'vendor/xlsx.full.min.js'), 'utf8'), ctx, { filename: 'xlsx.full.min.js' });
  let wbOut = null;
  win.XLSX.writeFile = (wb, name) => { wbOut = { wb, name }; };
  buttonByText(doc.getElementById('main'), 'Download the request history').click(); await settle();
  const reqSheet = wbOut && win.XLSX.utils.sheet_to_json(wbOut.wb.Sheets.Requests, { header: 1 });
  check('with SheetJS: one .xlsx workbook, sheets Requests + Timeline, a row per submitted request', !!wbOut && /^mrt_request_history_\d{4}-\d{2}-\d{2}\.xlsx$/.test(wbOut.name) &&
        wbOut.wb.SheetNames.join() === 'Requests,Timeline' &&
        reqSheet.length === MRT.store.data().requests.filter(r => r.status !== 'draft').length + 1, wbOut && wbOut.name);
  delete win.XLSX;

  // --- the line-stop banner (Part A): one slim line, dismissible per request
  const lsReq = await MRT.store.submitRequest({ fields: Object.assign({}, base, { panel_location_id: rackA, new_location: null, panels: [9], priority_id: prioBy('P1'), priority_reason: 'banner smoke', needed_by: '2026-10-02' }) });
  win.setHash('#/lab'); await settle(); tick(); await settle();
  const banner = doc.getElementById('alertBanner');
  check('an open line stop shows one slim banner under the top bar', !banner.hidden &&
        banner.textContent.indexOf('Line stop: ' + lsReq.request_no + ' · Open') !== -1);
  banner.querySelectorAll('button').filter(b => /Dismiss line stop/.test(b.getAttribute('aria-label') || ''))[0].click(); await settle();
  check('...dismiss drops it and shows the next undismissed one', banner.textContent.indexOf(lsReq.request_no) === -1 &&
        /Line stop: /.test(banner.textContent));
  for (let d = 0; d < 4 && !banner.hidden; d++) {
    banner.querySelectorAll('button').filter(b => /Dismiss line stop/.test(b.getAttribute('aria-label') || ''))[0].click(); await settle();
  }
  check('...dismissing them all hides the banner', banner.hidden === true);
  check('...remembered on this PC', (storage['mrt.lstop_off.' + MRT.store.currentUser().id] || '').indexOf(lsReq.id) !== -1);
  win.setHash('#/queue'); await settle();
  const countsLine = $('#main .queue-counts');
  const countsLinks = countsLine.querySelectorAll('a');
  check('...My queue opens with four plain filter links', !!countsLine &&
        countsLinks.map(a => a.getAttribute('href')).join() === '#/queue/linestop,#/queue/late,#/queue/on_hold,#/queue/clarification');
  check('...the line-stop number takes the late colour above zero', countsLinks[0].classList.contains('is-bad') &&
        +countsLinks[0].querySelector('.num').textContent >= 1);
  win.setHash(countsLinks[0].getAttribute('href')); await settle();
  check('..."Line stop" opens the list on that filter', /My queue/.test(mainText()) &&
        (fieldIn(doc.getElementById('main'), 'Status') || { value: '' }).value === 'linestop');

  // --- Hirata tools (H-1..H-3): read a panel, find a pattern
  win.setHash('#/hirata'); await settle();
  check('Hirata tools opens on "Read a panel" with the dot grid', /Read a panel/.test(mainText()) && $$('#main .hg-cell').length === 5 * 10);   // 5 rows x (start column + 9 digits)
  const cellAt = (c, r) => $$('#main td.hg-cell').filter(t => t.dataset.c === String(c) && t.dataset.r === String(r))[0];
  cellAt(8, 3).click(); await settle(); cellAt(8, 2).click(); await settle(); cellAt(8, 1).click(); await settle();
  check('tapping 4 + 2 + 1 in the last column reads 7', /0 0 0 0 0 0 0 0 7/.test($('#main .hirata-serial').textContent));
  cellAt(8, 0).click(); await settle();
  check('...8 on top of 7 is blocked (above 9) and said so', /cannot go above 9/.test(mainText()) && /0 0 0 0 0 0 0 0 7/.test($('#main .hirata-serial').textContent));
  const typedBox = fieldIn(doc.getElementById('main'), 'Or type the digits');
  setVal(typedBox, '161234507'); await settle();
  check('typing the full code decodes every field', $('#main .hirata-serial').textContent === '1 6 1 2 3 4 5 0 7' &&
        /Supplier1Year6Week12Day3Lot per day45Panel07/.test($$('#main .hf-list')[0].textContent));
  check('...and draws the last 4 as the copper panel', $$('#main .cu-panel').some(p => /4 5 0 7/.test(p.getAttribute('aria-label'))));
  setVal(typedBox, '34a7'); await settle();
  check('...letters are refused at the field', /Digits only/.test(mainText()));
  win.setHash('#/hirata/find'); await settle();
  const codes = fieldIn(doc.getElementById('main'), 'Hirata codes'); setVal(codes, '3407, 0119 161234507, 12x'); await settle();
  check('Find a pattern: one copper panel per good code, the bad one named', $$('.hirata-sheet')[0].querySelectorAll('.cu-panel').length === 3 && /Skipped: "12x"/.test(mainText()));
  $$('.hirata-sheet')[0].querySelectorAll('.panel-hirata-item')[0].click(); await settle();
  check('...tapping a pattern shows it large', !!openDialog() && !!openDialog().querySelector('.panel-zoom') &&
        /3407/.test(openDialog().querySelector('.panel-zoom-id').textContent));
  buttonByText(openDialog(), 'Close').click(); await settle();
  check('...and the 0-9 reference', $$('#main .hirata-ref-item').length === 10);

  // --- personal request templates (Q28, T-1..T-3)
  const tplReq = MRT.store.visibleRequests(r => r.requester_id === MRT.store.currentUser().id && r.status !== 'draft')[0];
  win.setHash('#/request/' + tplReq.id); await settle();
  openMore(); await settle();
  menuItem('Save as template').click(); await settle();
  let tdlg = doc.getElementById('dialogHost').querySelectorAll('dialog').filter(d => d.open).slice(-1)[0];
  setVal(fieldIn(tdlg, 'Template name'), 'Smoke template'); buttonByText(tdlg, 'Save template').click(); await settle();
  const tpl = MRT.store.myTemplates(MRT.store.currentUser().id).filter(t => t.name === 'Smoke template')[0];
  check('request page > Save as template: saved with everything, lot and panels included', !!tpl && tpl.fields.tool_id === tplReq.tool_id &&
        tpl.fields.type_id === tplReq.type_id && tpl.fields.lot_id === tplReq.lot_id && (tpl.fields.panels || []).join() === (tplReq.panels || []).join());
  openMore(); await settle();
  menuItem('Save as template').click(); await settle();
  tdlg = doc.getElementById('dialogHost').querySelectorAll('dialog').filter(d => d.open).slice(-1)[0];
  setVal(fieldIn(tdlg, 'Template name'), 'smoke TEMPLATE'); buttonByText(tdlg, 'Save template').click(); await settle();
  check('...the same name again stays in the dialog with the reason', /already/.test(tdlg.textContent) && tdlg.open);
  buttonByText(tdlg, 'Cancel').click(); await settle();
  win.setHash('#/new'); await settle();
  check('New request (empty) offers "Start from a template"', /Start from a template/.test(mainText()) && $$('#main .tpl-pick').some(b => /Smoke template/.test(b.textContent)));
  $$('#main .tpl-pick').filter(b => /Smoke template/.test(b.textContent))[0].click(); await settle();
  check('...picking it fills everything saved, lot and panels too', /from "Smoke template"/.test(mainText()) &&
        fieldIn(M(), 'Lot').value === (MRT.store.byId('lots', tpl.fields.lot_id) || {}).lot_number && win.location.hash.indexOf('template=' + tpl.id) !== -1);
  // T-3: a part hidden since is left empty, with a note
  const tType = MRT.store.byId('measurement_types', tpl.fields.type_id);
  if (tType) { tType.active = false; win.setHash('#/lab'); await settle(); win.setHash('#/new?template=' + tpl.id); await settle(); }
  check('...its measurement type hidden since: left empty, with a note (T-3)', !tType || /measurement type of this template is hidden/.test(mainText()));
  if (tType) tType.active = true;
  win.setHash('#/requests/templates'); await settle();
  check('My requests > My templates lists it with Use, Rename, Delete', /Smoke template/.test(mainText()) && !!buttonByText(doc.getElementById('main'), 'Use'));
  doc.getElementById('main').querySelectorAll('button').filter(b => b.getAttribute('aria-label') === 'Delete Smoke template')[0].click(); await settle();
  buttonByText(doc.getElementById('dialogHost').querySelectorAll('dialog').filter(d => d.open).slice(-1)[0], 'Delete').click(); await settle();
  check('...Delete removes it (audited)', !MRT.store.myTemplates(MRT.store.currentUser().id).some(t => t.name === 'Smoke template') &&
        MRT.store.data().audit_log.slice(-1)[0].entity === 'template');

  // --- Analytics (M5): tabs by role, click-through, filters
  const meA = MRT.store.currentUser();
  const mgr = MRT.store.data().users.filter(u => u.active && (u.roles || []).indexOf('manager') !== -1)[0];
  win.setHash('#/analytics/mine'); await settle();
  const tabNames = () => $$('#main .tab-btn').map(b => b.textContent);
  check('without the Manager role: My work and My requests only (Q52)', (meA.roles || []).indexOf('manager') !== -1 || tabNames().join() === 'My work,My requests');
  check('My requests tab: tiles, expected finish, where is my lot, turnaround per tool', /My open requests/.test(mainText()) && /Where is my lot/.test(mainText()) && /Typical turnaround per tool/.test(mainText()));
  const openTile = $$('#main .kpi-tile.is-link')[0];
  if (openTile) { openTile.click(); await settle(); }
  const listDlg = doc.getElementById('dialogHost').querySelectorAll('dialog').filter(d => d.open).slice(-1)[0];
  check('clicking a tile opens the requests behind it, with links and Download', !openTile || (!!listDlg && listDlg.querySelectorAll('a').some(a => /^#\/request\//.test(a.getAttribute('href'))) &&
        !!buttonByText(listDlg, 'Download these')));
  if (listDlg) { buttonByText(listDlg, 'Close') ? buttonByText(listDlg, 'Close').click() : listDlg.dispatch('cancel'); await settle(); }
  const saveRoles = meA.roles.slice();
  meA.roles = saveRoles.concat(['manager']);                 // try the manager tabs (in memory only)
  // a stand-in Chart.js: runs every chart's config, checks its data
  const madeCharts = [], badCharts = [];
  win.Chart = function (canvas, cfg) {
    madeCharts.push(cfg);
    const chartObj = { chartArea: { left: 0, right: 100, top: 0, bottom: 100 }, ctx: { createLinearGradient: () => ({ addColorStop() {} }) } };
    (cfg.data.datasets || []).forEach(d => {
      if (!Array.isArray(d.data) || d.data.length !== cfg.data.labels.length) badCharts.push(d.label);
      if (typeof d.backgroundColor === 'function') d.backgroundColor({ chart: chartObj });
    });
    if (cfg.options.onClick) cfg.options.onClick({}, [], this);
    this.destroy = () => {};
  };
  win.setHash('#/analytics/lab'); await settle();
  check('with the Manager role: Lab and Management tabs', tabNames().join() === 'My work,My requests,Lab,Management');
  check('Lab: open, late, turnaround, on time, backlog, per tool, load, clarification, hold reasons', ['Open now', 'Late now', 'Turnaround median', 'On time',
        'Backlog at each', 'Turnaround per tool', 'Load per quality engineer', 'Clarification rate per tool', 'On-hold reasons'].every(t => mainText().indexOf(t) !== -1));
  const a90 = MRT.analytics.get(MRT.analytics.defaultFilter());
  check('...the tile shows the rule\'s number', mainText().replace(/\s+/g, '').indexOf('Opennow' + a90.counts.open_now) !== -1);
  win.setHash('#/analytics/mgmt'); await settle();
  check('Management: per month by project, on time, Line stop response, demand per tool', ['Requests per month', 'Line stop', 'Demand per tool', 'capacity per tool is not set'].every(t => mainText().indexOf(t) !== -1));
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'vendor/xlsx.full.min.js'), 'utf8'), ctx, { filename: 'xlsx.full.min.js' });
  let pack = null;
  win.XLSX.writeFile = (wb, name) => { pack = { wb, name }; };
  const packMonth = fieldIn(doc.getElementById('main'), 'Month').value;
  buttonByText(doc.getElementById('main'), 'Download the pack').click(); await settle();
  const pm = MRT.domain.analytics(MRT.store.data(), { from_ymd: packMonth + '-01', to_ymd: MRT.domain.addDaysYmd(MRT.domain.addDaysYmd(packMonth + '-01', 32).slice(0, 7) + '-01', -1) },
    { now_ts: Date.now(), cal: MRT.store.calendar(), levelOf: MRT.analytics.levelOf });
  const sum = pack && win.XLSX.utils.sheet_to_json(pack.wb.Sheets.Summary, { header: 1 });
  const val = label => ((sum || []).filter(r => r[0] === label)[0] || [])[1];
  check('Management pack: one workbook for the month, seven sheets', !!pack && new RegExp('^mrt_management_pack_' + packMonth.replace('-', '_') + '_\\d{4}-\\d{2}-\\d{2}\\.xlsx$').test(pack.name) &&
        pack.wb.SheetNames.join() === 'Summary,Per tool,Per project,Line stop,On-hold reasons,Clarification,Requests', pack && pack.name + ' ' + pack.wb.SheetNames.join());
  check('...its Summary matches the rules for that month', val('Requests submitted') === pm.counts.submitted && val('Requests completed') === pm.counts.done &&
        val('Line stop requests') === pm.line_stop.n);
  delete win.XLSX;
  const fromBox = fieldIn(doc.getElementById('main'), 'From'); setVal(fromBox, '2030-01-01'); await settle();
  check('a filter with nothing in it shows 0 submitted', mainText().replace(/\s+/g, '').indexOf('Requests(submitted)0') !== -1);
  buttonByText(doc.getElementById('main'), 'Last 90 days').click(); await settle();
  meA.roles = saveRoles;
  check('every Analytics chart is built, one value per label', madeCharts.length >= 5 && !badCharts.length, madeCharts.length + ' charts, bad: ' + badCharts.join());
  delete win.Chart;
  win.setHash('#/analytics/work'); await settle();
  check('My work opens (a quality engineer sees their tools; others are told)', /Open \(my tools\)|You measure no tool/.test(mainText()));

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
  let f = JSON.parse(folder.files['mrt_data.json']); f.revision += 3; folder.files['mrt_data.json'] = JSON.stringify(f);
  tick(); await settle();
  check('someone else saved, nothing open here: the app reloads by itself (M4-3)', !visible('conflictBanner') && MRT.store.status().revision === f.revision);
  action('show-keys'); await settle();
  f = JSON.parse(folder.files['mrt_data.json']); f.revision += 2; folder.files['mrt_data.json'] = JSON.stringify(f);
  tick(); await settle();
  check('...with a dialog open it only shows the banner', visible('conflictBanner') && /Reload/.test(text('conflictBanner')) && MRT.store.status().revision !== f.revision);
  doc.dispatch('keydown', { key: 'Escape', target: doc.body }); await settle();
  if (openDialog()) { buttonByText(openDialog(), 'Close').click(); await settle(); }
  buttonByText(doc.getElementById('conflictBanner'), 'Reload').click(); await settle();
  check('Reload takes the new file', !visible('conflictBanner') && MRT.store.status().revision === f.revision);

  // --- Settings > Data: fill this folder with the demo data, then start empty (testing)
  await tab('data');
  buttonByText(M(), 'Fill with demo data').click(); await settle();
  let rdlg2 = openDialog(); setVal(rdlg2.querySelector('textarea'), 'try everything'); buttonByText(rdlg2, 'Fill with demo data').click(); await settle();
  check('Data: "Fill with demo data" - the big demo is in this folder, I am its Prince (admin) with my Windows ID',
        MRT.store.data().requests.length > 60 && MRT.store.currentUser().id === 'usr_demo_prince' && MRT.store.currentUser().windows_id === 'pkhurana' &&
        JSON.parse(folder.files['mrt_data.json']).requests.length > 60 && /Prince Khurana/.test(text('userName')));
  win.setHash('#/new'); await settle();
  check('...the form works on it: the demo magazines are offered', (function () { var inp = fieldIn(M(), 'Magazine'); inp.dispatch('focus'); var box = inp.closest('.ifield'); return !!box && box.querySelectorAll('.combo-opt').length === 20; })());
  check('...the combo filters as you type', (function () { var inp = fieldIn(M(), 'Magazine'); var code = MRT.store.list('magazines')[0].code; inp.value = code.slice(0, 3); inp.dispatch('input'); var box = inp.closest('.ifield'); var opts = box.querySelectorAll('.combo-opt'); return opts.length >= 1 && opts.every(function (o) { return (o.textContent.toLowerCase().indexOf(code.slice(0, 3).toLowerCase()) !== -1); }); })());
  check('...arrow + Enter picks the filtered magazine', (function () { var inp = fieldIn(M(), 'Magazine'); var code = MRT.store.list('magazines')[0].code; inp.value = code.slice(0, 3); inp.dispatch('input'); inp.dispatch('keydown', { key: 'ArrowDown' }); inp.dispatch('keydown', { key: 'Enter' }); return inp.value === code; })());
  check('...free text stays (a new magazine)', (function () { var inp = fieldIn(M(), 'Magazine'); setVal(inp, 'MAG-NEW-99'); return inp.value === 'MAG-NEW-99'; })());
  check('...Escape closes the popup', (function () { var inp = fieldIn(M(), 'Magazine'); inp.dispatch('focus'); inp.dispatch('keydown', { key: 'Escape' }); return inp.closest('.ifield').querySelector('.combo-pop').hidden === true; })());
  await tab('data');
  check('...the Backups list offers the copy made before', /before demo data/.test(mainText()));
  buttonByText(M(), 'Start empty').click(); await settle();
  rdlg2 = openDialog(); setVal(rdlg2.querySelector('textarea'), 'clean start'); buttonByText(rdlg2, 'Start empty').click(); await settle();
  check('..."Start empty": no lots or requests, only me as admin, the settings still open', MRT.store.data().requests.length === 0 && MRT.store.data().lots.length === 0 &&
        MRT.store.data().users.length === 1 && /Data file/.test(mainText()));

  // --- nothing unexpected went wrong
  const unexpected = errors.filter(e => !/save failed|read-only/.test(e));
  check('no unexpected console errors', unexpected.length === 0, unexpected.join(' | ').slice(0, 300));
  check('no unhandled promise rejections', rejections === 0, rejections);

  console.error = realError;
  console.log(failures ? failures + ' of ' + (passed + failures) + ' APP CHECKS FAILED' : 'app smoke ok (' + passed + ' checks)');
  if (failures) process.exitCode = 1;
})().catch(e => { console.error = realError; console.log('CRASH', e.stack); process.exitCode = 1; });
