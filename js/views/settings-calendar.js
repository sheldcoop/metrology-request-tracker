/**
 * Metrology Request Tracker - views/settings-calendar.js
 *
 * Settings > Lab calendar: lab days and hours (Europe/Vienna) and the
 * holidays - Austrian public holidays (filled in by rule) and company
 * closing days. Turnaround and lateness are counted in this working time
 * (Q36, clock maths from M2/M3).
 */
(function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var D = window.MRT.domain;

  var DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun']];
  var shownYear = null;

  function K() { return window.MRT.settingsKit; }
  function oops(e) { if (!K().quiet(e)) ui.toastError(e.message, e); else ui.toast({ message: e.message, timeout_ms: 2500 }); }

  function render(body, ctx) {
    body.appendChild(hoursPanel());
    body.appendChild(holidaysPanel());
    K().focusRow(body, ctx.focusId);
  }

  function hoursPanel() {
    var k = K();
    var cal = store.calendar();
    var confirmed = !!store.getSetting('calendar_confirmed');
    var f = ui.form([
      { key: 'days', label: 'Lab days', kind: 'checks', options: DAYS.map(function (d) { return { value: d[0], label: d[1] }; }) },
      { key: 'start', label: 'Opens', kind: 'text', mono: true, cls: 'half', placeholder: '07:00' },
      { key: 'end', label: 'Closes', kind: 'text', mono: true, cls: 'half', placeholder: '18:00' }
    ], cal);
    var err = ui.el('div');
    function save() {
      var v = f.values();
      f.clearErrors(); ui.clear(err);
      var bad = D.validateCalendar({ days: v.days, start: v.start, end: v.end });
      if (bad.length) { ui.mount(err, ui.el('p', { class: 'form-error', role: 'alert', text: bad.join('. ') })); return; }
      store.updateCalendar({ days: v.days, start: v.start, end: v.end }, 'Settings').then(function () {
        ui.toast({ kind: 'success', message: 'Lab calendar saved.' }); window.MRT.app.route();
      }).catch(oops);
    }
    return k.panel('Lab days and hours', 'clock', [], [
      ui.el('p', { class: 'muted', text: 'Europe/Vienna. Turnaround and "late" are counted in these hours only.' }),
      confirmed ? null : ui.el('p', { class: 'setup-note' }, [ui.icon('info', 14),
        ui.el('span', { text: 'Not confirmed yet: the days Mon-Fri were a first guess. Change them, or confirm they are right.' })]),
      f.node, err,
      ui.el('div', { class: 'form-actions' }, [
        ui.button('Save', { kind: 'primary', icon: 'save', onClick: save }),
        confirmed ? null : ui.button('These are right', { icon: 'check', onClick: function () {
          store.confirmCalendar().then(function () { ui.toast({ kind: 'success', message: 'Lab calendar confirmed.' }); window.MRT.app.route(); }).catch(oops);
        } })
      ])
    ]);
  }

  function holidaysPanel() {
    var k = K();
    var all = store.list('holidays', { all: true });
    var years = {};
    all.forEach(function (h) { years[h.date.slice(0, 4)] = true; });
    var thisYear = D.viennaYmd(Date.now()).slice(0, 4);
    years[thisYear] = true;
    var list = Object.keys(years).sort();
    if (!shownYear || list.indexOf(shownYear) === -1) shownYear = thisYear;
    var rows = all.filter(function (h) { return h.date.slice(0, 4) === shownYear; });
    var nextYear = String(parseInt(list[list.length - 1], 10) + 1);
    var hasPublic = rows.some(function (h) { return h.kind === 'public'; });

    var yearSeg = ui.segmented({ label: 'Year', value: shownYear, options: list.map(function (y) { return { value: y, label: y }; }),
      onChange: function (y) { shownYear = y; window.MRT.app.route(); } });

    return k.panel('Holidays and closing days', 'calendar', [
      ui.button('Add closing day', { size: 'sm', icon: 'plus', onClick: function () { closingDialog(null); } }),
      ui.button('Public holidays ' + (hasPublic ? nextYear : shownYear), { size: 'sm', icon: 'calendar',
        title: 'Add the Austrian public holidays of that year', onClick: function () {
          var y = parseInt(hasPublic ? nextYear : shownYear, 10);
          store.addPublicHolidays(y).then(function (n) {
            shownYear = String(y);
            ui.toast({ kind: 'success', message: n + ' public holidays added for ' + y + '.' }); window.MRT.app.route();
          }).catch(oops);
        } })
    ], [
      ui.el('div', { class: 'year-pick' }, [yearSeg.node]),
      k.table(['Date', 'Day', 'Name', 'Kind', { label: '', cls: 'actions' }], rows.map(function (h) {
        var d = new Date(h.date + 'T12:00:00Z');
        return { id: 'row-' + h.id, cells: [
          ui.el('span', { class: 'mono', text: ui.formatDate(d.toISOString()) }),
          ui.el('span', { class: 'muted', text: DAYS[(d.getUTCDay() + 6) % 7][1] }),
          h.name,
          k.chip(h.kind === 'public' ? 'Public holiday' : 'Closing day', h.kind === 'public' ? 'neutral' : 'warning'),
          ui.el('span', { class: 'row-actions' }, [k.editButton(h.name, function () { closingDialog(h); }), k.deleteButton('holidays', h, h.name + ' ' + h.date)])
        ] };
      }), 'No holidays listed for ' + shownYear + '.')
    ]);
  }

  function closingDialog(h) {
    var edit = !!h;
    return K().editDialog({
      title: edit ? 'Edit ' + h.name : 'Add a closing day', icon: 'calendar',
      values: edit ? { date: h.date, name: h.name, kind: h.kind } : { kind: 'closing' },
      fields: [
        { key: 'date', label: 'Date', kind: 'date', cls: 'half' },
        { key: 'kind', label: 'Kind', kind: 'select', cls: 'half', options: [{ value: 'closing', label: 'Company closing day' }, { value: 'public', label: 'Public holiday' }] },
        { key: 'name', label: 'Name', kind: 'text', placeholder: 'e.g. Christmas Eve' }
      ],
      check: function (v) {
        if (!D.isYmd(v.date)) return ['date', 'Pick a date'];
        if (!v.name) return ['name', 'Enter a name'];
        return null;
      },
      save: function (v) { return store.saveEntry('holidays', { id: edit ? h.id : undefined, version: edit ? h.version : undefined, fields: v, reason: 'Settings' }); },
      after: function (row) { if (row && row.date) shownYear = row.date.slice(0, 4); },
      done: edit ? 'Saved.' : 'Added.'
    }).catch(oops);
  }

  window.MRT.settingsTabs.push({ key: 'calendar', label: 'Lab calendar', icon: 'calendar', order: 50, render: render });
})();
