/**
 * Metrology Request Tracker - views/request.js
 *
 * The request page (#/request/<id>, Q42, M2 step 5): the request drawn as a
 * lab traveller card - priority stripe, tool glyph, request ID, status stamp,
 * lot, priority, the needed-by countdown in lab time (Q36; the clock pauses
 * outside lab hours) and the panel map with the requested panels - then the
 * status rail (each step, who and when), the details with BKM and results
 * paths (Copy, Q30), and the timeline: status changes and comments with
 * @mentions (Q11). The requester, the tool's quality engineers and admins
 * can cancel with a reason (Q35). Accept / Start / Complete come with the
 * queue in M3 (Q43).
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
  var live = { r: null, node: null };          // what tick() updates

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
      ui.button('Copy this request', { icon: 'copy', onClick: function () { location.hash = '#/new?from=' + r.id; } }),
      lot && D.canRequest(me) ? ui.button('New request on this lot', { icon: 'plus', onClick: function () { location.hash = '#/new?lot=' + r.lot_id; } }) : null,
      D.canCancel(me, r, tool) ? ui.button('Cancel request', { kind: 'danger', icon: 'close', onClick: function () { cancel(r); } }) : null
    ];
    main.appendChild(ui.pageHead(r.request_no, (tool ? tool.name : '') + ' - requested by ' + userName(r.requester_id), actions));

    main.appendChild(traveller(r, tool, lot));
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
    live.r = r; live.node = clock;
    paintClock();
    var glyphState = r.status === 'in_progress' ? 'live' : tool && tool.status === 'down' ? 'off' : tool && tool.status === 'maintenance' ? 'maint' : 'idle';
    return ui.el('article', { class: 'traveller prio-' + level + (level === 1 && D.isOpen(r) ? ' is-urgent' : ''), 'aria-label': 'Traveller card ' + r.request_no }, [
      ui.el('header', { class: 'tr-head' }, [
        tool ? ui.toolGlyph(tool.glyph, { size: 56, state: glyphState, label: tool.name }) : null,
        ui.el('div', { class: 'tr-id' }, [
          ui.el('h2', { class: 'mono', text: r.request_no }),
          ui.el('div', { class: 'muted', text: (tool ? tool.code : '?') + '  ·  ' + (type ? type.name : 'no measurement type') })
        ]),
        ui.el('span', { class: 'tr-stamp is-' + (STAMP[r.status] || 'neutral'), text: D.REQUEST_STATUS_LABEL[r.status] })
      ]),
      ui.el('div', { class: 'tr-grid' }, [
        cell('Lot', lot ? [ui.el('b', { class: 'mono', text: lot.lot_number }), ui.el('span', { class: 'muted', text: '  ' +
          [(byId('projects', lot.project_id) || {}).code, lot.part_number_id ? (byId('part_numbers', lot.part_number_id) || {}).code : null,
           (byId('buildups', lot.buildup_id) || {}).code].filter(Boolean).join(' · ') })] : muted('?')),
        cell('Priority', prio ? ui.el('span', { class: 'tr-prio' }, [ui.el('b', { text: prio.name }), ui.el('span', { class: 'mono muted', text: prio.code })]) : muted('-'),
             r.priority_reason ? r.priority_reason : null),
        cell('Needed by', r.needed_by ? ui.el('b', { class: 'num', text: ui.formatDate(r.needed_by + 'T12:00:00Z') }) : muted('no date'), null, clock),
        cell('Panels', ui.el('b', { class: 'mono', text: (D.formatPanels(r.panels) || '-') + '  (' + (r.panels || []).length + ')' })),
        cell('Submitted', ui.el('span', { class: 'num', text: ui.formatTs(r.submitted_ts) }))
      ]),
      lot ? ui.panelMap({ count: lot.panel_count, selected: r.panels, readOnly: true, label: 'Panels of lot ' + lot.lot_number }).node : null
    ]);
  }

  function cell(label, value, sub, extra) {
    return ui.el('div', { class: 'tr-cell' }, [ui.el('div', { class: 'tr-label', text: label }), ui.el('div', { class: 'tr-value' }, value),
      sub ? ui.el('div', { class: 'tr-sub', text: sub }) : null, extra || null]);
  }

  /** The countdown text; the 1 s tick repaints only this (text only). */
  function paintClock() {
    var r = live.r, node = live.node;
    if (!r || !node) return;
    if (!r.needed_by) { node.textContent = 'The priority says how urgent it is.'; node.className = 'tr-clock'; return; }
    if (!D.isOpen(r)) { node.textContent = ''; node.className = 'tr-clock'; return; }
    var hs = D.holidaySet(store.data().holidays);
    var c = D.countdown(Date.now(), r.needed_by, store.calendar(), hs);
    var h = ui.formatDurationH(c.lab_ms / 3600000);
    var days = c.late ? (c.days < 0 ? ' (' + -c.days + ' day' + (c.days === -1 ? '' : 's') + ')' : '')
                      : (c.days > 0 ? ' (' + c.days + ' day' + (c.days === 1 ? '' : 's') + ')' : ' (today)');
    node.textContent = (c.late ? 'Late by ' + h + ' lab time' : h + ' lab time left') + days + (c.paused ? '  ·  clock paused (outside lab hours)' : '');
    node.className = 'tr-clock ' + (c.late ? 'is-late' : c.lab_ms < 8 * 3600000 ? 'is-soon' : 'is-ok') + (c.paused ? ' is-paused' : '');
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
    var results = tool && tool.results_root ? tool.results_root.replace(/\\+$/, '') + '\\' + year + '\\' + r.request_no + '\\' : null;
    return ui.panel({ title: 'BKM and results', icon: 'folder', body: [
      ui.el('div', { class: 'ifield-label', text: 'BKM' }),
      bkmPath ? ui.el('div', {}, [bkm ? ui.el('div', { text: bkm.name + (bkm.doc_version ? ' (' + bkm.doc_version + ')' : '') }) : null,
        ui.el('span', { class: 'cell-path' }, [ui.el('span', { class: 'mono', text: bkmPath, title: bkmPath }), copyBtn(bkmPath, 'BKM path')])])
        : ui.el('span', { class: 'chip warning', text: 'No BKM - see the purpose' }),
      ui.el('div', { class: 'ifield-label', text: 'Results folder (proposed, Q30)' }),
      results ? ui.el('span', { class: 'cell-path' }, [ui.el('span', { class: 'mono', text: results, title: results }), copyBtn(results, 'Results path')])
              : muted('The tool has no results root yet (Settings > Tools).'),
      ui.el('p', { class: 'muted', text: 'The quality engineer confirms or changes it when completing (M3).' })
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
      row('Panels are now', r.panel_location), row('Panels are after', step ? step.name : r.process_step_other || null),
      row('Layer', r.layer || null), row('Afterwards', D.AFTER_LABEL[r.after] + (r.after_other ? ': ' + r.after_other : '')),
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
      return e.text ? t + ': ' + e.text : t;
    }
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
      var icon = e.kind === 'comment' ? 'edit' : e.kind === 'created' ? 'plus' : e.to === 'cancelled' ? 'close' : 'check';
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
        return store.cancelRequest(r.id, reason).then(function () { ui.toast({ kind: 'success', message: r.request_no + ' cancelled.' }); window.MRT.app.route(); });
      }).catch(function (e) { ui.toastError('Could not cancel: ' + e.message, e); });
  }

  return { render: render, tick: paintClock };
})();
