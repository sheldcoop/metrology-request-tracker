/**
 * tests/preview.js - dev only. Loaded by tests/preview.html (generated from
 * index.html by tests/make-preview.js - never edit preview.html by hand).
 *
 * The real app on demo data, in memory: no folder picker, nothing is
 * written to disk, changes are lost on reload. For looking at every page in
 * every theme, screenshots and the accessibility audit. No production code
 * knows about this file.
 *
 *   tests/preview.html                    Lab status as Prince (Admin + Engineer)
 *   tests/preview.html#/settings/tools    any page; Settings unlock by themselves (demo PIN 1234)
 *   ?as=quality | engineer | operator     sign in as Olga (Quality engineer), Erik, Mia instead
 *   ?theme=dark | light | hc              ?motion=reduce       ?empty=1  first run on an empty folder
 *   ?click=<css>                          click that element after load (open a dialog), URL-encoded
 *   ?audit=1                              run tests/a11y-audit.js after load (and after the click)
 *   ?fakechart=1                          a stand-in Chart.js that runs every chart config
 *   ?perf=1                               time each page render and the 1 s tick; "PERF ..." lines
 */
(function () {
  'use strict';

  var q = location.search;
  var MRT = window.MRT;
  var DEMO_PIN = '1234';
  var DAY = 86400000;

  var PEOPLE = {
    admin:    { id: 'usr_demo_prince', name: 'Prince Khurana', windows_id: 'pkhurana', roles: ['admin', 'engineer'] },
    quality:  { id: 'usr_demo_olga', name: 'Olga Berger', windows_id: 'oberger', roles: ['quality'] },
    quality2: { id: 'usr_demo_otto', name: 'Otto Huber', windows_id: 'ohuber', roles: ['quality', 'engineer'] },
    engineer: { id: 'usr_demo_erik', name: 'Erik Wagner', windows_id: 'ewagner', roles: ['engineer'] },
    newbie:   { id: 'usr_demo_nora', name: 'Nora Steiner', windows_id: 'nsteiner', roles: ['engineer'], self_added: true, needs_review: true },
    operator: { id: 'usr_demo_mia', name: 'Mia Gruber', windows_id: 'mgruber', roles: ['operator'] },
    manager:  { id: 'usr_demo_max', name: 'Max Leitner', windows_id: 'mleitner', roles: ['manager'], active: false }
  };

  function sha256(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }

  /** The demo file: seed.js + people + a few tool states, admin PIN 1234. */
  function demoFile() {
    var d = MRT.store._pure.seedData();
    var now = Date.now();
    d.users = Object.keys(PEOPLE).map(function (k) {
      var p = PEOPLE[k];
      return Object.assign({ domain: 'CORP', email: p.windows_id + '@example.com', active: true, self_added: false,
                             needs_review: false, created_ts: new Date(now - 30 * DAY).toISOString(), version: 1 }, p);
    });
    function tool(code) { return d.tools.filter(function (t) { return t.code === code; })[0]; }
    Object.assign(tool('FIB'), { status: 'maintenance', status_until: new Date(now + 3 * DAY).toISOString().slice(0, 10),
      status_note: 'Source change', primary_operator_id: PEOPLE.quality.id, backup_operator_id: PEOPLE.quality2.id, results_root: '\\\\srv\\lab\\FIB' });
    Object.assign(tool('PRF'), { status: 'down', status_until: null, status_note: 'Stylus broken - waiting for service', primary_operator_id: PEOPLE.quality2.id });
    Object.assign(tool('QVM'), { primary_operator_id: PEOPLE.quality.id, backup_operator_id: PEOPLE.quality2.id, results_root: '\\\\srv\\lab\\QVM' });
    d.tool_fields.push({ id: 'fld_demo_side', tool_id: tool('FIB').id, label: 'Cut side', type: 'choice', required: true, help: '',
      unit: '', min: null, max: null, choices: [{ id: 'ch_f', label: 'Front', active: true }, { id: 'ch_b', label: 'Back', active: true }],
      type_ids: [], active: true, sort: 1, version: 1 });
    d.audit_log.push({ id: 'aud_demo', ts: new Date(now - DAY).toISOString(), user_id: PEOPLE.admin.id, entity: 'tool', entity_id: tool('FIB').id,
      action: 'status', field: 'status', old_value: 'up', new_value: 'maintenance', reason: 'Source change' });
    // demo part numbers, process steps and lots (made up, preview only)
    function prj(code) { return d.projects.filter(function (p) { return p.code === code; })[0].id; }
    function bu(code) { return d.buildups.filter(function (b) { return b.code === code; })[0].id; }
    d.part_numbers = [
      { id: 'pn_demo_1', code: 'PN-DEMO-100', description: 'Demo board', project_ids: [prj('C4F')], active: true, version: 1 },
      { id: 'pn_demo_2', code: 'PN-DEMO-200', description: '', project_ids: [prj('SHIFT'), prj('HORUS')], active: true, version: 1 },
      { id: 'pn_demo_3', code: 'PN-DEMO-201', description: '', project_ids: [prj('SHIFT')], active: true, version: 1 }
    ];
    d.process_steps = ['After desmear', 'After Cu plating', 'After solder resist'].map(function (n, i) {
      return { id: 'pstep_demo_' + i, name: n, active: true, sort: i + 1, version: 1 };
    });
    d.lots = [
      ['10001', 'C4F', 'pn_demo_1', 'BU-01', 12, PEOPLE.engineer.id, 9, 'Panels 3-4 have a known scratch'],
      ['10001.01', 'C4F', 'pn_demo_1', 'BU-01', 4, PEOPLE.engineer.id, 5, ''],
      ['10002', 'SHIFT', 'pn_demo_2', 'BU-03', 24, PEOPLE.admin.id, 2, ''],
      ['10003', 'HORUS', null, 'DOE', 8, PEOPLE.quality2.id, 1, '']
    ].map(function (x, i) {
      return { id: 'lot_demo_' + i, lot_number: x[0], project_id: prj(x[1]), part_number_id: x[2], buildup_id: bu(x[3]), panel_count: x[4],
               owner_id: x[5], note: x[7], created_ts: new Date(now - x[6] * DAY).toISOString(), version: 1 };
    });
    // demo requests (made up, preview only): a Line stop on FIB and a Normal one on QVM
    function prioId(code) { return d.priorities.filter(function (p) { return p.code === code; })[0].id; }
    function typeOf(code) { return d.measurement_types.filter(function (m) { return m.tool_id === tool(code).id; })[0].id; }
    function iso(daysAgo) { return new Date(now - daysAgo * DAY).toISOString(); }
    var ymdIn = function (days) { return new Date(now + days * DAY).toISOString().slice(0, 10); };
    d.requests = [
      { id: 'req_demo_1', request_no: 'FIB-' + ymdIn(-1).slice(2).replace(/-/g, '') + '-01', status: 'submitted', tool_id: tool('FIB').id, type_id: typeOf('FIB'),
        lot_id: 'lot_demo_0', panels: [1, 2, 3, 4], priority_id: prioId('P1'), priority_reason: 'Line 2 stopped - voids suspected', needed_by: ymdIn(1),
        bkm_id: d.bkms.filter(function (b) { return b.tool_id === tool('FIB').id; })[0].id, bkm_path: '', purpose: 'Check voids at via 3 after the new plating recipe',
        process_step_id: 'pstep_demo_1', process_step_other: '', layer: 'L3', panel_location: 'Magazine 14, rack B2', destructive_ok: true, after: 'scrap',
        after_other: '', extra: { fld_demo_side: 'ch_f' }, duplicated_from: null, requester_id: PEOPLE.engineer.id, created_ts: iso(1.1), updated_ts: iso(1),
        submitted_ts: iso(1), version: 2 },
      { id: 'req_demo_2', request_no: 'QVM-' + ymdIn(-2).slice(2).replace(/-/g, '') + '-01', status: 'submitted', tool_id: tool('QVM').id, type_id: typeOf('QVM'),
        lot_id: 'lot_demo_2', panels: [1, 5, 9], priority_id: prioId('P3'), priority_reason: '', needed_by: null, bkm_id: null, bkm_path: '',
        purpose: 'Pad size on the corner coupons', process_step_id: null, process_step_other: 'after solder resist', layer: '', panel_location: 'In MES',
        destructive_ok: false, after: 'back_to_me', after_other: '', extra: {}, duplicated_from: null, requester_id: PEOPLE.admin.id,
        created_ts: iso(2), updated_ts: iso(2), submitted_ts: iso(2), version: 2 }
    ];
    d.request_events = [
      { id: 'rev_d1', request_id: 'req_demo_1', ts: iso(1.1), user_id: PEOPLE.engineer.id, kind: 'created', from: null, to: 'draft', text: null },
      { id: 'rev_d2', request_id: 'req_demo_1', ts: iso(1), user_id: PEOPLE.engineer.id, kind: 'status', from: 'draft', to: 'submitted', text: null },
      { id: 'rev_d3', request_id: 'req_demo_1', ts: iso(0.5), user_id: PEOPLE.quality.id, kind: 'comment', text: 'Panels picked up. @Erik Wagner which via row?', mentions: [PEOPLE.engineer.id] },
      { id: 'rev_d4', request_id: 'req_demo_2', ts: iso(2), user_id: PEOPLE.admin.id, kind: 'created', from: null, to: 'draft', text: null },
      { id: 'rev_d5', request_id: 'req_demo_2', ts: iso(2), user_id: PEOPLE.admin.id, kind: 'status', from: 'draft', to: 'submitted', text: null }
    ];
    d.revision = 12;
    d.saved_by = PEOPLE.admin.id;
    return sha256('salt_demo:' + DEMO_PIN).then(function (hash) {
      d.settings.forEach(function (s) {
        if (s.key === 'admin_pin_salt') s.value_json = JSON.stringify('salt_demo');
        if (s.key === 'admin_pin_hash') s.value_json = JSON.stringify(hash);
      });
      return d;
    });
  }

  // --- the memory folder the app talks to (it waits until the demo file is ready)
  var files = {};
  var mem = MRT.adapters.storageMemory(files);
  var ready = /[?&]empty=1/.test(q) ? Promise.resolve() : demoFile().then(function (d) {
    files[MRT.config.data_file] = JSON.stringify(d);
    var today = new Date().toISOString().slice(0, 10);
    files[MRT.config.backup_dir + '/' + MRT.config.backup_prefix + today + '.json'] = files[MRT.config.data_file];
  });
  var read = mem.read;
  mem.read = function (p) { return ready.then(function () { return read(p); }); };
  mem.label = function () { return 'preview (memory)'; };
  MRT.adapters.storageFolder = mem;

  // --- who you are, and your theme
  var as = (q.match(/[?&]as=(\w+)/) || [])[1] || 'admin';
  var me = PEOPLE[as] || PEOPLE.admin;
  var theme = (q.match(/[?&]theme=(\w+)/) || [])[1];
  try {
    localStorage.setItem('mrt.identity', JSON.stringify({ windows_id: me.windows_id, domain: 'CORP' }));
    if (/[?&]empty=1/.test(q)) localStorage.removeItem('mrt.identity');
    if (theme) localStorage.setItem('mrt.theme.' + me.id, theme);
    localStorage.setItem('mrt.motion.' + me.id, /[?&]motion=reduce/.test(q) ? 'reduce' : 'full');
  } catch (e) { /* private mode */ }

  // --- Settings: type the demo PIN by itself, so every tab can be looked at
  function autoUnlock() {
    var form = document.querySelector('#main .lock-form');
    if (!form) return;
    form.querySelector('input').value = DEMO_PIN;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
  }
  window.addEventListener('hashchange', function () { setTimeout(autoUnlock, 50); });
  window.addEventListener('load', function () { setTimeout(autoUnlock, 300); });

  if (/[?&]fakechart=1/.test(q) && !window.Chart) {
    window.Chart = function FakeChart(canvas, cfg) {
      var chart = { chartArea: { left: 0, right: 300, top: 0, bottom: 200 }, canvas: canvas,
        ctx: { createLinearGradient: function () { return { addColorStop: function () {} }; } },
        scales: { y: { getPixelForValue: function () { return 100; } } },
        getDatasetMeta: function () { return { data: [{ getProps: function () { return { y: 50 }; } }] }; } };
      cfg.data.datasets.forEach(function (d) {
        ['backgroundColor', 'hoverBackgroundColor', 'borderColor'].forEach(function (k) { if (typeof d[k] === 'function') d[k]({ chart: chart }); });
        if (!Array.isArray(d.data) || !d.data.length) console.error('FakeChart: empty dataset', d.label);
      });
      window.__fakeCharts = (window.__fakeCharts || 0) + 1;
      this.destroy = function () {};
    };
  }

  var clickSel = (q.match(/[?&]click=([^&#]+)/) || [])[1];
  if (clickSel) {
    window.addEventListener('load', function () {
      setTimeout(function () {
        var n = document.querySelector(decodeURIComponent(clickSel));
        if (n) n.click(); else console.error('preview: nothing matches ' + decodeURIComponent(clickSel));
      }, 900);
    });
  }

  if (/[?&]audit=1/.test(q)) {
    window.addEventListener('load', function () {
      setTimeout(function () { var s = document.createElement('script'); s.src = 'a11y-audit.js'; document.body.appendChild(s); }, 1800);
    });
  }

  if (/[?&]perf=1/.test(q)) {
    window.addEventListener('load', function () {
      // open Settings once and unlock it, so the timings measure the tabs, not the PIN form
      setTimeout(function () { history.replaceState(null, '', '#/settings'); MRT.app.route(); autoUnlock(); }, 900);
      setTimeout(function () {
        var app = MRT.app;
        function time(label, fn, reps) {
          reps = reps || 1;
          var t = performance.now();
          for (var r = 0; r < reps; r++) fn();
          console.log('PERF ' + label + ' ' + ((performance.now() - t) / reps).toFixed(1) + ' ms');
        }
        ['#/lab', '#/settings/health', '#/settings/users', '#/settings/tools', '#/settings/lists', '#/settings/calendar',
         '#/settings/audit', '#/settings/data', '#/help'].forEach(function (h) {
          history.replaceState(null, '', h);
          time('render ' + h, function () { app.route(); });
          time('tick   ' + h, function () { if (app.state.currentView && app.state.currentView.tick) app.state.currentView.tick(); }, 20);
          console.log('PERF nodes ' + h + ' ' + document.getElementsByTagName('*').length);
        });
        console.log('PERF DONE');
      }, 1600);
    });
  }
})();
