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
    var op = { id: 'u2', roles: ['operator'], active: true };
    var adm = { id: 'u3', roles: ['admin'], active: true };
    var fib = { primary_operator_id: 'u2', backup_operator_id: null };
    ok('roles are ticks', D.hasRole({ roles: ['engineer', 'operator'] }, 'operator'));
    ok('a deactivated user has no roles', !D.hasRole({ roles: ['admin'], active: false }, 'admin'));
    ok('the tool\'s operator may set its status', D.canSetToolStatus(op, fib));
    ok('another operator may not', !D.canSetToolStatus({ id: 'u9', roles: ['operator'] }, fib));
    ok('an engineer may not', !D.canSetToolStatus(eng, fib));
    ok('an admin may', D.canSetToolStatus(adm, fib));

    /* =============== domain: list rules =============== */
    group('List rules (Settings)');
    var base = { users: [{ id: 'u1', name: 'A', windows_id: 'aa', roles: ['admin'], active: true, email: 'a@corp.com' }],
                 tools: [{ id: 't1', code: 'FIB' }, { id: 't2', code: 'QVM' }],
                 measurement_types: [{ id: 'm1', tool_id: 't1', name: 'Via cross-section' }],
                 tool_fields: [], bkms: [], projects: [{ id: 'p1', code: 'C4F' }], buildups: [],
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
    ok('a holiday date is listed once', probs('holidays', { date: '2026-12-25', name: 'x', kind: 'closing' }).length === 1);
    ok('a Windows ID belongs to one person', probs('users', { name: 'B', roles: ['engineer'], windows_id: 'aa' }).length === 1);
    ok('an email belongs to one person', probs('users', { name: 'B', roles: ['engineer'], email: 'A@corp.com' }).length === 1);
    ok('unknown roles are refused', probs('users', { name: 'B', roles: ['boss'] }).length === 1);
    eq('priorities: one active default', D.validatePriorities([{ is_default: true, active: true }, { active: true }]), []);
    ok('two defaults are refused', D.validatePriorities([{ is_default: true }, { is_default: true }]).length === 1);
    ok('a hidden default is refused', D.validatePriorities([{ is_default: true, active: false }, { active: true }]).length === 1);

    /* =============== store: first run and seed =============== */
    group('Store: first run and seed data (M1-5, M1-8, M1-9)');
    var seed = ST._pure.seedData(Date.parse('2026-09-24T10:00:00Z'));
    eq('schema 1, revision 0', [seed.schema_version, seed.revision], [1, 0]);
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

    /* =============== store: tool status =============== */
    group('Store: tool status (Q27)');
    a = await adminStore();
    var op1 = await ST.saveEntry('users', { fields: { name: 'Olga Operator', windows_id: 'olga', roles: ['operator'] } });
    var eng1 = await ST.saveEntry('users', { fields: { name: 'Erik Engineer', windows_id: 'erik', roles: ['engineer'] } });
    await ST.saveEntry('tools', { id: tool('FIB').id, fields: { primary_operator_id: op1.id } });
    ST.setCurrentUser(eng1.id);
    await refused('an engineer cannot set tool status', ST.setToolStatus({ tool_id: tool('FIB').id, status: 'down' }), 'not_allowed');
    ST.setCurrentUser(op1.id);
    await ST.setToolStatus({ tool_id: tool('FIB').id, status: 'maintenance', until: '2026-10-02', note: 'Source change' });
    eq('the tool\'s operator sets Maintenance until a date', [tool('FIB').status, tool('FIB').status_until], ['maintenance', '2026-10-02']);
    await refused('a bad date is refused', ST.setToolStatus({ tool_id: tool('FIB').id, status: 'down', until: '2026-13-01' }), 'invalid');
    await ST.setToolStatus({ tool_id: tool('FIB').id, status: 'up' });
    eq('back Up clears the until date', [tool('FIB').status, tool('FIB').status_until], ['up', null]);
    await refused('another tool is not hers', ST.setToolStatus({ tool_id: tool('QVM').id, status: 'down' }), 'not_allowed');

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

    // An upgrade step, for this test only: schema 0 -> 1.
    P.MIGRATIONS[0] = function (d) { d.upgraded = true; };
    var v0 = ST._pure.seedData(); v0.schema_version = 0; v0.revision = 7;
    a = window.MRT.adapters.storageMemory({});
    a.files[cfg.data_file] = JSON.stringify(v0);
    ST.init(a);
    await ST.load();
    delete P.MIGRATIONS[0];
    var copies = Object.keys(a.files).filter(function (k) { return k.indexOf(cfg.backup_prefix + 'before-upgrade_v0-to-v1_') !== -1; });
    eq('an upgrade first keeps a copy of the old file', copies.length, 1);
    eq('...the copy is the old file, unchanged', JSON.parse(a.files[copies[0]]).schema_version, 0);
    eq('...the data is upgraded in memory', [ST.data().schema_version, ST.data().upgraded], [1, true]);
    eq('...and the status says so until the next save', ST.status().upgradedFrom, 0);
  }

  T.done = run().catch(function (e) {
    T.failed++;
    (current || (group('Runner'), current)).rows.push({ ok: false, name: 'the test run crashed', detail: String(e && e.stack || e) });
  });
})();
