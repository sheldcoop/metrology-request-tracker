/**
 * Metrology Request Tracker - ui/magazine.js
 *
 * The magazine map (DECISIONS M2-23): each magazine drawn as a cassette -
 * two rails, numbered slots top to bottom, the panel in each slot - with
 * its rack. Panels asked for are lit. Editable: click a slot, then another
 * slot to swap or move the panels; a tray below holds panels that are in no
 * magazine (click a tray panel, then a slot to put it in; a slot, then the
 * tray to take it out). Keyboard: every slot is a button.
 *
 *   var mm = ui.magazineMap({ magazines: [{id, code, slots, rack}], load: [{panel, magazine_id, slot}],
 *                             panelCount, highlight: [1, 2], scrapped: [9], editable, onChange(load) });
 *   mm.value() -> the load
 *
 * Adds to MRT.ui. User text never reaches innerHTML.
 */
(function (ui) {
  'use strict';

  var el = ui.el;

  function magazineMap(o) {
    var mags = o.magazines || [];
    var load = (o.load || []).map(function (x) { return { panel: x.panel, magazine_id: x.magazine_id, slot: x.slot }; });
    var hi = o.highlight || [], scrapped = o.scrapped || [];
    var sel = null;                              // {magazine_id, slot} or {tray: panel}
    var node = el('div', { class: 'mag-map' + (o.editable ? ' is-editable' : '') });

    function at(mid, slot) { return load.filter(function (x) { return x.magazine_id === mid && x.slot === slot; })[0] || null; }
    function loose() {
      var out = [];
      for (var p = 1; p <= (o.panelCount || 0); p++) {
        if (scrapped.indexOf(p) === -1 && !load.some(function (x) { return x.panel === p; })) out.push(p);
      }
      return out;
    }

    function changed() { if (o.onChange) o.onChange(load.slice()); paint(); }

    function clickSlot(mid, slot) {
      var here = at(mid, slot);
      if (!sel) { if (here || loose().length) { sel = { magazine_id: mid, slot: slot }; paint(); } return; }
      if (sel.tray) {                                       // tray panel -> this slot (swapping out what is there)
        if (here) here.magazine_id = null;
        load = load.filter(function (x) { return x.magazine_id; });
        load.push({ panel: sel.tray, magazine_id: mid, slot: slot });
      } else if (sel.magazine_id === mid && sel.slot === slot) {
        sel = null; paint(); return;
      } else {                                              // slot -> slot: swap or move
        var from = at(sel.magazine_id, sel.slot);
        if (from) { var fm = from.magazine_id, fs = from.slot; if (here) { here.magazine_id = fm; here.slot = fs; } from.magazine_id = mid; from.slot = slot; }
        else if (here) { here.magazine_id = sel.magazine_id; here.slot = sel.slot; }
      }
      sel = null;
      changed();
    }

    function clickTray(panel) {
      if (sel && !sel.tray) {
        var from = at(sel.magazine_id, sel.slot);
        if (from) load = load.filter(function (x) { return x !== from; });                    // a full slot, then the tray: take it out
        else if (panel !== null) load.push({ panel: panel, magazine_id: sel.magazine_id, slot: sel.slot });  // an empty slot, then a tray panel: put it in
        sel = null;
        changed();
        return;
      }
      sel = panel === null ? null : { tray: panel };
      paint();
    }

    function paint() {
      ui.clear(node);
      node.appendChild(el('div', { class: 'mag-row' }, mags.map(function (m) {
        var slots = [];
        for (var s = 1; s <= (m.slots || 24); s++) {
          var x = at(m.id, s);
          var isHi = x && hi.indexOf(x.panel) !== -1;
          var isSel = sel && !sel.tray && sel.magazine_id === m.id && sel.slot === s;
          var label = 'Slot ' + s + (x ? ': panel ' + x.panel : ': empty') + (isHi ? ' (asked for)' : '');
          var attrs = { class: 'mag-slot' + (x ? ' is-full' : '') + (isHi ? ' is-hi' : '') + (isSel ? ' is-sel' : ''), title: label, 'aria-label': m.code + ' ' + label };
          var kids = [el('span', { class: 'mag-no', text: String(s) }), el('span', { class: 'mag-panel', text: x ? 'P' + x.panel : '' })];
          var slotNode;
          if (o.editable) {
            attrs.type = 'button';
            attrs['aria-pressed'] = isSel ? 'true' : 'false';
            slotNode = el('button', attrs, kids);
            (function (mid, sl) { slotNode.addEventListener('click', function () { clickSlot(mid, sl); }); })(m.id, s);
          } else {
            slotNode = el('div', attrs, kids);
          }
          slots.push(slotNode);
        }
        return el('div', { class: 'mag', role: 'group', 'aria-label': 'Magazine ' + m.code + (m.rack ? ', rack ' + m.rack : '') }, [
          el('div', { class: 'mag-head' }, [el('b', { class: 'mono', text: m.code }), el('span', { class: 'muted', text: m.rack ? 'Rack ' + m.rack : 'no rack' })]),
          el('div', { class: 'mag-body' }, slots)
        ]);
      })));
      var lp = loose();
      if (o.editable || lp.length) {
        var tray = el('div', { class: 'mag-tray', role: 'group', 'aria-label': 'Panels in no magazine' }, [
          el('span', { class: 'ifield-label', text: lp.length ? 'Not in a magazine' : (o.editable ? 'Tray (click a slot, then here, to take a panel out)' : '') })
        ].concat(lp.map(function (p) {
          var isSel = sel && sel.tray === p;
          var b = el(o.editable ? 'button' : 'span', { class: 'mag-loose' + (isSel ? ' is-sel' : '') + (hi.indexOf(p) !== -1 ? ' is-hi' : ''), type: o.editable ? 'button' : null,
            'aria-pressed': o.editable ? (isSel ? 'true' : 'false') : null, text: 'P' + p });
          if (o.editable) b.addEventListener('click', function (ev) { ev.stopPropagation(); clickTray(isSel ? null : p); });
          return b;
        })));
        if (o.editable) tray.addEventListener('click', function () { if (sel && !sel.tray) clickTray(null); });
        node.appendChild(tray);
      }
      if (scrapped.length) node.appendChild(el('p', { class: 'muted', text: 'Scrapped: panels ' + scrapped.join(', ') }));
    }

    paint();
    return { node: node, value: function () { return load.slice(); } };
  }

  ui.magazineMap = magazineMap;
})(window.MRT.ui);
