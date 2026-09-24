/**
 * Metrology Request Tracker - ui/heatmap.js  (copied from ABF Tracker v2)
 *
 * A heatmap as a CSS grid (Chart.js has none): rows x columns of cells whose
 * colour strength is the value. Tooltip card on hover and focus of a cell;
 * the whole grid has one summary label for screen readers.
 *
 *   ui.heatmap({ rows: ['Mon', ...], cols: ['00', ...], values: [[...]],
 *                label, unit, colour: 'accent', format(v, r, c), colLabelEvery })
 *
 * Adds to MRT.ui (see ui/core.js for the load order).
 * Rule: user text never reaches innerHTML. Use el()/text() or esc().
 */
(function (ui) {
  'use strict';

  var el = ui.el;

  function heatmap(o) {
    var rows = o.rows, cols = o.cols, values = o.values;
    var max = 0, peak = null;
    values.forEach(function (row, r) {
      row.forEach(function (v, c) { if (v > max) { max = v; peak = [r, c]; } });
    });
    var every = o.colLabelEvery || 1;
    var fmt = o.format || function (v) { return String(v); };

    var grid = el('div', {
      class: 'heat', role: 'img',
      style: { gridTemplateColumns: 'auto repeat(' + cols.length + ', minmax(0, 1fr))' },
      'aria-label': (o.label || 'Heatmap') + '. ' + (max
        ? 'Highest: ' + rows[peak[0]] + ' ' + cols[peak[1]] + ', ' + fmt(max, peak[0], peak[1]) + '.'
        : 'No values.')
    });
    grid.appendChild(el('span', { class: 'heat-corner' }));
    cols.forEach(function (c, i) {
      grid.appendChild(el('span', { class: 'heat-col', text: i % every === 0 ? c : '' }));
    });
    rows.forEach(function (rLabel, r) {
      grid.appendChild(el('span', { class: 'heat-row', text: rLabel }));
      cols.forEach(function (cLabel, c) {
        var v = values[r][c] || 0;
        var cell = el('span', {
          class: 'heat-cell' + (v ? '' : ' zero') + (o.colour ? ' c-' + o.colour : ''),
          tabindex: v ? '0' : null, 'aria-hidden': 'true', dataset: { r: String(r), c: String(c) }
        });
        // strength by opacity of a coloured layer: transform/opacity only, no layout
        if (v) cell.style.setProperty('--heat', (0.18 + 0.82 * v / max).toFixed(3));
        grid.appendChild(cell);
      });
    });

    ui.bindTips(grid, '.heat-cell:not(.zero)', function (t) {
      var r = +t.dataset.r, c = +t.dataset.c;
      return [el('div', { class: 'tip-title', text: rows[r] + '  ' + cols[c] }),
              ui.tipRow(o.unit || 'Value', fmt(values[r][c], r, c))];
    });

    var legend = el('div', { class: 'heat-legend' }, [
      el('span', { text: '0' }),
      el('span', { class: 'heat-scale' + (o.colour ? ' c-' + o.colour : '') }),
      el('span', { class: 'num', text: fmt(max) })
    ]);
    return el('div', { class: 'heat-wrap' }, [grid, legend]);
  }

  ui.heatmap = heatmap;
})(window.MRT.ui);
