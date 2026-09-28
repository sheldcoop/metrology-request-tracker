/**
 * Metrology Request Tracker - views/settings-data.js
 *
 * Settings > Data & PIN: where the data file is and its state, the daily
 * backups (restore one: the current file is kept as a safety copy first),
 * a copy to download now, and changing the admin PIN. For testing: fill
 * this folder with the big demo data, or start empty (both keep a copy of
 * the current file first).
 */
(function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var cfg = window.MRT.config;

  function K() { return window.MRT.settingsKit; }

  function render(body) {
    body.appendChild(ui.el('div', { class: 'settings-cols' }, [filePanel(), pinPanel()]));
    body.appendChild(importPanel());
    body.appendChild(backupsPanel());
    body.appendChild(samplePanel());
    body.appendChild(testDataPanel());
  }

  /**
   * Swap the whole data file for testing (store.replaceData): the big demo, or empty like a first
   * run. You keep your PIN and stay the signed-in admin; the current file is copied to backups first.
   */
  function testDataPanel() {
    var k = K();
    var d = store.data();
    var isDemo = !!d.demo;
    function go(kind) {
      var demo = kind === 'demo';
      ui.promptReason({ title: demo ? 'Fill this folder with the demo data?' : 'Start empty?', confirmLabel: demo ? 'Fill with demo data' : 'Start empty', danger: true,
        message: (demo ? 'Everything in this data file is replaced by the made-up demo: 17 people, 45 lots, ~260 requests in every state. ' +
                         'You become its Prince Khurana (admin + engineer) with your Windows ID and keep your PIN. '
                       : 'Everything in this data file is replaced by a fresh start: the lists from the first run (tools, types, magazines ...), ' +
                         'no lots, no requests, and only you as the admin - with your PIN. ') +
          'The current file is kept in ' + cfg.backup_dir + '/ first, so it can be restored. Other PCs using this folder see the change. Why?' })
        .then(function (reason) {
          if (!reason) return;
          var before = store.currentUser().id;
          return store.replaceData(kind, reason).then(function (r) {
            window.MRT.views.settings.keepUnlocked(before, r.user.id);
            ui.toast({ kind: 'success', timeout_ms: 9000, message: (demo ? 'Demo data is in. ' : 'Started empty. ') + 'The previous file is kept in ' + r.safety_copy + '.' });
            if (window.MRT.app.recheckUser()) window.MRT.app.route();
          });
        }).catch(function (e) { ui.toastError('Could not replace the data: ' + e.message, e); });
    }
    return k.panel('Test data', 'alert', [], [
      ui.el('p', { class: 'muted', text: 'For testing with this data folder. ' + (isDemo ? 'This file holds the made-up DEMO data now. ' : '') +
        'Both replace the whole file; the current one is kept in the backups first (restore it under Backups).' }),
      ui.el('div', { class: 'form-actions' }, [
        ui.button('Fill with demo data', { kind: 'danger', icon: 'restore', onClick: function () { go('demo'); } }),
        ui.button('Start empty', { kind: 'danger', icon: 'trash', onClick: function () { go('empty'); } })
      ])
    ]);
  }

  /** Three made-up lots to try the app with (tagged Sample, deletable on the Lots page). */
  function samplePanel() {
    var k = K();
    var n = (store.data().lots || []).filter(function (l) { return l.sample; }).length;
    return k.panel('Try it out', 'lots', [], [
      ui.el('p', { class: 'muted', text: 'Adds three made-up lots (99901, 99902 and the split lot 99902.01), tagged Sample, so the Lots page ' +
        'and the request form can be tried with this data file. Delete them on the Lots page when done; Health lists them.' +
        (n ? ' ' + n + ' sample lot' + (n === 1 ? ' is' : 's are') + ' there now.' : '') }),
      ui.el('div', { class: 'form-actions' }, [ui.button('Add 3 sample lots', { icon: 'plus', onClick: function () {
        store.addSampleLots().then(function (added) {
          ui.toast({ kind: 'success', message: added + ' sample lot' + (added === 1 ? '' : 's') + ' added - see Lots.' });
          window.MRT.app.route();
        }).catch(function (e) { if (e && e.code === 'no_change') ui.toast({ message: e.message }); else ui.toastError(e.message, e); });
      } }),
      ui.button('Add the sample magazines', { icon: 'plus', title: 'M70345-M70364, 24 slots each - those already there are skipped', onClick: function () {
        store.addSampleMagazines().then(function (added) {
          ui.toast({ kind: 'success', message: added + ' sample magazine' + (added === 1 ? '' : 's') + ' added - see Settings > Lists.' });
          window.MRT.app.route();
        }).catch(function (e) { if (e && e.code === 'no_change') ui.toast({ message: e.message }); else ui.toastError(e.message, e); });
      } })]),
      ui.el('p', { class: 'muted', text: store.list('magazines').length + ' magazines in this file now. The sample ones are M70345-M70364 (24 slots); ' +
        'replace them with the real numbers in Settings > Lists > Magazines.' })
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
        ui.button('Download the request history', { icon: 'download', title: 'Every request with all its status times, and every timeline event (Q48)',
          onClick: function () { window.MRT.exporter.run('request_history', window.MRT.exporter.historySheets); } }),
        ui.button('Export Master Excel', { icon: 'download', title: 'The whole app as one Excel file: every request plus a meta sheet. Edit it and import it back (admins only, like all of Settings).',
          onClick: function () { window.MRT.exporter.run('master', window.MRT.excelBridge.masterSheets); } }),
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
          ui.el('span', { class: 'mono', text: ui.formatDate(b.date + 'T12:00:00Z') + (b.kind !== 'daily' ? '  - ' + b.kind : i === 0 ? '  (latest)' : '') }),
          ui.el('span', { class: 'num muted', text: b.size_kb + ' KB' }),
          ui.button('Restore', { size: 'sm', kind: 'danger', icon: 'restore', onClick: function () { restore(b); } })
        ];
      }), 'No backups yet. The first one is written with the first change of the day.'));
    }).catch(function (e) {
      ui.mount(host, ui.el('p', { class: 'form-error', text: 'Could not read the backups folder: ' + e.message }));
    });
    return k.panel('Daily backups', 'archive', [], [
      ui.el('p', { class: 'muted', text: 'The first change of each day copies the data file into ' + cfg.backup_dir + '\\ first. ' +
        'The last ' + cfg.backup_keep + ' days are kept, and every copy made before "Fill with demo data" or "Start empty".' }),
      host
    ]);
  }

  /**
   * Master Excel import: pick a file, see every row green or red, import
   * only when all rows are green. The store saves all-or-nothing (a safety
   * copy first, the file's revision must match the live one).
   */
  function importPanel() {
    var k = K(), XB = window.MRT.excelBridge;
    var picker = ui.el('input', { type: 'file', accept: '.xlsx', 'aria-label': 'Master Excel file to import' });
    var reason = ui.field({ label: 'Reason (goes into the audit log)', placeholder: 'e.g. weekly priority review' });
    var preview = ui.el('div', {});
    var v = null, fileName = '';
    function paint() {
      if (!v) { ui.mount(preview, ui.el('p', { class: 'muted', text: 'No file picked yet.' })); return; }
      if (v.fatal) { ui.mount(preview, ui.el('p', { class: 'form-error', text: v.fatal })); return; }
      var bad = v.rows.filter(function (r) { return r.errors.length; });
      var items = v.rows.filter(function (r) { return r.item; });
      var ready = !v.stale && v.rows.length > 0 && !bad.length && items.length > 0;
      var lines = [];
      if (v.stale) lines.push(ui.el('p', { class: 'form-error',
        text: 'This file is older than the live data (file revision ' + v.metaRevision + '). Export a fresh file and redo the edits there - an old file is never merged.' }));
      lines.push(ui.el('p', { class: 'muted',
        text: fileName + ': ' + v.rows.length + ' rows, ' + items.length + ' with changes' + (bad.length ? ', ' + bad.length + ' with problems' : '') + '.' }));
      lines.push(ui.el('table', { class: 'grid' }, [
        ui.el('thead', {}, ui.el('tr', {}, ['Request', 'Changes', 'Problems'].map(function (h) { return ui.el('th', { text: h }); }))),
        ui.el('tbody', {}, v.rows.map(function (r) {
          return ui.el('tr', { class: r.errors.length ? 'is-bad' : (r.changes.length ? 'is-change' : null) }, [
            ui.el('td', { class: 'mono', text: r.key }),
            ui.el('td', { text: r.changes.map(function (c) { return c.label + ': ' + c.from + ' → ' + c.to; }).join('; ') || '-' }),
            ui.el('td', { text: r.errors.join(' ') || 'OK' })
          ]);
        }))
      ]));
      lines.push(ui.el('div', { class: 'form-actions' }, ui.button('Import ' + items.length + ' change' + (items.length === 1 ? '' : 's'), {
        kind: 'primary', icon: 'upload',
        title: ready ? 'Save all changes at once (a safety copy is kept first)' : 'Fix every red row first (all rows must be green)',
        disabled: !ready,
        onClick: function () {
          var why = reason.value();
          if (!why.trim()) { ui.toastError('Give a reason first - it goes into the audit log.'); reason.input.focus(); return; }
          store.importRequests(items.map(function (r) { return r.item; }), v.metaRevision, why).then(function (r) {
            ui.toast({ kind: 'success', timeout_ms: 9000, message: 'Imported ' + r.n + ' change' + (r.n === 1 ? '' : 's') + '. The previous data is kept in ' + r.safety_copy + '.' });
            v = null; fileName = ''; picker.value = ''; paint();
            if (window.MRT.app.recheckUser()) window.MRT.app.route();
          }).catch(function (e) { ui.toastError('Could not import: ' + e.message, e); });
        }
      })));
      ui.mount(preview, lines);
    }
    picker.addEventListener('change', function () {
      var f = picker.files && picker.files[0];
      if (!f) return;
      fileName = f.name;
      ui.mount(preview, ui.el('p', { class: 'muted', text: 'Reading ' + f.name + '…' }));
      XB.readFile(f).then(function (sheets) { v = XB.validateSheets(sheets, store.data()); paint(); })
        .catch(function (e) { v = { fatal: e.message, rows: [] }; paint(); });
    });
    paint();
    return k.panel('Master Excel import', 'upload', [], [
      ui.el('p', { class: 'muted', text: 'Upload a Master Excel file exported from this app. Only Priority, Assigned to, Needed by, Expected done and Purpose change; status moves and new requests stay in the app. ' +
        'Nothing saves until every row is green - one red row stops the whole file, and the live file is copied to ' + cfg.backup_dir + '/ first.' }),
      picker, reason.node, preview
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
