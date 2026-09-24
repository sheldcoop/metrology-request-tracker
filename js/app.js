/**
 * Metrology Request Tracker - app.js  (shell pattern from ABF Tracker v2)
 *
 * The shell: browser check, data-folder gate, who-are-you gates (first run,
 * sign-up, "Is this you?"), theme, hash router, side menu with the pages to
 * come (M1-6), save lamp + Undo, alert strip stub, search, the two timers
 * (1 s ticker, revision check), user menu and keyboard shortcuts.
 *
 * No inline onclick anywhere: clicks are handled by delegation on
 * [data-action] or by el(..., {onclick}). All writes go through store.js;
 * who you are comes from identity.js only.
 */
window.MRT = window.MRT || {};
window.MRT.views = window.MRT.views || {};
window.MRT.app = (function () {
  'use strict';

  var cfg = window.MRT.config;
  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var identity = window.MRT.identity;
  var D = window.MRT.domain;

  var MILESTONE = 'M1';
  var THEMES = ['dark', 'light', 'hc'];

  /**
   * The side menu, in order (M1-6). A page is live when its view file has
   * registered itself in MRT.views; until then it shows greyed with the
   * milestone that brings it. Unlocking a page = adding its view.
   */
  var NAV = [
    { key: 'lab',       label: 'Lab status',  icon: 'gauge',       g: 'l', ms: 'M1' },
    { key: 'queue',     label: 'My queue',    icon: 'inbox',       g: 'q', ms: 'M3' },
    { key: 'requests',  label: 'My requests', icon: 'requests',    g: 'r', ms: 'M3' },
    { key: 'new',       label: 'New request', icon: 'request_new', g: 'n', ms: 'M2' },
    { key: 'lots',      label: 'Lots',        icon: 'lots',        g: 'o', ms: 'M2' },
    { key: 'board',     label: 'Board',       icon: 'board',       g: 'b', ms: 'M3' },
    { key: 'analytics', label: 'Analytics',   icon: 'analytics',   g: 'a', ms: 'M5' },
    { key: 'settings',  label: 'Settings',    icon: 'settings',    g: 's', ms: 'M1' },
    { key: 'help',      label: 'Help',        icon: 'help',        g: 'h', ms: 'M1' }
  ];

  /** Pages reached by a link, not from the menu. */
  var PAGES = [
    { key: 'request', label: 'Request', icon: 'requests', ms: 'M2', menu: 'requests' }
  ];

  function navEntry(key) { return NAV.concat(PAGES).filter(function (n) { return n.key === key; })[0] || null; }
  function isLive(key) { return !!window.MRT.views[key]; }
  function livePages() { return NAV.filter(function (n) { return isLive(n.key); }); }

  var app = {
    route: 'lab',
    theme: 'dark',
    tickTimer: null,
    revisionTimer: null,
    currentView: null
  };

  /* ------------------------------------------------------------------ *
   * Per-PC preferences (localStorage, keyed per user)
   * ------------------------------------------------------------------ */

  function prefKey(name, userId) { return cfg.local_prefix + name + '.' + (userId || 'default'); }
  function readPref(name, userId) { try { return localStorage.getItem(prefKey(name, userId)); } catch (e) { return null; } }
  function writePref(name, value) {
    try { localStorage.setItem(prefKey(name, store.status().currentUserId), value); } catch (e) { /* private mode */ }
  }

  /** The start page: the one picked in the user menu, else by role (Q16, M3-12). */
  function readHome(userId) {
    var v = readPref('home', userId);
    if (isLive(v) && v !== 'settings' && v !== 'help') return v;
    var byRole = D.homeFor(store.byId('users', userId));
    return isLive(byRole) ? byRole : 'lab';
  }
  function readTheme(userId) { var v = readPref('theme', userId); return THEMES.indexOf(v) !== -1 ? v : 'dark'; }

  function applyTheme(theme) {
    app.theme = THEMES.indexOf(theme) === -1 ? 'dark' : theme;
    document.documentElement.setAttribute('data-theme', app.theme);
    ui.rethemeCharts();   // canvas colours do not follow CSS on their own
  }

  function applyMotion(reduce) {
    app.reduceMotion = !!reduce;
    if (reduce) document.documentElement.setAttribute('data-motion', 'reduce');
    else document.documentElement.removeAttribute('data-motion');
  }

  function applyNav(collapsed) {
    if (collapsed) document.documentElement.setAttribute('data-nav', 'collapsed');
    else document.documentElement.removeAttribute('data-nav');
    var btn = document.getElementById('navCollapse');
    var label = collapsed ? 'Expand the menu' : 'Collapse the menu';
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    btn.setAttribute('aria-label', label);
    btn.title = label + '  ([)';
    ui.mount(btn, [ui.icon(collapsed ? 'chevron_right' : 'chevron_left', 16), ui.el('span', { class: 'nav-label', text: 'Collapse' })]);
  }

  function applyPrefs(userId) {
    applyTheme(readTheme(userId));
    applyMotion(readPref('motion', userId) === 'reduce');
    applyNav(readPref('nav', userId) === 'collapsed');
  }

  function setTheme(next) { applyTheme(next); writePref('theme', next); }
  function setReduceMotion(on) { applyMotion(on); writePref('motion', on ? 'reduce' : 'full'); }
  function toggleNav() {
    var collapsed = document.documentElement.getAttribute('data-nav') !== 'collapsed';
    applyNav(collapsed);
    writePref('nav', collapsed ? 'collapsed' : 'full');
  }

  /* ------------------------------------------------------------------ *
   * Boot and the data folder
   * ------------------------------------------------------------------ */

  function boot() {
    applyPrefs(null);
    wireGlobalEvents();
    paintStaticChrome();

    var adapters = { folder: window.MRT.adapters.storageFolder };
    store.init(adapters[cfg.adapters.storage] || adapters.folder);
    if (!store.isSupported()) return showUnsupported();

    // Try the remembered folder without a prompt; a prompt needs a click.
    store.hasSavedConnection().then(function (has) {
      if (!has) return showConnect();
      return store.reconnect({ silent: true }).then(function (data) {
        if (data) return afterLoad();
        return store.savedConnectionLabel().then(showReconnect);
      });
    }).catch(function (e) {
      console.error('MRT: start-up failed', e);
      showConnect(e.message);
    });
  }

  function connect() {
    store.connect().then(function () {
      ui.toast({ message: 'Data folder connected.', kind: 'success' });
      afterLoad();
    }).catch(function (e) {
      if (e && e.name === 'AbortError') return;   // the picker was closed
      console.error('MRT: connect failed', e);
      showConnect(e.message);
    });
  }

  function reconnect() {
    store.reconnect().then(function (data) {
      if (data) afterLoad(); else showConnect();
    }).catch(function (e) {
      console.error('MRT: reconnect failed', e);
      showConnect(e.message);
    });
  }

  /* ------------------------------------------------------------------ *
   * Gate screens
   * ------------------------------------------------------------------ */

  function gate(children) {
    document.getElementById('shell').hidden = true;
    document.getElementById('gate').hidden = false;
    // the reticle of a measuring tool, working: what this app is about
    var mark = ui.toolGlyph('generic', { size: 40, state: ui.reducedMotion() ? 'idle' : 'live' });
    ui.mount(document.getElementById('gateCard'), [
      ui.el('div', { class: 'gate-brand' }, [mark, ui.el('strong', { text: cfg.app_name })]),
      children
    ]);
    ui.linkLabels(document.getElementById('gateCard'));
    var first = document.querySelector('#gateCard input, #gateCard .btn-primary');
    if (first) first.focus();
  }

  function note(text) { return ui.el('div', { class: 'gate-note', text: text }); }
  function lead(text) { return ui.el('p', { class: 'gate-lead', text: text }); }
  function problem(text) { return text ? ui.el('p', { class: 'gate-error', role: 'alert' }, [ui.icon('alert', 16), ui.el('span', { text: text })]) : null; }

  function showUnsupported() {
    gate([
      ui.el('h1', { text: 'This browser is not supported' }),
      lead(store.unsupportedMessage()),
      note('The app keeps its data in a folder on the share. Writing to a folder needs the File System Access API, ' +
           'which only Edge and Chrome have. Use "Metrology Tool.cmd" - it opens Edge for you.')
    ]);
  }

  function showConnect(errorMessage) {
    gate([
      ui.el('h1', { text: 'Connect the data folder' }),
      lead('Pick the folder named "data" next to index.html (make one if it is not there). ' +
           'An empty folder is set up for you.'),
      problem(errorMessage),
      ui.el('div', { class: 'gate-actions' }, [
        ui.button('Choose data folder', { kind: 'primary', icon: 'folder', dataset: { action: 'connect' } })
      ]),
      note('The browser remembers the folder, so next time this is one click. Daily backups go into data\\backups\\.')
    ]);
  }

  function showReconnect(name) {
    gate([
      ui.el('h1', { text: 'Welcome back' }),
      lead('The browser asks once per visit before the app may use the data folder.'),
      ui.el('div', { class: 'gate-actions' }, [
        ui.button('Reconnect ' + (name || 'data folder'), { kind: 'primary', icon: 'folder', dataset: { action: 'reconnect' } }),
        ui.button('Choose another folder', { kind: 'ghost', dataset: { action: 'connect' } })
      ])
    ]);
  }

  /** After a load: first run, or find out who is at the keyboard. */
  function afterLoad() {
    var s = store.status();
    if (s.upgradedFrom !== null) {
      ui.toast({ kind: 'info', timeout_ms: 8000, message: 'The data file was upgraded from an older version. ' +
        'A copy of the old file is in ' + cfg.backup_dir + '\\.' });
    }
    if (!store.data().users.length) return showFirstRun();
    var ident = identity.detect();
    if (!ident) return showAskId();
    signIn(ident);
  }

  function signIn(ident) {
    var user = store.findUserByIdentity(ident);
    if (user) {
      store.setCurrentUser(user.id);
      return openShell();
    }
    var inactive = store.data().users.filter(function (u) { return !u.active && D.identityMatches(u, ident); })[0];
    if (inactive) {
      return gate([
        ui.el('h1', { text: 'Your account is switched off' }),
        lead(inactive.name + ' (' + ident.windows_id + ') is deactivated. Ask an admin to switch it on again.'),
        ui.el('div', { class: 'gate-actions' }, [ui.button('Not me - change user', { kind: 'ghost', dataset: { action: 'change-user' } })])
      ]);
    }
    showWhoAreYou(ident);
  }

  /** A small form inside the gate card: fields + submit, errors shown inline. */
  function gateForm(fields, submitLabel, onSubmit, extra) {
    var err = ui.el('div', { class: 'gate-form-error' });
    var btn = ui.button(submitLabel, { kind: 'primary', type: 'submit' });
    var form = ui.el('form', { class: 'gate-form', novalidate: true }, [
      fields.map(function (f) { return f.node; }), err,
      ui.el('div', { class: 'gate-actions' }, [btn, extra || null])
    ]);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (btn.disabled) return;
      ui.clear(err);
      btn.disabled = true;
      btn.classList.add('is-busy');
      Promise.resolve().then(onSubmit).catch(function (e) {
        if (e && e.shownAtField) return;          // the field says it already
        console.error('MRT:', e);
        ui.mount(err, problem(e.message || String(e)));
      }).then(function () { btn.disabled = false; btn.classList.remove('is-busy'); });
    });
    return form;
  }

  /** Mark a field wrong and stop the submit; the message shows under the field only. */
  function fail(field, message) {
    field.setState('invalid', message);
    field.input.focus();
    var e = new Error(message);
    e.shownAtField = true;
    throw e;
  }

  function showFirstRun() {
    var ident = identity.detect();
    var name = ui.field({ label: 'Your name', placeholder: 'First and last name' });
    var wid = ui.field({ label: 'Windows user name', value: ident ? (ident.domain ? ident.domain + '\\' : '') + ident.windows_id : '',
                         hint: ident ? 'From the launcher.' : 'As you log in to Windows, e.g. pkhurana or CORP\\pkhurana.', mono: true });
    var email = ui.field({ label: 'Company email (optional)', type: 'email', hint: 'Used later for email and single sign-on.' });
    var pin = ui.field({ label: 'Admin PIN', type: 'password', inputmode: 'numeric', hint: '4 to 12 digits. Asked before every admin change.' });
    var pin2 = ui.field({ label: 'Admin PIN again', type: 'password', inputmode: 'numeric' });
    gate([
      ui.el('h1', { text: 'Set up the app' }),
      lead('Nobody uses this data file yet. You become its first Admin. Everything else - tools, people, lists - ' +
           'is set in Settings afterwards.'),
      gateForm([name, wid, email, pin, pin2], 'Create and start', function () {
        [name, wid, email, pin, pin2].forEach(function (f) { f.setState(null); });
        if (!name.value().trim()) fail(name, 'Enter your name');
        var login = D.parseWindowsLogin(wid.value());
        if (!login) fail(wid, 'Letters, digits, . - _ only; optionally DOMAIN\\ in front');
        if (email.value().trim() && !D.isEmail(email.value().trim())) fail(email, 'That email address does not look right');
        if (!/^[0-9]{4,12}$/.test(pin.value())) fail(pin, 'The PIN must be 4 to 12 digits');
        if (pin.value() !== pin2.value()) fail(pin2, 'The two PINs are not the same');
        return store.createFirstAdmin({ name: name.value(), windows_id: login.windows_id, domain: login.domain,
                                        email: email.value(), pin: pin.value() }).then(function () {
          identity.useTyped((login.domain ? login.domain + '\\' : '') + login.windows_id);
          ui.toast({ kind: 'success', message: 'Set up. You are the first Admin.' });
          openShell();
        });
      }),
      note('Keep the PIN safe: it is the only thing between any user and the admin pages.')
    ]);
  }

  function showAskId(message) {
    var wid = ui.field({ label: 'Windows user name', mono: true, hint: 'As you log in to Windows, e.g. pkhurana.' });
    gate([
      ui.el('h1', { text: 'Who are you?' }),
      lead('Next time, open the app with "Metrology Tool.cmd" next to index.html - it tells the app who you are.'),
      problem(message),
      gateForm([wid], 'Continue', function () {
        wid.setState(null);
        var ident = identity.useTyped(wid.value());
        if (!ident) fail(wid, 'Letters, digits, . - _ only; optionally DOMAIN\\ in front');
        signIn(ident);
      })
    ]);
  }

  function showWhoAreYou(ident) {
    var name = ui.field({ label: 'Your name', placeholder: 'First and last name' });
    var email = ui.field({ label: 'Company email (optional)', type: 'email' });
    gate([
      ui.el('h1', { text: 'Who are you?' }),
      lead('Your Windows user name ' + (ident.domain ? ident.domain + '\\' : '') + ident.windows_id +
           ' is not known here yet. Tell us your name - you are asked only once.'),
      gateForm([name, email], 'Continue', function () {
        name.setState(null); email.setState(null);
        if (!name.value().trim()) fail(name, 'Enter your name');
        if (email.value().trim() && !D.isEmail(email.value().trim())) fail(email, 'That email address does not look right');
        var matches = store.nameMatches(name.value());
        if (matches.length) return showIsThisYou(ident, name.value(), email.value(), matches);
        return register(ident, name.value(), email.value(), false);
      }, ui.button('Not me - change user', { kind: 'ghost', dataset: { action: 'change-user' } }))
    ]);
  }

  function showIsThisYou(ident, name, email, matches) {
    var err = ui.el('div');
    gate([
      ui.el('h1', { text: 'Is this you?' }),
      lead('There is already someone called ' + name.trim() + '. If it is you, pick it, and your Windows user name is linked to it.'),
      ui.el('div', { class: 'user-list' }, matches.map(function (u) {
        var linked = !!u.windows_id;
        return ui.el('button', {
          class: 'user-pick', type: 'button', disabled: linked,
          onclick: linked ? null : function () {
            store.linkIdentity(u.id, ident).then(function () {
              ui.toast({ kind: 'success', message: 'Welcome back, ' + u.name + '.' });
              openShell();
            }).catch(function (e) { ui.mount(err, problem(e.message)); });
          }
        }, [
          ui.el('span', { class: 'user-avatar', text: ui.initials(u.name) }),
          ui.el('span', { text: u.name }),
          ui.el('span', { class: 'role', text: linked ? 'linked to another Windows ID - ask an admin'
            : (u.roles || []).map(function (r) { return D.ROLE_LABEL[r]; }).join(', ') })
        ]);
      })),
      err,
      ui.el('div', { class: 'gate-actions' }, [
        ui.button('No, I am someone else - add me', { onClick: function () {
          register(ident, name, email, true).catch(function (e) { ui.mount(err, problem(e.message)); });
        } }),
        ui.button('Back', { kind: 'ghost', onClick: function () { showWhoAreYou(ident); } })
      ])
    ]);
  }

  function register(ident, name, email, confirmed) {
    return store.selfRegister({ name: name, windows_id: ident.windows_id, domain: ident.domain,
                                email: email, confirmed_new: confirmed }).then(function () {
      ui.toast({ kind: 'success', timeout_ms: 8000, message: 'Welcome. You were added as an Engineer; an admin will check your roles.' });
      openShell();
    });
  }

  /** Pick another data folder (the wrong one was picked, or the share moved). */
  function changeFolder() {
    var go = function () {
      store.connect().then(function () {
        stopTimers();
        ui.toast({ message: 'Data folder changed to ' + (store.status().folderName || 'the new folder') + '.', kind: 'success' });
        afterLoad();
      }).catch(function (e) {
        if (e && e.name === 'AbortError') return;
        ui.toastError('Could not open that folder: ' + e.message, e);
      });
    };
    if (store.status().pendingSave) {
      return ui.confirm({ title: 'Discard the unsaved change?', danger: true, confirmLabel: 'Change folder and lose it',
        message: 'A change could not be saved and is only in memory. Download it first if you need it.' })
        .then(function (yes) { if (yes) go(); });
    }
    go();
  }

  /** After the data was replaced (restore, reload): is the signed-in person still in it? */
  function recheckUser() {
    var u = store.currentUser();
    if (!u || !u.active) { changeUser(); return false; }
    paintUser(); paintFooter(); paintUndo();
    return true;
  }

  function changeUser() {
    identity.forget();
    store.signOut();
    stopTimers();
    applyPrefs(null);
    showAskId();
  }

  /* ------------------------------------------------------------------ *
   * Shell
   * ------------------------------------------------------------------ */

  function openShell() {
    var uid = store.status().currentUserId;
    applyPrefs(uid);
    document.getElementById('gate').hidden = true;
    document.getElementById('shell').hidden = false;
    var h = location.hash;
    if (!h || h === '#' || h === '#/') history.replaceState(null, '', '#/' + readHome(uid));
    paintNav();
    paintUser();
    paintFooter();
    paintUndo();
    startTimers();
    route();
  }

  function paintStaticChrome() {
    ui.mount(document.getElementById('brandMark'), ui.icon('logo', 20));
    document.getElementById('brandVer').textContent = MILESTONE;
    ui.mount(document.getElementById('searchIcon'), ui.icon('search', 16));
    ui.mount(document.getElementById('keysBtn'), ui.icon('keyboard', 18));
    ui.mount(document.getElementById('helpBtn'), ui.icon('help', 18));
    ui.mount(document.getElementById('userCaret'), ui.icon('chevron_down', 14));
  }

  /** The side menu: live pages link; later ones are greyed with their milestone (M1-6). */
  function paintNav() {
    ui.mount(document.getElementById('navItems'), NAV.map(function (n) {
      var inner = [ui.icon(n.icon, 18), ui.el('span', { class: 'nav-label', text: n.label })];
      if (isLive(n.key)) {
        return ui.el('a', { class: 'nav-item', href: '#/' + n.key, dataset: { route: n.key },
                            title: n.label + '  (g ' + n.g + ')' }, inner.concat([ui.el('span', { class: 'nav-badge', hidden: true })]));
      }
      return ui.el('span', { class: 'nav-item is-soon', role: 'link', 'aria-disabled': 'true',
                             title: n.label + ': coming in ' + n.ms,
                             'aria-label': n.label + ', not available yet, coming in ' + n.ms },
                   inner.concat([ui.el('span', { class: 'nav-soon', text: n.ms, 'aria-hidden': 'true' })]));
    }));
  }

  function paintUser() {
    var u = store.currentUser();
    if (!u) return;
    document.getElementById('userAvatar').textContent = ui.initials(u.name);
    document.getElementById('userName').textContent = u.name;
  }

  function paintFooter() {
    var s = store.status();
    ui.mount(document.getElementById('navFolder'), [ui.icon('folder', 12), s.folderName || 'Data folder']);
    document.getElementById('navRev').textContent = 'Revision ' + s.revision;
    paintSaveLed();
  }

  /* ------------------------------------------------------------------ *
   * Router: #/page/subpath?q=...
   * ------------------------------------------------------------------ */

  function parseHash() {
    var raw = (location.hash || '').replace(/^#\/?/, '');
    var parts = raw.split('?');
    var segments = (parts[0] || '').split('/');
    var q = '';
    var m = parts[1] && /(?:^|&)q=([^&]*)/.exec(parts[1]);
    if (m) { try { q = decodeURIComponent(m[1]); } catch (e) { q = m[1]; } }
    var params = {};
    (parts[1] || '').split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i < 1) return;
      try { params[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); } catch (e) { params[kv.slice(0, i)] = kv.slice(i + 1); }
    });
    return { route: segments[0] || 'lab', subpath: segments.slice(1).join('/'), query: q, params: params };
  }

  function route() {
    if (!store.status().loaded || !store.currentUser()) return;
    var parsed = parseHash();
    var entry = navEntry(parsed.route);
    app.route = entry ? parsed.route : 'lab';

    var menuKey = (navEntry(app.route) || {}).menu || app.route;
    document.querySelectorAll('.nav-item[data-route]').forEach(function (a) {
      var on = a.dataset.route === menuKey;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });

    var main = document.getElementById('main');
    ui.clear(main);
    var view = window.MRT.views[app.route];
    app.currentView = view || null;
    if (!view) {
      main.appendChild(ui.pageHead(entry ? entry.label : 'Unknown page'));
      main.appendChild(ui.emptyState({ icon: entry ? entry.icon : 'alert',
        title: entry ? entry.label + ' comes in ' + entry.ms : 'Unknown page',
        text: entry ? 'This page is part of a later milestone. Everything live today is in the menu.'
                    : 'That address does not exist. Use the menu on the left.' }));
    } else {
      try {
        view.render(main, { subpath: parsed.subpath, query: parsed.query, params: parsed.params });
        ui.linkLabels(main);
      } catch (e) {
        console.error('MRT: page "' + app.route + '" failed to render', e);
        ui.mount(main, ui.emptyState({ icon: 'alert', title: 'This page could not be shown',
          text: e.message || 'Unexpected error. The details are in the browser console (F12).' }));
        ui.toastError('The ' + entry.label + ' page failed to load.', e);
      }
    }
    main.classList.remove('page-enter');
    void main.offsetWidth;            // restart the entrance animation
    main.classList.add('page-enter');
    main.focus();
    paintAlertBanner();
  }

  /* ------------------------------------------------------------------ *
   * Save lamp and Undo
   * ------------------------------------------------------------------ */

  var seen = { seq: null, rev: null, state: '' };

  function saveState() {
    var s = store.status();
    if (seen.seq === null) { seen.seq = s.changeSeq; seen.rev = s.revision; }
    if (s.pendingSave) return 'failed';
    if (s.changeSeq !== seen.seq && s.revision === seen.rev) return 'saving';
    seen.seq = s.changeSeq; seen.rev = s.revision;
    return 'saved';
  }

  function paintSaveLed() {
    var btn = document.getElementById('saveLed');
    if (!store.data()) return;
    var st = saveState();
    var s = store.status();
    var key = st + '|' + s.savedTs;
    if (key === seen.state) return;
    seen.state = key;
    var when = s.savedTs ? ui.formatTs(s.savedTs).slice(11) : '';
    var who = s.savedBy ? (store.byId('users', s.savedBy) || {}).name : null;
    var text = st === 'failed' ? 'Not saved · retry' : st === 'saving' ? 'Saving…' : 'Saved' + (when ? ' ' + when : '');
    btn.className = 'save-led ' + st;
    btn.title = st === 'failed' ? 'The last change is only in memory. Click to retry or download it.'
      : 'Last saved ' + (s.savedTs ? ui.formatTs(s.savedTs) : '-') + (who ? ' by ' + who : '');
    ui.mount(btn, [ui.led(st === 'failed' ? 'expired' : st === 'saving' ? 'warning' : 'ok'), ui.el('span', { class: 'num', text: text })]);
  }

  var undoTimer = null;

  function paintUndo() {
    var btn = document.getElementById('undoBtn');
    var info = store.undoInfo();
    clearTimeout(undoTimer);
    btn.hidden = !info;
    if (!info) return;
    btn.title = 'Undo: ' + info.label + '  (Ctrl+Z)';
    btn.setAttribute('aria-label', 'Undo the last change: ' + info.label);
    ui.mount(btn, [ui.icon('refresh', 14), ui.el('span', { text: 'Undo' })]);
    undoTimer = setTimeout(paintUndo, info.ms_left + 50);
  }

  function undo() {
    if (!store.undoInfo()) return;
    store.undoLast().then(function (label) {
      paintUndo();
      route();
      ui.toast({ kind: 'success', message: 'Undone: ' + label + '.', timeout_ms: 3000 });
    }).catch(function (e) { paintUndo(); ui.toastError('Could not undo: ' + e.message, e); });
  }

  /* ------------------------------------------------------------------ *
   * Alert strip - a stub in M1 (M1-2). From M3 it shows queue counts:
   * Line stop, late, on hold, each a link into the queue, like ABF's
   * status strip. The markup and styles (.strip-*) are already in place.
   * ------------------------------------------------------------------ */

  function paintAlertBanner() {
    document.getElementById('alertBanner').hidden = true;
  }

  /* ------------------------------------------------------------------ *
   * Search: in M1 tools, measurement types, BKMs and people.
   * Requests, lots and panels join in M2/M3 (Q41).
   * ------------------------------------------------------------------ */

  function wireSearch() {
    var box = document.getElementById('search');
    var results = ui.el('div', { class: 'search-results', hidden: true });
    box.parentNode.appendChild(results);

    function hide() { results.hidden = true; }

    function matches(query) {
      var data = store.data();
      if (!data) return [];
      var q = D.normalizeName(query);
      var out = [];
      function has(s) { return D.normalizeName(s).indexOf(q) !== -1; }
      function toolOf(id) { return store.byId('tools', id) || {}; }
      store.list('tools').forEach(function (t) {
        if (has(t.code + ' ' + t.name)) out.push({ kind: 'Tool', glyph: t.glyph, label: t.code, sub: t.name, href: '#/lab/' + t.id });
      });
      store.list('measurement_types').forEach(function (m) {
        if (has(m.name)) out.push({ kind: 'Type', icon: 'ruler', label: m.name, sub: toolOf(m.tool_id).code + ' measurement type', href: '#/lab/' + m.tool_id });
      });
      store.list('bkms').forEach(function (b) {
        if (has(b.name + ' ' + b.path)) out.push({ kind: 'BKM', icon: 'requests', label: b.name, sub: b.path, href: '#/lab/' + b.tool_id });
      });
      store.visibleRequests(function (r) { return r.status !== 'draft'; }).forEach(function (r) {
        var t = store.byId('tools', r.tool_id), lot = store.byId('lots', r.lot_id);
        if (has(r.request_no + ' ' + (r.purpose || ''))) {
          out.push({ kind: 'Request', glyph: t ? t.glyph : null, icon: 'requests', label: r.request_no,
                     sub: [D.REQUEST_STATUS_LABEL[r.status], lot ? 'lot ' + lot.lot_number : null].filter(Boolean).join(' · '), href: '#/request/' + r.id });
        }
      });
      (data.lots || []).forEach(function (l) {
        var prj = store.byId('projects', l.project_id), pn = l.part_number_id ? store.byId('part_numbers', l.part_number_id) : null;
        if (has(l.lot_number + ' ' + (pn ? pn.code : ''))) {
          out.push({ kind: 'Lot', icon: 'lots', label: l.lot_number,
                     sub: [(prj || {}).code, pn ? pn.code : null, l.panel_count + ' panels'].filter(Boolean).join(' · '), href: '#/lots/' + l.id });
        }
      });
      store.list('users').forEach(function (u) {
        if (has(u.name + ' ' + (u.windows_id || '') + ' ' + (u.email || ''))) {
          out.push({ kind: 'Person', icon: 'user', label: u.name,
                     sub: (u.roles || []).map(function (r) { return D.ROLE_LABEL[r]; }).join(', '), href: '#/settings/users' });
        }
      });
      return out.slice(0, 8);
    }

    function draw() {
      var q = box.value.trim();
      if (q.length < 2) return hide();
      var found = matches(q);
      if (!found.length) {
        ui.mount(results, ui.el('div', { class: 'search-empty', text: 'Nothing matches "' + q + '"' }));
      } else {
        ui.mount(results, found.map(function (m) {
          return ui.el('a', { class: 'search-hit', href: m.href, onclick: hide }, [
            ui.el('span', { class: 'search-kind' }, [m.glyph ? ui.toolGlyph(m.glyph, { size: 18 }) : ui.icon(m.icon, 14), ui.el('span', { text: m.kind })]),
            ui.el('span', { class: 'search-label', text: m.label }),
            ui.el('span', { class: 'search-sub', text: m.sub })
          ]);
        }));
      }
      results.hidden = false;
    }

    box.addEventListener('input', draw);
    box.addEventListener('focus', draw);
    box.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { hide(); return; }
      if (ev.key !== 'Enter') return;
      var first = results.querySelector('.search-hit');
      if (first && !results.hidden) { location.hash = first.getAttribute('href'); hide(); }
    });
    document.addEventListener('click', function (ev) { if (!ev.target.closest('.search')) hide(); });
  }

  /* ------------------------------------------------------------------ *
   * Timers: 1 s ticker (text only), revision check
   * ------------------------------------------------------------------ */

  function startTimers() {
    stopTimers();
    app.tickTimer = setInterval(function () {
      if (document.hidden) return;
      try { paintSaveLed(); } catch (e) { console.error('MRT: top bar tick failed', e); }
      if (app.currentView && typeof app.currentView.tick === 'function') {
        try { app.currentView.tick(); } catch (e) { console.error('MRT: ticker failed', e); }
      }
    }, 1000);
    app.revisionTimer = setInterval(checkRevision, cfg.revision_poll_ms);
  }

  function stopTimers() {
    clearInterval(app.tickTimer);
    clearInterval(app.revisionTimer);
  }

  function checkRevision() {
    if (document.hidden) return;
    store.checkForExternalChange().then(function (change) {
      var banner = document.getElementById('conflictBanner');
      if (!change) { banner.hidden = true; return; }
      banner.hidden = false;
      ui.mount(banner, [
        ui.icon('alert', 16),
        ui.el('span', { text: 'Data was changed by ' + (change.saved_by_name || 'someone else') + ' at ' + ui.formatTs(change.saved_ts) + '.' }),
        ui.el('div', { class: 'spacer' }),
        ui.button('Reload', { icon: 'refresh', dataset: { action: 'reload-data' } })
      ]);
    });
  }

  function reloadData() {
    // Reloading throws away whatever is still unsaved: never silently.
    if (store.status().pendingSave) {
      return ui.confirm({
        title: 'Discard the unsaved change?',
        message: 'A change could not be saved and is still only in memory. Reloading takes the file from the share ' +
                 'and loses it. Download it first if you need it.',
        confirmLabel: 'Reload and lose it', danger: true
      }).then(function (yes) { if (yes) doReload(); });
    }
    doReload();
  }

  function doReload() {
    var uid = store.status().currentUserId;
    store.load().then(function () {
      document.getElementById('conflictBanner').hidden = true;
      if (!recheckUser()) return;
      route();
      ui.toast({ message: 'Data reloaded.', kind: 'success' });
    }).catch(function (e) { ui.toastError('Could not reload the data file: ' + e.message, e); });
  }

  /** Hand the person a text file (the recovery copy after a failed save). */
  function downloadText(name, text) {
    var a = ui.el('a', { download: name, href: URL.createObjectURL(new Blob([text], { type: 'application/json' })) });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function reportSaveFailure(error) {
    paintSaveLed();
    ui.toast({
      kind: 'error',
      message: error.code === 'revision_conflict' ? error.message : 'The change could not be saved: ' + error.message,
      actions: [
        { label: 'Retry', onClick: function () {
            store.retrySave().then(function () { paintFooter(); ui.toast({ message: 'Saved.', kind: 'success' }); })
              .catch(reportSaveFailure);
          } },
        { label: 'Download as file', onClick: function () { var f = store.exportText(); downloadText(f.name, f.text); } }
      ]
    });
  }

  /* ------------------------------------------------------------------ *
   * User menu
   * ------------------------------------------------------------------ */

  function openUserMenu(anchor) {
    var u = store.currentUser();
    if (!u) return;
    var s = store.status();
    var themeSeg = ui.segmented({ label: 'Theme', value: app.theme, onChange: setTheme, options: [
      { value: 'dark', label: 'Dark', icon: 'moon' }, { value: 'light', label: 'Light', icon: 'sun' },
      { value: 'hc', label: 'HC', icon: 'contrast' }] });
    var motion = ui.toggle({ kind: 'switch', label: 'Reduce motion', checked: !!app.reduceMotion, onChange: setReduceMotion });
    var homes = livePages().filter(function (n) { return n.key !== 'settings' && n.key !== 'help'; });
    var home = ui.el('select', { class: 'input menu-select', 'aria-label': 'Start page' }, homes.map(function (n) {
      return ui.el('option', { value: n.key, text: n.label, selected: n.key === readHome(u.id) });
    }));
    home.addEventListener('change', function () {
      writePref('home', home.value);
      ui.toast({ message: 'Start page: ' + navEntry(home.value).label, timeout_ms: 1800 });
    });
    var roles = (u.roles || []).map(function (r) { return D.ROLE_LABEL[r]; }).join(', ') || 'No role';
    var away = D.awayState(u, D.viennaYmd(Date.now()));
    var awayLabel = away && away.state !== 'over' ? 'Away ' + awayText(away) + ' - change' : 'I\'m away...';

    ui.menu(anchor, [
      { node: [ui.el('span', { text: 'Theme' }), themeSeg.node] },
      { node: motion.node },
      { node: [ui.el('span', { text: 'Start page' }), home] },
      { sep: true },
      { label: awayLabel, icon: 'calendar', onClick: function () { awayDialog(u); } },
      { sep: true },
      { label: 'Keyboard shortcuts', icon: 'keyboard', aside: '?', onClick: showKeys },
      { label: 'Reload from the share', icon: 'refresh', onClick: reloadData },
      { label: 'Change data folder', icon: 'folder', onClick: changeFolder },
      { label: 'Change user', icon: 'user', onClick: changeUser },
      { sep: true },
      { node: ui.el('div', { class: 'menu-folder' }, [
        ui.el('div', {}, [ui.icon('folder', 12), ' ', s.folderName || 'Data folder']),
        ui.el('div', { class: 'num', text: 'Revision ' + s.revision + '  ·  saved ' + (s.savedTs ? ui.formatTs(s.savedTs) : '-') +
                                           (s.pendingSave ? '  ·  NOT SAVED' : '') })
      ]) }
    ], [ui.el('div', { class: 'menu-who' }, [
      ui.el('span', { class: 'user-avatar', text: ui.initials(u.name) }),
      ui.el('div', {}, [ui.el('b', { text: u.name }), ui.el('span', { text: roles + (u.windows_id ? '  ·  ' + u.windows_id : '') })])
    ])]);
  }

  /** "1 Oct - 5 Oct" / "from 1 Oct" for an away period (dates are YYYY-MM-DD). */
  function awayText(a) {
    return a.until ? (a.from === a.until ? 'on ' + a.from : a.from + ' to ' + a.until) : 'from ' + a.from;
  }

  /**
   * Away (DECISIONS M1-14): dates and an optional note - no reason. Opened from
   * the user menu (yourself) and from Settings > People (admins, for anyone).
   */
  function awayDialog(user) {
    var me = store.currentUser();
    var self = me && me.id === user.id;
    var today = D.viennaYmd(Date.now());
    var had = !!user.away_from;
    var f = ui.form([
      { key: 'from', label: 'First day away', kind: 'date', cls: 'half' },
      { key: 'until', label: 'Last day away (optional)', kind: 'date', cls: 'half', hint: 'Empty = until further notice.' },
      { key: 'note', label: 'Note (optional)', kind: 'text', placeholder: 'e.g. Tom covers FIB',
        hint: 'No reason needed - please do not write why (e.g. sick leave).' }
    ], { from: user.away_from || today, until: user.away_until || '', note: user.away_note || '' });
    var actions = [{ label: 'Cancel', value: null }];
    if (had) actions.push({ label: self ? 'I\'m back' : 'Clear', value: 'clear',
      submit: function () { return store.setAway(user.id, null, self ? null : 'Settings'); } });
    actions.push({ label: 'Save', kind: 'primary', value: function () { return f.values(); },
      submit: function (v) {
        f.clearErrors();
        var p = D.validateAway({ from: v.from, until: v.until || null, note: v.note });
        if (p.length) { f.setError(/before|Back/.test(p[0]) ? 'until' : /note/.test(p[0]) ? 'note' : 'from', p[0]); return Promise.reject(new Error(p[0])); }
        return store.setAway(user.id, { from: v.from, until: v.until || null, note: v.note }, self ? null : 'Settings');
      } });
    return ui.dialog({
      title: self ? 'I\'m away' : user.name + ' is away', icon: 'calendar',
      body: [ui.el('p', { class: 'muted', text: 'Shown on Lab status and in Settings. From M3 new requests for your tools go to the backup while you are away.' }), f.node],
      actions: actions
    }).then(function (res) {
      if (!res) return;
      ui.toast({ kind: 'success', message: res.away_from ? (self ? 'Saved: away ' : user.name + ': away ') + awayText(D.awayState(res, today)) + '.' : (self ? 'Welcome back.' : 'Cleared.') });
      route();
    }).catch(function (e) {
      if (e && e.code === 'no_change') return ui.toast({ message: 'Nothing was changed.', timeout_ms: 2000 });
      ui.toastError(e.message, e);
    });
  }

  /* ------------------------------------------------------------------ *
   * Keyboard shortcuts
   * ------------------------------------------------------------------ */

  function keyGroups() {
    return [
      ['Go to', livePages().map(function (n) { return ['g ' + n.g, n.label]; })],
      ['Anywhere', [['/', 'Search'], ['?', 'This list'], ['Ctrl+Z', 'Undo the last change (for ' + cfg.undo_ms / 1000 + ' s)'],
                    ['[', 'Collapse or expand the side menu'], ['Esc', 'Close a dialog or menu, clear the search']]],
      ['In lists and tabs', [['Tab', 'Next control'], ['← →', 'Switch tab or option'], ['Enter', 'Open']]]
    ];
  }

  function showKeys() {
    ui.dialog({ title: 'Keyboard shortcuts', icon: 'keyboard', body: ui.el('div', { class: 'keys' },
      keyGroups().map(function (group) {
        return ui.el('section', { class: 'keys-group' }, [
          ui.el('h3', { text: group[0] }),
          ui.el('dl', {}, group[1].map(function (k) {
            return [ui.el('dt', {}, k[0].split(' ').map(function (part) { return ui.el('kbd', { text: part }); })),
                    ui.el('dd', { text: k[1] })];
          }))
        ]);
      })) });
  }

  var gPending = 0;

  function onShortcut(ev) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (document.querySelector('dialog[open]') || document.querySelector('.menu')) return;
    if (document.getElementById('shell').hidden) return;
    if (gPending && Date.now() - gPending < 1200) {
      gPending = 0;
      var to = livePages().filter(function (n) { return n.g === ev.key; })[0];
      if (to) { ev.preventDefault(); location.hash = '#/' + to.key; }
      return;
    }
    if (ev.key === 'g') { gPending = Date.now(); return; }
    if (ev.key === '?') { ev.preventDefault(); showKeys(); return; }
    if (ev.key === '[') { ev.preventDefault(); toggleNav(); }
  }

  /* ------------------------------------------------------------------ *
   * Global events - delegation only, no inline handlers
   * ------------------------------------------------------------------ */

  var ACTIONS = {
    'connect': connect,
    'reconnect': reconnect,
    'change-user': changeUser,
    'user-menu': openUserMenu,
    'show-keys': showKeys,
    'nav-collapse': toggleNav,
    'undo': undo,
    'reload-data': reloadData,
    'save-state': function () {
      var s = store.status();
      if (s.pendingSave && s.lastError) reportSaveFailure(s.lastError);
      else ui.toast({ message: 'All changes are saved' + (s.savedTs ? ' (' + ui.formatTs(s.savedTs) + ')' : '') + '.', kind: 'success', timeout_ms: 2500 });
    }
  };

  function wireGlobalEvents() {
    document.addEventListener('click', function (ev) {
      var target = ev.target.closest('[data-action]');
      if (!target || target.disabled) return;
      var fn = ACTIONS[target.dataset.action];
      if (!fn) return;
      ev.preventDefault();
      fn(target, ev);
    });

    window.addEventListener('hashchange', route);
    window.addEventListener('mrt:committed', function () { setTimeout(function () { paintUndo(); paintFooter(); }, 0); });
    window.addEventListener('mrt:save-failed', function (ev) { if (ev.detail) reportSaveFailure(ev.detail); });

    document.addEventListener('keydown', function (ev) {
      var tag = (ev.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea' || tag === 'select' || ev.target.isContentEditable;
      if (ev.key === '/' && !typing && !ev.ctrlKey && !ev.metaKey && !document.getElementById('shell').hidden) {
        ev.preventDefault();
        var box = document.getElementById('search');
        box.focus(); box.select();
      }
      if (ev.key === 'Escape' && ev.target.id === 'search') { ev.target.value = ''; ev.target.blur(); }
      if (!typing && (ev.ctrlKey || ev.metaKey) && !ev.shiftKey && (ev.key === 'z' || ev.key === 'Z') &&
          !document.querySelector('dialog[open]') && store.undoInfo()) {
        ev.preventDefault(); undo(); return;
      }
      if (!typing) onShortcut(ev);
    });

    wireSearch();

    window.addEventListener('error', function (ev) {
      console.error('MRT: uncaught error', ev.error || ev.message);
      ui.toast({ kind: 'error', message: 'Something went wrong. The details are in the console (F12).' });
    });
    window.addEventListener('unhandledrejection', function (ev) {
      console.error('MRT: unhandled promise rejection', ev.reason);
      ui.toast({ kind: 'error', message: (ev.reason && ev.reason.message) || 'An action did not finish.' });
    });
  }

  return {
    boot: boot,
    route: route,
    reloadData: reloadData,
    reportSaveFailure: reportSaveFailure,
    paintAlertBanner: paintAlertBanner,
    downloadText: downloadText,
    recheckUser: recheckUser,
    awayDialog: awayDialog,
    awayText: awayText,
    NAV: NAV,
    state: app
  };
})();

document.addEventListener('DOMContentLoaded', function () { window.MRT.app.boot(); });
