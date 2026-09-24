/**
 * Metrology Request Tracker - views/queue.js
 *
 * My queue (#/queue, Q16, Q43, DECISIONS M3-10): the open requests of the
 * tools where I am the primary or backup quality engineer (admins: every
 * tool), "assigned to me" first, each part in the queue order of M2-5 (Line
 * stop on top, late next, then needed-by). Late ones red. One click per row
 * (js/views/request-actions.js); tick several for Accept all / Start all.
 * The 1 s tick updates the countdown text only.
 */
window.MRT = window.MRT || {};
window.MRT.views = window.MRT.views || {};
window.MRT.views.queue = (function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var D = window.MRT.domain;
  var A = window.MRT.requestActions;

  var PAGE = 100;
  var view = { tool: 'all', status: 'open', shown: PAGE };
  var picked = {};
  var clocks = [];            // [{node, r}] for tick()

  var STATUS_FILTER = [
    { value: 'open', label: 'All open' }, { value: 'submitted', label: 'Submitted' }, { value: 'accepted', label: 'Accepted' },
    { value: 'in_progress', label: 'In progress' }, { value: 'waiting', label: 'Waiting (hold, clarification)' }
  ];

  function byId(coll, id) { return id ? store.byId(coll, id) : null; }
  function levelOf(r) { var p = byId('priorities', r.priority_id); return p ? p.level : 99; }

  /** The tools this person works: primary/backup; admins without a tool of their own see all. */
  function myTools(me) {
    var tools = store.list('tools');
    var mine = tools.filter(function (t) { return D.isToolMeasurer(me, t); });
    return mine.length || !D.hasRole(me, 'admin') ? mine : tools;
  }

  function render(main) {
    var me = store.currentUser();
    clocks = [];
    var tools = myTools(me);
    main.appendChild(ui.pageHead('My queue', tools.length ? 'Open requests of ' + tools.map(function (t) { return t.code; }).join(', ') +
      ' - Line stop on top, then late, then by needed-by date.' : 'Quality engineers see the requests of their tools here.'));
    if (!tools.length) {
      main.appendChild(ui.emptyState({ icon: 'inbox', title: 'You are not a quality engineer of any tool',
        text: 'An admin sets the primary and backup quality engineer per tool (Settings > Tools). Your requests are under My requests.' }));
      return;
    }
    if (view.tool !== 'all' && !tools.some(function (t) { return t.id === view.tool; })) view.tool = 'all';

    var toolSeg = ui.segmented({ label: 'Tool', value: view.tool, options: [{ value: 'all', label: 'All' }].concat(tools.map(function (t) { return { value: t.id, label: t.code }; })),
      onChange: function (v) { view.tool = v; view.shown = PAGE; draw(); } });
    var statusF = ui.field({ label: 'Status', options: STATUS_FILTER, value: view.status, cls: 'queue-status' });
    statusF.input.addEventListener('change', function () { view.status = statusF.value(); view.shown = PAGE; draw(); });
    var bulk = ui.el('div', { class: 'queue-bulk' });
    var holder = ui.el('div');
    main.appendChild(ui.el('div', { class: 'lots-tools' }, [ui.el('div', { class: 'dlg-row' }, [ui.el('span', { class: 'ifield-label', text: 'Tool', 'aria-hidden': 'true' }), toolSeg.node]), statusF.node]));
    main.appendChild(bulk);
    main.appendChild(holder);

    function draw() {
      clocks = [];
      var ids = tools.map(function (t) { return t.id; });
      var now = Date.now(), cal = store.calendar();
      var rows = store.visibleRequests(function (r) {
        if (!D.isOpen(r) || ids.indexOf(r.tool_id) === -1) return false;
        if (view.tool !== 'all' && r.tool_id !== view.tool) return false;
        if (view.status === 'waiting') return r.status === 'on_hold' || r.status === 'clarification';
        return view.status === 'open' || r.status === view.status;
      });
      var sorted = D.sortQueue(rows, { now_ts: now, cal: cal, levelOf: levelOf });
      var mine = sorted.filter(function (r) { return r.assigned_to === me.id; });
      var rest = sorted.filter(function (r) { return r.assigned_to !== me.id; });
      var all = mine.concat(rest);
      Object.keys(picked).forEach(function (id) { if (!all.some(function (r) { return r.id === id; })) delete picked[id]; });
      var list = all.slice(0, view.shown);
      var late = all.filter(function (r) { return D.isLate(r, now, cal); }).length;
      ui.mount(holder, [
        ui.el('p', { class: 'muted' }, [all.length + ' open', late ? ui.el('span', { class: 'chip critical', text: late + ' late' }) : null,
          mine.length ? '  ·  ' + mine.length + ' assigned to you' : null]),
        all.length ? table(list, me, mine.length) : ui.emptyState({ icon: 'inbox', title: 'Nothing waiting', text: 'No open requests match.' }),
        all.length > view.shown ? ui.button('Show ' + Math.min(PAGE, all.length - view.shown) + ' more', { size: 'sm', onClick: function () { view.shown += PAGE; draw(); } }) : null
      ]);
      paintBulk();
      tick();
    }

    function paintBulk() {
      var ids = Object.keys(picked);
      var rs = ids.map(function (id) { return byId('requests', id); }).filter(Boolean);
      var canAccept = rs.filter(function (r) { return D.canAct(me, 'accept', r, byId('tools', r.tool_id), Date.now()); });
      var canStart = rs.filter(function (r) { return D.canAct(me, 'start', r, byId('tools', r.tool_id), Date.now()); });
      ui.mount(bulk, ids.length ? [
        ui.el('span', { text: ids.length + ' ticked' }),
        ui.button('Accept all (' + canAccept.length + ')', { size: 'sm', kind: 'primary', icon: 'check', disabled: !canAccept.length, onClick: function () { runAll(canAccept, 'accept', {}); } }),
        ui.button('Start all (' + canStart.length + ')', { size: 'sm', icon: 'activity', disabled: !canStart.length, onClick: function () { runAll(canStart, 'start', { received: true }); } }),
        ui.button('Clear', { size: 'sm', kind: 'ghost', onClick: function () { picked = {}; draw(); } })
      ] : null);
      bulk.hidden = !ids.length;
    }

    /** One after the other, so each save sees the last (Q43 bulk). */
    function runAll(list, action, x) {
      var n = 0;
      list.reduce(function (p, r) {
        return p.then(function () { return store.requestAction(r.id, action, x).then(function () { n++; }); });
      }, Promise.resolve()).then(function () {
        ui.toast({ kind: 'success', message: n + ' request' + (n === 1 ? '' : 's') + ' ' + (action === 'accept' ? 'accepted' : 'started') + '.' });
      }).catch(function (e) {
        ui.toastError(n + ' done, then: ' + e.message, e);
      }).then(function () { picked = {}; window.MRT.app.route(); });
    }

    function table(list, me, mineCount) {
      var tb = ui.el('tbody');
      list.forEach(function (r, i) {
        if (i === 0 && mineCount) tb.appendChild(ui.el('tr', { class: 'queue-sep' }, ui.el('td', { colspan: '10', text: 'Assigned to you' })));
        if (i === mineCount && i > 0) tb.appendChild(ui.el('tr', { class: 'queue-sep' }, ui.el('td', { colspan: '10', text: 'Others of your tools' })));
        tb.appendChild(row(r, me));
      });
      return ui.el('div', { class: 'table-wrap' }, ui.el('table', { class: 'grid queue-table' }, [
        ui.el('thead', {}, ui.el('tr', {}, ['', 'Priority', 'Request', 'Lot / panels', 'Requested by', 'Needed by', 'Status', 'Assigned', ''].map(function (h, i) {
          return ui.el('th', { scope: 'col', class: i === 8 ? 'actions' : null, text: h });
        }))),
        tb
      ]));
    }

    function row(r, me) {
      var tool = byId('tools', r.tool_id), lot = byId('lots', r.lot_id), prio = byId('priorities', r.priority_id);
      var bkm = byId('bkms', r.bkm_id), bkmPath = bkm ? bkm.path : r.bkm_path;
      var late = D.isLate(r, Date.now(), store.calendar());
      var tick = ui.el('input', { type: 'checkbox', 'aria-label': 'Tick ' + r.request_no, checked: !!picked[r.id] });
      tick.addEventListener('change', function () { if (tick.checked) picked[r.id] = true; else delete picked[r.id]; paintBulk(); });
      var clock = ui.el('span', { class: 'q-clock' });
      clocks.push({ node: clock, r: r });
      var who = byId('users', r.requester_id), assigned = byId('users', r.assigned_to);
      var actions = A.buttons(r, { size: 'sm', only: ['accept', 'start', 'complete', 'resume', 'received', 'take'] });
      if (bkmPath) actions.push(ui.button('', { kind: 'ghost', size: 'sm', icon: 'copy', ariaLabel: 'Copy BKM path of ' + r.request_no, title: 'Copy BKM path',
        onClick: function () { ui.copyText(bkmPath, 'BKM path copied'); } }));
      return ui.el('tr', { id: 'row-' + r.id, class: 'q-row prio-' + (prio ? prio.level : 3) + (late ? ' is-late' : '') }, [
        ui.el('td', {}, tick),
        ui.el('td', {}, prio ? ui.el('span', { class: 'q-prio' }, [ui.el('b', { text: prio.name }), ui.el('span', { class: 'mono muted', text: prio.code })]) : ''),
        ui.el('td', {}, ui.el('span', { class: 'cell-tool' }, [tool ? ui.toolGlyph(tool.glyph, { size: 24 }) : null,
          ui.el('a', { class: 'mono', href: '#/request/' + r.id, text: r.request_no }),
          !bkmPath ? ui.el('span', { class: 'chip warning', text: 'No BKM' }) : null])),
        ui.el('td', {}, [ui.el('span', { class: 'mono', text: lot ? lot.lot_number : '?' }), ui.el('span', { class: 'muted', text: '  ' + (D.formatPanels(r.panels) || '-') }),
          ui.el('div', { class: 'q-where', text: A.whereOf(r) })]),
        ui.el('td', { text: who ? who.name : '?' }),
        ui.el('td', {}, [ui.el('span', { class: 'num', text: r.needed_by || '-' }), ui.el('br'), clock]),
        ui.el('td', {}, ui.el('span', { class: 'chip ' + statusChip(r.status), text: D.REQUEST_STATUS_LABEL[r.status] })),
        ui.el('td', { text: assigned ? assigned.name : '-' }),
        ui.el('td', { class: 'actions' }, ui.el('span', { class: 'row-actions' }, actions))
      ]);
    }

    draw();
  }

  function statusChip(st) {
    return { submitted: 'neutral', accepted: 'ok', in_progress: 'ok', on_hold: 'warning', clarification: 'warning' }[st] || 'neutral';
  }

  /** The 1 s tick: countdown text only. */
  function tick() {
    if (!clocks.length) return;
    var now = Date.now(), cal = store.calendar(), hs = D.holidaySet(store.data().holidays);
    clocks.forEach(function (c) {
      var r = c.r;
      if (r.status === 'on_hold') { c.node.textContent = 'paused'; return; }
      var cd = r.needed_by ? D.countdown(now, r.needed_by, cal, hs) : null;
      if (!cd) { c.node.textContent = ''; return; }
      var h = ui.formatDurationH(cd.lab_ms / 3600000);
      c.node.textContent = cd.late ? 'late ' + h : h + ' left';
      c.node.className = 'q-clock ' + (cd.late ? 'is-late' : cd.lab_ms < 8 * 3600000 ? 'is-soon' : '');
    });
  }

  return { render: render, tick: tick };
})();
