/**
 * Metrology Request Tracker - views/queue.js
 *
 * My queue (#/queue, Q16, Q43, DECISIONS M3-10, redesign Step 4): the open
 * requests of the tools where I am the primary or backup quality engineer
 * (admins: every tool) as one box per request (js/ui/request-box.js),
 * grouped Line stop / Late / Due this week / Rest with neutral sticky
 * headers. One click per box (js/views/request-actions.js); tick several
 * for one bulk primary. Completing fades the box out with an Undo toast
 * and files it under "Done today".
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
  var WEEK_MS = 7 * 86400000;
  var view = { tool: 'all', status: 'open', shown: PAGE };
  var picked = {};
  var doneToday = [];     // {id, no, ts} completed on this page this session
  var justDone = {};      // id -> true while the "Completed" box fades out
  var doneOpen = false;   // the "Done today" section starts collapsed

  var STATUS_FILTER = [
    { value: 'open', label: 'All open' }, { value: 'mine', label: 'Assigned to me' },
    { value: 'submitted', label: 'Submitted' }, { value: 'accepted', label: 'Accepted' },
    { value: 'in_progress', label: 'In progress' }, { value: 'waiting', label: 'Waiting (hold, clarification)' },
    { value: 'linestop', label: 'Line stop' }, { value: 'late', label: 'Late' }, { value: 'on_hold', label: 'On hold' },
    { value: 'clarification', label: 'Needs clarification' }
  ];

  var GROUPS = [
    { key: 'linestop', label: 'Line stop' },
    { key: 'late', label: 'Late' },
    { key: 'week', label: 'Due this week' },
    { key: 'rest', label: 'Rest' }
  ];

  function byId(coll, id) { return id ? store.byId(coll, id) : null; }
  function levelOf(r) { var p = byId('priorities', r.priority_id); return p ? p.level : 99; }

  /** The tools this person works (the rule is domain.measuredTools, shared with the alert strip). */
  function myTools(me) { return D.measuredTools(me, store.list('tools')); }

  /** Step 4 pilot group: Line stop, then late, then due within 7 days, then the rest. */
  function groupOf(r, now, cal) {
    if (levelOf(r) === 1) return 'linestop';
    if (D.isLate(r, now, cal)) return 'late';
    var due = r.needed_by ? Date.parse(r.needed_by + 'T12:00:00Z') : NaN;
    if (!isNaN(due) && due <= now + WEEK_MS) return 'week';
    return 'rest';
  }

  function render(main, ctx) {
    var me = store.currentUser();
    // #/queue/late (the alert strip's links): open on that filter
    var want = ctx && ctx.subpath;
    if (want && STATUS_FILTER.some(function (f) { return f.value === want; })) { view.status = want; view.shown = PAGE; }
    var tools = myTools(me);
    var shownRows = [];      // the queue as filtered now - what Download writes (Q48)
    main.appendChild(ui.pageHead('My queue', tools.length ? 'Open requests of ' + tools.map(function (t) { return t.code; }).join(', ') +
      '. Line stop, late, needed-by order.' : 'Requests of your tools.',
      tools.length ? [window.MRT.exporter.rowsButton('Download', 'My queue', function () { return window.MRT.exporter.requestRows(shownRows); })] : null));
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
      var ids = tools.map(function (t) { return t.id; });
      var now = Date.now(), cal = store.calendar();
      var rows = store.visibleRequests(function (r) {
        if (!D.isOpen(r) || ids.indexOf(r.tool_id) === -1) return false;
        if (view.tool !== 'all' && r.tool_id !== view.tool) return false;
        if (view.status === 'mine') return r.assigned_to === me.id;
        if (view.status === 'waiting') return r.status === 'on_hold' || r.status === 'clarification';
        if (view.status === 'linestop') return levelOf(r) === 1;
        if (view.status === 'late') return D.isLate(r, now, cal);
        return view.status === 'open' || r.status === view.status;
      });
      var all = D.sortQueue(rows, { now_ts: now, cal: cal, levelOf: levelOf });
      shownRows = all;
      Object.keys(picked).forEach(function (id) { if (!all.some(function (r) { return r.id === id; })) delete picked[id]; });
      var list = all.slice(0, view.shown);
      var late = all.filter(function (r) { return D.isLate(r, now, cal); }).length;
      var mineCount = all.filter(function (r) { return r.assigned_to === me.id; }).length;
      var nodes = [shiftStrip(all.length, late, mineCount)];
      if (!all.length && !Object.keys(justDone).length) {
        nodes.push(ui.emptyState({ icon: 'inbox', title: 'Nothing waiting', text: 'No open requests match.' }));
      } else {
        var boxes = ui.el('div', { class: 'queue-list' });
        // Just-completed boxes fade out here: the request itself is no longer
        // open, so the group loop below would never render it.
        Object.keys(justDone).forEach(function (id) {
          if (all.some(function (r) { return r.id === id; })) return;
          var done = byId('requests', id);
          if (done) boxes.appendChild(ui.requestBox(done, { done: true }));
        });
        GROUPS.forEach(function (g) {
          var inGroup = list.filter(function (r) { return groupOf(r, now, cal) === g.key; });
          if (!inGroup.length) return;
          boxes.appendChild(ui.el('div', { class: 'qgroup' }, [g.label + '  ·  ', ui.el('span', { class: 'num', text: String(inGroup.length) })]));
          inGroup.forEach(function (r) { boxes.appendChild(box(r, me)); });
        });
        nodes.push(boxes);
        if (all.length > view.shown) {
          nodes.push(ui.button('Show ' + Math.min(PAGE, all.length - view.shown) + ' more', { size: 'sm', onClick: function () { view.shown += PAGE; draw(); } }));
        }
      }
      if (doneToday.length) nodes.push(doneTodaySection());
      ui.mount(holder, nodes);
      paintBulk();
    }

    function paintBulk() {
      var ids = Object.keys(picked);
      var rs = ids.map(function (id) { return byId('requests', id); }).filter(Boolean);
      var now = Date.now();
      function able(action) {
        return rs.filter(function (r) { return D.canAct(me, action === 'receive_start' ? 'receive' : action, r, byId('tools', r.tool_id), now); });
      }
      var options = [
        { action: 'accept', label: function (n) { return 'Accept all (' + n + ')'; } },
        { action: 'receive_start', label: function (n) { return 'Receive & start all (' + n + ')'; } },
        { action: 'start', label: function (n) { return 'Start all (' + n + ')'; } }
      ].map(function (o) { o.list = able(o.action); return o; }).filter(function (o) { return o.list.length; });
      function runBulk(o) {
        if (o.action === 'receive_start') receiveAll(o.list); else runAll(o.list, o.action, {});
      }
      var more = null;
      if (options.length > 1) {
        more = ui.button('...', { size: 'sm', ariaLabel: 'More bulk actions', title: 'More bulk actions', onClick: function () {
          ui.menu(more, options.slice(1).map(function (o) {
            return { label: o.label(o.list.length), onClick: function () { runBulk(o); } };
          }));
        } });
      }
      ui.mount(bulk, ids.length ? [
        ui.el('span', { text: ids.length + ' selected:' }),
        options.length ? ui.button(options[0].label(options[0].list.length),
          { size: 'sm', kind: 'primary', icon: 'check', onClick: function () { runBulk(options[0]); } }) : null,
        more,
        ui.button('Clear', { size: 'sm', kind: 'ghost', onClick: function () { picked = {}; draw(); } })
      ] : null);
      bulk.hidden = !ids.length;
    }

    /** One after the other, so each save sees the last (Q43 bulk); one undo unit for all. */
    function runAll(list, action, x) {
      var n = 0;
      var past = action === 'accept' ? 'accepted' : action === 'receive_start' ? 'received and started' : 'started';
      store.beginUndoGroup();
      list.reduce(function (p, r) {
        return p.then(function () {
          var q = action === 'receive_start'
            ? store.requestAction(r.id, 'receive', x).then(function () { return store.requestAction(r.id, 'start', {}); })
            : store.requestAction(r.id, action, x);
          return q.then(function () { n++; });
        });
      }, Promise.resolve()).then(function () {
        ui.toast({ kind: 'success', message: n + ' request' + (n === 1 ? '' : 's') + ' ' + past + '.' });
      }).catch(function (e) {
        ui.toastError(n + ' done, then: ' + e.message, e);
      }).then(function () {
        store.endUndoGroup(n + ' request' + (n === 1 ? '' : 's') + ' ' + past);
        picked = {}; window.MRT.app.route();
      });
    }

    /** Shift start: several lots arrive together, one shared place in the lab - each is received and started. */
    function receiveAll(list) {
      var where = ui.field({ label: 'Kept where in the lab (optional, same for all)', placeholder: 'e.g. FIB cabinet, shelf 2' });
      ui.dialog({ title: 'Receive & start - ' + list.length + ' requests', icon: 'activity', body: where.node, actions: [
        { label: 'Cancel', value: null },
        { label: 'Receive & start all', kind: 'primary', value: function () { return where.value(); } }
      ] }).then(function (v) {
        if (v === null || v === undefined) return;
        runAll(list, 'receive_start', { received_where: v });
      }).catch(function (e) { ui.toastError(e.message, e); });
    }

    /** Your shift in one glance: counts that filter the list. */
    function shiftStrip(n, late, mine) {
      function stat(v, label, bad, filter) {
        return ui.el('a', { class: 'qs' + (bad ? ' is-bad' : ''), href: '#/queue/' + filter,
                            'aria-label': v + ' ' + label + ' - show' }, [
          ui.el('span', { class: 'qs-n num', text: String(v) }), ' ', ui.el('span', { class: 'qs-l', text: label })]);
      }
      return ui.el('div', { class: 'queue-shift', 'aria-live': 'polite' }, [
        stat(n, 'open', false, 'open'),
        late ? stat(late, 'late', true, 'late') : null,
        mine ? stat(mine, 'yours', false, 'mine') : null
      ]);
    }

    /** Bottom line of the box: one filled primary, quiet Hold/clarify, the rest behind "...". */
    function boxActions(r) {
      var avail = A.available(r);
      var primary = A.primary(r);
      var nodes = [];
      if (primary) {
        var btns = A.buttons(r, { only: [primary], after: primary === 'complete' ? onCompleted : null });
        if (btns[0]) nodes.push(btns[0]);
      }
      ['hold', 'clarify'].forEach(function (a) {
        if (avail.indexOf(a) === -1) return;
        var b = A.buttons(r, { size: 'sm', only: [a] });
        if (b[0]) { b[0].setAttribute('class', 'btn btn-sm btn-ghost'); nodes.push(b[0]); }
      });
      var menuItems = [];
      if (avail.indexOf('take') !== -1) menuItems.push({ label: 'Take it', icon: 'user', onClick: function () { A.run('take', r); } });
      var bkm = byId('bkms', r.bkm_id), bkmPath = bkm ? bkm.path : r.bkm_path;
      if (bkmPath) menuItems.push({ label: 'Copy BKM path', icon: 'copy', onClick: function () { ui.copyText(bkmPath, 'BKM path copied'); } });
      avail.filter(function (a) { return a !== primary && ['hold', 'clarify', 'take'].indexOf(a) === -1; }).forEach(function (a) {
        menuItems.push({ label: A.label(a), onClick: function () { A.run(a, r); } });
      });
      if (D.canCancel(me, r, byId('tools', r.tool_id))) {
        menuItems.push({ label: 'Cancel request', icon: 'close', onClick: function () { cancelFor(r); } });
      }
      if (menuItems.length) {
        var more = ui.button('...', { size: 'sm', kind: 'ghost', ariaLabel: 'More actions for ' + r.request_no, title: 'More actions',
          onClick: function () { ui.menu(more, menuItems); } });
        nodes.push(more);
      }
      return nodes;
    }

    function cancelFor(r) {
      ui.promptReason({ title: 'Cancel ' + r.request_no, confirmLabel: 'Cancel request',
        message: 'The request stays visible as Cancelled, never deleted. Why?' })
        .then(function (reason) {
          if (!reason) return;
          return store.cancelRequest(r.id, reason).then(function (res) {
            var offer = A.emailOffer(res, 'cancel');
            ui.toast({ kind: 'success', message: r.request_no + ' cancelled.', actions: offer ? [offer] : null, timeout_ms: offer ? 8000 : undefined });
            window.MRT.app.route();
          });
        }).catch(function (e) { ui.toastError('Could not cancel: ' + e.message, e); });
    }

    /** After Complete on a box: "Completed" fades out, an Undo toast (10 s), filed under Done today. */
    function onCompleted(r) {
      doneToday.unshift({ id: r.id, no: r.request_no, ts: Date.now() });
      if (doneToday.length > 50) doneToday.length = 50;
      justDone[r.id] = true;
      window.MRT.app.route();
      ui.toast({ message: r.request_no + ' completed.', actions: [{ label: 'Undo', onClick: function () {
        delete justDone[r.id];
        for (var i = doneToday.length - 1; i >= 0; i--) if (doneToday[i].id === r.id) doneToday.splice(i, 1);
        store.undoLast().then(function () { window.MRT.app.route(); }).catch(function (e) { ui.toastError('Could not undo: ' + e.message, e); });
      } }], timeout_ms: 10000 });
      setTimeout(function () { delete justDone[r.id]; window.MRT.app.route(); }, 1200);
      return r;
    }

    function doneTodaySection() {
      var toggle = ui.button('Done today (' + doneToday.length + ')', { size: 'sm', kind: 'ghost', icon: doneOpen ? 'chevron_down' : 'chevron_right',
        ariaLabel: (doneOpen ? 'Hide' : 'Show') + ' requests completed today',
        onClick: function () { doneOpen = !doneOpen; draw(); } });
      return ui.el('div', { class: 'done-today' }, [toggle,
        doneOpen ? ui.el('ul', { class: 'done-list' }, doneToday.map(function (d) {
          return ui.el('li', {}, [ui.el('span', { class: 'mono', text: d.no }),
            ui.el('span', { class: 'muted', text: '  ·  ' + ui.formatTs(d.ts) })]);
        })) : null]);
    }

    function box(r) {
      if (justDone[r.id]) return ui.requestBox(r, { done: true });
      var tool = byId('tools', r.tool_id), lot = byId('lots', r.lot_id);
      var prio = byId('priorities', r.priority_id), bu = byId('buildups', r.buildup_id);
      var assigned = byId('users', r.assigned_to);
      return ui.requestBox(r, {
        tool: tool, lot: lot ? lot.lot_number : '?', buCode: bu ? bu.code : null,
        prio: prio, assignedName: assigned ? assigned.name : null,
        late: D.isLate(r, Date.now(), store.calendar()),
        statusChip: ui.statusBadge(statusChip(r.status), D.REQUEST_STATUS_LABEL[r.status]),
        tick: { checked: !!picked[r.id], label: 'Tick ' + r.request_no, onChange: function (on) { if (on) picked[r.id] = true; else delete picked[r.id]; paintBulk(); } },
        actions: boxActions(r)
      });
    }

    draw();
  }

  function statusChip(st) {
    return { submitted: 'neutral', accepted: 'ok', in_progress: 'ok', on_hold: 'warning', clarification: 'warning' }[st] || 'neutral';
  }

  /** The shell ticks every second; boxes carry no countdown, so there is nothing to repaint. */
  function tick() { return; }

  return { render: render, tick: tick };
})();
