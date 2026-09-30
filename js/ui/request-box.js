/**
 * Metrology Request Tracker - ui/request-box.js
 *
 * One request as a box (redesign Step 4; shared by My queue and,
 * from Step 5, My requests): line 1 is the tool glyph, the mono
 * request ID, the priority word for Line stop and Hot only, the
 * status chip, a red Late chip when late, and the assigned person
 * on the right; line 2 is the lot and the build-up only; the bottom
 * line holds the view's action nodes. Thin left stripe for Line stop
 * and Hot only. A done box shows "Completed" and fades out.
 *
 * It reads no data: the screen passes plain values -
 *   ui.requestBox(r, {
 *     tool, lot, buCode, step: 'After ...' | null, prio: {name, level} | null,
 *     assignedName, late: bool, statusChip: Node, href: '...' (default '#/request/' + id),
 *     tick: {checked, label, onChange} | null, actions: [Node],
 *     done: bool })
 */
(function (ui) {
  'use strict';

  function requestBox(r, o) {
    o = o || {};
    var level = o.prio ? o.prio.level : 3;
    if (o.done) {
      return ui.el('div', { class: 'qbox is-done prio-' + level, id: 'box-' + r.id }, [
        ui.el('span', { class: 'qbox-done', text: 'Completed' }),
        ui.el('span', { class: 'mono muted', text: r.request_no || '' })
      ]);
    }
    var tick = null;
    if (o.tick) {
      tick = ui.el('input', { type: 'checkbox', class: 'qbox-tick', 'aria-label': o.tick.label, checked: !!o.tick.checked });
      (function (cb) {
        tick.addEventListener('change', function () { o.tick.onChange(cb.checked); });
      })(tick);
    }
    var acts = (o.actions || []).filter(Boolean);
    return ui.el('div', { class: 'qbox prio-' + level + (o.late ? ' is-late' : ''), id: 'box-' + r.id }, [
      ui.el('div', { class: 'qbox-l1' }, [
        tick,
        o.tool ? ui.toolGlyph(o.tool.glyph, { size: 24 }) : null,
        ui.el('a', { class: 'mono qbox-id', href: o.href || '#/request/' + r.id, text: r.request_no || '' }),
        level <= 2 && o.prio ? ui.el('span', { class: 'qbox-prio-word', text: o.prio.name }) : null,
        o.statusChip || null,
        o.late ? ui.statusBadge('expired', 'Late') : null,
        ui.el('span', { class: 'qbox-right', text: o.assignedName || '-' })
      ]),
      ui.el('div', { class: 'qbox-l2' }, [
        ui.el('span', { class: 'mono', text: o.lot || '?' }),
        o.buCode ? ui.el('span', { class: 'muted', text: '  ·  ' + o.buCode }) : null,
        o.step ? ui.el('span', { class: 'muted', text: '  ·  ' + o.step }) : null
      ]),
      acts.length ? ui.el('div', { class: 'qbox-acts' }, acts) : null
    ]);
  }

  ui.requestBox = requestBox;
})(window.MRT.ui);
