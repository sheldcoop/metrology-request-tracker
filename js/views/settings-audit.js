/**
 * Metrology Request Tracker - views/settings-audit.js
 *
 * Settings > Audit log: every change ever made, newest first, 100 at a
 * time ("Show more"), with a filter over who / what / reason / values.
 * The log only grows - undo and restore add entries, never remove them.
 */
(function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;

  var PAGE = 100;
  var filterText = '';

  function short(v) {
    if (v === null || v === undefined) return '-';
    var s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.length > 60 ? s.slice(0, 59) + '…' : s;
  }

  function render(body) {
    var k = window.MRT.settingsKit;
    var log = store.data().audit_log;
    var shown = PAGE;
    var names = {};
    store.list('users', { all: true }).forEach(function (u) { names[u.id] = u.name; });

    var filter = ui.field({ label: 'Filter', value: filterText, placeholder: 'Person, what, field, value or reason' });
    var count = ui.el('p', { class: 'muted' });
    var host = ui.el('div');
    var more = ui.button('Show ' + PAGE + ' more', { size: 'sm', onClick: function () { shown += PAGE; fill(); } });

    function matches() {
      var q = filterText.toLowerCase();
      var out = [];
      for (var i = log.length - 1; i >= 0; i--) {
        var e = log[i];
        if (q) {
          var hay = [names[e.user_id], e.entity, e.entity_id, e.action, e.field, e.reason, short(e.old_value), short(e.new_value)].join(' ').toLowerCase();
          if (hay.indexOf(q) === -1) continue;
        }
        out.push(e);
      }
      return out;
    }

    function fill() {
      var all = matches();
      var page = all.slice(0, shown);
      count.textContent = log.length + ' entries' + (filterText ? ', ' + all.length + ' match' : '') + '. Newest first.';
      ui.mount(host, k.table(['When', 'Who', 'What', 'Change', 'Old → new', 'Reason'], page.map(function (e) {
        return [
          ui.el('span', { class: 'mono nowrap', text: ui.formatTs(e.ts) }),
          names[e.user_id] || k.muted(e.user_id || 'system'),
          ui.el('span', {}, [ui.el('b', { text: String(e.entity || '').replace(/_/g, ' ') }), ' ', k.muted(String(e.action || '').replace(/_/g, ' '))]),
          e.field ? ui.el('span', { class: 'mono', text: e.field }) : k.muted('-'),
          ui.el('span', { class: 'mono audit-values', text: short(e.old_value) + ' → ' + short(e.new_value) }),
          e.reason || k.muted('-')
        ];
      }), filterText ? 'Nothing matches the filter.' : 'The log fills as soon as something changes.'));
      more.hidden = all.length <= shown;
    }

    filter.input.addEventListener('input', function () { filterText = filter.value().trim(); shown = PAGE; fill(); });
    body.appendChild(k.panel('Audit log', 'refresh', [], [ui.el('div', { class: 'audit-filter' }, filter.node), count, host,
      ui.el('div', { class: 'form-actions' }, more)]));
    fill();
  }

  window.MRT.settingsTabs.push({ key: 'audit', label: 'Audit log', icon: 'refresh', order: 60, render: render });
})();
