/**
 * Metrology Request Tracker - ui/magazine.js
 *
 * A PCB magazine seen from the front (DECISIONS F-3): two side walls and
 * the slots stacked between them, numbered from the top - like the
 * magazines that feed a Hirata loader. One panel per slot. Pick the slots
 * the panels sit in: click, or press and drag over several; a picked slot
 * shows a panel with its Hirata ID. Slots of other open requests are drawn
 * taken (with their request ID) and cannot be picked. Keyboard: arrows move,
 * Space picks.
 *
 *   var m = ui.magazineSlots({ magazine: {code, slots}, picked: [3, 4], labels: {3: '3252'},
 *                              taken: {9: 'FIB-260924-01'}, readOnly, onChange(slots) });
 *   m.value() -> [3, 4]      m.setLabels({3: '3252', 4: '3253'})
 *
 * Adds to MRT.ui. User text never reaches innerHTML.
 */
(function (ui) {
  'use strict';

  var el = ui.el;

  function magazineSlots(o) {
    var mag = o.magazine || { code: '?', slots: 24 };
    var n = mag.slots || 24;
    var picked = {};
    (o.picked || []).forEach(function (s) { if (s >= 1 && s <= n) picked[s] = true; });
    var labels = o.labels || {}, taken = o.taken || {};
    var focusS = (o.picked && o.picked[0]) || 1;
    var drag = null;                                   // {on: bool} while the mouse is down
    var rails = [];

    var count = el('span', { class: 'mz-count num' });
    var frame = el('div', { class: 'mz-frame' + (o.readOnly ? ' is-readonly' : ''), role: 'group', 'aria-label': 'Magazine ' + mag.code + ', ' + n + ' slots' });
    for (var s = 1; s <= n; s++) {
      var t = taken[s];
      var attrs = { class: 'mz-slot' + (t ? ' is-taken' : ''), dataset: { slot: s }, title: t ? 'Slot ' + s + ': ' + t : 'Slot ' + s };
      var kids = [el('span', { class: 'mz-no', text: String(s) }), el('span', { class: 'mz-rail', 'aria-hidden': 'true' }),
                  el('span', { class: 'mz-panel' }, el('span', { class: 'mz-id' })), t ? el('span', { class: 'mz-taken', text: t }) : null];
      var node = o.readOnly || t ? el('div', attrs, kids) : el('button', Object.assign(attrs, { type: 'button', tabindex: '-1' }), kids);
      rails.push(node);
      frame.appendChild(node);
    }

    function list() { return Object.keys(picked).map(Number).sort(function (a, b) { return a - b; }); }

    function paint() {
      rails.forEach(function (r, i) {
        var sl = i + 1, on = !!picked[sl];
        r.classList.toggle('is-picked', on);
        r.querySelector('.mz-id').textContent = on ? (labels[sl] || '') : '';
        if (r.tagName === 'BUTTON') {
          r.setAttribute('aria-pressed', on ? 'true' : 'false');
          r.setAttribute('aria-label', 'Slot ' + sl + (on ? ', panel ' + (labels[sl] || 'picked') : ', empty'));
          r.tabIndex = sl === focusS ? 0 : -1;
        }
      });
      var k = list().length;
      count.textContent = k ? k + ' slot' + (k === 1 ? '' : 's') + ': ' + ui.formatSlots(list()) : 'no slot picked';
    }

    function set(sl, on) {
      if (taken[sl] || sl < 1 || sl > n) return;
      if (on) picked[sl] = true; else delete picked[sl];
    }
    function changed() { paint(); if (o.onChange) o.onChange(list()); }

    if (!o.readOnly) {
      frame.addEventListener('mousedown', function (ev) {
        var r = ev.target.closest ? ev.target.closest('button.mz-slot') : null;
        if (!r) return;
        var sl = Number(r.dataset.slot);
        drag = { on: !picked[sl] };
        set(sl, drag.on); focusS = sl;
        changed();
        ev.preventDefault();
        document.addEventListener('mouseup', endDrag);
      });
      var endDrag = function () { drag = null; document.removeEventListener('mouseup', endDrag); };
      frame.addEventListener('mouseover', function (ev) {
        if (!drag) return;
        var r = ev.target.closest ? ev.target.closest('button.mz-slot') : null;
        if (r) { set(Number(r.dataset.slot), drag.on); changed(); }
      });
      frame.addEventListener('click', function (ev) {
        if (ev.detail > 0) return;                         // mouse clicks were handled on mousedown; this is the keyboard
        var r = ev.target.closest ? ev.target.closest('button.mz-slot') : null;
        if (!r) return;
        var sl = Number(r.dataset.slot);
        set(sl, !picked[sl]); focusS = sl;
        changed();
      });
      frame.addEventListener('keydown', function (ev) {
        var step = { ArrowDown: 1, ArrowUp: -1 }[ev.key];
        if (step) {
          ev.preventDefault();
          focusS = Math.max(1, Math.min(n, focusS + step));
          while (taken[focusS] && focusS > 1 && focusS < n) focusS += step;
          paint();
          var b = rails[focusS - 1];
          if (b && b.focus) b.focus();
        }
      });
    }

    var node = el('div', { class: 'mz' }, [
      el('div', { class: 'mz-head' }, [el('b', { class: 'mono', text: mag.code }), count]),
      frame
    ]);
    paint();
    return {
      node: node,
      value: list,
      setLabels: function (map) { labels = map || {}; paint(); },
      set: function (slots) { picked = {}; (slots || []).forEach(function (x) { set(x, true); }); paint(); }
    };
  }

  /** [3, 4, 5, 9] -> "3-5, 9" */
  ui.formatSlots = function (list) {
    var a = (list || []).slice().sort(function (x, y) { return x - y; }), parts = [], i = 0;
    while (i < a.length) { var j = i; while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++; parts.push(j - i >= 2 ? a[i] + '-' + a[j] : a.slice(i, j + 1).join(', ')); i = j + 1; }
    return parts.join(', ');
  };
  ui.magazineSlots = magazineSlots;
})(window.MRT.ui);
