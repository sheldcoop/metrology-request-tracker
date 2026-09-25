/**
 * Metrology Request Tracker - ui/hirata.js
 *
 * The Hirata code (DECISIONS H-1..H-3), rebuilt from Prince's Hirata tool
 * to the app's rules. Three pieces:
 *
 *   ui.copperPanel({columns, text, size, label})
 *       the panel as it looks in the hand: copper, with the drilled holes.
 *       columns: one array of 5 true/false per digit (8, 4, 2, 1, baseline)
 *       - from domain.hirataDots. The copper stays copper in every theme.
 *       size: 'sm' (next to an ID in the form), 'md' (request page, slip), 'lg'.
 *       The engraved digits are decoration (copper ink is below 4.5:1): the
 *       screen always shows the same digits as normal text next to the panel,
 *       and the panel's label carries them for screen readers.
 *
 *   ui.hirataFields(fields, {compact})
 *       the decoded code, field by field (Supplier, Year, Week, Day, Lot per
 *       day, Panel), each with its colour bar. fields: domain.hirataFields().
 *
 *   ui.hirataGrid({fields, weights, digits, canSet, digitOf, onChange, onBlocked})
 *       the decoder: tap the dots you see on the panel. A start column (all
 *       five dots) sets the orientation; the bottom row is the baseline and
 *       cannot be switched; a dot that would take a column above 9 is locked.
 *       Keyboard: arrows move, Space / Enter toggles. Returns {node, set(digits), digits()}.
 *
 * It reads no data and holds no rule: the screen passes the dots and the
 * rule functions from domain.js (like ui.panelMap). Adds to MRT.ui.
 * Rule: user text never reaches innerHTML - digits go in as text.
 */
