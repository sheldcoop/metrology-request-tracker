/**
 * js/demo-data.js - THE BIG DEMO DATA FILE (made up, never real).
 *
 * Builds a full data file to try every screen and rule: 15 people (admin,
 * 7 engineers, 2 operators who also measure, 3 quality engineers, 2
 * managers - plus one who added themselves and one switched off), all five
 * tools with extra fields, part numbers, process steps, lots and split lots
 * in magazine slots, and ~260 requests over the last six months in EVERY state
 * on EVERY tool: drafts (one 30+ days old), submitted, accepted (expected
 * done, some later than needed), in progress, on hold (each reason), needs
 * clarification, completed, closed, reopened, cancelled (by the engineer and
 * by the lab), late ones, Line stops, away routing, taken over, edited,
 * copied, comments with @mentions, panels received, FIB panels scrapped.
 *
 * Deterministic (fixed random seed), dated relative to `now`. Used by
 *   Settings > Data > "Fill with demo data" -> into the data folder in use (store.replaceData, the admin
 *                                            keeps their PIN and becomes the demo's Prince)
 *   node tests/make-demo-data.js          -> demo-data/mrt_data.json (a real folder to open)
 *   tests/preview.html?demo=big           -> in memory
 *   tests/tests.js                        -> checks every record against the app's own rules
 *
 *   window.MRT.demoData({ now_ts }) -> the data (admin PIN set by the caller: 1234)
 *
 * Needs config.js, domain.js, seed.js and store.js loaded first.
 */
