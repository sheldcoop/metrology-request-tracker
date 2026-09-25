/**
 * Metrology Request Tracker - ui/panelmap.js
 *
 * UNUSED since request form v2 (panels are Hirata IDs, F-1) - kept on purpose
 * for the Hirata decoder / panels by position (OPEN_QUESTIONS #22, M2 audit
 * 2026-09-25). No screen loads it; it stays in the ui-kit and its tests.
 *
 * The panel map (Q6, DECISIONS M2-2): the panels of a lot drawn as small
 * boards with corner fiducials, numbered 1..n. Click a panel to pick it,
 * Shift+click picks the run from the last one; arrow keys move, Space picks.
 * Next to it the same pick as text ("1-5, 12"): typing lights the map,
 * clicking rewrites the text - both stay in sync. A read-only map shows
 * marks instead (measured, scrapped, in the lab).
 *
 *   var pm = ui.panelMap({ count: 12, selected: [1, 2], label: 'Panels',
 *                          parse: D.parsePanels, format: D.formatPanels,
 *                          onChange(list), readOnly, marks: {3: 'scrapped'} });
 *   pm.value() -> [1, 2]    pm.set([4, 5])    pm.setError('...')
 *
 * The range rules live in domain.js; the screen passes them in (a
 * component never calls domain itself). Adds to MRT.ui.
 * Rule: user text never reaches innerHTML. Use el()/text() or esc().
 */
