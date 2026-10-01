/**
 * Metrology Request Tracker - views/home.js
 *
 * Home (#/home): one door per page - icon, title, one line. No counts:
 * a card is a place to start work, not a dashboard (Step 4 reverses DASH-4;
 * the counting functions stay for the nav badge, bell and queue counts).
 * A card shows only when its domain.js gate allows it (New request:
 * canRequest, My queue + Board: canMeasure, Analytics: canSeeManagement);
 * Lab status, My requests and Help are read surfaces, open to every
 * signed-in person. Lots, Settings, Results and Hirata stay sidebar-only.
 * Every card carries a data-scene key for the hover scenes
 * (js/ui/scene3d.js).
 */
window.MRT = window.MRT || {};
window.MRT.views = window.MRT.views || {};
window.MRT.views.home = (function () {
  'use strict';

  var ui = window.MRT.ui;
  var D = window.MRT.domain;
  var store = window.MRT.store;

  /* Cards carry no counts (Step 4): a Home card is a door, not a dashboard.
   * The counting functions (stripCounts, toolQueueStats, notificationsFor)
   * stay untouched - the nav badge, bell and queue counts line still use
   * them. Scene audit: Lots and Settings had no scene; new, mine, queue,
   * board, aoi (Lab), bars (Analytics) and dice (Help) are all still bound. */
  function card(o) {
    return ui.el('a', { class: 'home-card', href: '#/' + o.key, dataset: o.scene ? { scene: o.scene } : null }, [
      ui.el('span', { class: 'home-ic', 'aria-hidden': 'true' }, ui.icon(o.icon, 28)),
      ui.el('span', { class: 'home-tx' }, [
        ui.el('b', { text: o.title }),
        ui.el('span', { class: 'home-d', text: o.desc })
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
    /* Sign-in slot (Step 3): unknown user, content waiting from the app -
     * hero and sentence above, the Who-are-you form instead of cards. */
    var waiting = !me && window.MRT.app && window.MRT.app.slot ? window.MRT.app.slot() : null;
    main.appendChild(hero());
    if (waiting) {
      var box = ui.el('div', { class: 'home-slot' }, waiting);
      main.appendChild(box);
      try { var f = box.querySelector('input, .btn-primary'); if (f) f.focus(); } catch (e) {}
      return;
    }
    var cards = [
      D.canRequest(me) && { key: 'new', icon: 'plus-circle', title: 'New request', scene: 'new',
        desc: 'Ask the lab to measure your panels' },
      { key: 'requests', icon: 'list', title: 'My requests', scene: 'mine',
        desc: 'Follow your requests from submit to result' },
      D.canMeasure(me) && { key: 'queue', icon: 'inbox', title: 'My queue', scene: 'queue',
        desc: 'Work the open requests of your tools' },
      D.canMeasure(me) && { key: 'board', icon: 'kanban', title: 'Board', scene: 'board',
        desc: 'Every open request, by tool and stage' },
      { key: 'lab', icon: 'activity', title: 'Lab status', scene: 'aoi',
        desc: 'Which tools are up, and how busy' },
      D.canSeeManagement(me) && { key: 'analytics', icon: 'bar-chart', title: 'Analytics', scene: 'bars',
        desc: 'Turnaround, load and trends' },
      { key: 'help', icon: 'circle-help', title: 'Help', scene: 'dice',
        desc: 'Step-by-step guides for every task' }
    ].filter(Boolean);

    main.appendChild(ui.el('div', { class: 'home-grid' }, cards.map(card)));
    if (window.MRT.scene3d) { try { window.MRT.scene3d.mountAll(main); } catch (e) {} }
  }

  return { render: render, _tagline: { seq: TAG_SEQ, final: TAG_FINAL, text: tagText, next: tagNext } };
})();
