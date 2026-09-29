/**
 * Metrology Request Tracker - views/settings-emails.js
 *
 * Settings > Emails (admins): who is offered a ready Outlook draft for
 * what. One tick per event per who; the actor is never mailed to
 * themselves, and people without an email address are skipped. Today the
 * draft opens on the actor's PC and they press Send; when the server sends
 * automatically (OPEN_QUESTIONS #10) it mails the same people - this table
 * stays.
 */
(function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var D = window.MRT.domain;

  function K() { return window.MRT.settingsKit; }

  function render(body) {
    var k = K();
    var matrix = D.normalizeEmailMatrix(store.getSetting('email_matrix'));
    var ticks = {};
    D.EMAIL_EVENTS.forEach(function (e) {
      ticks[e] = {};
      D.EMAIL_ROLES.forEach(function (r) { ticks[e][r] = matrix[e].indexOf(r) !== -1; });
    });

    var rows = D.EMAIL_EVENTS.map(function (e) {
      return [D.EMAIL_EVENT_LABEL[e]].concat(D.EMAIL_ROLES.map(function (r) {
        var box = ui.el('input', { type: 'checkbox', 'aria-label': D.EMAIL_EVENT_LABEL[e] + ' - ' + D.EMAIL_ROLE_LABEL[r] });
        box.checked = ticks[e][r];
        box.addEventListener('change', function () { ticks[e][r] = box.checked; saveBtn.disabled = false; });
        return box;
      }));
    });
    var saveBtn = ui.button('Save', { kind: 'primary', onClick: function () {
      var m = {};
      D.EMAIL_EVENTS.forEach(function (e) { m[e] = D.EMAIL_ROLES.filter(function (r) { return ticks[e][r]; }); });
      store.saveEmailMatrix(m, 'Settings > Emails').then(function () {
        ui.toast({ kind: 'success', message: 'Email table saved.' });
        saveBtn.disabled = true;
      }).catch(function (err) {
        if (err && err.code === 'no_change') { saveBtn.disabled = true; return; }
        ui.toastError(err.message, err);
      });
    } });
    saveBtn.disabled = true;

    body.appendChild(k.panel('Who gets an email draft for what', 'mail', [saveBtn], [
      ui.el('p', { class: 'muted', text: 'After each event the app offers one click - "Email Olga + Otto" - that opens a ready Outlook draft. The person clicking never mails themselves. Unticked: no offer, no email.' }),
      k.table(['Event'].concat(D.EMAIL_ROLES.map(function (r) { return D.EMAIL_ROLE_LABEL[r]; })), rows)
    ]));
  }

  window.MRT.settingsTabs.push({ key: 'emails', label: 'Emails', icon: 'mail', order: 66, render: render });
})();
