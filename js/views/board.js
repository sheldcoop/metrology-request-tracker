/**
 * Metrology Request Tracker - views/board.js
 *
 * The lab board (#/board, Q22, M3-8, redesign P5): a lab rack. One lane per
 * tool (glyph, lamp, open count); lanes with nothing on them fold to a thin
 * line. Columns are the status slots Submitted | Accepted | In progress |
 * Waiting (on hold, needs clarification) | Completed (last 7 days). Cards are
 * compact mini travellers: priority stripe, ID, lot, panels, a needed-by
 * gauge and the quality engineer's initials.
 * Click only (P5-3): a click opens a side panel with the full traveller and
 * the usual action buttons (same rules, dialogs and audit as everywhere).
 * Ctrl/middle click still opens the request page. Nothing is dragged.
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
  var view = { pick: null, only: 'all' };   // pick: 'all' | 'mine' | a tool id (remembered); only: 'all' | 'linestop' | 'late' | 'me'   // 'all' | 'mine' | a tool id - remembered per person on this PC
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
      return D.isOpen(r) || (r.status === 'completed' && r.completed_ts && now - Date.parse(r.completed_ts) < WEEK);
    });
    main.appendChild(ui.pageHead('Board', 'Every open request by tool. Click a card to see it and act on it here.'));
    main.appendChild(toolPicker(tools, mineTools, reqs));
    var shown = reqs.filter(function (r) { return passes(r, me, now, cal); });
    main.appendChild(onlyPicker(reqs, me, now, cal));
    reqs = shown;

    if (!lanes.length) {
      main.appendChild(ui.emptyState({ icon: 'wrench', title: 'No tools yet', text: 'Add the lab\'s tools under Settings > Tools; each gets its own lane here.' }));
      return;
    }
    var grid = ui.el('div', { class: 'board', style: { gridTemplateColumns: '150px repeat(' + COLS.length + ', minmax(170px, 1fr))' } });
    grid.appendChild(ui.el('div', { class: 'board-corner' }, ui.el('span', { class: 'muted', text: 'Tool' })));
    COLS.forEach(function (c, i) {
      var n = reqs.filter(function (r) { return c.has.indexOf(r.status) !== -1 && lanes.some(function (t) { return t.id === r.tool_id; }); }).length;
      grid.appendChild(ui.el('div', { class: 'board-colhead is-' + c.key }, [ui.el('span', { class: 'board-step mono', text: String(i + 1) }),
        ui.el('b', { text: c.label }), ui.el('span', { class: 'board-count num' + (n ? '' : ' is-zero'), text: String(n) })]));
    });
    lanes.forEach(function (t) {
      var mine = reqs.filter(function (r) { return r.tool_id === t.id; });
      var open = mine.filter(function (r) { return D.isOpen(r); }).length;
      var running = mine.some(function (r) { return r.status === 'in_progress'; });
      var lane = ui.el('div', { class: 'board-lane is-' + t.status + (mine.length ? '' : ' is-empty') }, [
        ui.toolGlyph(t.glyph, { size: mine.length ? 32 : 20, state: t.status === 'up' ? (running ? 'live' : 'idle') : t.status === 'down' ? 'off' : 'maint' }),
        ui.el('div', { class: 'board-lane-name' }, [ui.el('b', { class: 'mono', text: t.code }),
          ui.el('span', { class: 'board-lamp is-' + t.status, title: D.TOOL_STATUS_LABEL[t.status] }, [ui.el('i'), ui.el('span', { text: D.TOOL_STATUS_LABEL[t.status] })])]),
        mine.length ? ui.el('span', { class: 'muted board-lane-open', text: open + ' open' }) : null
      ]);
      grid.appendChild(lane);
      if (!mine.length) {
        grid.appendChild(ui.el('div', { class: 'board-fold', style: { gridColumn: 'span ' + COLS.length }, text: 'Nothing on this tool' }));
        return;
      }
      COLS.forEach(function (c) {
        var cards = D.sortQueue(mine.filter(function (r) { return c.has.indexOf(r.status) !== -1; }), { now_ts: now, cal: cal, levelOf: levelOf });
        grid.appendChild(ui.el('div', { class: 'board-cell', dataset: { col: c.key, tool: t.id }, 'aria-label': t.code + ' - ' + c.label }, cards.map(card)));
      });
    });
    main.appendChild(ui.el('div', { class: 'board-wrap' }, grid));
    tick();
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
    return ui.el('div', { class: 'tool-picks is-filters', role: 'group', 'aria-label': 'Show only' }, [ui.el('span', { class: 'muted tool-picks-label', text: 'Show' })].concat(ONLY.map(function (o) {
      view.only = o.key;
      var n = reqs.filter(function (r) { return D.isOpen(r) && passes(r, me, now, cal); }).length;
      view.only = keep;
      var on = keep === o.key;
      return ui.el('button', { type: 'button', class: 'tool-pick' + (on ? ' is-on' : '') + (o.key === 'linestop' && n ? ' is-alarm' : ''), 'aria-pressed': on ? 'true' : 'false',
        dataset: { only: o.key }, onclick: function () { view.only = o.key; window.MRT.app.route(); } },
        [ui.el('span', { text: o.label }), ui.el('span', { class: 'tool-pick-n num', text: String(n) })]);
    })));
  }

  /** The tool picker on top: All, My tools, or one tool (with its open count). */
  function toolPicker(tools, mineTools, reqs) {
    function openOn(ids) { return reqs.filter(function (r) { return D.isOpen(r) && ids.indexOf(r.tool_id) !== -1; }).length; }
    function pick(key) { view.pick = key; if (window.MRT.app.writePref) window.MRT.app.writePref('board_tool', key); window.MRT.app.route(); }
    function chip(key, label, n, glyph) {
      var on = view.pick === key;
      return ui.el('button', { type: 'button', class: 'tool-pick' + (on ? ' is-on' : ''), 'aria-pressed': on ? 'true' : 'false', dataset: { pick: key },
        onclick: function () { pick(key); } }, [glyph || null, ui.el('span', { class: 'mono', text: label }), ui.el('span', { class: 'tool-pick-n num', text: String(n) })]);
    }
    var all = tools.map(function (t) { return t.id; });
    return ui.el('div', { class: 'tool-picks', role: 'group', 'aria-label': 'Show tools' }, [
      chip('all', 'All tools', openOn(all)),
      mineTools.length ? chip('mine', 'My tools', openOn(mineTools.map(function (t) { return t.id; }))) : null,
      ui.el('span', { class: 'tool-picks-sep', 'aria-hidden': 'true' })
    ].concat(tools.map(function (t) { return chip(t.id, t.code, openOn([t.id]), ui.toolGlyph(t.glyph, { size: 18, state: t.status === 'up' ? 'idle' : t.status === 'down' ? 'off' : 'maint' })); })));
  }

  function card(r) {
    var lot = byId('lots', r.lot_id), prio = byId('priorities', r.priority_id), qe = byId('users', r.assigned_to);
    var level = prio ? prio.level : 3;
    var clock = ui.el('span', { class: 'q-clock' });
    var bar = ui.el('i');
    var gauge = ui.el('span', { class: 'bgauge', 'aria-hidden': 'true' }, bar);
    clocks.push({ node: clock, gauge: gauge, bar: bar, r: r });
    var node = ui.traveller({
      id: r.request_no, level: level, urgent: level === 1 && D.isOpen(r), late: D.isLate(r, Date.now(), store.calendar()),
      prio: prio ? { name: prio.name, code: prio.code } : null, href: '#/request/' + r.id,
      ariaLabel: r.request_no + ', ' + D.REQUEST_STATUS_LABEL[r.status] + (prio ? ', ' + prio.name : ''),
      lines: [
        [(lot ? lot.lot_number : '?') + '  ·  ' + D.panelsText(r)],
        [gauge],
        [r.status === 'on_hold' ? ui.el('span', { class: 'chip warning', text: 'On hold' }) : r.status === 'clarification' ? ui.el('span', { class: 'chip warning', text: 'Question' }) : null,
         clock, qe ? ui.el('span', { class: 'bcard-who', title: qe.name, text: ui.initials(qe.name) }) : null]
      ]
    }, { size: 'card' });
    node.dataset.id = r.id;
    node.addEventListener('click', function (ev) {
      if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button) return;   // a new tab still opens the page
      ev.preventDefault();
      show(r.id);
    });
    return node;
  }

  /** The side panel: the full traveller and the action buttons. Also used by tests. */
  function show(requestId) {
    var r = byId('requests', requestId);
    if (!r) return null;
    if (open) open.close();
    var acts = A.buttons(r, { after: function () { if (open) open.close(); window.MRT.app.route(); } });
    open = ui.drawer({ title: r.request_no, icon: 'requests', body: [window.MRT.views.request.card(r)],
      foot: acts.concat([ui.el('a', { class: 'btn', href: '#/request/' + r.id, onclick: function () { if (open) open.close(); }, text: 'Open full page' })]),
      onClose: function () { open = null; } });
    return open;
  }

  function tick() {
    if (!clocks.length) return;
    var now = Date.now(), cal = store.calendar(), hs = D.holidaySet(store.data().holidays);
    clocks.forEach(function (c) {
      var r = c.r;
      c.gauge.className = 'bgauge' + (r.status === 'on_hold' ? ' is-paused' : '');
      if (!D.isOpen(r) || r.status === 'on_hold' || !r.needed_by) { c.node.textContent = r.status === 'on_hold' ? 'paused' : ''; c.bar.style.transform = 'scaleX(' + (r.status === 'on_hold' ? 1 : 0) + ')'; return; }
      var cd = D.countdown(now, r.needed_by, cal, hs);
      var h = ui.formatDurationH(cd.lab_ms / 3600000);
      c.node.textContent = (cd.late ? 'late ' + h : h + ' left') + (cd.paused ? ' \u23F8\uFE0E' : '');
      c.node.title = cd.paused ? 'Clock paused - outside lab hours' : '';
      var cls = cd.late ? 'is-late' : cd.lab_ms < 8 * 3600000 ? 'is-soon' : '';
      c.node.className = 'q-clock ' + cls;
      c.gauge.className = 'bgauge ' + cls;
      // full at 40 lab hours or more left, empty at the deadline; full red when late
      c.bar.style.transform = 'scaleX(' + (cd.late ? 1 : Math.max(0.04, Math.min(1, cd.lab_ms / (40 * 3600000)))) + ')';
    });
  }

  return { render: render, tick: tick, show: show };
})();
