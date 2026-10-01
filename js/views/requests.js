/**
 * Metrology Request Tracker - views/requests.js
 *
 * My requests (#/requests, Q16, Q20, DECISIONS M3-11, redesign Step 5):
 * the engineer's own requests as one box per request (js/ui/request-box.js,
 * line 2 adds the process step), "Waiting on you" on top (a clarification
 * to answer, completed results to check - Reopen), then open ones, then the
 * rest, newest first. Completed ones keep Reopen and the results folder
 * link on the bottom line; analyzed ones live under the History filter.
 * Analysts get their own "To analyze" tab. Drafts carry on from their box.
 * Filter by status, tool or a lot / request number ("where is my lot").
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

  var STATUS_FILTER = [
    { value: 'active', label: 'Waiting on me + open' }, { value: 'mine', label: 'Waiting on me' }, { value: 'open', label: 'Open' },
    { value: 'completed', label: 'Completed' }, { value: 'toanalyze', label: 'To analyze' }, { value: 'history', label: 'History' },
    { value: 'cancelled', label: 'Cancelled' }, { value: 'drafts', label: 'Drafts' }, { value: 'all', label: 'All' },
    { value: 'templates', label: 'My templates' }
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
    var shownRows = [];      // the list as filtered now - what Download writes (Q48)
    var mineAll = store.visibleRequests(function (r) { return r.requester_id === me.id; });
    var toAnalyze = D.canAnalyze(me) ? store.visibleRequests(function (r) { return r.status === 'completed' && r.requester_id !== me.id; }) : [];
    main.appendChild(ui.pageHead('My requests', mineAll.length ? 'Your requests. Waiting on you first.' : 'Completed measurements waiting for analysis.', [
      window.MRT.exporter.rowsButton('Download', 'My requests', function () { return window.MRT.exporter.requestRows(shownRows); }),
      D.canRequest(me) ? ui.button('New request', { kind: 'primary', icon: 'plus', onClick: function () { location.hash = '#/new'; } }) : null]));
    if (!mineAll.length && !toAnalyze.length) {
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

    function stat(v, label, cls) {
      return ui.el('div', { class: 'qs ' + (cls || '') }, [
        ui.el('span', { class: 'qs-n num', text: String(v) }), ' ', ui.el('span', { class: 'qs-l', text: label })]);
    }

    function draw() {
      if (view.status === 'templates') { shownRows = []; ui.mount(holder, window.MRT.templates.list(me)); return; }
      var now = Date.now();
      var q = D.normalizeName(view.text || '');
      function textOk(r) {
        if (!q) return true;
        var lot = byId('lots', r.lot_id);
        return D.normalizeName((r.request_no || '') + ' ' + (lot ? lot.lot_number : '')).indexOf(q) !== -1;
      }
      function toolOk(r) { return !view.tool || r.tool_id === view.tool; }
      var source = view.status === 'toanalyze' ? toAnalyze : mineAll;
      var list = source.filter(function (r) {
        if (!toolOk(r) || !textOk(r)) return false;
        switch (view.status) {
          case 'active': return waitingOnMe(r, now) || D.isOpen(r);
          case 'mine': return waitingOnMe(r, now);
          case 'open': return D.isOpen(r);
          case 'toanalyze': return true;
          case 'completed': return r.status === 'completed';
          case 'history': return r.status === 'analyzed';
          case 'cancelled': return r.status === 'cancelled';
          case 'drafts': return r.status === 'draft';
          default: return true;
        }
      });
      function rank(r) { return waitingOnMe(r, now) ? 0 : D.isOpen(r) ? 1 : r.status === 'draft' ? 2 : 3; }
      list.sort(function (a, b) { return rank(a) - rank(b); });     // stable: newest first within each part
      shownRows = list;
      var waiting = mineAll.filter(function (r) { return waitingOnMe(r, now); }).length;
      var late = list.filter(function (r) { return D.isLate(r, now, store.calendar()); }).length;
      var oldDrafts = mineAll.filter(function (r) { return D.isOldDraft(r, now); }).length;
      var boxes = ui.el('div', { class: 'queue-list' });
      list.slice(0, view.shown).forEach(function (r) { boxes.appendChild(box(r, me, now)); });
      ui.mount(holder, [
        ui.el('div', {}, [
          ui.el('div', { class: 'queue-shift', 'aria-live': 'polite' }, [
            stat(list.length, 'shown'),
            waiting ? stat(waiting, 'waiting on you', 'is-warn') : null,
            late ? stat(late, 'late', 'is-bad') : null
          ]),
          oldDrafts ? ui.el('p', {}, ui.el('a', { href: '#/requests', class: 'chip warning', text: oldDrafts + ' old draft' + (oldDrafts === 1 ? '' : 's') + ' to clean up',
            onclick: function (ev) { ev.preventDefault(); view.status = 'drafts'; statusF.input.value = 'drafts'; draw(); } })) : null
        ]),
        list.length ? boxes : ui.emptyState({ icon: 'requests', title: 'Nothing matches', text: 'Try "All" or clear the filter.' }),
        list.length > view.shown ? ui.button('Show ' + Math.min(PAGE, list.length - view.shown) + ' more', { size: 'sm', onClick: function () { view.shown += PAGE; draw(); } }) : null
      ]);
    }

    /** One request as a box; line 2 adds the process step. Completed ones
     * keep Reopen and the results folder link; drafts carry on from the box. */
    function box(r, me, now) {
      var tool = byId('tools', r.tool_id), lot = byId('lots', r.lot_id);
      var prio = byId('priorities', r.priority_id), bu = byId('buildups', r.buildup_id);
      var step = byId('process_steps', r.process_step_id);
      var qe = byId('users', r.assigned_to);
      var closed = D.isClosed(r, now);
      return ui.requestBox({
        id: r.id, request_no: r.request_no || ((tool ? tool.code : '?') + ' draft')
      }, {
        tool: tool, lot: lot ? lot.lot_number : (r.status === 'draft' ? '-' : '?'),
        buCode: bu ? bu.code : null, step: step ? step.name : (r.process_step_other || null),
        prio: prio, assignedName: qe ? qe.name : (r.status === 'draft' ? null : '-'),
        late: D.isLate(r, now, store.calendar()),
        statusChip: ui.statusBadge(chip(r, closed), closed ? 'Closed' : D.REQUEST_STATUS_LABEL[r.status]),
        href: r.status === 'draft' ? '#/new/' + r.id : null,
        actions: boxActions(r)
      });
    }

    function boxActions(r) {
      if (r.status === 'draft') {
        return [ui.button('Carry on', { size: 'sm', icon: 'edit', onClick: function () { location.hash = '#/new/' + r.id; } }),
          ui.button('', { size: 'sm', kind: 'ghost', icon: 'trash', ariaLabel: 'Delete draft ' + (r.request_no || ''), title: 'Delete this draft',
            onClick: function () { deleteDraft(r); } })];
      }
      var acts = A.buttons(r, { size: 'sm', only: ['answer', 'analyze', 'reopen'] });
      if (r.status === 'completed' && r.results_path) acts.push(pathLink(r.results_path, 'Results path'));
      if (r.status === 'analyzed' && r.analyzed_path) acts.push(pathLink(r.analyzed_path, 'Analyzed data path'));
      return acts;
    }

    /** The results folder as a link, like on the request page. */
    function pathLink(path, what) {
      var url = null;
      if (D.isSharePath(path)) {
        var s = String(path).replace(/\\/g, '/');
        url = encodeURI(/^\/\//.test(s) ? 'file:' + s : 'file:///' + s);
      }
      var text = url ? ui.el('a', { class: 'mono path-link', href: url, text: path, title: path + ' - open' })
                     : ui.el('span', { class: 'mono', text: path, title: path });
      return ui.el('span', { class: 'cell-path' }, [text,
        ui.button('', { size: 'sm', kind: 'ghost', icon: 'copy', ariaLabel: 'Copy ' + what, title: 'Copy ' + what,
          onClick: function () { ui.copyText(path, what + ' copied'); } })]);
    }

    draw();
  }

  function deleteDraft(r) {
    ui.confirm({ title: 'Delete this draft?', message: 'The draft is removed for good. Nobody else has seen it.', confirmLabel: 'Delete', danger: true })
      .then(function (ok) {
        if (!ok) return;
        return store.deleteDraft(r.id).then(function () { ui.toast({ kind: 'success', message: 'Draft deleted.' }); window.MRT.app.route(); });
      }).catch(function (e) { ui.toastError(e.message, e); });
  }

  function chip(r, closed) {
    if (closed) return 'neutral';
    return { clarification: 'warning', on_hold: 'warning', completed: 'ok', cancelled: 'expired', draft: 'neutral', in_progress: 'ok', accepted: 'ok' }[r.status] || 'neutral';
  }

  /** The shell ticks every second; boxes carry no countdown, so there is nothing to repaint. */
  function tick() { return; }

  return { render: render, tick: tick };
})();
