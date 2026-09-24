/**
 * Metrology Request Tracker - domain.js
 *
 * ALL rules and maths, as pure functions: no DOM, no store, no Date.now()
 * (a moment is always passed in as `now_ts`). Unit suffixes in names:
 * _ts (timestamp), _h (hours), _ymd ('YYYY-MM-DD' calendar date).
 * Every rule here has a test in tests/tests.js.
 *
 * M1: roles, identity and name matching, list validation, lab calendar,
 * Austrian public holidays. Request rules follow in M2.
 */
window.MRT = window.MRT || {};
window.MRT.domain = (function () {
  'use strict';

  var TZ = 'Europe/Vienna';

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */

  function isStr(v) { return typeof v === 'string' && v.trim() !== ''; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function trim(v) { return v === null || v === undefined ? '' : String(v).trim(); }

  /** 'YYYY-MM-DD' that is a real date. */
  function isYmd(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = new Date(s + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }

  function addDaysYmd(ymd, days) {
    var d = new Date(ymd + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  /** The Europe/Vienna calendar date of a moment, 'YYYY-MM-DD'. */
  function viennaYmd(ts) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(ts));
  }

  /** 'HH:MM', 00:00 - 23:59. */
  function isHhmm(s) { return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s); }
  function hhmmToMin(s) { return parseInt(s.slice(0, 2), 10) * 60 + parseInt(s.slice(3), 10); }

  /* ------------------------------------------------------------------ *
   * Roles (ticks, several per person) - Q17/Q52
   * ------------------------------------------------------------------ */

  /*
   * engineer  requests measurements
   * quality   Quality engineer: runs the measurements today (M1-12)
   * operator  kept for later - no rights of its own until the rights per
   *           role are designed (OPEN_QUESTIONS #14)
   * manager   manager analytics (Q52)
   * admin     Settings (+ PIN)
   */
  var ROLES = ['engineer', 'quality', 'operator', 'manager', 'admin'];
  var ROLE_LABEL = { engineer: 'Engineer', quality: 'Quality engineer', operator: 'Operator', manager: 'Manager', admin: 'Admin' };

  function hasRole(user, role) {
    return !!(user && user.active !== false && Array.isArray(user.roles) && user.roles.indexOf(role) !== -1);
  }

  /**
   * Who runs measurements - the ONE place that decides it (M1-12). Today
   * only Quality engineers; Operators get rights once they are designed
   * (OPEN_QUESTIONS #14). Every "measurer" right asks this.
   */
  function canMeasure(user) { return hasRole(user, 'quality'); }

  /*
   * Away (DECISIONS M1-14): vacation, sick leave - one period per person,
   * stored on the user as away_from / away_until (YYYY-MM-DD, until optional =
   * "until further notice") and an optional note. No reason is ever stored.
   */
  var AWAY_NOTE_MAX = 200;

  /**
   * Where a person stands on a day.
   * @returns {null | {state: 'now'|'planned'|'over', from, until, note}}
   */
  function awayState(user, today_ymd) {
    if (!user || !user.away_from) return null;
    var st = today_ymd < user.away_from ? 'planned' : (user.away_until && today_ymd > user.away_until ? 'over' : 'now');
    return { state: st, from: user.away_from, until: user.away_until || null, note: user.away_note || '' };
  }

  function isAway(user, today_ymd) { var a = awayState(user, today_ymd); return !!a && a.state === 'now'; }

  /** Check an away period {from, until, note}; empty = fine. */
  function validateAway(a) {
    var p = [];
    if (!isYmd(a.from)) p.push('Pick the first day away');
    if (a.until && !isYmd(a.until)) p.push('"Back" must be a date');
    if (isYmd(a.from) && isYmd(a.until) && a.until < a.from) p.push('The last day away cannot be before the first');
    if (a.note && String(a.note).length > AWAY_NOTE_MAX) p.push('Keep the note under ' + AWAY_NOTE_MAX + ' characters');
    return p;
  }

  /**
   * A tool's primary and backup (stored as primary_operator_id /
   * backup_operator_id - the field names stay, the people are measurers)
   * and admins set its status (Q27).
   */
  function canSetToolStatus(user, tool) {
    if (!user || !tool) return false;
    if (hasRole(user, 'admin')) return true;
    return canMeasure(user) &&
           (tool.primary_operator_id === user.id || tool.backup_operator_id === user.id);
  }

  /* ------------------------------------------------------------------ *
   * Identity - CLAUDE.md "Identity"
   * ------------------------------------------------------------------ */

  /**
   * Split a Windows login into a stored windows_id and domain.
   *   'pkhurana'        -> {windows_id: 'pkhurana', domain: null}
   *   'CORP\\PKhurana'  -> {windows_id: 'pkhurana', domain: 'CORP'}
   * windows_id is lowercase with no domain; domain is upper case.
   * Returns null for anything that is not a plausible login name.
   */
  function parseWindowsLogin(raw) {
    var s = trim(raw);
    if (!s) return null;
    var domain = null;
    var i = s.indexOf('\\');
    if (i !== -1) {
      domain = s.slice(0, i).trim().toUpperCase();
      s = s.slice(i + 1).trim();
      if (!/^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(domain)) return null;
    }
    var id = s.toLowerCase();
    if (!isWindowsId(id)) return null;
    return { windows_id: id, domain: domain };
  }

  /** A stored windows_id: lowercase letters, digits, dot, dash, underscore; max 64. */
  function isWindowsId(s) {
    return typeof s === 'string' && /^[a-z0-9][a-z0-9._-]{0,63}$/.test(s);
  }

  function isEmail(s) {
    return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  /** Does a stored user belong to this identity? Domains count only when both are known. */
  function identityMatches(user, ident) {
    if (!user || !ident || !user.windows_id || user.windows_id !== ident.windows_id) return false;
    if (user.domain && ident.domain) return user.domain.toUpperCase() === ident.domain.toUpperCase();
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Names - "Is this you?" (M1-5)
   * ------------------------------------------------------------------ */

  /** Lowercase, no accents, single spaces: ' Jürgen  MÜLLER ' -> 'jurgen muller'. */
  function normalizeName(s) {
    return trim(s)
      .replace(/ß/g, 'ss')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Same person by name: the same words in any order ("Khurana Prince"). */
  function sameName(a, b) {
    var x = normalizeName(a).split(' ').sort().join(' ');
    var y = normalizeName(b).split(' ').sort().join(' ');
    return x !== '' && x === y;
  }

  /** Users whose name matches, for the "Is this you?" question. */
  function findNameMatches(users, name) {
    return (users || []).filter(function (u) { return sameName(u.name, name); });
  }

  /* ------------------------------------------------------------------ *
   * Lab calendar - M1-9 / Q36
   * ------------------------------------------------------------------ */

  /**
   * Check a lab calendar {days: [1..7] (ISO: 1 = Monday), start: 'HH:MM', end: 'HH:MM'}.
   * Returns a list of problems (empty = fine).
   */
  function validateCalendar(cal) {
    var p = [];
    if (!cal || !Array.isArray(cal.days) || !cal.days.length) p.push('Pick at least one lab day');
    else if (!cal.days.every(function (d) { return d >= 1 && d <= 7 && Math.floor(d) === d; })) p.push('Lab days must be 1 (Mon) to 7 (Sun)');
    if (!cal || !isHhmm(cal.start)) p.push('Start time must look like 07:00');
    if (!cal || !isHhmm(cal.end)) p.push('End time must look like 18:00');
    if (cal && isHhmm(cal.start) && isHhmm(cal.end) && hhmmToMin(cal.end) <= hhmmToMin(cal.start)) {
      p.push('The lab must close after it opens');
    }
    return p;
  }

  /** Easter Sunday (Gregorian, anonymous algorithm), 'YYYY-MM-DD'. */
  function easterSundayYmd(year) {
    var a = year % 19, b = Math.floor(year / 100), c = year % 100;
    var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var month = Math.floor((h + l - 7 * m + 114) / 31);
    var day = ((h + l - 7 * m + 114) % 31) + 1;
    return year + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
  }

  /** The 13 Austrian public holidays of a year, in date order: [{date, name}]. */
  function austrianHolidays(year) {
    var y = String(year);
    var easter = easterSundayYmd(year);
    return [
      { date: y + '-01-01', name: 'New Year\'s Day' },
      { date: y + '-01-06', name: 'Epiphany' },
      { date: addDaysYmd(easter, 1), name: 'Easter Monday' },
      { date: y + '-05-01', name: 'Labour Day' },
      { date: addDaysYmd(easter, 39), name: 'Ascension Day' },
      { date: addDaysYmd(easter, 50), name: 'Whit Monday' },
      { date: addDaysYmd(easter, 60), name: 'Corpus Christi' },
      { date: y + '-08-15', name: 'Assumption Day' },
      { date: y + '-10-26', name: 'National Day' },
      { date: y + '-11-01', name: 'All Saints\' Day' },
      { date: y + '-12-08', name: 'Immaculate Conception' },
      { date: y + '-12-25', name: 'Christmas Day' },
      { date: y + '-12-26', name: 'St. Stephen\'s Day' }
    ].sort(function (p, q) { return p.date < q.date ? -1 : p.date > q.date ? 1 : 0; });
  }

  /* ------------------------------------------------------------------ *
   * Lists - what a valid entry looks like (Settings)
   * ------------------------------------------------------------------ */

  var TOOL_STATUSES = ['up', 'down', 'maintenance'];
  var TOOL_STATUS_LABEL = { up: 'Up', down: 'Down', maintenance: 'Maintenance' };

  var FIELD_TYPES = ['text', 'longtext', 'number', 'choice', 'multichoice', 'yesno', 'date', 'path'];
  var FIELD_TYPE_LABEL = {
    text: 'Short text', longtext: 'Long text', number: 'Number', choice: 'One choice',
    multichoice: 'Several choices', yesno: 'Yes / no', date: 'Date', path: 'Shared-drive path'
  };

  /** Codes that become part of request IDs (FIB-260924-03) or lot names. */
  function isCode(s, max) { return typeof s === 'string' && new RegExp('^[A-Z0-9][A-Z0-9-]{0,' + ((max || 12) - 1) + '}$').test(s); }

  /**
   * A part number: capitals, digits and - . _ / , up to 30 characters.
   * Provisional - the real format rule is still open (OPEN_QUESTIONS #17).
   */
  function isPartNumber(s) { return typeof s === 'string' && /^[A-Z0-9][A-Z0-9._\/-]{0,29}$/.test(s); }

  /** A Windows share or drive path: \\server\share\... or X:\... (M1-3, Q13, Q30). */
  function isSharePath(s) {
    return typeof s === 'string' && (/^\\\\[^\\\s][^\\]*\\[^\\]+/.test(s) || /^[A-Za-z]:\\/.test(s));
  }

  function others(rows, id) { return (rows || []).filter(function (r) { return r.id !== id; }); }

  function dupBy(rows, id, key, value, norm) {
    var n = norm || function (v) { return String(v).toUpperCase(); };
    return others(rows, id).some(function (r) { return r[key] !== undefined && r[key] !== null && n(r[key]) === n(value); });
  }

  /**
   * Check one list entry as it WOULD be after a save.
   * @param {string} collection  users | tools | measurement_types | tool_fields | bkms |
   *                             projects | part_numbers | buildups | process_steps | priorities | holidays
   * @param {Object} row         the entry (with id when it exists already)
   * @param {Object} data        the collections, for uniqueness and references
   * @returns {string[]} problems; empty means valid
   */
  function validateEntry(collection, row, data) {
    var p = [];
    var d = data || {};
    var r = row || {};
    function exists(coll, id) { return (d[coll] || []).some(function (x) { return x.id === id; }); }

    switch (collection) {
      case 'users':
        if (!isStr(r.name)) p.push('Enter a name');
        if (!Array.isArray(r.roles) || !r.roles.every(function (x) { return ROLES.indexOf(x) !== -1; })) p.push('Unknown role');
        if (r.windows_id && !isWindowsId(r.windows_id)) p.push('Windows ID: lowercase letters, digits, . - _ only, no domain');
        if (r.windows_id && others(d.users, r.id).some(function (u) { return identityMatches(u, r); })) p.push('Windows ID ' + r.windows_id + ' already belongs to someone else');
        if (r.domain && !/^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(r.domain)) p.push('Domain: letters and digits only, e.g. CORP');
        if (r.email && !isEmail(r.email)) p.push('That email address does not look right');
        if (r.email && dupBy(d.users, r.id, 'email', r.email, function (v) { return String(v).toLowerCase(); })) p.push('Email ' + r.email + ' already belongs to someone else');
        if (r.away_from || r.away_until || r.away_note) p.push.apply(p, validateAway({ from: r.away_from, until: r.away_until, note: r.away_note }));
        break;

      case 'tools':
        if (!isCode(r.code, 6)) p.push('Code: 1-6 capital letters or digits, e.g. FIB (it starts every request ID)');
        else if (dupBy(d.tools, r.id, 'code', r.code)) p.push('Tool code ' + r.code + ' is already used');
        if (!isStr(r.name)) p.push('Enter a name');
        if (TOOL_STATUSES.indexOf(r.status) === -1) p.push('Status must be Up, Down or Maintenance');
        if (r.status_until && !isYmd(r.status_until)) p.push('"Until" must be a date');
        if (r.status === 'up' && r.status_until) p.push('An Up tool has no "until" date');
        if (r.destructive !== undefined && typeof r.destructive !== 'boolean') p.push('"Destructive" must be yes or no');
        if (r.primary_operator_id && !exists('users', r.primary_operator_id)) p.push('Primary quality engineer not found');
        if (r.backup_operator_id && !exists('users', r.backup_operator_id)) p.push('Backup quality engineer not found');
        if (r.primary_operator_id && r.primary_operator_id === r.backup_operator_id) p.push('Primary and backup must be different people');
        if (r.results_root && !isSharePath(r.results_root)) p.push('Results root must be a share path like \\\\server\\share\\... or Z:\\...');
        break;

      case 'measurement_types':
        if (!exists('tools', r.tool_id)) p.push('Pick a tool');
        if (!isStr(r.name)) p.push('Enter a name');
        else if (others(d.measurement_types, r.id).some(function (x) { return x.tool_id === r.tool_id && normalizeName(x.name) === normalizeName(r.name); })) p.push('This tool already has a type called ' + r.name);
        break;

      case 'tool_fields':
        if (!exists('tools', r.tool_id)) p.push('Pick a tool');
        if (!isStr(r.label)) p.push('Enter a label');
        else if (others(d.tool_fields, r.id).some(function (x) { return x.tool_id === r.tool_id && normalizeName(x.label) === normalizeName(r.label); })) p.push('This tool already has a field called ' + r.label);
        if (FIELD_TYPES.indexOf(r.type) === -1) p.push('Pick a field type');
        if (r.type === 'choice' || r.type === 'multichoice') {
          var live = (r.choices || []).filter(function (c) { return c.active !== false; });
          if (live.length < 2) p.push('A choice field needs at least two choices');
          if ((r.choices || []).some(function (c) { return !isStr(c.label); })) p.push('Every choice needs a label');
          var seen = {};
          (r.choices || []).forEach(function (c) {
            var k = normalizeName(c.label);
            if (k && seen[k]) p.push('Choice "' + c.label + '" is listed twice');
            seen[k] = true;
          });
        }
        if (r.type === 'number') {
          if (r.min !== null && r.min !== undefined && !isNum(r.min)) p.push('Min must be a number');
          if (r.max !== null && r.max !== undefined && !isNum(r.max)) p.push('Max must be a number');
          if (isNum(r.min) && isNum(r.max) && r.min > r.max) p.push('Min must not be above max');
        }
        (r.type_ids || []).forEach(function (tid) {
          var t = (d.measurement_types || []).filter(function (x) { return x.id === tid; })[0];
          if (!t || t.tool_id !== r.tool_id) p.push('"Only for" lists a type of another tool');
        });
        break;

      case 'bkms':
        if (!exists('tools', r.tool_id)) p.push('Pick a tool');
        if (r.type_id) {
          var mt = (d.measurement_types || []).filter(function (x) { return x.id === r.type_id; })[0];
          if (!mt || mt.tool_id !== r.tool_id) p.push('The measurement type belongs to another tool');
        }
        if (!isStr(r.name)) p.push('Enter a name');
        if (!isSharePath(r.path)) p.push('Path must be a share path like \\\\server\\share\\... or Z:\\...');
        break;

      case 'projects':
      case 'buildups':
        if (!isCode(r.code, 12)) p.push('Code: capital letters, digits and dashes, e.g. BU-01');
        else if (dupBy(d[collection], r.id, 'code', r.code)) p.push(r.code + ' already exists');
        break;

      case 'part_numbers':
        if (!isPartNumber(r.code)) p.push('Part number: capitals, digits and - . _ / (up to 30), e.g. PN-10234-A');
        else if (dupBy(d.part_numbers, r.id, 'code', r.code)) p.push('Part number ' + r.code + ' already exists');
        if (!Array.isArray(r.project_ids) || !r.project_ids.length) p.push('Tick at least one project');
        else {
          if (r.project_ids.some(function (id) { return !exists('projects', id); })) p.push('A ticked project no longer exists');
          if (r.project_ids.some(function (id, i) { return r.project_ids.indexOf(id) !== i; })) p.push('A project is ticked twice');
        }
        break;

      case 'process_steps':
        if (!isStr(r.name)) p.push('Enter a name');
        else if (r.name.length > 60) p.push('Keep the name under 60 characters');
        else if (others(d.process_steps, r.id).some(function (x) { return normalizeName(x.name) === normalizeName(r.name); })) p.push(r.name + ' is already listed');
        if (r.sort !== undefined && r.sort !== null && (!isNum(r.sort) || r.sort < 1 || Math.floor(r.sort) !== r.sort)) p.push('Position must be a whole number, 1 or more');
        break;

      case 'priorities':
        if (!isCode(r.code, 4)) p.push('Code: e.g. P1');
        else if (dupBy(d.priorities, r.id, 'code', r.code)) p.push(r.code + ' already exists');
        if (!isStr(r.name)) p.push('Enter a name');
        if (!isNum(r.level) || r.level < 1 || Math.floor(r.level) !== r.level) p.push('Level must be a whole number, 1 = most urgent');
        break;

      case 'holidays':
        if (!isYmd(r.date)) p.push('Pick a date');
        else if (dupBy(d.holidays, r.id, 'date', r.date)) p.push(r.date + ' is already a holiday');
        if (!isStr(r.name)) p.push('Enter a name');
        if (['public', 'closing'].indexOf(r.kind) === -1) p.push('Kind must be public holiday or company closing day');
        break;

      default:
        p.push('Unknown list: ' + collection);
    }
    return p;
  }

  /**
   * Priorities as a whole: exactly one default, and it must be active.
   * Returns problems for the would-be list.
   */
  function validatePriorities(list) {
    var active = (list || []).filter(function (x) { return x.active !== false; });
    var p = [];
    if (!active.length) p.push('At least one priority must stay active');
    var defs = (list || []).filter(function (x) { return x.is_default; });
    if (defs.length !== 1) p.push('Exactly one priority must be the default');
    else if (defs[0].active === false) p.push('The default priority cannot be hidden');
    return p;
  }

  /* ------------------------------------------------------------------ *
   * Health and the setup to-do list (Settings > Health, M1-11)
   * Pure reads of the whole file. Each item: {severity, code, text, tab, id}
   *   severity: 'problem' (broken, fix it) | 'warning' (odd) | 'todo' (setup
   *   not finished) | 'note'; tab + id say where to fix it in Settings.
   * ------------------------------------------------------------------ */

  function byIdMap(rows) { var m = {}; (rows || []).forEach(function (r) { m[r.id] = r; }); return m; }

  /**
   * What still needs doing before real use - the office checklist, live.
   * @param {Object} data     the data file
   * @param {Object} o        {today_ymd, calendar_confirmed}
   */
  function setupTodo(data, o) {
    var out = [];
    var today = (o && o.today_ymd) || '1970-01-01';
    function add(code, text, tab, id) { out.push({ severity: 'todo', code: code, text: text, tab: tab, id: id || null }); }
    var tools = (data.tools || []).filter(function (t) { return t.active !== false; });

    var sTypes = (data.measurement_types || []).filter(function (m) { return m.sample; }).length;
    var sBkms = (data.bkms || []).filter(function (b) { return b.sample; }).length;
    var sFields = (data.tool_fields || []).filter(function (f) { return f.sample; }).length;
    if (sTypes) add('sample_types', sTypes + ' measurement type' + (sTypes === 1 ? ' is' : 's are') + ' still sample (made up) - check them with the engineers', 'tools');
    if (sBkms) add('sample_bkms', sBkms + ' BKM' + (sBkms === 1 ? ' is' : 's are') + ' still sample, with fake paths - replace them with the real ones', 'tools');
    if (sFields) add('sample_fields', sFields + ' extra field' + (sFields === 1 ? ' is' : 's are') + ' still sample', 'tools');

    tools.forEach(function (t) {
      if (!t.primary_operator_id) add('no_primary', t.code + ' has no primary quality engineer', 'tools', t.id);
      if (!t.backup_operator_id) add('no_backup', t.code + ' has no backup quality engineer', 'tools', t.id);
      if (!t.results_root) add('no_results_root', t.code + ' has no results root folder', 'tools', t.id);
      if (!(data.measurement_types || []).some(function (m) { return m.tool_id === t.id && m.active !== false; })) {
        add('no_types', t.code + ' has no measurement types', 'tools', t.id);
      }
    });

    if (!(data.process_steps || []).some(function (x) { return x.active !== false; })) {
      add('no_process_steps', 'No process steps yet - requests say which step the panels are at', 'lists');
    }
    if (!(data.part_numbers || []).some(function (x) { return x.active !== false; })) {
      add('no_part_numbers', 'No part numbers yet - add them per project before lots are registered', 'lists');
    }

    if (!(o && o.calendar_confirmed)) add('calendar_unconfirmed', 'Lab days and hours are not confirmed yet', 'calendar');
    var hol = data.holidays || [];
    if (!hol.some(function (h) { return h.kind === 'closing'; })) add('no_closing_days', 'No company closing days are listed (e.g. 24 and 31 December)', 'calendar');
    var nextYear = String(parseInt(today.slice(0, 4), 10) + 1);
    if (!hol.some(function (h) { return h.date.slice(0, 4) === nextYear; })) add('no_holidays_next_year', 'No holidays listed for ' + nextYear, 'calendar');

    var review = (data.users || []).filter(function (u) { return u.active && u.needs_review; });
    review.forEach(function (u) { add('user_review', u.name + ' added themselves - check their roles', 'users', u.id); });
    var admins = (data.users || []).filter(function (u) { return hasRole(u, 'admin'); });
    if (admins.length === 1) add('one_admin', 'Only one admin (' + admins[0].name + ') - add a second one for when you are away', 'users');
    return out;
  }

  /** Everything that looks wrong in the file: broken links, odd states. Never writes. */
  function healthIssues(data, o) {
    var out = [];
    var today = (o && o.today_ymd) || '1970-01-01';
    function add(severity, code, text, tab, id) { out.push({ severity: severity, code: code, text: text, tab: tab, id: id || null }); }
    var users = byIdMap(data.users), tools = byIdMap(data.tools), types = byIdMap(data.measurement_types);

    (data.measurement_types || []).forEach(function (m) {
      if (!tools[m.tool_id]) add('problem', 'orphan_type', 'Measurement type "' + m.name + '" belongs to a tool that no longer exists', 'tools', m.id);
    });
    (data.tool_fields || []).forEach(function (f) {
      if (!tools[f.tool_id]) add('problem', 'orphan_field', 'Field "' + f.label + '" belongs to a tool that no longer exists', 'tools', f.id);
      (f.type_ids || []).forEach(function (tid) {
        if (!types[tid]) add('problem', 'field_bad_type', 'Field "' + f.label + '" is limited to a measurement type that no longer exists', 'tools', f.id);
      });
    });
    (data.bkms || []).forEach(function (b) {
      if (!tools[b.tool_id]) add('problem', 'orphan_bkm', 'BKM "' + b.name + '" belongs to a tool that no longer exists', 'tools', b.id);
      if (b.type_id && !types[b.type_id]) add('problem', 'bkm_bad_type', 'BKM "' + b.name + '" points at a measurement type that no longer exists', 'tools', b.id);
      if (b.type_id && types[b.type_id] && types[b.type_id].active === false && b.active !== false) {
        add('warning', 'bkm_hidden_type', 'BKM "' + b.name + '" is active, but its measurement type is hidden', 'tools', b.id);
      }
    });
    (data.tools || []).forEach(function (t) {
      if (t.active === false) return;
      [['primary_operator_id', 'Primary'], ['backup_operator_id', 'Backup']].forEach(function (k) {
        var id = t[k[0]];
        if (!id) return;
        var u = users[id];
        if (!u) add('problem', 'operator_missing', t.code + ': the ' + k[1].toLowerCase() + ' quality engineer no longer exists', 'tools', t.id);
        else if (!u.active) add('warning', 'operator_inactive', t.code + ': the ' + k[1].toLowerCase() + ' quality engineer ' + u.name + ' is switched off', 'tools', t.id);
        else if (!canMeasure(u)) add('warning', 'operator_no_role', t.code + ': ' + u.name + ' is ' + k[1].toLowerCase() + ' but has no Quality engineer role', 'users', u.id);
      });
      var pAway = users[t.primary_operator_id], bAway = users[t.backup_operator_id];
      if (pAway && bAway && isAway(pAway, today) && isAway(bAway, today)) {
        add('warning', 'both_away', t.code + ': primary ' + pAway.name + ' and backup ' + bAway.name + ' are both away today', 'tools', t.id);
      }
      if (t.status !== 'up' && t.status_until && t.status_until < today) {
        add('warning', 'status_overdue', t.code + ' is still ' + TOOL_STATUS_LABEL[t.status] + ', but its "until" date ' + t.status_until + ' has passed', 'tools', t.id);
      }
    });
    var projects = byIdMap(data.projects);
    (data.part_numbers || []).forEach(function (pn) {
      if ((pn.project_ids || []).some(function (id) { return !projects[id]; })) {
        add('problem', 'pn_bad_project', 'Part number ' + pn.code + ' is linked to a project that no longer exists', 'lists', pn.id);
      } else if (pn.active !== false && (pn.project_ids || []).length && pn.project_ids.every(function (id) { return projects[id].active === false; })) {
        add('warning', 'pn_hidden_projects', 'Part number ' + pn.code + ' is active, but all its projects are hidden', 'lists', pn.id);
      }
    });
    (data.users || []).forEach(function (u) {
      if (u.active && (!u.roles || !u.roles.length)) add('warning', 'user_no_role', u.name + ' has no role', 'users', u.id);
    });
    validatePriorities(data.priorities || []).forEach(function (msg) { add('problem', 'priorities', msg, 'lists'); });
    var sample = (data.measurement_types || []).concat(data.bkms || [], data.tool_fields || []).filter(function (x) { return x.sample; }).length;
    if (sample) add('note', 'sample_entries', sample + ' sample entries are still in use (see the setup list)', 'tools');
    return out;
  }

  return {
    TZ: TZ,
    ROLES: ROLES,
    ROLE_LABEL: ROLE_LABEL,
    TOOL_STATUSES: TOOL_STATUSES,
    TOOL_STATUS_LABEL: TOOL_STATUS_LABEL,
    FIELD_TYPES: FIELD_TYPES,
    FIELD_TYPE_LABEL: FIELD_TYPE_LABEL,

    isYmd: isYmd,
    isHhmm: isHhmm,
    addDaysYmd: addDaysYmd,
    viennaYmd: viennaYmd,

    hasRole: hasRole,
    canMeasure: canMeasure,
    awayState: awayState,
    isAway: isAway,
    validateAway: validateAway,
    canSetToolStatus: canSetToolStatus,

    parseWindowsLogin: parseWindowsLogin,
    isWindowsId: isWindowsId,
    isEmail: isEmail,
    identityMatches: identityMatches,

    normalizeName: normalizeName,
    sameName: sameName,
    findNameMatches: findNameMatches,

    validateCalendar: validateCalendar,
    easterSundayYmd: easterSundayYmd,
    austrianHolidays: austrianHolidays,

    isCode: isCode,
    isPartNumber: isPartNumber,
    isSharePath: isSharePath,
    validateEntry: validateEntry,
    validatePriorities: validatePriorities,
    setupTodo: setupTodo,
    healthIssues: healthIssues
  };
})();
