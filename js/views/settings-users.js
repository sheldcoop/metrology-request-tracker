/**
 * Metrology Request Tracker - views/settings-users.js
 *
 * Settings > People: name, Windows ID (+ domain), company email, roles
 * (ticks, several allowed - Q17/Q52), active. People who added themselves
 * carry a New mark until an admin reviews them (M1-5). People are never
 * deleted, only switched off, so the audit log keeps their names.
 */
(function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var D = window.MRT.domain;

  function roleOptions() { return D.ROLES.map(function (r) { return { value: r, label: D.ROLE_LABEL[r] }; }); }

  function render(body, ctx) {
    var K = window.MRT.settingsKit;
    var me = store.currentUser();
    var users = store.list('users', { all: true }).sort(function (a, b) {
      return (b.needs_review ? 1 : 0) - (a.needs_review ? 1 : 0) || (a.active === b.active ? 0 : a.active ? -1 : 1) || (a.name < b.name ? -1 : 1);
    });
    var review = users.filter(function (u) { return u.needs_review && u.active; }).length;

    body.appendChild(K.panel('People', 'users', [ui.button('Add person', { kind: 'primary', icon: 'plus', size: 'sm', onClick: function () { userDialog(null); } })], [
      ui.el('p', { class: 'muted', text: users.length + ' people' + (review ? ' - ' + review + ' added themselves and wait for your review.' : '.') +
        ' Colleagues can also add themselves the first time they open the app (as Engineer).' }),
      K.table(['Name', 'Windows ID', 'Email', 'Roles', 'Status', { label: '', cls: 'actions' }], users.map(function (u) {
        return { id: 'row-' + u.id, cls: u.active ? null : 'is-off', cells: [
          ui.el('span', { class: 'cell-main' }, [
            ui.el('b', { text: u.name }),
            me && u.id === me.id ? K.chip('you') : null,
            u.needs_review ? K.chip('New', 'warning') : null
          ]),
          u.windows_id ? ui.el('span', { class: 'mono', text: (u.domain ? u.domain + '\\' : '') + u.windows_id }) : K.muted('not linked yet'),
          u.email || K.muted('-'),
          ui.el('span', { class: 'chip-row' }, (u.roles || []).map(function (r) { return K.chip(D.ROLE_LABEL[r], r === 'admin' ? 'accent-chip' : null); })),
          K.chip(u.active ? 'Active' : 'Switched off', u.active ? 'ok' : 'neutral'),
          ui.el('span', { class: 'row-actions' }, [
            u.needs_review ? ui.button('Reviewed', { size: 'sm', icon: 'check', title: 'Roles checked - remove the New mark',
              onClick: function () {
                store.markUserReviewed(u.id).then(function () { ui.toast({ kind: 'success', message: u.name + ' reviewed.' }); window.MRT.app.route(); })
                  .catch(function (e) { ui.toastError(e.message, e); });
              } }) : null,
            K.editButton(u.name, function () { userDialog(u); })
          ])
        ] };
      }), 'Nobody yet.')
    ]));
    K.focusRow(body, ctx.focusId);
  }

  function userDialog(u) {
    var K = window.MRT.settingsKit;
    var edit = !!u;
    return K.editDialog({
      title: edit ? 'Edit ' + u.name : 'Add a person', icon: 'user',
      intro: edit ? null : 'Add someone before they first open the app, e.g. to make them quality engineer of a tool. ' +
        'If you leave the Windows ID empty, they link it themselves ("Is this you?").',
      values: edit ? { name: u.name, windows_id: u.windows_id || '', domain: u.domain || '', email: u.email || '', roles: u.roles || [], active: u.active }
                   : { roles: ['engineer'], active: true },
      fields: [
        { key: 'name', label: 'Name', kind: 'text', placeholder: 'First and last name' },
        { key: 'windows_id', label: 'Windows user name', kind: 'text', mono: true, cls: 'half', hint: 'Lowercase, no domain, e.g. pkhurana' },
        { key: 'domain', label: 'Domain (optional)', kind: 'text', mono: true, cls: 'half', hint: 'e.g. CORP' },
        { key: 'email', label: 'Company email (optional)', kind: 'email', hint: 'For email and single sign-on later.' },
        { key: 'roles', label: 'Roles', kind: 'checks', options: roleOptions(),
          hint: 'Several allowed. Engineers request; quality engineers measure. Operator has no rights yet. Admins also need the PIN.' },
        { key: 'active', label: 'Active (untick to switch this person off - they are never deleted)', kind: 'check' }
      ],
      check: function (v) {
        if (!v.name) return ['name', 'Enter a name'];
        if (!v.roles.length) return ['roles', 'Tick at least one role'];
        if (v.windows_id && !D.isWindowsId(v.windows_id.toLowerCase())) return ['windows_id', 'Letters, digits, . - _ only; no domain here'];
        if (v.email && !D.isEmail(v.email)) return ['email', 'That email address does not look right'];
        return null;
      },
      save: function (v) {
        var fields = { name: v.name, windows_id: v.windows_id || null, domain: v.domain || null, email: v.email || null, roles: v.roles, active: v.active };
        return store.saveEntry('users', { id: edit ? u.id : undefined, version: edit ? u.version : undefined, fields: fields, reason: 'Settings' });
      },
      done: edit ? 'Saved.' : 'Added.'
    }).catch(function (e) { if (!K.quiet(e)) ui.toastError(e.message, e); });
  }

  window.MRT.settingsTabs.push({ key: 'users', label: 'People', icon: 'users', order: 20, render: render });
})();
