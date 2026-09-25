/**
 * Metrology Request Tracker - views/request.js
 *
 * The request page (#/request/<id>, Q42, M2 step 5): the request drawn as a
 * lab traveller card - priority stripe, tool glyph, request ID, status stamp,
 * lot, priority, the needed-by countdown in lab time (Q36; the clock pauses
 * outside lab hours) and the panel map with the requested panels - then the
 * status rail (each step, who and when), the details with BKM and results
 * paths (Copy, Q30), and the timeline: status changes and comments with
 * @mentions (Q11). Under the card the workflow buttons (Accept, Start,
 * Hold, Complete ... - js/views/request-actions.js, M3-9); the requester
 * edits an open request with a reason (Q14) or cancels it (Q35).
 */
window.MRT = window.MRT || {};
window.MRT.views = window.MRT.views || {};
window.MRT.views.request = (function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var D = window.MRT.domain;
  var X = window.MRT.extraFields;

  var RAIL = ['submitted', 'accepted', 'in_progress', 'completed'];
  var STAMP = { draft: 'neutral', submitted: 'accent', accepted: 'ok', in_progress: 'ok', completed: 'ok',
                clarification: 'warning', on_hold: 'warning', cancelled: 'expired' };
  var live = { r: null, node: null, gauge: null };          // what tick() updates

  function byId(coll, id) { return id ? store.byId(coll, id) : null; }
  function userName(id) { var u = byId('users', id); return u ? u.name : '?'; }
  function muted(t) { return ui.el('span', { class: 'muted', text: t }); }
  function copyBtn(text, what) {
    return ui.button('', { kind: 'ghost', size: 'sm', icon: 'copy', ariaLabel: 'Copy ' + what, title: 'Copy ' + what,
      onClick: function () { ui.copyText(text, what + ' copied'); } });
  }

  function render(main, ctx) {
    var me = store.currentUser();
    var r = byId('requests', ctx.subpath);
    live.r = null;
    if (!r || !D.canSeeRequest(me, r)) {
      main.appendChild(ui.pageHead('Request'));
      main.appendChild(ui.emptyState({ icon: 'requests', title: r ? 'This draft is private' : 'Request not found',
        text: 'Search for a request ID at the top, e.g. FIB-2609.' }));
      return;
    }
    if (r.status === 'draft') { location.hash = '#/new/' + r.id; return; }
    var tool = byId('tools', r.tool_id), lot = byId('lots', r.lot_id);

    var actions = [
      D.canEditSubmitted(me, r) ? ui.button('Edit request', { icon: 'edit', onClick: function () { location.hash = '#/new/' + r.id; } }) : null,
      ui.button('Print slip', { icon: 'download', onClick: function () { location.hash = '#/slip/' + r.id; } }),
      ui.button('Copy this request', { icon: 'copy', onClick: function () { location.hash = '#/new?from=' + r.id; } }),
      D.canRequest(me) && (r.requester_id === me.id || D.hasRole(me, 'admin')) ? ui.button('Save as template', { icon: 'requests',
        title: 'Keep what stays the same for next time (not the lot, panels, place or dates)',
        onClick: function () { var ty = store.byId('measurement_types', r.type_id);
          window.MRT.templates.save([(store.byId('tools', r.tool_id) || {}).code, ty ? ty.name : ''].filter(Boolean).join(' '), { request_id: r.id }); } }) : null,
      lot && D.canRequest(me) ? ui.button('New request on this lot', { icon: 'plus', onClick: function () { location.hash = '#/new?lot=' + r.lot_id; } }) : null,
      D.canCancel(me, r, tool) ? ui.button('Cancel request', { kind: 'danger', icon: 'close', onClick: function () { cancel(r); } }) : null
    ];
    main.appendChild(ui.pageHead(r.request_no, (tool ? tool.name : '') + ' - requested by ' + userName(r.requester_id), actions));

    main.appendChild(traveller(r, tool, lot));
    var acts = window.MRT.requestActions.buttons(r);
    if (acts.length) main.appendChild(ui.el('div', { class: 'req-actbar', role: 'group', 'aria-label': 'What you can do now' }, acts));
    main.appendChild(rail(r));
    main.appendChild(ui.el('div', { class: 'req-layout' }, [
      ui.el('div', { class: 'req-form' }, [timeline(r, me)]),
      ui.el('aside', { class: 'req-side' }, [pathsPanel(r, tool), detailsPanel(r), peoplePanel(r, tool)])
    ]));
  }

  /* --- traveller card --------------------------------------------------- */

  function traveller(r, tool, lot) {
    var prio = byId('priorities', r.priority_id), type = byId('measurement_types', r.type_id);
    var level = prio ? prio.level : 3;
    var clock = ui.el('div', { class: 'tr-clock' });
    var gauge = r.needed_by && D.isOpen(r) ? ui.needleGauge() : null;
    live.r = r; live.node = clock; live.gauge = gauge;
    paintClock();
    var glyphState = r.status === 'in_progress' ? 'live' : tool && tool.status === 'down' ? 'off' : tool && tool.status === 'maintenance' ? 'maint' : 'idle';
    return ui.traveller({
      id: r.request_no, subtitle: (tool ? tool.code : '?') + '  ·  ' + (type ? type.name : 'no measurement type'),
      glyph: tool ? { key: tool.glyph, state: glyphState, label: tool.name } : null,
      level: level, urgent: level === 1 && D.isOpen(r),
      stamp: D.isClosed(r, Date.now()) ? { label: 'Closed', kind: 'neutral' } : { label: D.REQUEST_STATUS_LABEL[r.status], kind: STAMP[r.status] || 'neutral' },
      fields: [
        cell('Lot', lot ? [ui.el('b', { class: 'mono', text: lot.lot_number }), ui.el('span', { class: 'muted', text: '  ' +
          [(byId('projects', r.project_id) || {}).code, r.part_number_id ? (byId('part_numbers', r.part_number_id) || {}).code : null,
           (byId('buildups', r.buildup_id) || {}).code].filter(Boolean).join(' · ') })] : muted('?')),
        cell('Priority', prio ? ui.el('span', { class: 'tr-prio' }, [ui.el('b', { text: prio.name }), ui.el('span', { class: 'mono muted', text: prio.code })]) : muted('-'),
             r.priority_reason ? r.priority_reason : null),
        cell('Needed by', r.needed_by ? ui.el('b', { class: 'num', text: ui.formatDate(r.needed_by + 'T12:00:00Z') }) : muted('no date'), null,
          gauge ? ui.el('div', { class: 'tr-dial' }, [gauge.node, clock]) : clock),
        cell('Panels', ui.el('b', { class: 'mono', text: D.panelsText(r) + ((r.panels || []).length ? '  (' + r.panels.length + ')' : '') }),
          [(r.layers || []).length ? 'layer ' + r.layers.join(', ') : null, window.MRT.requestActions.whereOf(r) || null].filter(Boolean).join(' · ') || null,
          window.MRT.views.hirata.panelsView(r.panels, 'md')),
        cell('Submitted', ui.el('span', { class: 'num', text: ui.formatTs(r.submitted_ts) })),
        r.expected_done ? cell('Expected done', ui.el('b', { class: 'num', text: ui.formatDate(r.expected_done + 'T12:00:00Z') }),
          r.needed_by && r.expected_done > r.needed_by ? 'later than needed' : null) : null,
        cell('Assigned to', r.assigned_to ? userName(r.assigned_to) : muted('nobody yet')),
        r.received_ts ? cell('Panels received', userName(r.received_by) + ', ' + ui.formatTs(r.received_ts), r.received_where || null) : null,
        r.status === 'on_hold' ? cell('On hold', ((byId('hold_reasons', r.hold_reason_id) || {}).name || '?'), r.hold_note || null) : null
      ],
      footer: magazineView(r)
    }, { size: 'full' });
  }

  /** The magazine with this request's panels in their slots (F-3), when it has one. */
  function magazineView(r) {
    var m = r.magazine_id ? byId('magazines', r.magazine_id) : null;
    if (!m || !(r.slots || []).length) return null;
    var slotsNow = r.put_back && r.status === 'completed' ? r.put_back.slots : r.slots;
    var magNow = r.put_back && r.status === 'completed' ? byId('magazines', r.put_back.magazine_id) || m : m;
    return ui.magazineSlots({ magazine: magNow, picked: slotsNow, readOnly: true,
      labels: window.MRT.requestActions.slotLabels(r.panels, slotsNow) }).node;
  }

  /** One fact on the card (drawn by ui.traveller). */
  function cell(label, value, sub, extra) { return { label: label, value: value, sub: sub || null, extra: extra || null }; }

  /** The countdown text; the 1 s tick repaints only this (text only). */
  function paintClock() {
    var r = live.r, node = live.node;
    if (!r || !node) return;
    if (!r.needed_by) { node.textContent = 'The priority says how urgent it is.'; node.className = 'tr-clock'; return; }
    if (!D.isOpen(r)) { node.textContent = ''; node.className = 'tr-clock'; return; }
    var g = live.gauge;
    if (r.status === 'on_hold') { node.textContent = 'On hold - the clock is paused'; node.className = 'tr-clock is-paused'; if (g) g.set(dialUsed(r, null), 'paused'); return; }
    var hs = D.holidaySet(store.data().holidays);
    var c = D.countdown(Date.now(), r.needed_by, store.calendar(), hs);
    var h = ui.formatDurationH(c.lab_ms / 3600000);
    var days = c.late ? (c.days < 0 ? ' (' + -c.days + ' day' + (c.days === -1 ? '' : 's') + ')' : '')
                      : (c.days > 0 ? ' (' + c.days + ' day' + (c.days === 1 ? '' : 's') + ')' : ' (today)');
    node.textContent = (c.late ? 'Late by ' + h + ' lab time' : h + ' lab time left') + days + (c.paused ? '  ·  clock paused (outside lab hours)' : '');
    var state = c.late ? 'late' : c.lab_ms < 8 * 3600000 ? 'soon' : 'ok';
    node.className = 'tr-clock is-' + state + (c.paused ? ' is-paused' : '');
    if (g) g.set(dialUsed(r, c), c.paused && !c.late ? 'paused' : state);
  }

  /** How far the needle is: the share of lab time used from submitted to needed by (late = all of it). */
  function dialUsed(r, c) {
    var hs = D.holidaySet(store.data().holidays), cal = store.calendar();
    if (!c) c = D.countdown(Date.now(), r.needed_by, cal, hs);
    if (c.late) return 1;
    var total = r.submitted_ts ? D.countdown(Date.parse(r.submitted_ts), r.needed_by, cal, hs).lab_ms : 0;
    if (!(total > 0)) return c.lab_ms < 8 * 3600000 ? 0.85 : 0.2;
    return 1 - c.lab_ms / total;
  }

  /* --- status rail -------------------------------------------------------- */

  function rail(r) {
    var ev = store.requestEvents(r.id).filter(function (e) { return e.kind === 'status'; });
    function when(status) { var e = ev.filter(function (x) { return x.to === status; }).slice(-1)[0]; return e || null; }
    var reached = RAIL.indexOf(r.status);
    if (reached === -1) {
      // a side state: the last rail step it had reached
      RAIL.forEach(function (st, i) { if (when(st)) reached = i; });
    }
    var side = RAIL.indexOf(r.status) === -1 ? r.status : null;
    return ui.el('ol', { class: 'status-rail', 'aria-label': 'Status' }, RAIL.map(function (st, i) {
      var e = when(st);
      var cls = i < reached ? 'is-done' : i === reached ? (side ? 'is-done' : 'is-now') : '';
      return ui.el('li', { class: 'rail-step ' + cls, 'aria-current': i === reached && !side ? 'step' : null }, [
        ui.el('span', { class: 'rail-dot', 'aria-hidden': 'true' }),
        ui.el('b', { text: D.REQUEST_STATUS_LABEL[st] }),
        ui.el('span', { class: 'muted', text: e ? userName(e.user_id) + ', ' + ui.formatTs(e.ts) : (i > reached ? 'not yet' : '') })
      ]);
    }).concat(side ? [ui.el('li', { class: 'rail-side is-' + (STAMP[side] || 'neutral') }, [ui.el('b', { text: D.REQUEST_STATUS_LABEL[side] }),
      ui.el('span', { class: 'muted', text: when(side) ? userName(when(side).user_id) + ', ' + ui.formatTs(when(side).ts) : '' })])] : []));
  }

  /* --- side panels -------------------------------------------------------- */

  function pathsPanel(r, tool) {
    var bkm = byId('bkms', r.bkm_id);
    var bkmPath = bkm ? bkm.path : r.bkm_path;
    var year = (r.submitted_ts || '').slice(0, 4);
    var results = r.results_path || (tool && tool.results_root ? tool.results_root.replace(/\\+$/, '') + '\\' + year + '\\' + r.request_no + '\\' : null);
    return ui.panel({ title: 'BKM and results', icon: 'folder', body: [
      ui.el('div', { class: 'ifield-label', text: 'BKM' }),
      bkmPath ? ui.el('div', {}, [bkm ? ui.el('div', { text: bkm.name + (bkm.doc_version ? ' (' + bkm.doc_version + ')' : '') }) : null,
        ui.el('span', { class: 'cell-path' }, [ui.el('span', { class: 'mono', text: bkmPath, title: bkmPath }), copyBtn(bkmPath, 'BKM path')])])
        : ui.el('span', { class: 'chip warning', text: 'No BKM - see the purpose' }),
      ui.el('div', { class: 'ifield-label', text: r.results_path ? 'Results folder' : 'Results folder (proposed, Q30)' }),
      results ? ui.el('span', { class: 'cell-path' }, [ui.el('span', { class: 'mono', text: results, title: results }), copyBtn(results, 'Results path')])
              : muted('The tool has no results root yet (Settings > Tools).'),
      r.results_path ? null : ui.el('p', { class: 'muted', text: 'The quality engineer confirms or changes it when completing.' })
    ] }).node;
  }

  function detailsPanel(r) {
    var step = byId('process_steps', r.process_step_id);
    var tool = byId('tools', r.tool_id);
    function row(label, value) { return [ui.el('dt', { text: label }), ui.el('dd', {}, value === null || value === '' || value === undefined ? muted('-') : value)]; }
    var extra = X.shown(D.fieldsForType(store.list('tool_fields', { all: true }), r.tool_id, r.type_id), r.extra).map(function (f) {
      return row(f.label, X.answerText(f, (r.extra || {})[f.id]) || null);
    });
    return ui.panel({ title: 'Details', icon: 'requests', body: ui.el('dl', { class: 'facts' }, [].concat.apply([], [
      row('Panels are now', window.MRT.requestActions.whereOf(r) || null), row('Panels are after', step ? step.name : r.process_step_other || null),
      row('Layers', (r.layers || []).join(', ') || null), row('Afterwards', D.AFTER_LABEL[r.after] + (r.after_other ? ': ' + r.after_other : '')),
      tool && tool.destructive ? row('Destructive', r.destructive_ok ? 'Confirmed by the requester' : 'NOT confirmed') : [],
      row('Purpose', r.purpose || null)
    ].concat(extra))) }).node;
  }

  function peoplePanel(r, tool) {
    var today = D.viennaYmd(Date.now());
    function person(id, role) {
      var u = byId('users', id);
      if (!u) return [ui.el('dt', { text: role }), ui.el('dd', {}, muted('not set'))];
      var a = D.awayState(u, today);
      return [ui.el('dt', { text: role }), ui.el('dd', {}, [u.name, a && a.state === 'now' ? ui.el('span', { class: 'chip warning', text: 'Away' + (a.until ? ' until ' + a.until : '') }) : null])];
    }
    return ui.panel({ title: 'People', icon: 'users', body: ui.el('dl', { class: 'facts' }, [].concat(
      person(r.requester_id, 'Requested by'),
      person(tool && tool.primary_operator_id, 'Primary QE'),
      person(tool && tool.backup_operator_id, 'Backup QE')
    )) }).node;
  }

  /* --- timeline ------------------------------------------------------------ */

  function eventText(e) {
    if (e.kind === 'created') return e.text ? 'Created the request - ' + e.text : 'Created the request';
    if (e.kind === 'status') {
      var t = e.from === 'draft' ? 'Submitted' : D.REQUEST_STATUS_LABEL[e.from] + ' → ' + D.REQUEST_STATUS_LABEL[e.to];
      if (e.expected_done) t += ' - expected done ' + e.expected_done;
      return e.text ? t + ': ' + e.text : t;
    }
    if (e.kind === 'assign') return e.text || ('Assigned to ' + userName(e.to) + (e.from ? ' (took it over from ' + userName(e.from) + ')' : ''));
    if (e.kind === 'panels') return 'Panels received' + (e.text ? ' - ' + e.text : '');
    if (e.kind === 'edit') return 'Edited: ' + (e.text || '');
    if (e.kind === 'results_ok') return 'Results OK - closed';
    return e.text || '';
  }

  /** A comment with its @mentions marked (text nodes only - user text never reaches innerHTML). */
  function commentBody(e) {
    var text = e.text || '';
    var names = (e.mentions || []).map(function (id) { var u = byId('users', id); return u ? [u.name, u.windows_id] : []; })
      .reduce(function (a, b) { return a.concat(b); }, []).filter(Boolean);
    if (!names.length) return ui.el('p', { class: 'tl-text', text: text });
    var re = new RegExp('(@(?:' + names.map(function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + '))', 'ig');
    return ui.el('p', { class: 'tl-text' }, text.split(re).map(function (part, i) {
      return i % 2 ? ui.el('mark', { class: 'mention', text: part }) : part;
    }));
  }

  function timeline(r, me) {
    var events = store.requestEvents(r.id);
    var list = ui.el('ol', { class: 'timeline' }, events.map(function (e) {
      var icon = { comment: 'edit', created: 'plus', assign: 'user', panels: 'inbox', edit: 'edit' }[e.kind] ||
        (e.to === 'cancelled' ? 'close' : e.to === 'on_hold' ? 'clock' : e.to === 'clarification' ? 'help' : 'check');
      return ui.el('li', { class: 'tl-item is-' + e.kind + (e.to ? ' to-' + e.to : '') }, [
        ui.el('span', { class: 'tl-icon', 'aria-hidden': 'true' }, ui.icon(icon, 14)),
        ui.el('div', {}, [
          ui.el('div', { class: 'tl-meta' }, [ui.el('b', { text: userName(e.user_id) }), ' ', muted(ui.formatTs(e.ts))]),
          e.kind === 'comment' ? commentBody(e) : ui.el('p', { class: 'tl-text', text: eventText(e) })
        ])
      ]);
    }));
    var box = null, add = null;
    if (D.canComment(me, r)) {
      box = ui.field({ label: 'Add a comment', multiline: true, placeholder: 'Write @Name to point someone at it (they are notified from M4).' });
      add = ui.button('Add comment', { kind: 'primary', icon: 'edit', onClick: function () {
        store.addComment(r.id, box.value()).then(function () { ui.toast({ kind: 'success', message: 'Comment added.' }); window.MRT.app.route(); })
          .catch(function (e) { if (e && e.code === 'invalid') box.setState('invalid', e.message); else ui.toastError(e.message, e); });
      } });
    }
    return ui.panel({ title: 'Timeline', icon: 'activity', body: [list, box ? box.node : null, add ? ui.el('div', { class: 'form-actions' }, add) : null] }).node;
  }

  function cancel(r) {
    ui.promptReason({ title: 'Cancel ' + r.request_no, confirmLabel: 'Cancel request',
      message: 'The request stays visible as Cancelled, never deleted. The quality engineers are told from M4. Why?' })
      .then(function (reason) {
        if (!reason) return;
        return store.cancelRequest(r.id, reason).then(function (res) {
          var offer = window.MRT.requestActions.emailOffer(res, 'cancel');
          ui.toast({ kind: 'success', message: r.request_no + ' cancelled.', actions: offer ? [offer] : null, timeout_ms: offer ? 8000 : undefined });
          window.MRT.app.route();
        });
      }).catch(function (e) { ui.toastError('Could not cancel: ' + e.message, e); });
  }

  return { render: render, tick: paintClock, card: function (r) { return traveller(r, byId('tools', r.tool_id), byId('lots', r.lot_id)); } };
})();
