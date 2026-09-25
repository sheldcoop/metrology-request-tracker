/**
 * Metrology Request Tracker - views/requests.js
 *
 * My requests (#/requests, Q16, Q20, DECISIONS M3-11): the engineer's own
 * requests. "Waiting on you" on top (a clarification to answer, completed
 * results to check - Results OK / Reopen, Q34), then open ones, then the
 * rest, newest first; drafts in their own part. Status, needed-by with the
 * lab-time countdown, expected done, who has it. Filter by status, tool or
 * a lot / request number ("where is my lot"). The 1 s tick updates the
 * countdown text only.
 */
window.MRT = window.MRT || {};
window.MRT.views = window.MRT.views || {};
window.MRT.views.requests = (function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var D = window.MRT.domain;
  var A = window.MRT.requestActions;

  var PAGE = 100;
  var view = { status: 'active', tool: '', text: '', shown: PAGE };
  var clocks = [];

  var STATUS_FILTER = [
    { value: 'active', label: 'Waiting on me + open' }, { value: 'mine', label: 'Waiting on me' }, { value: 'open', label: 'Open' },
    { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }, { value: 'drafts', label: 'Drafts' }, { value: 'all', label: 'All' }
  ];

  function byId(coll, id) { return id ? store.byId(coll, id) : null; }

  /** A clarification to answer, or completed results not yet checked (and not closed). */
  function waitingOnMe(r, now) {
    return r.status === 'clarification' || (r.status === 'completed' && !D.isClosed(r, now));
  }

  function render(main, ctx) {
    // #/requests/open (the alert strip's links): open on that filter
    var want = ctx && ctx.subpath;
    if (want && STATUS_FILTER.some(function (f) { return f.value === want; })) { view.status = want; view.shown = PAGE; }
    var me = store.currentUser();
    clocks = [];
    var shownRows = [];      // the list as filtered now - what Download writes (Q48)
    main.appendChild(ui.pageHead('My requests', 'Everything you asked the lab for. Waiting on you comes first.', [
      window.MRT.exporter.rowsButton('Download', 'My requests', function () { return window.MRT.exporter.requestRows(shownRows); }),
      D.canRequest(me) ? ui.button('New request', { kind: 'primary', icon: 'plus', onClick: function () { location.hash = '#/new'; } }) : null]));
    var mineAll = store.visibleRequests(function (r) { return r.requester_id === me.id; });
    if (!mineAll.length) {
      main.appendChild(ui.emptyState({ icon: 'requests', title: 'No requests yet', text: 'Start with New request - register the lot first if it is new.',
        actionLabel: D.canRequest(me) ? 'New request' : null, onAction: function () { location.hash = '#/new'; } }));
      return;
    }
    var tools = store.list('tools', { all: true }).filter(function (t) { return mineAll.some(function (r) { return r.tool_id === t.id; }); });
    var statusF = ui.field({ label: 'Show', options: STATUS_FILTER, value: view.status, cls: 'queue-status' });
    var toolF = ui.field({ label: 'Tool', options: [{ value: '', label: 'All tools' }].concat(tools.map(function (t) { return { value: t.id, label: t.code }; })), value: view.tool, cls: 'queue-status' });
    var textF = ui.field({ label: 'Lot or request number', value: view.text, placeholder: 'e.g. 18178 or FIB-2609' });
    statusF.input.addEventListener('change', function () { view.status = statusF.value(); view.shown = PAGE; draw(); });
    toolF.input.addEventListener('change', function () { view.tool = toolF.value(); view.shown = PAGE; draw(); });
    textF.input.addEventListener('input', function () { view.text = textF.value(); view.shown = PAGE; draw(); });
    var holder = ui.el('div');
    main.appendChild(ui.el('div', { class: 'lots-tools' }, [statusF.node, toolF.node, textF.node]));
    main.appendChild(holder);

    function draw() {
      clocks = [];
      var now = Date.now();
      var q = D.normalizeName(view.text || '');
      var list = mineAll.filter(function (r) {
        if (view.tool && r.tool_id !== view.tool) return false;
        if (q) {
          var lot = byId('lots', r.lot_id);
          if (D.normalizeName((r.request_no || '') + ' ' + (lot ? lot.lot_number : '')).indexOf(q) === -1) return false;
        }
        switch (view.status) {
          case 'active': return waitingOnMe(r, now) || D.isOpen(r);
          case 'mine': return waitingOnMe(r, now);
          case 'open': return D.isOpen(r);
          case 'completed': return r.status === 'completed';
          case 'cancelled': return r.status === 'cancelled';
          case 'drafts': return r.status === 'draft';
          default: return true;
        }
      });
      function rank(r) { return waitingOnMe(r, now) ? 0 : D.isOpen(r) ? 1 : r.status === 'draft' ? 2 : 3; }
      list.sort(function (a, b) { return rank(a) - rank(b); });     // stable: newest first within each part
      shownRows = list;
      var waiting = mineAll.filter(function (r) { return waitingOnMe(r, now); }).length;
      var oldDrafts = mineAll.filter(function (r) { return D.isOldDraft(r, now); }).length;
      ui.mount(holder, [
        ui.el('p', { class: 'muted' }, [list.length + ' shown', waiting ? ui.el('span', { class: 'chip warning', text: waiting + ' waiting on you' }) : null,
          oldDrafts ? ui.el('a', { href: '#/requests', class: 'chip warning', text: oldDrafts + ' old draft' + (oldDrafts === 1 ? '' : 's') + ' to clean up',
            onclick: function (ev) { ev.preventDefault(); view.status = 'drafts'; statusF.input.value = 'drafts'; draw(); } }) : null]),
        list.length ? table(list.slice(0, view.shown), now) : ui.emptyState({ icon: 'requests', title: 'Nothing matches', text: 'Try "All" or clear the filter.' }),
        list.length > view.shown ? ui.button('Show ' + Math.min(PAGE, list.length - view.shown) + ' more', { size: 'sm', onClick: function () { view.shown += PAGE; draw(); } }) : null
      ]);
      tick();
    }

    function table(list, now) {
      return ui.el('div', { class: 'table-wrap' }, ui.el('table', { class: 'grid queue-table' }, [
        ui.el('thead', {}, ui.el('tr', {}, ['Request', 'Lot / panels', 'Status', 'Priority', 'Needed by', 'Expected done', 'With', ''].map(function (h, i) {
          return ui.el('th', { scope: 'col', class: i === 7 ? 'actions' : null, text: h });
        }))),
        ui.el('tbody', {}, list.map(function (r) { return row(r, now); }))
      ]));
    }

    function row(r, now) {
      var tool = byId('tools', r.tool_id), lot = byId('lots', r.lot_id), prio = byId('priorities', r.priority_id), qe = byId('users', r.assigned_to);
      var closed = D.isClosed(r, now), late = D.isLate(r, now, store.calendar());
      var clock = ui.el('span', { class: 'q-clock' });
      clocks.push({ node: clock, r: r });
      var link = r.status === 'draft' ? '#/new/' + r.id : '#/request/' + r.id;
      var acts = A.buttons(r, { size: 'sm', only: ['answer', 'results_ok', 'reopen'] });
      if (r.status === 'draft') acts.push(ui.button('Carry on', { size: 'sm', icon: 'edit', onClick: function () { location.hash = link; } }));
      return ui.el('tr', { id: 'row-' + r.id, class: 'q-row prio-' + (prio ? prio.level : 3) + (late ? ' is-late' : '') + (waitingOnMe(r, now) ? ' is-mine' : '') }, [
        ui.el('td', {}, ui.el('span', { class: 'cell-tool' }, [tool ? ui.toolGlyph(tool.glyph, { size: 24 }) : null,
          ui.el('a', { class: 'mono', href: link, text: r.request_no || ((tool ? tool.code : '?') + ' draft') }),
          D.isOldDraft(r, now) ? ui.el('span', { class: 'chip warning', title: 'Untouched for 30 days or more - submit or delete it (Q33)', text: '30+ days' }) : null])),
        ui.el('td', {}, [ui.el('span', { class: 'mono', text: lot ? lot.lot_number : '-' }), ui.el('span', { class: 'muted', text: '  ' + D.panelsText(r) })]),
        ui.el('td', {}, ui.el('span', { class: 'chip ' + chip(r, closed), text: closed ? 'Closed' : D.REQUEST_STATUS_LABEL[r.status] })),
        ui.el('td', { text: prio ? prio.name : '-' }),
        ui.el('td', {}, [ui.el('span', { class: 'num', text: r.needed_by || '-' }), ui.el('br'), clock]),
        ui.el('td', {}, ui.el('span', { class: 'num' + (r.expected_done && r.needed_by && r.expected_done > r.needed_by ? ' is-later' : ''), text: r.expected_done || '-' })),
        ui.el('td', { text: qe ? qe.name : '-' }),
        ui.el('td', { class: 'actions' }, ui.el('span', { class: 'row-actions' }, acts))
      ]);
    }

    draw();
  }

  function chip(r, closed) {
    if (closed) return 'neutral';
    return { clarification: 'warning', on_hold: 'warning', completed: 'ok', cancelled: 'expired', draft: 'neutral', in_progress: 'ok', accepted: 'ok' }[r.status] || 'neutral';
  }

  function tick() {
    if (!clocks.length) return;
    var now = Date.now(), cal = store.calendar(), hs = D.holidaySet(store.data().holidays);
    clocks.forEach(function (c) {
      var r = c.r;
      if (!D.isOpen(r)) { c.node.textContent = ''; return; }
      if (r.status === 'on_hold') { c.node.textContent = 'on hold'; return; }
      var cd = r.needed_by ? D.countdown(now, r.needed_by, cal, hs) : null;
      if (!cd) { c.node.textContent = ''; return; }
      var h = ui.formatDurationH(cd.lab_ms / 3600000);
      c.node.textContent = cd.late ? 'late ' + h : h + ' left';
      c.node.className = 'q-clock ' + (cd.late ? 'is-late' : cd.lab_ms < 8 * 3600000 ? 'is-soon' : '');
    });
  }

  return { render: render, tick: tick };
})();
