/**
 * tests/tests.js - every domain and store rule, with a test.
 *
 * Runs in tests/test.html (open it in Edge or Chrome) and from the command
 * line (node tests/run-tests.js). Results land in window.MRT_TESTS:
 *   {groups: [{name, rows: [{ok, name, detail}]}], passed, failed, done (Promise)}
 * The store runs for real, against tests/memory-storage.js - no folder needed.
 */
(function () {
  'use strict';

  var D = window.MRT.domain;
  var ST = window.MRT.store;
  var cfg = window.MRT.config;

  /* ---------------- tiny test runner ---------------- */
  var T = window.MRT_TESTS = { groups: [], passed: 0, failed: 0, done: null };
  var current = null;

  function group(name) { current = { name: name, rows: [] }; T.groups.push(current); }

  function record(ok, name, detail) {
    if (ok) T.passed++; else T.failed++;
    current.rows.push({ ok: ok, name: name, detail: detail || '' });
  }

  function eq(name, actual, expected) {
    var a = JSON.stringify(actual), e = JSON.stringify(expected);
    record(a === e, name, a === e ? '' : 'expected ' + e + ', got ' + a);
  }

  function ok(name, cond, detail) { record(!!cond, name, cond ? '' : (detail || 'expected true')); }

  /** Await a store write that must be refused; returns the error. */
  async function refused(name, promise, code) {
    try {
      await promise;
      record(false, name, 'expected a refusal, but it succeeded');
      return null;
    } catch (e) {
      var good = !code || e.code === code;
      record(good, name, good ? '' : 'expected code ' + code + ', got ' + e.code + ': ' + e.message);
      return e;
    }
  }

  /** A fresh store on an empty memory folder, loaded (first run). */
  async function freshStore() {
    var a = window.MRT.adapters.storageMemory({});
    ST.init(a);
    await ST.load();
    return a;
  }

  /** A fresh store with a first admin (Prince) signed in. */
  async function adminStore() {
    var a = await freshStore();
    await ST.createFirstAdmin({ name: 'Prince Khurana', windows_id: 'pkhurana', pin: '2468' });
    return a;
  }

  function fileOf(a) { return JSON.parse(a.files[cfg.data_file]); }
  function auditCount() { return ST.data().audit_log.length; }
  function tool(code) { return ST.data().tools.filter(function (t) { return t.code === code; })[0]; }
  function typesOf(code) { var t = tool(code); return ST.data().measurement_types.filter(function (m) { return m.tool_id === t.id; }); }

  async function run() {

    /* =============== domain: dates and holidays =============== */
    group('Dates, lab calendar, Austrian public holidays');
    eq('a real date is a date', D.isYmd('2026-09-24'), true);
    eq('30 February is not', D.isYmd('2026-02-30'), false);
    eq('a timestamp is not a date', D.isYmd('2026-09-24T10:00'), false);
    eq('Vienna date rolls over before UTC (winter)', D.viennaYmd(Date.parse('2025-12-31T23:30:00Z')), '2026-01-01');
    eq('Vienna date in summer time', D.viennaYmd(Date.parse('2026-09-23T22:30:00Z')), '2026-09-24');
    eq('adding days crosses a month', D.addDaysYmd('2026-04-05', 39), '2026-05-14');

    eq('Easter 2024', D.easterSundayYmd(2024), '2024-03-31');
    eq('Easter 2025', D.easterSundayYmd(2025), '2025-04-20');
    eq('Easter 2026', D.easterSundayYmd(2026), '2026-04-05');
    eq('Easter 2027', D.easterSundayYmd(2027), '2027-03-28');

    var h26 = D.austrianHolidays(2026), h27 = D.austrianHolidays(2027);
    function hday(list, name) { return (list.filter(function (h) { return h.name === name; })[0] || {}).date; }
    eq('13 public holidays a year', [h26.length, h27.length], [13, 13]);
    eq('2026 Easter Monday', hday(h26, 'Easter Monday'), '2026-04-06');
    eq('2026 Ascension Day', hday(h26, 'Ascension Day'), '2026-05-14');
    eq('2026 Whit Monday', hday(h26, 'Whit Monday'), '2026-05-25');
    eq('2026 Corpus Christi', hday(h26, 'Corpus Christi'), '2026-06-04');
    eq('2027 Easter Monday', hday(h27, 'Easter Monday'), '2027-03-29');
    eq('2027 Ascension Day', hday(h27, 'Ascension Day'), '2027-05-06');
    eq('2027 Whit Monday', hday(h27, 'Whit Monday'), '2027-05-17');
    eq('2027 Corpus Christi', hday(h27, 'Corpus Christi'), '2027-05-27');
    eq('fixed ones: National Day, Christmas', [hday(h26, 'National Day'), hday(h26, 'Christmas Day')], ['2026-10-26', '2026-12-25']);
    ok('in date order', h26.every(function (h, i) { return i === 0 || h26[i - 1].date < h.date; }));
    ok('every one is a real date', h26.concat(h27).every(function (h) { return D.isYmd(h.date); }));

    eq('Mon-Fri 07:00-18:00 is fine', D.validateCalendar({ days: [1, 2, 3, 4, 5], start: '07:00', end: '18:00' }), []);
    ok('no lab days is refused', D.validateCalendar({ days: [], start: '07:00', end: '18:00' }).length === 1);
    ok('day 8 is refused', D.validateCalendar({ days: [8], start: '07:00', end: '18:00' }).length === 1);
    ok('7:00 without the zero is refused', D.validateCalendar({ days: [1], start: '7:00', end: '18:00' }).length === 1);
    ok('closing before opening is refused', D.validateCalendar({ days: [1], start: '18:00', end: '07:00' }).length === 1);

    /* =============== domain: identity and names =============== */
    group('Identity, roles and "Is this you?"');
    eq('plain login', D.parseWindowsLogin('PKhurana'), { windows_id: 'pkhurana', domain: null });
    eq('DOMAIN\\user splits and normalises', D.parseWindowsLogin(' corp\\PKhurana '), { windows_id: 'pkhurana', domain: 'CORP' });
    eq('empty is no login', D.parseWindowsLogin(''), null);
    eq('spaces are not a login', D.parseWindowsLogin('p khurana'), null);
    eq('odd characters are not a login', D.parseWindowsLogin('pk$'), null);
    ok('dots and dashes are fine', D.isWindowsId('p.khurana-2'));
    ok('upper case is not a stored ID', !D.isWindowsId('PKhurana'));

    ok('same ID, no domains: match', D.identityMatches({ windows_id: 'pk' }, { windows_id: 'pk', domain: 'CORP' }));
    ok('same ID, same domain: match', D.identityMatches({ windows_id: 'pk', domain: 'CORP' }, { windows_id: 'pk', domain: 'corp' }));
    ok('same ID, other domain: no match', !D.identityMatches({ windows_id: 'pk', domain: 'LAB' }, { windows_id: 'pk', domain: 'CORP' }));
    ok('user without an ID matches nobody', !D.identityMatches({ windows_id: null }, { windows_id: null }));

    eq('names lose accents, case and extra spaces', D.normalizeName('  Jürgen   MÜLLER '), 'jurgen muller');
    eq('ß becomes ss', D.normalizeName('Strauß'), 'strauss');
    ok('muller finds Müller', D.sameName('muller', 'Müller'));
    ok('word order does not matter', D.sameName('Khurana Prince', 'Prince Khurana'));
    ok('a different person does not match', !D.sameName('Prince K', 'Prince Khurana'));
    ok('empty never matches', !D.sameName('', ''));
    eq('findNameMatches', D.findNameMatches([{ id: 'a', name: 'Anna Berger' }, { id: 'b', name: 'Tom Berger' }], 'anna  berger').map(function (u) { return u.id; }), ['a']);

    var eng = { id: 'u1', roles: ['engineer'], active: true };
    var qe = { id: 'u2', roles: ['quality'], active: true };
    var op = { id: 'u2', roles: ['operator'], active: true };
    var adm = { id: 'u3', roles: ['admin'], active: true };
    var fib = { primary_operator_id: 'u2', backup_operator_id: null };
    ok('roles are ticks', D.hasRole({ roles: ['engineer', 'operator'] }, 'operator'));
    ok('a deactivated user has no roles', !D.hasRole({ roles: ['admin'], active: false }, 'admin'));
    ok('only quality engineers measure (M1-12)', D.canMeasure(qe) && !D.canMeasure(op) && !D.canMeasure(eng) && !D.canMeasure(adm));
    ok('the tool\'s quality engineer may set its status', D.canSetToolStatus(qe, fib));
    ok('an Operator has no rights yet, even on "their" tool', !D.canSetToolStatus(op, fib));
    ok('another quality engineer may not', !D.canSetToolStatus({ id: 'u9', roles: ['quality'] }, fib));
    ok('an engineer may not', !D.canSetToolStatus(eng, fib));
    ok('an admin may', D.canSetToolStatus(adm, fib));

    /* =============== domain: list rules =============== */
    group('List rules (Settings)');
    var base = { users: [{ id: 'u1', name: 'A', windows_id: 'aa', roles: ['admin'], active: true, email: 'a@corp.com' }],
                 tools: [{ id: 't1', code: 'FIB' }, { id: 't2', code: 'QVM' }],
                 measurement_types: [{ id: 'm1', tool_id: 't1', name: 'Via cross-section' }],
                 tool_fields: [], bkms: [], projects: [{ id: 'p1', code: 'C4F' }, { id: 'p2', code: 'SHIFT' }], buildups: [],
                 part_numbers: [{ id: 'pn1', code: 'PN-100', project_ids: ['p1'] }],
                 process_steps: [{ id: 's1', name: 'After desmear', sort: 1 }],
                 priorities: [{ id: 'r1', code: 'P1' }], holidays: [{ id: 'h1', date: '2026-12-25' }] };
    function probs(c, r) { return D.validateEntry(c, r, base); }
    var goodTool = { code: 'SEM', name: 'SEM', status: 'up' };
    eq('a good tool', probs('tools', goodTool), []);
    ok('tool codes are unique', probs('tools', Object.assign({}, goodTool, { code: 'FIB' })).length === 1);
    ok('tool codes are short capitals', probs('tools', Object.assign({}, goodTool, { code: 'fib-scope' })).length === 1);
    ok('an Up tool has no until date', probs('tools', Object.assign({}, goodTool, { status_until: '2026-10-01' })).length === 1);
    ok('Maintenance until a date is fine', !probs('tools', Object.assign({}, goodTool, { status: 'maintenance', status_until: '2026-10-01' })).length);
    ok('primary and backup must differ', probs('tools', Object.assign({}, goodTool, { primary_operator_id: 'u1', backup_operator_id: 'u1' })).length === 1);
    ok('results root must be a share path', probs('tools', Object.assign({}, goodTool, { results_root: 'results' })).length === 1);
    ok('UNC and drive paths are share paths', D.isSharePath('\\\\srv\\lab\\FIB') && D.isSharePath('Z:\\Lab\\FIB'));
    ok('same type name on another tool is fine', !probs('measurement_types', { tool_id: 't2', name: 'Via cross-section' }).length);
    ok('same type name twice on a tool is not', probs('measurement_types', { tool_id: 't1', name: 'via  CROSS-section' }).length === 1);
    var field = { tool_id: 't1', label: 'Cut depth', type: 'number', min: 0, max: 50 };
    eq('a good number field', probs('tool_fields', field), []);
    ok('min above max is refused', probs('tool_fields', Object.assign({}, field, { min: 60 })).length === 1);
    ok('unknown field type is refused', probs('tool_fields', Object.assign({}, field, { type: 'colour' })).length === 1);
    ok('a choice field needs two choices', probs('tool_fields', { tool_id: 't1', label: 'Side', type: 'choice', choices: [{ label: 'Front' }] }).length === 1);
    ok('hidden choices do not count', probs('tool_fields', { tool_id: 't1', label: 'Side', type: 'choice', choices: [{ label: 'Front' }, { label: 'Back', active: false }] }).length === 1);
    ok('a choice listed twice is refused', probs('tool_fields', { tool_id: 't1', label: 'Side', type: 'choice', choices: [{ label: 'Front' }, { label: 'front' }] }).length === 1);
    ok('"only for" must be this tool\'s types', probs('tool_fields', Object.assign({}, field, { tool_id: 't2', type_ids: ['m1'] })).length === 1);
    ok('all eight field types exist', D.FIELD_TYPES.length === 8);
    ok('a BKM needs a share path', probs('bkms', { tool_id: 't1', name: 'x', path: 'bkm.pdf' }).length === 1);
    ok('a BKM type must be of its tool', probs('bkms', { tool_id: 't2', type_id: 'm1', name: 'x', path: 'Z:\\b.pdf' }).length === 1);
    ok('project codes are unique', probs('projects', { code: 'C4F' }).length === 1);
    ok('build-up codes allow dashes', !probs('buildups', { code: 'BU-06' }).length);
    eq('a part number in two projects (M1-13)', probs('part_numbers', { code: 'PN-200.A/01', project_ids: ['p1', 'p2'] }), []);
    ok('part numbers are unique across projects', probs('part_numbers', { code: 'PN-100', project_ids: ['p2'] }).length === 1);
    ok('...editing it keeps its own code', !probs('part_numbers', { id: 'pn1', code: 'PN-100', project_ids: ['p1', 'p2'] }).length);
    ok('a part number needs a project', probs('part_numbers', { code: 'PN-300', project_ids: [] }).length === 1);
    ok('...a project that exists', probs('part_numbers', { code: 'PN-300', project_ids: ['gone'] }).length === 1);
    ok('...ticked once', probs('part_numbers', { code: 'PN-300', project_ids: ['p1', 'p1'] }).length === 1);
    ok('part numbers: capitals, digits, - . _ / only', !D.isPartNumber('pn-1') && !D.isPartNumber('PN 1') && !D.isPartNumber('-PN') && D.isPartNumber('AB_12.3/4-X'));
    eq('a process step', probs('process_steps', { name: 'After Cu plating', sort: 2 }), []);
    ok('process steps are listed once (case and spaces ignored)', probs('process_steps', { name: 'after  DESMEAR' }).length === 1);
    ok('...need a name and a whole position', probs('process_steps', { name: '', sort: 1.5 }).length === 2);
    ok('"destructive" is yes or no', probs('tools', Object.assign({}, goodTool, { destructive: 'yes' })).length === 1 && !probs('tools', Object.assign({}, goodTool, { destructive: true })).length);
    eq('panels typed as ranges (Q6)', D.parsePanels('1-5, 12', 12), { panels: [1, 2, 3, 4, 5, 12], errors: [] });
    eq('...spaces, semicolons, doubles and backwards ranges', D.parsePanels(' 3;1  5-4 3 ', 12).panels, [1, 3, 4, 5]);
    eq('..."all" is every panel', D.parsePanels('all', 4).panels, [1, 2, 3, 4]);
    eq('...empty is none, no error', D.parsePanels('  ', 4), { panels: [], errors: [] });
    eq('...outside the lot is an error', D.parsePanels('0, 13', 12).errors.length, 2);
    eq('...so is text', D.parsePanels('1-5, panel 7', 12).errors.length, 1);
    eq('panels back to text: runs of 3+ become a range', [D.formatPanels([12, 1, 2, 3, 4, 5]), D.formatPanels([1, 2, 4, 5, 6]), D.formatPanels([])], ['1-5, 12', '1, 2, 4-6', '']);
    ok('...and parse(format(x)) gives x back', (function () { var x = [1, 3, 4, 5, 9, 10, 20]; return D.parsePanels(D.formatPanels(x), 20).panels.join() === x.join(); })());
    var calW = { days: [1, 2, 3, 4, 5], start: '07:00', end: '18:00' }, H = 3600000;
    eq('Vienna wall clock: 18:00 is 16:00 UTC in summer, 17:00 UTC in winter', [new Date(D.viennaTs('2026-10-02', '18:00')).toISOString(), new Date(D.viennaTs('2026-12-02', '18:00')).toISOString()],
       ['2026-10-02T16:00:00.000Z', '2026-12-02T17:00:00.000Z']);
    eq('lab time skips the weekend: Fri 16:00 -> Mon 09:00 = 4 h (Q36)', D.workingMs(D.viennaTs('2026-10-02', '16:00'), D.viennaTs('2026-10-05', '09:00'), calW, {}) / H, 4);
    eq('...across the October clock change: Fri 17:00 -> Mon 08:00 = 2 h', D.workingMs(D.viennaTs('2026-10-23', '17:00'), D.viennaTs('2026-10-26', '08:00'), calW, {}) / H, 2);
    eq('...and holidays: Mon 26 Oct (national day) counts nothing', D.workingMs(D.viennaTs('2026-10-26', '07:00'), D.viennaTs('2026-10-26', '18:00'), calW, D.holidaySet([{ date: '2026-10-26' }])) / H, 0);
    eq('...nights and early mornings do not count', D.workingMs(D.viennaTs('2026-10-01', '19:00'), D.viennaTs('2026-10-02', '06:00'), calW, {}), 0);
    var cd = D.countdown(D.viennaTs('2026-10-02', '16:00'), '2026-10-05', calW, {});
    eq('countdown to the end of the lab day on the date: 13 h left, 3 days, clock running', [cd.late, cd.lab_ms / H, cd.days, cd.paused], [false, 13, 3, false]);
    var cl = D.countdown(D.viennaTs('2026-10-06', '09:00'), '2026-10-05', calW, {});
    eq('...late by 2 h lab time the next morning, one day over', [cl.late, cl.lab_ms / H, cl.days], [true, 2, -1]);
    ok('...paused on a Saturday', D.countdown(D.viennaTs('2026-10-03', '10:00'), '2026-10-05', calW, {}).paused);
    eq('...no date, no countdown', D.countdown(0, null, calW, {}), null);
    var ppl = [{ id: 'u1', name: 'Olga Berger', windows_id: 'oberger' }, { id: 'u2', name: 'Otto Huber', windows_id: 'ohuber' }, { id: 'u3', name: 'Old', windows_id: 'old', active: false }];
    eq('@mentions by full name or Windows ID, each once (Q11)', D.findMentions('Hi @Olga  Berger and @ohuber, also @OBERGER', ppl), ['u1', 'u2']);
    eq('...not a longer word, not switched-off people', [D.findMentions('@obergerx', ppl), D.findMentions('@old', ppl)], [[], []]);
    var qeU = { id: 'q1', roles: ['quality'], active: true }, toolQ = { primary_operator_id: 'q1' };
    eq('cancel (Q35): the requester, the tool\'s QE, an admin - only while open', [D.canCancel({ id: 'e1', roles: ['engineer'] }, { status: 'accepted', requester_id: 'e1' }, toolQ),
       D.canCancel(qeU, { status: 'submitted', requester_id: 'x' }, toolQ), D.canCancel({ id: 'e2', roles: ['engineer'] }, { status: 'submitted', requester_id: 'x' }, toolQ),
       D.canCancel({ id: 'e1', roles: ['engineer'] }, { status: 'completed', requester_id: 'e1' }, toolQ)], [true, true, false, false]);
    var toolW = { primary_operator_id: 'q1', backup_operator_id: 'q2' };
    var qe1 = { id: 'q1', roles: ['quality'], active: true }, qe2 = { id: 'q2', roles: ['quality'], active: true }, eng1 = { id: 'e1', roles: ['engineer'], active: true };
    eq('workflow: a quality engineer on Submitted - Accept, Start, Hold, Clarify (M3-9)', D.actionsFor(qe1, { status: 'submitted', requester_id: 'e1' }, toolW, 0), ['accept', 'start', 'hold', 'clarify']);
    eq('...In progress - Hold, Clarify, Complete', D.actionsFor(qe2, { status: 'in_progress', requester_id: 'e1' }, toolW, 0), ['hold', 'clarify', 'complete']);
    eq('...the requester has nothing to do while it runs', D.actionsFor(eng1, { status: 'in_progress', requester_id: 'e1' }, toolW, 0), []);
    eq('...but answers a clarification, and checks completed results', [D.actionsFor(eng1, { status: 'clarification', requester_id: 'e1' }, toolW, 0),
       D.actionsFor(eng1, { status: 'completed', requester_id: 'e1', completed_ts: '2026-09-24T10:00:00Z' }, toolW, Date.parse('2026-09-25T10:00:00Z'))], [['answer'], ['reopen', 'results_ok']]);
    ok('...a quality engineer of another tool can do nothing', !D.actionsFor({ id: 'q9', roles: ['quality'], active: true }, { status: 'submitted' }, toolW, 0).length);
    ok('closed: Results OK, or 7 days after completion (Q34)', D.isClosed({ status: 'completed', results_ok_ts: 'x' }, 0) &&
       D.isClosed({ status: 'completed', completed_ts: '2026-09-01T10:00:00Z' }, Date.parse('2026-09-08T10:00:00Z')) && !D.isClosed({ status: 'completed', completed_ts: '2026-09-01T10:00:00Z' }, Date.parse('2026-09-07T10:00:00Z')));
    ok('...then no Reopen any more', !D.canAct(eng1, 'reopen', { status: 'completed', requester_id: 'e1', results_ok_ts: 'x' }, toolW, 0));
    var peopleA = [{ id: 'q1', name: 'Olga', away_from: '2026-09-20', away_until: '2026-09-30' }, { id: 'q2', name: 'Otto' }];
    eq('assigned at submit: the primary, or the backup when the primary is away (M3-7)', [D.assignOnSubmit(toolW, peopleA, '2026-10-01').id, D.assignOnSubmit(toolW, peopleA, '2026-09-24').id], ['q1', 'q2']);
    ok('...with a note for the timeline', /Olga is away/.test(D.assignOnSubmit(toolW, peopleA, '2026-09-24').note));
    peopleA[1].away_from = '2026-09-01';
    eq('...both away: stays with the primary', D.assignOnSubmit(toolW, peopleA, '2026-09-24').id, 'q1');
    ok('action data: Complete needs a share path and what happened to the panels', D.actionProblems('complete', { results_path: 'res', panels_outcome: 'x' }, {}).length === 2 &&
       !D.actionProblems('complete', { results_path: 'Z:\\res', panels_outcome: 'scrapped' }, {}).length);
    ok('...Hold needs a listed reason, Clarify a comment', D.actionProblems('hold', { hold_reason_id: 'h9' }, { hold_reasons: [{ id: 'h1' }] }).length === 1 && D.actionProblems('clarify', {}, {}).length === 1);
    var lvQ = { p1: 1, p2: 2, p3: 3, p4: 4 };
    var QL = [{ id: 'a', status: 'submitted', priority_id: 'p3', needed_by: '2026-10-10', submitted_ts: '1' }, { id: 'b', status: 'submitted', priority_id: 'p1', submitted_ts: '5' },
      { id: 'c', status: 'accepted', priority_id: 'p3', needed_by: '2026-09-20', submitted_ts: '2' }, { id: 'd', status: 'submitted', priority_id: 'p2', needed_by: '2026-10-10', submitted_ts: '3' },
      { id: 'e', status: 'submitted', priority_id: 'p4', submitted_ts: '0' }, { id: 'f', status: 'submitted', priority_id: 'p3', submitted_ts: '1' },
      { id: 'g', status: 'submitted', priority_id: 'p3', submitted_ts: '0' }];
    eq('queue order (M2-5): Line stop, late, by date (Hot first on the same day), then no date by priority, longest waiting first',
       D.sortQueue(QL, { now_ts: Date.parse('2026-09-24T10:00:00Z'), cal: calW, levelOf: function (r) { return lvQ[r.priority_id]; } }).map(function (r) { return r.id; }).join(''), 'bcdagfe');
    eq('late: past the end of the lab day on the date; never while on hold', [D.isLate({ status: 'accepted', needed_by: '2026-09-24' }, D.viennaTs('2026-09-24', '17:59'), calW),
       D.isLate({ status: 'accepted', needed_by: '2026-09-24' }, D.viennaTs('2026-09-24', '18:01'), calW), D.isLate({ status: 'on_hold', needed_by: '2026-09-01' }, Date.now(), calW)], [false, true, false]);
    var QS = [{ tool_id: 't', status: 'accepted', submitted_ts: '2026-09-21T07:00:00Z', needed_by: '2026-09-22', request_no: 'A' },
      { tool_id: 't', status: 'submitted', submitted_ts: '2026-09-23T07:00:00Z', request_no: 'B' },
      { tool_id: 't', status: 'completed', submitted_ts: '2026-09-14T06:00:00Z', started_ts: '2026-09-14T08:00:00Z' },
      { tool_id: 't', status: 'completed', submitted_ts: '2026-09-15T06:00:00Z', started_ts: '2026-09-15T10:00:00Z' },
      { tool_id: 't', status: 'completed', submitted_ts: '2026-09-16T06:00:00Z', started_ts: '2026-09-16T12:00:00Z' },
      { tool_id: 'x', status: 'submitted', submitted_ts: '2026-09-01T07:00:00Z' }];
    var qs = D.toolQueueStats(QS, 't', D.viennaTs('2026-09-24', '10:00'), calW, {});
    eq('Lab status queue (Q46): open, late, oldest open, typical wait = median submit -> start in lab time',
       [qs.open, qs.late, qs.oldest.request_no, qs.wait_ms / H, qs.wait_n], [2, 1, 'A', 4, 3]);
    eq('start page by role (M3-12): QE -> My queue, engineer -> My requests, else Lab status', [D.homeFor(qe1), D.homeFor(eng1), D.homeFor({ roles: ['manager'], active: true })], ['queue', 'requests', 'lab']);
    eq('request ID: tool-YYMMDD-NN, running per tool per day (Q29)', [D.nextRequestNo('FIB', '2026-09-24', ['FIB-260924-01', 'FIB-260924-02', 'QVM-260924-07']),
       D.nextRequestNo('QVM', '2026-09-24', ['FIB-260924-01']), D.nextRequestNo('FIB', '2026-09-25', ['FIB-260924-09']), D.nextRequestNo('FIB', '2026-09-24', ['FIB-260924-09'])],
       ['FIB-260924-03', 'QVM-260924-01', 'FIB-260925-01', 'FIB-260924-10']);
    var rq = { tools: [{ id: 't1', code: 'FIB', status: 'up', destructive: true }, { id: 't2', code: 'QVM', status: 'maintenance', status_until: '2026-10-10' }],
      measurement_types: [{ id: 'm1', tool_id: 't1', name: 'Via' }, { id: 'm2', tool_id: 't2', name: 'Pad' }],
      tool_fields: [{ id: 'f1', tool_id: 't1', label: 'Cut side', type: 'choice', required: true, choices: [{ id: 'c1', label: 'Front' }, { id: 'c2', label: 'Back' }], type_ids: [] },
                    { id: 'f2', tool_id: 't1', label: 'Depth', type: 'number', required: true, type_ids: ['m9'] }],
      bkms: [{ id: 'b1', tool_id: 't1', name: 'FIB BKM', path: 'Z:\\b.pdf' }],
      lots: [{ id: 'l1', lot_number: '18178', panel_count: 12 }],
      priorities: [{ id: 'p1', name: 'Line stop', level: 1, needs_reason: true }, { id: 'p3', name: 'Normal', level: 3 }],
      process_steps: [{ id: 's1', name: 'After desmear' }], requests: [] };
    var full = { tool_id: 't1', type_id: 'm1', lot_id: 'l1', panels: [1, 2], priority_id: 'p3', bkm_id: 'b1', panel_location: 'Magazine 14',
      destructive_ok: true, after: 'scrap', extra: { f1: 'c1' } };
    eq('a complete FIB request', D.requestProblems(full, rq, { submit: true }), []);
    eq('a draft needs only its tool', [D.requestProblems({ tool_id: 't1' }, rq, {}), D.requestProblems({}, rq, {})], [[], ['Pick a tool']]);
    ok('...but panels outside the lot are refused even in a draft', D.requestProblems({ tool_id: 't1', lot_id: 'l1', panels: [13] }, rq, {}).length === 1);
    function sub(ch) { return D.requestProblems(Object.assign({}, full, ch), rq, { submit: true }); }
    ok('submit: type, lot, panels, priority, where the panels are - all required', [{ type_id: null }, { lot_id: null }, { panels: [] }, { priority_id: null }, { panel_location: ' ' }].every(function (c) { return sub(c).length >= 1; }));
    ok('Line stop needs a reason (Q26)', sub({ priority_id: 'p1' }).length === 1 && !sub({ priority_id: 'p1', priority_reason: 'line 2 down' }).length);
    ok('no BKM: the purpose must say what to measure (Q45, M2-13)', sub({ bkm_id: null }).length === 1 && !sub({ bkm_id: null, purpose: 'voids at via 3' }).length && !sub({ bkm_id: null, bkm_path: 'Z:\\my.pptx' }).length);
    ok('FIB: the destructive tick is required, and afterwards is scrap (M2-11, M2-12)', sub({ destructive_ok: false }).length === 1 && sub({ after: 'back_to_me' }).length === 1);
    ok('"Other" afterwards needs the text', D.requestProblems(Object.assign({}, full, { tool_id: 't2', type_id: 'm2', bkm_id: null, bkm_path: 'Z:\\\\q.pptx', after: 'other', extra: {} }), rq, { submit: true }).length === 1);
    ok('the tool\'s required extra field must be answered; "only for" another type does not apply (Q5)', sub({ extra: {} }).length === 1 && !sub({}).some(function (x) { return /Depth/.test(x); }));
    ok('a BKM of another tool is refused', D.requestProblems(Object.assign({}, full, { tool_id: 't2', type_id: 'm2', bkm_id: 'b1', after: 'back_to_me', extra: {} }), rq, {}).length === 1);
    eq('warnings (Q44): QVM in Maintenance past the date, and no BKM', D.submitWarnings({ tool_id: 't2', needed_by: '2026-10-01', lot_id: 'l1', panels: [1] }, rq).map(function (w) { return w.code; }), ['tool_down', 'no_bkm']);
    eq('...no warning when the tool is back before the date', D.submitWarnings({ tool_id: 't2', needed_by: '2026-10-20', bkm_path: 'Z:\\x', lot_id: 'l1', panels: [1] }, rq), []);
    rq.requests = [{ id: 'r9', request_no: 'FIB-260920-01', status: 'accepted', tool_id: 't1', lot_id: 'l1', panels: [2, 3] }];
    eq('...an open request on the same lot, tool and a shared panel', D.submitWarnings(full, rq).map(function (w) { return w.code; }), ['duplicate']);
    rq.requests[0].status = 'completed';
    eq('...not once it is completed', D.submitWarnings(full, rq), []);
    var engU = { id: 'e1', roles: ['engineer'], active: true };
    eq('drafts are private (Q33)', [D.canSeeRequest(engU, { status: 'draft', requester_id: 'e1' }), D.canSeeRequest(engU, { status: 'draft', requester_id: 'x' }), D.canSeeRequest(engU, { status: 'submitted', requester_id: 'x' })], [true, false, true]);
    eq('several lot numbers: commas, spaces, lines, runs, each once', D.parseLotNumbers('18178, 18179\n18181-18183 18178 18178.01'),
       { numbers: ['18178', '18179', '18181', '18182', '18183', '18178.01'], errors: [] });
    eq('...bad ones are named; a run goes up, at most 100', D.parseLotNumbers('L1, 18180-18170, 1-200').errors.length, 3);
    ok('lot numbers: 5 digits, a split lot adds .01 (M2-1)', D.isLotNumber('18178') && D.isLotNumber('18178.01') && D.isLotNumber('18178.2'));
    ok('...not letters, dashes or a trailing dot', !D.isLotNumber('L18178') && !D.isLotNumber('18178-01') && !D.isLotNumber('18178.') && !D.isLotNumber('18178.001'));
    var lotB = Object.assign({}, base, { users: base.users, buildups: [{ id: 'b1', code: 'BU-01' }],
      part_numbers: [{ id: 'pn1', code: 'PN-100', project_ids: ['p1'] }], lots: [{ id: 'l1', lot_number: '18178' }] });
    var goodLot = { lot_number: '18179', project_id: 'p1', part_number_id: 'pn1', buildup_id: 'b1', panel_count: 12, owner_id: 'u1' };
    eq('a good lot', D.validateEntry('lots', goodLot, lotB), []);
    ok('a lot number is registered once', D.validateEntry('lots', Object.assign({}, goodLot, { lot_number: '18178' }), lotB).length === 1);
    ok('...editing it keeps its number', !D.validateEntry('lots', Object.assign({}, goodLot, { id: 'l1', lot_number: '18178' }), lotB).length);
    ok('a lot\'s part number must be of its project', D.validateEntry('lots', Object.assign({}, goodLot, { project_id: 'p2' }), lotB).length === 1);
    ok('...a part number is optional', !D.validateEntry('lots', Object.assign({}, goodLot, { part_number_id: null }), lotB).length);
    ok('a lot needs a project and a build-up', D.validateEntry('lots', Object.assign({}, goodLot, { project_id: null, part_number_id: null, buildup_id: 'x' }), lotB).length === 2);
    ok('panels: a whole number 1-' + D.LOT_MAX_PANELS, [0, 1.5, D.LOT_MAX_PANELS + 1].every(function (n) {
      return D.validateEntry('lots', Object.assign({}, goodLot, { panel_count: n }), lotB).length === 1; }) &&
      !D.validateEntry('lots', Object.assign({}, goodLot, { panel_count: D.LOT_MAX_PANELS }), lotB).length);
    var eng = { id: 'e1', roles: ['engineer'], active: true }, qe = { id: 'q1', roles: ['quality'], active: true }, adm = { id: 'a1', roles: ['admin'], active: true };
    eq('engineers and admins register lots, a quality engineer alone does not', [D.canRegisterLot(eng), D.canRegisterLot(adm), D.canRegisterLot(qe)], [true, true, false]);
    eq('the owner and admins change a lot, others not', [D.canEditLot(eng, { owner_id: 'e1' }), D.canEditLot(adm, { owner_id: 'e1' }), D.canEditLot(qe, { owner_id: 'e1' })], [true, true, false]);
    ok('...up to 30 characters', D.isPartNumber(new Array(31).join('A')) && !D.isPartNumber(new Array(32).join('A')));
    ok('a holiday date is listed once', probs('holidays', { date: '2026-12-25', name: 'x', kind: 'closing' }).length === 1);
    ok('a Windows ID belongs to one person', probs('users', { name: 'B', roles: ['engineer'], windows_id: 'aa' }).length === 1);
    ok('an email belongs to one person', probs('users', { name: 'B', roles: ['engineer'], email: 'A@corp.com' }).length === 1);
    ok('unknown roles are refused', probs('users', { name: 'B', roles: ['boss'] }).length === 1);
    var away = { away_from: '2026-10-01', away_until: '2026-10-05', away_note: 'Tom covers' };
    eq('away: before the first day it is planned', D.awayState(away, '2026-09-30').state, 'planned');
    eq('...first and last day count as away', [D.isAway(away, '2026-10-01'), D.isAway(away, '2026-10-05')], [true, true]);
    eq('...the day after it is over', D.awayState(away, '2026-10-06').state, 'over');
    ok('...no last day = until further notice', D.isAway({ away_from: '2026-10-01' }, '2027-06-01'));
    eq('...nobody is away without dates', [D.awayState({}, '2026-10-01'), D.isAway(null, '2026-10-01')], [null, false]);
    eq('a good away period', D.validateAway({ from: '2026-10-01', until: '2026-10-01', note: '' }), []);
    ok('away needs a first day', D.validateAway({ from: '', until: '2026-10-05' }).length === 1);
    ok('...and the last day not before it', D.validateAway({ from: '2026-10-05', until: '2026-10-01' }).length === 1);
    ok('...and a short note', D.validateAway({ from: '2026-10-01', note: new Array(202).join('x') }).length === 1);
    ok('a user with a bad away period is refused', probs('users', { name: 'B', roles: ['engineer'], away_from: '2026-10-05', away_until: '2026-10-01' }).length === 1);
    eq('priorities: one active default', D.validatePriorities([{ is_default: true, active: true }, { active: true }]), []);
    ok('two defaults are refused', D.validatePriorities([{ is_default: true }, { is_default: true }]).length === 1);
    ok('a hidden default is refused', D.validatePriorities([{ is_default: true, active: false }, { active: true }]).length === 1);

    /* =============== store: first run and seed =============== */
    group('Store: first run and seed data (M1-5, M1-8, M1-9)');
    var seed = ST._pure.seedData(Date.parse('2026-09-24T10:00:00Z'));
    eq('schema 7, revision 0', [seed.schema_version, seed.revision], [7, 0]);
    eq('on-hold reasons (M3-4)', seed.hold_reasons.map(function (h) { return h.name; }), ['Waiting for panels', 'Tool down', 'Waiting for engineer info', 'Higher priority first', 'Other']);
    eq('no requests in a new file', [seed.requests, seed.request_events], [[], []]);
    eq('seven sample lot fields (first ideas)', seed.lot_fields.map(function (f) { return f.label + (f.sample ? '*' : ''); }),
       ['Purpose of the lot*', 'Started on*', 'Started by*', 'DOE / experiment ID*', 'Customer*', 'Expected finish*', 'Lot status*']);
    ok('...all valid, choices with IDs', seed.lot_fields.every(function (f) { return !D.validateEntry('lot_fields', f, seed).length; }) &&
       seed.lot_fields[0].choices.length === 6 && /^ch_/.test(seed.lot_fields[0].choices[0].id));
    eq('no lots in a new file', seed.lots, []);
    ok('every collection is present', ST.COLLECTIONS.every(function (c) { return Array.isArray(seed[c]); }));
    eq('no people in a new file', seed.users.length, 0);
    eq('five tools, all Up', seed.tools.map(function (t) { return t.code + ':' + t.status; }), ['HRM:up', 'AOI:up', 'PRF:up', 'QVM:up', 'FIB:up']);
    eq('five sample types per tool', seed.measurement_types.length, 25);
    ok('every seeded type is marked sample', seed.measurement_types.every(function (m) { return m.sample === true; }));
    eq('one sample BKM per type', seed.bkms.length, 25);
    ok('sample BKMs point at the fake share', seed.bkms.every(function (b) { return b.sample && b.path.indexOf('\\\\SAMPLE-SHARE\\BKM\\') === 0 && D.isSharePath(b.path); }));
    eq('priorities', seed.priorities.map(function (p) { return p.code + ' ' + p.name; }), ['P1 Line stop', 'P2 Hot', 'P3 Normal', 'P4 Low']);
    eq('Normal is the default', seed.priorities.filter(function (p) { return p.is_default; })[0].code, 'P3');
    eq('Line stop and Hot need a reason', seed.priorities.filter(function (p) { return p.needs_reason; }).map(function (p) { return p.code; }), ['P1', 'P2']);
    eq('projects as in ABF', seed.projects.map(function (p) { return p.code; }), ['C4F', 'SHIFT', 'HORUS']);
    eq('build-ups as in ABF', seed.buildups.map(function (b) { return b.code; }), ['BU-01', 'BU-02', 'BU-03', 'BU-04', 'BU-05', 'TEST', 'DOE', 'OPT']);
    eq('no part numbers yet (none known)', seed.part_numbers, []);
    eq('no process steps yet (none known)', seed.process_steps, []);
    eq('only FIB is destructive (M2-11)', seed.tools.filter(function (t) { return t.destructive; }).map(function (t) { return t.code; }), ['FIB']);
    eq('holidays of this year and next', seed.holidays.length, 26);
    eq('first and last holiday', [seed.holidays[0].date, seed.holidays[25].date], ['2026-01-01', '2027-12-26']);
    ok('every seeded list entry is valid', ['tools', 'measurement_types', 'bkms', 'projects', 'buildups', 'priorities', 'holidays'].every(function (c) {
      return seed[c].every(function (r) { return !D.validateEntry(c, r, seed).length; });
    }));
    ok('all IDs are unique', (function () {
      var ids = {}, dup = false;
      ST.COLLECTIONS.forEach(function (c) { seed[c].forEach(function (r) { if (r.id) { if (ids[r.id]) dup = true; ids[r.id] = 1; } }); });
      return !dup;
    })());

    // seed.js can carry real extra fields and closing days - no code change needed
    var custom = { calendar: { days: [1, 2, 3, 4, 5, 6], start: '06:00', end: '22:00' },
                   closing_days: [{ date: '2026-12-24', name: 'Christmas Eve' }, { date: '2026-12-25', name: 'dup of a public holiday' }],
                   priorities: [{ code: 'P1', name: 'Normal', level: 1, is_default: true }], buildups: [],
                   projects: [{ code: 'C4F' }, { code: 'NOVA' }],
                   part_numbers: [{ code: 'PN-1', description: 'Test board', projects: ['C4F', 'NOVA'] }],
                   tools: [{ code: 'SEM', name: 'SEM', glyph: 'generic', results_root: '\\\\srv\\lab\\SEM',
                     types: [{ name: 'Top view' }, { name: 'Tilt view', sample: true }],
                     bkms: [{ name: 'SEM BKM', type: 'Top view', path: 'Z:\\BKM\\sem.pdf', doc_version: 'v3' }],
                     fields: [{ label: 'Tilt angle', type: 'number', unit: 'deg', min: 0, max: 60, only_for: ['Tilt view'] },
                              { label: 'Detector', type: 'choice', choices: ['SE', 'BSE'] }] }] };
    var cs = ST._pure.seedData(Date.parse('2026-09-24T10:00:00Z'), custom);
    eq('seed: calendar from seed.js', JSON.parse(cs.settings.filter(function (x) { return x.key === 'lab_start'; })[0].value_json), '06:00');
    eq('seed: only entries marked sample are sample', cs.measurement_types.map(function (m) { return !!m.sample; }), [false, true]);
    eq('seed: a real BKM links its type by name', cs.bkms[0].type_id, cs.measurement_types[0].id);
    eq('seed: extra fields with unit, limits and "only for"', [cs.tool_fields[0].unit, cs.tool_fields[0].max, cs.tool_fields[0].type_ids[0]], ['deg', 60, cs.measurement_types[1].id]);
    eq('seed: choices get IDs', cs.tool_fields[1].choices.map(function (c) { return c.label + ':' + /^ch_/.test(c.id); }), ['SE:true', 'BSE:true']);
    eq('seed: a part number links its projects by code', cs.part_numbers[0].project_ids, [cs.projects[0].id, cs.projects[1].id]);
    ok('seed: every entry is valid', ['tools', 'measurement_types', 'tool_fields', 'bkms', 'holidays', 'part_numbers'].every(function (c) {
      return cs[c].every(function (r) { return !D.validateEntry(c, r, cs).length; }); }));
    eq('seed: closing day added, a date already a public holiday is skipped',
       cs.holidays.filter(function (h) { return h.kind === 'closing'; }).map(function (h) { return h.date; }), ['2026-12-24']);
    ok('seed: holidays in date order', cs.holidays.every(function (h, i) { return !i || cs.holidays[i - 1].date <= h.date; }));
    try { ST._pure.seedData(0, { tools: [{ code: 'X', name: 'X', types: [], bkms: [{ name: 'b', type: 'nope', path: 'Z:\\b' }] }] }); record(false, 'seed: a BKM with an unknown type is refused'); }
    catch (x) { eq('seed: a BKM with an unknown type is refused', x.code, 'bad_seed'); }
    try { ST._pure.seedData(0, { tools: [], projects: [{ code: 'C4F' }], part_numbers: [{ code: 'PN-1', projects: ['NOPE'] }] }); record(false, 'seed: a part number with an unknown project is refused'); }
    catch (x) { eq('seed: a part number with an unknown project is refused', x.code, 'bad_seed'); }

    var a = await freshStore();
    ok('first load writes the file', !!a.files[cfg.data_file]);
    eq('lab calendar Mon-Fri 07:00-18:00', ST.calendar(), { days: [1, 2, 3, 4, 5], start: '07:00', end: '18:00' });
    eq('no PIN yet', ST.hasPin(), false);
    await refused('a PIN of 3 digits is refused', ST.createFirstAdmin({ name: 'Prince Khurana', windows_id: 'pkhurana', pin: '123' }), 'bad_pin');
    await refused('a bad Windows ID is refused', ST.createFirstAdmin({ name: 'Prince Khurana', windows_id: 'p k', pin: '1234' }), 'bad_identity');
    eq('...and nobody was created', ST.data().users.length, 0);
    var first = await ST.createFirstAdmin({ name: ' Prince Khurana ', windows_id: 'CORP\\PKhurana', pin: '2468' });
    eq('the first person is Admin', first.roles, ['admin']);
    eq('ID stored lowercase with the domain apart', [first.windows_id, first.domain], ['pkhurana', 'CORP']);
    eq('...and is signed in', ST.currentUser().id, first.id);
    eq('the file is saved as revision 1', fileOf(a).revision, 1);
    ok('the PIN is stored hashed, never plain', fileOf(a).settings.every(function (s) { return s.value_json.indexOf('2468') === -1; }));
    eq('the right PIN opens', await ST.verifyPin('2468'), true);
    eq('a wrong PIN does not', await ST.verifyPin('1357'), false);
    eq('first run cannot be undone', ST.undoInfo(), null);
    await refused('a second "first admin" is refused', ST.createFirstAdmin({ name: 'Eve', windows_id: 'eve', pin: '1111' }), 'not_first');
    ST.signOut();
    eq('sign out: nobody is signed in', ST.currentUser(), null);
    await refused('...and nothing can be changed', ST.saveEntry('projects', { fields: { code: 'X' } }), 'no_user');
    ST.setCurrentUser(first.id);
    eq('launcher ID finds the user (any case)', (ST.findUserByIdentity(D.parseWindowsLogin('PKHURANA')) || {}).id, first.id);
    eq('another domain does not', ST.findUserByIdentity(D.parseWindowsLogin('LAB\\pkhurana')), null);

    /* =============== store: sign-up and "Is this you?" =============== */
    group('Store: self sign-up and "Is this you?" (M1-5)');
    a = await adminStore();
    var anna = await ST.saveEntry('users', { fields: { name: 'Anna Berger', roles: ['operator'] } });
    eq('an admin adds Anna without a Windows ID', anna.windows_id, null);
    ST.setCurrentUser(anna.id);
    await refused('only admins add people', ST.saveEntry('users', { fields: { name: 'X', roles: ['engineer'] } }), 'not_admin');
    ST.init(a); await ST.load();
    eq('nobody is signed in after a reload', ST.currentUser(), null);
    eq('"Is this you?" finds Anna by name', ST.nameMatches('anna  BERGER').map(function (u) { return u.name; }), ['Anna Berger']);
    var e = await refused('signing up with her name asks first', ST.selfRegister({ name: 'Anna Berger', windows_id: 'aberger' }), 'name_match');
    eq('...and offers her as a match', e && e.detail.map(function (m) { return m.name + ':' + m.linked; }), ['Anna Berger:false']);
    var linked = await ST.linkIdentity(anna.id, { windows_id: 'ABerger' });
    eq('"yes, that is me" links the Windows ID', linked.windows_id, 'aberger');
    eq('...signs her in', ST.currentUser().id, anna.id);
    eq('...and is audited', ST.data().audit_log.filter(function (x) { return x.action === 'link_identity'; }).length, 1);
    await refused('an already linked user is never relinked', ST.linkIdentity(anna.id, { windows_id: 'someoneelse' }), 'already_linked');
    ST.init(a); await ST.load();
    var tom = await ST.selfRegister({ name: 'Tom Huber', windows_id: 'thuber', email: 'tom.huber@corp.com' });
    eq('a new person adds themselves as Engineer only', tom.roles, ['engineer']);
    eq('...marked New for the admins', [tom.self_added, tom.needs_review], [true, true]);
    eq('...and is signed in', ST.currentUser().id, tom.id);
    eq('sign-up cannot be undone', ST.undoInfo(), null);
    ST.init(a); await ST.load();
    await refused('the same Windows ID cannot sign up twice', ST.selfRegister({ name: 'Tom H', windows_id: 'thuber' }), 'identity_taken');
    var tom2 = await ST.selfRegister({ name: 'tom huber', windows_id: 'thuber2', confirmed_new: true });
    ok('"no, I am someone else" creates a second person', tom2.id !== tom.id);
    ST.init(a); await ST.load(); ST.setCurrentUser(ST.findUserByIdentity({ windows_id: 'pkhurana' }).id);
    await ST.markUserReviewed(tom.id);
    eq('an admin clears the New mark', ST.byId('users', tom.id).needs_review, false);
    await refused('the last admin cannot lose the role', ST.saveEntry('users', { id: ST.currentUser().id, fields: { roles: ['engineer'] } }), 'invalid');
    eq('...and still has it', ST.currentUser().roles, ['admin']);
    await refused('people are never deleted', ST.deleteEntry('users', tom.id, 'left'));

    group('Store: away (M1-14)');
    var admin = ST.currentUser();
    var olga = await ST.saveEntry('users', { fields: { name: 'Olga Quality', roles: ['quality'] } });
    var olgaAway = await ST.setAway(olga.id, { from: '2026-10-01', until: '2026-10-05', note: '  Tom covers  ' }, 'Settings');
    eq('an admin records away for someone', [olgaAway.away_from, olgaAway.away_until, olgaAway.away_note], ['2026-10-01', '2026-10-05', 'Tom covers']);
    var awayAudit = ST.data().audit_log.filter(function (x) { return x.action === 'away' && x.entity_id === olga.id; });
    eq('...audited per field, no reason field of its own', awayAudit.map(function (x) { return x.field; }), ['away_from', 'away_until', 'away_note']);
    ok('...the user has no reason stored', !('away_reason' in ST.byId('users', olga.id)));
    await refused('a last day before the first is refused', ST.setAway(olga.id, { from: '2026-10-05', until: '2026-10-01' }), 'invalid');
    eq('...and not written', ST.byId('users', olga.id).away_until, '2026-10-05');
    await refused('the same dates again: nothing changed', ST.setAway(olga.id, { from: '2026-10-01', until: '2026-10-05', note: 'Tom covers' }), 'no_change');
    ST.setCurrentUser(tom.id);
    await refused('an engineer cannot set someone else away', ST.setAway(olga.id, null), 'not_allowed');
    var tomAway = await ST.setAway(tom.id, { from: '2026-12-21' });
    eq('...but can set themselves away, until further notice', [tomAway.away_from, tomAway.away_until], ['2026-12-21', null]);
    var tomBack = await ST.setAway(tom.id, null);
    eq('"I\'m back" clears it', [tomBack.away_from, tomBack.away_until, tomBack.away_note], [null, null, null]);
    await refused('...once', ST.setAway(tom.id, null), 'no_change');
    ST.setCurrentUser(admin.id);
    await ST.saveEntry('users', { id: olga.id, fields: { email: 'olga@corp.com' } });
    eq('editing a person in Settings keeps their away dates', ST.byId('users', olga.id).away_from, '2026-10-01');

    /* =============== store: lists =============== */
    group('Store: lists (tools, types, fields, BKMs, codes, priorities, holidays)');
    a = await adminStore();
    var before = auditCount(), toolsBefore = ST.data().tools.length;
    await refused('a duplicate tool code is refused', ST.saveEntry('tools', { fields: { code: 'fib', name: 'Second FIB' } }), 'invalid');
    eq('...nothing changed in memory', [ST.data().tools.length, auditCount()], [toolsBefore, before]);
    var sem = await ST.saveEntry('tools', { fields: { code: 'sem', name: 'SEM', glyph: 'generic' } });
    eq('a new tool: code upper case, version 1, Up', [sem.code, sem.version, sem.status], ['SEM', 1, 'up']);
    eq('...audited', ST.data().audit_log.slice(-1)[0].action, 'create');
    await refused('saving without a change is refused', ST.saveEntry('tools', { id: sem.id, fields: { name: 'SEM' } }), 'no_change');
    await refused('an old version is refused', ST.saveEntry('tools', { id: sem.id, version: 0, fields: { name: 'SEM 2' } }), 'stale_version');
    var semOps = await ST.saveEntry('tools', { id: sem.id, fields: { results_root: '\\\\srv\\lab\\SEM' } });
    eq('an edit bumps the version', semOps.version, 2);

    var t = typesOf('PRF')[0];
    var edited = await ST.saveEntry('measurement_types', { id: t.id, fields: { name: '2D line profile' } });
    eq('editing a sample type makes it real', edited.sample, false);
    var t2 = typesOf('PRF')[1];
    var confirmed = await ST.saveEntry('measurement_types', { id: t2.id, fields: { name: t2.name } });
    eq('saving a sample unchanged confirms it as real', [confirmed.sample, confirmed.name], [false, t2.name]);
    await refused('...a second time it is "nothing changed"', ST.saveEntry('measurement_types', { id: t2.id, fields: { name: t2.name } }), 'no_change');
    await refused('a type cannot move to another tool', ST.saveEntry('measurement_types', { id: t.id, fields: { tool_id: tool('FIB').id } }));

    var side = await ST.saveEntry('tool_fields', { fields: { tool_id: tool('FIB').id, label: 'Cut side', type: 'choice',
      choices: [{ label: 'Front' }, { label: 'Back' }, { label: 'Edge' }] } });
    ok('choices get IDs', side.choices.every(function (c) { return /^ch_/.test(c.id); }));
    var edge = side.choices[2];
    var side2 = await ST.saveEntry('tool_fields', { id: side.id, fields: { choices: side.choices.slice(0, 2).concat([{ label: 'Corner' }]) } });
    eq('a removed choice stays, hidden (Q47)', side2.choices.filter(function (c) { return c.id === edge.id; }).map(function (c) { return c.active; }), [false]);
    eq('the kept choices keep their IDs', side2.choices[0].id, side.choices[0].id);

    var prios = ST.list('priorities');
    var p1 = prios[0], p3 = prios[2];
    await ST.saveEntry('priorities', { id: p1.id, fields: { is_default: true } });
    eq('a new default replaces the old one', ST.list('priorities').filter(function (p) { return p.is_default; }).map(function (p) { return p.code; }), ['P1']);
    await refused('the default cannot be hidden', ST.saveEntry('priorities', { id: p1.id, fields: { active: false } }), 'invalid');
    await ST.saveEntry('priorities', { id: p1.id, fields: { name: 'LINE STOP' } });
    eq('a rename keeps the ID (lists by ID, Q47)', ST.byId('priorities', p1.id).name, 'LINE STOP');
    await ST.saveEntry('priorities', { id: p3.id, fields: { is_default: true } });

    var usage = ST.entryUsage('tools', tool('HRM').id);
    eq('a tool\'s use is counted', usage.text, '5 measurement types, 5 BKMs');
    await refused('a used tool cannot be deleted', ST.deleteEntry('tools', tool('HRM').id, 'test'), 'in_use');
    await refused('a delete needs a reason', ST.deleteEntry('tools', sem.id, ''));
    await ST.deleteEntry('tools', sem.id, 'added by mistake');
    eq('an unused tool can be deleted', ST.byId('tools', sem.id), null);
    eq('...and the audit keeps it', ST.data().audit_log.slice(-1)[0].old_value, 'SEM');
    var fibType = typesOf('FIB')[0];
    await ST.saveEntry('tool_fields', { id: side.id, fields: { type_ids: [fibType.id] } });
    eq('"only for" counts as a use of the type', ST.entryUsage('measurement_types', fibType.id).text, '1 BKM, 1 field');

    var closing = await ST.saveEntry('holidays', { fields: { date: '2026-12-24', name: 'Christmas Eve' } });
    eq('a company closing day', [closing.kind, closing.source], ['closing', 'manual']);
    await refused('the same date twice is refused', ST.saveEntry('holidays', { fields: { date: '2026-12-24', name: 'x' } }), 'invalid');
    eq('public holidays for a new year', await ST.addPublicHolidays(2028), 13);
    await refused('...not twice', ST.addPublicHolidays(2028), 'no_change');

    await refused('a bad calendar is refused', ST.updateCalendar({ days: [1, 2], start: '18:00', end: '07:00' }), 'invalid');
    eq('...and not written', ST.calendar().start, '07:00');
    await ST.updateCalendar({ days: [6, 1, 2, 3, 4, 5], start: '06:00', end: '22:00' }, 'two shifts');
    eq('a new calendar is stored, days in order', ST.calendar(), { days: [1, 2, 3, 4, 5, 6], start: '06:00', end: '22:00' });

    var prj = ST.list('projects');
    var pn = await ST.saveEntry('part_numbers', { fields: { code: ' pn-10234-a ', description: ' Test vehicle ', project_ids: [prj[0].id, prj[1].id, prj[0].id] } });
    eq('a part number: code upper case, text trimmed, projects once', [pn.code, pn.description, pn.project_ids], ['PN-10234-A', 'Test vehicle', [prj[0].id, prj[1].id]]);
    ok('...ID prefix pn_, audited', /^pn_/.test(pn.id) && ST.data().audit_log.slice(-1)[0].entity === 'part_number');
    await refused('the same part number twice is refused', ST.saveEntry('part_numbers', { fields: { code: 'PN-10234-A', project_ids: [prj[2].id] } }), 'invalid');
    await refused('a part number without a project is refused', ST.saveEntry('part_numbers', { fields: { code: 'PN-2', project_ids: [] } }), 'invalid');
    eq('a project used by a part number counts as used', ST.entryUsage('projects', prj[1].id).text, '1 part number');
    await refused('...so it cannot be deleted', ST.deleteEntry('projects', prj[1].id, 'test'), 'in_use');
    await ST.saveEntry('part_numbers', { id: pn.id, fields: { project_ids: [prj[0].id] } });
    await ST.deleteEntry('projects', prj[1].id, 'unused now');
    eq('once unlinked, the project can go', ST.byId('projects', prj[1].id), null);
    await ST.deleteEntry('part_numbers', pn.id, 'test');
    var ps1 = await ST.saveEntry('process_steps', { fields: { name: ' After desmear ' } });
    var ps2 = await ST.saveEntry('process_steps', { fields: { name: 'After Cu plating' } });
    eq('process steps: trimmed, numbered in the order added', [ps1.name, ps1.sort, ps2.sort, /^pstep_/.test(ps1.id)], ['After desmear', 1, 2, true]);
    await ST.saveEntry('process_steps', { id: ps2.id, fields: { sort: 0.5 + 0.5 } });
    eq('...a new position puts it first', ST.list('process_steps').map(function (x) { return x.name; }), ['After Cu plating', 'After desmear']);
    await refused('...the same step twice is refused', ST.saveEntry('process_steps', { fields: { name: 'after desmear' } }), 'invalid');
    group('Store: lots (M2-1)');
    var prjL = ST.list('projects')[0], buL = ST.list('buildups')[0];
    var pnL = await ST.saveEntry('part_numbers', { fields: { code: 'PN-L1', project_ids: [prjL.id] } });
    var lot = await ST.saveLot({ fields: { lot_number: ' 18178 ', project_id: prjL.id, part_number_id: pnL.id, buildup_id: buL.id, panel_count: 12, note: ' scratch on 3 ' } });
    eq('a lot: trimmed, owned by who registers it, version 1', [lot.lot_number, lot.note, lot.owner_id, lot.version, /^lot_/.test(lot.id)], ['18178', 'scratch on 3', ST.currentUser().id, 1, true]);
    ok('...audited', ST.data().audit_log.slice(-1)[0].entity === 'lot' && ST.data().audit_log.slice(-1)[0].new_value === '18178');
    await refused('the same lot number twice is refused', ST.saveLot({ fields: { lot_number: '18178', project_id: prjL.id, buildup_id: buL.id, panel_count: 2 } }), 'invalid');
    var lot2 = await ST.saveLot({ id: lot.id, version: 1, fields: { panel_count: 16, part_number_id: '' } });
    eq('an edit: new count, part number cleared, version 2', [lot2.panel_count, lot2.part_number_id, lot2.version], [16, null, 2]);
    await refused('...an old version is refused', ST.saveLot({ id: lot.id, version: 1, fields: { panel_count: 20 } }), 'stale_version');
    await refused('...no change is "nothing changed"', ST.saveLot({ id: lot.id, fields: { panel_count: 16 } }), 'no_change');
    eq('a build-up with lots counts as used', ST.entryUsage('buildups', buL.id).text, '1 lot');
    var tomL = await ST.saveEntry('users', { fields: { name: 'Tom Lot', roles: ['engineer'] } });
    var qeL = await ST.saveEntry('users', { fields: { name: 'Quinn QE', roles: ['quality'] } });
    var adminL = ST.currentUser().id;
    ST.setCurrentUser(qeL.id);
    await refused('a quality engineer alone cannot register a lot', ST.saveLot({ fields: { lot_number: '18180', project_id: prjL.id, buildup_id: buL.id, panel_count: 2 } }), 'not_allowed');
    ST.setCurrentUser(tomL.id);
    var tomLot = await ST.saveLot({ fields: { lot_number: '18178.01', project_id: prjL.id, buildup_id: buL.id, panel_count: 4 } });
    eq('an engineer registers a split lot and owns it', [tomLot.lot_number, tomLot.owner_id], ['18178.01', tomL.id]);
    await refused('...but cannot change someone else\'s lot', ST.saveLot({ id: lot.id, fields: { panel_count: 3 } }), 'not_allowed');
    await refused('...a delete needs a reason', ST.deleteLot(tomLot.id, ''));
    await ST.deleteLot(tomLot.id, 'typo');
    eq('...and deletes their own unused lot', ST.byId('lots', tomLot.id), null);
    ST.setCurrentUser(adminL);

    group('Store: lot fields and sample lots');
    var purpose = ST.list('lot_fields')[0], startOn = ST.list('lot_fields')[1];
    var devId = purpose.choices[0].id;
    var lx = await ST.saveLot({ fields: { lot_number: '18190', project_id: prjL.id, buildup_id: buL.id, panel_count: 6,
      extra: (function () { var e = {}; e[purpose.id] = devId; e[startOn.id] = '2026-09-01'; e[ST.list('lot_fields')[2].id] = '  '; return e; })() } });
    eq('a lot stores its lot-field answers by field ID, empty ones dropped', Object.keys(lx.extra).sort(), [purpose.id, startOn.id].sort());
    await refused('a bad date is refused', ST.saveLot({ id: lx.id, fields: { extra: (function () { var e = {}; e[startOn.id] = '1.9.2026'; return e; })() } }), 'invalid');
    await refused('a choice must be one of the field\'s', ST.saveLot({ id: lx.id, fields: { extra: (function () { var e = {}; e[purpose.id] = 'ch_nope'; return e; })() } }), 'invalid');
    await refused('an unknown field is refused', ST.saveLot({ id: lx.id, fields: { extra: { lfld_nope: 'x' } } }), 'invalid');
    var req = await ST.saveEntry('lot_fields', { fields: { label: 'Customer PO', type: 'text', required: true } });
    await refused('a new required lot field must be answered on the next edit', ST.saveLot({ id: lx.id, fields: { panel_count: 7 } }), 'invalid');
    await ST.saveEntry('lot_fields', { id: req.id, fields: { required: false } });
    await ST.saveEntry('lot_fields', { id: purpose.id, fields: { choices: purpose.choices.slice(1) } });
    eq('a removed choice is hidden; the lot keeps its answer', [ST.byId('lots', lx.id).extra[purpose.id], ST.byId('lot_fields', purpose.id).choices.filter(function (c) { return c.id === devId; })[0].active], [devId, false]);
    await ST.saveLot({ id: lx.id, fields: { panel_count: 7 } });
    eq('...and the lot still saves', ST.byId('lots', lx.id).panel_count, 7);
    eq('a lot field with answers counts as used', ST.entryUsage('lot_fields', purpose.id).text, '1 lot');
    await refused('...so it cannot be deleted', ST.deleteEntry('lot_fields', purpose.id, 'x'), 'in_use');
    var added = await ST.addSampleLots();
    var sl = ST.data().lots.filter(function (l) { return l.sample; });
    eq('3 sample lots, tagged, owned by the admin', [added, sl.map(function (l) { return l.lot_number; }).join(), sl.every(function (l) { return l.owner_id === adminL; })], [3, '99901,99902,99902.01', true]);
    ok('...listed in Health', codes(ST.health().todo).indexOf('sample_lots') !== -1);
    await refused('...not twice', ST.addSampleLots(), 'no_change');
    ST.setCurrentUser(tomL.id);
    await refused('...only admins add them', ST.addSampleLots(), 'not_admin');
    ST.setCurrentUser(adminL);

    group('Store: Settings > Lots - several at once, owner');
    var many = await ST.addLots({ numbers: ['20001', '20002', '20003'], fields: { project_id: prjL.id, buildup_id: buL.id, panel_count: 8, note: ' batch ' } });
    eq('an admin adds three lots at once, same set-up, owned by the admin', many.map(function (l) { return l.lot_number + ':' + l.panel_count + ':' + l.note + ':' + (l.owner_id === adminL); }),
       ['20001:8:batch:true', '20002:8:batch:true', '20003:8:batch:true']);
    var before3 = ST.data().lots.length;
    await refused('one number already registered stops the whole batch', ST.addLots({ numbers: ['20004', '20002'], fields: { project_id: prjL.id, buildup_id: buL.id, panel_count: 8 } }), 'invalid');
    eq('...nothing added', ST.data().lots.length, before3);
    await refused('...and a bad panel count too', ST.addLots({ numbers: ['20005'], fields: { project_id: prjL.id, buildup_id: buL.id, panel_count: 0 } }), 'invalid');
    var own = await ST.setLotOwner(many[0].id, tomL.id, 'Tom runs this DOE');
    eq('an admin gives a lot to someone else, with a reason', [own.owner_id, ST.data().audit_log.slice(-1)[0].field], [tomL.id, 'owner_id']);
    await refused('...a reason is required', ST.setLotOwner(many[0].id, adminL, ''), 'invalid');
    ST.setCurrentUser(tomL.id);
    await refused('an engineer cannot add lots in bulk', ST.addLots({ numbers: ['20009'], fields: { project_id: prjL.id, buildup_id: buL.id, panel_count: 2 } }), 'not_admin');
    ST.setCurrentUser(adminL);

    group('Store: requests - drafts and submit (M2 step 4)');
    var qvm = tool('QVM'), qType = typesOf('QVM')[0];
    var normal = ST.list('priorities').filter(function (p) { return p.is_default; })[0];
    var d1 = await ST.saveDraft({ fields: { tool_id: qvm.id, purpose: '  pads  ' } });
    eq('a draft: no ID yet, trimmed, private, timeline "created"', [d1.status, d1.request_no, d1.purpose, d1.requester_id, ST.requestEvents(d1.id).map(function (e) { return e.kind; })],
       ['draft', null, 'pads', adminL, ['created']]);
    await refused('a draft without a tool is refused', ST.saveDraft({ fields: { purpose: 'x' } }), 'invalid');
    await refused('...saving it unchanged is "nothing changed"', ST.saveDraft({ id: d1.id, fields: { purpose: 'pads' } }), 'no_change');
    await refused('submit checks everything', ST.submitRequest({ id: d1.id, fields: {} }), 'invalid');
    eq('...and changes nothing', [ST.byId('requests', d1.id).status, ST.byId('requests', d1.id).request_no], ['draft', null]);
    var s1 = await ST.submitRequest({ id: d1.id, fields: { type_id: qType.id, lot_id: lx.id, panels: [3, 1, 3], priority_id: normal.id, panel_location: 'Rack B2', after: 'back_to_me', bkm_path: 'Z:\\bkm\\my.pptx' } });
    ok('submitted: ID QVM-YYMMDD-01, panels sorted once', /^QVM-\d{6}-01$/.test(s1.request_no) && s1.status === 'submitted' && s1.panels.join() === '1,3' && !!s1.submitted_ts);
    eq('...timeline: created, then draft -> submitted', ST.requestEvents(s1.id).map(function (e) { return e.kind + ':' + e.from + '>' + e.to; }), ['created:null>draft', 'status:draft>submitted']);
    ok('...audited with its ID', ST.data().audit_log.slice(-1)[0].action === 'submit' && ST.data().audit_log.slice(-1)[0].reason === s1.request_no);
    var s2 = await ST.submitRequest({ fields: { tool_id: qvm.id, type_id: qType.id, lot_id: lx.id, panels: [2], priority_id: normal.id, panel_location: 'Rack B2', after: 'back_to_me', purpose: 'pads' } });
    ok('a second QVM request the same day gets 02 - submitted straight away, no draft first', /^QVM-\d{6}-02$/.test(s2.request_no));
    await refused('a submitted request is not a draft any more', ST.saveDraft({ id: s1.id, fields: { purpose: 'x' } }), 'not_allowed');
    await refused('...and is never deleted (cancel instead, Q35)', ST.deleteDraft(s1.id), 'not_allowed');
    eq('a lot with requests counts them', ST.lotUsage(lx.id).text, '2 requests');
    await refused('...and cannot be deleted', ST.deleteLot(lx.id, 'x'), 'in_use');
    eq('the tool, type and priority count as used', [ST.entryUsage('tools', qvm.id).text.indexOf('2 requests') !== -1, ST.entryUsage('priorities', normal.id).text], [true, '2 requests']);
    var d2 = await ST.saveDraft({ fields: { tool_id: qvm.id } });
    ST.setCurrentUser(tomL.id);
    eq('someone else sees the submitted requests, not the draft', ST.visibleRequests().map(function (r) { return r.request_no; }).sort(), [s1.request_no, s2.request_no].sort());
    await refused('...cannot change it', ST.saveDraft({ id: d2.id, fields: { purpose: 'x' } }), 'not_allowed');
    await refused('...or delete it', ST.deleteDraft(d2.id), 'not_allowed');
    ST.setCurrentUser(qeL.id);
    await refused('a quality engineer alone does not request', ST.saveDraft({ fields: { tool_id: qvm.id } }), 'not_allowed');
    ST.setCurrentUser(adminL);
    await ST.deleteDraft(d2.id);
    eq('the author deletes the draft, and its timeline', [ST.byId('requests', d2.id), ST.requestEvents(d2.id).length], [null, 0]);

    group('Store: comments and cancel (M2 step 5)');
    await ST.saveEntry('users', { id: tomL.id, fields: { windows_id: 'tlot' } });
    await ST.addComment(s1.id, '  please check pad 3, @tlot  ');
    var cm = ST.requestEvents(s1.id).slice(-1)[0];
    eq('a comment: trimmed, by me, @tlot found', [cm.kind, cm.text, cm.user_id, cm.mentions], ['comment', 'please check pad 3, @tlot', adminL, [tomL.id]]);
    await refused('an empty comment is refused', ST.addComment(s1.id, '   '), 'invalid');
    var d3 = await ST.saveDraft({ fields: { tool_id: qvm.id } });
    await refused('no comments on a draft', ST.addComment(d3.id, 'x'), 'not_allowed');
    ST.setCurrentUser(tomL.id);
    await ST.addComment(s1.id, 'seen');
    eq('anyone who can see it may comment', ST.requestEvents(s1.id).filter(function (e) { return e.kind === 'comment'; }).length, 2);
    await refused('someone else cannot cancel it', ST.cancelRequest(s1.id, 'x'), 'not_allowed');
    ST.setCurrentUser(adminL);
    await refused('cancel needs a reason', ST.cancelRequest(s1.id, ' '), 'invalid');
    var c1 = await ST.cancelRequest(s1.id, 'wrong lot');
    eq('cancelled: status, timeline with the reason, still there (Q35)', [c1.status, ST.requestEvents(s1.id).slice(-1)[0].to, ST.requestEvents(s1.id).slice(-1)[0].text, !!ST.byId('requests', s1.id)],
       ['cancelled', 'cancelled', 'wrong lot', true]);
    await refused('...only once', ST.cancelRequest(s1.id, 'again'), 'not_allowed');
    await ST.deleteDraft(d3.id);

    group('Store: the workflow (M3 step 1)');
    await ST.saveEntry('tools', { id: qvm.id, fields: { primary_operator_id: qeL.id } });
    var w = await ST.submitRequest({ fields: { tool_id: qvm.id, type_id: qType.id, lot_id: lx.id, panels: [4], priority_id: normal.id,
      panel_location: 'Rack B2', after: 'back_to_me', purpose: 'pads' } });
    eq('assigned to the primary at submit', w.assigned_to, qeL.id);
    ST.setCurrentUser(tomL.id);
    await refused('an engineer cannot accept', ST.requestAction(w.id, 'accept', {}), 'not_allowed');
    ST.setCurrentUser(qeL.id);
    await refused('...nor can anyone complete before Start', ST.requestAction(w.id, 'complete', { results_path: 'Z:\\r', panels_outcome: 'returned' }), 'not_allowed');
    w = await ST.requestAction(w.id, 'accept', { expected_done: '2026-10-09' });
    eq('Accept with an expected done date (M3-1)', [w.status, w.expected_done], ['accepted', '2026-10-09']);
    await ST.receivePanels(w.id, 'QVM shelf 1');
    eq('Panels received: who, when, where (Q25)', [ST.byId('requests', w.id).received_by, ST.byId('requests', w.id).received_where], [qeL.id, 'QVM shelf 1']);
    await refused('...only once', ST.receivePanels(w.id, 'x'), 'not_allowed');
    var holdR = ST.list('hold_reasons')[1];
    await refused('Hold needs a reason from the list', ST.requestAction(w.id, 'hold', {}), 'invalid');
    w = await ST.requestAction(w.id, 'hold', { hold_reason_id: holdR.id, note: 'stage error' });
    eq('On hold: reason, note, remembers where it was', [w.status, w.hold_reason_id, w.return_to], ['on_hold', holdR.id, 'accepted']);
    w = await ST.requestAction(w.id, 'resume', {});
    eq('Resume goes back to Accepted', [w.status, w.hold_reason_id], ['accepted', null]);
    w = await ST.requestAction(w.id, 'clarify', { text: 'Which pads?' });
    ST.setCurrentUser(adminL);
    w = await ST.requestAction(w.id, 'answer', { text: 'Corner pads' });
    eq('Needs clarification -> Answered goes back to where it was (M3-2)', w.status, 'accepted');
    ST.setCurrentUser(qeL.id);
    w = await ST.requestAction(w.id, 'start', {});
    await refused('Complete needs a results share path', ST.requestAction(w.id, 'complete', { results_path: 'results', panels_outcome: 'returned' }), 'invalid');
    w = await ST.requestAction(w.id, 'complete', { results_path: 'Z:\\lab\\QVM\\x', panels_outcome: 'returned' });
    eq('Complete: results path, panels returned (M3-6)', [w.status, w.results_path, w.panels_outcome, w.completed_by], ['completed', 'Z:\\lab\\QVM\\x', 'returned', qeL.id]);
    ST.setCurrentUser(adminL);
    await refused('Reopen needs a reason', ST.requestAction(w.id, 'reopen', {}), 'invalid');
    w = await ST.requestAction(w.id, 'reopen', { text: 'values look off' });
    eq('Reopen -> Accepted, counted (Q34)', [w.status, w.reopened, w.completed_ts], ['accepted', 1, null]);
    ST.setCurrentUser(qeL.id);
    await ST.requestAction(w.id, 'start', {});
    await ST.requestAction(w.id, 'complete', { results_path: 'Z:\\lab\\QVM\\x', panels_outcome: 'returned' });
    ST.setCurrentUser(adminL);
    w = await ST.requestAction(w.id, 'results_ok', {});
    ok('Results OK closes it', !!w.results_ok_ts && D.isClosed(w, Date.now()));
    eq('...the timeline tells the whole story', ST.requestEvents(w.id).map(function (e) { return e.kind === 'status' ? e.to : e.kind; }),
       ['created', 'submitted', 'accepted', 'panels', 'on_hold', 'accepted', 'clarification', 'accepted', 'in_progress', 'completed', 'accepted', 'in_progress', 'completed', 'results_ok']);

    group('Store: edit a submitted request, take it (M3-5, M3-7)');
    var e1 = await ST.submitRequest({ fields: { tool_id: qvm.id, type_id: qType.id, lot_id: lx.id, panels: [1, 2, 3, 4], priority_id: normal.id,
      panel_location: 'Rack B2', after: 'back_to_me', purpose: 'pads' } });
    await refused('an edit needs a reason', ST.editRequest({ id: e1.id, fields: { panels: [1, 2, 3, 4, 5, 6] } }), 'invalid');
    await refused('...the tool cannot change', ST.editRequest({ id: e1.id, fields: { tool_id: tool('FIB').id }, reason: 'x' }), 'invalid');
    e1 = await ST.editRequest({ id: e1.id, fields: { panels: [1, 2, 3, 4, 5, 6], panel_location: 'Rack C1' }, reason: 'two more panels' });
    eq('an edit: saved, and the timeline says what changed and why', [e1.panels.length, ST.requestEvents(e1.id).slice(-1)[0].text],
       [6, 'panels 1-4 -> 1-6; panels are now Rack B2 -> Rack C1. Reason: two more panels']);
    ST.setCurrentUser(tomL.id);
    await refused('someone else cannot edit it', ST.editRequest({ id: e1.id, fields: { layer: 'L2' }, reason: 'x' }), 'not_allowed');
    ST.setCurrentUser(adminL);
    await ST.saveEntry('users', { id: tomL.id, fields: { roles: ['engineer', 'quality'] } });
    await ST.saveEntry('tools', { id: qvm.id, fields: { backup_operator_id: tomL.id } });
    ST.setCurrentUser(tomL.id);
    var tk = await ST.takeRequest(e1.id);
    eq('the backup takes it over ("Take it")', [tk.assigned_to, ST.requestEvents(e1.id).slice(-1)[0].kind], [tomL.id, 'assign']);
    await refused('...not twice', ST.takeRequest(e1.id), 'not_allowed');
    ST.setCurrentUser(adminL);
    var fibT = await ST.saveEntry('tools', { id: tool('FIB').id, fields: { destructive: false } });
    eq('"destructive" can be switched per tool', fibT.destructive, false);
    eq('an unused part number can be deleted', ST.byId('part_numbers', pn.id), null);

    /* =============== store: tool status =============== */
    group('Store: tool status (Q27)');
    a = await adminStore();
    var op1 = await ST.saveEntry('users', { fields: { name: 'Olga Quality', windows_id: 'olga', roles: ['quality'] } });
    var opx = await ST.saveEntry('users', { fields: { name: 'Otto Operator', windows_id: 'otto', roles: ['operator'] } });
    await ST.saveEntry('tools', { id: tool('QVM').id, fields: { primary_operator_id: opx.id } });
    ST.setCurrentUser(opx.id);
    await refused('an Operator set on a tool still cannot set its status (no rights yet)', ST.setToolStatus({ tool_id: tool('QVM').id, status: 'down' }), 'not_allowed');
    ST.setCurrentUser(ST.data().users[0].id);
    var eng1 = await ST.saveEntry('users', { fields: { name: 'Erik Engineer', windows_id: 'erik', roles: ['engineer'] } });
    await ST.saveEntry('tools', { id: tool('FIB').id, fields: { primary_operator_id: op1.id } });
    ST.setCurrentUser(eng1.id);
    await refused('an engineer cannot set tool status', ST.setToolStatus({ tool_id: tool('FIB').id, status: 'down' }), 'not_allowed');
    ST.setCurrentUser(op1.id);
    await ST.setToolStatus({ tool_id: tool('FIB').id, status: 'maintenance', until: '2026-10-02', note: 'Source change' });
    eq('the tool\'s quality engineer sets Maintenance until a date', [tool('FIB').status, tool('FIB').status_until], ['maintenance', '2026-10-02']);
    await refused('a bad date is refused', ST.setToolStatus({ tool_id: tool('FIB').id, status: 'down', until: '2026-13-01' }), 'invalid');
    await ST.setToolStatus({ tool_id: tool('FIB').id, status: 'up' });
    eq('back Up clears the until date', [tool('FIB').status, tool('FIB').status_until], ['up', null]);
    await refused('another tool is not hers', ST.setToolStatus({ tool_id: tool('QVM').id, status: 'down' }), 'not_allowed');

    /* =============== health and setup to-do (M1-11) =============== */
    group('Health and the setup to-do list (M1-11)');
    var hs = ST._pure.seedData(Date.parse('2026-09-24T10:00:00Z'));
    hs.users = [{ id: 'u1', name: 'Prince Khurana', roles: ['admin'], active: true }];
    var todo = D.setupTodo(hs, { today_ymd: '2026-09-24', calendar_confirmed: false });
    function codes(list) { return list.map(function (x) { return x.code; }); }
    function countOf(list, code) { return list.filter(function (x) { return x.code === code; }).length; }
    ok('fresh file: sample types and BKMs are on the list', codes(todo).indexOf('sample_types') !== -1 && codes(todo).indexOf('sample_bkms') !== -1);
    eq('...every tool lacks a primary operator, backup and results root', [countOf(todo, 'no_primary'), countOf(todo, 'no_backup'), countOf(todo, 'no_results_root')], [5, 5, 5]);
    ok('...calendar unconfirmed, no closing days', codes(todo).indexOf('calendar_unconfirmed') !== -1 && codes(todo).indexOf('no_closing_days') !== -1);
    ok('...next year\'s holidays are there already', codes(todo).indexOf('no_holidays_next_year') === -1);
    ok('...a single admin is flagged', codes(todo).indexOf('one_admin') !== -1);
    ok('...no part numbers yet', codes(todo).indexOf('no_part_numbers') !== -1);
    ok('...no process steps yet', codes(todo).indexOf('no_process_steps') !== -1);
    ok('...sample lot fields', codes(todo).indexOf('sample_lot_fields') !== -1);
    ok('every item says where to fix it', todo.every(function (x) { return x.severity === 'todo' && !!x.tab; }));
    var hs2 = JSON.parse(JSON.stringify(hs));
    hs2.measurement_types.forEach(function (m) { delete m.sample; });
    hs2.bkms.forEach(function (b) { delete b.sample; });
    hs2.users.push({ id: 'u2', name: 'Olga', roles: ['quality'], active: true }, { id: 'u3', name: 'Otto', roles: ['quality', 'admin'], active: true });
    hs2.tools.forEach(function (t) { t.primary_operator_id = 'u2'; t.backup_operator_id = 'u3'; t.results_root = '\\\\srv\\lab\\' + t.code; });
    hs2.holidays.push({ id: 'hx', date: '2026-12-24', name: 'Christmas Eve', kind: 'closing' });
    hs2.part_numbers.push({ id: 'pnx', code: 'PN-1', project_ids: [hs2.projects[0].id], active: true });
    hs2.process_steps.push({ id: 'psx', name: 'After desmear', sort: 1, active: true });
    hs2.lot_fields.forEach(function (f) { delete f.sample; });
    eq('all set up: the list is empty', D.setupTodo(hs2, { today_ymd: '2026-09-24', calendar_confirmed: true }), []);
    ok('late in the year without next year\'s holidays: flagged', codes(D.setupTodo(hs2, { today_ymd: '2027-11-01', calendar_confirmed: true })).indexOf('no_holidays_next_year') !== -1);
    hs2.users.push({ id: 'u4', name: 'New Nora', roles: ['engineer'], active: true, needs_review: true });
    eq('a self-added user waits for review', codes(D.setupTodo(hs2, { today_ymd: '2026-09-24', calendar_confirmed: true })), ['user_review']);

    eq('a clean file has no health issues', D.healthIssues(hs2, { today_ymd: '2026-09-24' }), []);
    var hb = JSON.parse(JSON.stringify(hs2));
    hb.bkms[0].type_id = 'gone';
    hb.tool_fields.push({ id: 'f1', tool_id: 'nope', label: 'Ghost', type: 'text', type_ids: [] });
    hb.users[1].active = false;
    hb.users[2].roles = ['admin'];
    hb.tools[4].status = 'down'; hb.tools[4].status_until = '2026-09-01';
    hb.users.push({ id: 'u5', name: 'No Role', roles: [], active: true });
    var hi = D.healthIssues(hb, { today_ymd: '2026-09-24' });
    ok('a BKM pointing at a missing type is a problem', countOf(hi, 'bkm_bad_type') === 1);
    ok('a field of a missing tool is a problem', countOf(hi, 'orphan_field') === 1);
    eq('a deactivated operator is a warning, per tool', countOf(hi, 'operator_inactive'), 5);
    eq('a primary/backup without the Quality engineer role is a warning', countOf(hi, 'operator_no_role'), 5);
    ok('Down past its until date is a warning', countOf(hi, 'status_overdue') === 1 && /FIB/.test(hi.filter(function (x) { return x.code === 'status_overdue'; })[0].text));
    ok('a user without roles is a warning', countOf(hi, 'user_no_role') === 1);
    hb.part_numbers.push({ id: 'pny', code: 'PN-2', project_ids: ['gone'], active: true });
    hb.projects[0].active = false;
    hi = D.healthIssues(hb, { today_ymd: '2026-09-24' });
    ok('a part number linked to a missing project is a problem', countOf(hi, 'pn_bad_project') === 1);
    ok('an active part number whose projects are all hidden is a warning', countOf(hi, 'pn_hidden_projects') === 1);
    hb.lots = [{ id: 'lx', lot_number: '1', project_id: 'gone', buildup_id: 'gone', part_number_id: 'gone', panel_count: 1 }];
    hi = D.healthIssues(hb, { today_ymd: '2026-09-24' });
    eq('a lot pointing at a missing project, build-up, part number: three problems', [countOf(hi, 'lot_bad_project'), countOf(hi, 'lot_bad_buildup'), countOf(hi, 'lot_bad_pn')], [1, 1, 1]);
    ok('...linking to the Lots page', hi.filter(function (x) { return x.code === 'lot_bad_project'; })[0].tab === 'lots');
    var ha = JSON.parse(JSON.stringify(hs2));
    ha.users[1].away_from = '2026-09-20';
    eq('only the primary away: no warning', countOf(D.healthIssues(ha, { today_ymd: '2026-09-24' }), 'both_away'), 0);
    ha.users[2].away_from = '2026-09-24'; ha.users[2].away_until = '2026-09-30';
    var hw = D.healthIssues(ha, { today_ymd: '2026-09-24' });
    eq('primary and backup both away: a warning per tool (M1-14)', countOf(hw, 'both_away'), 5);
    ok('...naming both', /Olga/.test(hw.filter(function (x) { return x.code === 'both_away'; })[0].text) && /Otto/.test(hw.filter(function (x) { return x.code === 'both_away'; })[0].text));
    eq('...gone once the backup is back', countOf(D.healthIssues(ha, { today_ymd: '2026-10-01' }), 'both_away'), 0);
    ok('problems, warnings, notes only', hi.every(function (x) { return ['problem', 'warning', 'note'].indexOf(x.severity) !== -1; }));

    a = await adminStore();
    ok('store.health(): the calendar starts unconfirmed', codes(ST.health().todo).indexOf('calendar_unconfirmed') !== -1);
    await ST.confirmCalendar();
    ok('confirming clears it', codes(ST.health().todo).indexOf('calendar_unconfirmed') === -1);
    eq('...without changing the days', ST.calendar().days, [1, 2, 3, 4, 5]);
    await refused('...and only once', ST.confirmCalendar(), 'no_change');
    a = await adminStore();
    await ST.updateCalendar({ days: [1, 2, 3, 4, 5, 6], start: '07:00', end: '18:00' });
    ok('saving new days also confirms the calendar', codes(ST.health().todo).indexOf('calendar_unconfirmed') === -1);

    /* =============== store: saving, conflicts, undo =============== */
    group('Store: saving, "someone else saved", undo');
    a = await adminStore();
    var rev = fileOf(a).revision;
    await ST.saveEntry('projects', { fields: { code: 'NOVA', name: 'Nova' } });
    eq('each change saves with revision + 1', fileOf(a).revision, rev + 1);
    var info = ST.undoInfo();
    ok('the change can be undone for a while', info && info.ms_left > 0 && info.ms_left <= cfg.undo_ms);
    var auditBefore = auditCount();
    await ST.undoLast();
    eq('undo takes the project back', ST.list('projects').map(function (p) { return p.code; }).indexOf('NOVA'), -1);
    eq('...the audit only grows', auditCount(), auditBefore + 1);
    eq('...an undo cannot be undone', ST.undoInfo(), null);

    var other = fileOf(a);
    other.revision += 5; other.saved_by = ST.currentUser().id; other.saved_ts = '2026-09-24T09:00:00.000Z';
    a.files[cfg.data_file] = JSON.stringify(other);
    var ext = await ST.checkForExternalChange();
    eq('a newer file on the share is noticed', ext && ext.revision, other.revision);
    e = await refused('saving over a newer file stops', ST.saveEntry('projects', { fields: { code: 'LOST' } }), 'revision_conflict');
    ok('...and names who saved', e && /Prince Khurana/.test(e.message));
    eq('...the file on disk is untouched', fileOf(a).revision, other.revision);
    eq('...the change is kept in memory', [ST.status().pendingSave, ST.list('projects').some(function (p) { return p.code === 'LOST'; })], [true, true]);

    a = await adminStore();
    a.failWrites = true;
    await refused('a read-only share: the save fails', ST.saveEntry('projects', { fields: { code: 'RO' } }));
    eq('...the change stays in memory', ST.status().pendingSave, true);
    ok('...and can be downloaded', ST.exportText().text.indexOf('"RO"') !== -1);
    a.failWrites = false;
    await ST.retrySave();
    ok('retry saves it', fileOf(a).projects.some(function (p) { return p.code === 'RO'; }) && !ST.status().pendingSave);

    /* =============== store: backups and restore =============== */
    group('Store: daily backups and restore');
    a = await adminStore();
    var today = D.viennaYmd(Date.now());
    var dayFile = cfg.backup_dir + '/' + cfg.backup_prefix + today + '.json';
    ok('the first save of the day writes a backup', !!a.files[dayFile]);
    eq('...of the file as it was before the change', JSON.parse(a.files[dayFile]).revision, 0);
    await ST.saveEntry('projects', { fields: { code: 'B1' } });
    eq('later saves that day do not overwrite it', JSON.parse(a.files[dayFile]).revision, 0);

    a = window.MRT.adapters.storageMemory({});
    for (var i = 1; i <= 35; i++) {
      a.files[cfg.backup_dir + '/' + cfg.backup_prefix + '2020-01-' + (i < 10 ? '0' : '') + i + '.json'] = '{}';
    }
    a.files[cfg.backup_dir + '/' + cfg.backup_prefix + 'before-restore_x.json'] = '{}';
    ST.init(a); await ST.load();
    await ST.createFirstAdmin({ name: 'Prince Khurana', windows_id: 'pkhurana', pin: '2468' });
    var list = await ST.listBackups();
    eq('only the last ' + cfg.backup_keep + ' daily backups are kept', list.length, cfg.backup_keep);
    eq('newest first', list[0].date, today);
    ok('the oldest ones went', !a.files[cfg.backup_dir + '/' + cfg.backup_prefix + '2020-01-01.json']);
    ok('safety copies are never pruned', !!a.files[cfg.backup_dir + '/' + cfg.backup_prefix + 'before-restore_x.json']);

    a = await adminStore();
    var yesterday = cfg.backup_dir + '/' + cfg.backup_prefix + '2026-01-01.json';
    var old = fileOf(a); old.projects = [{ id: 'prj_old', code: 'OLD', name: '', active: true, version: 1 }];
    a.files[yesterday] = JSON.stringify(old);
    await refused('a restore needs a reason', ST.restoreBackup(cfg.backup_prefix + '2026-01-01.json', ''));
    await refused('only backup files can be restored', ST.restoreBackup('../mrt_data.json', 'x'));
    var auditN = auditCount();
    var res = await ST.restoreBackup(cfg.backup_prefix + '2026-01-01.json', 'test restore');
    eq('restore brings the old lists back', ST.list('projects').map(function (p) { return p.code; }), ['OLD']);
    ok('...after a safety copy of the current file', !!a.files[res.safety_copy]);
    eq('...the audit log is kept and grows', auditCount(), auditN + 1);

    /* =============== store: file checks and upgrades =============== */
    group('Store: file checks and schema upgrades');
    var P = ST._pure;
    ok('a missing collection is filled in, not fatal', Array.isArray(P.validateAndFill({ schema_version: 1, revision: 3 }).tools));
    try { P.validateAndFill({ schema_version: 1 }); record(false, 'a file without revision is refused'); }
    catch (x) { record(true, 'a file without revision is refused'); }
    try { P.migrate({ schema_version: 99 }); record(false, 'a newer schema is refused'); }
    catch (x) { eq('a newer schema is refused', x.code, 'newer_schema'); }

    a = window.MRT.adapters.storageMemory({});
    a.files[cfg.data_file] = '{ not json';
    ST.init(a);
    await refused('a damaged file is reported, not overwritten', ST.load(), 'bad_json');
    eq('...and left as it was', a.files[cfg.data_file], '{ not json');

    // Schema 1 -> 2 adds part numbers (M1-13); 2 -> 3 process steps and "destructive" (M2-7, M2-11).
    var v1 = ST._pure.seedData(); v1.schema_version = 1; delete v1.part_numbers; delete v1.process_steps; delete v1.lots; delete v1.lot_fields;
    delete v1.requests; delete v1.request_events; delete v1.hold_reasons;
    v1.tools.forEach(function (t) { delete t.destructive; });
    P.migrate(v1);
    eq('schema 1 -> 3: part numbers and process steps start empty', [v1.part_numbers, v1.process_steps], [[], []]);
    eq('...FIB becomes destructive, the others not', v1.tools.map(function (t) { return t.code + ':' + t.destructive; }), ['HRM:false', 'AOI:false', 'PRF:false', 'QVM:false', 'FIB:true']);
    eq('...and the file says schema 7, with no lots or requests', [v1.schema_version, v1.lots, v1.requests, v1.request_events], [7, [], [], []]);
    eq('...schema 6 -> 7 brings the on-hold reasons', v1.hold_reasons.length, 5);
    eq('...schema 4 -> 5 brings the sample lot fields', v1.lot_fields.map(function (f) { return f.label; }).length, 7);

    // An extra upgrade step, for this test only: schema 0 -> 1 (then 1 -> 2).
    P.MIGRATIONS[0] = function (d) { d.upgraded = true; };
    var v0 = ST._pure.seedData(); v0.schema_version = 0; v0.revision = 7;
    a = window.MRT.adapters.storageMemory({});
    a.files[cfg.data_file] = JSON.stringify(v0);
    ST.init(a);
    await ST.load();
    delete P.MIGRATIONS[0];
    var copies = Object.keys(a.files).filter(function (k) { return k.indexOf(cfg.backup_prefix + 'before-upgrade_v0-to-v7_') !== -1; });
    eq('an upgrade first keeps a copy of the old file', copies.length, 1);
    eq('...the copy is the old file, unchanged', JSON.parse(a.files[copies[0]]).schema_version, 0);
    eq('...the data is upgraded in memory', [ST.data().schema_version, ST.data().upgraded], [7, true]);
    eq('...and the status says so until the next save', ST.status().upgradedFrom, 0);
  }

  T.done = run().catch(function (e) {
    T.failed++;
    (current || (group('Runner'), current)).rows.push({ ok: false, name: 'the test run crashed', detail: String(e && e.stack || e) });
  });
})();
