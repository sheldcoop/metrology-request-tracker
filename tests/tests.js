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
    eq('DOMAIN\\user splits and normalises', D.parseWindowsLogin(' ats\\PKhurana '), { windows_id: 'pkhurana', domain: 'ATS' });
    eq('empty is no login', D.parseWindowsLogin(''), null);
    eq('spaces are not a login', D.parseWindowsLogin('p khurana'), null);
    eq('odd characters are not a login', D.parseWindowsLogin('pk$'), null);
    ok('dots and dashes are fine', D.isWindowsId('p.khurana-2'));
    ok('upper case is not a stored ID', !D.isWindowsId('PKhurana'));
    eq('M3: login matrix (domain, case, edges)', [
      D.parseWindowsLogin('ATS\\pkhurana'), D.parseWindowsLogin('ats\\PKHURANA'), D.parseWindowsLogin('pkhurana'),
      D.parseWindowsLogin('A\\B\\C'), D.parseWindowsLogin('ATS\\'), D.parseWindowsLogin('\\pkhurana'),
      D.parseWindowsLogin('user@ats.com'), D.parseWindowsLogin(new Array(66).join('a')), D.parseWindowsLogin('a$b'), D.parseWindowsLogin('  ')
    ], [{ windows_id: 'pkhurana', domain: 'ATS' }, { windows_id: 'pkhurana', domain: 'ATS' }, { windows_id: 'pkhurana', domain: null },
      null, null, null, null, null, null, null]);

    ok('same ID, no domains: match', D.identityMatches({ windows_id: 'pk' }, { windows_id: 'pk', domain: 'ATS' }));
    ok('same ID, same domain: match', D.identityMatches({ windows_id: 'pk', domain: 'ATS' }, { windows_id: 'pk', domain: 'ats' }));
    ok('same ID, other domain: no match', !D.identityMatches({ windows_id: 'pk', domain: 'LAB' }, { windows_id: 'pk', domain: 'ATS' }));
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
                 part_numbers: [{ id: 'pn1', code: 'PN-100', project_id: 'p1' }],
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
    eq('a part number belongs to exactly one project (P-1)', probs('part_numbers', { code: 'PN-200.A/01', project_id: 'p1' }), []);
    ok('part numbers are unique across projects', probs('part_numbers', { code: 'PN-100', project_id: 'p2' }).length === 1);
    ok('...editing it keeps its own code', !probs('part_numbers', { id: 'pn1', code: 'PN-100', project_id: 'p1' }).length);
    ok('a part number needs a project', probs('part_numbers', { code: 'PN-300' }).length === 1);
    ok('...a project that exists', probs('part_numbers', { code: 'PN-300', project_id: 'gone' }).length === 1);
    ok('part numbers: capitals, digits, - . _ / only', !D.isPartNumber('pn-1') && !D.isPartNumber('PN 1') && !D.isPartNumber('-PN') && D.isPartNumber('AB_12.3/4-X'));
    eq('a process step', probs('process_steps', { name: 'After Cu plating', sort: 2 }), []);
    ok('process steps are listed once (case and spaces ignored)', probs('process_steps', { name: 'after  DESMEAR' }).length === 1);
    ok('...need a name and a whole position', probs('process_steps', { name: '', sort: 1.5 }).length === 2);
    ok('panel locations and destinations: named once (addendum 02)', !probs('panel_locations', { name: 'Shelf 9' }).length &&
       probs('panel_locations', { name: '' }).length === 1 &&
       D.validateEntry('destinations', { name: 'Back to me' }, { destinations: [{ id: 'd', name: 'back  TO me' }] }).length === 1);
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
    eq('...across the March clock change (23-hour Sunday): Fri 16:00 -> Mon 09:00 = 4 h', D.workingMs(D.viennaTs('2026-03-27', '16:00'), D.viennaTs('2026-03-30', '09:00'), calW, {}) / H, 4);
    eq('Vienna date at the spring jump (02:00 -> 03:00)', [D.viennaYmd(Date.parse('2026-03-29T00:30:00Z')), D.viennaYmd(Date.parse('2026-03-29T01:30:00Z'))], ['2026-03-29', '2026-03-29']);
    eq('...and holidays: Mon 26 Oct (national day) counts nothing', D.workingMs(D.viennaTs('2026-10-26', '07:00'), D.viennaTs('2026-10-26', '18:00'), calW, D.holidaySet([{ date: '2026-10-26' }])) / H, 0);
    eq('...nights and early mornings do not count', D.workingMs(D.viennaTs('2026-10-01', '19:00'), D.viennaTs('2026-10-02', '06:00'), calW, {}), 0);
    var cd = D.countdown(D.viennaTs('2026-10-02', '16:00'), '2026-10-05', calW, {});
    eq('countdown to the end of the lab day on the date: 13 h left, 3 days, clock running', [cd.late, cd.lab_ms / H, cd.days, cd.paused], [false, 13, 3, false]);
    var cl = D.countdown(D.viennaTs('2026-10-06', '09:00'), '2026-10-05', calW, {});
    eq('...late by 2 h lab time the next morning, one day over', [cl.late, cl.lab_ms / H, cl.days], [true, 2, -1]);
    ok('...paused on a Saturday', D.countdown(D.viennaTs('2026-10-03', '10:00'), '2026-10-05', calW, {}).paused);
    eq('lab days between: Thu 9-10 -> Thu 9-24 is 10 lab days (Step 6b)', D.labDaysBetween(Date.parse('2026-09-10T08:00:00Z'), Date.parse('2026-09-24T12:00:00Z'), calW, {}), 10);
    eq('...the hold day itself does not count, weekends neither', [D.labDaysBetween(Date.parse('2026-09-23T08:00:00Z'), Date.parse('2026-09-24T12:00:00Z'), calW, {}),
      D.labDaysBetween(Date.parse('2026-09-25T08:00:00Z'), Date.parse('2026-09-28T12:00:00Z'), calW, {})], [1, 1]);
    eq('...a holiday counts nothing', D.labDaysBetween(Date.parse('2026-10-23T08:00:00Z'), Date.parse('2026-10-26T12:00:00Z'), calW, D.holidaySet([{ date: '2026-10-26' }])), 0);
    eq('...backwards is 0, and 2 lab days is stuck', [D.labDaysBetween(Date.parse('2026-09-24T12:00:00Z'), Date.parse('2026-09-10T08:00:00Z'), calW, {}),
      D.holdLabDays('2026-09-22T08:00:00Z', Date.parse('2026-09-24T12:00:00Z'), calW, {}) >= D.STUCK_HOLD_LAB_DAYS], [0, true]);
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
    eq('workflow: a quality engineer on Submitted - Accept, Hold, Clarify (RBAC)', D.actionsFor(qe1, { status: 'submitted', requester_id: 'e1' }, toolW, 0), ['accept', 'hold', 'clarify']);
    eq('...Accepted - Receive, Hold, Clarify; Panels received - Start, Hold, Clarify', [D.actionsFor(qe1, { status: 'accepted', requester_id: 'e1' }, toolW, 0),
       D.actionsFor(qe1, { status: 'panels_received', requester_id: 'e1' }, toolW, 0)], [['receive', 'hold', 'clarify'], ['start', 'hold', 'clarify']]);
    eq('...In progress - Hold, Clarify, Complete', D.actionsFor(qe2, { status: 'in_progress', requester_id: 'e1' }, toolW, 0), ['hold', 'clarify', 'complete']);
    eq('...the requester has nothing to do while it runs', D.actionsFor(eng1, { status: 'in_progress', requester_id: 'e1' }, toolW, 0), []);
    eq('...but answers a clarification, and may reopen completed results', [D.actionsFor(eng1, { status: 'clarification', requester_id: 'e1' }, toolW, 0),
       D.actionsFor(eng1, { status: 'completed', requester_id: 'e1' }, toolW, 0)], [['answer'], ['reopen']]);
    ok('...a quality engineer of another tool can do nothing', !D.actionsFor({ id: 'q9', roles: ['quality'], active: true }, { status: 'submitted' }, toolW, 0).length);
    ok('closed means Analyzed (Q34 superseded 2026-09-28)', D.isClosed({ status: 'analyzed' }, 0) && !D.isClosed({ status: 'completed' }, 0));
    ok('...then no Reopen any more', !D.canAct(eng1, 'reopen', { status: 'analyzed', requester_id: 'e1' }, toolW, 0));
    var peopleA = [{ id: 'q1', name: 'Olga', away_from: '2026-09-20', away_until: '2026-09-30' }, { id: 'q2', name: 'Otto' }];
    eq('assigned at submit: the primary, or the backup when the primary is away (M3-7)', [D.assignOnSubmit(toolW, peopleA, '2026-10-01').id, D.assignOnSubmit(toolW, peopleA, '2026-09-24').id], ['q1', 'q2']);
    ok('...with a note for the timeline', /Olga is away/.test(D.assignOnSubmit(toolW, peopleA, '2026-09-24').note));
    peopleA[1].away_from = '2026-09-01';
    eq('...both away: stays with the primary', D.assignOnSubmit(toolW, peopleA, '2026-09-24').id, 'q1');
    var peopleI = [{ id: 'q1', name: 'Olga', active: false }, { id: 'q2', name: 'Otto' }];
    eq('...deactivated primary: the backup, with a timeline note (M5)', [D.assignOnSubmit(toolW, peopleI, '2026-10-01').id, D.assignOnSubmit(toolW, peopleI, '2026-10-01').note], ['q2', 'Olga is deactivated - assigned to the backup, Otto']);
    var peopleN = [{ id: 'q2', name: 'Otto' }];
    eq('...no primary set: the backup, with a timeline note (M5)', [D.assignOnSubmit({ primary_operator_id: null, backup_operator_id: 'q2' }, peopleN, '2026-10-01').id,
       D.assignOnSubmit({ primary_operator_id: null, backup_operator_id: 'q2' }, peopleN, '2026-10-01').note], ['q2', 'no primary quality engineer - assigned to the backup, Otto']);
    eq('...nobody set: unassigned, no note', [D.assignOnSubmit({ primary_operator_id: null, backup_operator_id: null }, [], '2026-10-01').id,
       D.assignOnSubmit({ primary_operator_id: null, backup_operator_id: null }, [], '2026-10-01').note], [null, null]);
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
    ok('...5,000 requests sort right and fast (scale tripwire)', (function () {
      var big = [], i;
      for (i = 0; i < 5000; i++) big.push({ id: 'q' + i, status: 'submitted', priority_id: 'p' + ((i % 4) + 1),
        needed_by: i % 3 ? '2026-10-' + (10 + (i % 15)) : null, submitted_ts: '2026-09-' + (10 + (i % 15)) + 'T08:00:00Z' });
      var t0 = Date.now();
      var out = D.sortQueue(big, { now_ts: Date.parse('2026-09-24T10:00:00Z'), cal: calW, levelOf: function (r) { return lvQ[r.priority_id]; } });
      var first = out.slice(0, 1250).every(function (r) { return r.priority_id === 'p1'; });
      return out.length === 5000 && first && Date.now() - t0 < 5000;
    })());
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
    eq('old drafts (Q33): a draft untouched for 30+ days', [D.isOldDraft({ status: 'draft', created_ts: '2026-08-01T00:00:00Z' }, Date.parse('2026-09-24T00:00:00Z')),
       D.isOldDraft({ status: 'draft', created_ts: '2026-08-01T00:00:00Z', updated_ts: '2026-09-20T00:00:00Z' }, Date.parse('2026-09-24T00:00:00Z')),
       D.isOldDraft({ status: 'submitted', created_ts: '2026-01-01T00:00:00Z' }, Date.parse('2026-09-24T00:00:00Z'))], [true, false, false]);
    var QQ = [{ id: 'a', tool_id: 't', status: 'in_progress', submitted_ts: '2026-09-20T08:00:00Z' },
      { id: 'b', tool_id: 't', status: 'accepted', submitted_ts: '2026-09-21T08:00:00Z' },
      { id: 'c', tool_id: 't', status: 'on_hold', submitted_ts: '2026-09-19T08:00:00Z' },
      { id: 'd', tool_id: 't', status: 'submitted', submitted_ts: '2026-09-18T08:00:00Z' },
      { id: 'e', tool_id: 'x', status: 'accepted', submitted_ts: '2026-09-17T08:00:00Z' }];
    eq('queue place: 2nd of 2 on the tool, by submitted time; holds, unaccepted and other tools out',
      [D.queuePosition(QQ, QQ[1]), D.queuePosition(QQ, QQ[2]), D.queuePosition(QQ, QQ[3]), D.queuePosition(QQ, QQ[4])],
      [{ pos: 2, total: 2 }, null, null, { pos: 1, total: 1 }]);
    var ND = { users: [{ id: 'e1', name: 'Erik', roles: ['engineer'], active: true }, { id: 'q1', name: 'Olga', roles: ['quality'], active: true },
        { id: 'a1', name: 'Ada', roles: ['admin'], active: true }, { id: 'n1', name: 'Nora', roles: ['engineer'], active: true, self_added: true, needs_review: true, created_ts: '2026-09-24T08:00:00Z' }],
      tools: [{ id: 't1', code: 'FIB', primary_operator_id: 'q1' }],
      requests: [{ id: 'r1', request_no: 'FIB-260924-01', status: 'accepted', tool_id: 't1', requester_id: 'e1' }, { id: 'r2', request_no: null, status: 'draft', tool_id: 't1', requester_id: 'e1' }],
      request_events: [
        { id: 'v1', request_id: 'r1', ts: '2026-09-24T09:00:00Z', user_id: 'e1', kind: 'status', from: 'draft', to: 'submitted' },
        { id: 'v2', request_id: 'r1', ts: '2026-09-24T10:00:00Z', user_id: 'q1', kind: 'status', from: 'submitted', to: 'accepted' },
        { id: 'v3', request_id: 'r1', ts: '2026-09-24T11:00:00Z', user_id: 'e1', kind: 'comment', text: 'thanks @Ada', mentions: ['a1'] },
        { id: 'v4', request_id: 'r2', ts: '2026-09-24T11:30:00Z', user_id: 'e1', kind: 'created', to: 'draft' }] };
    function nIds(uid, since) { return D.notificationsFor(ND.users.filter(function (u) { return u.id === uid; })[0], ND, { since_ts: since }).map(function (n) { return n.id; }); }
    eq('the bell (M4-1): the QE hears of the new request and the comment, not their own Accept', nIds('q1'), ['v3', 'v1']);
    eq('...the requester hears of the Accept, not their own comment or draft', nIds('e1'), ['v2']);
    eq('...an admin: the @mention and the person who added themselves', nIds('a1'), ['v3', 'usr:n1']);
    eq('...only what came after "since"', nIds('q1', Date.parse('2026-09-24T10:30:00Z')), ['v3']);
    ok('...the mention says so', /mentioned you/.test(D.notificationsFor(ND.users[2], ND).filter(function (n) { return n.id === 'v3'; })[0].text));
    eq('panels by Hirata ID (F-1): commas, lines, runs, each once, order kept', D.parsePanelIds('3252, 23\n0045-0047 3252'), { ids: ['3252', '23', '0045', '0046', '0047'], errors: [] });
    eq('...bad ones are named', D.parsePanelIds('32a5, 10-9').errors.length, 2);
    eq('...shown as IDs, or "2 panels" when only counted', [D.panelsText({ panels: ['3252', '3253'] }), D.panelsText({ panels: [], panel_count: 2 }), D.panelCountOf({ panels: [], panel_count: 3 })], ['3252, 3253', '2 panels', 3]);
    eq('layers from the build-up (F-2): core 1FCO/1BCO, BU-01 adds 2F/2B, BU-04 up to 5F/5B', [D.layersFor({ code: 'BU-01' }), D.layersFor({ code: 'BU-04' }).slice(-2), D.layersFor({ code: 'DOE' }).length, D.layersFor({ code: 'DOE', layers: 1 }).length],
       [['1FCO', '1BCO', '2F', '2B'], ['5F', '5B'], 10, 4]);
    var MG = { m1: { id: 'm1', code: 'M70345', slots: 24 } };
    var LC = { lc1: { id: 'lc1', name: 'cart 2' } };
    eq('where (F-3): "M70345 · slots 3, 4", with the place after', [D.placeText({ magazine_id: 'm1', slots: [4, 3] }, MG, LC),
       D.placeText({ magazine_id: 'm1', slots: [1, 2, 3], panel_location_id: 'lc1' }, MG, LC), D.placeText({ panel_location: 'in MES' }, MG)],
       ['M70345 · slots 3, 4', 'M70345 · slots 1-3 - cart 2', 'in MES']);
    eq('...slots taken by other open requests of that magazine', D.takenSlots([{ id: 'a', status: 'accepted', magazine_id: 'm1', slots: [3], request_no: 'X-1' }, { id: 'b', status: 'completed', magazine_id: 'm1', slots: [4] },
       { id: 'c', status: 'submitted', magazine_id: 'm1', slots: [5], request_no: 'X-3' }], 'm1', 'c'), { 3: 'X-1' });
    ok('magazine numbers: M and digits', D.isMagazineCode('M70345') && !D.isMagazineCode('70345') && !D.isMagazineCode('M-1'));
    eq('start page by role (M3-12): QE -> My queue, engineer -> My requests, else Lab status', [D.homeFor(qe1), D.homeFor(eng1), D.homeFor({ roles: ['manager'], active: true })], ['queue', 'requests', 'lab']);
    (function () {   // HOME-9: every role sees exactly six Home cards
      var mk = function (roles) { return { roles: roles, active: true }; };
      var doors = function (u) {
        return ['new:' + D.canRequest(u), 'req:1', 'queue:' + D.canMeasure(u), 'board:' + D.boardFor(u),
          'lab:1', 'results:' + D.resultsFor(u), 'analytics:' + D.canSeeManagement(u),
          'lots:' + D.canRegisterLot(u), 'hirata:' + D.hirataFor(u), 'help:1']
          .filter(function (x) { return /:1|true$/.test(x); }).length;
      };
      eq('six doors per role', [doors(mk(['engineer'])), doors(mk(['quality'])), doors(mk(['manager'])),
        doors(mk(['admin'])), doors(mk(['operator'])), doors(mk(['analyst']))], [6, 6, 6, 6, 6, 6]);
      eq('board door: QE/manager/operator/analyst, not engineer/admin',
        [D.boardFor(mk(['quality'])), D.boardFor(mk(['manager'])), D.boardFor(mk(['operator'])),
         D.boardFor(mk(['analyst'])), D.boardFor(mk(['engineer'])), D.boardFor(mk(['admin']))],
        [true, true, true, true, false, false]);
      eq('results door: everyone but engineers',
        [D.resultsFor(mk(['engineer'])), D.resultsFor(mk(['quality'])), D.resultsFor(mk(['admin']))],
        [false, true, true]);
      eq('hirata door: panel handlers only',
        [D.hirataFor(mk(['engineer'])), D.hirataFor(mk(['operator'])), D.hirataFor(mk(['analyst'])),
         D.hirataFor(mk(['manager'])), D.hirataFor(mk(['admin']))],
        [true, true, true, false, false]);
    })();
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
      process_steps: [{ id: 's1', name: 'After desmear' }], requests: [],
      projects: [{ id: 'pr1', code: 'C4F' }, { id: 'pr2', code: 'HORUS' }], part_numbers: [{ id: 'pn1', code: 'PN-1', project_id: 'pr1' }], buildups: [{ id: 'bu2', code: 'BU-02' }],
      panel_locations: [{ id: 'lc1', name: 'Magazine 14' }], destinations: [{ id: 'd1', name: 'Back to me' }] };
    var full = { tool_id: 't1', type_id: 'm1', project_id: 'pr1', lot_id: 'l1', panels: ['3252', '3253'], priority_id: 'p3', bkm_id: 'b1', panel_location_id: 'lc1',
      destructive_ok: true, destination_id: 'd1', extra: { f1: 'c1' } };
    eq('a complete FIB request', D.requestProblems(full, rq, { submit: true }), []);
    eq('a draft needs only its tool', [D.requestProblems({ tool_id: 't1' }, rq, {}), D.requestProblems({}, rq, {})], [[], ['Pick a tool']]);
    ok('...but a panel ID that is not digits is refused even in a draft', D.requestProblems({ tool_id: 't1', lot_id: 'l1', panels: ['32a'] }, rq, {}).length === 1);
    ok('only a count, no IDs, is fine (F-1)', !D.requestProblems(Object.assign({}, full, { panels: [], panel_count: 2 }), rq, { submit: true }).length);
    function sub(ch) { return D.requestProblems(Object.assign({}, full, ch), rq, { submit: true }); }
    var pd = D.requestProblemDetails(Object.assign({}, full, { priority_id: null, panel_location_id: null }), rq, { submit: true });
    eq('structured problems carry stable step metadata', pd.map(function (x) { return [x.text, x.step]; }),
       [['Pick a priority', 'urgency'], ['Say where the panels are now: pick a place, or the magazine slots', 'where']]);
    eq('...and legacy requestProblems keeps the same text list', D.requestProblems(Object.assign({}, full, { priority_id: null, panel_location_id: null }), rq, { submit: true }),
       pd.map(function (x) { return x.text; }));
    ok('a new lot typed in the form is fine; a number already registered is not (F-5)', !sub({ lot_id: null, new_lot: { lot_number: '19000' } }).length &&
       sub({ lot_id: null, new_lot: { lot_number: '18178' } }).some(function (x) { return /exists already/.test(x); }));
    ok('a typed new part number is allowed; it needs a project and format',
       !sub({ part_number_id: null, new_part_number: { code: 'PN-NEW' } }).length &&
       sub({ project_id: null, part_number_id: null, new_part_number: { code: 'PN-NEW' } }).some(function (x) { return /project/.test(x); }) &&
       sub({ part_number_id: null, new_part_number: { code: 'pn new' } }).some(function (x) { return /Part number/.test(x); }));
    ok('typed new project / build-up / magazine / type / priority are allowed; duplicates are refused',
       !sub({ project_id: null, new_project: { code: 'NEW-PRJ' } }).length &&
       sub({ project_id: null, new_project: { code: 'C4F' } }).some(function (x) { return /exists already/.test(x); }) &&
       !sub({ buildup_id: null, new_buildup: { code: 'BU-07' } }).length &&
       sub({ buildup_id: null, new_buildup: { code: 'BU-02' } }).some(function (x) { return /exists already/.test(x); }) &&
       !sub({ magazine_id: null, new_magazine: { code: 'M70099' }, slots: [] }).length &&
       !sub({ type_id: null, new_type: { name: 'New QVM Type' } }).length &&
       !sub({ priority_id: null, new_priority: { name: 'Planning' } }).length);
    ok('the project is on the request and required; the part number must be one of its (F-6)', sub({ project_id: null }).length === 1 &&
       !sub({ part_number_id: 'pn1' }).length && sub({ project_id: 'pr2', part_number_id: 'pn1' }).length === 1);
    ok('the build-up is optional; picked, it decides the layers (F-2, F-6)', !sub({ layers: ['5B'] }).length && sub({ buildup_id: 'bu2', layers: ['5B'] }).length === 1 &&
       !sub({ buildup_id: 'bu2', layers: ['1FCO', '3B'] }).length && sub({ buildup_id: 'gone' }).length === 1);
    ok('submit: type, lot, panels, priority, where the panels are - all required', [{ type_id: null }, { lot_id: null }, { panels: [] }, { priority_id: null }, { panel_location_id: null }].every(function (c) { return sub(c).length >= 1; }));
    ok('Line stop needs a reason (Q26)', sub({ priority_id: 'p1' }).length === 1 && !sub({ priority_id: 'p1', priority_reason: 'line 2 down' }).length);
    ok('no BKM: the purpose must say what to measure (Q45, M2-13)', sub({ bkm_id: null }).length === 1 && !sub({ bkm_id: null, purpose: 'voids at via 3' }).length && !sub({ bkm_id: null, bkm_path: 'Z:\\my.pptx' }).length);
    ok('FIB: the destructive tick is required (M2-11)', sub({ destructive_ok: false }).length === 1);
    ok('destination required; typed new place / destination allowed, duplicates refused', sub({ destination_id: null }).length === 1 &&
       !sub({ destination_id: null, new_destination: { name: 'New dock' } }).length &&
       sub({ destination_id: null, new_destination: { name: 'back to ME' } }).some(function (x) { return /exists already/.test(x); }) &&
       !sub({ panel_location_id: null, new_location: { name: 'Shelf 9' } }).length &&
       sub({ panel_location_id: null, new_location: { name: 'magazine 14' } }).some(function (x) { return /exists already/.test(x); }) &&
       sub({ new_location: { name: 'Shelf 9' } }).some(function (x) { return /not both/.test(x); }));
    ok('the tool\'s required extra field must be answered; "only for" another type does not apply (Q5)', sub({ extra: {} }).length === 1 && !sub({}).some(function (x) { return /Depth/.test(x); }));
    ok('a BKM of another tool is refused', D.requestProblems(Object.assign({}, full, { tool_id: 't2', type_id: 'm2', bkm_id: 'b1', extra: {} }), rq, {}).length === 1);
    eq('warnings (Q44): QVM in Maintenance past the date, and no BKM', D.submitWarnings({ tool_id: 't2', needed_by: '2026-10-01', lot_id: 'l1', panels: [1] }, rq).map(function (w) { return w.code; }), ['tool_down', 'no_bkm']);
    eq('...no warning when the tool is back before the date', D.submitWarnings({ tool_id: 't2', needed_by: '2026-10-20', bkm_path: 'Z:\\x', lot_id: 'l1', panels: [1] }, rq), []);
    rq.requests = [{ id: 'r9', request_no: 'FIB-260920-01', status: 'accepted', tool_id: 't1', lot_id: 'l1', panels: ['3253', '3300'] }];
    eq('...an open request on the same lot, tool and a shared panel', D.submitWarnings(full, rq).map(function (w) { return w.code; }), ['duplicate']);
    rq.requests[0].status = 'completed';
    eq('...not once it is completed', D.submitWarnings(full, rq), []);
    var engU = { id: 'e1', roles: ['engineer'], active: true };
    eq('drafts are private (Q33)', [D.canSeeRequest(engU, { status: 'draft', requester_id: 'e1' }), D.canSeeRequest(engU, { status: 'draft', requester_id: 'x' }), D.canSeeRequest(engU, { status: 'submitted', requester_id: 'e1' })], [true, false, true]);
    eq('...engineers see only their own (Q32 superseded 2026-09-28)', D.canSeeRequest(engU, { status: 'submitted', requester_id: 'x' }), false);
    eq('several lot numbers: commas, spaces, lines, runs, each once', D.parseLotNumbers('18178, 18179\n18181-18183 18178 18178.01'),
       { numbers: ['18178', '18179', '18181', '18182', '18183', '18178.01'], errors: [] });
    eq('...bad ones are named; a run goes up, at most 100', D.parseLotNumbers('L1, 18180-18170, 1-200').errors.length, 3);
    ok('lot numbers: 5 digits, a split lot adds .01 (M2-1)', D.isLotNumber('18178') && D.isLotNumber('18178.01') && D.isLotNumber('18178.2'));
    ok('...not letters, dashes or a trailing dot', !D.isLotNumber('L18178') && !D.isLotNumber('18178-01') && !D.isLotNumber('18178.') && !D.isLotNumber('18178.001'));
    var lotB = Object.assign({}, base, { users: base.users, buildups: [{ id: 'b1', code: 'BU-01' }],
      part_numbers: [{ id: 'pn1', code: 'PN-100', project_id: 'p1' }], lots: [{ id: 'l1', lot_number: '18178' }] });
    var goodLot = { lot_number: '18179', panel_count: 12, owner_id: 'u1' };
    eq('a good lot', D.validateEntry('lots', goodLot, lotB), []);
    ok('a lot number is registered once', D.validateEntry('lots', Object.assign({}, goodLot, { lot_number: '18178' }), lotB).length === 1);
    ok('...editing it keeps its number', !D.validateEntry('lots', Object.assign({}, goodLot, { id: 'l1', lot_number: '18178' }), lotB).length);
    ok('a lot is its number: no project or build-up needed (F-6)', !D.validateEntry('lots', { lot_number: '18180', owner_id: 'u1' }, lotB).length);
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
    /* =============== analytics (M5) =============== */
    group('Analytics: lab-time metrics, filters, backlog (M5-1)');
    var H = 3600000, aCal = { days: [1, 2, 3, 4, 5], start: '07:00', end: '18:00' }, aHs = {};
    eq('median / p90', [D.median([5, 1, 3]), D.median([1, 2, 3, 4]), D.percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90), D.median([])], [3, 2.5, 9, null]);
    // Mon 21.09.2026 (Vienna UTC+2): submitted 08:00, accepted 10:00, hold 12:00 -> Tue 09:00, completed Tue 12:00
    var ra = { id: 'ra', status: 'completed', tool_id: 'tF', project_id: 'pC', priority_id: 'p1', needed_by: '2026-09-22',
               submitted_ts: '2026-09-21T06:00:00.000Z', completed_ts: '2026-09-22T10:00:00.000Z', completed_by: 'uQ', bkm_id: 'b1' };
    var evA = [
      { request_id: 'ra', kind: 'status', ts: '2026-09-21T06:00:00.000Z', from: 'draft', to: 'submitted' },
      { request_id: 'ra', kind: 'status', ts: '2026-09-21T08:00:00.000Z', from: 'submitted', to: 'accepted' },
      { request_id: 'ra', kind: 'status', ts: '2026-09-21T10:00:00.000Z', from: 'accepted', to: 'on_hold', text: 'Tool down: vacuum', hold_reason_id: 'hr1' },
      { request_id: 'ra', kind: 'status', ts: '2026-09-22T07:00:00.000Z', from: 'on_hold', to: 'accepted' },
      { request_id: 'ra', kind: 'comment', ts: '2026-09-22T07:30:00.000Z', text: 'x' },
      { request_id: 'ra', kind: 'status', ts: '2026-09-22T10:00:00.000Z', from: 'in_progress', to: 'completed' }
    ];
    var tA = D.requestTimes(ra, evA, aCal, aHs, Date.parse('2026-09-25T10:00:00Z'));
    eq('response: submitted -> accepted = 2 h lab time', tA.response_ms / H, 2);
    eq('hold: Mon 12-18 + Tue 07-09 = 8 h lab time', tA.hold_ms / H, 8);
    eq('turnaround: 15 h lab time minus 8 h hold = 7 h', tA.turnaround_ms / H, 7);
    eq('calendar time kept too: 28 h', tA.calendar_ms / H, 28);
    eq('on time: completed before the end of Tuesday\'s lab day', tA.on_time, true);
    eq('the hold reason is counted by ID', tA.holds.map(function (x) { return x.reason_id + '/' + x.reason_text; }), ['hr1/Tool down']);
    var rb = Object.assign({}, ra, { id: 'rb', needed_by: '2026-09-21' });
    ok('needed Monday, done Tuesday: not on time', D.requestTimes(rb, evA.map(function (e) { return Object.assign({}, e, { request_id: 'rb' }); }), aCal, aHs, 0).on_time === false);
    var rc = Object.assign({}, ra, { id: 'rc', needed_by: null });
    eq('no needed-by date: on time not counted', D.requestTimes(rc, evA.map(function (e) { return Object.assign({}, e, { request_id: 'rc' }); }), aCal, aHs, 0).on_time, null);
    var evR = evA.concat([{ request_id: 'ra', kind: 'status', ts: '2026-09-23T07:00:00.000Z', from: 'completed', to: 'accepted' },
                          { request_id: 'ra', kind: 'status', ts: '2026-09-23T09:00:00.000Z', from: 'accepted', to: 'completed' }]);
    var tR = D.requestTimes(ra, evR, aCal, aHs, 0);
    eq('reopened and completed again: counts the reopen, the last completion wins', [tR.reopens, tR.completed_ts], [1, Date.parse('2026-09-23T09:00:00Z')]);
    var ch = D.statusChanges('ra', evA);
    eq('status at a moment', [D.statusAt(ch, Date.parse('2026-09-21T05:00:00Z')), D.statusAt(ch, Date.parse('2026-09-21T11:00:00Z')), D.statusAt(ch, Date.parse('2026-09-25T00:00:00Z'))],
       [null, 'on_hold', 'completed']);
    ok('date range is inclusive, in Vienna time', D.inDateRange(Date.parse('2026-09-21T22:30:00Z'), '2026-09-22', '2026-09-22') && !D.inDateRange(null, '', ''));
    eq('week start is the Monday; month is YYYY-MM', [D.viennaWeekStart(Date.parse('2026-09-24T10:00:00Z')), D.viennaMonth(Date.parse('2026-09-30T22:30:00Z'))], ['2026-09-21', '2026-10']);

    var aData = { requests: [ra, Object.assign({}, rb, { tool_id: 'tQ', project_id: 'pS', priority_id: 'p3', bkm_id: null, bkm_path: '' }),
                             { id: 'rd', status: 'clarification', tool_id: 'tF', project_id: 'pC', priority_id: 'p1', submitted_ts: '2026-09-23T06:00:00.000Z', assigned_to: 'uQ' },
                             { id: 'rx', status: 'draft', tool_id: 'tF' }],
                  request_events: evA.concat(evA.map(function (e) { return Object.assign({}, e, { request_id: 'rb' }); }),
                    [{ request_id: 'rd', kind: 'status', ts: '2026-09-23T06:00:00.000Z', from: 'draft', to: 'submitted' },
                     { request_id: 'rd', kind: 'status', ts: '2026-09-23T07:00:00.000Z', from: 'submitted', to: 'clarification' }]),
                  holidays: [], hold_reasons: [{ id: 'hr1', name: 'Tool down' }] };
    var aOpt = { now_ts: Date.parse('2026-09-25T10:00:00Z'), cal: aCal, levelOf: function (r) { return r.priority_id === 'p1' ? 1 : 3; } };
    var an = D.analytics(aData, { from_ymd: '2026-09-01', to_ymd: '2026-09-30' }, aOpt);
    eq('counts: 3 submitted (drafts never), 2 done, 1 open', [an.counts.submitted, an.counts.done, an.counts.open_now], [3, 2, 1]);
    eq('turnaround median 7 h, on time 1 of 2 dated = 50 %', [an.turnaround.median_ms / H, an.turnaround.dated, an.turnaround.on_time_pct], [7, 2, 50]);
    eq('turnaround per tool', an.turnaround_by_tool.map(function (x) { return x.tool_id + ':' + x.n; }).sort(), ['tF:1', 'tQ:1']);
    eq('Line stop: 2 submitted, response median 2 h', [an.line_stop.n, an.line_stop.response_median_ms / H], [2, 2]);
    eq('on-hold reasons, with the requests behind the count', an.hold_reasons, [{ reason_id: 'hr1', n: 2, ids: ['ra', 'rb'] }]);
    eq('clarification rate FIB: 1 of 2', an.clarification_by_tool.filter(function (x) { return x.tool_id === 'tF'; }).map(function (x) { return x.with_clarification + '/' + x.n; }), ['1/2']);
    eq('clarification by BKM, own/none grouped', an.clarification_by_bkm.map(function (x) { return x.bkm_id; }).sort(), ['b1', 'none']);
    eq('requests per month by project', an.per_month_project.map(function (x) { return [x.month, x.project_id, x.n]; }), [['2026-09', 'pC', 2], ['2026-09', 'pS', 1]]);
    eq('...each count knows its requests (click-through)', an.per_month_project[0].ids.sort(), ['ra', 'rd']);
    eq('open by assignee', an.open_by_assignee, [{ key: 'uQ', n: 1, ids: ['rd'] }]);
    eq('the top counts know their requests', [an.ids.done.sort(), an.ids.open_now], [['ra', 'rb'], ['rd']]);
    ok('backlog: one row per week, the last week has the open request', an.backlog.length >= 4 && an.backlog[an.backlog.length - 1].open === 1);
    eq('filter by tool', D.analytics(aData, { tool_id: 'tQ' }, aOpt).counts.submitted, 1);
    eq('filter by project', D.analytics(aData, { project_id: 'pC' }, aOpt).counts.submitted, 2);
    eq('a range that misses them all', D.analytics(aData, { from_ymd: '2027-01-01', to_ymd: '2027-01-31' }, aOpt).counts.done, 0);

    /* =============== the alert strip (M1-2, M3 audit) =============== */
    group('Alert strip: whose requests, the counts (M1-2)');
    var sCal = { days: [1, 2, 3, 4, 5], start: '07:00', end: '18:00' };
    var sNow = Date.parse('2026-09-25T10:00:00Z');                       // Friday 12:00 in Vienna
    var sTools = [{ id: 'tF', code: 'FIB', primary_operator_id: 'uQ', backup_operator_id: null }, { id: 'tQ', code: 'QVM', primary_operator_id: 'uX' },
                  { id: 'tOld', code: 'OLD', primary_operator_id: 'uQ', active: false }];
    var sReq = [
      { id: 'a', tool_id: 'tF', requester_id: 'uE', status: 'submitted', prio: 1 },
      { id: 'b', tool_id: 'tF', requester_id: 'uE', status: 'accepted', prio: 3, needed_by: '2026-09-24' },       // late
      { id: 'c', tool_id: 'tF', requester_id: 'uO', status: 'on_hold', prio: 3, needed_by: '2026-09-20' },         // on hold: not late
      { id: 'd', tool_id: 'tQ', requester_id: 'uE', status: 'clarification', prio: 2 },
      { id: 'e', tool_id: 'tF', requester_id: 'uE', status: 'completed', prio: 1 },                                // closed: not counted
      { id: 'f', tool_id: 'tOld', requester_id: 'uE', status: 'submitted', prio: 1 }                               // hidden tool
    ];
    function sCounts(user) { return D.stripCounts({ user: user, tools: sTools, requests: sReq, now_ts: sNow, cal: sCal, levelOf: function (r) { return r.prio; } }); }
    var qeU = { id: 'uQ', roles: ['quality'], active: true }, engU = { id: 'uE', roles: ['engineer'], active: true }, admU = { id: 'uA', roles: ['admin'], active: true };
    eq('a quality engineer counts their tools only (not a hidden one)', D.measuredTools(qeU, sTools).map(function (t) { return t.code; }), ['FIB']);
    eq('an admin without a tool of their own sees every active tool', D.measuredTools(admU, sTools).map(function (t) { return t.code; }), ['FIB', 'QVM']);
    eq('an engineer works no tool', D.measuredTools(engU, sTools), []);
    var cq = sCounts(qeU);
    eq('quality engineer: scope = their tools; Line stop, late, on hold', [cq.scope, cq.open, cq.line_stop, cq.late, cq.on_hold, cq.clarification], ['tools', 3, 1, 1, 1, 0]);
    ok('...on hold is never late, closed ones do not count', cq.late === 1 && cq.open === 3);
    var ce = sCounts(engU);
    eq('engineer: scope = their own requests, every tool', [ce.scope, ce.open, ce.line_stop, ce.late, ce.clarification], ['own', 4, 2, 1, 1]);
    eq('admin: every active tool', sCounts(admU).open, 4);
    eq('an Operator (no rights) sees only their own', sCounts({ id: 'uO', roles: ['operator'], active: true }).open, 1);

    /* =============== Hirata code (H-1..H-3) =============== */
    group('Hirata code: dots, digits, fields (H-1..H-3)');
    eq('digit 0: only the baseline dot', D.hirataDots(0), [false, false, false, false, true]);
    eq('digit 9 = 8 + 1', D.hirataDots(9), [true, false, false, true, true]);
    eq('digit 7 = 4 + 2 + 1', D.hirataDots('7'), [false, true, true, true, true]);
    eq('no digit above 9, no letters, no blanks', [D.hirataDots(10), D.hirataDots('x'), D.hirataDots(''), D.hirataDots(1.5)], [null, null, null, null]);
    ok('every digit 0-9 turns into dots and back', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].every(function (d) { return D.hirataDigit(D.hirataDots(d)) === d; }));
    ok('the baseline carries no value', D.hirataDigit([false, false, false, false, true]) === 0);
    ok('8 + 1 may be set (9)', D.hirataCanSet([true, false, false, false, true], 3));
    ok('8 + 2 may not (10 is above 9)', !D.hirataCanSet([true, false, false, false, true], 2));
    ok('8 + 4 may not (12)', !D.hirataCanSet([true, false, false, false, true], 1));
    ok('on an empty column any single dot may be set', [0, 1, 2, 3].every(function (row) { return D.hirataCanSet([false, false, false, false, true], row); }));
    ok('a dot that is on may always be switched off', D.hirataCanSet([true, false, false, true, true], 0));
    ok('the baseline row cannot be switched', !D.hirataCanSet([false, false, false, false, true], 4));
    eq('fields: 9 digits = Supplier 1, Year 1, Week 2, Day 1, Lot 2, Panel 2', D.HIRATA_FIELDS.reduce(function (n, f) { return n + f.width; }, 0), 9);
    eq('a full code reads every field', D.hirataFields('161234507').map(function (f) { return f.name + '=' + f.value; }),
       ['Supplier=1', 'Year=6', 'Week=12', 'Day=3', 'Lot per day=45', 'Panel=07']);
    eq('4 digits read as Lot per day + Panel (from the right)', D.hirataFields('3407').map(function (f) { return f.name + '=' + f.value; }), ['Lot per day=34', 'Panel=07']);
    eq('3 digits: Panel and part of the lot', D.hirataFields('407').map(function (f) { return f.name + '=' + f.value + (f.partial ? '*' : ''); }), ['Lot per day=4*', 'Panel=07']);
    eq('check: 9 digits is a full code', D.hirataCheck(' 161234507 ').kind, 'full');
    eq('check: 4 digits is the tail (lot + panel)', D.hirataCheck('3407').kind, 'tail');
    eq('check: other lengths are drawn as typed', D.hirataCheck('23').kind, 'short');
    eq('check: letters are refused', D.hirataCheck('34a7').problem, 'Digits only');
    ok('check: more than 9 digits is refused', !!D.hirataCheck('1234567890').problem);
    eq('panel IDs: 1 to 9 digits each (no forced length)', [D.isPanelId('7'), D.isPanelId('07'), D.isPanelId('3252'), D.isPanelId('161234507'), D.isPanelId('1612345070'), D.isPanelId('3a')],
       [true, true, true, true, false, false]);
    eq('several codes at once', D.hirataList('3407, 0119 1827').map(function (x) { return x.digits; }), ['3407', '0119', '1827']);
    eq('a panel ID may now be the full 9-digit code (H-1)', D.parsePanelIds('161234507, 3252').ids, ['161234507', '3252']);
    ok('...but not 10 digits', D.parsePanelIds('1612345070').errors.length === 1);

    group('Store: first run and seed data (M1-5, M1-8, M1-9)');
    var seed = ST._pure.seedData(Date.parse('2026-09-24T10:00:00Z'));
    eq('schema 14, revision 0', [seed.schema_version, seed.revision], [14, 0]);
    eq('...destinations seeded, locations start empty (addendum 02)', [seed.destinations.map(function (x) { return x.name; }), seed.panel_locations], [['Back to me', 'Back to the line', 'Lab may scrap them'], []]);
    eq('20 sample magazines M70345-M70364, 24 slots each (M2-23)', [seed.magazines.length, seed.magazines[0].code, seed.magazines[19].code, seed.magazines.every(function (m) { return m.slots === 24 && m.sample; })],
       [20, 'M70345', 'M70364', true]);
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
    ok('new IDs: 100,000 unique, stable form (M1)', (function () {
      var seen = {}, n = 100000, i, id, good = true;
      for (i = 0; i < n; i++) { id = ST._pure.newId('req'); if (seen[id] || !/^req_[0-9a-z]+_[0-9a-z]+$/.test(id)) { good = false; break; } seen[id] = 1; }
      return good && Object.keys(seen).length === n;
    })());

    // seed.js can carry real extra fields and closing days - no code change needed
    var custom = { calendar: { days: [1, 2, 3, 4, 5, 6], start: '06:00', end: '22:00' },
                   closing_days: [{ date: '2026-12-24', name: 'Christmas Eve' }, { date: '2026-12-25', name: 'dup of a public holiday' }],
                   priorities: [{ code: 'P1', name: 'Normal', level: 1, is_default: true }], buildups: [],
                   projects: [{ code: 'C4F' }, { code: 'NOVA' }],
                   part_numbers: [{ code: 'PN-1', description: 'Test board', project: 'C4F' }],
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
    eq('seed: a part number links its one project by code', cs.part_numbers[0].project_id, cs.projects[0].id);
    ok('seed: every entry is valid', ['tools', 'measurement_types', 'tool_fields', 'bkms', 'holidays', 'part_numbers'].every(function (c) {
      return cs[c].every(function (r) { return !D.validateEntry(c, r, cs).length; }); }));
    eq('seed: closing day added, a date already a public holiday is skipped',
       cs.holidays.filter(function (h) { return h.kind === 'closing'; }).map(function (h) { return h.date; }), ['2026-12-24']);
    ok('seed: holidays in date order', cs.holidays.every(function (h, i) { return !i || cs.holidays[i - 1].date <= h.date; }));
    try { ST._pure.seedData(0, { tools: [{ code: 'X', name: 'X', types: [], bkms: [{ name: 'b', type: 'nope', path: 'Z:\\b' }] }] }); record(false, 'seed: a BKM with an unknown type is refused'); }
    catch (x) { eq('seed: a BKM with an unknown type is refused', x.code, 'bad_seed'); }
    try { ST._pure.seedData(0, { tools: [], projects: [{ code: 'C4F' }], part_numbers: [{ code: 'PN-1', project: 'NOPE' }] }); record(false, 'seed: a part number with an unknown project is refused'); }
    catch (x) { eq('seed: a part number with an unknown project is refused', x.code, 'bad_seed'); }

    var a = await freshStore();
    ok('first load writes the file', !!a.files[cfg.data_file]);
    eq('lab calendar Mon-Fri 07:00-18:00', ST.calendar(), { days: [1, 2, 3, 4, 5], start: '07:00', end: '18:00' });
    eq('no PIN yet', ST.hasPin(), false);
    await refused('a PIN of 3 digits is refused', ST.createFirstAdmin({ name: 'Prince Khurana', windows_id: 'pkhurana', pin: '123' }), 'bad_pin');
    await refused('a bad Windows ID is refused', ST.createFirstAdmin({ name: 'Prince Khurana', windows_id: 'p k', pin: '1234' }), 'bad_identity');
    eq('...and nobody was created', ST.data().users.length, 0);
    var first = await ST.createFirstAdmin({ name: ' Prince Khurana ', windows_id: 'ATS\\PKhurana', pin: '2468' });
    eq('the first person is Admin', first.roles, ['admin']);
    eq('ID stored lowercase with the domain apart', [first.windows_id, first.domain], ['pkhurana', 'ATS']);
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
    await refused('an operator cannot grant herself admin', ST.saveEntry('users', { id: anna.id, fields: { roles: ['operator', 'admin'] } }), 'not_admin');
    await refused('M3: ...nor change the admin PIN', ST.setAdminPin('9999', 'x'), 'not_admin');
    var admM3 = ST.list('users', { all: true }).filter(function (u) { return (u.roles || []).indexOf('admin') !== -1; })[0].id;
    ST.setCurrentUser(admM3);
    var edM3 = await ST.saveEntry('users', { fields: { name: 'Ed M3', roles: ['engineer'] } });
    ST.setCurrentUser(edM3.id);
    await refused('M3: an engineer cannot take the admin role', ST.saveEntry('users', { id: edM3.id, fields: { roles: ['engineer', 'admin'] } }), 'not_admin');
    await refused('M3: ...nor hand it to someone else', ST.saveEntry('users', { id: anna.id, fields: { roles: ['operator', 'admin'] } }), 'not_admin');
    ST.setCurrentUser(admM3);
    await ST.saveEntry('users', { id: edM3.id, fields: { roles: ['engineer', 'analyst'] } });
    ST.setCurrentUser(edM3.id);
    eq('M3: a role change is live on the next read (no reload)', ST.currentUser().roles, ['engineer', 'analyst']);
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
    var pn = await ST.saveEntry('part_numbers', { fields: { code: ' pn-10234-a ', description: ' Test vehicle ', project_id: prj[1].id } });
    eq('a part number: code upper case, text trimmed, one project', [pn.code, pn.description, pn.project_id], ['PN-10234-A', 'Test vehicle', prj[1].id]);
    ok('...ID prefix pn_, audited', /^pn_/.test(pn.id) && ST.data().audit_log.slice(-1)[0].entity === 'part_number');
    await refused('the same part number twice is refused', ST.saveEntry('part_numbers', { fields: { code: 'PN-10234-A', project_id: prj[2].id } }), 'invalid');
    await refused('a part number without a project is refused', ST.saveEntry('part_numbers', { fields: { code: 'PN-2' } }), 'invalid');
    eq('a project used by a part number counts as used', ST.entryUsage('projects', prj[1].id).text, '1 part number');
    await refused('...so it cannot be deleted', ST.deleteEntry('projects', prj[1].id, 'test'), 'in_use');
    await ST.saveEntry('part_numbers', { id: pn.id, fields: { project_id: prj[0].id } });
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
    var pnL = await ST.saveEntry('part_numbers', { fields: { code: 'PN-L1', project_id: prjL.id } });
    var lot = await ST.saveLot({ fields: { lot_number: ' 18178 ', panel_count: 12, note: ' scratch on 3 ' } });
    eq('a lot: trimmed, owned by who registers it, version 1', [lot.lot_number, lot.note, lot.owner_id, lot.version, /^lot_/.test(lot.id)], ['18178', 'scratch on 3', ST.currentUser().id, 1, true]);
    ok('...audited', ST.data().audit_log.slice(-1)[0].entity === 'lot' && ST.data().audit_log.slice(-1)[0].new_value === '18178');
    await refused('the same lot number twice is refused', ST.saveLot({ fields: { lot_number: '18178', panel_count: 2 } }), 'invalid');
    var lot2 = await ST.saveLot({ id: lot.id, version: 1, fields: { panel_count: 16 } });
    eq('an edit: new count, version 2', [lot2.panel_count, lot2.version], [16, 2]);
    var lotP = await ST.saveLot({ id: lot.id, version: 2, fields: { project_id: prjL.id, part_number_id: pnL.id } });
    eq('a lot links its project + part number (F-7, optional)', [lotP.project_id, lotP.part_number_id, lotP.version], [prjL.id, pnL.id, 3]);
    await refused('...not a missing project', ST.saveLot({ id: lot.id, version: 3, fields: { project_id: 'prj_nope' } }), 'invalid');
    await refused('...not a missing part number', ST.saveLot({ id: lot.id, version: 3, fields: { part_number_id: 'pn_nope' } }), 'invalid');
    var prjOther = ST.list('projects').filter(function (p) { return p.id !== prjL.id; })[0];
    var pnOther = await ST.saveEntry('part_numbers', { fields: { code: 'PN-OTHER', project_id: prjOther.id } });
    await refused('...not a part number of another project (P-1)', ST.saveLot({ id: lot.id, version: 3, fields: { project_id: prjL.id, part_number_id: pnOther.id } }), 'invalid');
    await refused('...an old version is refused', ST.saveLot({ id: lot.id, version: 1, fields: { panel_count: 20 } }), 'stale_version');
    await refused('...no change is "nothing changed"', ST.saveLot({ id: lot.id, fields: { panel_count: 16 } }), 'no_change');
    var tomL = await ST.saveEntry('users', { fields: { name: 'Tom Lot', roles: ['engineer'] } });
    var qeL = await ST.saveEntry('users', { fields: { name: 'Quinn QE', roles: ['quality'] } });
    var adminL = ST.currentUser().id;
    ST.setCurrentUser(qeL.id);
    await refused('a quality engineer alone cannot register a lot', ST.saveLot({ fields: { lot_number: '18180', panel_count: 2 } }), 'not_allowed');
    ST.setCurrentUser(tomL.id);
    var tomLot = await ST.saveLot({ fields: { lot_number: '18178.01', panel_count: 4 } });
    eq('an engineer registers a split lot and owns it', [tomLot.lot_number, tomLot.owner_id], ['18178.01', tomL.id]);
    await refused('...but cannot change someone else\'s lot', ST.saveLot({ id: lot.id, fields: { panel_count: 3 } }), 'not_allowed');
    await refused('...a delete needs a reason', ST.deleteLot(tomLot.id, ''));
    await ST.deleteLot(tomLot.id, 'typo');
    eq('...and deletes their own unused lot', ST.byId('lots', tomLot.id), null);
    ST.setCurrentUser(adminL);

    group('Store: lot fields and sample lots');
    var purpose = ST.list('lot_fields')[0], startOn = ST.list('lot_fields')[1];
    var devId = purpose.choices[0].id;
    var lx = await ST.saveLot({ fields: { lot_number: '18190', panel_count: 6,
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
    var magsBefore = ST.list('magazines', { all: true }).length;
    await refused('the sample magazines: none added while all 20 are there', ST.addSampleMagazines(), 'no_change');
    await ST.deleteEntry('magazines', ST.list('magazines')[0].id, 'test');
    eq('...a missing one is added back, the others skipped', [await ST.addSampleMagazines(), ST.list('magazines', { all: true }).length], [1, magsBefore]);
    ST.setCurrentUser(tomL.id);
    await refused('...only admins add them', ST.addSampleLots(), 'not_admin');
    ST.setCurrentUser(adminL);

    group('Store: Settings > Lots - several at once, owner');
    var many = await ST.addLots({ numbers: ['20001', '20002', '20003'], fields: { panel_count: 8, note: ' batch ' } });
    eq('an admin adds three lots at once, same set-up, owned by the admin', many.map(function (l) { return l.lot_number + ':' + l.panel_count + ':' + l.note + ':' + (l.owner_id === adminL); }),
       ['20001:8:batch:true', '20002:8:batch:true', '20003:8:batch:true']);
    var before3 = ST.data().lots.length;
    await refused('one number already registered stops the whole batch', ST.addLots({ numbers: ['20004', '20002'], fields: { panel_count: 8 } }), 'invalid');
    eq('...nothing added', ST.data().lots.length, before3);
    await refused('...and a bad panel count too', ST.addLots({ numbers: ['20005'], fields: { panel_count: 0 } }), 'invalid');
    var own = await ST.setLotOwner(many[0].id, tomL.id, 'Tom runs this DOE');
    eq('an admin gives a lot to someone else, with a reason', [own.owner_id, ST.data().audit_log.slice(-1)[0].field], [tomL.id, 'owner_id']);
    await refused('...a reason is required', ST.setLotOwner(many[0].id, adminL, ''), 'invalid');
    ST.setCurrentUser(tomL.id);
    await refused('an engineer cannot add lots in bulk', ST.addLots({ numbers: ['20009'], fields: { panel_count: 2 } }), 'not_admin');
    ST.setCurrentUser(adminL);

    group('Store: form v2 - Hirata IDs, layers, magazine slots, a new lot at submit (F-1..F-5)');
    var m1 = ST.list('magazines')[0];
    var ml = await ST.saveLot({ fields: { lot_number: '40001' } });
    eq('a lot without a panel count (F-1)', ml.panel_count, null);
    var bu4 = ST.list('buildups').filter(function (b) { return b.code === 'BU-04'; })[0];
    await ST.saveEntry('buildups', { id: bu4.id, fields: { layers: 3 } });
    eq('an admin sets a build-up\'s layers', D.layersFor(ST.byId('buildups', bu4.id)).slice(-1), ['4B']);
    await refused('...a whole number 0-20', ST.saveEntry('buildups', { id: bu4.id, fields: { layers: 30 } }), 'invalid');

    group('Store: requests - drafts and submit (M2 step 4)');
    var qvm = tool('QVM'), qType = typesOf('QVM')[0];
    var normal = ST.list('priorities').filter(function (p) { return p.is_default; })[0];
    var locB2 = await ST.saveEntry('panel_locations', { fields: { name: 'Rack B2' } });
    var locC1 = await ST.saveEntry('panel_locations', { fields: { name: 'Rack C1' } });
    var dstMe = ST.list('destinations').filter(function (x) { return x.name === 'Back to me'; })[0];
    var dstScrap = ST.list('destinations').filter(function (x) { return x.name === 'Lab may scrap them'; })[0];
    var d1 = await ST.saveDraft({ fields: { tool_id: qvm.id, purpose: '  pads  ' } });
    eq('a draft: no ID yet, trimmed, private, timeline "created"', [d1.status, d1.request_no, d1.purpose, d1.requester_id, ST.requestEvents(d1.id).map(function (e) { return e.kind; })],
       ['draft', null, 'pads', adminL, ['created']]);
    await refused('a draft without a tool is refused', ST.saveDraft({ fields: { purpose: 'x' } }), 'invalid');
    await refused('...saving it unchanged is "nothing changed"', ST.saveDraft({ id: d1.id, fields: { purpose: 'pads' } }), 'no_change');
    var d1b = await ST.saveDraft({ id: d1.id, version: d1.version, fields: { tool_id: qvm.id, purpose: 'pads v2' } });
    eq('...re-saving with the fresh version works (the autosave contract)', [d1b.purpose, ST.byId('requests', d1.id).purpose], ['pads v2', 'pads v2']);
    await refused('submit checks everything', ST.submitRequest({ id: d1.id, fields: {} }), 'invalid');
    eq('...and changes nothing', [ST.byId('requests', d1.id).status, ST.byId('requests', d1.id).request_no], ['draft', null]);
    var s1 = await ST.submitRequest({ id: d1.id, fields: { project_id: prjL.id, type_id: qType.id, lot_id: lx.id, panels: [3, 1, 3], priority_id: normal.id, panel_location_id: locB2.id, destination_id: dstMe.id, bkm_path: 'Z:\\bkm\\my.pptx' } });
    ok('submitted: ID QVM-YYMMDD-01, panels once in the order given, counted', /^QVM-\d{6}-01$/.test(s1.request_no) && s1.status === 'submitted' && s1.panels.join() === '3,1' && s1.panel_count === 2 && !!s1.submitted_ts);
    eq('...timeline: created, then draft -> submitted', ST.requestEvents(s1.id).map(function (e) { return e.kind + ':' + e.from + '>' + e.to; }), ['created:null>draft', 'status:draft>submitted']);
    ok('...audited with its ID', ST.data().audit_log.slice(-1)[0].action === 'submit' && ST.data().audit_log.slice(-1)[0].reason === s1.request_no);
    var s2 = await ST.submitRequest({ fields: { project_id: prjL.id, tool_id: qvm.id, type_id: qType.id, lot_id: lx.id, panels: [2], priority_id: normal.id, panel_location_id: locB2.id, destination_id: dstMe.id, purpose: 'pads' } });
    ok('a second QVM request the same day gets 02 - submitted straight away, no draft first', /^QVM-\d{6}-02$/.test(s2.request_no));
    await refused('a submitted request is not a draft any more', ST.saveDraft({ id: s1.id, fields: { purpose: 'x' } }), 'not_allowed');
    await refused('...and is never deleted (cancel instead, Q35)', ST.deleteDraft(s1.id), 'not_allowed');
    eq('a lot with requests counts them', ST.lotUsage(lx.id).text, '2 requests');
    await refused('...and cannot be deleted', ST.deleteLot(lx.id, 'x'), 'in_use');
    eq('the tool, type and priority count as used', [ST.entryUsage('tools', qvm.id).text.indexOf('2 requests') !== -1, ST.entryUsage('priorities', normal.id).text], [true, '2 requests']);
    var d2 = await ST.saveDraft({ fields: { tool_id: qvm.id } });
    ST.setCurrentUser(tomL.id);
    eq('someone else sees none of them (own requests only), not even the draft', ST.visibleRequests().map(function (r) { return r.request_no; }), []);
    await refused('...cannot change it', ST.saveDraft({ id: d2.id, fields: { purpose: 'x' } }), 'not_allowed');
    await refused('...or delete it', ST.deleteDraft(d2.id), 'not_allowed');
    ST.setCurrentUser(qeL.id);
    await refused('a quality engineer alone does not request', ST.saveDraft({ fields: { tool_id: qvm.id } }), 'not_allowed');
    ST.setCurrentUser(adminL);
    await ST.deleteDraft(d2.id);
    eq('the author deletes the draft, and its timeline', [ST.byId('requests', d2.id), ST.requestEvents(d2.id).length], [null, 0]);

    group('Capacity per tool (C-1, C-2)');
    var cCal = { days: [1, 2, 3, 4, 5], start: '07:00', end: '18:00' };
    eq('lab days: Mon 21 - Fri 25 Sept = 5; Mon - Sun = 5; a holiday out', [D.labDaysBetweenYmd('2026-09-21', '2026-09-25', cCal, {}), D.labDaysBetweenYmd('2026-09-21', '2026-09-27', cCal, {}),
       D.labDaysBetweenYmd('2026-09-21', '2026-09-25', cCal, { '2026-09-23': true })], [5, 5, 4]);
    eq('...backwards or a bad date: 0', [D.labDaysBetweenYmd('2026-09-25', '2026-09-21', cCal, {}), D.labDaysBetweenYmd('x', '2026-09-21', cCal, {})], [0, 0]);
    var fibC = { code: 'FIB', capacity_per_day: 2 };
    eq('capacity: set or not', [D.capacityOf(fibC), D.capacityOf({ capacity_per_day: 0 }), D.capacityOf({}), D.capacityOf(null)], [2, null, null, null]);
    eq('queue days: 7 open at 2 a day = 3.5', [D.queueDays(7, fibC), D.queueDays(7, {})], [3.5, null]);
    eq('load: 80 % ok, 120 % amber, 150 % red, no capacity none', [D.capacityLoad(8, 10), D.capacityLoad(12, 10), D.capacityLoad(15, 10), D.capacityLoad(5, null)],
       [{ pct: 80, level: 'ok' }, { pct: 120, level: 'amber' }, { pct: 150, level: 'red' }, { pct: null, level: null }]);
    ok('form note when the queue is longer than the days left', /about 6 lab days of work queued - your date may be tight \(2 lab days left\)/.test(
       D.capacityNote(fibC, 12, '2026-09-24', '2026-09-25', cCal, {}) || ''));
    eq('...no note when there is time, no date, or no capacity', [D.capacityNote(fibC, 2, '2026-09-21', '2026-09-25', cCal, {}), D.capacityNote(fibC, 12, '2026-09-24', null, cCal, {}),
       D.capacityNote({ code: 'X' }, 99, '2026-09-24', '2026-09-25', cCal, {})], [null, null, null]);
    ok('a capacity must be more than 0 and at most 100', D.validateEntry('tools', { code: 'SEM', name: 'SEM', status: 'up', capacity_per_day: 0 }, {}).length === 1 &&
       !D.validateEntry('tools', { code: 'SEM', name: 'SEM', status: 'up', capacity_per_day: 2.5 }, {}).length && !D.validateEntry('tools', { code: 'SEM', name: 'SEM', status: 'up', capacity_per_day: null }, {}).length);
    var capData = { requests: [ra, Object.assign({}, rb, { tool_id: 'tQ' })], request_events: evA.concat(evA.map(function (e) { return Object.assign({}, e, { request_id: 'rb' }); })),
                    holidays: [], tools: [{ id: 'tF', code: 'FIB', capacity_per_day: 0.2 }, { id: 'tQ', code: 'QVM' }] };
    var capA = D.analytics(capData, { from_ymd: '2026-09-21', to_ymd: '2026-09-25' }, { now_ts: Date.parse('2026-09-25T10:00:00Z'), cal: cCal, levelOf: function () { return 3; } });
    eq('analytics: capacity vs demand per tool (5 lab days x 0.2 = 1; demand 1 = 100 %)', capA.capacity_by_tool.map(function (x) { return [x.tool_id, x.demand, x.capacity, x.load_pct, x.level]; }),
       [['tF', 1, 1, 100, 'ok'], ['tQ', 1, null, null, null]]);

    group('Personal request templates (Q28, T-1..T-3)');
    var tf = D.templateFieldsOf(s1);
    eq('a template keeps everything in the form', Object.keys(tf).sort(), D.TEMPLATE_FIELDS.slice().sort());
    eq('...lot, panels and place kept (changed 2026-09-28)', [tf.lot_id, tf.panels, tf.panel_location_id], [s1.lot_id, s1.panels, s1.panel_location_id]);
    ok('...never the request itself', ['request_no', 'duplicated_from'].every(function (k) { return !(k in tf); }));
    eq('names: required, not twice (any case)', [D.templateNameProblems('  ', []).length, D.templateNameProblems('QVM pads', [{ name: 'qvm  PADS' }]).length, D.templateNameProblems('QVM pads', []).length], [1, 1, 0]);
    await refused('a quality engineer alone keeps no templates', (ST.setCurrentUser(qeL.id), ST.saveTemplate({ name: 'x', request_id: s1.id })), 'not_allowed');
    ST.setCurrentUser(adminL);
    var tp1 = await ST.saveTemplate({ name: 'QVM pads', request_id: s1.id });
    eq('save a request as a template: its fields, audited', [tp1.fields.tool_id, tp1.fields.type_id, tp1.fields.bkm_path, tp1.owner_id, ST.data().audit_log.slice(-1)[0].entity],
       [qvm.id, qType.id, 'Z:\\bkm\\my.pptx', adminL, 'template']);
    await refused('the same name twice is refused', ST.saveTemplate({ name: 'qvm pads', request_id: s2.id }), 'invalid');
    var tp2 = await ST.saveTemplate({ name: 'From the form', fields: { tool_id: qvm.id, purpose: 'x', lot_id: lx.id, panels: ['1'] } });
    eq('...from the form\'s fields too (lot and panels kept)', [tp2.fields.lot_id, tp2.fields.panels, tp2.fields.purpose], [lx.id, ['1'], 'x']);
    ST.setCurrentUser(tomL.id);
    eq('templates are personal: someone else sees none of them', ST.myTemplates(tomL.id).length, 0);
    await refused('...and cannot rename or delete one', ST.deleteTemplate(tp1.id), 'not_allowed');
    ST.setCurrentUser(adminL);
    await ST.renameTemplate(tp2.id, 'Pads, quick');
    eq('rename, then my templates in name order', ST.myTemplates(adminL).map(function (t) { return t.name; }), ['Pads, quick', 'QVM pads']);
    var ck = D.templateCheck(tp1, ST.data());
    eq('a template with everything still there: usable, no notes', [ck.usable, ck.notes], [true, []]);
    var hid = JSON.parse(JSON.stringify(ST.data()));
    hid.measurement_types.forEach(function (m) { if (m.id === qType.id) m.active = false; });
    var ck2 = D.templateCheck(tp1, hid);
    eq('a hidden type is left empty, with a note (T-3)', [ck2.usable, ck2.fields.type_id, ck2.notes], [true, null, ['The measurement type of this template is hidden - pick another']]);
    hid.tools.forEach(function (t) { if (t.id === qvm.id) t.active = false; });
    eq('its tool out of use: cannot be started, only deleted', [D.templateCheck(tp1, hid).usable, D.templateCheck(tp1, hid).reason], [false, 'Its tool is no longer in use']);
    var magL = ST.list('magazines')[0];
    var tp3 = await ST.saveTemplate({ name: 'Full', fields: { tool_id: qvm.id, lot_id: lx.id, panels: ['3252'], panel_count: 1,
      process_step_id: ps1.id, magazine_id: magL.id, slots: [3], panel_location_id: locB2.id, needed_by: '2026-10-09',
      priority_id: normal.id, priority_reason: 'Audit Friday', destination_id: dstMe.id, purpose: 'x' } });
    var ck3 = D.templateCheck(tp3, ST.data());
    eq('a full template starts as-is: usable, no notes', [ck3.usable, ck3.notes, ck3.fields.lot_id, ck3.fields.panels, ck3.fields.slots, ck3.fields.needed_by, ck3.fields.priority_reason],
       [true, [], lx.id, ['3252'], [3], '2026-10-09', 'Audit Friday']);
    var gone = JSON.parse(JSON.stringify(ST.data()));
    gone.magazines.forEach(function (m) { if (m.id === magL.id) m.active = false; });
    gone.lots = gone.lots.filter(function (l) { return l.id !== lx.id; });
    var ck4 = D.templateCheck(tp3, gone);
    eq('a hidden magazine is left empty with slots cleared; a gone lot too', [ck4.fields.magazine_id, ck4.fields.slots, ck4.fields.lot_id, ck4.notes],
       [null, [], null, ['The lot of this template is gone - pick another', 'The magazine of this template is hidden - pick another']]);
    await ST.deleteTemplate(tp3.id);
    var prjCode = ST.list('projects')[0].code;
    var tp4 = await ST.saveTemplate({ name: 'New names', fields: { tool_id: qvm.id, new_project: { code: prjCode }, new_type: { name: '  ' } } });
    var ck5 = D.templateCheck(tp4, ST.data());
    eq('a new name that exists by now is left empty, with a note; a blank one dropped quietly', [ck5.fields.new_project, ck5.fields.new_type, ck5.notes],
       [null, null, ['Project ' + prjCode + ' exists already - pick it from suggestions']]);
    await ST.deleteTemplate(tp4.id);
    await ST.deleteTemplate(tp2.id);
    eq('delete, audited', [ST.myTemplates(adminL).length, ST.data().audit_log.slice(-1)[0].action], [1, 'delete']);
    var v10 = ST._pure.seedData(); v10.schema_version = 10; delete v10.templates;
    ST._pure.migrate(v10);
    eq('schema 10 -> 11 (-> 14): templates start empty', [v10.schema_version, v10.templates], [14, []]);
    var v11 = ST._pure.seedData(); v11.schema_version = 11;
    v11.lots = [{ id: 'lot_old', lot_number: '11111' }, { id: 'lot_new', lot_number: '22222', project_id: 'prj_x', part_number_id: 'pn_x' }];
    ST._pure.migrate(v11);
    var v12 = ST._pure.seedData(); v12.schema_version = 12;
    v12.part_numbers = [{ id: 'pn_old', code: 'PN-9', project_ids: ['p1', 'p2'] }];
    ST._pure.migrate(v12);
    eq('schema 12 -> 13 (-> 14): part numbers keep their first project only (P-1)',
      [v12.schema_version, v12.part_numbers[0].project_id, 'project_ids' in v12.part_numbers[0]], [14, 'p1', false]);
    eq('schema 11 -> 12 (-> 14): lots gain empty project + part-number links, kept ones survive',
      [v11.schema_version, v11.lots[0].project_id, v11.lots[0].part_number_id, v11.lots[1].project_id],
      [14, null, null, 'prj_x']);
    var v13 = ST._pure.seedData(); v13.schema_version = 13;
    v13.requests = [{ id: 'r1', panel_location: 'Rack B2', after: 'back_to_me' }, { id: 'r2', panel_location: 'rack  b2', after: 'other', after_other: 'to SEM' }, { id: 'r3' }];
    ST._pure.migrate(v13);
    function locName(id) { return v13.panel_locations.filter(function (x) { return x.id === id; })[0].name; }
    function dstName(id) { return v13.destinations.filter(function (x) { return x.id === id; })[0].name; }
    eq('schema 13 -> 14: distinct texts become one entry each, requests link them, old keys gone (addendum 02)',
      [v13.schema_version, v13.panel_locations.length, locName(v13.requests[0].panel_location_id), v13.requests[0].panel_location_id === v13.requests[1].panel_location_id,
       dstName(v13.requests[0].destination_id), dstName(v13.requests[1].destination_id), v13.requests[2].panel_location_id, 'after' in v13.requests[0]],
      [14, 1, 'Rack B2', true, 'Back to me', 'to SEM', null, false]);

    group('Store: comments and cancel (M2 step 5)');
    await ST.saveEntry('users', { id: tomL.id, fields: { windows_id: 'tlot' } });
    await ST.addComment(s1.id, '  please check pad 3, @tlot  ');
    var cm = ST.requestEvents(s1.id).slice(-1)[0];
    eq('a comment: trimmed, by me, @tlot found', [cm.kind, cm.text, cm.user_id, cm.mentions], ['comment', 'please check pad 3, @tlot', adminL, [tomL.id]]);
    await refused('an empty comment is refused', ST.addComment(s1.id, '   '), 'invalid');
    var d3 = await ST.saveDraft({ fields: { tool_id: qvm.id } });
    await refused('no comments on a draft', ST.addComment(d3.id, 'x'), 'not_allowed');
    ST.setCurrentUser(tomL.id);
    await refused('someone else cannot comment on it either', ST.addComment(s1.id, 'seen'), 'not_allowed');
    ST.setCurrentUser(adminL);
    await ST.addComment(s1.id, 'seen');
    eq('anyone who can see it may comment', ST.requestEvents(s1.id).filter(function (e) { return e.kind === 'comment'; }).length, 2);
    var cmId = ST.requestEvents(s1.id).filter(function (e) { return e.kind === 'comment'; })[0].id;
    var auditBefore = auditCount();
    await ST.editComment(cmId, 'please check pad 3 and 4, @tlot');
    var cm2 = ST.requestEvents(s1.id).filter(function (e) { return e.id === cmId; })[0];
    eq('the author edits her comment: new text, edited stamp, audited',
      [cm2.text, !!cm2.edited_ts, auditCount() > auditBefore], ['please check pad 3 and 4, @tlot', true, true]);
    await refused('same text is nothing changed', ST.editComment(cmId, 'please check pad 3 and 4, @tlot'), 'no_change');
    await refused('an empty edit is refused', ST.editComment(cmId, '  '), 'invalid');
    ST.setCurrentUser(tomL.id);
    await refused('someone else cannot edit it', ST.editComment(cmId, 'hijacked'), 'not_allowed');
    ST.setCurrentUser(adminL);
    ST.setCurrentUser(tomL.id);
    await refused('someone else cannot cancel it', ST.cancelRequest(s1.id, 'x'), 'not_allowed');
    ST.setCurrentUser(adminL);
    await refused('cancel needs a reason', ST.cancelRequest(s1.id, ' '), 'invalid');
    var c1 = await ST.cancelRequest(s1.id, 'wrong lot');
    eq('cancelled: status, timeline with the reason, still there (Q35)', [c1.status, ST.requestEvents(s1.id).slice(-1)[0].to, ST.requestEvents(s1.id).slice(-1)[0].text, !!ST.byId('requests', s1.id)],
       ['cancelled', 'cancelled', 'wrong lot', true]);
    await refused('...only once', ST.cancelRequest(s1.id, 'again'), 'not_allowed');
    await ST.deleteDraft(d3.id);

    group('Store: the workflow (RBAC, 2026-09-28)');
    await ST.saveEntry('tools', { id: qvm.id, fields: { primary_operator_id: qeL.id } });
    var anL = await ST.saveEntry('users', { fields: { name: 'Ana Lyst', roles: ['analyst'] } });
    var w = await ST.submitRequest({ fields: { project_id: prjL.id, tool_id: qvm.id, type_id: qType.id, lot_id: lx.id, panels: [4], priority_id: normal.id,
      panel_location_id: locB2.id, destination_id: dstMe.id, purpose: 'pads' } });
    eq('assigned to the primary at submit', w.assigned_to, qeL.id);
    ST.setCurrentUser(tomL.id);
    await refused('an engineer cannot accept', ST.requestAction(w.id, 'accept', {}), 'not_allowed');
    await refused('...nor receive panels', ST.requestAction(w.id, 'receive', {}), 'not_allowed');
    ST.setCurrentUser(qeL.id);
    await refused('...nor can anyone complete before Start', ST.requestAction(w.id, 'complete', { results_path: 'Z:\\r', panels_outcome: 'returned' }), 'not_allowed');
    await refused('...nor start before the panels arrive', ST.requestAction(w.id, 'start', {}), 'not_allowed');
    w = await ST.requestAction(w.id, 'accept', { expected_done: '2026-10-09' });
    eq('Accept with an expected done date (M3-1)', [w.status, w.expected_done], ['accepted', '2026-10-09']);
    var holdR = ST.list('hold_reasons')[1];
    await refused('Hold needs a reason from the list', ST.requestAction(w.id, 'hold', {}), 'invalid');
    w = await ST.requestAction(w.id, 'hold', { hold_reason_id: holdR.id, note: 'stage error' });
    eq('the hold event keeps the reason ID, for analytics (M5)', ST.data().request_events.filter(function (e) { return e.request_id === w.id && e.to === 'on_hold'; }).slice(-1)[0].hold_reason_id, holdR.id);
    eq('On hold: reason, note, remembers where it was', [w.status, w.hold_reason_id, w.return_to], ['on_hold', holdR.id, 'accepted']);
    w = await ST.requestAction(w.id, 'resume', {});
    eq('Resume goes back to Accepted', [w.status, w.hold_reason_id], ['accepted', null]);
   w = await ST.requestAction(w.id, 'hold', { hold_reason: 'Sample prep delay', note: 'new reason typed' });
   var holdTyped = ST.list('hold_reasons').filter(function (x) { return x.name === 'Sample prep delay'; })[0];
   eq('typed hold reason is created and linked', [!!holdTyped, w.hold_reason_id], [true, (holdTyped || {}).id]);
   w = await ST.requestAction(w.id, 'resume', {});
    await ST.receivePanels(w.id, 'QVM shelf 1');
    eq('Panels received: a state, with who, when, where (Q25)', [ST.byId('requests', w.id).status, ST.byId('requests', w.id).received_by, ST.byId('requests', w.id).received_where], ['panels_received', qeL.id, 'QVM shelf 1']);
    await refused('...only once', ST.receivePanels(w.id, 'x'), 'not_allowed');
    w = await ST.requestAction(w.id, 'clarify', { text: 'Which pads?' });
    ST.setCurrentUser(adminL);
    w = await ST.requestAction(w.id, 'answer', { text: 'Corner pads' });
    eq('Needs clarification -> Answered goes back to where it was (M3-2)', w.status, 'panels_received');
    ST.setCurrentUser(qeL.id);
    w = await ST.requestAction(w.id, 'start', {});
    eq('Start runs from Panels received', w.status, 'in_progress');
    await refused('Complete needs a results share path', ST.requestAction(w.id, 'complete', { results_path: 'results', panels_outcome: 'returned' }), 'invalid');
    w = await ST.requestAction(w.id, 'complete', { results_path: 'Z:\\lab\\QVM\\x', panels_outcome: 'returned' });
    eq('Complete: results path, panels returned (M3-6)', [w.status, w.results_path, w.panels_outcome, w.completed_by], ['completed', 'Z:\\lab\\QVM\\x', 'returned', qeL.id]);
    await refused('a quality engineer cannot analyze', ST.requestAction(w.id, 'analyze', {}), 'not_allowed');
    ST.setCurrentUser(tomL.id);
    await refused('...nor can the engineer', ST.requestAction(w.id, 'analyze', {}), 'not_allowed');
    ST.setCurrentUser(adminL);
    await refused('Reopen needs a reason', ST.requestAction(w.id, 'reopen', {}), 'invalid');
    w = await ST.requestAction(w.id, 'reopen', { text: 'values look off' });
    eq('Reopen -> Accepted, counted', [w.status, w.reopened, w.completed_ts], ['accepted', 1, null]);
    ST.setCurrentUser(qeL.id);
    await ST.requestAction(w.id, 'receive', { received_where: 'QVM shelf 1' });
    await ST.requestAction(w.id, 'start', {});
    await ST.requestAction(w.id, 'complete', { results_path: 'Z:\\lab\\QVM\\x', panels_outcome: 'returned' });
    ST.setCurrentUser(anL.id);
    await refused('Analyze needs the analyzed data folder', ST.requestAction(w.id, 'analyze', {}), 'invalid');
    w = await ST.requestAction(w.id, 'analyze', { analyzed_path: 'Z:\\\\lab\\\\QVM\\\\analysis' });
    ok('Analyzed closes it, by the analyst', w.status === 'analyzed' && D.isClosed(w, Date.now()) && w.analyzed_by === anL.id);
    eq('...the analyzed data folder is stored and on the timeline', [w.analyzed_path, ST.requestEvents(w.id).slice(-1)[0].text], ['Z:\\\\lab\\\\QVM\\\\analysis', 'Analysis in Z:\\\\lab\\\\QVM\\\\analysis']);
    await refused('...only once, and no reopen after', ST.requestAction(w.id, 'analyze', {}), 'not_allowed');
    await refused('...no reopen after analyze', ST.requestAction(w.id, 'reopen', { text: 'x' }), 'not_allowed');
    eq('...the timeline tells the whole story', ST.requestEvents(w.id).map(function (e) { return e.kind === 'status' ? e.to : e.kind; }),
       ['created', 'submitted', 'accepted', 'on_hold', 'accepted', 'on_hold', 'accepted', 'panels_received', 'clarification', 'panels_received', 'in_progress', 'completed', 'accepted', 'panels_received', 'in_progress', 'completed', 'analyzed']);

    group('RBAC: who sees what (Q32 superseded 2026-09-28)');
    var vEng = { id: 've', roles: ['engineer'], active: true };
    var vQe = { id: 'vq', roles: ['quality'], active: true };
    var vAn = { id: 'va', roles: ['analyst'], active: true };
    var vOp = { id: 'vo', roles: ['operator'], active: true };
    var vMgr = { id: 'vm', roles: ['manager'], active: true };
    var vTool = { id: 'vt', primary_operator_id: 'vq' };
    var ownSub = { status: 'submitted', requester_id: 've' };
    var alien = { status: 'in_progress', requester_id: 'zx' };
    var doneC = { status: 'completed', requester_id: 'zx' };
    var doneA = { status: 'analyzed', requester_id: 'zx' };
    eq('engineer: own only', [D.canSeeRequest(vEng, ownSub), D.canSeeRequest(vEng, alien), D.canSeeRequest(vEng, doneC)], [true, false, false]);
    eq('analyst: completed + analyzed across tools, nothing open', [D.canSeeRequest(vAn, doneC), D.canSeeRequest(vAn, doneA), D.canSeeRequest(vAn, alien)], [true, true, false]);
    eq('quality engineer: own tools queue', [D.canSeeRequest(vQe, alien, vTool), D.canSeeRequest(vQe, alien, { id: 'other' })], [true, false]);
    eq('operator and manager read all; drafts stay private', [D.canSeeRequest(vOp, alien), D.canSeeRequest(vMgr, alien), D.canSeeRequest(vOp, { status: 'draft', requester_id: 'zx' })], [true, true, false]);
    (function visibilityMatrix() {
      // M4: role x status. Oracle from the documented rules, not from canSeeRequest.
      var tool = { id: 'vt', primary_operator_id: 'vq1', backup_operator_id: 'vq2' };
      var U = {
        reqEng: { id: 've', roles: ['engineer'] }, otherEng: { id: 'vx', roles: ['engineer'] },
        qe1: { id: 'vq1', roles: ['quality'] }, qeX: { id: 'vq9', roles: ['quality'] },
        analyst: { id: 'va', roles: ['analyst'] }, operator: { id: 'vo', roles: ['operator'] },
        manager: { id: 'vm', roles: ['manager'] }, admin: { id: 'vad', roles: ['admin'] } };
      function want(name, st) {
        var open = ['submitted', 'accepted', 'panels_received', 'in_progress', 'clarification', 'on_hold'].indexOf(st) !== -1;
        var done = st === 'completed' || st === 'analyzed';
        if (name === 'reqEng') return st !== 'draft' ? true : true; // own: everything incl. own draft
        if (name === 'otherEng') return false;                      // another's: nothing (draft or not)
        if (name === 'qe1') return st === 'draft' ? false : true;   // own tool: all but drafts
        if (name === 'qeX') return false;                           // other tool: nothing
        if (name === 'analyst') return done;                        // done only
        if (name === 'operator' || name === 'manager' || name === 'admin') return st === 'draft' ? false : true;
        return false;
      }
      var bad = [];
      Object.keys(U).forEach(function (name) {
        D.REQUEST_STATUSES.forEach(function (st) {
          var r = { id: 'vr', status: st, requester_id: name === 'reqEng' ? 've' : 'vzzz' };
          if (name === 'otherEng') r.requester_id = 've';
          if (!!D.canSeeRequest(U[name], r, tool) !== want(name, st)) bad.push(name + '/' + st);
        });
      });
      eq('M4: role x status visibility matrix (80 combos)', [bad.length, bad.slice(0, 3)], [0, []]);
      eq('M4: requester vs other engineer isolation', [D.canSeeRequest(U.reqEng, { status: 'submitted', requester_id: 've' }),
        D.canSeeRequest(U.otherEng, { status: 'submitted', requester_id: 've' })], [true, false]);
    })();
    (function emailMatrix() {
      var req = { id: 'e', email: 'e@x.at' }, pri = { id: 'q1', email: 'q1@x.at' }, bak = { id: 'q2' };
      var ana = [{ id: 'a', email: 'a@x.at' }, { id: 'q1', email: 'q1@x.at' }];
      function ids(list) { return list.map(function (u) { return u.id; }); }
      eq('emails: submit goes to both QEs (backup without email skipped)', ids(D.emailRecipients(null, 'submit', { requester: req, primary: pri, backup: bak, analysts: [], meId: 'e' })), ['q1']);
      eq('...the actor is never mailed to themselves', ids(D.emailRecipients(null, 'complete', { requester: req, primary: pri, backup: bak, analysts: [], meId: 'e' })), []);
      eq('...analysts resolved, duplicates once', ids(D.emailRecipients({ submit: ['analysts', 'primary'], clarify: [], answer: [], complete: [], analyze: [], cancel: [] }, 'submit',
        { requester: req, primary: pri, backup: bak, analysts: ana, meId: 'x' })), ['a', 'q1']);
      eq('...cancel ticks everyone, actor excluded', ids(D.emailRecipients(null, 'cancel', { requester: req, primary: pri, backup: { id: 'q2', email: 'q2@x.at' }, analysts: [], meId: 'q1' })), ['e', 'q2']);
      ok('...bad table and unknown who flagged, missing events fine', D.validateEmailMatrix(null).length === 1 &&
        D.validateEmailMatrix({ submit: ['owner'] }).length === 1 && D.validateEmailMatrix({}).length === 0);
      eq('...normalize fills a missing event from the default', D.normalizeEmailMatrix({}).submit, D.DEFAULT_EMAIL_MATRIX.submit);
    eq('results folder: confirmed wins, else proposed from the tool root (Q30), else none',
      [D.resultsFolder({ results_path: 'Z:\\\\x', submitted_ts: '2026-09-01T00:00:00Z', request_no: 'F-1' }, { results_root: 'Z:\\\\root' }),
       D.resultsFolder({ submitted_ts: '2026-09-01T00:00:00Z', request_no: 'F-1' }, { results_root: 'Z:\\\\root\\\\' }),
       D.resultsFolder({ submitted_ts: '2026-09-01T00:00:00Z', request_no: 'F-1' }, {})],
      [{ path: 'Z:\\\\x', confirmed: true }, { path: 'Z:\\\\root\\2026\\F-1\\', confirmed: false }, { path: null, confirmed: false }]);
    })();
    eq('M4: settings/template/comment/management gates', [
      D.canUseSettings({ roles: ['admin'] }), D.canUseSettings({ roles: ['engineer'] }),
      D.canSaveTemplate({ id: 'a', roles: ['engineer'] }, { requester_id: 'a' }), D.canSaveTemplate({ id: 'a', roles: ['engineer'] }, { requester_id: 'b' }),
      D.canSaveTemplate({ id: 'a', roles: ['admin'] }, { requester_id: 'b' }), D.canSaveTemplate({ id: 'a', roles: ['quality'] }, { requester_id: 'a' }),
      D.canEditComment({ id: 'a', roles: ['engineer'] }, { kind: 'comment', user_id: 'a' }), D.canEditComment({ id: 'a', roles: ['engineer'] }, { kind: 'comment', user_id: 'b' }),
      D.canEditComment({ id: 'a', roles: ['engineer'] }, { kind: 'status', user_id: 'a' }),
      D.canSeeManagement({ roles: ['manager'] }), D.canSeeManagement({ roles: ['admin'] }), D.canSeeManagement({ roles: ['engineer'] }),
      D.defaultAnalyticsTab({ roles: ['quality'] }, true), D.defaultAnalyticsTab({ roles: ['admin', 'manager'] }, true),
      D.defaultAnalyticsTab({ roles: ['manager', 'quality'] }, false), D.defaultAnalyticsTab({ roles: ['engineer'] }, false),
      D.adminNames([{ name: 'A', roles: ['admin'] }, { name: 'B', roles: ['engineer'] }])
    ], [true, false, true, false, true, false, true, false, false, true, false, false, 'work', 'lab', 'lab', 'mine', ['A']]);
    (function matrix() {
      // M1: action x status x persona, oracle rebuilt from the TRANSITIONS table (not from canAct).
      var T = { id: 'vt', primary_operator_id: 'vq1', backup_operator_id: 'vq2' };
      var P = [
        ['reqEngineer', { id: 've', roles: ['engineer'] }], ['otherEngineer', { id: 'vx', roles: ['engineer'] }],
        ['primaryQE', { id: 'vq1', roles: ['quality'] }], ['backupQE', { id: 'vq2', roles: ['quality'] }],
        ['otherQE', { id: 'vq9', roles: ['quality'] }], ['analyst', { id: 'va', roles: ['analyst'] }],
        ['operator', { id: 'vo', roles: ['operator'] }], ['manager', { id: 'vm', roles: ['manager'] }],
        ['admin', { id: 'vad', roles: ['admin'] }]];
      function whoOk(who, u) {
        if (who === 'measurer') return u.roles[0] === 'admin' || (u.roles[0] === 'quality' && (u.id === 'vq1' || u.id === 'vq2'));
        if (who === 'analyst') return u.roles[0] === 'analyst' || u.roles[0] === 'admin';
        return u.id === 've' || u.roles[0] === 'admin';
      }
      var bad = [];
      D.REQUEST_STATUSES.forEach(function (st) {
        var r = { id: 'wr', status: st, requester_id: 've' };
        Object.keys(D.TRANSITIONS).forEach(function (a) {
          var t = D.TRANSITIONS[a];
          P.forEach(function (pu) {
            var want = t.from.indexOf(st) !== -1 && whoOk(t.who, pu[1]);
            if (!!D.canAct(pu[1], a, r, T) !== want) bad.push(a + '/' + st + '/' + pu[0]);
          });
        });
      });
      eq('M1: action x status x persona matrix, no gaps (900 combos)', [bad.length, bad.slice(0, 3)], [0, []]);
      // M1: graph proof - every status reachable from draft; only analyzed + cancelled are terminal.
      var edges = {};
      D.REQUEST_STATUSES.forEach(function (s) { edges[s] = []; });
      Object.keys(D.TRANSITIONS).forEach(function (a) {
        var t = D.TRANSITIONS[a];
        var tos = t.back ? ['submitted', 'accepted', 'panels_received', 'in_progress'] : [t.to];
        t.from.forEach(function (f) { tos.forEach(function (x) { if (edges[f].indexOf(x) === -1) edges[f].push(x); }); });
      });
      edges.draft.push('submitted');
      ['submitted', 'accepted', 'panels_received', 'in_progress', 'clarification', 'on_hold'].forEach(function (s) { edges[s].push('cancelled'); });
      var seen = { draft: 1 }, q = ['draft'];
      while (q.length) edges[q.pop()].forEach(function (x) { if (!seen[x]) { seen[x] = 1; q.push(x); } });
      var terminal = D.REQUEST_STATUSES.filter(function (s) { return !edges[s].length; });
      eq('M1: all statuses reachable, only analyzed + cancelled terminal', [Object.keys(seen).sort(), terminal], [D.REQUEST_STATUSES.slice().sort(), ['analyzed', 'cancelled']]);
      // actionsFor lists exactly the allowed actions, in table order.
      var af = D.actionsFor(P[2][1], { id: 'wr', status: 'submitted', requester_id: 've' }, T);
      eq('M1: actionsFor order follows the table', af, ['accept', 'hold', 'clarify']);
    })();
    eq('rights: engineer and operator do no workflow, analyst only analyzes', [
      D.canAct(vEng, 'accept', ownSub, vTool), D.canAct(vOp, 'start', alien, vTool),
      D.canAct(vAn, 'analyze', doneC, vTool), D.canAct(vQe, 'analyze', doneC, vTool)], [false, false, true, false]);
    eq('...quality engineers run the whole lab path', [
      D.canAct(vQe, 'accept', { status: 'submitted', requester_id: 'zx' }, vTool),
      D.canAct(vQe, 'receive', { status: 'accepted', requester_id: 'zx' }, vTool),
      D.canAct(vQe, 'start', { status: 'panels_received', requester_id: 'zx' }, vTool),
      D.canAct(vQe, 'complete', { status: 'in_progress', requester_id: 'zx' }, vTool)], [true, true, true, true]);

    group('Store: magazine slots, a new lot, put back, scrapped (F-3, F-5, M3-13)');
    ST.setCurrentUser(adminL);
    var mq = await ST.submitRequest({ fields: { project_id: prjL.id, tool_id: qvm.id, type_id: qType.id, new_lot: { lot_number: '40002' }, buildup_id: buL.id,
      panels: ['3252', '3253'], layers: ['1fco', '2F'], priority_id: normal.id, magazine_id: m1.id, slots: [4, 3], destination_id: dstMe.id, purpose: 'pads' } });
    var newLot = ST.data().lots.filter(function (x) { return x.lot_number === '40002'; })[0];
    eq('a lot typed in the form is registered at submit, owned by the requester', [!!newLot, mq.lot_id === (newLot || {}).id, (newLot || {}).owner_id, mq.new_lot], [true, true, adminL, null]);
      var mqNew = await ST.submitRequest({ fields: { tool_id: qvm.id, new_type: { name: 'Pad check' }, new_project: { code: 'NPRJ' }, new_part_number: { code: 'PN-NPRJ-01' },
         new_lot: { lot_number: '40009' }, new_buildup: { code: 'BU-09' }, panels: ['3321'], new_priority: { name: 'Planning' },
         new_location: { name: 'Rack D1' }, new_magazine: { code: 'M70999' }, new_destination: { name: 'New dock' }, purpose: 'new values test' } });
      var prjNew = ST.data().projects.filter(function (x) { return x.code === 'NPRJ'; })[0];
      var buNew = ST.data().buildups.filter(function (x) { return x.code === 'BU-09'; })[0];
      var magNew = ST.data().magazines.filter(function (x) { return x.code === 'M70999'; })[0];
      var typeNew = ST.data().measurement_types.filter(function (x) { return x.tool_id === qvm.id && x.name === 'Pad check'; })[0];
      var prioNew = ST.data().priorities.filter(function (x) { return x.name === 'Planning'; })[0];
      var locNew = ST.data().panel_locations.filter(function (x) { return x.name === 'Rack D1'; })[0];
      var dstNew = ST.data().destinations.filter(function (x) { return x.name === 'New dock'; })[0];
      eq('typed new project/build-up/magazine/type/priority/location/destination are created on submit and linked on the request',
          [!!prjNew && mqNew.project_id === prjNew.id, !!buNew && mqNew.buildup_id === buNew.id, !!magNew && mqNew.magazine_id === magNew.id,
            !!typeNew && mqNew.type_id === typeNew.id, !!prioNew && mqNew.priority_id === prioNew.id,
            !!locNew && mqNew.panel_location_id === locNew.id, !!dstNew && mqNew.destination_id === dstNew.id],
          [true, true, true, true, true, true, true]);
    eq('...magazine slots sorted, layers tidied, no note needed', [mq.slots, mq.layers, D.placeText(mq, (function () { var o = {}; o[m1.id] = m1; return o; })())], [[3, 4], ['1FCO', '2F'], m1.code + ' · slots 3, 4']);
    await refused('a slot taken by another open request is refused', ST.submitRequest({ fields: { project_id: prjL.id, tool_id: qvm.id, type_id: qType.id, lot_id: mq.lot_id, panel_count: 1,
      priority_id: normal.id, magazine_id: m1.id, slots: [4], destination_id: dstMe.id, purpose: 'x' } }), 'invalid');
    await refused('a layer not of the build-up is refused', ST.submitRequest({ fields: { project_id: prjL.id, tool_id: qvm.id, type_id: qType.id, lot_id: mq.lot_id, panel_count: 1,
      priority_id: normal.id, panel_location_id: locB2.id, layers: ['9F'], destination_id: dstMe.id, purpose: 'x' } }), 'invalid');
    ST.setCurrentUser(qeL.id);
    await ST.requestAction(mq.id, 'accept', {});
    await ST.requestAction(mq.id, 'receive', { received_where: 'QVM shelf 1' });
    await ST.requestAction(mq.id, 'start', {});
    var m3 = ST.list('magazines')[2];
    await ST.requestAction(mq.id, 'complete', { results_path: 'Z:\\r', panels_outcome: 'returned', put_back: { magazine_id: m3.id, slots: [1, 2] } });
    eq('Complete: put back into another magazine\'s slots', ST.byId('requests', mq.id).put_back, { magazine_id: m3.id, slots: [1, 2] });
    ST.setCurrentUser(adminL);
    var fq = await ST.submitRequest({ fields: { project_id: prjL.id, tool_id: tool('FIB').id, type_id: typesOf('FIB')[0].id, lot_id: mq.lot_id, panels: ['3252'], priority_id: normal.id,
      panel_location_id: locB2.id, destructive_ok: true, destination_id: dstScrap.id, purpose: 'x' } });
    await ST.requestAction(fq.id, 'accept', {});
    await ST.requestAction(fq.id, 'receive', { received_where: 'FIB cabinet' });
    await ST.requestAction(fq.id, 'start', {});
    await ST.requestAction(fq.id, 'complete', { results_path: 'Z:\\r', panels_outcome: 'scrapped' });
    eq('FIB: the panel is marked scrapped on the lot', ST.byId('lots', mq.lot_id).scrapped, ['3252']);
    await refused('...and cannot be requested again', ST.submitRequest({ fields: { project_id: prjL.id, tool_id: qvm.id, type_id: qType.id, lot_id: mq.lot_id, panels: ['3252'], priority_id: normal.id,
      panel_location_id: locB2.id, destination_id: dstMe.id, purpose: 'x' } }), 'invalid');

    group('Store: edit a submitted request, take it (M3-5, M3-7)');
    var e1 = await ST.submitRequest({ fields: { project_id: prjL.id, tool_id: qvm.id, type_id: qType.id, lot_id: lx.id, panels: [1, 2, 3, 4], priority_id: normal.id,
      panel_location_id: locB2.id, destination_id: dstMe.id, purpose: 'pads' } });
    await refused('an edit needs a reason', ST.editRequest({ id: e1.id, fields: { panels: [1, 2, 3, 4, 5, 6] } }), 'invalid');
    await refused('...the tool cannot change', ST.editRequest({ id: e1.id, fields: { tool_id: tool('FIB').id }, reason: 'x' }), 'invalid');
    e1 = await ST.editRequest({ id: e1.id, fields: { panels: [1, 2, 3, 4, 5, 6], panel_location_id: locC1.id }, reason: 'two more panels' });
    eq('an edit: saved, and the timeline says what changed and why', [e1.panels.length, ST.requestEvents(e1.id).slice(-1)[0].text],
       [6, 'panels 1, 2, 3, 4 -> 1, 2, 3, 4, 5, 6; panels are now Rack B2 -> Rack C1; how many panels 4 -> 6. Reason: two more panels']);
    e1 = await ST.editRequest({ id: e1.id, fields: { lot_id: null, new_lot: { lot_number: '40003' } }, reason: 'wrong lot' });
    var lot3 = ST.data().lots.filter(function (x) { return x.lot_number === '40003'; })[0];
    eq('an edit to a lot typed new registers it too, and the timeline names it', [!!lot3 && e1.lot_id === lot3.id, e1.new_lot, /lot .* -> 40003/.test(ST.requestEvents(e1.id).slice(-1)[0].text)], [true, null, true]);
    ST.setCurrentUser(tomL.id);
    await refused('someone else cannot edit it', ST.editRequest({ id: e1.id, fields: { layers: ['2F'] }, reason: 'x' }), 'not_allowed');
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
    eq('...one line per tool, saying what it lacks: primary, backup, results folder, capacity', [countOf(todo, 'tool_setup'), todo.filter(function (x) { return x.code === 'tool_setup'; })[0].missing,
       /^HRM: no primary quality engineer, no backup quality engineer, no results folder, no capacity \(requests per lab day\)$/.test(todo.filter(function (x) { return x.code === 'tool_setup'; })[0].text)], [5, ['primary', 'backup', 'results_root', 'capacity'], true]);
    ok('...in first-day order: tools first, then the calendar, then reference data (sample magazines too), a second admin last',
       codes(todo).indexOf('tool_setup') < codes(todo).indexOf('calendar_unconfirmed') && codes(todo).indexOf('calendar_unconfirmed') < codes(todo).indexOf('sample_types') &&
       codes(todo).indexOf('sample_magazines') !== -1 && codes(todo)[codes(todo).length - 1] === 'one_admin');
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
    hs2.tools.forEach(function (t) { t.primary_operator_id = 'u2'; t.backup_operator_id = 'u3'; t.results_root = '\\\\srv\\lab\\' + t.code; t.capacity_per_day = 4; });
    hs2.holidays.push({ id: 'hx', date: '2026-12-24', name: 'Christmas Eve', kind: 'closing' });
    hs2.part_numbers.push({ id: 'pnx', code: 'PN-1', project_id: hs2.projects[0].id, active: true });
    hs2.process_steps.push({ id: 'psx', name: 'After desmear', sort: 1, active: true });
    hs2.lot_fields.forEach(function (f) { delete f.sample; });
    hs2.magazines.forEach(function (m) { delete m.sample; });
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
    hb.part_numbers.push({ id: 'pny', code: 'PN-2', project_id: 'gone', active: true });
    hb.projects[0].active = false;
    hi = D.healthIssues(hb, { today_ymd: '2026-09-24' });
    ok('a part number linked to a missing project is a problem', countOf(hi, 'pn_bad_project') === 1);
    ok('an active part number whose projects are all hidden is a warning', countOf(hi, 'pn_hidden_projects') === 1);
    hb.requests = [{ id: 'rx', request_no: 'FIB-260924-01', project_id: 'gone', buildup_id: 'gone', part_number_id: 'gone' }];
    hi = D.healthIssues(hb, { today_ymd: '2026-09-24' });
    eq('a request pointing at a missing project, build-up, part number: three problems', [countOf(hi, 'req_bad_project'), countOf(hi, 'req_bad_buildup'), countOf(hi, 'req_bad_pn')], [1, 1, 1]);
    ok('...linking to the request', hi.filter(function (x) { return x.code === 'req_bad_project'; })[0].tab === 'request');
    hb.magazines = [];
    ok('no magazines is a warning (the form offers none)', countOf(D.healthIssues(hb, { today_ymd: '2026-09-24' }), 'no_magazines') === 1);
    var hk = JSON.parse(JSON.stringify(hs2));
    hk.requests = [{ id: 'rOld', request_no: 'FIB-260910-01', status: 'on_hold' }, { id: 'rNew', request_no: 'FIB-260923-01', status: 'on_hold' },
                   { id: 'rRun', request_no: 'FIB-260910-02', status: 'in_progress' }];
    hk.request_events = [{ request_id: 'rOld', kind: 'status', to: 'on_hold', ts: '2026-09-10T08:00:00.000Z' },
                         { request_id: 'rNew', kind: 'status', to: 'on_hold', ts: '2026-09-23T08:00:00.000Z' },
                         { request_id: 'rRun', kind: 'status', to: 'on_hold', ts: '2026-09-01T08:00:00.000Z' },
                         { request_id: 'rRun', kind: 'status', to: 'in_progress', ts: '2026-09-20T08:00:00.000Z' }];
    var hs = D.healthIssues(hk, { today_ymd: '2026-09-24' });
    eq('on hold 10 lab days: a Health warning linking the request (Step 6b)', [countOf(hs, 'stuck_on_hold'),
       hs.filter(function (x) { return x.code === 'stuck_on_hold'; })[0].tab,
       /10 lab days/.test(hs.filter(function (x) { return x.code === 'stuck_on_hold'; })[0].text)], [1, 'request', true]);
    ok('...a 1-lab-day hold and a resumed request stay quiet', hs.every(function (x) { return x.code !== 'stuck_on_hold' || /260910-01/.test(x.text); }));
    hb.audit_log = new Array(20001); hb.request_events = new Array(50001);
    var hl = D.healthIssues(hb, { today_ymd: '2026-09-24' });
    ok('a huge history warns, pointing at the Audit log', countOf(hl, 'audit_large') === 1 && countOf(hl, 'events_large') === 1 &&
       hl.filter(function (x) { return x.code === 'audit_large'; })[0].tab === 'audit');
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
    ST.beginUndoGroup();
    await ST.saveEntry('projects', { fields: { code: 'G1' } });
    await ST.saveEntry('projects', { fields: { code: 'G2' } });
    ST.endUndoGroup('2 projects added (M2)');
    eq('...a group undoes as one unit', [ST.undoInfo().label, await ST.undoLast().then(function () { return ST.list('projects').filter(function (p) { return p.code === 'G1' || p.code === 'G2'; }).length; })], ['2 projects added (M2)', 0]);

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

    a = await adminStore();
    await ST.saveEntry('projects', { fields: { code: 'FIRST', name: 'First' } });
    var peak = fileOf(a).revision;
    var second = fileOf(a);
    second.revision = peak + 1; second.saved_by = 'u-second-user'; second.saved_ts = '2026-09-24T09:00:00.000Z';
    a.files[cfg.data_file] = JSON.stringify(second);   // another PC saved after us
    await refused('the second user saving over the first stops', ST.saveEntry('projects', { fields: { code: 'OVERWRITE' } }), 'revision_conflict');
    await ST.load();   // Reload takes the new file (the refused edit is dropped, like the banner says)
    await ST.saveEntry('projects', { fields: { code: 'ON-TOP' } });
    eq('...and the second user then saves cleanly on top', [fileOf(a).revision, fileOf(a).projects.some(function (p) { return p.code === 'ON-TOP'; })],
      [peak + 2, true]);

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

    group('Store: the office theme (Settings > Look)');
    a = await adminStore();
    eq('no office theme at first (the app default)', ST.getSetting('default_theme'), null);
    await ST.setDefaultTheme('slate', 'calmer for the lab');
    eq('an admin sets one, audited', [ST.getSetting('default_theme'), ST.data().audit_log.slice(-1)[0].new_value], ['slate', 'slate']);
    await refused('...not a theme that does not exist', ST.setDefaultTheme('neon-pink', 'x'), 'invalid');
    await refused('...the same again is "nothing changed"', ST.setDefaultTheme('slate', 'x'), 'no_change');
    eq('retired keys still resolve to the five (signal/frost retired in Step 1)',
       [window.MRT.themes.byKey('carbon-g100').key, window.MRT.themes.byKey('carbon-white').key, window.MRT.themes.byKey('primer-hc').key,
        window.MRT.themes.byKey('hc').key, window.MRT.themes.byKey('catppuccin-mocha').key, window.MRT.themes.byKey('gruvbox-light').key,
        window.MRT.themes.byKey('minimal').key, window.MRT.themes.byKey('signal').key, window.MRT.themes.byKey('frost').key,
        window.MRT.themes.DEFAULT],
       ['dark-teal', 'pure-white', 'dark-teal', 'dark-teal', 'dark-teal', 'pure-white', 'pure-white', 'dark-teal', 'pure-white', 'ats']);
    var themeCss = window.MRT.themes.css();
    ok('the default theme CSS comes first, so a picked theme paints over it (its :root rule ties [data-theme] on specificity)',
      themeCss.indexOf(':root,') === 0 && themeCss.indexOf(':root,', 1) === -1);
    await ST.saveEntry('users', { fields: { name: 'Tia Theme', roles: ['engineer'] } });
    ST.setCurrentUser(ST.data().users.filter(function (u) { return u.name === 'Tia Theme'; })[0].id);
    await refused('...only admins', ST.setDefaultTheme(null, 'x'), 'not_admin');

    group('Store: fill with demo data, start empty (Settings > Data, for testing)');
    a = await freshStore();
    await ST.createFirstAdmin({ name: 'Pat Admin', windows_id: 'padmin', pin: '2468' });
    await ST.saveLot({ fields: { lot_number: '55555' } });
    var pinHash = ST.getSetting('admin_pin_hash'), revB = ST.status().revision;
    ST.setCurrentUser(ST.data().users[0].id);
    await refused('a reason is required', ST.replaceData('demo', ''));
    var rd = await ST.replaceData('demo', 'testing');
    var meD = ST.currentUser();
    eq('demo: the big file is in; I am its Prince (admin), with my Windows ID; my PIN still works',
       [ST.data().requests.length > 60, meD.id, meD.windows_id, D.hasRole(meD, 'admin'), ST.getSetting('admin_pin_hash') === pinHash, await ST.verifyPin('2468')],
       [true, 'usr_demo_prince', 'padmin', true, true, true]);
    ok('...the old file is kept first, and listed as restorable', !!a.files[rd.safety_copy] && JSON.parse(a.files[rd.safety_copy]).lots.some(function (l) { return l.lot_number === '55555'; }) &&
       (await ST.listBackups()).some(function (b) { return b.kind === 'before demo data'; }));
    ok('...saved, the revision goes on (other PCs see it), the swap audited', fileOf(a).requests.length > 60 && ST.status().revision > revB &&
       ST.data().audit_log.slice(-1)[0].action === 'replace');
    ok('...no one else has my Windows ID', ST.data().users.filter(function (u) { return u.windows_id === 'padmin'; }).length === 1);
    var re = await ST.replaceData('empty', 'clean start');
    eq('empty: no lots, requests or other people - only me, admin; the lists of a first run; my PIN',
       [ST.data().lots.length, ST.data().requests.length, ST.data().users.map(function (u) { return u.id; }), D.hasRole(ST.currentUser(), 'admin'), ST.list('tools').length, ST.list('magazines').length, await ST.verifyPin('2468')],
       [0, 0, ['usr_demo_prince'], true, 5, 20, true]);
    ST.setCurrentUser('usr_demo_prince');
    await ST.restoreBackup(rd.safety_copy.split('/').pop(), 'back to the real file');
    ok('the copy made before the demo can be restored - with its own audit log, not the demo\'s', ST.data().lots.some(function (l) { return l.lot_number === '55555'; }) &&
       !ST.data().audit_log.some(function (x) { return x.new_value === 'demo data'; }) && ST.data().audit_log.slice(-1)[0].action === 'restore');
    ok('...and the empty one was kept too', !!a.files[re.safety_copy]);
    ST.setCurrentUser(ST.data().users[0].id);
    await ST.saveEntry('users', { fields: { name: 'Eve Eng', roles: ['engineer'] } });
    ST.setCurrentUser(ST.data().users.filter(function (u) { return u.name === 'Eve Eng'; })[0].id);
    await refused('only admins replace the data', ST.replaceData('empty', 'x'), 'not_admin');

    /* =============== store: file checks and upgrades =============== */
    /* =============== the big demo data file (js/demo-data.js) =============== */
    group('Demo data: every record keeps the app\'s rules');
    var DD = window.MRT.demoData({ now_ts: Date.parse('2026-09-24T09:30:00Z') });
    var badUsers = DD.users.filter(function (u) { return D.validateEntry('users', u, DD).length; });
    eq('18 people, all valid: admin, 7 engineers, 2 operators, 3 QEs, 1 analyst, 2 managers + a new one + a switched-off one', [DD.users.length, badUsers.length], [18, 0]);
    var roleCount = function (r) { return DD.users.filter(function (u) { return u.active !== false && D.hasRole(u, r); }).length; };
    ok('...roles present: engineers, operators, quality engineers, managers, admin', roleCount('engineer') >= 7 && roleCount('operator') === 2 && roleCount('quality') >= 5 && roleCount('manager') === 2 && roleCount('admin') === 1);
    var badLots = DD.lots.map(function (l) { return [l.lot_number, D.validateEntry('lots', l, DD)]; }).filter(function (x) { return x[1].length; });
    eq('every lot is valid (lot fields, panel count optional)', badLots.slice(0, 3), []);
    ok('...split lots, and lots without a panel count', DD.lots.some(function (l) { return /\.01$/.test(l.lot_number); }) && DD.lots.some(function (l) { return l.panel_count === null; }));
    ok('...requests with Hirata IDs, with just a count, with layers, in magazine slots, with a note',
       DD.requests.some(function (r) { return r.panels.length && r.panels.every(D.isPanelId); }) && DD.requests.some(function (r) { return !r.panels.length && r.panel_count; }) &&
       DD.requests.some(function (r) { return r.layers.length; }) && DD.requests.filter(function (r) { return D.isOpen(r) && r.slots.length; }).length >= 20 &&
       DD.requests.some(function (r) { return !r.magazine_id && r.panel_location_id; }));
    var badReq = DD.requests.map(function (r) { return [r.request_no || r.id, D.requestProblems(r, DD, { submit: r.status !== 'draft', allowScrapped: true })]; }).filter(function (x) { return x[1].length; });
    eq('every request keeps the request rules', badReq.slice(0, 3), []);
    var nos = DD.requests.map(function (r) { return r.request_no; }).filter(Boolean);
    eq('request IDs are unique, in the TOOL-YYMMDD-NN form', [nos.length === Object.keys(nos.reduce(function (m, n) { m[n] = 1; return m; }, {})).length, nos.every(function (n) { return /^[A-Z]+-\d{6}-\d{2}$/.test(n); })], [true, true]);
    var lastTo = {};
    DD.request_events.forEach(function (e) { if (e.kind === 'status' || e.kind === 'created') lastTo[e.request_id] = e.to; });
    eq('each request\'s last status on the timeline is its status', DD.requests.filter(function (r) { return lastTo[r.id] !== r.status; }).map(function (r) { return r.request_no; }).slice(0, 3), []);
    var states = ['draft', 'submitted', 'accepted', 'in_progress', 'on_hold', 'clarification', 'completed', 'cancelled'];
    var missing = [];
    DD.tools.forEach(function (t) { states.forEach(function (st) { if (!DD.requests.some(function (r) { return r.tool_id === t.id && r.status === st; })) missing.push(t.code + ' ' + st); }); });
    eq('every tool has requests in every state', missing, []);
    var nowD = Date.parse('2026-09-24T09:30:00Z'), calD = { days: [1, 2, 3, 4, 5], start: '07:00', end: '18:00' };
    ok('...late ones, closed ones, reopened ones, an open Line stop per tool, an old draft',
       DD.requests.filter(function (r) { return D.isLate(r, nowD, calD); }).length >= 5 && DD.requests.some(function (r) { return D.isClosed(r, nowD); }) &&
       DD.requests.some(function (r) { return r.reopened; }) && DD.tools.every(function (t) { return DD.requests.some(function (r) { return r.tool_id === t.id && D.isOpen(r) && r.priority_id === DD.priorities[0].id; }); }) &&
       DD.requests.some(function (r) { return D.isOldDraft(r, nowD); }));
    ok('...comments with @mentions, edits, copies, away routing, take-overs, FIB panels scrapped',
       DD.request_events.some(function (e) { return e.kind === 'comment' && e.mentions && e.mentions.length; }) && DD.request_events.some(function (e) { return e.kind === 'edit'; }) &&
       DD.requests.some(function (r) { return r.duplicated_from; }) && DD.request_events.some(function (e) { return e.kind === 'assign' && /is away/.test(e.text || ''); }) &&
       DD.request_events.some(function (e) { return e.kind === 'assign' && !e.text; }) && DD.lots.some(function (l) { return l.scrapped.length; }));
    eq('Health: no problems in the demo file (warnings allowed)', D.healthIssues(DD, { today_ymd: '2026-09-24' }).filter(function (x) { return x.severity === 'problem'; }).map(function (x) { return x.text; }), []);
    var ad = window.MRT.adapters.storageMemory({});
    ad.files[cfg.data_file] = JSON.stringify(DD);
    ST.init(ad);
    await ST.load();
    ST.setCurrentUser('usr_demo_mia');
    var mine = ST.visibleRequests(function (r) { return D.isOpen(r) && D.isToolMeasurer(ST.currentUser(), ST.byId('tools', r.tool_id)); });
    ok('the store loads it; Mia (FIB backup while Olga is away) has open requests to work', mine.length >= 10);
    var sub1 = mine.filter(function (r) { return r.status === 'submitted'; })[0];
    await ST.requestAction(sub1.id, 'accept', {});
    eq('...and can accept one', ST.byId('requests', sub1.id).status, 'accepted');
    ok('...the bell has something for Olga, for Erik, for Prince', ['usr_demo_olga', 'usr_demo_erik', 'usr_demo_prince'].every(function (uid) { return D.notificationsFor(ST.byId('users', uid), ST.data(), {}).length > 0; }));

    group('Excel bridge: export (Requests + meta)');
    var XB = window.MRT.excelBridge;
    var sheets = XB.masterSheets();
    eq('Requests + six reference sheets + meta', sheets.map(function (s) { return s.name; }),
      ['Requests', 'Tools', 'Measurement types', 'Priorities', 'Projects', 'Build-ups', 'BKM', 'meta']);
    var toolsSheet = sheets.filter(function (s) { return s.name === 'Tools'; })[0].rows;
    var prioSheet = sheets.filter(function (s) { return s.name === 'Priorities'; })[0].rows;
    eq('reference sheets: headers plus one row per entry, no internal ids',
      [toolsSheet[0].slice(0, 3), toolsSheet.length - 1, prioSheet[0],
       toolsSheet.slice(1).concat(prioSheet.slice(1)).every(function (r) { return r.every(function (c) { return !/[a-z]+_[0-9a-z_]+/i.test(String(c)); }); })],
      [['Code', 'Name', 'Status'], ST.list('tools', { all: true }).length, ['Name', 'Code', 'Level'], true]);
    var reqRows = sheets[0].rows, metaSheet = sheets.filter(function (s) { return s.name === 'meta'; })[0].rows;
    eq('Requests header starts with the readable Request ID', reqRows[0].slice(0, 3), ['Request ID', 'Status', 'Tool']);
    var liveNos = ST.data().requests.map(function (r) { return r.request_no || '(draft)'; });
    var gotIds = reqRows.slice(1).map(function (r) { return r[0]; });
    eq('one row per request, keyed by request number - no random internal id leaks into the key column',
      [reqRows.length - 1, gotIds.every(function (x) { return liveNos.indexOf(x) >= 0; }), gotIds.some(function (x) { return /_/.test(x); })],
      [liveNos.length, true, false]);
    function metaVal(k) { var row = metaSheet.filter(function (r) { return r[0] === k; })[0]; return row && row[1]; }
    eq('meta carries the live revision, schema and request count',
      [metaVal('Revision'), metaVal('Schema'), metaVal('Requests')], [ST.status().revision, ST.data().schema_version, ST.data().requests.length]);
    ST.setCurrentUser(ST.list('users', { all: true }).filter(function (u) { return (u.roles || []).indexOf('admin') !== -1; })[0].id);
    var xLoc = await ST.saveEntry('panel_locations', { fields: { name: 'Export shelf' } });
    var xr = window.MRT.exporter.requestRows([{ request_no: 'X-1', status: 'submitted', submitted_ts: '2026-09-24T10:00:00Z', panels: ['1'],
      panel_location_id: xLoc.id, destination_id: ST.list('destinations')[0].id, magazine_id: ST.list('magazines')[0].id, slots: [3, 4] }]);
    eq('panel logistics columns sit together, magazine as text', [xr[0].slice(11, 14), xr[1][11], xr[1][12], xr[1][13], typeof xr[1][13]],
      [['Panels now', 'Panels after', 'Magazine'], 'Export shelf', ST.list('destinations')[0].name, ST.list('magazines')[0].code + ' 3, 4', 'string']);

    group('Excel bridge: import (validate + all-or-nothing save)');
    var X = window.XLSX;
    ok('SheetJS is loaded for the round-trip', !!X);
    function masterBytes(edit) {
      var sh = XB.masterSheets();
      edit(sh[0].rows, sh[1].rows);
      var wb = X.utils.book_new();
      sh.forEach(function (s) { X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(s.rows), s.name); });
      return X.write(wb, { type: 'array' });
    }
    function colIdx(rows, name) { return rows[0].indexOf(name); }
    var untouched = XB.validateSheets(XB.workbookOf(masterBytes(function () {})), ST.data());
    eq('an untouched export validates clean: no items, errors only on draft rows (made in the app, not Excel)',
      [untouched.fatal, untouched.stale, untouched.rows.length, untouched.rows.some(function (r) { return r.item; }),
       untouched.rows.filter(function (r) { return r.errors.length; }).every(function (r) { return r.key === '(draft)'; })],
      [null, false, ST.data().requests.length, false, true]);
    var prioList = ST.list('priorities', { all: true });
    var target = ST.data().requests.filter(function (r) { return r.request_no; })[0];
    var origPrio = target.priority_id;
    var otherPrio = prioList.filter(function (p) { return p.id !== origPrio && !p.needs_reason; })[0].name;
    var edited = XB.validateSheets(XB.workbookOf(masterBytes(function (req) {
      var i = req.slice(1).filter(function (r) { return String(r[0]) === target.request_no; })[0];
      i[colIdx(req, 'Priority')] = otherPrio; i[colIdx(req, 'Needed by')] = '2026-10-01';
    })), ST.data());
    var goodItems = edited.rows.filter(function (r) { return r.item; }).map(function (r) { return r.item; });
    eq('two edited cells become one clean item', [edited.rows.some(function (r) { return r.errors.length && r.key !== '(draft)'; }), goodItems.length,
      goodItems[0] && goodItems[0].fields.priority_id === ST.list('priorities', { all: true }).filter(function (p) { return p.name === otherPrio; })[0].id,
      goodItems[0] && goodItems[0].fields.needed_by], [false, 1, true, '2026-10-01']);
    var statusHit = XB.validateSheets(XB.workbookOf(masterBytes(function (req) {
      req[1][colIdx(req, 'Status')] = 'Almost done';
    })), ST.data());
    ok('a touched Status cell is a row error, never a move', statusHit.rows.some(function (r) { return r.errors.join(' ').indexOf('Status moves happen in the app') >= 0; }));
    var noName = XB.validateSheets(XB.workbookOf(masterBytes(function (req) {
      req[1][colIdx(req, 'Priority')] = 'Turbo hyper urgent';
    })), ST.data());
    ok('an unknown priority name is a row error', noName.rows.some(function (r) { return r.errors.join(' ').indexOf('Unknown priority') >= 0; }));
    var rev0 = ST.status().revision, audit0 = ST.data().audit_log.length;
    ST.setCurrentUser('usr_demo_prince');
    await refused('a stale file never saves', ST.importRequests(goodItems, rev0 - 1, 'stale test'), 'stale_import');
    var badMix = goodItems.concat([{ request_no: target.request_no, fields: { priority_id: 'prio_nope' } }]);
    await refused('one bad item stops the whole file', ST.importRequests(badMix, rev0, 'mixed test'), 'invalid');
    eq('...and nothing was written by the refused saves', [ST.byId('requests', target.id).priority_id === origPrio, ST.status().revision, ST.data().audit_log.length],
      [true, rev0, audit0]);
    ST.setCurrentUser('usr_demo_mia');
    await refused('only admins import', ST.importRequests(goodItems, rev0, 'not admin'), 'not_admin');
    ST.setCurrentUser('usr_demo_prince');
    var done = await ST.importRequests(goodItems, rev0, 'excel import test');
    eq('the import saves, bumps the revision, keeps a safety copy, audits',
      [done.n, ST.byId('requests', target.id).priority_id !== origPrio, ST.status().revision,
       Object.keys(ad.files).some(function (k) { return k.indexOf('before-import_') >= 0; }), ST.data().audit_log.length > audit0],
      [1, true, rev0 + 1, true, true]);

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
    a = await adminStore();
    await ST.saveEntry('projects', { fields: { code: 'KEEP' } });
    var keptRev = fileOf(a).revision;
    var prevText = a.files['mrt_data.prev.json'];
    ok('every save parks the replaced file as the previous copy',
      !!prevText && JSON.parse(prevText).revision === keptRev - 1 &&
      JSON.parse(prevText).projects.every(function (p) { return p.code !== 'KEEP'; }));
    a.files[cfg.data_file] = '{torn mid-save';
    await ST.load();
    eq('a torn live file recovers the previous copy (flagged)',
      [ST.status().recoveredFromPrev, ST.status().revision, ST.list('projects').some(function (p) { return p.code === 'KEEP'; })],
      [true, keptRev - 1, false]);
    await ST.saveEntry('projects', { fields: { code: 'AFTER' } });
    eq('...and saving again continues cleanly', fileOf(a).revision, keptRev);
    a.files[cfg.data_file] = '{torn'; a.files['mrt_data.prev.json'] = '{also torn';
    await refused('two torn copies still report damage', ST.load(), 'bad_json');
    a = window.MRT.adapters.storageMemory({});
    a.files[cfg.data_file] = '{ not json';
    ST.init(a);
    eq('...and left as it was', a.files[cfg.data_file], '{ not json');

    // Schema 1 -> 2 adds part numbers (M1-13); 2 -> 3 process steps and "destructive" (M2-7, M2-11).
    var v1 = ST._pure.seedData(); v1.schema_version = 1; delete v1.part_numbers; delete v1.process_steps; delete v1.lots; delete v1.lot_fields;
    delete v1.requests; delete v1.request_events; delete v1.hold_reasons; delete v1.magazines;
    v1.tools.forEach(function (t) { delete t.destructive; });
    P.migrate(v1);
    eq('schema 1 -> 3: part numbers and process steps start empty', [v1.part_numbers, v1.process_steps], [[], []]);
    eq('...FIB becomes destructive, the others not', v1.tools.map(function (t) { return t.code + ':' + t.destructive; }), ['HRM:false', 'AOI:false', 'PRF:false', 'QVM:false', 'FIB:true']);
    eq('...and the file says schema 14, with no lots or requests', [v1.schema_version, v1.lots, v1.requests, v1.request_events], [14, [], [], []]);
    eq('...schema 7 -> 8 brings the magazines', v1.magazines.length, 20);
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
    var copies = Object.keys(a.files).filter(function (k) { return k.indexOf(cfg.backup_prefix + 'before-upgrade_v0-to-v14_') !== -1; });
    eq('an upgrade first keeps a copy of the old file', copies.length, 1);
    eq('...the copy is the old file, unchanged', JSON.parse(a.files[copies[0]]).schema_version, 0);
    eq('...the data is upgraded in memory', [ST.data().schema_version, ST.data().upgraded], [14, true]);
    // 8 -> 9 (form v2): panel numbers become IDs; the lot's old loading map gives the request its slots
    var v8 = ST._pure.seedData(); v8.schema_version = 8;
    v8.lots = [{ id: 'L', lot_number: '1', project_id: v8.projects[0].id, buildup_id: v8.buildups[0].id, panel_count: 4, owner_id: 'u', scrapped: [2],
                 magazine_ids: ['M'], load: [{ panel: 1, magazine_id: 'M', slot: 7 }, { panel: 3, magazine_id: 'M', slot: 9 }] }];
    v8.requests = [{ id: 'R', lot_id: 'L', panels: [1, 3], magazine_id: 'M', rack: 5, layer: '2f' }, { id: 'S', lot_id: 'L', panels: [4], layer: 'L7' }];
    P.migrate(v8);
    eq('schema 8 -> 9 (-> 14): IDs, count, slots from the old map, layer to layers (or a location entry), lots lose the map',
       [v8.requests[0].panels, v8.requests[0].panel_count, v8.requests[0].slots, v8.requests[0].layers, v8.requests[1].layers,
        v8.panel_locations.filter(function (x) { return x.id === v8.requests[1].panel_location_id; })[0].name, v8.lots[0].scrapped, 'load' in v8.lots[0]],
       [['1', '3'], 2, [7, 9], ['2F'], [], 'layer L7', ['2'], false]);
    eq('...and the status says so until the next save', ST.status().upgradedFrom, 0);
    // 9 -> 10 (F-6): project, part number and build-up move from the lot to its requests
    var v9 = ST._pure.seedData(); v9.schema_version = 9;
    v9.lots = [{ id: 'L', lot_number: '1', project_id: 'P', part_number_id: 'N', buildup_id: 'B', panel_count: 4, owner_id: 'u', scrapped: [] }];
    v9.requests = [{ id: 'R', lot_id: 'L' }, { id: 'S', lot_id: null, new_lot: { lot_number: '2', project_id: 'P2', buildup_id: null } }];
    P.migrate(v9);
    eq('schema 9 -> 10 (-> 14): requests take project, part number, build-up from their lot (or the new lot); lots first drop them, then regain empty links (F-7)',
       [v9.requests[0].project_id, v9.requests[0].part_number_id, v9.requests[0].buildup_id, v9.requests[1].project_id, v9.requests[1].new_lot, v9.lots[0].project_id, 'buildup_id' in v9.lots[0]],
       ['P', 'N', 'B', 'P2', { lot_number: '2' }, null, false]);
    var v9b = ST._pure.seedData(); v9b.schema_version = 9; v9b.magazines = [];
    P.migrate(v9b);
    eq('...a file whose magazine list stayed empty gets the 20 sample magazines', v9b.magazines.length, 20);
  }

  /* ---------------- PRF data: js/prf.js (a port of PRF_Insight.py) ---------------- */
  function prfTests() {
    var P = window.MRT.prf;

    group('PRF data - numbers');
    eq('toFloat reads numbers like python float()', [P.toFloat('1.5'), P.toFloat(' -2e3 '), P.toFloat('.5'), P.toFloat('1_0')], [1.5, -2000, 0.5, 10]);
    eq('toFloat: empty and text are NOT numbers (JS Number("") would be 0)', [P.toFloat(''), P.toFloat('abc'), P.toFloat('1,5'), P.toFloat('--1')], [null, null, null, null]);
    ok('toFloat: nan / inf like python', isNaN(P.toFloat('nan')) && P.toFloat('-inf') === -Infinity && P.toFloat('Infinity') === Infinity);
    eq('round to 6 digits', [P.round(1.23456789, 6), P.round(-1.23456789, 6), P.round(2, 6)], [1.234568, -1.234568, 2]);
    ok('round keeps NaN', isNaN(P.round(NaN, 6)));
    eq('mean', P.mean([1, 2, 3, 4]), 2.5);
    eq('std is the SAMPLE std (pandas ddof=1)', P.round(P.std([2, 4, 4, 4, 5, 5, 7, 9], 1), 6), 2.13809);
    eq('std with ddof=0 is the population std', P.std([2, 4, 4, 4, 5, 5, 7, 9], 0), 2);
    ok('std of one value with ddof=1 is NaN (the script then shows a blank)', isNaN(P.std([5], 1)));
    eq('median odd / even', [P.median([3, 1, 2]), P.median([4, 1, 3, 2])], [2, 2.5]);
    ok('mean / min / max of nothing are NaN', isNaN(P.mean([])) && isNaN(P.minOf([])) && isNaN(P.maxOf([])));

    group('PRF data - path: build-up, panel, side, lot');
    eq('buNumber reads BU-01 / BU01 / bu 1 / BU_2', ['BU-01', 'BU01', 'bu 1', 'BU_2', 'XBU3', 'Bu-12 done'].map(P.buNumber), [1, 1, 1, 2, null, 12]);
    eq('buLabel', [P.buLabel(1), P.buLabel(12), P.buLabel(null)], ['BU-01', 'BU-12', '']);
    eq('panel and side from folder names', P.panelSideFromPath(['Post DSM', 'Panel 28', 'Front', 'log']), { panels: [28], sides: ['Front'] });
    eq('...also "Panel 1_Front - done"', P.panelSideFromPath(['Panel 1_Front - done']), { panels: [1], sides: ['Front'] });
    eq('...a folder called "Backup" is not Back', P.panelSideFromPath(['Panel 3', 'Backup']).sides, []);
    eq('...both sides in a path are both reported', P.panelSideFromPath(['Panel 3', 'Front', 'Back']).sides, ['Front', 'Back']);
    eq('lot = the 5-digit folder; part before, project before that', P.lotFromPath(['L', 'ProjX', 'PN-7', '12345', 'BU-01']), { part: 'PN-7', project: 'ProjX', lot: '12345' });
    eq('...a lot like 12345.1 counts', P.lotFromPath(['PN', '12345.1']).lot, '12345.1');
    eq('...no 5-digit folder: the folder above PRF / BU is the lot', P.lotFromPath(['Proj', 'PN', 'LOTX', 'PRF', 'Panel 1']), { part: 'PN', project: 'Proj', lot: 'LOTX' });
    eq('...two different lots in one path = several', P.lotFromPath(['12345', 'x', '54321']), 'several');
    eq('...none = null', P.lotFromPath(['a', 'b']), null);

    group('PRF data - find log folders (index)');
    var idx = P.indexLogs('Root', [
      { rel: ['Proj', 'PN1', '12345', 'BU-01', 'Panel 1', 'Front'], ref: 'r1' },
      { rel: ['Proj', 'PN1', '12345', 'BU-01', 'Panel 1', 'Back'], ref: 'r2' },
      { rel: ['Proj', 'PN1', '12345', 'BU-01', 'Panel 2'], ref: 'r3' },
      { rel: ['Proj', 'PN1', '12345', 'BU-01', 'Panel 1', 'Front', 'again'], ref: 'r4' },
      { rel: ['Proj', 'PN1', '12345', 'BU-01', 'Panel 1', 'BU-02', 'Back'], ref: 'r5' },
      { rel: ['Proj', 'PN1', '12345', 'Panel 3', 'Front'], ref: 'r6' },
      { rel: ['Proj', 'PN1', '12345', 'BU-01', 'Panel 4', 'Front', 'Panel 5'], ref: 'r7' }
    ]);
    eq('lots found with project and part', idx.lots, { '12345': { project: 'Proj', part: 'PN1' } });
    eq('a side folder is keyed by lot, build-up, panel, side', Object.keys(idx.index).sort(), ['12345|1|1|Back', '12345|1|1|Front', '12345||3|Front'].sort());
    eq('two log folders for one panel + side are kept together', idx.index['12345|1|1|Front'].refs, ['r1', 'r4']);
    eq('problems: no Front/Back, two build-ups, several panels', idx.problems, [
      'No Front/Back in path, skipped: r3', 'Several buildups in path, skipped: r5', 'Several panel number in path, skipped: r7']);
    var rootIsPanel = P.indexLogs('Panel 9 Front', [{ rel: [], ref: 'x' }]);
    eq('root = a panel/side folder: panel and side come from the root name', Object.keys(rootIsPanel.index), ['||9|Front']);
    eq('siteNumber = last number in the file name', [P.siteNumber('C:/a/Site_12.txt'), P.siteNumber('a3_b45.csv'), P.siteNumber('none.txt')], [12, 45, -1]);

    group('PRF data - reading and sorting files');
    eq('lines: CRLF, trailing empty line dropped', P.textToLines('a\r\nb\r\n'), ['a', 'b']);
    eq('lines: a blank line inside stays, bad-byte characters are dropped', P.textToLines('a\n\nb\uFFFD'), ['a', '', 'b']);
    eq('lines: empty text has no lines (py "".splitlines())', P.textToLines(''), []);
    eq('split: tab if there is a tab, else comma, cells trimmed', [P.splitLine('a\t b ,c'), P.splitLine('a, b ,c')], [['a', 'b ,c'], ['a', 'b', 'c']]);
    var rough = ['Some header', 'Ra\tRq\tRz\tRpv\tRku', '0.1\t0.2\t0.5\t0.6\t3', '0.2\t0.3\t0.7\t0.8\t3.1', 'Min\t0.1'];
    var via = ['Diamond Area 0.5', 'Index,CenterX,CenterY,MajorAxis,MinorAxis,AvgHeight,MinHeight,MaxHeight', '1,0,0,50,48,-30,-31,-29'];
    eq('classify: roughness', P.classify(rough), 'roughness');
    eq('classify: via (Diamond Area, or Index + CenterX)', [P.classify(via), P.classify(['Index\tCenterX'])], ['via', 'via']);
    eq('classify: unknown', P.classify(['hello', 'world']), 'unknown');
    eq('classify: via is checked before roughness', P.classify(rough.concat(['Diamond Area'])), 'via');
    eq('parseRoughness stops at the Min / Max / Mean row', P.parseRoughness(rough).rows.length, 2);
    eq('parseRoughness reads the columns by name', P.parseRoughness(rough).rows[1], { Ra: 0.2, Rq: 0.3, Rz: 0.7, Rpv: 0.8, Rku: 3.1 });
    eq('parseRoughness drops lines that are not numbers', P.parseRoughness(['Ra,Rq', '1,2', 'x,3', '4,5']).rows.length, 2);
    var bad = 'none'; try { P.parseRoughness(['x']); } catch (e) { bad = e.message; }
    eq('parseRoughness without a header says so', bad, 'roughness header not found');
    eq('parseVia reads a circle row', P.parseVia(via).rows, [{ Index: 1, CenterX: 0, CenterY: 0, MajorAxis: 50, MinorAxis: 48, AvgHeight: -30, MinHeight: -31, MaxHeight: -29 }]);
    eq('parseVia ignores rows whose first cell is not an integer', P.parseVia(['Index,CenterX', 'x,1', '2,5']).rows.length, 1);
    var bad2 = 'none'; try { P.need({ a: 1 }, 'Rpv'); } catch (e) { bad2 = e.message; }
    eq('a missing column is an error named like the script ("\'Rpv\'")', bad2, "'Rpv'");

    group('PRF data - unit labels');
    eq('unitType: number = Unit, letter first = Coupon', [P.unitType(3), P.unitType('C1'), P.unitType('-2')], ['Unit', 'Coupon', 'Unit']);
    eq('asLabel keeps numbers as numbers, coupons as text', [P.asLabel('7'), P.asLabel('C3'), P.asLabel(' 12 ')], [7, 'C3', 12]);
    eq('units: the typed ORDER is kept, never sorted', P.parseUnits('5,4,2,3,6').units, [5, 4, 2, 3, 6]);
    eq('units: commas, spaces or both; numbers above 9 are one unit', P.parseUnits('12  3, 10;C1').units, [12, 3, 10, 'C1']);
    eq('units: anything else is reported, not guessed', P.parseUnits('1, x, 2-3').bad, ['x', '2-3']);
    eq('sequence text 3x3, 2x4, C1x5', P.parseSequence('3x3, 2x4, C1x5').items, [['3', 3], ['2', 4], ['C1', 5]]);
    eq('sequence list form', P.parseSequence([[3, 3], ['C1', 5]]).items, [['3', 3], ['C1', 5]]);
    eq('sequence: X and * work too', P.parseSequence('3X2;4*1').items, [['3', 2], ['4', 1]]);
    eq('sequence: empty = none, no message', [P.parseSequence('').items, P.parseSequence('').error], [null, '']);
    ok('sequence: a bad part ignores the whole sequence and says why', P.parseSequence('3x3, abc').items === null && /Bad via sequence part "abc"/.test(P.parseSequence('3x3, abc').error));
    ok('sequence: count 0 is refused', /1 or more/.test(P.parseSequence('3x0').error));
    eq('sequenceText', P.sequenceText([['3', 3], ['C1', 5]]), '3x3, C1x5');

    group('PRF data - how vias are split over units');
    eq('even split: 6 files / 3 units = 2 each, in unit order (never sorted)', P.viaLabels(6, [5, 4, 2], null, null).labels, [[5, 1], [5, 2], [4, 1], [4, 2], [2, 1], [2, 2]]);
    eq('...the message says so', P.viaLabels(6, [5, 4, 2], null, null).messages, [{ level: 'INFO', text: '6 via files / 3 units = 2 vias per unit' }]);
    eq('even split that does not fit = error, nothing labelled', [P.viaLabels(7, [1, 2], null, null).labels, P.viaLabels(7, [1, 2], null, null).messages[0].level], [[], 'ERROR']);
    eq('...no units at all = error', P.viaLabels(4, [], null, null).labels, []);
    eq('fixed per unit / coupon', P.viaLabels(5, [], null, P.countsFromDefaults([1, 'C1'], 3, 2)).labels, [[1, 1], [1, 2], [1, 3], ['C1', 1], ['C1', 2]]);
    eq('countsFromDefaults: coupon count defaults to the unit count; none without units', [P.countsFromDefaults([1, 'C1'], 4, 0), P.countsFromDefaults([], 4, 0), P.countsFromDefaults([1], 0, 0)], [[[1, 4], ['C1', 4]], null, null]);
    eq('sequence wins over the other splits', P.viaLabels(3, [1], [['3', 2], ['C1', 1]], P.countsFromDefaults([1], 9, 0)).labels, [['3', 1], ['3', 2], ['C1', 1]]);
    eq('sequence that does not fit = error', P.viaLabels(5, [1], [['3', 2]], null).messages[0].level, 'ERROR');
    eq('counts that do not fit = error', P.viaLabels(5, [1], null, [[1, 2]]).messages[0].level, 'ERROR');
    eq('compress 1,2,3,7,9,10', P.compress([10, 1, 2, 3, 7, 9]), '1-3, 7, 9-10');
  }
  prfTests();

  function prfTests2() {
    var P = window.MRT.prf;
    var meta = { Lot_Number: '12345', Buildup: 'BU01', Panel: 3 };
    var cfg = { flagFactor: 1.5, filterOutliers: false, nrSigma: 2 };

    group('PRF data - roughness row');
    var r1 = ['Ra\tRq\tRz\tRpv\tRku', '1\t2\t5\t6\t3', '1.2\t2.2\t30\t7\t3.1'];
    var out = P.roughnessRow(r1, 5, 'Next to Via', 12, meta, 'Front', cfg);
    eq('values are converted um -> nm (x1000) and rounded to 6', [out.row.Ra_Mean_nm, out.row.Rz_Mean_nm], [1100, 17500]);
    eq('Unit/Type/Position/Site copied onto the row', [out.row.Unit, out.row.Type, out.row.Measurement_Position, out.row.Site], [5, 'Unit', 'Next to Via', 12]);
    ok('a line whose Rz is > flag_factor x median Rz flags that line and the row', out.row.Flag === 'CHECK' && out.row.Lines_Flagged === 1 && /spiky line/.test(out.flagMessage));
    eq('Std uses the SAMPLE std (ddof=1), not population', P.round(out.row.Ra_Std_nm, 4), P.round(P.std([1000, 1200], 1), 4));
    eq('raw rows: one per line, nm, 6 decimals', out.raw.length, 2);
    eq('a coupon label is typed as Coupon', P.roughnessRow(r1, 'C1', 'p', 1, meta, 'Front', cfg).row.Type, 'Coupon');

    var r2 = ['Ra\tRq\tRz\tRpv\tRku', '1\t2\t5\t6\t3', '1.1\t2.1\t5.1\t6\t3', '1000\t200\t5\t6\t3'];
    var outF = P.roughnessRow(r2, 1, 'p', 1, meta, 'Front', { flagFactor: 1.5, filterOutliers: true, nrSigma: 1 });
    eq('outlier filter drops a line whose Ra OR Rz is off (both columns must pass, ddof=0)', outF.row.Lines_Used, 1);
    var r3 = ['Ra\tRq\tRz\tRpv\tRku', '1\t2\t5\t6\t3'];
    eq('filter_outliers does nothing with 2 or fewer lines (py "len(df) > 2")', P.roughnessRow(r3, 1, 'p', 1, meta, 'Front', { flagFactor: 1.5, filterOutliers: true, nrSigma: 2 }).row.Lines_Used, 1);

    group('PRF data - processRoughness (file count vs units x positions)');
    var files = [{ lines: r1, site: 1 }, { lines: r1, site: 2 }];
    var pr = P.processRoughness(files, [5], ['A', 'B'], cfg, meta, 'Front');
    eq('2 files = 1 unit x 2 positions: both labelled, unit-major then position', [pr.rows[0].Measurement_Position, pr.rows[1].Measurement_Position], ['A', 'B']);
    var prBad = P.processRoughness(files, [5, 7], ['A', 'B'], cfg, meta, 'Front');
    eq('a count mismatch is an ERROR and nothing is produced', [prBad.rows, prBad.messages[0].level], [[], 'ERROR']);
    var prNoUnits = P.processRoughness(files, [], ['A'], cfg, meta, 'Front');
    eq('no units set is also an ERROR', prNoUnits.messages[0].level, 'ERROR');

    group('PRF data - via circle geometry');
    eq('circle_values: D = (L+S)/2, roundness % (py 584)', P.circleValues({ MajorAxis: 100, MinorAxis: 96 }), { L: 100, S: 96, D: 98, R: (1 - 4 / 98) * 100 });
    var viaLines = ['Index,CenterX,CenterY,MajorAxis,MinorAxis,AvgHeight,MinHeight,MaxHeight',
      '1,0,0,100,96,0,0,0', '2,0,0,60,56,-50,-51,-49'];
    var vr = P.viaRow(viaLines, 2, 1, 7, meta, 'Front');
    eq('top = largest D, bottom = smallest D (sorted by D desc)', [vr.row.Top_Diameter_um, vr.row.Bottom_Diameter_um], [98, 58]);
    eq('depth = |bottom AvgHeight|; taper = topD - bottomD', [vr.row.Average_Via_Depth_um, vr.row.Taper_um], [50, 40]);
    eq('aspect ratio = depth / topD; bottom/top % = bottomD/topD x100', [vr.row.Aspect_Ratio, vr.row.Bottom_Top_Ratio_pct], [P.round(50 / 98, 6), P.round(58 / 98 * 100, 6)]);
    eq('taper angle = atan(taper/(2*depth)) in degrees; wall = 90 - angle', [vr.row.Taper_Angle_deg, vr.row.Wall_Angle_deg], [P.round(Math.atan(40 / 100) * 180 / Math.PI, 6), P.round(90 - Math.atan(40 / 100) * 180 / Math.PI, 6)]);
    ok('exactly 2 circles: no flag', vr.row.Flag === '' && !vr.flagMessage);
    var vr3 = P.viaRow(viaLines.concat(['3,0,0,80,76,-20,-21,-19']), 2, 1, 7, meta, 'Front');
    eq('3 circles: flagged "3 circles", middle one is Extra', [vr3.row.Flag, vr3.raw[1].Circle_Type], ['3 circles', 'Extra']);
    var vr1 = P.viaRow([viaLines[0], viaLines[1]], 2, 1, 7, meta, 'Front');
    ok('only 1 circle: top set, bottom (and depth/taper/...) stay blank, flagged', isNaN(vr1.row.Average_Via_Depth_um) && vr1.row.Flag === '1 circles' && P.isNum(vr1.row.Top_Diameter_um));
    var viaZero = ['Index,CenterX,CenterY,MajorAxis,MinorAxis,AvgHeight,MinHeight,MaxHeight', '1,0,0,100,96,0,0,0', '2,0,0,60,56,0,-1,1'];
    ok('depth = 0: aspect ratio / angles stay blank (py "if depth > 0")', isNaN(P.viaRow(viaZero, 2, 1, 7, meta, 'Front').row.Aspect_Ratio));

    group('PRF data - processVia');
    var vfiles = [{ lines: viaLines, site: 1 }, { lines: viaLines, site: 2 }];
    var pv = P.processVia(vfiles, [5, 6], meta, 'Front', null, null);
    eq('even split over 2 units, 1 via file each', [pv.rows[0].Unit, pv.rows[1].Unit], [5, 6]);
    var pvBad = P.processVia(vfiles, [5, 6, 7], meta, 'Front', null, null);
    eq('a split that does not fit produces nothing', pvBad.rows, []);

    group('PRF data - check_sites');
    eq('duplicates reported', P.checkSites([[1, 'R'], [1, 'R'], [2, 'V']], [1], [1], 1, null).filter(function (m) { return /Duplicate/.test(m.text); }).length, 1);
    eq('missing sites (gap 1..highest)', P.checkSites([[1, 'R'], [3, 'V']], [1], [1], 1, null).filter(function (m) { return /Missing sites: 2/.test(m.text); }).length, 1);
    eq('complete run says so', P.checkSites([[1, 'R'], [2, 'V']], [1], [1], 1, null).filter(function (m) { return /Sites complete: 1-2/.test(m.text); }).length, 1);
    eq('roughness sites not consecutive within a group of n_pos', P.checkSites([[1, 'R'], [5, 'R']], [1], [1], 2, null).filter(function (m) { return /not consecutive/.test(m.text); }).length, 1);
    eq('block pattern VVVVVRR x2 units: both blocks match = OK', P.checkSites([[1, 'V'], [2, 'V'], [3, 'R'], [4, 'V'], [5, 'V'], [6, 'R']], [1, 2], [1, 2], 1, null).filter(function (m) { return /Site pattern OK/.test(m.text); }).length, 1);
    eq('block pattern differs between units = warning', P.checkSites([[1, 'V'], [2, 'R'], [3, 'V'], [4, 'V']], [1, 2], [1, 2], 1, null).filter(function (m) { return /differs from block 1/.test(m.text); }).length, 1);
    eq('a via sequence skips the block check (uneven by design)', P.checkSites([[1, 'V'], [2, 'V'], [3, 'V']], [1], [1], 1, [['1', 3]]).filter(function (m) { return /skipped \(via sequence/.test(m.text); }).length, 1);

    group('PRF data - summary and spec limits');
    eq('pretty names: unit suffix -> unit text, special name for Bottom/Top', [P.pretty('Top_Diameter_um'), P.pretty('Bottom_Top_Ratio_pct'), P.pretty('Aspect_Ratio')], ['Top Diameter (µm)', 'Bottom/Top Ratio (%)', 'Aspect Ratio']);
    var gl = P.getLimits({ via_depth: [10, 20], bad_key: [1, 2], aspect_ratio: [null, null] });
    eq('getLimits keeps only known, non-empty keys; unknown keys warn', [gl.limits, gl.messages.length], [{ Average_Via_Depth_um: [10, 20] }, 1]);
    var t2b = [
      { Lot_Number: 'L', Buildup: 'B', Panel: 1, Side: 'Front', Average_Via_Depth_um: 10, Top_Diameter_um: 50, Bottom_Diameter_um: 40, Top_Roundness_pct: 99, Bottom_Roundness_pct: 98, Aspect_Ratio: 0.2, Bottom_Top_Ratio_pct: 80, Taper_um: 10, Taper_Angle_deg: 5, Wall_Angle_deg: 85 },
      { Lot_Number: 'L', Buildup: 'B', Panel: 1, Side: 'Front', Average_Via_Depth_um: 30, Top_Diameter_um: 50, Bottom_Diameter_um: 40, Top_Roundness_pct: 99, Bottom_Roundness_pct: 98, Aspect_Ratio: 0.2, Bottom_Top_Ratio_pct: 80, Taper_um: 10, Taper_Angle_deg: 5, Wall_Angle_deg: 85 },
      { Lot_Number: 'L', Buildup: 'B', Panel: 1, Side: 'Back', Average_Via_Depth_um: 50, Top_Diameter_um: 50, Bottom_Diameter_um: 40, Top_Roundness_pct: 99, Bottom_Roundness_pct: 98, Aspect_Ratio: 0.2, Bottom_Top_Ratio_pct: 80, Taper_um: 10, Taper_Angle_deg: 5, Wall_Angle_deg: 85 }
    ];
    var sum = P.buildSummary(t2b, [], { Average_Via_Depth_um: [5, 45] });
    var frontDepth = sum.filter(function (r) { return r.Side === 'Front' && r.Parameter === 'Average Via Depth (µm)'; })[0];
    eq('N / Mean / Std (sample) / Min / Max per group', [frontDepth.N, frontDepth.Mean, P.round(frontDepth.Std, 6), frontDepth.Min, frontDepth.Max], [2, 20, P.round(P.std([10, 30], 1), 6), 10, 30]);
    eq('spec limits -> PASS/FAIL (min>=lo and max<=hi)', [frontDepth.Result, sum.filter(function (r) { return r.Side === 'Back' && r.Parameter === 'Average Via Depth (µm)'; })[0].Result], ['PASS', 'FAIL']);
    eq('a parameter with no limit has no Result', sum.filter(function (r) { return r.Parameter === 'Top Diameter (µm)'; })[0].Result, '');
    var cmp = P.buildComparison(sum);
    var depthCmp = cmp.filter(function (r) { return r.Parameter === 'Average Via Depth (µm)'; })[0];
    eq('Front vs Back: difference and % of Front', [depthCmp['Front Mean'], depthCmp['Back Mean'], depthCmp['Difference (Back - Front)'], depthCmp['Difference (%)']], [20, 50, 30, 150]);
    eq('one side only -> no comparison rows', P.buildComparison(sum.filter(function (r) { return r.Side === 'Front'; })), []);
  }
  prfTests2();

  function prfTests3() {
    var P = window.MRT.prf;

    group('PRF data - output file name and status');
    eq('cleanToken strips anything but letters/digits/-/.', P.cleanToken('PN 7/A!'), 'PN7A.'.replace('.', '') + '');
    eq('cleanToken keeps - and .', P.cleanToken('PN-7.1'), 'PN-7.1');
    eq('joinShort: up to 3 items joined, more than 3 -> first-last', [P.joinShort(['a', 'b']), P.joinShort(['a', 'b', 'c', 'd'])], ['a-b', 'a-d']);
    eq('joinShort: empty list', P.joinShort([]), '');
    eq('buText: one build-up, several, none', [P.buText(['BU01']), P.buText(['BU02', 'BU01']), P.buText([])], ['BU01', 'BU01-02', '']);
    var base = { parts: ['PN1'], lots: ['12345'], bus: ['BU01'], process: 'Post DSM', panels: [3, 1, 2], flagged: false, dateYmd: '2026-10-01' };
    eq('output name: parts/lots/bu/process/panels/date, process "-" removed; 4 or fewer panels listed as-is, not compressed', P.buildOutputName(base), 'PRF_PN1_12345_BU01_PostDSM_P1-2-3_2026-10-01');
    eq('output name: more than 4 panels -> first-last', P.buildOutputName(Object.assign({}, base, { panels: [1, 2, 3, 4, 5] })), 'PRF_PN1_12345_BU01_PostDSM_P1-5_2026-10-01');
    eq('output name: a flagged run gets __INSPECT__', P.buildOutputName(Object.assign({}, base, { flagged: true })), 'PRF_PN1_12345_BU01_PostDSM_P1-2-3_2026-10-01__INSPECT__');
    eq('output name: nothing known falls back to Part/Lot/BU (an empty process leaves a double underscore, as in the script)', P.buildOutputName({ parts: [], lots: [], bus: [], process: '', panels: [1], flagged: false, dateYmd: '2026-10-01' }), 'PRF_Part_Lot_BU__P1_2026-10-01');
    eq('status: OK with nothing wrong', P.runStatus({}), 'OK');
    eq('status: every reason joined with " | ", in order', P.runStatus({ errors: true, flagged: true, specFail: true, siteWarn: true }),
      'ERRORS - see Log | Flagged rows | Out of spec | Site warnings - see Log');
    eq('status: only one reason', P.runStatus({ flagged: true }), 'Flagged rows');
  }
  prfTests3();

  function prfTests4() {
    var P = window.MRT.prf;

    group('PRF data - a pasted full path for the picked folder');
    eq('splitPath: backslashes, trailing slash, Explorer quotes', P.splitPath('"L:\\ale\\130 - measurement results\\BU-01\\"'), ['L:', 'ale', '130 - measurement results', 'BU-01']);
    eq('splitPath: forward slashes and empty text', [P.splitPath('a/b'), P.splitPath('')], [['a', 'b'], []]);
    ok('pathEndsWith: the last folder must be the picked one (any case)', P.pathEndsWith(['L:', 'x', 'BU-01'], 'bu-01') && !P.pathEndsWith(['L:', 'x'], 'BU-01'));
    var real = P.splitPath('L:\\ale\\ics_htb3_rnd\\130 - measurement results\\02_Engineering lots\\Chiplet4Future\\FHR0020\\19197\\BU-01');
    var logs = [{ rel: ['Panel 3', 'Front'], ref: 'Panel 3/Front/log' }];
    var noPath = P.indexLogs('BU-01', logs);
    eq('picked BU-01 without a path: no lot, no project, no part (only BU)', [noPath.lots, Object.keys(noPath.index)], [{}, ['|1|3|Front']]);
    var withPath = P.indexLogs('BU-01', logs, real);
    eq('...with the pasted path: lot 19197, part FHR0020, project Chiplet4Future (the script reads the same)', withPath.lots, { '19197': { project: 'Chiplet4Future', part: 'FHR0020' } });
    eq('...and the side is keyed under that lot and BU01', Object.keys(withPath.index), ['19197|1|3|Front']);
  }
  prfTests4();

  T.done = run().catch(function (e) {
    T.failed++;
    (current || (group('Runner'), current)).rows.push({ ok: false, name: 'the test run crashed', detail: String(e && e.stack || e) });
  });
})();
