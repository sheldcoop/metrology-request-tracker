/**
 * Metrology Request Tracker - views/results.js
 *
 * Results (#/results): one line per finished request - request number,
 * results folder, analyzed data folder. Both paths open on one click
 * (file:// links, from this file:// page) with a Copy button next to
 * each. Only requests the person may see; completed ones show their
 * results path, analyzed ones both. Newest first, 100 rows per page.
 */
window.MRT = window.MRT || {};
window.MRT.views = window.MRT.views || {};
window.MRT.views.results = (function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var D = window.MRT.domain;

  var PAGE = 100;
  var shown = PAGE;

  function fileUrl(p) {
    if (!D.isSharePath(p)) return null;
    var s = String(p).replace(/\\/g, '/');
    return encodeURI(/^\/\//.test(s) ? 'file:' + s : 'file:///' + s);
  }

  function pathCell(path) {
    if (!path) return ui.el('span', { class: 'muted', text: '-' });
    var url = fileUrl(path);
    var text = url ? ui.el('a', { class: 'mono path-link', href: url, text: path, title: path + ' - open' })
                   : ui.el('span', { class: 'mono', text: path, title: path });
    return ui.el('span', { class: 'cell-path' }, [text,
      ui.button('', { kind: 'ghost', size: 'sm', icon: 'copy', ariaLabel: 'Copy path', title: 'Copy path',
        onClick: function () { ui.copyText(path, 'Path copied'); } })]);
  }

  function render(main) {
    shown = PAGE;
    var all = store.visibleRequests(function (r) { return r.status === 'completed' || r.status === 'analyzed'; });
    all.sort(function (a, b) { return String(a.completed_ts || '') < String(b.completed_ts || '') ? 1 : -1; });
    main.appendChild(ui.pageHead('Results', 'Finished requests and their data.'));
    var tools = store.list('tools').filter(function (t) { return all.some(function (r) { return r.tool_id === t.id; }); });
    var toolSel = ui.el('select', { class: 'input', 'aria-label': 'Filter by tool' },
      [{ v: '', t: 'All tools' }].concat(tools.map(function (t) { return { v: t.id, t: t.name }; })).map(function (o) {
        return ui.el('option', { value: o.v, text: o.t });
      }));
    var idSearch = ui.field({ label: 'Request ID', mono: true, placeholder: 'e.g. FIB-260924-01', cls: 'inline' });
    toolSel.addEventListener('change', function () { shown = PAGE; draw(); });
    idSearch.input.addEventListener('input', function () { shown = PAGE; draw(); });
    main.appendChild(ui.el('div', { class: 'results-filters' }, [
      ui.el('label', { class: 'ifield' }, [ui.el('span', { class: 'ifield-label', text: 'Tool' }), toolSel]),
      idSearch.node
    ]));
    var holder = ui.el('div');
    main.appendChild(holder);

    function filtered() {
      var q = idSearch.value().trim().toLowerCase();
      return all.filter(function (r) {
        if (toolSel.value && r.tool_id !== toolSel.value) return false;
        if (q && String(r.request_no || '').toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
    }

    function draw() {
      var list = filtered();
      var rows = list.slice(0, shown).map(function (r) {
        return ui.el('tr', {}, [
          ui.el('td', {}, ui.el('a', { href: '#/request/' + r.id, text: r.request_no || '(no number)' })),
          ui.el('td', {}, pathCell(r.results_path)),
          ui.el('td', {}, pathCell(r.analyzed_path))
        ]);
      });
      ui.mount(holder, [
        list.length ? ui.el('div', { class: 'table-wrap' }, ui.el('table', { class: 'grid' }, [
          ui.el('thead', {}, ui.el('tr', {}, ['Request', 'Result path', 'Analyzed data path'].map(function (h) {
            return ui.el('th', { scope: 'col', text: h });
          }))),
          ui.el('tbody', {}, rows)
        ])) : (all.length ? ui.emptyState({ icon: 'search', title: 'No requests match', text: 'Loosen the tool filter or the ID search.' })
          : ui.emptyState({ icon: 'folder', title: 'No finished requests yet', text: 'Completed requests appear here with their results folder; analyzed ones add the analyzed data folder.' })),
        list.length > shown ? ui.button('Show ' + Math.min(PAGE, list.length - shown) + ' more', { size: 'sm',
          onClick: function () { shown += PAGE; draw(); } }) : null
      ]);
    }
    draw();
  }

  return { render: render };
})();
