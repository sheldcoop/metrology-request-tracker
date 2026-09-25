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
  'bellBtn', 'bellIcon', 'bellCount', 'helpBtn', 'keysBtn', 'userBtn', 'userAvatar', 'userName', 'userCaret', 'alertBanner', 'conflictBanner',
  'navItems', 'navFolder', 'navRev', 'navCollapse', 'main', 'toasts', 'dialogHost'];
const { win, doc, flush, tick, storage, El } = require('./fake-dom')({ ids: IDS, url: 'file:///Z:/Lab/MRT/index.html?who=CORP%5CPKhurana' });
// the data-action hooks index.html puts on the top bar
[['saveLed', 'save-state'], ['undoBtn', 'undo'], ['keysBtn', 'show-keys'], ['bellBtn', 'bell'], ['userBtn', 'user-menu'], ['navCollapse', 'nav-collapse']]
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
['js/config.js', 'js/themes.js', 'js/domain.js', 'js/adapters/storage-folder.js', 'js/adapters/mail.js', 'js/seed.js', 'js/store.js', 'js/demo-data.js', 'js/identity.js', 'js/analytics.js',
 'js/ui/core.js', 'js/ui/components.js', 'js/ui/glyphs.js', 'js/ui/heatmap.js', 'js/ui/overlays.js', 'js/ui/charts.js', 'js/ui/panelmap.js', 'js/ui/barcode.js', 'js/ui/magazine.js', 'js/ui/traveller.js', 'js/ui/hirata.js', 'js/ui/theme-gallery.js', 'js/exporter.js',
 'js/views/lab.js', 'js/views/settings.js', 'js/views/settings-health.js', 'js/views/settings-users.js',
 'js/views/settings-tools.js', 'js/views/settings-lists.js', 'js/views/settings-lots.js', 'js/views/settings-calendar.js', 'js/views/settings-audit.js',
 'js/views/settings-data.js', 'js/views/settings-look.js', 'js/views/extra-fields.js', 'js/views/lots.js', 'js/views/new.js', 'js/views/request-actions.js', 'js/views/request.js', 'js/views/queue.js', 'js/views/requests.js', 'js/views/board.js', 'js/views/slip.js', 'js/views/templates.js', 'js/views/analytics.js', 'js/views/hirata.js', 'js/views/help.js', 'js/app.js', 'tests/memory-storage.js'
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
  check('ten menu entries', items.length === 10, items.length);
  check('all ten live (Analytics came with M5)', items.filter(i => i.tagName === 'A').map(i => i.dataset.route).join() === 'lab,queue,requests,new,lots,board,hirata,analytics,settings,help');
  check('nothing greyed any more', items.filter(i => i.classList.contains('is-soon') || i.getAttribute('aria-disabled') === 'true').length === 0);

  // --- Lab status
  check('start page is Lab status', win.location.hash === '#/lab', win.location.hash);
  check('five tool plates', $$('.tool-plate').length === 5, $$('.tool-plate').length);
  check('each plate draws its tool glyph', $$('.tool-plate').filter(p => p.querySelector('svg.tool-glyph')).length === 5);
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
  check('the user menu opens with theme, start page and Change user', !!menu && /Theme/.test(menu.textContent) && /Start page/.test(menu.textContent) && /Change user/.test(menu.textContent));
  check('...and shows the roles', !!menu && /Admin/.test(menu.textContent));
  buttonByText(menu, 'Theme: Carbon Gray 100...').click(); await settle();
  const thDlg = doc.getElementById('dialogHost').querySelectorAll('dialog').filter(d => d.open).slice(-1)[0];
  const tcard = k => thDlg.querySelectorAll('.tg-card').filter(c => c.dataset.key === k)[0];
  check('Theme... opens the gallery: every theme of js/themes.js as a live sample, plus "Office default"',
        !!thDlg && thDlg.querySelectorAll('.tg-card').length === MRT.themes.list.length + 1 && thDlg.querySelectorAll('.tg-sample[data-theme="gruvbox-light"]').length === 1);
  tcard('catppuccin-mocha').click();
  check('...a click switches at once (theme, scheme) and is remembered per user', doc.documentElement.getAttribute('data-theme') === 'catppuccin-mocha' &&
        doc.documentElement.getAttribute('data-scheme') === 'dark' && storage['mrt.theme.' + MRT.store.currentUser().id] === 'catppuccin-mocha' && storage['mrt.theme.last'] === 'catppuccin-mocha');
  tcard('primer-hc').click();
  check('...Primer High Contrast marks the page high contrast', doc.documentElement.getAttribute('data-contrast') === 'high' && /#010409/.test(MRT.themes.css()));
  tcard('carbon-white').click();
  check('...Carbon White (light)', doc.documentElement.getAttribute('data-theme') === 'carbon-white' && doc.documentElement.getAttribute('data-scheme') === 'light' &&
        doc.documentElement.getAttribute('data-contrast') === 'normal');
  buttonByText(thDlg, 'Done').click(); await settle();
  doc.dispatch('keydown', { key: 'Escape', target: doc.body });
  doc.getElementById('keysBtn').click(); await settle();
  const keys = doc.getElementById('dialogHost').querySelectorAll('dialog').filter(d => d.open).slice(-1)[0];
  check('the shortcut list opens and lists only live pages', !!keys && /Lab status/.test(keys.textContent) && /Analytics/.test(keys.textContent));
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

  await tab('look');
  const lookCard = k => doc.getElementById('main').querySelectorAll('.tg-card').filter(c => c.dataset.key === k)[0];
  check('Settings > Look: every theme as a live sample, the office default marked, old keys still resolve', doc.getElementById('main').querySelectorAll('.tg-card').length === MRT.themes.list.length && lookCard('carbon-g100').classList.contains('is-on') && MRT.themes.byKey('hc').key === 'primer-hc');
  lookCard('gruvbox-light').click(); await settle();
  check('...a click makes Gruvbox Light the office default (audited)', MRT.store.getSetting('default_theme') === 'gruvbox-light' && MRT.store.data().audit_log.slice(-1)[0].field === 'default_theme');
  doc.getElementById('userBtn').click(); await settle();
  buttonByText(doc.body.querySelector('.menu'), 'Theme: Carbon White...').click(); await settle();
  const thDlg2 = doc.getElementById('dialogHost').querySelectorAll('dialog').filter(d => d.open).slice(-1)[0];
  thDlg2.querySelectorAll('.tg-card').filter(c => c.dataset.key === '')[0].click();
  check('..."Office default" in the gallery follows it again', doc.documentElement.getAttribute('data-theme') === 'gruvbox-light' && !storage['mrt.theme.' + MRT.store.currentUser().id]);
  buttonByText(thDlg2, 'Done').click(); await settle();
  lookCard('carbon-g100').click(); await settle();
  check('...back to Carbon Gray 100: stored as "the app default", and I follow it at once', MRT.store.getSetting('default_theme') === null &&
        doc.documentElement.getAttribute('data-theme') === 'carbon-g100');
  await tab('data');
  check('Data & PIN shows the file and today\'s backup', /mrt_data.json/.test(mainText()) && /latest/.test(mainText()));
  buttonByText(doc.getElementById('main'), 'Download a copy now').click(); await settle();

  // --- Lots (M2-1)
  win.setHash('#/lots'); await settle();
  check('Lots is live, empty at first, with Register lot', /No lots yet/.test(mainText()) && !!buttonByText(doc.getElementById('main'), 'Register lot'));
  buttonByText(doc.getElementById('main'), 'Register lot').click(); await settle();
  dlg2 = openDialog();
  check('...a lot is its number: no project, part number or build-up asked (F-6)', !fieldIn(dlg2, 'Project') && !fieldIn(dlg2, 'Part number') && !fieldIn(dlg2, 'Build-up'));
  check('...the lot fields are asked too (Purpose, Started on, Lot status ...)', !!fieldIn(dlg2, 'Purpose of the lot') && !!fieldIn(dlg2, 'Started on') && !!fieldIn(dlg2, 'Lot status'));
  setVal(fieldIn(dlg2, 'Lot number'), '18178-A'); buttonByText(dlg2, 'Save').click(); await settle();
  check('...a bad lot number is refused in the dialog', openDialog() === dlg2 && /split lot adds .01/.test(dlg2.textContent));
  const c4f = MRT.store.list('projects').filter(p => p.code === 'C4F')[0], bu1 = MRT.store.list('buildups')[0];
  setVal(fieldIn(dlg2, 'Lot number'), '18178'); setVal(fieldIn(dlg2, 'Panels'), '12');
  const purposeF = MRT.store.list('lot_fields').filter(f => f.label === 'Purpose of the lot')[0];
  setVal(fieldIn(dlg2, 'Purpose of the lot'), purposeF.choices[1].id);
  buttonByText(dlg2, 'Save').click(); await settle();
  const lot1 = (MRT.store.data().lots || []).filter(l => l.lot_number === '18178')[0];
  check('...lot 18178 is registered with 12 panels and its owner - no project or build-up on it',
        !!lot1 && lot1.panel_count === 12 && !('project_id' in lot1) && !('buildup_id' in lot1) && lot1.owner_id === MRT.store.currentUser().id && !openDialog());
  check('...and listed', /18178/.test(mainText()) && /1 of 1 lots/.test(mainText()));
  check('...with its purpose (DOE) stored', lot1.extra[purposeF.id] === purposeF.choices[1].id);
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
        isOpenStep('tool') && !isOpenStep('lot') && /Pick the tool first/.test(mainText()));
  buttonByText(M(), 'Submit').click(); await settle();
  check('Submit with nothing picked lists what is missing', !$('#main .req-errors').hidden && /Pick a tool/.test($('#main .req-errors').textContent));
  toolOpt('FIB').click(); await settle();
  check('picking FIB: its types, the destructive tick, afterwards fixed to scrap', !!fieldIn(M(), 'Measurement type') &&
        /destroys these panels/.test(mainText()) && fieldIn(M(), 'After measuring').value === 'scrap');
  check('...and its extra field (Cut side)', !!fieldIn(M(), 'Cut side'));
  setVal(fieldIn(M(), 'Measurement type'), MRT.store.list('measurement_types').filter(m => m.tool_id === fib().id)[0].id); await settle();
  buttonByText(M(), 'Next: Lot and panels').click(); await settle();
  check('Next opens step 2; step 1 folds into one line with the tool and type, ticked', isOpenStep('lot') && !isOpenStep('tool') &&
        /^FIB/.test(stepOf('tool').querySelector('.wz-sum').textContent) && stepOf('tool').classList.contains('is-done'));
  setVal(fieldIn(M(), 'Lot'), '18178'); await settle();
  check('typing a registered lot finds it - and fills in nothing: project, lot, build-up are separate (F-6)', /Lot found/.test(mainText()) &&
        !fieldIn(M(), 'Project').disabled && fieldIn(M(), 'Build-up').value === '');
  setVal(fieldIn(M(), 'Project'), c4f.id); await settle();
  check('...the project offers its part numbers', !!fieldIn(M(), 'Part number') && fieldIn(M(), 'Part number').querySelectorAll('option').some(o => o.value === pn77.id));
  setVal(fieldIn(M(), 'Part number'), pn77.id); await settle();
  const lyAll = $$('#main .layer-chip').length;
  setVal(fieldIn(M(), 'Build-up'), bu1.id); await settle();
  check('...no build-up: layers up to 5F / 5B; BU-01 picked: up to 2F / 2B', lyAll === 10 && $$('#main .layer-chip').length === 4);
  setVal(fieldIn(M(), 'Hirata IDs'), '3252-3255'); await settle();
  check('Hirata IDs: "3252-3255" becomes four chips, and the traveller card shows them', $$('#main .panel-chip').length === 4 &&
        /3252, 3253, 3254, 3255/.test($('#main .traveller-mini').textContent) && /FIB-YYMMDD-NN/.test($('#main .traveller-mini').textContent));
  setVal(fieldIn(M(), 'Hirata IDs'), '3252, abc'); await settle();
  check('...a typo is named at the field', /"abc" is not a Hirata ID/.test(mainText()));
  setVal(fieldIn(M(), 'Hirata IDs'), '3252-3255'); await settle();
  check('each typed Hirata ID shows its copper panel to the right (H-3)', $$('#main .panel-chips .panel-hirata-item').length === 4 &&
        $$('#main .panel-chips .panel-hirata-item')[0].children[1].classList.contains('cu-panel'));
  const lyNames = $$('#main .layer-chip').map(b => b.textContent);
  check('layers come from the build-up: 1FCO / 1BCO core, then F and B per layer', lyNames[0] === '1FCO' && lyNames[1] === '1BCO' && lyNames.indexOf('2F') !== -1);
  $$('#main .layer-chip').filter(b => b.textContent === '2F')[0].click(); await settle();
  check('...a click ticks one; the card shows it', $$('#main .layer-chip.is-on').length === 1 && /2F/.test($('#main .traveller-mini').textContent));
  buttonByText(M(), 'Submit').click(); await settle();
  const errs = $('#main .req-errors').textContent;
  check('Submit: still missing where the panels are and the destructive tick - and step 3 opens', /where the panels are now/.test(errs) && /tick that they may be scrapped/.test(errs) &&
        !/Pick a tool/.test(errs) && isOpenStep('where') && stepOf('where').classList.contains('is-missing'));
  setVal(fieldIn(M(), 'Magazine'), mag1.id); await settle();
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
  check('submitted: ID FIB-YYMMDD-01, Hirata IDs, layer, magazine slots, scrap, destructive ok', !!req1 && /^FIB-\d{6}-01$/.test(req1.request_no) &&
        req1.panels.join() === '3252,3253,3254,3255' && req1.project_id === c4f.id && req1.part_number_id === pn77.id && req1.buildup_id === bu1.id && req1.panel_count === 4 && req1.layers.join() === '2F' && req1.lot_id === lot1.id &&
        req1.magazine_id === mag1.id && req1.slots.join() === '3,4,5,6' && req1.after === 'scrap' && req1.destructive_ok === true);
  check('...its request page opens (M2 step 5)', win.location.hash === '#/request/' + req1.id && mainText().indexOf(req1.request_no) !== -1 && /M70345 · slots 3-6/.test(mainText()));
  check('the traveller card: ID, stamp "Submitted", priority stripe, the magazine with 4 slots', !!$('#main .traveller.prio-3') &&
        $('#main .tr-stamp').textContent === 'Submitted' && $$('#main .traveller .mz-slot.is-picked').length === 4 && /3252, 3253/.test($('#main .traveller').textContent));
  check('the request page shows each panel as copper with its decoded fields (H-3)', $$('#main .traveller .cu-panel').length === req1.panels.length &&
        /Lot per day/.test($('#main .traveller .hf-list').textContent));
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
  sbox2.value = 'near via 3'; sbox2.dispatch('input'); await settle();
  check('...and by words in its comments (Q41)', doc.body.querySelector('.search-results').textContent.indexOf(req1.request_no) !== -1);
  sbox2.value = ''; sbox2.dispatch('input');
  check('...and its timeline has "created", "submitted", then the comment', MRT.store.requestEvents(req1.id).map(e => e.kind + ':' + (e.to || '')).join() === 'created:draft,status:submitted,comment:');
  buttonByText(doc.getElementById('main'), 'Copy this request').click(); await settle();
  check('"Copy this request" prefills tool, lot, panels and layers - not where the panels are', $$('#main .tool-pick-opt.is-on').length === 1 &&
        fieldIn(M(), 'Lot').value === '18178' && fieldIn(M(), 'Hirata IDs').value === '3252, 3253, 3254, 3255' && $$('#main .layer-chip.is-on').length === 1 &&
        fieldIn(M(), 'Magazine').value === '' && fieldIn(M(), 'Or a note').value === '');
  check('...and opens at the first step that needs something: where the panels are', isOpenStep('where'));
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
  // a lot that is not registered yet, typed in the form (F-5); just how many panels (F-1); a note instead of a magazine
  win.setHash('#/new?tool=' + MRT.store.list('tools').filter(t => t.code === 'QVM')[0].id); await settle();
  check('?tool= picks the tool and opens step 2', $$('#main .tool-pick-opt.is-on').length === 1 && isOpenStep('lot'));
  setVal(fieldIn(M(), 'Lot'), '1917x'); await settle();
  check('a lot number that is not one is named at the field', /Lot numbers are digits/.test(mainText()));
  setVal(fieldIn(M(), 'Lot'), '19170'); await settle();
  check('...a new one says "New lot", the project and build-up stay open to pick', /New lot/.test(mainText()) && !fieldIn(M(), 'Project').disabled);
  setVal(fieldIn(M(), 'Project'), c4f.id); await settle(); setVal(fieldIn(M(), 'Build-up'), bu1.id); await settle();
  segPick('Panels', 'count'); await settle();
  check('..."Just how many" asks a number, 2 by default', fieldIn(M(), 'How many panels').value === '2');
  setVal(fieldIn(M(), 'How many panels'), '3'); await settle();
  setVal(fieldIn(M(), 'Measurement type'), MRT.store.list('measurement_types').filter(m => m.tool_id === MRT.store.list('tools').filter(t => t.code === 'QVM')[0].id)[0].id); await settle();
  setVal(fieldIn(M(), 'Or a note'), 'with Anna'); setVal(fieldIn(M(), 'Purpose'), 'Pad size');
  buttonByText(M(), 'Submit').click(); await settle();
  if (openDialog()) { buttonByText(openDialog(), 'Submit anyway').click(); await settle(); }
  const lotNew = MRT.store.data().lots.filter(l => l.lot_number === '19170')[0];
  const reqNew = MRT.store.data().requests.filter(r => r.status === 'submitted').slice(-1)[0];
  check('...Submit registers lot 19170 and the request uses it: C4F, the build-up, 3 panels, no IDs, the note', !!lotNew && reqNew.project_id === c4f.id && reqNew.buildup_id === bu1.id &&
        reqNew.lot_id === lotNew.id && reqNew.panel_count === 3 && reqNew.panels.length === 0 && reqNew.panel_location === 'with Anna');
  await MRT.store.cancelRequest(reqNew.id, 'test only');
  win.setHash('#/request/' + req1.id); await settle();
  buttonByText(doc.getElementById('main'), 'Cancel request').click(); await settle();
  const rdlg = openDialog(); setVal(rdlg.querySelector('textarea') || rdlg.querySelector('input'), 'Wrong lot');
  buttonByText(rdlg, 'Cancel request').click(); await settle();
  check('the requester cancels with a reason (Q35): stamp Cancelled, rail shows it, never deleted',
        MRT.store.byId('requests', req1.id).status === 'cancelled' && $('#main .tr-stamp').textContent === 'Cancelled' && !!$('#main .rail-side') && /Wrong lot/.test(mainText()));

  // --- the workflow on the request page (M3 step 1)
  buttonByText(doc.getElementById('main'), 'Copy this request').click(); await settle();
  setVal(fieldIn(M(), 'Or a note'), 'Magazine 15, top shelf');
  const dT2 = tickIn(doc.getElementById('main'), 'I know FIB'); dT2.checked = true; dT2.dispatch('change');
  buttonByText(doc.getElementById('main'), 'Submit').click(); await settle();
  if (openDialog()) { buttonByText(openDialog(), 'Submit anyway').click(); await settle(); }
  const req2 = MRT.store.data().requests.filter(r => r.status === 'submitted').slice(-1)[0];
  check('a second FIB request gets -02 and is assigned to Olga (primary, M3-7)', /-02$/.test(req2.request_no) && req2.assigned_to === olga.id && /Olga Quality/.test(mainText()));
  check('...the requester sees Edit request', !!buttonByText(doc.getElementById('main'), 'Edit request'));
  buttonByText(doc.getElementById('main'), 'Edit request').click(); await settle();
  check('Edit request opens the form, tool locked', mainText().indexOf('Edit ' + req2.request_no) !== -1 && $$('#main .tool-pick-opt').filter(b => b.disabled).length === 4);
  $$('#main .layer-chip').filter(b => b.textContent === '1FCO')[0].click(); await settle();
  buttonByText(doc.getElementById('main'), 'Save changes').click(); await settle();
  const edlg = openDialog(); setVal(edlg.querySelector('textarea') || edlg.querySelector('input'), 'Core too');
  buttonByText(edlg, 'Save changes').click(); await settle();
  check('...saved with a reason, the timeline says what changed', MRT.store.byId('requests', req2.id).layers.join() === '1FCO,2F' && /layers 2F -> 1FCO, 2F\. Reason: Core too/.test(mainText()));
  const meP = MRT.store.currentUser().id;
  MRT.store.setCurrentUser(olga.id); win.setHash('#/lab'); await settle(); win.setHash('#/request/' + req2.id); await settle();
  check('Olga sees Accept, Start, Hold, Needs clarification, Panels received', ['Accept', 'Start', 'Hold', 'Needs clarification', 'Panels received'].every(t => !!buttonByText($('#main .req-actbar'), t)));
  buttonByText($('#main .req-actbar'), 'Accept').click(); await settle();
  setVal(fieldIn(openDialog(), 'Expected done'), '2030-01-10'); buttonByText(openDialog(), 'Save').click(); await settle();
  check('Accept with an expected done date: stamp Accepted, date on the card', MRT.store.byId('requests', req2.id).status === 'accepted' && $('#main .tr-stamp').textContent === 'Accepted' && /Expected done/.test($('#main .traveller').textContent));
  check('...the new stamp presses on and the rail fills (P3)', $('#main .tr-stamp').classList.contains('is-stamping') && $('#main .status-rail').classList.contains('is-filling'));
  buttonByText($('#main .req-actbar'), 'Start').click(); await settle();
  check('Start asks "Panels received?" once, ticked (M3-3)', !!openDialog() && tickIn(openDialog(), 'Panels received').checked === true);
  setVal(fieldIn(openDialog(), 'Kept where'), 'FIB cabinet'); buttonByText(openDialog(), 'Save').click(); await settle();
  const r2 = MRT.store.byId('requests', req2.id);
  check('...In progress, panels received with the place', r2.status === 'in_progress' && r2.received_where === 'FIB cabinet' && /FIB cabinet/.test($('#main .traveller').textContent));
  const hasCu = !!$('#main .panel-hirata');
  check('...the panels slide into the lab tray (P4)' + (hasCu ? '' : ' [no Hirata IDs here]'), !hasCu || (!!$('#main .panel-tray.is-animating') && /lab tray/i.test($('#main .panel-tray').textContent)));
  let filedToast = null; const realToast = MRT.ui.toast;
  MRT.ui.toast = o => { if (o && o.cls === 'is-filed') filedToast = o; return realToast(o); };
  buttonByText($('#main .req-actbar'), 'Complete').click(); await settle();
  check('Complete: results folder proposed, panels Scrapped for FIB (M3-6)', /\\\\srv\\lab\\FIB\\/.test(fieldIn(openDialog(), 'Results folder').value) && fieldIn(openDialog(), 'The panels').value === 'scrapped');
  buttonByText(openDialog(), 'Save').click(); await settle();
  check('...Completed, the results path shown with Copy', MRT.store.byId('requests', req2.id).status === 'completed' && $('#main .tr-stamp').textContent === 'Completed' &&
        !!$$('#main button').filter(b => b.getAttribute('aria-label') === 'Copy Results path')[0]);
  MRT.ui.toast = realToast;
  check('...scrapped panels are crossed out (P4)' + (hasCu ? '' : ' [no Hirata IDs here]'), !hasCu || (!$('#main .panel-tray') && !!$('#main .panel-hirata-item.is-scrapped .panel-mark')));
  check('Complete: the toast files the folder and offers Copy results path (P6)', !!filedToast && filedToast.cls === 'is-filed' && filedToast.icon === 'folder' &&
        filedToast.actions.some(a => a.label === 'Copy results path'));
  MRT.store.setCurrentUser(meP); win.setHash('#/lab'); await settle(); win.setHash('#/request/' + req2.id); await settle();
  check('the requester now sees Results OK and Reopen (Q34)', !!buttonByText($('#main .req-actbar'), 'Results OK') && !!buttonByText($('#main .req-actbar'), 'Reopen'));
  buttonByText($('#main .req-actbar'), 'Results OK').click(); await settle();
  check('...Results OK: stamp Closed', $('#main .tr-stamp').textContent === 'Closed' && !$('#main .req-actbar'));
  buttonByText(doc.getElementById('main'), 'Print slip').click(); await settle();
  check('Print slip: the A6 traveller slip with the ID, its barcode and the panels (Q38)', !!$('#main .slip') && $('#main .slip-id').textContent === req2.request_no &&
        $('#main .barcode').querySelectorAll('rect').length > 30 && /DESTROYS THESE PANELS/.test($('#main .slip').textContent));
  check('...each panel drawn as its copper panel, with its decoded fields (H-3)', (req2.panels || []).length > 0 &&
        $$('#main .slip .cu-panel').length === req2.panels.length && /Panel/.test($('#main .slip .hf-list').textContent));
  win.setHash('#/lab'); await settle();
  req2.request_no.split('').concat(['Enter']).forEach(k => doc.dispatch('keydown', { key: k, target: doc.body })); await settle();
  check('a scanner typing the ID + Enter anywhere opens the request (Q38)', win.location.hash === '#/request/' + req2.id);

  // --- My queue (M3 step 2)
  const fibType = MRT.store.list('measurement_types').filter(m => m.tool_id === fib().id)[0].id;
  const prioBy = code => MRT.store.list('priorities').filter(p => p.code === code)[0].id;
  const base = { project_id: c4f.id, tool_id: fib().id, type_id: fibType, lot_id: lot1.id, panel_location: 'Rack A', destructive_ok: true, after: 'scrap', purpose: 'x' };
  const qN = await MRT.store.submitRequest({ fields: Object.assign({}, base, { panels: [5], priority_id: prioBy('P3') }) });
  const qL = await MRT.store.submitRequest({ fields: Object.assign({}, base, { panels: [6], priority_id: prioBy('P1'), priority_reason: 'line 2 down' }) });
  MRT.store.setCurrentUser(olga.id); win.setHash('#/lab'); await settle(); win.setHash('#/queue'); await settle();
  check('the bell shows Olga what is new: her tool\'s requests (M4)', visible('bellCount') && +text('bellCount') >= 2);
  doc.getElementById('bellBtn').click(); await settle();
  const bellMenu = doc.body.querySelector('.menu');
  check('...opening it lists them, with the new request from Prince', !!bellMenu && bellMenu.textContent.indexOf('New request ' + qL.request_no) !== -1);
  buttonByText(bellMenu, 'Mark all as read').click(); await settle();
  check('..."Mark all as read" clears the count', !visible('bellCount'));
  const qRows = $$('#main .q-row');
  check('My queue: Olga\'s FIB requests, the Line stop on top (M2-5)', qRows.length === 2 && qRows[0].textContent.indexOf(qL.request_no) !== -1 && qRows[0].classList.contains('prio-1'));
  check('..."assigned to you" first, one-click Accept / Start on the row', /Assigned to you/.test(mainText()) && !!buttonByText(qRows[0], 'Accept') && !!buttonByText(qRows[0], 'Start'));
  qRows.forEach(tr => { const cb = tr.querySelector('input'); cb.checked = true; cb.dispatch('change'); });
  await settle();
  check('...ticking two offers Accept all (2)', !!buttonByText($('#main .queue-bulk'), 'Accept all (2)'));
  buttonByText($('#main .queue-bulk'), 'Accept all (2)').click(); await settle(); await settle();
  check('...Accept all accepts both', [qN.id, qL.id].every(id => MRT.store.byId('requests', id).status === 'accepted'));
  MRT.store.setCurrentUser(meP); await MRT.store.saveEntry('users', { id: meP, fields: { email: 'prince@example.com' } }); MRT.store.setCurrentUser(olga.id);
  const offer = MRT.requestActions.emailOffer(MRT.store.byId('requests', qN.id), 'clarify');
  check('Clarify offers a ready Outlook draft to the requester (M4-4)', !!offer && /^Email Prince/.test(offer.label));
  check('...the draft: to, subject with the ID', /^mailto:prince@example\.com\?subject=%5B/.test(MRT.adapters.mail.mailtoUrl({ to: ['prince@example.com'], subject: '[' + qN.request_no + '] Question about', body: 'x' })));
  await MRT.store.requestAction(qN.id, 'clarify', { text: 'Which side should we cut?' });
  MRT.store.setCurrentUser(meP);

  // --- My requests (M3 step 3)
  win.setHash('#/requests'); await settle();
  const mRows = $$('#main .q-row');
  check('My requests: open ones shown, the one waiting on me first', mRows.length === 2 && mRows[0].textContent.indexOf(qN.request_no) !== -1 && mRows[0].classList.contains('is-mine') && /1 waiting on you/.test(mainText()));
  buttonByText(mRows[0], 'Answered').click(); await settle();
  setVal(fieldIn(openDialog(), 'Your answer'), 'Front side, via row 3'); buttonByText(openDialog(), 'Save').click(); await settle();
  check('...Answered right there: back to Accepted (M3-2)', MRT.store.byId('requests', qN.id).status === 'accepted' && !/waiting on you/.test(mainText()));
  setVal(fieldIn(doc.getElementById('main'), 'Show'), 'all'); await settle();
  check('..."All": cancelled and closed ones too, the closed one stamped Closed', $$('#main .q-row').length === 5 && /Closed/.test(mainText()) && /Cancelled/.test(mainText()));
  setVal(fieldIn(doc.getElementById('main'), 'Lot or request number'), req2.request_no); await settle();
  check('...find by request number', $$('#main .q-row').length === 1);

  // --- the board (M3 step 4)
  MRT.store.setCurrentUser(olga.id); win.setHash('#/lab'); await settle(); win.setHash('#/board'); await settle();
  check('Board: a lane per tool, five columns, the two accepted FIB cards', $$('#main .board-lane').length === 5 && $$('#main .board-colhead').length === 5 &&
        $$('#main .board-cell').filter(c => c.dataset.col === 'accepted' && c.dataset.tool === fib().id)[0].querySelectorAll('.bcard').length === 2);
  const lsCard = $$('#main .bcard').filter(c => c.dataset.id === qL.id)[0];
  check('...the Line stop card pulses, has a needed-by gauge, nothing is draggable', lsCard.classList.contains('is-urgent') && !!lsCard.querySelector('.bgauge') &&
        $$('#main .bcard').every(c => c.getAttribute('draggable') !== 'true'));
  lsCard.dispatch('click'); await settle();
  const drw = win.document.querySelector('dialog.drawer');
  check('...a click opens the side panel with the traveller and Start (P5-3)', !!drw && /Start/.test(drw.textContent) && /Open full page/.test(drw.textContent));
  buttonByText(drw, 'Start').click(); await settle();
  check('...Start from the panel asks "Panels received?"', !!openDialog() && !!tickIn(openDialog(), 'Panels received'));
  buttonByText(openDialog(), 'Save').click(); await settle();
  check('...and the card moves, the panel closes', MRT.store.byId('requests', qL.id).status === 'in_progress' && !win.document.querySelector('dialog.drawer') &&
        $$('#main .board-cell').filter(c => c.dataset.col === 'in_progress' && c.dataset.tool === fib().id)[0].querySelectorAll('.bcard').length === 1);
  check('...tools with nothing on them fold to one line', $$('#main .board-fold').length === $$('#main .board-lane.is-empty').length);
  const fibPick = $$('#main .tool-pick').filter(b => b.dataset.pick === fib().id)[0];
  fibPick.click(); await settle();
  check('Board tool picker: one tool shows only its lane (Prince)', $$('#main .board-lane').length === 1 && /FIB/.test($('#main .board-lane').textContent) &&
        $$('#main .tool-pick.is-on')[0].dataset.pick === fib().id);
  $$('#main .tool-pick').filter(b => b.dataset.pick === 'all')[0].click(); await settle();
  check('...All tools brings every lane back', $$('#main .board-lane').length === 5);
  $$('#main .tool-pick').filter(b => b.dataset.only === 'linestop')[0].click(); await settle();
  check('Board "Show Line stop": only Line stop cards (P5-5)', $$('#main .bcard').length >= 1 && $$('#main .bcard').every(c => c.classList.contains('prio-1')));
  $$('#main .tool-pick').filter(b => b.dataset.only === 'all')[0].click(); await settle();
  const bs = $('#main .board-search'); bs.value = qL.request_no; bs.dispatch('input');
  check('Board search: the match stays, the rest dims (P5-6)', !$$('#main .bcard').filter(c => c.dataset.id === qL.id)[0].classList.contains('is-miss') &&
        $$('#main .bcard.is-miss').length === $$('#main .bcard').length - 1);
  bs.value = ''; bs.dispatch('input');
  const doneSw = $$('#main input').filter(i => i.getAttribute('role') === 'switch')[0];
  doneSw.checked = false; doneSw.dispatch('change'); await settle();
  check('Board: the Completed column can be hidden (P5-7)', $$('#main .board-colhead').length === 4 && !$$('#main .board-cell').some(c => c.dataset.col === 'completed'));
  const doneSw2 = $$('#main input').filter(i => i.getAttribute('role') === 'switch')[0];
  doneSw2.checked = true; doneSw2.dispatch('change'); await settle();
  MRT.store.setCurrentUser(MRT.store.data().users.filter(u => u.name === 'Tom Huber')[0].id); win.setHash('#/lab'); await settle(); win.setHash('#/board'); await settle();
  win.setHash('#/lab'); await settle();
  const fibPlateQ = $$('#main .tool-plate').filter(p => /FIB/.test(p.textContent))[0];
  check('Lab status shows each tool\'s queue: open, oldest open, typical wait (Q46)', /2 open/.test(fibPlateQ.textContent) && /Oldest open/.test(fibPlateQ.textContent) && /lab time \(last/.test(fibPlateQ.textContent));
  win.setHash('#/board'); await settle();
  check('an engineer reads the board, drags nothing', $$('#main .bcard').length >= 2 && !$$('#main .bcard').some(c => c.getAttribute('draggable') === 'true'));
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
  check('...a lot lists the projects of its requests (F-6)', $$('#main tr').filter(r => /18178/.test(r.textContent) && !/18178\.01/.test(r.textContent))[0].textContent.indexOf('C4F') !== -1);

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
    magazine_id: mag1.id, slots: [1, 2], destructive_ok: true, after: 'scrap', purpose: 'x' } });
  win.setHash('#/new?lot=' + lot1.id); await settle();
  toolOpt('QVM').click(); await settle();
  setVal(fieldIn(M(), 'Magazine'), mag1.id); await settle();
  check('the form greys out slots another open request holds, with its ID', mzs()[0].classList.contains('is-taken') && mzs()[0].tagName === 'DIV' && mzs()[0].textContent.indexOf(inMag.request_no) !== -1);
  const qvmReq = await MRT.store.submitRequest({ fields: { project_id: c4f.id, tool_id: MRT.store.list('tools').filter(t => t.code === 'QVM')[0].id,
    type_id: MRT.store.list('measurement_types').filter(m => m.tool_id === MRT.store.list('tools').filter(t => t.code === 'QVM')[0].id)[0].id, lot_id: lot1.id,
    panels: ['3270'], priority_id: MRT.store.list('priorities')[2].id, magazine_id: mag1.id, slots: [7], after: 'back_to_me', purpose: 'x' } });
  const qvmT = MRT.store.list('tools').filter(t => t.code === 'QVM')[0];
  await MRT.store.saveEntry('tools', { id: qvmT.id, fields: { primary_operator_id: olga.id } });
  MRT.store.setCurrentUser(olga.id);
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
  check('...and says when nothing is found', guides.every(g => g.hidden) && /Nothing found/.test(mainText()));
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

  // --- the alert strip (M1-2, built in the M3 audit)
  win.setHash('#/lab'); await settle(); tick(); await settle();
  const strip = doc.getElementById('alertBanner');
  const cStrip = MRT.domain.stripCounts({ user: MRT.store.currentUser(), tools: MRT.store.list('tools'), requests: MRT.store.data().requests, now_ts: Date.now(),
    cal: MRT.store.calendar(), levelOf: r => (MRT.store.byId('priorities', r.priority_id) || {}).level });
  check('the strip shows on every page when something is open, with the same counts as the rule', !strip.hidden &&
        new RegExp(cStrip.open + ' open').test(strip.textContent) && /Line stop/.test(strip.textContent) && /Late/.test(strip.textContent));
  const segs = strip.querySelectorAll('a').filter(a => a.classList.contains('strip-seg'));
  check('...four counts, each a link into My queue or My requests', segs.length === 4 && segs.every(a => /^#\/(queue|requests)\//.test(a.getAttribute('href'))));
  win.setHash(segs[1].getAttribute('href')); await settle();
  check('..."Late" opens the list on that filter', /My queue|My requests/.test(mainText()) &&
        (fieldIn(doc.getElementById('main'), 'Status') || { value: '' }).value === (cStrip.scope === 'tools' ? 'late' : 'open'));

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
  check('...and the 0-9 reference', $$('#main .hirata-ref-item').length === 10);

  // --- personal request templates (Q28, T-1..T-3)
  const tplReq = MRT.store.visibleRequests(r => r.requester_id === MRT.store.currentUser().id && r.status !== 'draft')[0];
  win.setHash('#/request/' + tplReq.id); await settle();
  buttonByText(doc.getElementById('main'), 'Save as template').click(); await settle();
  let tdlg = doc.getElementById('dialogHost').querySelectorAll('dialog').filter(d => d.open).slice(-1)[0];
  setVal(fieldIn(tdlg, 'Template name'), 'Smoke template'); buttonByText(tdlg, 'Save template').click(); await settle();
  const tpl = MRT.store.myTemplates(MRT.store.currentUser().id).filter(t => t.name === 'Smoke template')[0];
  check('request page > Save as template: saved with the request\'s tool and type, no lot or panels', !!tpl && tpl.fields.tool_id === tplReq.tool_id &&
        tpl.fields.type_id === tplReq.type_id && !('lot_id' in tpl.fields) && !('panels' in tpl.fields));
  buttonByText(doc.getElementById('main'), 'Save as template').click(); await settle();
  tdlg = doc.getElementById('dialogHost').querySelectorAll('dialog').filter(d => d.open).slice(-1)[0];
  setVal(fieldIn(tdlg, 'Template name'), 'smoke TEMPLATE'); buttonByText(tdlg, 'Save template').click(); await settle();
  check('...the same name again stays in the dialog with the reason', /already/.test(tdlg.textContent) && tdlg.open);
  buttonByText(tdlg, 'Cancel').click(); await settle();
  win.setHash('#/new'); await settle();
  check('New request (empty) offers "Start from a template"', /Start from a template/.test(mainText()) && $$('#main .tpl-pick').some(b => /Smoke template/.test(b.textContent)));
  $$('#main .tpl-pick').filter(b => /Smoke template/.test(b.textContent))[0].click(); await settle();
  check('...picking it fills tool and type; lot and panels stay empty', /from "Smoke template"/.test(mainText()) &&
        /Pick the lot|Lot/.test(mainText()) && win.location.hash.indexOf('template=' + tpl.id) !== -1);
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
  doc.getElementById('keysBtn').click(); await settle();
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
        MRT.store.data().requests.length > 200 && MRT.store.currentUser().id === 'usr_demo_prince' && MRT.store.currentUser().windows_id === 'pkhurana' &&
        JSON.parse(folder.files['mrt_data.json']).requests.length > 200 && /Prince Khurana/.test(text('userName')));
  win.setHash('#/new'); await settle();
  check('...the form works on it: the demo magazines are offered', fieldIn(M(), 'Magazine').querySelectorAll('option').length === 21);
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
