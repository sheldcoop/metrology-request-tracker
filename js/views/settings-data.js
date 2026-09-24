/**
 * Metrology Request Tracker - views/settings-data.js
 *
 * Settings > Data & PIN: where the data file is and its state, the daily
 * backups (restore one: the current file is kept as a safety copy first),
 * a copy to download now, and changing the admin PIN.
 */
(function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var cfg = window.MRT.config;

  function K() { return window.MRT.settingsKit; }

  function render(body) {
    body.appendChild(ui.el('div', { class: 'settings-cols' }, [filePanel(), pinPanel()]));
    body.appendChild(backupsPanel());
    body.appendChild(samplePanel());
  }

  /** Three made-up lots to try the app with (tagged Sample, deletable on the Lots page). */
  function samplePanel() {
    var k = K();
    var n = (store.data().lots || []).filter(function (l) { return l.sample; }).length;
    return k.panel('Try it out', 'lots', [], [
      ui.el('p', { class: 'muted', text: 'Adds three made-up lots (99901, 99902 and the split lot 99902.01), tagged Sample, so the Lots page ' +
        'and later the request form can be tried with this data file. Delete them on the Lots page when done; Health lists them.' +
        (n ? ' ' + n + ' sample lot' + (n === 1 ? ' is' : 's are') + ' there now.' : '') }),
      ui.el('div', { class: 'form-actions' }, ui.button('Add 3 sample lots', { icon: 'plus', onClick: function () {
        store.addSampleLots().then(function (added) {
          ui.toast({ kind: 'success', message: added + ' sample lot' + (added === 1 ? '' : 's') + ' added - see Lots.' });
          window.MRT.app.route();
        }).catch(function (e) { if (e && e.code === 'no_change') ui.toast({ message: e.message }); else ui.toastError(e.message, e); });
      } }))
    ]);
  }

  function filePanel() {
    var k = K();
    var s = store.status();
    var who = s.savedBy ? k.userName(s.savedBy) : null;
    function row(label, value) { return [ui.el('dt', { text: label }), ui.el('dd', {}, value)]; }
    return k.panel('Data file', 'folder', [], [
      ui.el('dl', { class: 'facts' }, [
        row('Folder', ui.el('span', { class: 'mono', text: s.folderName || '-' })),
        row('File', ui.el('span', { class: 'mono', text: cfg.data_file })),
        row('Revision', ui.el('span', { class: 'num', text: String(s.revision) })),
        row('Last saved', (s.savedTs ? ui.formatTs(s.savedTs) : '-') + (who ? ' by ' + who : '')),
        row('Schema', ui.el('span', { class: 'num', text: String(store.SCHEMA_VERSION) }))
      ]),
      ui.el('div', { class: 'form-actions' }, [
        ui.button('Download a copy now', { icon: 'download', onClick: function () {
          var f = store.exportText();
          window.MRT.app.downloadText(f.name.replace('recovered', 'copy'), f.text);
        } })
      ]),
      ui.el('p', { class: 'fine', text: 'To use another data folder: your name (top right) > Change data folder.' })
    ]);
  }

  function pinPanel() {
    var k = K();
    var f = ui.form([
      { key: 'pin1', label: 'New PIN', kind: 'password', cls: 'half', hint: '4 to 12 digits' },
      { key: 'pin2', label: 'New PIN again', kind: 'password', cls: 'half' }
    ], {});
    function save() {
      var v = f.values();
      f.clearErrors();
      if (!/^[0-9]{4,12}$/.test(v.pin1)) return f.setError('pin1', 'The PIN must be 4 to 12 digits');
      if (v.pin1 !== v.pin2) return f.setError('pin2', 'The two PINs are not the same');
      ui.promptReason({ title: 'Change the admin PIN', message: 'Every admin needs the new PIN from now on. Why the change?', confirmLabel: 'Change PIN' })
        .then(function (reason) {
          if (!reason) return;
          return store.setAdminPin(v.pin1, reason).then(function () { ui.toast({ kind: 'success', message: 'Admin PIN changed.' }); window.MRT.app.route(); });
        }).catch(function (e) { ui.toastError(e.message, e); });
    }
    return k.panel('Admin PIN', 'lock', [], [
      ui.el('p', { class: 'muted', text: 'Asked once per visit before Settings open. Stored as a salted hash, never as the PIN.' }),
      f.node,
      ui.el('div', { class: 'form-actions' }, ui.button('Change PIN', { kind: 'primary', icon: 'lock', onClick: save }))
    ]);
  }

  function backupsPanel() {
    var k = K();
    var host = ui.el('div', {}, ui.el('p', { class: 'muted', text: 'Reading the backups folder…' }));
    store.listBackups().then(function (rows) {
      ui.mount(host, k.table(['Day', 'Size', { label: '', cls: 'actions' }], rows.map(function (b, i) {
        return [
          ui.el('span', { class: 'mono', text: ui.formatDate(b.date + 'T12:00:00Z') + (i === 0 ? '  (latest)' : '') }),
          ui.el('span', { class: 'num muted', text: b.size_kb + ' KB' }),
          ui.button('Restore', { size: 'sm', kind: 'danger', icon: 'restore', onClick: function () { restore(b); } })
        ];
      }), 'No backups yet. The first one is written with the first change of the day.'));
    }).catch(function (e) {
      ui.mount(host, ui.el('p', { class: 'form-error', text: 'Could not read the backups folder: ' + e.message }));
    });
    return k.panel('Daily backups', 'archive', [], [
      ui.el('p', { class: 'muted', text: 'The first change of each day copies the data file into ' + cfg.backup_dir + '\\ first. ' +
        'The last ' + cfg.backup_keep + ' days are kept.' }),
      host
    ]);
  }

  function restore(b) {
    ui.promptReason({ title: 'Restore ' + b.date, confirmLabel: 'Restore',
      message: 'All data goes back to how it was on ' + b.date + '; changes made since are replaced for everyone. ' +
               'The current file is kept first as a safety copy, and the audit log keeps every entry. Why?'
    }).then(function (reason) {
      if (!reason) return;
      return store.restoreBackup(b.name, reason).then(function (r) {
        ui.toast({ kind: 'success', timeout_ms: 9000, message: 'Restored ' + b.date + '. The previous data is kept in ' + r.safety_copy + '.' });
        if (window.MRT.app.recheckUser()) window.MRT.app.route();
      });
    }).catch(function (e) { ui.toastError('Could not restore: ' + e.message, e); });
  }

  window.MRT.settingsTabs.push({ key: 'data', label: 'Data & PIN', icon: 'folder', order: 70, render: render });
})();
