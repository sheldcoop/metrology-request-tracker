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
 * themselves use - no new maths here. Every card except Lots and
 * Settings carries a data-scene key for the hover scenes (js/ui/scene3d.js).
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
    return ui.el('a', { class: 'home-card', href: '#/' + o.key, dataset: o.scene ? { scene: o.scene } : null }, [
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

  /* The hero tagline: four typed lines settling on the final one, which
   * stays permanently (no loop - this page is opened all day). The driver
   * is pure so tests can run it to the end: tagNext() of a settled state
   * returns settle again, and the view schedules no timer on settle. */
  var TAG_SEQ = [{ a: 'Panel', b: 'Measurement' }, { a: 'Measurement', b: 'Data' },
                 { a: 'Data', b: 'Insight' }, { a: 'Insight', b: 'Decision' }];
  var TAG_FINAL = { a: 'Request', b: 'Result' };
  var TAG_TYPE_MS = 45, TAG_HOLD_MS = 1400;

  function tagText(line) { return 'From ' + line.a + ' to ' + line.b; }

  function tagNext(s) {
    var line = s.line < TAG_SEQ.length ? TAG_SEQ[s.line] : TAG_FINAL;
    var full = tagText(line).length;
    if (s.n < full) return { line: s.line, n: s.n + 1, cmd: 'paint' };
    if (s.line >= TAG_SEQ.length) return { line: s.line, n: s.n, cmd: 'settle' };
    if (!s.hold) return { line: s.line, n: s.n, hold: true, cmd: 'hold' };
    return { line: s.line + 1, n: 0, cmd: 'paint' };
  }

  function paintTag(node, line, n) {
    var parts = [['From ', false], [line.a, true], [' to ', false], [line.b, true]];
    var rest = n, spans = parts.map(function (p) {
      var take = p[0].slice(0, Math.max(0, Math.min(rest, p[0].length)));
      rest -= take.length;
      return ui.el('span', { class: p[1] ? 'home-tag-hi' : null, text: take });
    });
    node.textContent = '';
    spans.forEach(function (s) { node.appendChild(s); });
  }

  function hero() {
    var line = ui.el('span', { class: 'home-tag-line', 'aria-hidden': 'true' });
    var caret = ui.el('span', { class: 'home-caret', 'aria-hidden': 'true' });
    var h = ui.el('h1', { class: 'home-tag', 'aria-label': tagText(TAG_FINAL) }, [line, caret]);
    var sub = ui.el('p', { class: 'home-sub',
      text: 'Request, track and analyse measurements across HRM, AOI, PRF, QVM and FIB.' });
    var box = ui.el('div', { class: 'home-hero' }, [h, sub]);
    if (ui.reducedMotion()) {
      paintTag(line, TAG_FINAL, tagText(TAG_FINAL).length);
      caret.hidden = true;
      return box;
    }
    var s = { line: 0, n: 0 };
    function tick() {
      if (!line.isConnected) return;
      if (document.hidden) { setTimeout(tick, 1000); return; }
      s = tagNext(s);
      var ln = s.line < TAG_SEQ.length ? TAG_SEQ[s.line] : TAG_FINAL;
      if (s.cmd === 'settle') { paintTag(line, ln, tagText(ln).length); caret.hidden = true; return; }
      paintTag(line, ln, s.n);
      setTimeout(tick, s.cmd === 'hold' ? TAG_HOLD_MS : TAG_TYPE_MS);
    }
    setTimeout(tick, TAG_TYPE_MS);
    return box;
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
      D.canRequest(me) && { key: 'new', icon: 'plus-circle', title: 'New request', scene: 'new',
        desc: 'Unfinished drafts — continue one or start new', n: mineAll.filter(function (r) { return D.isOldDraft(r, now); }).length, unit: 'drafts' },
      { key: 'requests', icon: 'list', title: 'My requests', scene: 'mine',
        desc: 'Your requests — updates in the last 7 days',
        n: D.notificationsFor(me, store.data(), { since_ts: now - 7 * 86400000, limit: 40 }).length, unit: 'updates' },
      D.canMeasure(me) && { key: 'queue', icon: 'inbox', title: 'My queue', scene: 'queue',
        desc: 'Open for your tools, most urgent first', n: strip.open, unit: 'open' },
      { key: 'lab', icon: 'activity', title: 'Lab status', scene: 'aoi',
        desc: 'Open requests in the lab', n: labOpen, unit: 'open' },
      D.canMeasure(me) && { key: 'board', icon: 'kanban', title: 'Board', scene: 'board',
        desc: 'Line stop comes first', n: strip.line_stop, unit: 'line stop' },
      D.canSeeManagement(me) && { key: 'analytics', icon: 'bar-chart', title: 'Analytics', scene: 'bars',
        desc: 'Completed in the last 90 days',
        n: window.MRT.analytics.get(window.MRT.analytics.defaultFilter(now)).counts.done, unit: 'done' },
      D.canRegisterLot(me) && { key: 'lots', icon: 'layers', title: 'Lots',
        desc: 'Lots on file — register a new one', n: store.list('lots').length, unit: 'lots' },
      { key: 'help', icon: 'circle-help', title: 'Help', scene: 'dice',
        desc: 'Step-by-step guides', n: window.MRT.views.help.GUIDES.length, unit: 'guides' },
      D.canUseSettings(me) && { key: 'settings', icon: 'settings', title: 'Settings',
        desc: 'Setup problems needing an admin',
        n: store.health().issues.filter(function (x) { return x.severity === 'problem'; }).length, unit: 'problems' }
    ].filter(Boolean);

    main.appendChild(hero());
    main.appendChild(ui.el('div', { class: 'home-grid' }, cards.map(card)));
    if (window.MRT.scene3d) { try { window.MRT.scene3d.mountAll(main); } catch (e) {} }
  }

  return { render: render, _tagline: { seq: TAG_SEQ, final: TAG_FINAL, text: tagText, next: tagNext } };
})();
