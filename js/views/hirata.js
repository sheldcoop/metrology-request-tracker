/**
 * Metrology Request Tracker - views/hirata.js
 *
 * Hirata tools (#/hirata, DECISIONS H-1..H-3): Prince's Hirata tool inside
 * the app, for anyone - put a code in and check it; nothing is saved.
 *   Read a panel   tap the dots you see on the panel (or type the digits):
 *                  the full code, field by field, and the copper panel.
 *   Find a pattern type codes - the last 4 digits (lot per day + panel) or
 *                  the full 9 - and see each as the copper panel it is
 *                  drilled into. Print them to hold against the real panels.
 * #/hirata/find?q=3407,0119 opens Find a pattern with those codes.
 * The rules are in domain.js (hirata*); the drawings in ui/hirata.js.
 */
window.MRT = window.MRT || {};
window.MRT.views = window.MRT.views || {};
window.MRT.views.hirata = (function () {
  'use strict';

  var ui = window.MRT.ui;
  var D = window.MRT.domain;

  var state = { tab: 'read', read: '', find: '' };

  /** The copper panel of a code (shared with the request pages). */
  function copper(digits, size) {
    return ui.copperPanel({ columns: String(digits).split('').map(D.hirataDots), text: digits, size: size || 'md',
                            label: 'Hirata pattern ' + String(digits).split('').join(' ') });
  }

  function render(main, ctx) {
    var parts = (ctx.subpath || '').split('/');
    if (parts[0] === 'find' || parts[0] === 'read') state.tab = parts[0];
    if (ctx.query) { state.tab = 'find'; state.find = ctx.query; }

    main.appendChild(ui.pageHead('Hirata tools', 'Put a Hirata code in and check it - nothing is saved', ui.el('div', { class: 'head-actions' }, [
      ui.button('Print', { icon: 'download', onClick: function () { window.print(); } })
    ])));
    var body = ui.el('div', { class: 'tab-body' });
    var bar = ui.tabs([{ key: 'read', label: 'Read a panel', icon: 'hirata' }, { key: 'find', label: 'Find a pattern', icon: 'search' }], function (k) {
      state.tab = k; history.replaceState(null, '', '#/hirata/' + k); draw();
    });
    bar.setActive(state.tab);
    main.appendChild(bar.node);
    main.appendChild(body);
    function draw() { ui.clear(body); (state.tab === 'find' ? findTab : readTab)(body); ui.linkLabels(body); }
    draw();
  }

  /* --- Read a panel ------------------------------------------------------ */

  function readTab(body) {
    var serial = ui.el('div', { class: 'hirata-serial', 'aria-live': 'polite' });
    var fieldsHost = ui.el('div');
    var panelHost = ui.el('div', { class: 'hirata-sheet' });
    var status = ui.el('p', { class: 'muted', 'aria-live': 'polite' });
    var typed = ui.field({ label: 'Or type the digits', mono: true, value: state.read, placeholder: 'e.g. 161234507',
                           hint: 'The full code has 9 digits; the grid shows what you type.' });
    var grid = ui.hirataGrid({
      fields: D.HIRATA_FIELDS, weights: D.HIRATA_WEIGHTS, canSet: D.hirataCanSet, digitOf: D.hirataDigit,
      digits: state.read, label: 'Hirata code grid: tap the dots you see on the panel',
      onChange: function (d) { state.read = d; typed.input.value = d; typed.setState(null); show(); },
      onBlocked: function (col) { status.textContent = 'Column ' + col + ' cannot go above 9 - that dot is not possible there.'; }
    });
    typed.input.addEventListener('input', function () {
      var c = D.hirataCheck(typed.value());
      typed.setState(c.problem ? 'invalid' : null, c.problem);
      if (c.problem) return;
      state.read = c.digits;
      grid.set(c.digits);
      show();
    });
    function show() {
      var d = state.read;             // 9 digits from the grid, or as many as were typed
      var any = /[1-9]/.test(d);
      serial.textContent = any ? d.split('').join(' ') : 'No dots set yet';
      serial.classList.toggle('muted', !any);
      status.textContent = any ? (d.length === D.HIRATA_LENGTH ? 'Full code read.' : 'Partly read - ' + d.length + ' of ' + D.HIRATA_LENGTH + ' digits.') : 'Tap a dot to start.';
      ui.mount(fieldsHost, any ? ui.hirataFields(D.hirataFields(d)) : null);
      ui.mount(panelHost, any ? ui.el('div', { class: 'hirata-item' }, [copper(d.slice(-D.HIRATA_TAIL), 'lg'),
        ui.el('span', { class: 'muted', text: 'The last 4 digits - lot per day and panel - as drilled into the panel' })]) : null);
    }
    show();

    body.appendChild(ui.panel({ title: 'Code grid', icon: 'hirata', body: [
      ui.el('p', { class: 'muted', text: 'Tap the dots you see on the panel. The first column (all five dots) shows which way round the code is; the bottom row is always there.' }),
      grid.node, status, typed.node,
      ui.el('div', { class: 'form-actions' }, [
        ui.button('Clear', { icon: 'close', onClick: function () { state.read = ''; typed.input.value = ''; grid.clear(); show(); } }),
        ui.button('Copy digits', { icon: 'copy', onClick: function () { if (/[1-9]/.test(state.read)) ui.copyText(state.read, 'Digits copied'); } })
      ])
    ] }).node);
    body.appendChild(ui.panel({ title: 'Decoded', icon: 'check', body: [serial, fieldsHost] }).node);
    body.appendChild(ui.panel({ title: 'On the panel', icon: 'lots', body: panelHost }).node);
    body.appendChild(legend());
  }

  function legend() {
    return ui.panel({ title: 'Reading the code', icon: 'info', body: ui.el('ul', { class: 'help-tips' }, [
      'Each column is one digit: add the weights of its dots, 8 + 4 + 2 + 1.',
      'No digit is above 9 - a dot that would go higher is locked.',
      'The bottom dot of every column is the baseline: always there, worth nothing.',
      'The code starts with a column of all five dots; it sets the orientation.',
      '9 digits: Supplier 1, Year 1, Week 2, Day 1, Lot per day 2, Panel 2.'
    ].map(function (t) { return ui.el('li', {}, [ui.icon('info', 14), ui.el('span', { text: t })]); })) }).node;
  }

  /* --- Find a pattern ----------------------------------------------------- */

  function findTab(body) {
    var input = ui.field({ label: 'Hirata codes', mono: true, value: state.find, placeholder: 'e.g. 3407, 0119, 1827',
      hint: 'The last 4 digits (lot per day + panel), or the full 9. Several at once: commas or spaces.' });
    var sheet = ui.el('div', { class: 'hirata-sheet', 'aria-live': 'polite' });
    var count = ui.el('p', { class: 'muted' });
    var problems = ui.el('div');
    function draw() {
      state.find = input.value();
      var list = D.hirataList(state.find);
      var ok = list.filter(function (x) { return !x.problem; }), bad = list.filter(function (x) { return x.problem; });
      ui.mount(problems, bad.length ? ui.el('p', { class: 'form-error', role: 'alert', text: 'Skipped: ' + bad.map(function (x) { return '"' + x.digits + '" (' + x.problem.toLowerCase() + ')'; }).join(', ') }) : null);
      count.textContent = ok.length ? ok.length + ' pattern' + (ok.length === 1 ? '' : 's') : '';
      ui.mount(sheet, ok.length ? ok.map(function (x) {
        return ui.el('div', { class: 'hirata-item' }, [copper(x.digits, 'lg'), ui.el('div', { class: 'mono', text: x.digits }),
          ui.hirataFields(D.hirataFields(x.digits), { compact: true }),
          x.kind === 'short' ? ui.el('span', { class: 'muted', text: '4 digits (lot + panel) match the drilled pattern' }) : null]);
      }) : ui.emptyState({ icon: 'hirata', title: 'Type one or more codes', text: 'Each is drawn as the copper panel it is drilled into.' }));
    }
    input.input.addEventListener('input', draw);
    body.appendChild(ui.panel({ title: 'Codes', icon: 'search', body: [input.node, problems] }).node);
    body.appendChild(ui.panel({ title: 'Patterns', icon: 'hirata', actions: [count], body: sheet }).node);
    body.appendChild(ui.panel({ title: 'Reference: the digits 0-9', icon: 'info', body: ui.el('div', { class: 'hirata-ref' },
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (d) {
        return ui.el('div', { class: 'hirata-ref-item' }, [ui.copperPanel({ columns: [D.hirataDots(d)], size: 'sm', label: 'Digit ' + d }),
          ui.el('b', { text: String(d) }), ui.el('span', { text: D.HIRATA_WEIGHTS.map(function (w) { return (d & w) ? '1' : '0'; }).join('') })]);
      })) }).node);
    draw();
  }

  /**
   * The panels of a request as copper panels with their decoded fields
   * (request page, slip - H-3). ids: Hirata IDs; size 'md' or 'sm'.
   */
  function panelsView(ids, size) {
    var list = (ids || []).filter(function (id) { return !D.hirataCheck(id).problem; });
    if (!list.length) return null;
    return ui.el('div', { class: 'panel-hirata' }, list.map(function (id) {
      return ui.el('div', { class: 'panel-hirata-item' }, [copper(id, size || 'md'), ui.el('div', {}, [
        ui.el('div', { class: 'mono', text: id }), ui.hirataFields(D.hirataFields(id), { compact: true })])]);
    }));
  }

  return { render: render, copper: copper, panelsView: panelsView };
})();
