/**
 * Metrology Request Tracker - views/home.js
 *
 * Home (#/home): one door per page - icon, title, one line, live count.
 * A card shows only when its domain.js gate allows it (New request:
 * canRequest, My queue + Board: canMeasure, Analytics: canSeeManagement,
 * Lots: canRegisterLot, Settings: canUseSettings); Lab status, My requests
 * and Help are read surfaces, open to every signed-in person. The counts
 * reuse the existing functions only (stripCounts, toolQueueStats,
 * notificationsFor, analytics.get) plus the same store reads the pages
 * themselves use - no new maths here.
 */
window.MRT = window.MRT || {};
window.MRT.views = window.MRT.views || {};
window.MRT.views.home = (function () {
  'use strict';

  var ui = window.MRT.ui;
  var D = window.MRT.domain;
  var store = window.MRT.store;

  function levelOf(r) { var p = store.byId('priorities', r.priority_id); return p ? p.level : 99; }

  function stripArgs(me, now) {
    return { user: me, tools: store.list('tools'), requests: store.data().requests || [], now_ts: now,
             cal: store.calendar(), levelOf: levelOf };
  }

  function card(o) {
    return ui.el('a', { class: 'home-card', href: '#/' + o.key }, [
      ui.el('span', { class: 'home-ic', 'aria-hidden': 'true' }, ui.icon(o.icon, 28)),
      ui.el('span', { class: 'home-tx' }, [
        ui.el('b', { text: o.title }),
        ui.el('span', { class: 'home-d', text: o.desc })
      ]),
      ui.el('span', { class: 'home-n' }, [
        ui.el('b', { class: 'num', text: String(o.n) }),
        ui.el('span', { text: o.unit })
      ])
    ]);
  }

  function render(main) {
    var me = store.currentUser();
    var now = Date.now();
    var requests = store.data().requests || [];
    var strip = D.stripCounts(stripArgs(me, now));
    var mineAll = store.visibleRequests(function (r) { return r.requester_id === me.id; });
    var labOpen = store.list('tools').reduce(function (n, t) {
      return n + D.toolQueueStats(requests, t.id, now, store.calendar(), D.holidaySet(store.data().holidays)).open;
    }, 0);

    var cards = [
      D.canRequest(me) && { key: 'new', icon: 'plus-circle', title: 'New request',
        desc: 'Unfinished drafts — continue one or start new', n: mineAll.filter(function (r) { return D.isOldDraft(r, now); }).length, unit: 'drafts' },
      { key: 'requests', icon: 'list', title: 'My requests',
        desc: 'Your requests — updates in the last 7 days',
        n: D.notificationsFor(me, store.data(), { since_ts: now - 7 * 86400000, limit: 40 }).length, unit: 'updates' },
      D.canMeasure(me) && { key: 'queue', icon: 'inbox', title: 'My queue',
        desc: 'Open for your tools, most urgent first', n: strip.open, unit: 'open' },
      { key: 'lab', icon: 'activity', title: 'Lab status',
        desc: 'Open requests in the lab', n: labOpen, unit: 'open' },
      D.canMeasure(me) && { key: 'board', icon: 'kanban', title: 'Board',
        desc: 'Line stop comes first', n: strip.line_stop, unit: 'line stop' },
      D.canSeeManagement(me) && { key: 'analytics', icon: 'bar-chart', title: 'Analytics',
        desc: 'Completed in the last 90 days',
        n: window.MRT.analytics.get(window.MRT.analytics.defaultFilter(now)).counts.done, unit: 'done' },
      D.canRegisterLot(me) && { key: 'lots', icon: 'layers', title: 'Lots',
        desc: 'Lots on file — register a new one', n: store.list('lots').length, unit: 'lots' },
      { key: 'help', icon: 'circle-help', title: 'Help',
        desc: 'Step-by-step guides', n: window.MRT.views.help.GUIDES.length, unit: 'guides' },
      D.canUseSettings(me) && { key: 'settings', icon: 'settings', title: 'Settings',
        desc: 'Setup problems needing an admin',
        n: store.health().issues.filter(function (x) { return x.severity === 'problem'; }).length, unit: 'problems' }
    ].filter(Boolean);

    main.appendChild(ui.pageHead('Home', 'Your doors into the lab.'));
    main.appendChild(ui.el('div', { class: 'home-grid' }, cards.map(card)));
  }

  return { render: render };
})();
