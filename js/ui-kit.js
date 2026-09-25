/**
 * Metrology Request Tracker - ui-kit.js  (pattern from ABF Tracker v2)
 *
 * Builds ui-kit.html: every component of js/ui/*.js in every state, in one
 * theme or all three side by side, plus a live WCAG contrast table. Mock
 * data only; nothing here touches the store. A new component goes here
 * (all its states) when it is added to js/ui/ (CONTRIBUTING.md).
 *
 *   ui-kit.html?mode=light | dark | hc | all     ?motion=reduce     ?s=3-5 (sections 3..5)
 */
(function () {
  'use strict';

  var ui = window.MRT.ui;
  var el = ui.el;
  var THEMES = [['dark', 'Dark'], ['light', 'Light'], ['hc', 'High contrast']];
  var STATUSES = ['ok', 'warning', 'critical', 'expired', 'blocked'];
  var KEY = 'mrt.kit.';

  function section(title, children, note) {
    return el('section', { class: 'kit-sec' }, [el('h2', { text: title }), note ? el('p', { class: 'kit-note', text: note }) : null, children]);
  }
  function labelled(label, node) { return el('div', {}, [el('div', { class: 'kit-label', text: label }), node]); }
  function note(text) { return el('p', { class: 'kit-note', style: { margin: 0 }, text: text }); }

  /* --- Tokens + contrast -------------------------------------------- */

  function tokens() {
    var names = ['bg', 'surface', 'surface-2', 'surface-3', 'inset', 'accent', 'ok', 'warning', 'critical',
                 'expired', 'blocked', 'danger', 'c-blue', 'c-teal', 'c-pink'];
    return el('div', { class: 'kit-grid tight' }, names.map(function (n) {
      return el('div', { class: 'kit-swatch' }, [el('i', { style: { background: 'var(--' + n + ')' } }), el('code', { text: '--' + n })]);
    }));
  }

  function parseRgb(s) {
    var m = String(s).match(/rgba?\(([^)]+)\)/);
    if (!m) return [128, 128, 128, 1];
    var p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  function over(a, b) { return [0, 1, 2].map(function (i) { return a[i] * a[3] + b[i] * (1 - a[3]); }).concat(1); }
  function lum(c) {
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }
  function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

  /** Reads the real computed tokens of each theme, so the table cannot drift from the CSS. */
  function contrastTable() {
    var pairs = [
      ['fg', 'surface', 'Body text'], ['fg-muted', 'surface', 'Muted text'], ['fg-faint', 'surface-2', 'Faint text'],
      ['fg', 'inset', 'Field text'], ['accent', 'surface', 'Accent / link'], ['accent-fg', 'accent', 'Primary button'],
      ['on-danger', 'danger', 'Danger hover'], ['danger-fg', 'danger-bg', 'Error message'],
      ['ok-fg', 'ok-bg', 'OK chip'], ['warning-fg', 'warning-bg', 'Warning chip / Sample tag'],
      ['critical-fg', 'critical-bg', 'Critical chip'], ['expired-fg', 'expired-bg', 'Expired chip'],
      ['blocked-fg', 'blocked-bg', 'Blocked chip'],
      ['c-blue', 'surface', 'Chart blue'], ['c-teal', 'surface', 'Chart teal'], ['c-pink', 'surface', 'Chart pink']
    ];
    var probes = THEMES.map(function (t) {
      var host = el('div', { 'data-theme': t[0], style: { position: 'absolute', visibility: 'hidden' } });
      document.body.appendChild(host);
      return host;
    });
    function read(host, name) {
      var p = el('i', { style: { color: 'var(--' + name + ')' } });
      host.appendChild(p);
      var c = parseRgb(getComputedStyle(p).color);
      host.removeChild(p);
      return c;
    }
    var rows = pairs.map(function (pr) {
      return el('tr', {}, [el('td', { text: pr[2] }), el('td', { class: 'mono', text: pr[0] + ' / ' + pr[1] })].concat(probes.map(function (host) {
        var bg = read(host, pr[1]);
        if (bg[3] < 1) bg = over(bg, read(host, 'surface'));
        var fg = read(host, pr[0]);
        if (fg[3] < 1) fg = over(fg, bg);
        var r = ratio(fg, bg);
        return el('td', { class: 'num' }, el('span', { class: r >= 4.5 ? 'pass' : 'fail', text: r.toFixed(2) + (r >= 4.5 ? ' AA' : ' FAIL') }));
      })));
    });
    probes.forEach(function (h) { h.parentNode.removeChild(h); });
    return el('div', { class: 'table-wrap' }, el('table', { class: 'grid kit-contrast' }, [
      el('thead', {}, el('tr', {}, [el('th', { text: 'Use' }), el('th', { text: 'Tokens' })]
        .concat(THEMES.map(function (t) { return el('th', { class: 'num', text: t[1] }); })))),
      el('tbody', {}, rows)
    ]));
  }

  /* --- Typography, panels, LEDs -------------------------------------- */

  function typography() {
    return el('div', { class: 'kit-grid' }, [
      el('div', {}, [el('h1', { text: 'Page title 22' }), el('h2', { text: 'Section 16' }),
        el('p', { class: 'muted', text: 'Body 14 in Segoe UI Variable; muted text for secondary lines.' }),
        el('p', { class: 'fine', text: 'Fine print 12 for notes under a panel.' })]),
      el('div', {}, [el('div', { class: 'tool-code mono', text: 'FIB-260924-03' }),
        el('div', { class: 'mono muted', text: '0123456789  12.5 µm  \\\\srv\\lab\\FIB\\2026' })])
    ]);
  }

  function panels() {
    function demo(title, o, cls) {
      return ui.panel({ title: title, icon: o.icon || 'gauge', status: o.status, glow: o.glow, cls: cls, actions: o.actions,
        body: el('p', { class: 'muted', style: { margin: 0 }, text: o.text }) }).node;
    }
    return el('div', { class: 'kit-grid' }, [
      demo('Default', { text: 'Title bar, icon, corner brackets.' }),
      demo('Selected', { text: 'Accent border, stays on.' }, 'is-selected'),
      demo('With OK LED', { status: 'ok', text: 'Steady LED.' }),
      demo('Critical', { status: 'critical', glow: true, icon: 'alert', text: 'Pulsing LED, orange glow.' }),
      demo('Expired', { status: 'expired', glow: true, icon: 'clock', text: 'Red glow, pulsing LED.' }),
      demo('Interactive', { text: 'Hover me.', actions: [ui.button('', { kind: 'ghost', icon: 'refresh', ariaLabel: 'Refresh', size: 'sm' })] }, 'is-interactive')
    ]);
  }

  function leds() {
    return el('div', { class: 'kit-row' }, STATUSES.map(function (s) {
      return el('span', { class: 'kit-row', style: { margin: 0, gap: '8px', fontSize: '13px' } }, [ui.led(s, ui.STATUS_LABEL[s]), ui.STATUS_LABEL[s]]);
    }));
  }

  /* --- Buttons, choices, fields, form -------------------------------- */

  function buttons() {
    var kinds = [['primary', 'Save'], [null, 'Edit'], ['ghost', 'Cancel'], ['danger', 'Restore']];
    var states = [['Default', ''], ['Hover', 'is-hover'], ['Pressed', 'is-active'], ['Focus', 'is-focus'], ['Disabled', 'disabled']];
    var rows = states.map(function (st) {
      return labelled(st[0], el('div', { class: 'kit-row' }, kinds.map(function (k) {
        return ui.button(k[1], { kind: k[0], icon: k[0] === 'primary' ? 'check' : k[0] === 'danger' ? 'restore' : k[0] ? null : 'edit',
                                 disabled: st[1] === 'disabled', cls: st[1] !== 'disabled' ? st[1] : '' });
      })));
    });
    rows.push(labelled('Sizes, busy, icon buttons, row actions', el('div', { class: 'kit-row' }, [
      ui.button('Small', { size: 'sm' }), ui.button('Large', { kind: 'primary', size: 'lg', icon: 'plus' }),
      ui.button('Saving', { kind: 'primary', cls: 'is-busy' }),
      el('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Refresh' }, ui.icon('refresh', 18)),
      el('button', { class: 'btn-icon is-on', type: 'button', 'aria-label': 'Filter on', 'aria-pressed': 'true' }, ui.icon('filter', 18)),
      el('span', { class: 'row-actions' }, [
        ui.button('', { kind: 'ghost', size: 'sm', icon: 'edit', ariaLabel: 'Edit' }),
        ui.button('', { kind: 'ghost', size: 'sm', icon: 'copy', ariaLabel: 'Copy path' }),
        ui.button('', { kind: 'ghost', size: 'sm', icon: 'trash', ariaLabel: 'Delete' })])
    ])));
    return el('div', {}, rows);
  }

  function choices() {
    return el('div', { class: 'kit-grid' }, [
      labelled('Segmented: tool status', ui.segmented({ label: 'Status', value: 'up', options: [
        { value: 'up', label: 'Up' }, { value: 'maintenance', label: 'Maintenance' }, { value: 'down', label: 'Down' }] }).node),
      labelled('Segmented with icons + disabled option', ui.segmented({ label: 'Theme', value: 'dark', options: [
        { value: 'dark', label: 'Dark', icon: 'moon' }, { value: 'light', label: 'Light', icon: 'sun' }, { value: 'x', label: 'Disabled', disabled: true }] }).node),
      labelled('Checkboxes', el('div', { class: 'kit-row' }, [
        ui.toggle({ label: 'Required', checked: true }).node, ui.toggle({ label: 'Active' }).node, ui.toggle({ label: 'Disabled', disabled: true }).node])),
      labelled('Switches', el('div', { class: 'kit-row' }, [
        ui.toggle({ kind: 'switch', label: 'Reduce motion' }).node, ui.toggle({ kind: 'switch', label: 'Live', checked: true }).node]))
    ]);
  }

  function fields() {
    var f = [];
    f.push(ui.field({ label: 'Cut depth', type: 'number', unit: 'µm', value: '12.5', hint: 'Target depth of the FIB cut' }).node);
    var ok = ui.field({ label: 'Tool code', value: 'FIB', mono: true }); ok.setState('valid', 'Free');
    f.push(labelled('Valid', ok.node));
    var bad = ui.field({ label: 'Results root', value: 'results', mono: true }); bad.setState('invalid', 'A share path like \\\\server\\share\\...');
    f.push(labelled('Invalid', bad.node));
    f.push(labelled('Disabled', ui.field({ label: 'Request ID', value: 'FIB-260924-03', mono: true, disabled: true }).node));
    f.push(labelled('Select', ui.field({ label: 'Measurement type', value: 'b', options: [{ value: 'a', label: 'Via cross-section' }, { value: 'b', label: 'Layer thickness' }] }).node));
    f.push(labelled('Date', ui.field({ label: 'Needed by', type: 'date', value: '2026-10-02' }).node));
    f.push(labelled('Multiline', ui.field({ label: 'Purpose', multiline: true, placeholder: 'What should be measured, and why?' }).node));
    var live = ui.field({ label: 'Try me: 0 - 50', type: 'number', unit: 'µm', hint: 'Type a value' });
    live.input.addEventListener('input', function () {
      var v = parseFloat(live.input.value);
      if (live.input.value === '') live.setState(null);
      else if (!isFinite(v) || v < 0 || v > 50) live.setState('invalid', 'Must be 0 - 50 µm');
      else live.setState('valid', 'OK');
    });
    f.push(labelled('Live validation', live.node));
    return el('div', { class: 'kit-grid' }, f);
  }

  function formDemo() {
    var f = ui.form([
      { key: 'label', label: 'Label', kind: 'text', placeholder: 'e.g. Cut side' },
      { key: 'type', label: 'Type', kind: 'select', cls: 'half', options: [{ value: 'number', label: 'Number' }, { value: 'choice', label: 'One choice' }] },
      { key: 'required', label: 'Required', kind: 'check', cls: 'half' },
      { key: 'unit', label: 'Unit', kind: 'text', cls: 'half', showIf: function (v) { return v.type === 'number'; } },
      { key: 'max', label: 'Max', kind: 'number', cls: 'half', showIf: function (v) { return v.type === 'number'; } },
      { key: 'choices', label: 'Choices, one per line', kind: 'longtext', showIf: function (v) { return v.type === 'choice'; } },
      { key: 'days', label: 'Lab days', kind: 'checks', options: [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun']]
          .map(function (d) { return { value: d[0], label: d[1] }; }) }
    ], { type: 'number', unit: 'µm', days: [1, 2, 3, 4, 5] });
    var out = el('pre', { class: 'mono kit-note', style: { whiteSpace: 'pre-wrap' } });
    return el('div', { class: 'kit-grid' }, [
      el('div', { class: 'panel' }, el('div', { class: 'panel-body' }, f.node)),
      el('div', {}, [ui.button('Read values', { size: 'sm', onClick: function () { out.textContent = JSON.stringify(f.values(), null, 1); } }),
        ui.button('Show an error', { size: 'sm', onClick: function () { f.setError('label', 'Enter a label'); } }), out])
    ]);
  }

  /* --- Chips, tags, KPI tiles ----------------------------------------- */

  function chips() {
    return el('div', {}, [
      el('div', { class: 'kit-row' }, STATUSES.map(function (s) { return ui.statusChip(s); }).concat([ui.statusChip('neutral')])),
      el('div', { class: 'kit-row' }, [
        el('span', { class: 'chip ok', text: 'Up' }), el('span', { class: 'chip warning', text: 'Maintenance' }), el('span', { class: 'chip expired', text: 'Down' }),
        el('span', { class: 'chip neutral', text: 'you' }), el('span', { class: 'chip warning', text: 'New' }), el('span', { class: 'chip accent-chip', text: 'Admin' }),
        el('span', { class: 'sample-tag', text: 'Sample' })]),
      el('p', { class: 'setup-note' }, [ui.icon('info', 14), el('span', { text: 'Setup note: something is not confirmed yet.' })])
    ]);
  }

  function kpis() {
    var host = el('div', { class: 'kit-grid tight' });
    function paint() {
      ui.mount(host, [
        ui.kpiTile({ label: 'Up', value: 4, status: 'ok', icon: 'check' }).node,
        ui.kpiTile({ label: 'Maintenance', value: 1, status: 'warning', icon: 'wrench', sub: 'until 02.10.2026' }).node,
        ui.kpiTile({ label: 'Down', value: 0, status: 'expired', icon: 'alert', sub: 'zero is calm' }).node,
        ui.kpiTile({ label: 'Open requests', value: 1043, icon: 'requests', sub: 'from M3' }).node,
        ui.kpiTile({ label: 'Line stop', value: 3, status: 'critical', icon: 'alert' }).node
      ]);
      ui.stagger(host);
    }
    paint();
    return el('div', {}, [host, el('div', { class: 'kit-row', style: { marginTop: '12px' } }, [ui.button('Replay count-up', { icon: 'refresh', size: 'sm', onClick: paint })])]);
  }

  /* --- Tool glyphs ---------------------------------------------------- */

  function glyphs() {
    var states = [['idle', 'Up (idle)'], ['live', 'Working (P1: parts move)'], ['maint', 'Maintenance'], ['off', 'Down (lamp blinks)']];
    return el('div', {}, [
      el('div', { class: 'kit-glyphs' }, [
        el('span'),
        states.map(function (s) { return el('span', { class: 'kit-label', text: s[1] }); }),
        ui.GLYPHS.map(function (g) {       // el() flattens nested arrays: one row per glyph
          return [el('span', { class: 'kit-label', text: g.label })].concat(states.map(function (s) {
            return el('span', { class: 'kit-glyph-cell' }, ui.toolGlyph(g.key, { size: 48, state: s[0], label: g.label + ', ' + s[1] }));
          }));
        })
      ]),
      note('Working (P1): FIB beam rasters and the cross-section face mills open; QVM crosshair locks onto the pad edge and the measuring line snaps; ' +
           'PRF stylus glides over the step and draws the profile; HRM probe taps while the surface slides; AOI scan frame sweeps, defect boxes blink. ' +
           'With Reduce motion each shows its last frame. Sizes: 18 (search), 24 (queue), 28 (Settings table), 40 (gate), 56 (Lab status nameplate).'),
      el('div', { class: 'kit-row', style: { marginTop: '8px' } }, ui.GLYPHS.map(function (g) { return ui.toolGlyph(g.key, { size: 96, state: 'live', label: g.label + ', working' }); })),
      el('div', { class: 'kit-row', style: { marginTop: '8px' } }, [18, 28, 40, 56, 72].map(function (n) { return ui.toolGlyph('fib', { size: n }); }))
    ]);
  }

  /* --- Charts, heatmap, table, tabs ----------------------------------- */

  function charts() {
    var weeks = []; for (var w = 0; w < 12; w++) weeks.push('W' + (27 + w));
    var tools = [['HRM', [5, 7, 4, 9, 6, 8, 7, 5, 9, 6, 8, 7]], ['FIB', [3, 4, 6, 2, 5, 4, 7, 6, 3, 5, 6, 4]], ['QVM', [8, 6, 9, 7, 10, 8, 6, 9, 11, 7, 9, 10]]];
    function pick(what) { return function (i, ds) { ui.toast({ message: 'Would open ' + what(i, ds) }); }; }
    var perWeek = ui.chart(function (t) {
      return { type: 'bar', data: { labels: weeks, datasets: tools.map(function (p, i) {
        var c = t.series(i);
        return { label: p[0], data: p[1], stack: 'r', backgroundColor: ui.chartGradient(t, c, .95, .45), hoverBackgroundColor: t.color(c), tipColor: t.color(c) };
      }) }, options: { scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'requests' } } } } };
    }, { height: 240, label: 'Requests per week by tool (example)', onPick: pick(function (i, ds) { return tools[ds][0] + ', ' + weeks[i]; }) });
    var tat = ui.chart(function (t) {
      var med = [18, 22, 16, 25, 20, 19, 17, 21, 23, 18, 16, 19];
      return { type: 'line', data: { labels: weeks, datasets: [
        { label: 'Median turnaround', data: med, borderColor: t.color('accent'), backgroundColor: ui.chartGradient(t, 'accent', .28, 0), fill: 'origin', tipColor: t.color('accent') },
        { label: 'Target', data: weeks.map(function () { return 24; }), borderColor: t.alpha('ok', .7), borderDash: [5, 5], borderWidth: 1, pointRadius: 0, tension: 0 }
      ] }, options: { scales: { y: { beginAtZero: true, title: { display: true, text: 'working hours' } }, x: { grid: { display: false } } } } };
    }, { height: 240, label: 'Turnaround (example)', expand: true, format: function (v) { return v + ' h'; } });
    function box(title, iconName, c, sub) { return ui.panel({ title: title, icon: iconName, body: [sub ? note(sub) : null, c.node] }).node; }
    return el('div', {}, [
      ui.hasChartJs() ? null : note('vendor/chart.umd.min.js was not found, so each chart shows the notice below.'),
      el('div', { class: 'kit-grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))' } }, [
        box('Requests per week', 'chart', perWeek, 'Stacked by tool, gradient fill. Click a bar.'),
        box('Turnaround', 'clock', tat, 'Draws in point by point; full-screen button top right.')
      ])
    ]);
  }

  function travellerDemo() {
    var PRIOS = [null, { name: 'Line stop', code: 'P1' }, { name: 'Hot', code: 'P2' }, { name: 'Normal', code: 'P3' }, { name: 'Low', code: 'P4' }];
    var STAMPS = [['Submitted', 'neutral'], ['Accepted', 'accent'], ['In progress', 'ok'], ['On hold', 'warning'], ['Completed', 'ok'], ['Cancelled', 'neutral']];
    function facts(level) {
      return [
        { label: 'Lot', value: [el('b', { class: 'mono', text: '18178' }), el('span', { class: 'muted', text: '  C4F · BU-02' })] },
        { label: 'Priority', value: el('span', { class: 'tr-prio' }, [el('b', { text: PRIOS[level].name }), el('span', { class: 'mono muted', text: PRIOS[level].code })]) },
        { label: 'Needed by', value: el('b', { class: 'num', text: '02.10.2026' }), extra: el('div', { class: 'tr-clock ' + (level === 1 ? 'is-late' : 'is-ok'), text: level === 1 ? 'Late by 3 h lab time' : '14 h lab time left (2 days)' }) },
        { label: 'Panels', value: el('b', { class: 'mono', text: '3252, 3253  (2)' }), sub: 'layer 2F · M70345 slots 3-4' },
        { label: 'Assigned to', value: 'Olga Berger' }
      ];
    }
    var fulls = [1, 2, 3, 4].map(function (lv, i) {
      return labelled('Full, ' + PRIOS[lv].name + ', ' + STAMPS[i + (lv === 4 ? 1 : 0)][0], ui.traveller({ id: 'FIB-260925-0' + lv, subtitle: 'FIB  ·  Via cross-section',
        glyph: { key: 'fib', state: lv === 2 ? 'live' : 'idle', label: 'FIB' }, level: lv, urgent: lv === 1,
        stamp: { label: STAMPS[i + (lv === 4 ? 1 : 0)][0], kind: STAMPS[i + (lv === 4 ? 1 : 0)][1] }, fields: facts(lv) }, { size: 'full' }));
    });
    var more = [
      labelled('Full, on hold', ui.traveller({ id: 'QVM-260925-01', subtitle: 'QVM  ·  Via diameter', glyph: { key: 'qvm', state: 'idle', label: 'QVM' }, level: 3,
        stamp: { label: 'On hold', kind: 'warning' }, fields: [{ label: 'On hold', value: 'Waiting for panels', sub: 'magazine still in the line' }] }, { size: 'full' })),
      labelled('Mini (form preview, no tool yet)', ui.traveller({ id: 'Pick a tool', subtitle: 'measurement type', icon: 'request_new', level: 3,
        fields: [{ label: 'Lot', value: '-', cls: 'mono' }, { label: 'BKM', value: el('span', { class: 'chip warning', text: 'No BKM' }) }] }, { size: 'mini' })),
      labelled('Mini (form preview)', ui.traveller({ id: 'FIB-YYMMDD-NN', subtitle: 'Via cross-section', glyph: { key: 'fib' }, level: 2, prio: PRIOS[2],
        fields: [{ label: 'Lot', value: '18178', cls: 'mono' }, { label: 'Panels', value: '3252, 3253', cls: 'mono' }, { label: 'Needed by', value: '2026-10-02', cls: 'num' }] }, { size: 'mini' })),
      labelled('Board cards: Line stop, late, on hold', el('div', { class: 'kit-row' }, [
        ui.traveller({ id: 'FIB-260925-01', level: 1, urgent: true, prio: PRIOS[1], href: '#', lines: [['18178  ·  3252, 3253'], [el('span', { class: 'q-clock', text: '5 h left' })]] }, { size: 'card' }),
        ui.traveller({ id: 'HRM-260925-02', level: 3, late: true, prio: PRIOS[3], href: '#', lines: [['18180  ·  2 panels'], [el('span', { class: 'q-clock', text: 'late 1 d' })]] }, { size: 'card' }),
        ui.traveller({ id: 'PRF-260925-01', level: 4, prio: PRIOS[4], href: '#', lines: [['19189  ·  23'], [el('span', { class: 'chip warning', text: 'On hold' })]] }, { size: 'card' })
      ])),
      labelled('Slip (print)', ui.traveller({ id: 'FIB-260925-01', level: 1, prio: PRIOS[1], glyph: { key: 'fib' },
        code: ui.code128 ? ui.code128('FIB-260925-01', { height: 44, module: 2, label: 'FIB-260925-01' }) : null,
        fields: [{ label: 'Tool', value: 'FIB - Via cross-section' }, { label: 'Lot', value: '18178  C4F · BU-02' }, { label: 'Panels', value: '3252, 3253  (2)', cls: 'wide' }, { label: 'Needed by', value: '2026-10-02' }],
        warn: 'FIB DESTROYS THESE PANELS - confirmed by the requester' }, { size: 'slip' }))
    ];
    return el('div', { class: 'kit-grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))' } }, fulls.concat(more));
  }

  function panelMapDemo() {
    var D = window.MRT.domain;
    var out = el('div', { class: 'kit-note', style: { margin: 0 } });
    var pick = ui.panelMap({ count: 12, selected: [1, 2, 3, 4, 5, 12], label: 'Pick panels (12-panel lot)', parse: D.parsePanels, format: D.formatPanels,
      onChange: function (l) { out.textContent = 'onChange: [' + l.join(', ') + ']'; } });
    var bad = ui.panelMap({ count: 8, label: 'Error state', parse: D.parsePanels, format: D.formatPanels });
    bad.setError('Pick at least one panel');
    return el('div', { class: 'kit-grid' }, [
      labelled('Pick: click, Shift+click a run, arrows + Space, or type "1-5, 12"', el('div', {}, [pick.node, out])),
      labelled('Nothing picked, with an error', bad.node),
      labelled('A 48-panel lot', ui.panelMap({ count: 48, selected: [1, 2, 3, 13, 14, 15, 25, 26, 27], label: 'Panels', parse: D.parsePanels, format: D.formatPanels }).node),
      labelled('Read-only with marks (request page)', ui.panelMap({ count: 12, readOnly: true, label: 'Panels of FIB-260924-03',
        marks: { 1: 'measured', 2: 'measured', 3: 'scrapped', 4: 'received', 5: 'received' } }).node)
    ]);
  }

  function heatDemo() {
    var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], hours = [];
    for (var h = 6; h < 20; h++) hours.push((h < 10 ? '0' : '') + h);
    var values = days.map(function (d, r) {
      return hours.map(function (x, c) { return r > 4 ? 0 : Math.round(3 * (1 + Math.sin(c / 13 * Math.PI)) + (r * 7 + c) % 3); });
    });
    return ui.heatmap({ rows: days, cols: hours, values: values, colLabelEvery: 2, unit: 'Requests', label: 'Example: requests by weekday and hour' });
  }

  function table() {
    var rows = [['FIB', 'FIB', 'maintenance', 'Olga Quality'], ['QVM', 'QVM (vision measuring)', 'up', 'Otto Quality'],
                ['PRF', 'PRF (profilometer)', 'down', '-'], ['HRM', 'HRM (roughness)', 'up', 'Olga Quality']];
    var chip = { up: ['ok', 'Up'], maintenance: ['warning', 'Maintenance'], down: ['expired', 'Down'] };
    var tbody = el('tbody', {}, rows.map(function (r, i) {
      return el('tr', { class: i === 1 ? 'is-selected' : i === 2 ? 'is-off' : '' }, [
        el('td', {}, el('span', { class: 'cell-tool' }, [ui.toolGlyph(r[0].toLowerCase(), { size: 28 }), el('b', { class: 'mono', text: r[0] })])),
        el('td', { text: r[1] }), el('td', {}, el('span', { class: 'chip ' + chip[r[2]][0], text: chip[r[2]][1] })), el('td', { text: r[3] }),
        el('td', { class: 'actions' }, el('span', { class: 'row-actions' }, [ui.button('', { kind: 'ghost', size: 'sm', icon: 'edit', ariaLabel: 'Edit ' + r[0] })]))
      ]);
    }));
    return el('div', { class: 'table-wrap' }, el('table', { class: 'grid' }, [
      el('thead', {}, el('tr', {}, ['Tool', 'Name', 'Status', 'Primary QE', ''].map(function (h, i) { return el('th', { class: i === 4 ? 'actions' : null, text: h }); }))), tbody]));
  }

  function tabsDemo() {
    var content = el('div', { class: 'panel-body', style: { padding: '8px 0 0' } });
    var text = { health: 'Still to do, and data health.', people: 'Names, Windows IDs, roles.', tools: 'Tools, types, fields, BKMs.' };
    var t = ui.tabs([{ key: 'health', label: 'Health', icon: 'activity' }, { key: 'people', label: 'People', icon: 'users' }, { key: 'tools', label: 'Tools', icon: 'wrench' }],
      function (k) { ui.fadeSwap(content, el('p', { class: 'muted', style: { margin: 0 }, text: text[k] })); });
    ui.mount(content, el('p', { class: 'muted', style: { margin: 0 }, text: text.health }));
    return el('div', {}, [t.node, content, note('Keyboard: focus a tab, then Left / Right / Home / End.')]);
  }

  /* --- Overlays -------------------------------------------------------- */

  function overlays() {
    var slots = el('div', { class: 'kit-row' }, ['HRM', 'AOI', 'PRF', 'QVM', 'FIB'].map(function (c) {
      return el('button', { type: 'button', class: 'btn kit-tip', dataset: { tool: c }, text: c });
    }));
    ui.bindTips(slots, '.kit-tip', function (t) {
      return [el('div', { class: 'tip-title' }, [ui.led(t.dataset.tool === 'PRF' ? 'expired' : 'ok'), t.dataset.tool]),
              ui.tipRow('Status', t.dataset.tool === 'PRF' ? 'Down' : 'Up'), ui.tipRow('Queue', 'from M3')];
    });
    var menuBtn = el('button', { class: 'user-btn', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, [
      el('span', { class: 'user-avatar', text: 'PK' }), el('span', { class: 'user-name', text: 'Prince Khurana' }), ui.icon('chevron_down', 14)]);
    menuBtn.addEventListener('click', function () {
      ui.menu(menuBtn, [{ node: ui.toggle({ kind: 'switch', label: 'Reduce motion' }).node }, { sep: true },
        { label: 'Keyboard shortcuts', icon: 'keyboard', aside: '?' }, { label: 'Change data folder', icon: 'folder' }, { label: 'Change user', icon: 'user' }],
        [el('b', { text: 'Prince Khurana' }), el('span', { text: 'Admin' })]);
    });
    var tries = 0;
    return el('div', { class: 'kit-grid' }, [
      labelled('Dialogs', el('div', { class: 'kit-row' }, [
        ui.button('Status dialog', { kind: 'primary', icon: 'wrench', onClick: function () {
          ui.dialog({ title: 'FIB status', icon: 'wrench', body: el('div', {}, [
            ui.segmented({ label: 'Status', value: 'maintenance', options: [{ value: 'up', label: 'Up' }, { value: 'maintenance', label: 'Maintenance' }, { value: 'down', label: 'Down' }] }).node,
            el('div', { style: { height: '12px' } }), ui.field({ label: 'Until (optional)', type: 'date', value: '2026-10-02' }).node]),
            actions: [{ label: 'Cancel', value: null }, { label: 'Save', kind: 'primary', value: 'ok' }] });
        } }),
        ui.button('Save with an error', { onClick: function () {
          tries = 0;
          ui.dialog({ title: 'Add a tool', icon: 'wrench', body: ui.field({ label: 'Code', value: 'FIB', mono: true }).node,
            actions: [{ label: 'Cancel', value: null }, { label: 'Save', kind: 'primary', value: 'v', submit: function () {
              tries++;
              return new Promise(function (res, rej) { setTimeout(function () { if (tries === 1) rej(new Error('Tool code FIB is already used')); else res('v'); }, 500); });
            } }] });
        } }),
        ui.button('Confirm (danger)', { kind: 'danger', onClick: function () { ui.confirm({ title: 'Restore 23.09.2026?', message: 'Changes made since then are replaced.', danger: true, confirmLabel: 'Restore' }); } }),
        ui.button('Reason prompt', { onClick: function () { ui.promptReason({ message: 'Every delete needs a reason.' }); } })
      ])),
      labelled('Toasts and copy', el('div', { class: 'kit-row' }, [
        ui.button('Info', { size: 'sm', onClick: function () { ui.toast('Theme: Dark'); } }),
        ui.button('Success', { size: 'sm', onClick: function () { ui.toast({ kind: 'success', message: 'FIB is now Up.' }); } }),
        ui.button('Warning', { size: 'sm', onClick: function () { ui.toast({ kind: 'warning', message: 'QVM is in Maintenance until Friday.' }); } }),
        ui.button('Error', { size: 'sm', onClick: function () { ui.toast({ kind: 'error', message: 'The change could not be saved: the share is read-only.', actions: [{ label: 'Retry' }, { label: 'Download as file' }] }); } }),
        ui.button('Copy a path', { size: 'sm', icon: 'copy', onClick: function () { ui.copyText('\\\\srv\\lab\\FIB\\2026', 'Path copied'); } })
      ])),
      labelled('Tooltip card (hover or Tab to a tool)', slots),
      labelled('User menu', menuBtn)
    ]);
  }

  function loading() {
    return el('div', { class: 'kit-grid' }, [
      el('div', { class: 'panel' }, el('div', { class: 'panel-body' }, [
        el('div', { class: 'kit-row' }, [el('div', { class: 'skel circle' }), el('div', { style: { flex: 1 } }, ui.skeleton(2))]), ui.skeleton(4)])),
      el('div', { class: 'panel' }, ui.emptyState({ icon: 'wrench', title: 'No tools yet', text: 'An admin adds tools in Settings.', actionLabel: 'Add tool' })),
      el('div', { class: 'panel' }, ui.emptyState({ icon: 'inbox', title: 'My queue comes in M3', text: 'This page is part of a later milestone.' }))
    ]);
  }

  /* ------------------------------------------------------------------ */

  var sectionRange = (location.search.match(/[?&]s=(\d+)-(\d+)/) || []).slice(1).map(Number);

  function gallery() {
    var all = [
      section('Colour tokens', tokens()),
      section('Typography & numbers', typography()),
      section('Panels', panels()),
      section('Status LEDs', leds()),
      section('Buttons', buttons()),
      section('Choices: segmented, checkbox, switch', choices()),
      section('Instrument fields', fields()),
      section('Form (ui.form)', formDemo(), 'Field specs in, labelled controls out; "Unit" and "Max" show only for a Number, "Choices" only for One choice.'),
      section('Chips, tags, setup note', chips()),
      section('KPI tiles', kpis()),
      section('Tool glyphs', glyphs(), 'One drawing per tool: probe (HRM), camera (AOI), stylus (PRF), optics (QVM), ion column (FIB), reticle (any other).'),
      section('Charts (Chart.js, shared theme)', charts(), 'One theme config in js/ui/charts.js: token colours, gradients, draw-in, panel-style tooltip, full screen.'),
      section('Panel map (unused - kept for OPEN_QUESTIONS #22)', panelMapDemo(), 'No screen uses it since form v2 (Hirata IDs). Q6 / M2-2: map and text stay in sync; picked panels light up (opacity only). Read-only marks: measured, in the lab, scrapped.'),
      section('Traveller card (ui.traveller)', travellerDemo(), 'One drawing, four sizes: full (request page), mini (form preview), card (board), slip (print). Priority stripe per level; Line stop pulses while open.'),
      section('Magazine slots', el('div', { class: 'kit-grid' }, [
          labelled('Pick: press and drag over slots; slots 9-10 taken by another request', ui.magazineSlots({ magazine: { code: 'M70345', slots: 24 }, picked: [3, 4],
            labels: { 3: '3252', 4: '3253' }, taken: { 9: 'FIB-260924-01', 10: 'FIB-260924-01' } }).node),
          labelled('Read-only (traveller card)', ui.magazineSlots({ magazine: { code: 'M70346', slots: 24 }, picked: [1, 2, 3, 4], labels: { 1: '3100', 2: '3101', 3: '3102', 4: '3103' }, readOnly: true }).node),
          labelled('Empty', ui.magazineSlots({ magazine: { code: 'M70347', slots: 24 } }).node)
        ]), 'F-3: a PCB magazine from the front, one panel per slot, numbered from the top. A picked slot shows the panel with its Hirata ID. Arrows move, Space picks.'),
      section('Barcode (Code 128)', el('div', { class: 'kit-row' }, [ui.code128('FIB-260924-03', { height: 44 }), ui.code128('QVM-261231-12', { height: 30, module: 1 })]),
        'Drawn in js/ui/barcode.js, no vendor file. On the traveller slip; a hand scanner types the request ID into the search.'),
      section('Heatmap', heatDemo(), 'Strength is the opacity of a colour layer; hover or focus a cell for the card.'),
      section('Data table', table(), 'Sticky header, hover row, selected row, a hidden (off) row, row actions.'),
      section('Tabs', tabsDemo()),
      section('Dialog, toast, tooltip, menu', overlays(), '"Save with an error" fails once and shows why inside the dialog; the second Save works.'),
      section('Skeletons & empty states', loading())
    ];
    return sectionRange.length ? all.slice(sectionRange[0], sectionRange[1] + 1) : all;
  }

  var root = document.getElementById('kitRoot');
  var mode = 'dark';

  function render() {
    root.className = 'kit-root' + (mode === 'all' ? ' all' : '');
    if (mode === 'all') {
      document.documentElement.removeAttribute('data-theme');
      ui.mount(root, THEMES.map(function (t) {
        return el('div', { class: 'theme-scope', 'data-theme': t[0] }, [el('div', { class: 'kit-col-title', text: t[1] })].concat(gallery()));
      }));
    } else {
      document.documentElement.setAttribute('data-theme', mode);
      ui.mount(root, (sectionRange.length ? [] : [section('Contrast (WCAG AA, computed from the live tokens)', contrastTable())]).concat(gallery()));
    }
    ui.stagger(root);
    ui.linkLabels(root);
  }

  function setMotion(reduce) {
    if (reduce) document.documentElement.setAttribute('data-motion', 'reduce');
    else document.documentElement.removeAttribute('data-motion');
    try { localStorage.setItem(KEY + 'motion', reduce ? 'reduce' : 'full'); } catch (e) { /* private mode */ }
  }

  function bar() {
    var themeSeg = ui.segmented({ label: 'Theme', value: mode, options: [
      { value: 'dark', label: 'Dark', icon: 'moon' }, { value: 'light', label: 'Light', icon: 'sun' },
      { value: 'hc', label: 'High contrast', icon: 'contrast' }, { value: 'all', label: 'All three', icon: 'grid' }],
      onChange: function (v) { mode = v; try { localStorage.setItem(KEY + 'mode', v); } catch (e) { /* */ } render(); } });
    var reduce = document.documentElement.getAttribute('data-motion') === 'reduce';
    ui.mount(document.getElementById('kitBar'), [
      el('h1', {}, [ui.icon('logo', 20), el('span', { text: 'Metrology Request Tracker · UI kit' })]),
      el('div', { class: 'spacer' }),
      themeSeg.node,
      ui.toggle({ kind: 'switch', label: 'Reduce motion', checked: reduce, onChange: setMotion }).node,
      el('a', { class: 'btn btn-sm', href: 'index.html', text: 'Open app' })
    ]);
  }

  try {
    mode = localStorage.getItem(KEY + 'mode') || 'dark';
    var qm = (location.search.match(/[?&]mode=(\w+)/) || [])[1];
    if (qm) mode = qm;
    if (/[?&]motion=reduce/.test(location.search) || localStorage.getItem(KEY + 'motion') === 'reduce') {
      document.documentElement.setAttribute('data-motion', 'reduce');
    }
  } catch (e) { /* private mode */ }
  bar();
  render();
})();