(function (ui) {
  'use strict';

  var el = ui.el;
  var FIELD_CLASS = { sup: 'hf-sup', yr: 'hf-yr', wk: 'hf-wk', day: 'hf-day', lot: 'hf-lot', pan: 'hf-pan' };

  /* --- the copper panel ---------------------------------------------- */

  function copperPanel(o) {
    o = o || {};
    var cols = o.columns || [];
    var holes = el('div', { class: 'cu-holes', 'aria-hidden': 'true' }, cols.map(function (dots) {
      return el('div', { class: 'cu-col' }, (dots || []).map(function (on) { return el('span', { class: 'cu-hole' + (on ? '' : ' is-empty') }); }));
    }));
    return el('div', {
      class: 'cu-panel cu-' + (o.size || 'md'), role: 'img',
      'aria-label': o.label || ('Hirata pattern ' + (o.text || ''))
    }, [holes, o.text ? el('div', { class: 'cu-num mono', 'aria-hidden': 'true', text: String(o.text).split('').join(' ') }) : null]);
  }

  /* --- the decoded fields --------------------------------------------- */

  function hirataFields(fields, o) {
    o = o || {};
    return el('dl', { class: 'hf-list' + (o.compact ? ' is-compact' : '') }, (fields || []).map(function (f) {
      return el('div', { class: 'hf-item ' + (FIELD_CLASS[f.id] || '') }, [
        el('dt', { text: f.name }),
        el('dd', { class: 'mono' + (f.partial ? ' is-partial' : ''), text: f.value + (f.partial ? '…' : ''),
                   title: f.partial ? 'Only part of this field is known' : null })
      ]);
    }));
  }

  /* --- the decoder grid ------------------------------------------------ */

  function hirataGrid(o) {
    var fields = o.fields, W = o.weights, ROWS = W.length + 1, BASE = W.length;
    var n = fields.reduce(function (s, f) { return s + f.width; }, 0);
    var cols = [];
    function blank() { cols = []; for (var i = 0; i < n; i++) { var d = W.map(function () { return false; }); d.push(true); cols.push(d); } }
    blank();

    var table = el('table', { class: 'hg-grid', 'aria-label': o.label || 'Hirata code grid' });
    var cells = {};         // "c:r" -> td
    var digitCells = [];

    // group heads: a coloured top edge per field, the name in normal text
    var head = el('tr', {}, [el('th', { class: 'hg-rail' }), el('th', { class: 'hg-start-h', scope: 'col', text: 'Start' })]);
    fields.forEach(function (f) {
      head.appendChild(el('th', { class: 'hg-field ' + (FIELD_CLASS[f.id] || ''), colspan: String(f.width), scope: 'colgroup', text: f.width >= 2 ? f.name : f.name.split(' ')[0] }));
    });
    table.appendChild(el('thead', {}, head));

    var body = el('tbody');
    for (var r = 0; r < ROWS; r++) {
      var tr = el('tr', {}, [el('th', { class: 'hg-rail', scope: 'row', text: r === BASE ? 'base' : String(W[r]) })]);
      tr.appendChild(el('td', { class: 'hg-cell is-start is-on', title: 'Code start - all five dots', 'aria-hidden': 'true' }, el('span', { class: 'hg-dot' })));
      for (var c = 0; c < n; c++) {
        var base = r === BASE;
        var td = el('td', {
          class: 'hg-cell' + (base ? ' is-base is-on' : ''), dataset: { c: String(c), r: String(r) },
          role: base ? null : 'button', tabindex: base ? null : (c === 0 && r === 0 ? '0' : '-1'),
          'aria-label': 'Column ' + (c + 1) + (base ? ', baseline, always there' : ', weight ' + W[r]),
          title: base ? 'Baseline - always there' : null
        }, el('span', { class: 'hg-dot' }));
        cells[c + ':' + r] = td;
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
    var drow = el('tr', { class: 'hg-digits' }, [el('th', { class: 'hg-rail', scope: 'row', text: 'digit' }), el('td', { class: 'hg-digit is-off', text: '-' })]);
    for (var k = 0; k < n; k++) { var dc = el('td', { class: 'hg-digit mono', 'aria-live': 'polite' }); digitCells.push(dc); drow.appendChild(dc); }
    body.appendChild(drow);
    table.appendChild(body);

    function paint() {
      for (var c = 0; c < n; c++) {
        digitCells[c].textContent = String(o.digitOf(cols[c]));
        for (var r = 0; r < W.length; r++) {
          var td = cells[c + ':' + r], on = !!cols[c][r], locked = !on && !o.canSet(cols[c], r);
          td.classList.toggle('is-on', on);
          td.classList.toggle('is-locked', locked);
          td.setAttribute('aria-pressed', on ? 'true' : 'false');
          td.setAttribute('aria-disabled', locked ? 'true' : 'false');
        }
      }
    }
    function digits() { return cols.map(function (d) { return String(o.digitOf(d)); }).join(''); }

    function toggle(td) {
      var c = +td.dataset.c, r = +td.dataset.r;
      if (r === BASE) return;
      if (!o.canSet(cols[c], r)) {
        td.classList.remove('is-shake'); void td.offsetWidth; td.classList.add('is-shake');
        if (o.onBlocked) o.onBlocked(c + 1);
        return;
      }
      cols[c][r] = !cols[c][r];
      paint();
      if (o.onChange) o.onChange(digits());
    }

    table.addEventListener('click', function (ev) {
      var td = ev.target.closest && ev.target.closest('td.hg-cell');
      if (td && td.dataset.c !== undefined && !td.classList.contains('is-base')) toggle(td);
    });
    table.addEventListener('keydown', function (ev) {
      var td = ev.target.closest && ev.target.closest('td.hg-cell');
      if (!td || td.dataset.c === undefined) return;
      if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); toggle(td); return; }
      var c = +td.dataset.c, r = +td.dataset.r, dc = 0, dr = 0;
      if (ev.key === 'ArrowRight') dc = 1; else if (ev.key === 'ArrowLeft') dc = -1;
      else if (ev.key === 'ArrowDown') dr = 1; else if (ev.key === 'ArrowUp') dr = -1; else return;
      ev.preventDefault();
      var next = cells[(c + dc) + ':' + Math.min(W.length - 1, Math.max(0, r + dr))];
      if (next) { td.setAttribute('tabindex', '-1'); next.setAttribute('tabindex', '0'); next.focus(); }
    });

    /** Show a typed code on the grid (digits above 9 or letters are ignored). */
    function set(text) {
      blank();
      String(text || '').replace(/\D/g, '').slice(-n).split('').forEach(function (ch, i, all) {
        var col = n - all.length + i, v = +ch;
        W.forEach(function (w, r) { cols[col][r] = (v & w) !== 0; });
      });
      paint();
    }

    if (o.digits) set(o.digits); else paint();
    return { node: el('div', { class: 'hg-wrap' }, table), set: set, digits: digits, clear: function () { blank(); paint(); } };
  }

  ui.copperPanel = copperPanel;
  ui.hirataFields = hirataFields;
  ui.hirataGrid = hirataGrid;
})(window.MRT.ui);