(function (ui) {
  'use strict';

  var el = ui.el;
  var MARK_LABEL = { measured: 'measured', scrapped: 'scrapped', received: 'in the lab' };

  /** Columns: one row up to 12 panels, then rows of 12 (20 for big lots). */
  function columns(count) { return count <= 12 ? count : (count > 60 ? 20 : 12); }

  function panelMap(o) {
    var count = o.count, cols = columns(count);
    var picked = {};
    (o.selected || []).forEach(function (n) { if (n >= 1 && n <= count) picked[n] = true; });
    var marks = o.marks || {};
    var last = null;          // anchor for Shift+click
    var focusN = 1;           // roving focus

    var readout = el('span', { class: 'pm-count num', 'aria-live': 'polite' });
    var cells = [];
    var map = el('div', { class: 'panel-map' + (o.readOnly ? ' is-readonly' : ''), role: 'group',
      'aria-label': (o.label || 'Panels') + ' - ' + count + ' panels', style: { gridTemplateColumns: 'repeat(' + cols + ', minmax(0, 1fr))' } });
    for (var n = 1; n <= count; n++) {
      var mark = marks[n];
      var text = 'Panel ' + n + (mark ? ', ' + MARK_LABEL[mark] : '');
      var cell = o.readOnly
        ? el('span', { class: 'pm-cell', role: 'img', 'aria-label': text, title: text, dataset: { n: n } }, el('span', { class: 'pm-num', text: String(n) }))
        : el('button', { type: 'button', class: 'pm-cell', title: text, 'aria-label': text, tabindex: '-1', dataset: { n: n } },
             el('span', { class: 'pm-num', text: String(n) }));
      if (mark) cell.classList.add('is-' + mark);
      cells.push(cell);
      map.appendChild(cell);
    }

    var field = o.readOnly ? null : ui.field({ label: 'Or type them', placeholder: 'e.g. 1-5, 12   or   all', mono: true,
      hint: 'Ranges with a dash, separated by commas.' });

    function list() { return Object.keys(picked).map(Number).sort(function (a, b) { return a - b; }); }

    function paint(fromText) {
      var sel = list();
      cells.forEach(function (c, i) {
        var on = !!picked[i + 1];
        c.classList.toggle('is-picked', on);
        if (!o.readOnly) { c.setAttribute('aria-pressed', on ? 'true' : 'false'); c.tabIndex = i + 1 === focusN ? 0 : -1; }
      });
      readout.textContent = o.readOnly ? count + ' panels' : sel.length + ' of ' + count + ' picked';
      if (field && !fromText) { field.input.value = o.format ? o.format(sel) : sel.join(', '); field.setState(null); }
    }

    function changed(fromText) {
      paint(fromText);
      if (o.onChange) o.onChange(list());
    }

    function blocked(n) { return marks[n] === 'scrapped'; }   // a scrapped panel cannot be picked

    function toggle(n, shift) {
      if (shift && last !== null) {
        var on = !picked[n] || !picked[last];
        var a = Math.min(last, n), b = Math.max(last, n);
        for (var k = a; k <= b; k++) { if (on && !blocked(k)) picked[k] = true; else delete picked[k]; }
      } else if (blocked(n)) return;
      else if (picked[n]) delete picked[n];
      else picked[n] = true;
      last = n; focusN = n;
      changed(false);
    }

    if (!o.readOnly) {
      map.addEventListener('click', function (ev) {
        var c = ev.target.closest ? ev.target.closest('.pm-cell') : null;
        if (!c) return;
        toggle(Number(c.dataset.n), !!ev.shiftKey);
      });
      map.addEventListener('keydown', function (ev) {
        var step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[ev.key];
        if (step) {
          ev.preventDefault();
          focusN = Math.max(1, Math.min(count, focusN + step));
          paint(true);
          cells[focusN - 1].focus();
        } else if (ev.key === 'Home' || ev.key === 'End') {
          ev.preventDefault();
          focusN = ev.key === 'Home' ? 1 : count;
          paint(true);
          cells[focusN - 1].focus();
        }
      });
      field.input.addEventListener('input', function () {
        var r = o.parse ? o.parse(field.value(), count) : { panels: [], errors: [] };
        if (r.errors.length) { field.setState('invalid', r.errors[0]); return; }
        var gone = r.panels.filter(blocked);
        if (gone.length) { field.setState('invalid', 'Panel ' + gone.join(', ') + (gone.length > 1 ? ' are' : ' is') + ' scrapped'); return; }
        picked = {};
        r.panels.forEach(function (x) { picked[x] = true; });
        field.setState(null);
        changed(true);
      });
      field.input.addEventListener('blur', function () { if (!field.node.classList.contains('is-invalid')) paint(false); });
    }

    var head = el('div', { class: 'pm-head' }, [
      el('span', { class: 'ifield-label', text: o.label || 'Panels' }),
      readout,
      el('span', { class: 'spacer' }),
      o.readOnly ? null : ui.button('All', { size: 'sm', kind: 'ghost', onClick: function () { for (var k = 1; k <= count; k++) if (!blocked(k)) picked[k] = true; changed(false); } }),
      o.readOnly ? null : ui.button('None', { size: 'sm', kind: 'ghost', onClick: function () { picked = {}; changed(false); } })
    ]);
    var legend = o.readOnly && Object.keys(marks).length ? el('div', { class: 'pm-legend' }, ['measured', 'received', 'scrapped'].filter(function (m) {
      return Object.keys(marks).some(function (k) { return marks[k] === m; });
    }).map(function (m) { return el('span', { class: 'pm-key is-' + m }, [el('i', { 'aria-hidden': 'true' }), MARK_LABEL[m]]); })) : null;

    var node = el('div', { class: 'pm' }, [head, map, legend, field ? field.node : null]);
    paint(false);

    return {
      node: node,
      value: list,
      set: function (nums) { picked = {}; (nums || []).forEach(function (x) { if (x >= 1 && x <= count) picked[x] = true; }); paint(false); },
      setError: function (msg) { if (field) field.setState(msg ? 'invalid' : null, msg || null); node.classList.toggle('is-invalid', !!msg); },
      focus: function () { if (cells[0] && !o.readOnly) { focusN = list()[0] || 1; paint(true); cells[focusN - 1].focus(); } }
    };
  }

  ui.panelMap = panelMap;
})(window.MRT.ui);
