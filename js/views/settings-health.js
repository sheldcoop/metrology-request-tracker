/**
 * Metrology Request Tracker - views/settings-health.js
 *
 * Settings > Health, the first tab:
 *   1. "Still to do before real use" - the office checklist, live
 *      (DECISIONS M1-11, OFFICE_SETUP.md): sample entries, tools without
 *      quality engineers or results root, calendar not confirmed, no closing days,
 *      people waiting for review ...
 *   2. "Data health" - broken links and odd states in the file.
 * The rules are in domain.js (setupTodo, healthIssues); this only shows
 * them, each with a link to the place to fix it. Nothing here writes.
 */
(function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;

  var SEVERITY = {
    todo:    { chip: 'warning', label: 'To do' },
    problem: { chip: 'expired', label: 'Problem' },
    warning: { chip: 'warning', label: 'Warning' },
    note:    { chip: 'neutral', label: 'Note' }
  };
  var TAB_LABEL = { users: 'People', tools: 'Tools', lists: 'Lists', calendar: 'Lab calendar', lots: 'Lots', request: 'request' };

  function K() { return window.MRT.settingsKit; }

  function itemRow(x) {
    var s = SEVERITY[x.severity];
    return [
      K().chip(s.label, s.chip),
      x.text,
      ui.el('a', { class: 'btn btn-sm', href: (x.tab === 'lots' || x.tab === 'request' ? '#/' : '#/settings/') + x.tab + (x.id ? '/' + x.id : '') },
            ['Open ' + (TAB_LABEL[x.tab] || x.tab), ui.icon('chevron_right', 14)])
    ];
  }

  var before = null;   // P7: lines seen last time; the ones gone now show once, struck through
  function fixedRows(now) {
    var keys = now.map(function (x) { return x.text; });
    var gone = before ? before.filter(function (x) { return keys.indexOf(x.text) === -1; }) : [];
    before = now.slice();
    return gone.map(function (x) { return [ui.el('span', { class: 'chip ok', text: 'Fixed' }), ui.el('span', { class: 'health-fixed', text: x.text }), '']; });
  }

  function render(body) {
    var k = K();
    var h = store.health();
    var fixed = fixedRows(h.todo.concat(h.issues));
    var order = { problem: 0, warning: 1, note: 2 };
    var issues = h.issues.slice().sort(function (a, b) { return order[a.severity] - order[b.severity]; });

    body.appendChild(ui.el('div', { class: 'health-kpis' }, [
      ui.kpiTile({ label: 'Still to do', value: h.todo.length, status: h.todo.length ? 'warning' : 'ok', icon: 'check', animate: false }).node,
      ui.kpiTile({ label: 'Problems', value: h.issues.filter(function (x) { return x.severity === 'problem'; }).length,
                   status: h.issues.some(function (x) { return x.severity === 'problem'; }) ? 'expired' : 'ok', icon: 'alert', animate: false }).node,
      ui.kpiTile({ label: 'Warnings', value: h.issues.filter(function (x) { return x.severity === 'warning'; }).length,
                   status: 'neutral', icon: 'info', animate: false }).node
    ]));

    body.appendChild(k.panel('Still to do before real use', 'check', [], h.todo.length ? [
      ui.el('p', { class: 'muted', text: 'The office checklist (OFFICE_SETUP.md), kept up to date by the app. ' +
        'Each line goes away by itself once it is done.' }),
      k.table(['', 'What', { label: '', cls: 'actions' }], h.todo.map(itemRow))
    ] : ui.emptyState({ icon: 'check', title: 'Set up', text: 'Nothing left from the setup checklist.' })));

    body.appendChild(k.panel('Data health', 'activity', [], issues.length ? [
      ui.el('p', { class: 'muted', text: 'Checked each time this page opens. Nothing is changed here - open the entry and fix it.' }),
      k.table(['', 'What', { label: '', cls: 'actions' }], issues.map(itemRow))
    ] : ui.emptyState({ icon: 'check', title: 'Everything checks out', text: 'No broken links, no odd states.' })));
    if (fixed.length) body.appendChild(k.panel('Fixed since you last looked', 'check', [], k.table(['', 'What', { label: '', cls: 'actions' }], fixed)));
  }

  window.MRT.settingsTabs.push({ key: 'health', label: 'Health', icon: 'activity', order: 10, render: render });
})();
