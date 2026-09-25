/**
 * Metrology Request Tracker - views/analytics.js  (M5, Q20, Q52, DECISIONS M5-1)
 *
 * #/analytics/<tab>, four tabs:
 *   work   My work (quality engineers): my tools' open requests, late, due
 *          today, on hold and why, what waits on me, done per day
 *   mine   My requests (engineers): open with expected finish, waiting on me,
 *          "where is my lot" across tools, typical turnaround per tool
 *   lab    Lab (Manager role): backlog trend, turnaround median / p90 with
 *          hold apart, on time, load per quality engineer, clarification and
 *          reopen rates, on-hold reasons
 *   mgmt   Management (Manager role): requests per month by project, on time,
 *          Line stop count and response, demand per tool
 * Filters: date range (default last 90 days), tool, project. Every tile, bar
 * and row opens the requests behind it (a list with links and Download).
 * Numbers come from MRT.analytics (domain.analytics); nothing is counted here.
 */
window.MRT = window.MRT || {};
window.MRT.views = window.MRT.views || {};
window.MRT.views.analytics = (function () {
  'use strict';

  var ui = window.MRT.ui;
  var store = window.MRT.store;
  var D = window.MRT.domain;
  var A = window.MRT.analytics;
  var X = window.MRT.exporter;

  var TABS = [
    { key: 'work', label: 'My work', icon: 'inbox' },
    { key: 'mine', label: 'My requests', icon: 'requests' },
    { key: 'lab', label: 'Lab', icon: 'gauge', manager: true },
    { key: 'mgmt', label: 'Management', icon: 'analytics', manager: true }
  ];
  var state = { tab: null, filter: null, lot_id: '' };

  function byId(c, id) { return id ? store.byId(c, id) : null; }
  function codeOf(c, id) { var r = byId(c, id); return r ? (r.code || r.name) : (id ? '?' : 'none'); }
  function nameOf(c, id) { var r = byId(c, id); return r ? (r.name || r.code) : (id ? '?' : 'nobody'); }
  function h(ms) { return ms === null || ms === undefined ? '-' : ui.formatDurationH(ms / 3600000); }
  function pct(v) { return v === null || v === undefined ? '-' : ui.formatNumber(v, 1) + ' %'; }
  function isManager(me) { return D.hasRole(me, 'manager'); }

  /* --- click-through: the requests behind a number --------------------- */

  function openList(title, ids) {
    var rows = (ids || []).map(function (id) { return byId('requests', id); }).filter(Boolean);
    if (!rows.length) return ui.toast({ message: 'No requests behind this number.', timeout_ms: 2000 });
    var close = null;
    var table = ui.el('div', { class: 'table-wrap tall' }, ui.el('table', { class: 'grid' }, [
      ui.el('thead', {}, ui.el('tr', {}, ['Request', 'Status', 'Tool', 'Lot', 'Priority', 'Submitted'].map(function (x) { return ui.el('th', { scope: 'col', text: x }); }))),
      ui.el('tbody', {}, rows.map(function (r) {
        var lot = byId('lots', r.lot_id);
        return ui.el('tr', {}, [
          ui.el('td', {}, ui.el('a', { class: 'mono', href: '#/request/' + r.id, text: r.request_no || '(draft)', onclick: function () { if (close) close(); } })),
          ui.el('td', { text: D.REQUEST_STATUS_LABEL[r.status] }), ui.el('td', { class: 'mono', text: codeOf('tools', r.tool_id) }),
          ui.el('td', { class: 'mono', text: lot ? lot.lot_number : '-' }), ui.el('td', { text: nameOf('priorities', r.priority_id) }),
          ui.el('td', { class: 'num', text: ui.formatDate(r.submitted_ts) })
        ]);
      }))
    ]));
    ui.dialog({ title: title + ' (' + rows.length + ')', icon: 'requests', wide: true,
      body: [table, ui.el('div', { class: 'form-actions' }, X.rowsButton('Download these', title, function () { return X.requestRows(rows); }))] });
    // the dialog's own close runs when a link is followed
    close = function () { var dlg = document.querySelector('dialog[open]'); if (dlg) dlg.dispatchEvent(new Event('cancel')); };
  }

  /** A KPI tile that opens its requests. */
  function tile(label, value, status, icon, ids, sub) {
    var t = ui.kpiTile({ label: label, value: typeof value === 'number' ? value : 0, status: status, icon: icon, sub: sub, animate: false });
    if (typeof value !== 'number') t.node.querySelector('.kpi-tile-value').textContent = value;
    if (ids && ids.length) {
      t.node.classList.add('is-link');
      t.node.setAttribute('role', 'button');
      t.node.setAttribute('tabindex', '0');
      t.node.setAttribute('aria-label', label + ': ' + (typeof value === 'number' ? value : value) + ' - show the requests');
      t.node.addEventListener('click', function () { openList(label, ids); });
      t.node.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openList(label, ids); } });
    }
    return t.node;
  }

  /** A table panel with Download; rows [[cells...]] with an optional ids list per row for click-through. */
  function tablePanel(title, icon, head, rows, empty, note) {
    var body = rows.length ? ui.el('div', { class: 'table-wrap' }, ui.el('table', { class: 'grid' }, [
      ui.el('thead', {}, ui.el('tr', {}, head.map(function (x) { return ui.el('th', { scope: 'col', text: x }); }))),
      ui.el('tbody', {}, rows.map(function (r) {
        var cells = r.cells.map(function (c, i) {
          if (i === 0 && r.ids && r.ids.length) {
            return ui.el('td', {}, ui.el('button', { class: 'link-btn', type: 'button', text: String(c), title: 'Show the requests',
              onclick: function () { openList(title + ': ' + c, r.ids); } }));
          }
          return ui.el('td', { class: typeof c === 'number' || /^[\d.,]+( %| h| min| d.*)?$/.test(String(c)) ? 'num' : null, text: String(c) });
        });
        return ui.el('tr', {}, cells);
      }))
    ])) : ui.el('p', { class: 'muted', text: empty || 'Nothing in this range.' });
    return ui.panel({ title: title, icon: icon, actions: rows.length ? [X.rowsButton('Download', title, function () {
      return [head].concat(rows.map(function (r) { return r.cells; }));
    })] : null, body: [note ? ui.el('p', { class: 'muted', text: note }) : null, body] }).node;
  }

  /** A bar chart panel; items [{label, value, ids}]; values in hours when unit 'h'. */
  function barPanel(title, icon, items, o) {
    o = o || {};
    if (!items.length) return ui.panel({ title: title, icon: icon, body: ui.el('p', { class: 'muted', text: 'Nothing in this range.' }) }).node;
    var series = o.series || [{ label: o.valueLabel || title, key: 'value' }];
    var c = ui.chart(function (t) {
      return { type: o.line ? 'line' : 'bar', data: { labels: items.map(function (x) { return x.label; }), datasets: series.map(function (s, i) {
        var col = s.color || t.series(i);
        return { label: s.label, data: items.map(function (x) { var v = x[s.key]; return v === null || v === undefined ? null : o.unit === 'h' ? Math.round(v / 360000) / 10 : v; }),
                 backgroundColor: o.line ? t.alpha(col, .15) : ui.chartGradient(t, col, .95, .45), borderColor: t.color(col), fill: !!o.line,
                 hoverBackgroundColor: t.color(col), tipColor: t.color(col), stack: o.stacked ? 's' : undefined };
      }) }, options: { plugins: { legend: { display: series.length > 1 } },
        scales: { x: { stacked: !!o.stacked, grid: { display: false } }, y: { stacked: !!o.stacked, beginAtZero: true, title: { display: !!o.unit, text: o.unit === 'h' ? 'lab hours' : o.unit || '' } } } } };
    }, { height: o.height || 240, label: title, expand: true,
         onPick: function (i) { if (items[i] && items[i].ids) openList(title + ': ' + items[i].label, items[i].ids); },
         format: o.unit === 'h' ? function (v) { return v + ' h'; } : undefined });
    var rows = [[o.labelHead || 'What'].concat(series.map(function (s) { return s.label; }))].concat(items.map(function (x) {
      return [x.label].concat(series.map(function (s) { var v = x[s.key]; return v === null || v === undefined ? '' : o.unit === 'h' ? Math.round(v / 360000) / 10 : v; }));
    }));
    return ui.panel({ title: title, icon: icon, actions: [X.rowsButton('Download', title, function () { return rows; })],
                      body: [o.note ? ui.el('p', { class: 'muted', text: o.note }) : null, c.node] }).node;
  }

  /* --- page ----------------------------------------------------------- */

  function render(main, ctx) {
    var me = store.currentUser();
    var tabs = TABS.filter(function (t) { return !t.manager || isManager(me); });
    var want = (ctx.subpath || '').split('/')[0];
    if (tabs.some(function (t) { return t.key === want; })) state.tab = want;
    if (!state.tab || !tabs.some(function (t) { return t.key === state.tab; })) {
      state.tab = D.measuredTools(me, store.list('tools')).length && !D.hasRole(me, 'admin') ? 'work' : isManager(me) ? 'lab' : D.canMeasure(me) ? 'work' : 'mine';
    }
    if (!state.filter) state.filter = A.defaultFilter();

    main.appendChild(ui.pageHead('Analytics', 'Lab time (Mon-Fri lab hours, holidays out); hold time shown apart. Click a number to see its requests.'));
    main.appendChild(filterBar());
    var body = ui.el('div', { class: 'tab-body an-body' });
    var bar = ui.tabs(tabs.map(function (t) { return { key: t.key, label: t.label, icon: t.icon }; }), function (k) {
      state.tab = k; history.replaceState(null, '', '#/analytics/' + k); draw();
    });
    bar.setActive(state.tab);
    main.appendChild(bar.node);
    if (!isManager(me)) main.appendChild(ui.el('p', { class: 'muted', text: 'The Lab and Management tabs are for people with the Manager role (Q52).' }));
    main.appendChild(body);

    function draw() {
      ui.clear(body);
      try { ({ work: workTab, mine: mineTab, lab: labTab, mgmt: mgmtTab })[state.tab](body, me); }
      catch (e) { console.error('MRT: analytics tab failed', e); ui.mount(body, ui.emptyState({ icon: 'alert', title: 'This tab could not be shown', text: e.message })); }
      ui.linkLabels(body);
    }
    draw();
    render.redraw = draw;
  }

  function filterBar() {
    var f = state.filter;
    var from = ui.field({ label: 'From', type: 'date', value: f.from_ymd, cls: 'an-f' });
    var to = ui.field({ label: 'To', type: 'date', value: f.to_ymd, cls: 'an-f' });
    var tool = ui.field({ label: 'Tool', cls: 'an-f', value: f.tool_id, options: [{ value: '', label: 'All tools' }].concat(store.list('tools').map(function (t) { return { value: t.id, label: t.code }; })) });
    var proj = ui.field({ label: 'Project', cls: 'an-f', value: f.project_id, options: [{ value: '', label: 'All projects' }].concat(store.list('projects').map(function (p) { return { value: p.id, label: p.code }; })) });
    function apply() {
      state.filter = { from_ymd: D.isYmd(from.value()) ? from.value() : '', to_ymd: D.isYmd(to.value()) ? to.value() : '', tool_id: tool.value(), project_id: proj.value() };
      if (render.redraw) render.redraw();
    }
    [from, to, tool, proj].forEach(function (x) { x.input.addEventListener('change', apply); });
    var reset = ui.button('Last 90 days', { size: 'sm', kind: 'ghost', icon: 'refresh', onClick: function () {
      state.filter = A.defaultFilter(); var nf = state.filter;
      from.input.value = nf.from_ymd; to.input.value = nf.to_ymd; tool.input.value = ''; proj.input.value = ''; apply();
    } });
    return ui.el('div', { class: 'an-filters', role: 'group', 'aria-label': 'Filters' }, [from.node, to.node, tool.node, proj.node, reset]);
  }

  /* --- My work (quality engineers) ------------------------------------ */

  function workTab(body, me) {
    var tools = D.measuredTools(me, store.list('tools'));
    if (!tools.length) {
      body.appendChild(ui.emptyState({ icon: 'inbox', title: 'You measure no tool', text: 'Quality engineers see their tools here. Your own requests: the My requests tab.' }));
      return;
    }
    var ids = tools.map(function (t) { return t.id; });
    var f = state.filter, now = Date.now(), cal = store.calendar(), today = D.viennaYmd(now);
    var open = store.visibleRequests(function (r) { return D.isOpen(r) && ids.indexOf(r.tool_id) !== -1 && (!f.tool_id || r.tool_id === f.tool_id); });
    open = D.sortQueue(open, { now_ts: now, cal: cal, levelOf: A.levelOf });
    function idsOf(rows) { return rows.map(function (r) { return r.id; }); }
    var late = open.filter(function (r) { return D.isLate(r, now, cal); });
    var dueToday = open.filter(function (r) { return r.needed_by === today; });
    var held = open.filter(function (r) { return r.status === 'on_hold'; });
    var onMe = open.filter(function (r) { return r.assigned_to === me.id || !r.assigned_to; });
    body.appendChild(ui.el('div', { class: 'an-kpis' }, [
      tile('Open (my tools)', open.length, 'neutral', 'inbox', idsOf(open), tools.map(function (t) { return t.code; }).join(', ')),
      tile('Late', late.length, late.length ? 'expired' : 'ok', 'alert', idsOf(late)),
      tile('Due today', dueToday.length, dueToday.length ? 'warning' : 'neutral', 'clock', idsOf(dueToday)),
      tile('On hold', held.length, held.length ? 'warning' : 'neutral', 'wrench', idsOf(held)),
      tile('Waiting on me', onMe.length, onMe.length ? 'critical' : 'ok', 'user', idsOf(onMe), 'assigned to me or nobody')
    ]));
    body.appendChild(tablePanel('Waiting on me', 'user', ['Request', 'Status', 'Tool', 'Priority', 'Needed by', 'Lot'], onMe.slice(0, 50).map(function (r) {
      var lot = byId('lots', r.lot_id);
      return { cells: [r.request_no, D.REQUEST_STATUS_LABEL[r.status], codeOf('tools', r.tool_id), nameOf('priorities', r.priority_id), r.needed_by || '-', lot ? lot.lot_number : '-'], ids: [r.id] };
    }), 'Nothing waits on you.', 'Line stop first, then late, then by date - the queue order.'));
    body.appendChild(tablePanel('On hold and why', 'wrench', ['Request', 'Reason', 'Note', 'Tool'], held.map(function (r) {
      return { cells: [r.request_no, nameOf('hold_reasons', r.hold_reason_id), r.hold_note || '-', codeOf('tools', r.tool_id)], ids: [r.id] };
    }), 'Nothing is on hold.'));
    // done by me per day, the last 14 days
    var an = A.get({ from_ymd: D.addDaysYmd(today, -13), to_ymd: today, tool_id: f.tool_id, project_id: f.project_id });
    var days = [];
    for (var i = 13; i >= 0; i--) days.push(D.addDaysYmd(today, -i));
    var mineDone = an.ids.done.map(function (id) { return byId('requests', id); }).filter(function (r) { return r && r.completed_by === me.id; });
    body.appendChild(barPanel('Done by me, last 14 days', 'check', days.map(function (d) {
      var rows = mineDone.filter(function (r) { return D.viennaYmd(an.times[r.id].completed_ts) === d; });
      return { label: d.slice(8, 10) + '.' + d.slice(5, 7), value: rows.length, ids: idsOf(rows) };
    }), { valueLabel: 'Completed', labelHead: 'Day' }));
  }

  /* --- My requests (engineers) ----------------------------------------- */

  function mineTab(body, me) {
    var now = Date.now(), cal = store.calendar();
    var mine = store.visibleRequests(function (r) { return r.requester_id === me.id && r.status !== 'draft'; });
    var open = mine.filter(D.isOpen);
    var waiting = mine.filter(function (r) { return r.status === 'clarification' || (r.status === 'completed' && !r.results_ok_ts && !D.isClosed(r, now)); });
    var an = A.get(state.filter);
    var doneMine = an.ids.done.filter(function (id) { var r = byId('requests', id); return r && r.requester_id === me.id; });
    function idsOf(rows) { return rows.map(function (r) { return r.id; }); }
    body.appendChild(ui.el('div', { class: 'an-kpis' }, [
      tile('My open requests', open.length, 'neutral', 'requests', idsOf(open)),
      tile('Waiting on me', waiting.length, waiting.length ? 'critical' : 'ok', 'user', idsOf(waiting), 'answer or check results'),
      tile('Late', open.filter(function (r) { return D.isLate(r, now, cal); }).length, 'expired', 'alert', idsOf(open.filter(function (r) { return D.isLate(r, now, cal); }))),
      tile('Done in the range', doneMine.length, 'ok', 'check', doneMine)
    ]));
    body.appendChild(tablePanel('My open requests - expected finish', 'clock', ['Request', 'Status', 'Tool', 'Expected done', 'Needed by', 'Assigned to'],
      D.sortQueue(open, { now_ts: now, cal: cal, levelOf: A.levelOf }).map(function (r) {
        return { cells: [r.request_no, D.REQUEST_STATUS_LABEL[r.status], codeOf('tools', r.tool_id), r.expected_done || '-', r.needed_by || '-', r.assigned_to ? nameOf('users', r.assigned_to) : 'nobody yet'], ids: [r.id] };
      }), 'Nothing open.'));

    // where is my lot: every request of one lot, across the tools
    var lotIds = [];
    mine.forEach(function (r) { if (r.lot_id && lotIds.indexOf(r.lot_id) === -1) lotIds.push(r.lot_id); });
    var lots = (store.data().lots || []).slice().sort(function (a, b) { return (lotIds.indexOf(b.id) !== -1) - (lotIds.indexOf(a.id) !== -1) || (a.lot_number < b.lot_number ? -1 : 1); });
    if (!state.lot_id && lotIds.length) state.lot_id = lotIds[0];
    var pick = ui.field({ label: 'Lot', value: state.lot_id, options: [{ value: '', label: '- pick a lot -' }].concat(lots.map(function (l) {
      return { value: l.id, label: l.lot_number + (lotIds.indexOf(l.id) !== -1 ? '  (yours)' : '') }; })) });
    var host = ui.el('div');
    function showLot() {
      state.lot_id = pick.value();
      var rows = store.visibleRequests(function (r) { return r.lot_id === state.lot_id && r.status !== 'draft'; });
      ui.mount(host, !state.lot_id ? ui.el('p', { class: 'muted', text: 'Pick a lot.' }) : !rows.length ? ui.el('p', { class: 'muted', text: 'No requests on this lot yet.' }) :
        ui.el('div', { class: 'table-wrap' }, ui.el('table', { class: 'grid' }, [
          ui.el('thead', {}, ui.el('tr', {}, ['Request', 'Tool', 'Status', 'Panels', 'Assigned to', 'Expected / needed'].map(function (x) { return ui.el('th', { scope: 'col', text: x }); }))),
          ui.el('tbody', {}, rows.map(function (r) {
            return ui.el('tr', {}, [ui.el('td', {}, ui.el('a', { class: 'mono', href: '#/request/' + r.id, text: r.request_no })), ui.el('td', { class: 'mono', text: codeOf('tools', r.tool_id) }),
              ui.el('td', { text: D.REQUEST_STATUS_LABEL[r.status] }), ui.el('td', { class: 'mono', text: D.panelsText(r) }),
              ui.el('td', { text: r.assigned_to ? nameOf('users', r.assigned_to) : '-' }), ui.el('td', { class: 'num', text: r.expected_done || r.needed_by || '-' })]);
          }))
        ])));
    }
    pick.input.addEventListener('change', showLot);
    showLot();
    body.appendChild(ui.panel({ title: 'Where is my lot', icon: 'lots', body: [ui.el('p', { class: 'muted', text: 'Every request of one lot, on every tool - where it is now.' }), pick.node, host] }).node);

    body.appendChild(barPanel('Typical turnaround per tool', 'clock', an.turnaround_by_tool.map(function (x) {
      return { label: codeOf('tools', x.tool_id), value: x.median_ms, p90: x.p90_ms, ids: x.ids };
    }), { unit: 'h', labelHead: 'Tool', series: [{ label: 'Median', key: 'value' }, { label: 'p90', key: 'p90' }],
         note: 'Completed in the range; lab hours from submit to complete, hold taken out.' }));
  }

  /* --- Lab (managers) ---------------------------------------------------- */

  function labTab(body) {
    var a = A.get(state.filter), t = a.turnaround;
    var reopenPct = a.reopen.n ? Math.round(a.reopen.reopened / a.reopen.n * 1000) / 10 : null;
    body.appendChild(ui.el('div', { class: 'an-kpis' }, [
      tile('Open now', a.counts.open_now, 'neutral', 'inbox', a.ids.open_now),
      tile('Late now', a.counts.late_now, a.counts.late_now ? 'expired' : 'ok', 'alert', a.ids.late_now),
      tile('On hold now', a.counts.on_hold_now, a.counts.on_hold_now ? 'warning' : 'neutral', 'wrench', a.ids.on_hold_now),
      tile('Done in range', a.counts.done, 'ok', 'check', a.ids.done),
      tile('Turnaround median', h(t.median_ms), 'neutral', 'clock', t.ids, 'p90 ' + h(t.p90_ms) + ' · hold ' + h(t.hold_median_ms)),
      tile('On time', pct(t.on_time_pct), t.on_time_pct === null ? 'neutral' : t.on_time_pct >= 80 ? 'ok' : 'warning', 'calendar', t.ids, t.on_time + ' of ' + t.dated + ' with a date'),
      tile('Reopened', pct(reopenPct), 'neutral', 'restore', a.reopen.ids, a.reopen.reopened + ' of ' + a.reopen.n)
    ]));
    body.appendChild(barPanel('Backlog at each week\'s end', 'activity', a.backlog.map(function (w) {
      return { label: w.week.slice(8, 10) + '.' + w.week.slice(5, 7), value: w.open, ids: w.ids };
    }), { line: true, valueLabel: 'Open requests', labelHead: 'Week of' }));
    body.appendChild(ui.el('div', { class: 'an-grid' }, [
      barPanel('Turnaround per tool', 'clock', a.turnaround_by_tool.map(function (x) {
        return { label: codeOf('tools', x.tool_id), value: x.median_ms, p90: x.p90_ms, hold: x.hold_median_ms, ids: x.ids };
      }), { unit: 'h', labelHead: 'Tool', series: [{ label: 'Median', key: 'value' }, { label: 'p90', key: 'p90' }, { label: 'Hold (median)', key: 'hold' }] }),
      barPanel('Open now per tool', 'inbox', a.open_by_tool.map(function (x) { return { label: codeOf('tools', x.key), value: x.n, ids: x.ids }; }), { valueLabel: 'Open', labelHead: 'Tool' }),
      barPanel('Load per quality engineer', 'users', loadRows(a), { labelHead: 'Person', series: [{ label: 'Open, assigned', key: 'value' }, { label: 'Done in range', key: 'done' }] }),
      barPanel('On time per tool', 'calendar', a.turnaround_by_tool.filter(function (x) { return x.dated; }).map(function (x) {
        return { label: codeOf('tools', x.tool_id), value: x.on_time_pct, ids: x.ids };
      }), { valueLabel: 'On time %', labelHead: 'Tool', unit: '%', note: 'Completed by the end of the needed-by lab day; requests without a date are not counted.' })
    ]));
    body.appendChild(ui.el('div', { class: 'an-grid' }, [
      tablePanel('Clarification rate per tool', 'help', ['Tool', 'Requests', 'With a question', 'Rate'], a.clarification_by_tool.map(function (x) {
        return { cells: [codeOf('tools', x.tool_id), x.n, x.with_clarification, pct(x.pct)], ids: x.ids };
      })),
      tablePanel('Clarification rate per BKM', 'help', ['BKM', 'Requests', 'With a question', 'Rate'], a.clarification_by_bkm.map(function (x) {
        return { cells: [x.bkm_id === 'own' ? 'own BKM (path)' : x.bkm_id === 'none' ? 'no BKM' : nameOf('bkms', x.bkm_id), x.n, x.with_clarification, pct(x.pct)], ids: x.ids };
      })),
      tablePanel('On-hold reasons', 'wrench', ['Reason', 'Times put on hold'], a.hold_reasons.map(function (x) {
        return { cells: [x.reason_id ? nameOf('hold_reasons', x.reason_id) : 'other', x.n], ids: x.ids };
      }), 'Nothing was put on hold in this range.')
    ]));
  }

  function loadRows(a) {
    var people = {};
    a.open_by_assignee.forEach(function (x) { var k = x.key || 'none'; people[k] = people[k] || { value: 0, done: 0, ids: [] }; people[k].value = x.n; people[k].ids = people[k].ids.concat(x.ids); });
    a.done_by_qe.forEach(function (x) { var k = x.key || 'none'; people[k] = people[k] || { value: 0, done: 0, ids: [] }; people[k].done = x.n; people[k].ids = people[k].ids.concat(x.ids); });
    return Object.keys(people).map(function (k) { return Object.assign({ label: k === 'none' ? 'not assigned' : nameOf('users', k) }, people[k]); });
  }

  /* --- Management ---------------------------------------------------------- */

  function mgmtTab(body) {
    var a = A.get(state.filter), t = a.turnaround, ls = a.line_stop;
    // the monthly management pack (Q48): pick a month, one workbook
    var thisMonth = D.viennaYmd(Date.now()).slice(0, 7);
    var lastMonth = D.addDaysYmd(thisMonth + '-01', -1).slice(0, 7);
    var monthOpts = [];
    for (var i = 0, m = thisMonth; i < 13; i++) { monthOpts.push({ value: m, label: m + (m === thisMonth ? ' (so far)' : '') }); m = D.addDaysYmd(m + '-01', -1).slice(0, 7); }
    var monthF = ui.field({ label: 'Month', value: lastMonth, options: monthOpts, cls: 'an-f' });
    body.appendChild(ui.panel({ title: 'Monthly management pack', icon: 'download', body: ui.el('div', { class: 'an-filters' }, [monthF.node,
      ui.button('Download the pack', { kind: 'primary', icon: 'download', onClick: function () {
        X.run('management_pack_' + monthF.value(), function () { return X.managementPack(monthF.value()); });
      } }),
      ui.el('p', { class: 'muted', text: 'One workbook: Summary, Per tool, Per project, Line stop, On-hold reasons, Clarification, Requests.' })]) }).node);
    body.appendChild(ui.el('div', { class: 'an-kpis' }, [
      tile('Requests (submitted)', a.counts.submitted, 'neutral', 'requests', a.ids.submitted),
      tile('On time', pct(t.on_time_pct), t.on_time_pct === null ? 'neutral' : t.on_time_pct >= 80 ? 'ok' : 'warning', 'calendar', t.ids, t.on_time + ' of ' + t.dated + ' with a date'),
      tile('Line stop', ls.n, ls.n ? 'critical' : 'ok', 'alert', ls.ids, 'response ' + h(ls.response_median_ms) + ' (p90 ' + h(ls.response_p90_ms) + ')'),
      tile('Turnaround median', h(t.median_ms), 'neutral', 'clock', t.ids, 'p90 ' + h(t.p90_ms))
    ]));
    var months = [], projects = [];
    a.per_month_project.forEach(function (x) { if (months.indexOf(x.month) === -1) months.push(x.month); if (projects.indexOf(x.project_id) === -1) projects.push(x.project_id); });
    var items = months.map(function (m) {
      var it = { label: m, ids: [] };
      a.per_month_project.filter(function (x) { return x.month === m; }).forEach(function (x) { it['p_' + (x.project_id || 'none')] = x.n; it.ids = it.ids.concat(x.ids); });
      return it;
    });
    body.appendChild(barPanel('Requests per month, by project', 'analytics', items, { stacked: true, labelHead: 'Month',
      series: projects.map(function (p) { return { label: p ? codeOf('projects', p) : 'no project', key: 'p_' + (p || 'none') }; }) }));
    body.appendChild(ui.el('div', { class: 'an-grid' }, [
      barPanel('Demand per tool', 'wrench', a.demand_by_tool.map(function (x) { return { label: codeOf('tools', x.key), value: x.n, ids: x.ids }; }),
        { valueLabel: 'Requests submitted', labelHead: 'Tool', note: 'Demand only - the capacity per tool is not set yet (open question #3).' }),
      tablePanel('Line stop response', 'alert', ['Line stop requests', 'Response median', 'Response p90'],
        ls.n ? [{ cells: [ls.n, h(ls.response_median_ms), h(ls.response_p90_ms)], ids: ls.ids }] : [], 'No Line stop in this range.',
        'Response = submitted to the first Accept or Start, in lab time.')
    ]));
  }

  return { render: render };
})();
