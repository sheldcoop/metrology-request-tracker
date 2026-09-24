/**
 * Metrology Request Tracker - views/board.js
 *
 * The lab board (#/board, Q22, Q39, DECISIONS M3-8): one lane per tool (its
 * glyph and status), columns Submitted | Accepted | In progress | Waiting
 * (on hold, needs clarification) | Completed (last 7 days). Cards are mini
 * travellers: priority stripe, ID, lot, panels, countdown; an open Line stop
 * pulses. The tool's quality engineers and admins drag a card to the next
 * column - the columns it may go to light up, the others dim; a drop runs
 * the same action as the button (with its dialog when one is needed).
 * Everyone else reads. Clicking a card opens the request page, where every
 * action is also a button (keyboard / no drag).
 */
window.MRT = window.MRT || {};
window.MRT.views = window.MRT.views || {};
window.MRT.views.board = (function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var D = window.MRT.domain;
  var A = window.MRT.requestActions;

  var COLS = [
    { key: 'submitted', label: 'Submitted', has: ['submitted'] },
    { key: 'accepted', label: 'Accepted', has: ['accepted'] },
    { key: 'in_progress', label: 'In progress', has: ['in_progress'] },
    { key: 'waiting', label: 'Waiting', has: ['on_hold', 'clarification'] },
    { key: 'completed', label: 'Completed (7 days)', has: ['completed'] }
  ];
  var WEEK = 7 * 86400000;
  var view = { mine: false };
  var clocks = [];
  var dragging = null;

  function byId(coll, id) { return id ? store.byId(coll, id) : null; }
  function levelOf(r) { var p = byId('priorities', r.priority_id); return p ? p.level : 99; }

  /** The action a drop on a column means for this card, or null (not allowed). */
  function dropAction(r, colKey) {
    var me = store.currentUser(), tool = byId('tools', r.tool_id), now = Date.now();
    var can = function (a) { return D.canAct(me, a, r, tool, now); };
    switch (colKey) {
      case 'accepted': return can('accept') ? 'accept' : (can('resume') && r.return_to === 'accepted') ? 'resume' : null;
      case 'in_progress': return can('start') ? 'start' : (can('resume') && r.return_to === 'in_progress') ? 'resume' : null;
      case 'waiting': return can('hold') ? 'hold' : null;
      case 'completed': return can('complete') ? 'complete' : null;
      case 'submitted': return (can('resume') && r.return_to === 'submitted') ? 'resume' : null;
      default: return null;
    }
  }

  function render(main) {
    var me = store.currentUser();
    clocks = [];
    var tools = store.list('tools');
    var mineTools = tools.filter(function (t) { return D.isToolMeasurer(me, t); });
    var lanes = view.mine && mineTools.length ? mineTools : tools;
    var now = Date.now(), cal = store.calendar();
    var reqs = store.visibleRequests(function (r) {
      return D.isOpen(r) || (r.status === 'completed' && r.completed_ts && now - Date.parse(r.completed_ts) < WEEK);
    });
    var canDragAny = mineTools.length || D.hasRole(me, 'admin');
    main.appendChild(ui.pageHead('Board', canDragAny ? 'Drag a card to move it on - the columns it may go to light up. Click a card for the full request.'
      : 'Every open request by tool. Click a card for the full request.',
      mineTools.length ? [ui.toggle({ kind: 'switch', label: 'Only my tools', checked: view.mine, onChange: function (v) { view.mine = v; window.MRT.app.route(); } }).node] : null));

    var grid = ui.el('div', { class: 'board', style: { gridTemplateColumns: '120px repeat(' + COLS.length + ', minmax(170px, 1fr))' } });
    grid.appendChild(ui.el('div', { class: 'board-corner' }));
    COLS.forEach(function (c) {
      var n = reqs.filter(function (r) { return c.has.indexOf(r.status) !== -1 && lanes.some(function (t) { return t.id === r.tool_id; }); }).length;
      grid.appendChild(ui.el('div', { class: 'board-colhead' }, [ui.el('b', { text: c.label }), ui.el('span', { class: 'num muted', text: String(n) })]));
    });
    lanes.forEach(function (t) {
      grid.appendChild(ui.el('div', { class: 'board-lane is-' + t.status }, [ui.toolGlyph(t.glyph, { size: 32, state: t.status === 'up' ? 'idle' : t.status === 'down' ? 'off' : 'maint' }),
        ui.el('b', { class: 'mono', text: t.code }), t.status !== 'up' ? ui.el('span', { class: 'chip ' + (t.status === 'down' ? 'expired' : 'warning'), text: D.TOOL_STATUS_LABEL[t.status] }) : null]));
      COLS.forEach(function (c) {
        var cards = D.sortQueue(reqs.filter(function (r) { return r.tool_id === t.id && c.has.indexOf(r.status) !== -1; }), { now_ts: now, cal: cal, levelOf: levelOf });
        var cell = ui.el('div', { class: 'board-cell', dataset: { col: c.key, tool: t.id }, 'aria-label': t.code + ' - ' + c.label }, cards.map(card));
        wireDrop(cell, c.key);
        grid.appendChild(cell);
      });
    });
    main.appendChild(ui.el('div', { class: 'board-wrap' }, grid));
    tick();
  }

  function card(r) {
    var lot = byId('lots', r.lot_id), prio = byId('priorities', r.priority_id), qe = byId('users', r.assigned_to);
    var me = store.currentUser(), tool = byId('tools', r.tool_id);
    var level = prio ? prio.level : 3;
    var movable = D.isOpen(r) && (D.hasRole(me, 'admin') || D.isToolMeasurer(me, tool));
    var clock = ui.el('span', { class: 'q-clock' });
    clocks.push({ node: clock, r: r });
    var node = ui.el('a', { class: 'bcard prio-' + level + (level === 1 && D.isOpen(r) ? ' is-urgent' : '') + (D.isLate(r, Date.now(), store.calendar()) ? ' is-late' : ''),
      href: '#/request/' + r.id, draggable: movable ? 'true' : null, dataset: { id: r.id },
      'aria-label': r.request_no + ', ' + D.REQUEST_STATUS_LABEL[r.status] + (prio ? ', ' + prio.name : '') }, [
      ui.el('div', { class: 'bcard-top' }, [ui.el('b', { class: 'mono', text: r.request_no }), prio ? ui.el('span', { class: 'bcard-prio', text: prio.name }) : null]),
      ui.el('div', { class: 'bcard-line mono', text: (lot ? lot.lot_number : '?') + '  ·  ' + (D.formatPanels(r.panels) || '-') }),
      ui.el('div', { class: 'bcard-line' }, [r.status === 'on_hold' ? ui.el('span', { class: 'chip warning', text: 'On hold' }) : r.status === 'clarification' ? ui.el('span', { class: 'chip warning', text: 'Question' }) : null,
        clock, qe ? ui.el('span', { class: 'bcard-who', title: qe.name, text: ui.initials(qe.name) }) : null])
    ]);
    if (movable) {
      node.addEventListener('dragstart', function (ev) {
        dragging = r;
        if (ev.dataTransfer) { ev.dataTransfer.setData('text/plain', r.id); ev.dataTransfer.effectAllowed = 'move'; }
        lightColumns(r);
      });
      node.addEventListener('dragend', function () { dragging = null; lightColumns(null); });
    }
    return node;
  }

  /** While dragging: the columns the card may go to light up, the others dim (Q39, P5). */
  function lightColumns(r) {
    document.querySelectorAll('.board-cell').forEach(function (cell) {
      var ok = r && cell.dataset.tool === r.tool_id && !!dropAction(r, cell.dataset.col);
      cell.classList.toggle('is-target', !!ok);
      cell.classList.toggle('is-dim', !!r && !ok);
    });
  }

  function wireDrop(cell, colKey) {
    cell.addEventListener('dragover', function (ev) {
      if (dragging && cell.dataset.tool === dragging.tool_id && dropAction(dragging, colKey)) ev.preventDefault();
    });
    cell.addEventListener('drop', function (ev) {
      ev.preventDefault();
      var r = dragging;
      dragging = null; lightColumns(null);
      if (r && cell.dataset.tool === r.tool_id) drop(r.id, colKey);
    });
  }

  /** Move a request to a column: the action it means, with its dialog. Also used by tests. */
  function drop(requestId, colKey) {
    var r = byId('requests', requestId);
    var a = r ? dropAction(r, colKey) : null;
    if (!a) { ui.toast({ message: 'It cannot go there from ' + (r ? D.REQUEST_STATUS_LABEL[r.status] : '?') + '.' }); return Promise.resolve(null); }
    return A.run(a, r);
  }

  function tick() {
    if (!clocks.length) return;
    var now = Date.now(), cal = store.calendar(), hs = D.holidaySet(store.data().holidays);
    clocks.forEach(function (c) {
      var r = c.r;
      if (!D.isOpen(r) || r.status === 'on_hold' || !r.needed_by) { c.node.textContent = ''; return; }
      var cd = D.countdown(now, r.needed_by, cal, hs);
      var h = ui.formatDurationH(cd.lab_ms / 3600000);
      c.node.textContent = cd.late ? 'late ' + h : h + ' left';
      c.node.className = 'q-clock ' + (cd.late ? 'is-late' : cd.lab_ms < 8 * 3600000 ? 'is-soon' : '');
    });
  }

  return { render: render, tick: tick, drop: drop, dropAction: dropAction };
})();