window.MRT = window.MRT || {};
window.MRT.demoData = (function () {
  'use strict';

  var DAY = 86400000, HOUR = 3600000;

  var PEOPLE = [
    // key, name, windows id, roles, extra
    ['prince', 'Prince Khurana', 'pkhurana', ['admin', 'engineer']],
    ['erik', 'Erik Wagner', 'ewagner', ['engineer']],
    ['anna', 'Anna Berger', 'aberger', ['engineer']],
    ['lukas', 'Lukas Steiner', 'lsteiner', ['engineer']],
    ['sofia', 'Sofia Huber', 'shuber', ['engineer']],
    ['david', 'David Gruber', 'dgruber', ['engineer']],
    ['lena', 'Lena Mayer', 'lmayer', ['engineer']],
    ['jonas', 'Jonas Fischer', 'jfischer', ['engineer']],
    ['mia', 'Mia Gruber', 'mgruber', ['operator', 'quality']],
    ['felix', 'Felix Bauer', 'fbauer', ['operator', 'quality']],
    ['olga', 'Olga Brandt', 'obrandt', ['quality']],
    ['otto', 'Otto Kern', 'okern', ['quality']],
    ['nina', 'Nina Koch', 'nkoch', ['quality', 'engineer']],
    ['max', 'Max Leitner', 'mleitner', ['manager']],
    ['clara', 'Clara Wolf', 'cwolf', ['manager', 'engineer']],
    ['nora', 'Nora Steiner', 'nsteiner', ['engineer'], { self_added: true, needs_review: true }],
    ['tom', 'Tom Alt', 'talt', ['engineer'], { active: false }]
  ];
  var ENGINEERS = ['prince', 'erik', 'anna', 'lukas', 'sofia', 'david', 'lena', 'jonas', 'nina', 'clara'];
  // tool code -> [primary, backup]; Olga (FIB primary) is away right now -> new FIB requests go to Mia
  var CREW = { HRM: ['otto', 'felix'], AOI: ['felix', 'otto'], PRF: ['nina', 'mia'], QVM: ['mia', 'nina'], FIB: ['olga', 'mia'] };

  var EXTRA_FIELDS = {
    HRM: [{ label: 'Filter', type: 'choice', choices: ['Gaussian 0.8 mm', 'Gaussian 2.5 mm', 'none'], required: true }, { label: 'Scan length', type: 'number', unit: 'mm', min: 0.1, max: 20 }],
    AOI: [{ label: 'Recipe', type: 'text', help: 'AOI recipe name' }, { label: 'Review all defects', type: 'yesno' }],
    PRF: [{ label: 'Scan length', type: 'number', unit: 'mm', min: 1, max: 100, required: true }, { label: 'Points per mm', type: 'number', min: 1, max: 1000 }],
    QVM: [{ label: 'Sites per panel', type: 'number', min: 1, max: 50, required: true }, { label: 'Features', type: 'multichoice', choices: ['Pads', 'Vias', 'Lines', 'Fiducials'] }],
    FIB: [{ label: 'Cut side', type: 'choice', choices: ['Front', 'Back', 'Edge'], required: true }, { label: 'Cut depth', type: 'number', unit: 'µm', min: 1, max: 200 }]
  };
  var STEPS = ['After lamination', 'After drilling', 'After desmear', 'After Cu plating', 'After solder resist', 'After final finish'];
  var PNS = [['PN-4711-A', 'C4F test board', ['C4F']], ['PN-4711-B', 'C4F daisy chain', ['C4F']], ['PN-4712', 'C4F thermal', ['C4F']],
             ['PN-5100', 'SHIFT interposer', ['SHIFT']], ['PN-5101', 'SHIFT coupon', ['SHIFT', 'HORUS']], ['PN-6200-X', 'HORUS main', ['HORUS']]];

  /** A small seeded random generator: the same file every time for the same `now`. */
  function rng(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function build(o) {
    o = o || {};
    var D = window.MRT.domain, ST = window.MRT.store;
    var now = o.now_ts || Date.now();
    var R = rng(20260924);
    function pick(list) { return list[Math.floor(R() * list.length)]; }
    function chance(p) { return R() < p; }
    function between(a, b) { return a + Math.floor(R() * (b - a + 1)); }
    var seq = 0;
    function id(prefix) { seq++; return prefix + '_demo_' + seq.toString(36); }
    function iso(ts) { return new Date(ts).toISOString(); }

    var d = ST._pure.seedData(now);
    var cal = { days: [1, 2, 3, 4, 5], start: '07:00', end: '18:00' };
    var holidays = D.holidaySet(d.holidays);

    /** A moment inside lab hours, `days` lab days before now (fractional ok). */
    function labTs(daysAgo) {
      var ts = now - daysAgo * DAY;
      var ymd = D.viennaYmd(ts);
      for (var g = 0; g < 10 && ((cal.days.indexOf(D.isoWeekday(ymd)) === -1) || holidays[ymd]); g++) { ts -= DAY; ymd = D.viennaYmd(ts); }   // back to a lab day
      var start = D.viennaTs(ymd, '07:30'), end = D.viennaTs(ymd, '17:30');
      return Math.min(Math.max(start + Math.floor(R() * (end - start)), start), Math.min(end, now - 60000));
    }
    function later(ts, hours) { return Math.min(ts + hours * HOUR, now - 60000); }
    function ymdOf(ts) { return D.viennaYmd(ts); }
    function ymdIn(days) { return D.viennaYmd(now + days * DAY); }

    /* --- settings, calendar, holidays -------------------------------------- */
    function setSetting(k, v) {
      var row = d.settings.filter(function (s) { return s.key === k; })[0];
      if (row) row.value_json = JSON.stringify(v); else d.settings.push({ key: k, value_json: JSON.stringify(v), version: 1 });
    }
    setSetting('calendar_confirmed', true);
    var year = ymdOf(now).slice(0, 4);
    ['12-24', '12-31'].forEach(function (md) {
      var date = year + '-' + md;
      if (!d.holidays.some(function (h) { return h.date === date; })) d.holidays.push({ id: id('hol'), date: date, name: md === '12-24' ? 'Christmas Eve' : 'New Year\'s Eve', kind: 'closing', source: 'manual', version: 1 });
    });
    d.holidays.sort(function (a, b) { return a.date < b.date ? -1 : 1; });

    /* --- people --------------------------------------------------------------- */
    var U = {};
    d.users = PEOPLE.map(function (p) {
      var u = Object.assign({ id: 'usr_demo_' + p[0], name: p[1], windows_id: p[2], domain: 'CORP', email: p[2] + '@example.com', roles: p[3],
        active: true, self_added: false, needs_review: false, created_ts: iso(now - between(150, 400) * DAY), version: 1 }, p[4] || {});
      if (p[0] === 'nora') u.created_ts = iso(now - 2 * DAY);
      if (p[0] === 'jonas') u.email = null;             // someone without an email: no Outlook draft for him
      U[p[0]] = u;
      return u;
    });
    U.olga.away_from = ymdIn(-2); U.olga.away_until = ymdIn(5); U.olga.away_note = 'Mia covers FIB';
    U.lukas.away_from = ymdIn(20); U.lukas.away_until = ymdIn(30);          // planned
    U.otto.away_from = ymdIn(-40); U.otto.away_until = ymdIn(-35);          // over

    /* --- tools ---------------------------------------------------------------- */
    var T = {};
    d.tools.forEach(function (t) {
      T[t.code] = t;
      t.primary_operator_id = U[CREW[t.code][0]].id;
      t.backup_operator_id = U[CREW[t.code][1]].id;
      t.results_root = '\\\\labserver\\metrology\\' + t.code;
    });
    T.PRF.status = 'maintenance'; T.PRF.status_until = ymdIn(3); T.PRF.status_note = 'Stylus calibration';
    T.AOI.status = 'down'; T.AOI.status_until = ymdIn(-1); T.AOI.status_note = 'Camera replaced - waiting for the service check';
    Object.keys(EXTRA_FIELDS).forEach(function (code) {
      EXTRA_FIELDS[code].forEach(function (f, j) {
        d.tool_fields.push({ id: id('fld'), tool_id: T[code].id, label: f.label, type: f.type, required: !!f.required, help: f.help || '', unit: f.unit || '',
          min: f.min === undefined ? null : f.min, max: f.max === undefined ? null : f.max,
          choices: (f.choices || []).map(function (c) { return { id: id('ch'), label: c, active: true }; }), type_ids: [], active: true, sort: j + 1, version: 1 });
      });
    });
    // the real-looking lists are confirmed (no Sample tag) in the demo
    d.measurement_types.forEach(function (m) { delete m.sample; });
    d.bkms.forEach(function (b) { delete b.sample; b.path = b.path.replace('SAMPLE-SHARE', 'labserver'); b.name = b.name.replace(' (sample)', ''); b.doc_version = 'v' + between(1, 4); });
    d.lot_fields.forEach(function (f) { delete f.sample; });
    d.magazines.forEach(function (m) { delete m.sample; });

    /* --- lists ------------------------------------------------------------------ */
    var P = {};
    d.projects.forEach(function (p) { P[p.code] = p; });
    d.part_numbers = PNS.map(function (x) { return { id: id('pn'), code: x[0], description: x[1], project_ids: x[2].map(function (c) { return P[c].id; }), active: true, version: 1 }; });
    d.process_steps = STEPS.map(function (n, i) { return { id: id('pstep'), name: n, active: true, sort: i + 1, version: 1 }; });
    var prio = {};
    d.priorities.forEach(function (p) { prio[p.code] = p; });

    /* --- lots in magazines ------------------------------------------------------ */
    var lotFields = {};
    d.lot_fields.forEach(function (f) { lotFields[f.label] = f; });
    function choiceId(f, label) { return (f.choices.filter(function (c) { return c.label === label; })[0] || {}).id; }
    // magazines: the first 8 held panels of finished requests, the other 12 hold the open ones (no slot twice)
    var magOld = d.magazines.slice(0, 8), magOpen = d.magazines.slice(8), occ = {};
    var lots = [], hirata = 3100;
    function addLot(num, daysAgo, panels, parent) {
      var projCode = parent ? null : pick(['C4F', 'C4F', 'SHIFT', 'HORUS']);
      var proj = parent ? parent.proj : P[projCode].id;
      var owner = U[pick(ENGINEERS)];
      var lot = { id: id('lot'), lot_number: num, panel_count: panels, owner_id: parent ? parent.owner_id : owner.id,
        note: chance(0.2) ? pick(['Panels 3-4 have a known scratch', 'Handle with gloves - thin core', 'Split for the DOE', 'Customer lot - priority']) : '',
        extra: {}, scrapped: [], created_ts: iso(labTs(daysAgo)), version: 1 };
      lot.proj = proj;                                     // the project its requests are usually for (F-6: the request says it), dropped before saving
      lot.ids = [];                                        // the panels' Hirata IDs (F-1), dropped before the lot is saved
      for (var h = 0; h < panels; h++) lot.ids.push(String(hirata + h));
      hirata += panels + between(5, 40);
      var ex = lot.extra;
      ex[lotFields['Purpose of the lot'].id] = choiceId(lotFields['Purpose of the lot'], pick(['Development', 'DOE', 'Qualification', 'Customer sample', 'Production support', 'Failure analysis']));
      ex[lotFields['Started on'].id] = ymdOf(now - (daysAgo + between(1, 10)) * DAY);
      if (chance(0.4)) ex[lotFields['Started by'].id] = U[pick(ENGINEERS)].name;
      if (chance(0.5)) ex[lotFields['DOE / experiment ID'].id] = 'DOE-' + between(100, 999);
      if (chance(0.2)) ex[lotFields['Customer'].id] = pick(['Customer A', 'Customer B']);
      if (chance(0.5)) ex[lotFields['Expected finish'].id] = ymdOf(now + between(-30, 60) * DAY);
      ex[lotFields['Lot status'].id] = choiceId(lotFields['Lot status'], daysAgo > 90 ? 'Finished' : pick(['Running', 'Running', 'Running', 'On hold']));
      lots.push(lot);
      return lot;
    }
    // 36 lots over six months; some split lots (18xxx.01/.02); a few without a panel count (it is optional)
    for (var i = 0; i < 36; i++) {
      var ago = Math.round(180 - i * 5 + R() * 3);
      var l = addLot(String(18100 + i * 7), Math.max(ago, 1), pick([6, 8, 12, 12, 16, 24, 30, 36, 48]), null);
      if (i % 6 === 2) addLot(l.lot_number + '.01', Math.max(ago - 2, 1), Math.min(l.panel_count, 8), l);
      if (i % 12 === 2) addLot(l.lot_number + '.02', Math.max(ago - 3, 1), 4, l);
      if (i % 9 === 4) l.panel_count = null;
    }
    d.lots = lots;
    lots.sort(function (a, b) { return a.created_ts < b.created_ts ? -1 : 1; });

    /* --- requests ---------------------------------------------------------------- */
    var requests = [], events = [], audit = [];
    var taken = {};           // lot id -> panels already scrapped
    function ev(r, ts, userKey, kind, from, to, text, more) {
      var e = Object.assign({ id: id('rev'), request_id: r.id, ts: iso(ts), user_id: typeof userKey === 'string' && U[userKey] ? U[userKey].id : userKey,
        kind: kind, from: from || null, to: to || null, text: text || null }, more || {});
      events.push(e);
      return e;
    }
    function aud(ts, userId, entity, entityId, action, field, oldV, newV, reason) {
      audit.push({ id: id('aud'), ts: iso(ts), user_id: userId, entity: entity, entity_id: entityId, action: action, field: field || null,
                   old_value: oldV === undefined ? null : oldV, new_value: newV === undefined ? null : newV, reason: reason || null });
    }
    function toolFieldsAnswers(tool, typeId) {
      var out = {};
      D.fieldsForType(d.tool_fields, tool.id, typeId).forEach(function (f) {
        if (!f.required && chance(0.5)) return;
        if (f.type === 'choice') out[f.id] = pick(f.choices).id;
        else if (f.type === 'multichoice') out[f.id] = f.choices.filter(function () { return chance(0.5); }).map(function (c) { return c.id; }).slice(0, 3);
        else if (f.type === 'number') out[f.id] = Math.min(f.max || 50, Math.max(f.min || 1, between(1, 20)));
        else if (f.type === 'yesno') out[f.id] = chance(0.5);
        else out[f.id] = pick(['STD-01', 'FINE-02', 'HDI-03']);
        if (Array.isArray(out[f.id]) && !out[f.id].length) delete out[f.id];
      });
      return out;
    }
    var COMMENTS = ['Please measure near the fiducials.', 'Panels are in the cleanroom cabinet.', 'Can you also check the corner coupon?', 'Results look fine, thanks!',
                    'Which via row do you mean?', 'Row 3, the dense area.', 'Starting tomorrow morning.', 'Needed for the Friday review.'];

    /** k slots next to each other in one of these magazines; kept = stays open, so nobody else gets them. */
    function slotsFor(mags, k, kept) {
      for (var tries = 0; tries < 12; tries++) {
        var m = pick(mags), start = between(1, m.slots - k + 1), ok = true, sl = [];
        for (var x = start; x < start + k; x++) { if (kept && occ[m.id + ':' + x]) ok = false; sl.push(x); }
        if (!ok) continue;
        if (kept) sl.forEach(function (y) { occ[m.id + ':' + y] = true; });
        return { magazine_id: m.id, slots: sl };
      }
      return null;
    }

    /**
     * One request and its whole history.
     * plan: {tool, daysAgo, fate: draft|submitted|accepted|in_progress|on_hold|clarification|completed|closed|reopened|cancelled|cancelled_lab,
     *        prio, late, oldDraft, edited, copyOf}
     */
    function makeRequest(plan) {
      var tool = T[plan.tool];
      var lotPool = lots.filter(function (x) { return Date.parse(x.created_ts) < now - plan.daysAgo * DAY; });
      if (!lotPool.length) lotPool = lots.slice(0, 3);
      var lot = plan.copyOf ? lots.filter(function (x) { return x.id === plan.copyOf.lot_id; })[0] : pick(lotPool.slice(-12));
      var free = lot.ids.filter(function (x) { return (lot.scrapped || []).indexOf(x) === -1; });
      if (!free.length) return null;
      var k = Math.min(free.length, between(1, 4));
      var start = between(0, free.length - k);
      var panels = free.slice(start, start + k);
      var type = pick(d.measurement_types.filter(function (m) { return m.tool_id === tool.id; }));
      var bkms = d.bkms.filter(function (b) { return b.tool_id === tool.id && (!b.type_id || b.type_id === type.id); });
      var who = plan.who || pick(ENGINEERS);
      var p = prio[plan.prio || (chance(0.05) ? 'P1' : chance(0.2) ? 'P2' : chance(0.8) ? 'P3' : 'P4')];
      var created = labTs(plan.daysAgo);
      var noBkm = chance(0.12);
      var counted = chance(0.2);                            // 1 in 5 only says how many (F-1)
      var ends = ['closed', 'cancelled', 'cancelled_lab', 'completed', 'draft'].indexOf(plan.fate) !== -1;
      var place = chance(0.65) ? slotsFor(ends ? magOld : magOpen, k, !ends) : null;
      var bu = chance(0.75) ? pick(d.buildups) : null;       // the build-up is optional; one lot runs through all of them (F-6)
      var pnsP = d.part_numbers.filter(function (x) { return x.project_ids.indexOf(lot.proj) !== -1; });
      var lys = D.layersFor(bu);
      var layers = bu && chance(0.6) ? [pick(lys)].concat(chance(0.4) ? [pick(lys)] : []).filter(function (x, i4, a) { return a.indexOf(x) === i4; })
        .sort(function (a, b) { return lys.indexOf(a) - lys.indexOf(b); }) : [];
      var r = { id: id('req'), request_no: null, status: 'draft', tool_id: tool.id, type_id: type.id, lot_id: lot.id, panels: counted ? [] : panels, panel_count: k,
        project_id: lot.proj, part_number_id: pnsP.length && chance(0.8) ? pick(pnsP).id : null, buildup_id: bu ? bu.id : null,
        priority_id: p.id, priority_reason: p.needs_reason ? pick(['Line 2 stopped - voids suspected', 'Customer audit on Friday', 'Yield drop on the last lots', 'Qualification deadline']) : '',
        needed_by: plan.late ? ymdOf(now - between(2, 8) * DAY) : chance(0.7) ? ymdOf(created + between(3, 15) * DAY) : null,
        bkm_id: !noBkm && bkms.length ? pick(bkms).id : null, bkm_path: noBkm && chance(0.5) ? '\\\\labserver\\users\\' + U[who].windows_id + '\\BKM_' + tool.code + '.pptx' : '',
        purpose: chance(0.7) || noBkm ? pick(['Check voids after the new plating recipe', 'Roughness before and after desmear', 'Pad size on the corner coupons', 'Step height of the SR opening', 'Defect review after AOI alarm', 'Cross-section of the stacked vias']) : '',
        process_step_id: chance(0.8) ? pick(d.process_steps).id : null, process_step_other: '', layers: layers,
        panel_location: place ? '' : pick(['in MES', 'with ' + U[who].name.split(' ')[0], 'Cleanroom cabinet 2', 'Metrology inbox shelf']),
        magazine_id: place ? place.magazine_id : null, slots: place ? place.slots : [], new_lot: null,
        destructive_ok: !!tool.destructive, after: tool.destructive ? 'scrap' : pick(['back_to_me', 'back_to_me', 'back_to_line', 'other']), after_other: '',
        extra: toolFieldsAnswers(tool, type.id), duplicated_from: plan.copyOf ? plan.copyOf.id : null, requester_id: U[who].id, assigned_to: null,
        created_ts: iso(created), updated_ts: iso(created), submitted_ts: null, version: 1 };
      if (r.after === 'other') r.after_other = 'to ' + U[pick(ENGINEERS)].name.split(' ')[0] + ' for SEM';
      if (r.process_step_id === null && chance(0.3)) r.process_step_other = 'after plasma clean';
      requests.push(r);
      ev(r, created, who, 'created', null, 'draft', plan.copyOf ? 'Copied from ' + plan.copyOf.request_no : null);
      if (plan.fate === 'draft') {
        if (plan.oldDraft) { r.created_ts = iso(now - 45 * DAY); r.updated_ts = r.created_ts; events[events.length - 1].ts = r.created_ts; }
        return r;
      }
      // submit
      var sub = later(created, 0.2);
      var subYmd = ymdOf(sub);
      r.request_no = D.nextRequestNo(tool.code, subYmd, requests.map(function (x) { return x.request_no; }).filter(Boolean));
      r.status = 'submitted'; r.submitted_ts = iso(sub); r.version++;
      ev(r, sub, who, 'status', 'draft', 'submitted');
      aud(sub, U[who].id, 'request', r.id, 'submit', 'status', 'draft', 'submitted', r.request_no);
      var primary = U[CREW[plan.tool][0]], backup = U[CREW[plan.tool][1]];
      var awayNow = primary.away_from && subYmd >= primary.away_from && (!primary.away_until || subYmd <= primary.away_until);
      r.assigned_to = awayNow ? backup.id : primary.id;
      if (awayNow) ev(r, sub, who, 'assign', null, backup.id, primary.name + ' is away - assigned to the backup, ' + backup.name);
      var qe = U[awayNow ? CREW[plan.tool][1] : CREW[plan.tool][0]];
      var qeKey = PEOPLE.filter(function (x) { return U[x[0]] === qe; })[0][0];
      var t = sub;
      function step(hours, userK, kind, from, to, text, more) { t = later(t, hours); return ev(r, t, userK, kind, from, to, text, more); }
      if (chance(0.35)) {                                   // a comment, sometimes with an @mention
        var mention = chance(0.5);
        var cm = mention ? '@' + qe.name + ' ' + pick(COMMENTS) : pick(COMMENTS);
        step(0.5, who, 'comment', null, null, cm, { mentions: mention ? [qe.id] : [] });
      }
      if (plan.edited) {
        var old = D.panelsText(r);
        if (r.panels.length) {
          var more = free.filter(function (x) { return r.panels.indexOf(x) === -1; }).slice(0, 2);
          if (more.length) { r.panels = r.panels.concat(more); r.panel_count = r.panels.length; step(1, who, 'edit', null, null, 'panels ' + old + ' -> ' + D.panelsText(r) + '. Reason: two more panels for the statistics'); }
        } else { r.panel_count += 2; step(1, who, 'edit', null, null, 'how many panels ' + old + ' -> ' + D.panelsText(r) + '. Reason: two more panels for the statistics'); }
      }
      if (plan.fate === 'submitted') return r;
      if (plan.fate === 'cancelled') { r.status = 'cancelled'; r.cancelled_ts = iso(later(t, 2)); step(2, who, 'status', 'submitted', 'cancelled', 'Lot was scrapped in production'); return r; }
      if (plan.taken) { step(0.5, CREW[plan.tool][1], 'assign', r.assigned_to, backup.id); r.assigned_to = backup.id; qe = backup; qeKey = CREW[plan.tool][1]; }
      // accept
      r.status = 'accepted'; r.accepted_ts = iso(later(t, 1.5));
      r.expected_done = chance(0.6) ? ymdOf(Date.parse(r.accepted_ts) + between(2, 10) * DAY) : null;
      if (plan.expectedLater && r.needed_by) r.expected_done = ymdOf(Date.parse(r.needed_by + 'T12:00:00Z') + 3 * DAY);
      step(1.5, qeKey, 'status', 'submitted', 'accepted', null, r.expected_done ? { expected_done: r.expected_done } : null);
      if (plan.fate === 'accepted') return r;
      if (plan.fate === 'cancelled_lab') { r.status = 'cancelled'; r.cancelled_ts = iso(later(t, 3)); step(3, qeKey, 'status', 'accepted', 'cancelled', 'Panels are not measurable - delaminated'); return r; }
      if (plan.fate === 'clarification') { r.status = 'clarification'; r.return_to = 'accepted'; step(2, qeKey, 'status', 'accepted', 'clarification', 'Which side should we measure - front or back?'); return r; }
      if (chance(0.3)) {                                    // an earlier question, answered
        step(2, qeKey, 'status', 'accepted', 'clarification', 'Which via row?');
        step(3, who, 'status', 'clarification', 'accepted', 'Row 3, the dense area');
      }
      // panels received + start
      r.received_ts = iso(later(t, 2)); r.received_by = qe.id; r.received_where = pick(['FIB cabinet shelf 2', 'Metrology rack A', 'QVM bench', '']);
      step(2, qeKey, 'panels', null, null, r.received_where ? 'Kept at ' + r.received_where : null);
      r.status = 'in_progress'; r.started_ts = iso(later(t, 1));
      step(1, qeKey, 'status', 'accepted', 'in_progress');
      if (plan.fate === 'in_progress') return r;
      if (plan.fate === 'on_hold') {
        var hr = plan.holdReason || pick(d.hold_reasons);
        r.status = 'on_hold'; r.return_to = 'in_progress'; r.hold_reason_id = hr.id; r.hold_note = chance(0.5) ? pick(['stage error', 'waiting for the engineer', 'Line stop first']) : '';
        step(2, qeKey, 'status', 'in_progress', 'on_hold', hr.name + (r.hold_note ? ': ' + r.hold_note : ''));
        return r;
      }
      if (chance(0.2)) {                                    // held once, resumed
        var h1 = pick(d.hold_reasons);
        step(2, qeKey, 'status', 'in_progress', 'on_hold', h1.name);
        step(5, qeKey, 'status', 'on_hold', 'in_progress');
      }
      // complete
      function complete(hours) {
        r.status = 'completed'; r.completed_ts = iso(later(t, hours)); r.completed_by = qe.id;
        r.results_path = tool.results_root + '\\' + r.submitted_ts.slice(0, 4) + '\\' + r.request_no + '\\';
        r.panels_outcome = tool.destructive ? 'scrapped' : r.after === 'other' ? 'other' : 'returned';
        r.panels_outcome_note = r.panels_outcome === 'other' ? r.after_other : '';
        if (tool.destructive) {
          lot.scrapped = (lot.scrapped || []).concat(r.panels).filter(function (x, i2, a) { return a.indexOf(x) === i2; });
        } else if (r.magazine_id) r.put_back = { magazine_id: r.magazine_id, slots: r.slots.slice() };
        step(hours, qeKey, 'status', 'in_progress', 'completed', D.PANEL_OUTCOME_LABEL[r.panels_outcome] + ' - results in ' + r.results_path);
      }
      complete(between(3, 30));
      if (plan.fate === 'reopened') {
        r.status = 'accepted'; r.reopened = 1; r.completed_ts = null;
        step(4, who, 'status', 'completed', 'accepted', 'Values look off - please remeasure ' + (r.panels.length ? 'panel ' + r.panels[0] : 'one panel'));
        if (chance(0.5)) { r.status = 'in_progress'; step(3, qeKey, 'status', 'accepted', 'in_progress'); }
        return r;
      }
      if (plan.fate === 'closed' && chance(0.6)) { r.results_ok_ts = iso(later(t, 6)); step(6, who, 'results_ok', 'completed', 'completed'); }
      return r;
    }

    // History, oldest first, so the request numbers and scrapped panels come out right
    var plans = [];
    var TOOLS = ['HRM', 'AOI', 'PRF', 'QVM', 'FIB'];
    for (var dAgo = 178; dAgo >= 10; dAgo -= 1) {
      var count = chance(0.6) ? 1 : chance(0.5) ? 2 : 0;
      for (var c = 0; c < count; c++) {
        var f = chance(0.08) ? 'cancelled' : chance(0.04) ? 'cancelled_lab' : chance(0.05) ? 'reopened' : 'closed';
        plans.push({ tool: pick(TOOLS), daysAgo: dAgo + R() * 0.5, fate: f, edited: chance(0.08), taken: chance(0.05) });
      }
    }
    // The present: every open state on every tool
    TOOLS.forEach(function (code) {
      [['submitted', 1.5], ['submitted', 0.3], ['accepted', 3], ['accepted', 2], ['in_progress', 4], ['on_hold', 6], ['clarification', 3],
       ['completed', 2], ['completed', 5], ['closed', 9], ['cancelled', 2], ['draft', 1]].forEach(function (x) {
        plans.push({ tool: code, daysAgo: x[1] + R() * 0.3, fate: x[0] });
      });
      plans.push({ tool: code, daysAgo: 12, fate: 'accepted', late: true, expectedLater: true });           // late, and the lab expects later still
      plans.push({ tool: code, daysAgo: 9, fate: 'in_progress', late: true });                             // late, in progress
      plans.push({ tool: code, daysAgo: 0.6, fate: 'submitted', prio: 'P1' });                             // an open Line stop
      plans.push({ tool: code, daysAgo: 1.2, fate: 'accepted', prio: 'P2', edited: true });                // Hot, edited with a reason
      plans.push({ tool: code, daysAgo: 2.5, fate: 'in_progress', taken: true });                          // taken over by the backup
      d.hold_reasons.forEach(function (h, i3) { if (i3 < 3) plans.push({ tool: code, daysAgo: 7 + i3, fate: 'on_hold', holdReason: h }); });
    });
    plans.push({ tool: 'QVM', daysAgo: 45, fate: 'draft', oldDraft: true, who: 'prince' });                 // a draft to clean up (Q33)
    plans.push({ tool: 'HRM', daysAgo: 3, fate: 'draft', who: 'prince' });
    plans.push({ tool: 'FIB', daysAgo: 0.4, fate: 'submitted', who: 'prince' });                            // routed to Mia: Olga is away
    plans.sort(function (a, b) { return b.daysAgo - a.daysAgo; });
    var made = [];
    plans.forEach(function (pl) {
      if (pl.fate !== 'draft' && chance(0.06) && made.length) pl.copyOf = pick(made.filter(function (x) { return x.request_no && x.tool_id === T[pl.tool].id; }).concat([null]).slice(-6)) || null;
      if (pl.copyOf === null) delete pl.copyOf;
      var r = makeRequest(pl);
      if (r) made.push(r);
    });

    lots.forEach(function (x) { delete x.ids; delete x.proj; });
    d.requests = requests;
    d.request_events = events.sort(function (a, b) { return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0; });
    d.audit_log = audit.concat(d.users.filter(function (u) { return u.self_added; }).map(function (u) {
      return { id: id('aud'), ts: u.created_ts, user_id: u.id, entity: 'user', entity_id: u.id, action: 'self_register', field: null, old_value: null, new_value: u.name, reason: null };
    })).sort(function (a, b) { return a.ts < b.ts ? -1 : 1; });
    d.revision = 1;
    d.saved_ts = iso(now);
    d.saved_by = U.prince.id;
    d.demo = { made_ts: iso(now), note: 'Made-up demo data from js/demo-data.js - never real' };
    return d;
  }

  build.people = PEOPLE.map(function (p) { return { key: p[0], name: p[1], windows_id: p[2], roles: p[3] }; });
  return build;
})();
