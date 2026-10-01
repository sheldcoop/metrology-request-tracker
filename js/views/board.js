/**
 * Metrology Request Tracker - views/board.js
 *
 * The lab board (#/board, Q22, M3-8, P5, redesign Step 6b): numbered status
 * columns, one slim sticky lane header per tool (glyph, code, count).
 * Empty lanes are a thin strip; Completed + Analyzed are off by default.
 * Cards are two lines at a fixed height (Part A): the short ID (no tool
 * prefix - the lane shows the tool) with the panel count, or a red "late
 * N d" tag when late; lot + build-up with P1/P2 and one status chip at
 * most (Stuck covers On hold). Stripe for Line stop/Hot only. Countdown
 * and panels live in the hover tooltip and the drawer, which the 1 s tick
 * repaints as text. Click opens the side panel with the full traveller
 * and the usual action
 * buttons (same rules, dialogs and audit as everywhere); the panel has an
 * explicit "Open page" link. Ctrl/middle click still opens the request
 * page. Nothing is dragged.
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
    { key: 'panels_received', label: 'Panels received', has: ['panels_received'] },
    { key: 'in_progress', label: 'In progress', has: ['in_progress'] },
    { key: 'waiting', label: 'Waiting', has: ['on_hold', 'clarification'] },
    { key: 'completed', label: 'Completed (7 days)', has: ['completed'] },
    { key: 'analyzed', label: 'Analyzed (7 days)', has: ['analyzed'] }
  ];
  var WEEK = 7 * 86400000;
  var COL_W = 150;   // status columns never go narrower; the wrap scrolls past that
  var view = { pick: null, only: 'all', q: '', done: null };   // done: show Completed + Analyzed (off by default, remembered)   // q: search text - other cards dim   // pick: 'all' | 'mine' | a tool id (remembered); only: 'all' | 'linestop' | 'late' | 'me'   // 'all' | 'mine' | a tool id - remembered per person on this PC
  var clocks = [];
  var open = null;       // the side panel, when one is open

  function byId(coll, id) { return id ? store.byId(coll, id) : null; }
  function levelOf(r) { var p = byId('priorities', r.priority_id); return p ? p.level : 99; }

  function render(main) {
    var me = store.currentUser();
    clocks = [];
    var tools = store.list('tools');
    var mineTools = tools.filter(function (t) { return D.isToolMeasurer(me, t); });
    var app = window.MRT.app;
    if (view.pick === null) view.pick = (app.readPref && app.readPref('board_tool')) || 'all';
    if (view.pick === 'mine' && !mineTools.length) view.pick = 'all';
    if (view.pick !== 'all' && view.pick !== 'mine' && !tools.some(function (t) { return t.id === view.pick; })) view.pick = 'all';
    var lanes = view.pick === 'mine' ? mineTools : view.pick === 'all' ? tools : tools.filter(function (t) { return t.id === view.pick; });
    var now = Date.now(), cal = store.calendar();
    var reqs = store.visibleRequests(function (r) {
      return D.isOpen(r) || (r.status === 'completed' && r.completed_ts && now - Date.parse(r.completed_ts) < WEEK) ||
        (r.status === 'analyzed' && r.analyzed_ts && now - Date.parse(r.analyzed_ts) < WEEK);
    });
    main.appendChild(ui.pageHead('Board', 'By tool. Click a card to act.'));
    if (view.done === null) view.done = !!(app.readPref && app.readPref('board_done') === 'show');
    var cols = view.done ? COLS : COLS.filter(function (c) { return c.key !== 'completed' && c.key !== 'analyzed'; });
    var shown = reqs.filter(function (r) { return passes(r, me, now, cal); });
    main.appendChild(scopeRow(tools, mineTools, reqs));
    main.appendChild(onlyPicker(reqs, me, now, cal));
    reqs = shown;

    if (!lanes.length) {
      main.appendChild(ui.emptyState({ icon: 'wrench', title: 'No tools yet', text: 'Add the lab\'s tools under Settings > Tools; each gets its own lane here.' }));
      return;
    }
    var hs = D.holidaySet(store.data().holidays || []);
    var holdSince = {};   // request id -> ts of its latest move to On hold (the Health page reads the same way)
    (store.data().request_events || []).forEach(function (e) {
      if (e.kind === 'status' && e.to === 'on_hold') holdSince[e.request_id] = e.ts;
    });
    var grid = ui.el('div', { class: 'board', style: { gridTemplateColumns: 'repeat(' + cols.length + ', minmax(' + COL_W + 'px, 1fr))',
      minWidth: (cols.length * (COL_W + 10)) + 'px' } });
    cols.forEach(function (c, i) {
      var n = reqs.filter(function (r) { return c.has.indexOf(r.status) !== -1 && lanes.some(function (t) { return t.id === r.tool_id; }); }).length;
      grid.appendChild(ui.el('div', { class: 'board-colhead' }, [ui.el('span', { class: 'board-step num', text: ('0' + (i + 1)).slice(-2) }),
        ui.el('b', { text: c.label }), ui.el('span', { class: 'board-count num' + (n ? '' : ' is-zero'), text: String(n) })]));
    });
    lanes.forEach(function (t) {
      var mine = reqs.filter(function (r) { return r.tool_id === t.id && (view.done || (r.status !== 'completed' && r.status !== 'analyzed')); });
      var open = mine.filter(function (r) { return D.isOpen(r); }).length;
      grid.appendChild(ui.el('div', { class: 'board-lanehead', style: { gridColumn: '1 / -1' } }, [
        ui.toolGlyph(t.glyph, { size: 18, state: t.status === 'up' ? 'idle' : t.status === 'down' ? 'off' : 'maint', destructive: t.destructive }),
        ui.el('b', { class: 'mono', text: t.code }),
        ui.el('span', { class: 'muted num', text: open + ' open' })
      ]));
      if (!mine.length) return;   // a thin strip: the header only
      cols.forEach(function (c) {
        var cards = D.sortQueue(mine.filter(function (r) { return c.has.indexOf(r.status) !== -1; }), { now_ts: now, cal: cal, levelOf: levelOf });
        var cell = ui.el('div', { class: 'board-cell', dataset: { col: c.key, tool: t.id }, 'aria-label': t.code + ' - ' + c.label },
          cards.map(function (r) { return card(r, now, cal, hs, holdSince[r.id]); }));
        if (!cards.length) cell.appendChild(ui.el('div', { class: 'muted', text: 'Nothing here' }));
        grid.appendChild(cell);
      });
    });
    main.appendChild(ui.el('div', { class: 'board-wrap' }, grid));
    tick();
    if (view.q) applySearch();
  }

  var ONLY = [{ key: 'all', label: 'Everything' }, { key: 'linestop', label: 'Line stop' }, { key: 'late', label: 'Late' }, { key: 'me', label: 'Assigned to me' }];

  /** The second filter row: priority / lateness / person (P5-5). */
  function passes(r, me, now, cal) {
    switch (view.only) {
      case 'linestop': return D.isOpen(r) && levelOf(r) === 1;
      case 'late': return D.isOpen(r) && D.isLate(r, now, cal);
      case 'me': return r.assigned_to === me.id;
      default: return true;
    }
  }
  function onlyPicker(reqs, me, now, cal) {
    var keep = view.only;
    var search = ui.el('input', { type: 'search', class: 'board-search mono', value: view.q, placeholder: 'Find: request, lot or Hirata ID', 'aria-label': 'Find on the board' });
    search.addEventListener('input', function () { view.q = search.value; applySearch(); });
    return ui.el('div', { class: 'tool-picks is-filters', role: 'group', 'aria-label': 'Show only' }, [ui.el('span', { class: 'muted tool-picks-label', text: 'Show' })].concat(ONLY.map(function (o) {
      view.only = o.key;
      var n = reqs.filter(function (r) { return D.isOpen(r) && passes(r, me, now, cal); }).length;
      view.only = keep;
      var on = keep === o.key;
      return ui.el('button', { type: 'button', class: 'tool-pick' + (on ? ' is-on' : '') + (o.key === 'linestop' && n ? ' is-alarm' : ''), 'aria-pressed': on ? 'true' : 'false',
        dataset: { only: o.key }, onclick: function () { view.only = o.key; window.MRT.app.route(); } },
        [ui.el('span', { text: o.label }), ui.el('span', { class: 'tool-pick-n num', text: String(n) })]);
    })).concat([ui.toggle({ kind: 'switch', label: 'Completed + Analyzed', checked: view.done, onChange: function (v) {
      view.done = v; if (window.MRT.app.writePref) window.MRT.app.writePref('board_done', v ? 'show' : 'hide'); window.MRT.app.route(); } }).node, search, ui.el('span', { class: 'muted board-search-n', 'aria-live': 'polite' })]));
  }

  /** Search (P5-6): matching cards stay, the others dim; nothing is re-drawn, so typing keeps focus. */
  function applySearch() {
    var q = (view.q || '').trim().toLowerCase().replace(/\s+/g, '');
    var cards = document.querySelectorAll('#main .bcard'), hits = 0;
    Array.prototype.forEach.call(cards, function (c) {
      var hit = !q || (c.dataset.find || '').indexOf(q) !== -1;
      if (q && hit) hits++;
      c.classList.toggle('is-miss', !hit);
      c.classList.toggle('is-hit', !!q && hit);
    });
    var n = document.querySelector('#main .board-search-n');
    if (n) n.textContent = q ? hits + ' found' : '';
  }

  /** Scope: All | Mine buttons plus one tool dropdown with open counts. */
  function scopeRow(tools, mineTools, reqs) {
    function openOn(ids) { return reqs.filter(function (r) { return D.isOpen(r) && ids.indexOf(r.tool_id) !== -1; }).length; }
    function pick(key) { view.pick = key; if (window.MRT.app.writePref) window.MRT.app.writePref('board_tool', key); window.MRT.app.route(); }
    function scopeBtn(key, label) {
      var on = view.pick === key;
      return ui.el('button', { type: 'button', class: 'tool-pick' + (on ? ' is-on' : ''), 'aria-pressed': on ? 'true' : 'false', dataset: { scope: key },
        onclick: function () { pick(key); } }, [ui.el('span', { text: label }),
        ui.el('span', { class: 'tool-pick-n num', text: String(openOn(key === 'mine' ? mineTools.map(function (t) { return t.id; }) : tools.map(function (t) { return t.id; }))) })]);
    }
    var toolF = ui.field({ label: 'Tool', value: (view.pick !== 'all' && view.pick !== 'mine') ? view.pick : '',
      options: [{ value: '', label: 'All tools (' + openOn(tools.map(function (t) { return t.id; })) + ')' }].concat(tools.map(function (t) {
        return { value: t.id, label: t.code + ' (' + openOn([t.id]) + ')' };
      })) });
    toolF.input.addEventListener('change', function () { pick(toolF.value() || 'all'); });
    return ui.el('div', { class: 'tool-picks', role: 'group', 'aria-label': 'Scope' }, [
      ui.el('span', { class: 'muted tool-picks-label', text: 'Scope' }),
      scopeBtn('all', 'All'), mineTools.length ? scopeBtn('mine', 'Mine') : null, toolF.node]);
  }

  /**
   * One card (Part A): two lines at a fixed height. Line 1: the short ID
   * (no tool prefix - the lane shows it) with the panel count, or a red
   * "late N d" tag when late. Line 2: lot + build-up (plus the count when
   * late) with P1/P2 and at most one status chip - Stuck covers On hold.
   * The full ID, countdown and panels live in the tooltip (repainted by
   * the tick) and the drawer.
   */
  function card(r, now, cal, hs, heldSinceTs) {
    var lot = byId('lots', r.lot_id), prio = byId('priorities', r.priority_id), bu = byId('buildups', r.buildup_id);
    var level = prio ? prio.level : 3;
    var late = D.isLate(r, now, cal);
    var stuck = r.status === 'on_hold' && D.holdLabDays(heldSinceTs, now, cal, hs) >= D.STUCK_HOLD_LAB_DAYS;
    var pnl = D.panelCountOf(r);
    var short = String(r.request_no || '').split('-').slice(1).join('-') || r.request_no;
    var first = late ? ui.el('span', { class: 'bcard-late', text: lateTag(r, now, cal, hs) })
      : ui.el('span', { class: 'bcard-pnl num', text: pnl + ' pnl' });
    var chip = stuck ? ui.statusBadge('warning', 'Stuck', { title: 'On hold 2 lab days or more - check with the lab' })
      : !late && r.status === 'on_hold' ? ui.statusBadge('warning', 'On hold')
      : !late && r.status === 'clarification' ? ui.statusBadge('warning', 'Question') : null;
    var node = ui.el('a', { class: 'bcard prio-' + level + (level === 1 && D.isOpen(r) ? ' is-urgent' : ''), href: '#/request/' + r.id,
      'aria-label': r.request_no + ', ' + D.REQUEST_STATUS_LABEL[r.status] + (prio ? ', ' + prio.name : ''),
      dataset: { id: r.id, find: [r.request_no, lot ? lot.lot_number : '', (r.panels || []).join(' ')].join(' ').toLowerCase().replace(/\s+/g, '|') } }, [
      ui.el('span', { class: 'bcard-line' }, [
        ui.el('span', { class: 'mono bcard-id', text: short }), first]),
      ui.el('span', { class: 'bcard-line' }, [
        ui.el('span', { class: 'mono', text: lot ? lot.lot_number : '?' }),
        bu ? ui.el('span', { class: 'muted', text: '  ·  ' + bu.code }) : null,
        late && pnl ? ui.el('span', { class: 'muted', text: '  ·  ' + pnl + ' pnl' }) : null,
        chip,
        level <= 2 && prio ? ui.el('span', { class: 'bcard-prio num', text: prio.code }) : null])
    ]);
    clocks.push({ node: node, r: r });
    paintTip(node, r, now, cal, hs);
    node.addEventListener('click', function (ev) {
      if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button) return;   // a new tab still opens the page
      ev.preventDefault();
      show(r.id);
    });
    return node;
  }

  /** "late 3 d" for the line-1 tag (calendar days, like the request page). */
  function lateTag(r, now, cal, hs) {
    var cd = D.countdown(now, r.needed_by, cal, hs);
    var d = cd ? -cd.days : 0;
    return d >= 1 ? 'late ' + d + ' d' : 'late today';
  }

  /** The hover tooltip: full ID, countdown, panels. Text only. */
  function paintTip(node, r, now, cal, hs) {
    var cd = r.needed_by ? D.countdown(now, r.needed_by, cal, hs) : null;
    var when = !cd ? 'no date' : cd.late ? 'late ' + ui.formatDurationH(cd.lab_ms / 3600000)
      : ui.formatDurationH(cd.lab_ms / 3600000) + ' left';
    node.title = r.request_no + ' · ' + when + ' · panels ' + D.panelsText(r);
  }

  /** The side panel: the full traveller and the action buttons. Also used by tests. */
  function show(requestId) {
    var r = byId('requests', requestId);
    if (!r) return null;
    if (open) open.close();
    var acts = A.buttons(r, { after: function () { if (open) open.close(); window.MRT.app.route(); } });
    open = ui.drawer({ title: r.request_no, icon: 'requests', body: [window.MRT.views.request.card(r)],
      foot: acts.concat([ui.el('a', { class: 'btn', href: '#/request/' + r.id, onclick: function () { if (open) open.close(); }, text: 'Open page' })]),
      onClose: function () { open = null; } });
    return open;
  }

  /** The 1 s tick: the hover tooltip text only - the cards show no clock. */
  function tick() {
    if (!clocks.length) return;
    var now = Date.now(), cal = store.calendar(), hs = D.holidaySet(store.data().holidays);
    clocks.forEach(function (c) {
      if (c.node.isConnected === false) return;
      paintTip(c.node, c.r, now, cal, hs);
    });
  }

  return { render: render, tick: tick, show: show };
})();
