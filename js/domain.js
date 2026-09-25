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
  /** Any engineer registers a lot (Q7); admins too. */
  function canRegisterLot(user) { return hasRole(user, 'engineer') || hasRole(user, 'admin'); }

  /** The lot's owner or an admin changes or deletes it. */
  function canEditLot(user, lot) {
    if (!user || !lot) return false;
    return hasRole(user, 'admin') || (lot.owner_id === user.id && user.active !== false);
  }

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
  /**
   * A lot number: digits, optionally a split suffix - 18178, 18178.01 (M2-1).
   * Provisional until the rule is confirmed (OPEN_QUESTIONS #21).
   */
  function isLotNumber(s) { return typeof s === 'string' && /^\d{1,8}(\.\d{1,2})?$/.test(s); }

  /**
   * Panels typed as ranges (Q6, M2-2): "1-5, 12" -> [1, 2, 3, 4, 5, 12].
   * Commas, semicolons or spaces separate; "all" means every panel; a range
   * written backwards (5-1) is read forwards. Each number must be 1..count.
   * @returns {{panels: number[], errors: string[]}} panels sorted, each once
   */
  function parsePanels(text, count) {
    var out = {}, errors = [];
    var src = String(text || '').trim();
    if (!src) return { panels: [], errors: [] };
    src.split(/[,;\s]+/).filter(Boolean).forEach(function (tok) {
      if (/^all$/i.test(tok)) { for (var k = 1; k <= count; k++) out[k] = true; return; }
      var m = tok.match(/^(\d+)(?:-(\d+))?$/);
      if (!m) { errors.push('"' + tok + '" is not a panel number or range like 1-5'); return; }
      var a = parseInt(m[1], 10), b = m[2] ? parseInt(m[2], 10) : a;
      if (a > b) { var t = a; a = b; b = t; }
      if (a < 1 || b > count) { errors.push(tok + ': the lot has panels 1-' + count); return; }
      for (var n = a; n <= b; n++) out[n] = true;
    });
    return { panels: Object.keys(out).map(Number).sort(function (x, y) { return x - y; }), errors: errors };
  }

  /** The other way round: [1, 2, 3, 4, 5, 12] -> "1-5, 12" (runs of 3+ become a range). */
  function formatPanels(panels) {
    var list = (panels || []).slice().sort(function (x, y) { return x - y; }).filter(function (n, i, a) { return !i || a[i - 1] !== n; });
    var parts = [], i = 0;
    while (i < list.length) {
      var j = i;
      while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
      if (j - i >= 2) parts.push(list[i] + '-' + list[j]);
      else for (var k = i; k <= j; k++) parts.push(String(list[k]));
      i = j + 1;
    }
    return parts.join(', ');
  }

  /**
   * Several lot numbers pasted at once (admin, Settings > Lots): separated by
   * commas, spaces or new lines; "18178-18180" is a run of whole numbers
   * (at most 100). Each number once, in the order given.
   * @returns {{numbers: string[], errors: string[]}}
   */
  function parseLotNumbers(text) {
    var out = [], errors = [];
    String(text || '').split(/[,;\s]+/).filter(Boolean).forEach(function (tok) {
      var m = tok.match(/^(\d{1,8})-(\d{1,8})$/);
      if (m) {
        var a = parseInt(m[1], 10), b = parseInt(m[2], 10);
        if (b < a || b - a >= 100) { errors.push(tok + ': a run goes up, at most 100 lots'); return; }
        for (var n = a; n <= b; n++) { var s = String(n); while (s.length < m[1].length) s = '0' + s; if (out.indexOf(s) === -1) out.push(s); }
        return;
      }
      if (!isLotNumber(tok)) { errors.push('"' + tok + '" is not a lot number (e.g. 18178 or 18178.01)'); return; }
      if (out.indexOf(tok) === -1) out.push(tok);
    });
    return { numbers: out, errors: errors };
  }

  /* ------------------------------------------------------------------ *
   * Magazines (DECISIONS M2-23, F-3): a PCB magazine with numbered slots
   * (24 by default), one panel per slot. A request says which slots hold
   * its panels; slots of open requests are taken.
   * ------------------------------------------------------------------ */

  /** M70345 - M and digits (provisional, like the real ones). */
  function isMagazineCode(s) { return typeof s === 'string' && /^M\d{3,8}$/.test(s); }

  /* ------------------------------------------------------------------ *
   * Request form v2 (DECISIONS F-1..F-5): panels by Hirata ID, layers from
   * the build-up, magazine slots.
   * ------------------------------------------------------------------ */

  /**
   * A panel's Hirata ID: digits, 1-9 - the full 9-digit Hirata code when it
   * is known, usually its last 4 (lot per day + panel), e.g. 3252 (H-1).
   */
  function isPanelId(s) { return typeof s === 'string' && /^\d{1,9}$/.test(s); }

  /**
   * Panel IDs typed or pasted: commas, spaces or new lines; "3252-3255" is a
   * run of consecutive IDs (at most 50). Each ID once, in the order given.
   * @returns {{ids: string[], errors: string[]}}
   */
  function parsePanelIds(text) {
    var ids = [], errors = [];
    String(text || '').split(/[,;\s]+/).filter(Boolean).forEach(function (tok) {
      var m = tok.match(/^(\d{1,9})-(\d{1,9})$/);
      if (m) {
        var a = parseInt(m[1], 10), b = parseInt(m[2], 10);
        if (b < a || b - a >= 50) { errors.push(tok + ': a run goes up, at most 50 panels'); return; }
        for (var n = a; n <= b; n++) { var s = String(n); while (s.length < m[1].length) s = '0' + s; if (ids.indexOf(s) === -1) ids.push(s); }
        return;
      }
      if (!isPanelId(tok)) { errors.push('"' + tok + '" is not a Hirata ID (digits, e.g. 3252)'); return; }
      if (ids.indexOf(tok) === -1) ids.push(tok);
    });
    return { ids: ids, errors: errors };
  }

  /* ------------------------------------------------------------------ *
   * Hirata code (DECISIONS H-1..H-3): the dot code drilled into every panel.
   * 9 digits - Supplier 1, Year 1, Week 2, Day 1, Lot per day 2, Panel 2
   * (fixed, like Prince's Hirata tool). Each digit is a column of dots:
   * rows weigh 8, 4, 2, 1, plus a bottom baseline dot that is always there;
   * a digit is the sum of its filled rows and never above 9. A code starts
   * with a column of all five dots (orientation).
   * ------------------------------------------------------------------ */

  var HIRATA_WEIGHTS = [8, 4, 2, 1];
  var HIRATA_MAX = 9;
  var HIRATA_FIELDS = [
    { id: 'sup', name: 'Supplier', width: 1 },
    { id: 'yr',  name: 'Year',     width: 1 },
    { id: 'wk',  name: 'Week',     width: 2 },
    { id: 'day', name: 'Day',      width: 1 },
    { id: 'lot', name: 'Lot per day', width: 2 },
    { id: 'pan', name: 'Panel',    width: 2 }
  ];
  var HIRATA_LENGTH = 9;
  var HIRATA_TAIL = 4;           // lot per day + panel: what is matched on the physical panel

  /** The dots of one digit, top to bottom: [8, 4, 2, 1, baseline] as true/false. */
  function hirataDots(digit) {
    var d = Number(digit);
    if (String(digit).trim() === '' || !(d >= 0 && d <= HIRATA_MAX) || Math.floor(d) !== d) return null;
    return HIRATA_WEIGHTS.map(function (w) { return (d & w) !== 0; }).concat([true]);
  }

  /** The digit a column of dots stands for (baseline ignored). */
  function hirataDigit(dots) {
    return HIRATA_WEIGHTS.reduce(function (s, w, i) { return s + (dots && dots[i] ? w : 0); }, 0);
  }

  /** Can this row's dot be switched on in the column without going above 9? Off is always fine. */
  function hirataCanSet(dots, row) {
    if (row < 0 || row >= HIRATA_WEIGHTS.length) return false;
    if (dots[row]) return true;
    return hirataDigit(dots) + HIRATA_WEIGHTS[row] <= HIRATA_MAX;
  }

  /**
   * The fields of a code, read from the right: the last 2 digits are the
   * panel, the 2 before the lot per day, and so on - so a 4-digit ID shows
   * Lot per day + Panel and the full 9 shows everything.
   * @returns [{id, name, value, partial}] - only the fields the digits reach
   */
  function hirataFields(digits) {
    var s = String(digits || ''), out = [], end = s.length;
    for (var i = HIRATA_FIELDS.length - 1; i >= 0 && end > 0; i--) {
      var f = HIRATA_FIELDS[i], w = Math.min(f.width, end);
      out.unshift({ id: f.id, name: f.name, value: s.slice(end - w, end), partial: w < f.width });
      end -= w;
    }
    return out;
  }

  /**
   * Check a typed code. kind: 'full' (9 digits), 'tail' (4: lot + panel),
   * 'short' (other lengths - drawn as typed) or null with a problem.
   */
  function hirataCheck(text) {
    var s = String(text || '').replace(/\s+/g, '');
    if (!s) return { digits: '', kind: null, problem: null };
    if (!/^\d+$/.test(s)) return { digits: s, kind: null, problem: 'Digits only' };
    if (s.length > HIRATA_LENGTH) return { digits: s, kind: null, problem: 'A Hirata code has at most ' + HIRATA_LENGTH + ' digits' };
    return { digits: s, kind: s.length === HIRATA_LENGTH ? 'full' : s.length === HIRATA_TAIL ? 'tail' : 'short', problem: null };
  }

  /** Several codes typed at once ("3407, 0119 1827"): each checked, in order. */
  function hirataList(text) {
    return String(text || '').split(/[\s,;]+/).filter(Boolean).map(hirataCheck);
  }

  /** Panels as people say them: "3252, 3253" (or "2 panels" when only counted). */
  function panelsText(r) {
    var ids = r.panels || [];
    if (ids.length) return ids.join(', ');
    return r.panel_count ? r.panel_count + ' panel' + (r.panel_count === 1 ? '' : 's') : '-';
  }
  function panelCountOf(r) { return (r.panels || []).length || r.panel_count || 0; }

  /** How many build-up layers a build-up has: its setting, else the number in BU-04 (4), else 4 (up to 5F/5B). */
  function buildupLayers(bu) {
    if (!bu) return 4;
    if (isNum(bu.layers) && bu.layers >= 0) return bu.layers;
    var m = /(\d+)\s*$/.exec(bu.code || '');
    return m ? parseInt(m[1], 10) : 4;
  }

  /** The layers of a build-up (F-2): 1FCO, 1BCO (the core), then 2F, 2B ... (n+1)F, (n+1)B. */
  function layersFor(bu) {
    var out = ['1FCO', '1BCO'], n = buildupLayers(bu);
    for (var k = 2; k <= n + 1; k++) { out.push(k + 'F'); out.push(k + 'B'); }
    return out;
  }

  /** Where the panels are (F-3): "M70345 · slots 3, 4", and/or the note. */
  function placeText(r, magsById) {
    var m = r.magazine_id ? magsById[r.magazine_id] : null;
    var slots = (r.slots || []).slice().sort(function (a, b) { return a - b; });
    var t = m ? m.code + (slots.length ? ' · slot' + (slots.length > 1 ? 's ' : ' ') + formatPanels(slots) : '') : '';
    return [t, r.panel_location].filter(Boolean).join(' - ');
  }

  /** The slots of a magazine taken by other open requests: {slot: request_no}. */
  function takenSlots(requests, magazineId, exceptId) {
    var out = {};
    (requests || []).forEach(function (x) {
      if (x.id === exceptId || x.magazine_id !== magazineId || !isOpen(x)) return;
      (x.slots || []).forEach(function (s) { out[s] = x.request_no || 'a draft'; });
    });
    return out;
  }

  /** Most panels a lot can have (draws the panel map). */
  var LOT_MAX_PANELS = 200;
  var LOT_NOTE_MAX = 500;

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

  /** The shape of an admin-defined field (tool extra field or lot field, Q5). */
  function fieldDefProblems(r, p) {
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
  }

  /** An empty answer: nothing typed, picked or ticked (a "No" is an answer). */
  function isEmptyAnswer(v) { return v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length); }

  /**
   * Check one answer to an admin-defined field (lot fields today, request
   * extra fields in M2). Choices are stored by choice ID, so a rename keeps
   * old answers; a hidden choice stays valid (the form offers only live ones).
   * @returns {string[]} problems
   */
  function extraValueProblems(field, v) {
    var p = [], L = field.label;
    if (isEmptyAnswer(v)) { if (field.required && field.active !== false) p.push(L + ' is required'); return p; }
    var ids = (field.choices || []).map(function (c) { return c.id; });
    switch (field.type) {
      case 'text': case 'longtext':
        if (typeof v !== 'string') p.push(L + ': text expected');
        else if (v.length > (field.type === 'text' ? 200 : 2000)) p.push(L + ': too long');
        break;
      case 'number':
        if (!isNum(v)) p.push(L + ': enter a number');
        else {
          if (isNum(field.min) && v < field.min) p.push(L + ': at least ' + field.min);
          if (isNum(field.max) && v > field.max) p.push(L + ': at most ' + field.max);
        }
        break;
      case 'choice':
        if (ids.indexOf(v) === -1) p.push(L + ': pick one of the choices');
        break;
      case 'multichoice':
        if (!Array.isArray(v) || v.some(function (x) { return ids.indexOf(x) === -1; })) p.push(L + ': pick from the choices');
        break;
      case 'yesno':
        if (typeof v !== 'boolean') p.push(L + ': yes or no');
        break;
      case 'date':
        if (!isYmd(v)) p.push(L + ': pick a date');
        break;
      case 'path':
        if (!isSharePath(v)) p.push(L + ': a share path like \\\\server\\share\\... or Z:\\...');
        break;
    }
    return p;
  }

  /**
   * Check one list entry as it WOULD be after a save.
   * @param {string} collection  users | tools | measurement_types | tool_fields | bkms |
   *                             lot_fields | projects | part_numbers | buildups | process_steps |
   *                             priorities | holidays
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

      case 'lot_fields':
        if (!isStr(r.label)) p.push('Enter a label');
        else if (others(d.lot_fields, r.id).some(function (x) { return normalizeName(x.label) === normalizeName(r.label); })) p.push('There is already a lot field called ' + r.label);
        fieldDefProblems(r, p);
        break;

      case 'tool_fields':
        if (!exists('tools', r.tool_id)) p.push('Pick a tool');
        if (!isStr(r.label)) p.push('Enter a label');
        else if (others(d.tool_fields, r.id).some(function (x) { return x.tool_id === r.tool_id && normalizeName(x.label) === normalizeName(r.label); })) p.push('This tool already has a field called ' + r.label);
        fieldDefProblems(r, p);
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
        if (collection === 'buildups' && r.layers !== null && r.layers !== undefined && (!isNum(r.layers) || r.layers < 0 || r.layers > 20 || Math.floor(r.layers) !== r.layers)) {
          p.push('Build-up layers: empty, or a whole number 0-20');
        }
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

      case 'lots':
        if (!isLotNumber(r.lot_number)) p.push('Lot number: digits, a split lot adds .01 - e.g. 18178 or 18178.01');
        else if (dupBy(d.lots, r.id, 'lot_number', r.lot_number)) p.push('Lot ' + r.lot_number + ' is already registered');
        if (r.panel_count !== null && r.panel_count !== undefined &&
            (!isNum(r.panel_count) || r.panel_count < 1 || r.panel_count > LOT_MAX_PANELS || Math.floor(r.panel_count) !== r.panel_count)) {
          p.push('Panels: empty, or a whole number from 1 to ' + LOT_MAX_PANELS);
        }
        if (!exists('users', r.owner_id)) p.push('Lot owner not found');
        if (r.note && String(r.note).length > LOT_NOTE_MAX) p.push('Keep the note under ' + LOT_NOTE_MAX + ' characters');
        var ex = r.extra || {};
        (d.lot_fields || []).forEach(function (f) {
          if (f.active === false && isEmptyAnswer(ex[f.id])) return;
          p.push.apply(p, extraValueProblems(f, ex[f.id]));
        });
        Object.keys(ex).forEach(function (k) { if (!(d.lot_fields || []).some(function (f) { return f.id === k; })) p.push('Unknown lot field ' + k); });
        break;

      case 'magazines':
        if (!isMagazineCode(r.code)) p.push('Magazine: M and digits, e.g. M70345');
        else if (dupBy(d.magazines, r.id, 'code', r.code)) p.push(r.code + ' already exists');
        if (!isNum(r.slots) || r.slots < 1 || r.slots > 99 || Math.floor(r.slots) !== r.slots) p.push('Slots: a whole number, 1-99');
        break;

      case 'process_steps':
      case 'hold_reasons':
        if (!isStr(r.name)) p.push('Enter a name');
        else if (r.name.length > 60) p.push('Keep the name under 60 characters');
        else if (others(d[collection], r.id).some(function (x) { return normalizeName(x.name) === normalizeName(r.name); })) p.push(r.name + ' is already listed');
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
   * Working-time clock (Q36): lab days and hours, Europe/Vienna, minus
   * public holidays and closing days. Turnaround and lateness count only
   * this time; calendar time is kept too.
   * ------------------------------------------------------------------ */

  var offsetFmt = null;
  /** Minutes Vienna is ahead of UTC at a moment (60 in winter, 120 in summer). */
  function viennaOffsetMin(ts) {
    offsetFmt = offsetFmt || new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit' });
    var p = {};
    offsetFmt.formatToParts(new Date(ts)).forEach(function (x) { p[x.type] = x.value; });
    var local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
    return Math.round((local - Math.floor(ts / 60000) * 60000) / 60000);
  }

  var tsMemo = {};
  /** The moment of a Vienna wall-clock time, e.g. ('2026-10-02', '18:00'). */
  function viennaTs(ymd, hhmm) {
    var key = ymd + ' ' + hhmm;
    if (tsMemo[key] !== undefined) return tsMemo[key];
    var guess = Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10), +hhmm.slice(0, 2), +hhmm.slice(3, 5));
    var ts = guess - viennaOffsetMin(guess) * 60000;
    ts = guess - viennaOffsetMin(ts) * 60000;          // second pass: right across the clock change
    tsMemo[key] = ts;
    return ts;
  }

  /** 1 = Monday ... 7 = Sunday for a 'YYYY-MM-DD'. */
  function isoWeekday(ymd) { var d = new Date(ymd + 'T12:00:00Z').getUTCDay(); return d === 0 ? 7 : d; }

  function isLabDay(ymd, cal, holidaySet) { return (cal.days || []).indexOf(isoWeekday(ymd)) !== -1 && !holidaySet[ymd]; }

  /** {ymd: true} of the holidays and closing days. */
  function holidaySet(holidays) { var s = {}; (holidays || []).forEach(function (h) { s[h.date] = true; }); return s; }

  /** Lab (working) milliseconds between two moments. */
  function workingMs(fromTs, toTs, cal, hs) {
    if (!(toTs > fromTs)) return 0;
    var total = 0, ymd = viennaYmd(fromTs), last = viennaYmd(toTs);
    for (var guard = 0; ymd <= last && guard < 1500; guard++) {
      if (isLabDay(ymd, cal, hs)) {
        var s = viennaTs(ymd, cal.start), e = viennaTs(ymd, cal.end);
        total += Math.max(0, Math.min(e, toTs) - Math.max(s, fromTs));
      }
      ymd = addDaysYmd(ymd, 1);
    }
    return total;
  }

  /** Is the lab clock running right now (a lab day, inside lab hours)? */
  function isLabTime(ts, cal, hs) {
    var ymd = viennaYmd(ts);
    return isLabDay(ymd, cal, hs) && ts >= viennaTs(ymd, cal.start) && ts < viennaTs(ymd, cal.end);
  }

  /**
   * The needed-by countdown (Q10, Q36): due at the end of the lab day on the
   * needed-by date. Counts lab time; the clock pauses outside lab hours.
   * @returns {null | {late, lab_ms, due_ts, days, paused}}  days = calendar days to/over the date
   */
  function countdown(nowTs, neededYmd, cal, hs) {
    if (!neededYmd || !isYmd(neededYmd)) return null;
    var due = viennaTs(neededYmd, cal.end);
    var late = nowTs > due;
    var days = Math.round((Date.parse(neededYmd + 'T00:00:00Z') - Date.parse(viennaYmd(nowTs) + 'T00:00:00Z')) / 86400000);
    return { late: late, lab_ms: late ? workingMs(due, nowTs, cal, hs) : workingMs(nowTs, due, cal, hs), due_ts: due, days: days,
             paused: !isLabTime(nowTs, cal, hs) };
  }

  /* ------------------------------------------------------------------ *
   * Requests (Q4-Q14, Q29, Q33, Q44, DECISIONS M2-4..M2-17)
   * ------------------------------------------------------------------ */

  /** Workflow (Q9). Draft is private; the rest are shared. */
  var REQUEST_STATUSES = ['draft', 'submitted', 'accepted', 'in_progress', 'completed', 'clarification', 'on_hold', 'cancelled'];
  var REQUEST_STATUS_LABEL = {
    draft: 'Draft', submitted: 'Submitted', accepted: 'Accepted', in_progress: 'In progress', completed: 'Completed',
    clarification: 'Needs clarification', on_hold: 'On hold', cancelled: 'Cancelled'
  };
  /** Where the panels go after measuring (M2-12). */
  var AFTER_OPTIONS = ['back_to_me', 'back_to_line', 'scrap', 'other'];
  var AFTER_LABEL = { back_to_me: 'Back to me', back_to_line: 'Back to the line', scrap: 'Lab may scrap them', other: 'Other' };
  var REQUEST_TEXT_MAX = 2000;

  /** Engineers request measurements (Q17); admins too. */
  function canRequest(user) { return hasRole(user, 'engineer') || hasRole(user, 'admin'); }

  /** A draft is its author's alone (Q33). */
  function canSeeRequest(user, r) { return !!user && !!r && (r.status !== 'draft' || r.requester_id === user.id); }
  function canEditDraft(user, r) { return !!user && !!r && r.status === 'draft' && r.requester_id === user.id; }

  var OPEN_STATUSES = ['submitted', 'accepted', 'in_progress', 'clarification', 'on_hold'];
  function isOpen(r) { return !!r && OPEN_STATUSES.indexOf(r.status) !== -1; }

  /** Everyone who can see a submitted request may comment (Q11). */
  function canComment(user, r) { return canSeeRequest(user, r) && r.status !== 'draft'; }

  /** The tool's primary / backup (quality engineers) - they measure it (M1-12). */
  function isToolMeasurer(user, tool) {
    return !!user && !!tool && canMeasure(user) && (tool.primary_operator_id === user.id || tool.backup_operator_id === user.id);
  }

  /** Cancel (Q35): the requester any time, the tool's quality engineers and admins with a reason - while open. */
  function canCancel(user, r, tool) {
    if (!user || !isOpen(r)) return false;
    return r.requester_id === user.id || hasRole(user, 'admin') || isToolMeasurer(user, tool);
  }

  /*
   * Workflow actions (Q9, Q43, DECISIONS M3-1..M3-9) - the ONE table of who
   * may move a request where. "measurer": the tool's primary/backup quality
   * engineer or an admin. "requester": the one who asked, or an admin.
   * back: true = returns to the status it had before (return_to).
   */
  var TRANSITIONS = {
    accept:   { label: 'Accept',              from: ['submitted'],                             to: 'accepted',      who: 'measurer' },
    start:    { label: 'Start',               from: ['submitted', 'accepted'],                 to: 'in_progress',   who: 'measurer' },
    hold:     { label: 'Hold',                from: ['submitted', 'accepted', 'in_progress'],  to: 'on_hold',       who: 'measurer' },
    resume:   { label: 'Resume',              from: ['on_hold'],                               back: true,          who: 'measurer' },
    clarify:  { label: 'Needs clarification', from: ['submitted', 'accepted', 'in_progress'],  to: 'clarification', who: 'measurer' },
    answer:   { label: 'Answered',            from: ['clarification'],                         back: true,          who: 'requester' },
    complete: { label: 'Complete',            from: ['in_progress'],                           to: 'completed',     who: 'measurer' },
    reopen:   { label: 'Reopen',              from: ['completed'],                             to: 'accepted',      who: 'requester' },
    results_ok: { label: 'Results OK',        from: ['completed'],                             to: 'completed',     who: 'requester' }
  };
  var PANEL_OUTCOMES = ['returned', 'scrapped', 'other'];
  var PANEL_OUTCOME_LABEL = { returned: 'Returned to the requester / line', scrapped: 'Scrapped', other: 'Other' };
  var CLOSE_AFTER_DAYS = 7;

  /** Completed and either marked Results OK or completed 7+ days ago (Q34). */
  function isClosed(r, nowTs) {
    if (!r || r.status !== 'completed') return false;
    if (r.results_ok_ts) return true;
    return !!r.completed_ts && nowTs - Date.parse(r.completed_ts) >= CLOSE_AFTER_DAYS * 86400000;
  }

  function isMeasurerOf(user, tool) { return hasRole(user, 'admin') || isToolMeasurer(user, tool); }

  /** May this person do this action on this request now? */
  function canAct(user, action, r, tool, nowTs) {
    var t = TRANSITIONS[action];
    if (!t || !user || !r || t.from.indexOf(r.status) === -1) return false;
    if ((action === 'reopen' || action === 'results_ok') && isClosed(r, nowTs || 0)) return false;
    if (action === 'results_ok' && r.results_ok_ts) return false;
    if (t.who === 'measurer') return isMeasurerOf(user, tool);
    return r.requester_id === user.id || hasRole(user, 'admin');
  }

  /** The actions a person may take now, in TRANSITIONS order. */
  function actionsFor(user, r, tool, nowTs) {
    return Object.keys(TRANSITIONS).filter(function (a) { return canAct(user, a, r, tool, nowTs); });
  }

  /** Panels received (Q25): the tool's quality engineers, while open, once. */
  function canReceive(user, r, tool) { return isOpen(r) && !r.received_ts && isMeasurerOf(user, tool); }

  /** "Take it" (M3-7): the tool's other quality engineer takes the request over. */
  function canTake(user, r, tool) { return isOpen(r) && isToolMeasurer(user, tool) && r.assigned_to !== user.id; }

  /** Edit a submitted request (Q14, M3-5): the requester or an admin, until Completed / Cancelled. */
  function canEditSubmitted(user, r) {
    return !!user && !!r && isOpen(r) && (r.requester_id === user.id || hasRole(user, 'admin'));
  }

  /**
   * Who gets a new request (M3-7): the primary, or the backup when the
   * primary is away that day. Both away (or no backup): the primary.
   * @returns {{id, note}}
   */
  function assignOnSubmit(tool, users, today) {
    function u(id) { return (users || []).filter(function (x) { return x.id === id; })[0] || null; }
    var p = u(tool && tool.primary_operator_id), b = u(tool && tool.backup_operator_id);
    if (p && isAway(p, today) && b && b.active !== false && !isAway(b, today)) {
      return { id: b.id, note: p.name + ' is away - assigned to the backup, ' + b.name };
    }
    return { id: p ? p.id : (b ? b.id : null), note: null };
  }

  /**
   * Check the data an action needs.
   * @param {string} action
   * @param {Object} x {expected_done, hold_reason_id, note, text, results_path, panels_outcome, received_where}
   * @param {Object} d data (hold_reasons)
   * @returns {string[]}
   */
  function actionProblems(action, x, d) {
    var p = [];
    x = x || {};
    if (action === 'accept' && x.expected_done && !isYmd(x.expected_done)) p.push('"Expected done" must be a date');
    if (action === 'hold') {
      if (!(d.hold_reasons || []).some(function (h) { return h.id === x.hold_reason_id; })) p.push('Pick why it is on hold');
    }
    if ((action === 'clarify' || action === 'answer') && !isStr(x.text)) p.push(action === 'clarify' ? 'Say what is missing' : 'Write your answer');
    if (action === 'reopen' && !isStr(x.text)) p.push('Say why the results are not OK');
    if (action === 'complete') {
      if (!isSharePath(x.results_path)) p.push('Results folder: a share path like \\\\server\\share\\... or Z:\\...');
      if (PANEL_OUTCOMES.indexOf(x.panels_outcome) === -1) p.push('Say what happened to the panels');
      else if (x.panels_outcome === 'other' && !isStr(x.note)) p.push('Say what happened to the panels (Other)');
    }
    ['text', 'note', 'received_where'].forEach(function (k) { if (x[k] && String(x[k]).length > REQUEST_TEXT_MAX) p.push('Text too long'); });
    return p;
  }

  /**
   * Late: open, with a needed-by date whose lab day has ended (Q10, Q36).
   * On hold is never late - its clock is paused.
   */
  function isLate(r, nowTs, cal) {
    return isOpen(r) && r.status !== 'on_hold' && !!r.needed_by && isYmd(r.needed_by) && nowTs > viennaTs(r.needed_by, cal.end);
  }

  /**
   * The tools a person works (My queue, the alert strip): those where they are
   * primary or backup quality engineer; an admin without a tool of their own
   * sees all tools (M3-10).
   */
  function measuredTools(user, tools) {
    var mine = (tools || []).filter(function (t) { return t.active !== false && isToolMeasurer(user, t); });
    return mine.length || !hasRole(user, 'admin') ? mine : (tools || []).filter(function (t) { return t.active !== false; });
  }

  /**
   * The alert strip under the top bar (M1-2, M3 audit): whose requests it
   * counts - a quality engineer's (or admin's) tools, otherwise the person's
   * own requests - and the four counts. Each count is a filter of My queue
   * (tools) or My requests (own).
   * @param {Object} o {user, tools, requests, now_ts, cal, levelOf(r)}
   * @returns {{scope: 'tools'|'own', open, line_stop, late, on_hold, clarification}}
   */
  function stripCounts(o) {
    var tools = measuredTools(o.user, o.tools);
    var ids = tools.map(function (t) { return t.id; });
    var scope = ids.length ? 'tools' : 'own';
    var rows = (o.requests || []).filter(function (r) {
      return isOpen(r) && (scope === 'tools' ? ids.indexOf(r.tool_id) !== -1 : r.requester_id === (o.user && o.user.id));
    });
    return {
      scope: scope,
      open: rows.length,
      line_stop: rows.filter(function (r) { return o.levelOf(r) === 1; }).length,
      late: rows.filter(function (r) { return isLate(r, o.now_ts, o.cal); }).length,
      on_hold: rows.filter(function (r) { return r.status === 'on_hold'; }).length,
      clarification: rows.filter(function (r) { return r.status === 'clarification'; }).length
    };
  }

  /**
   * The queue order (DECISIONS M2-5): Line stop (level 1) always on top, then
   * late requests (most overdue first), then by needed-by (earliest first; on
   * the same date the more urgent priority first), then requests without a
   * date by priority, the longest waiting first.
   * @param {Object[]} list   requests
   * @param {Object} o        {now_ts, cal, levelOf(r) -> priority level (1 = most urgent)}
   * @returns {Object[]}      a sorted copy
   */
  function sortQueue(list, o) {
    function key(r) {
      var lvl = o.levelOf(r) || 99;
      var late = isLate(r, o.now_ts, o.cal);
      var due = r.needed_by && isYmd(r.needed_by) ? viennaTs(r.needed_by, o.cal.end) : null;
      return [lvl === 1 ? 0 : 1, late ? 0 : 1, late ? due : 0, due === null ? 1 : 0, due === null ? 0 : due, lvl, r.submitted_ts || r.created_ts || ''];
    }
    return (list || []).map(function (r) { return { r: r, k: key(r) }; }).sort(function (a, b) {
      for (var i = 0; i < a.k.length; i++) { if (a.k[i] !== b.k[i]) return a.k[i] < b.k[i] ? -1 : 1; }
      return 0;
    }).map(function (x) { return x.r; });
  }

  /**
   * A tool's queue on Lab status (Q46): open requests (and how many late),
   * the oldest open one, and the typical wait - the median lab time from
   * submit to start over the last 20 started requests.
   * @returns {{open, late, oldest: request|null, oldest_lab_ms, wait_ms: number|null, wait_n}}
   */
  function toolQueueStats(requests, toolId, nowTs, cal, hs) {
    var mine = (requests || []).filter(function (r) { return r.tool_id === toolId; });
    var open = mine.filter(isOpen);
    var oldest = open.slice().sort(function (a, b) { return a.submitted_ts < b.submitted_ts ? -1 : 1; })[0] || null;
    var started = mine.filter(function (r) { return r.started_ts && r.submitted_ts; })
      .sort(function (a, b) { return a.started_ts < b.started_ts ? 1 : -1; }).slice(0, 20)
      .map(function (r) { return workingMs(Date.parse(r.submitted_ts), Date.parse(r.started_ts), cal, hs); })
      .sort(function (a, b) { return a - b; });
    var mid = started.length ? (started.length % 2 ? started[(started.length - 1) / 2] : (started[started.length / 2 - 1] + started[started.length / 2]) / 2) : null;
    return { open: open.length, running: open.filter(function (r) { return r.status === 'in_progress'; }).length, late: open.filter(function (r) { return isLate(r, nowTs, cal); }).length, oldest: oldest,
             oldest_lab_ms: oldest ? workingMs(Date.parse(oldest.submitted_ts), nowTs, cal, hs) : 0, wait_ms: mid, wait_n: started.length };
  }

  /* ------------------------------------------------------------------ *
   * Analytics (M5, Q20, Q48, DECISIONS M5-1): pure maths on requests and
   * their timeline events. Durations in lab time (Q36) unless named
   * calendar; hold time kept apart (Q9); "on time" = completed by the end
   * of the lab day of the needed-by date (undated requests are not
   * counted). Moments are ms since 1970 (_ts), durations ms (_ms).
   * ------------------------------------------------------------------ */

  function numbers(xs) {
    return (xs || []).filter(function (x) { return typeof x === 'number' && isFinite(x); }).sort(function (p, q) { return p - q; });
  }

  /** Median (null when empty). */
  function median(xs) {
    var a = numbers(xs);
    if (!a.length) return null;
    return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
  }

  /** p-th percentile, nearest rank (p90 = percentile(xs, 90)); null when empty. */
  function percentile(xs, p) {
    var a = numbers(xs);
    if (!a.length) return null;
    return a[Math.min(a.length - 1, Math.max(0, Math.ceil(p / 100 * a.length) - 1))];
  }

  /** A request's status changes, oldest first: [{ts, from, to, text, hold_reason_id}]. */
  function statusChanges(requestId, events) {
    return (events || []).filter(function (e) { return e.request_id === requestId && e.kind === 'status'; })
      .map(function (e) { return { ts: Date.parse(e.ts), from: e.from, to: e.to, text: e.text || '', hold_reason_id: e.hold_reason_id || null }; })
      .sort(function (a, b) { return a.ts - b.ts; });
  }

  /** The status a request had at a moment; null before it was submitted. */
  function statusAt(changes, ts) {
    var st = null;
    for (var i = 0; i < changes.length && changes[i].ts <= ts; i++) st = changes[i].to;
    return st === 'draft' ? null : st;
  }

  /**
   * One request's times (M5-1):
   *   response_ms   submitted -> first Accept or Start (lab time)
   *   turnaround_ms submitted -> (last) Completed, lab time, hold taken out
   *   hold_ms       lab time On hold (to now while still on hold)
   *   calendar_ms   submitted -> completed, plain clock
   *   on_time       true/false when completed and dated, else null
   *   clarifications, reopens, holds [{ts, reason_id, reason_text}]
   */
  function requestTimes(r, events, cal, hs, nowTs) {
    var ch = statusChanges(r.id, events);
    var firstSub = ch.filter(function (c) { return c.to === 'submitted'; })[0];
    var sub = r.submitted_ts ? Date.parse(r.submitted_ts) : firstSub ? firstSub.ts : null;
    var out = { submitted_ts: sub, completed_ts: null, response_ms: null, turnaround_ms: null, hold_ms: 0,
                calendar_ms: null, on_time: null, clarifications: 0, reopens: 0, holds: [] };
    if (!sub) return out;
    var holdFrom = null;
    ch.forEach(function (c) {
      if (out.response_ms === null && (c.to === 'accepted' || c.to === 'in_progress')) out.response_ms = workingMs(sub, c.ts, cal, hs);
      if (holdFrom !== null && c.to !== 'on_hold') { out.hold_ms += workingMs(holdFrom, c.ts, cal, hs); holdFrom = null; }
      if (c.to === 'on_hold') { holdFrom = c.ts; out.holds.push({ ts: c.ts, reason_id: c.hold_reason_id, reason_text: c.text.split(':')[0] }); }
      if (c.to === 'clarification') out.clarifications++;
      if (c.from === 'completed' && c.to !== 'completed') { out.reopens++; out.completed_ts = null; }
      if (c.to === 'completed') out.completed_ts = c.ts;
    });
    if (holdFrom !== null) out.hold_ms += workingMs(holdFrom, nowTs, cal, hs);
    if (!out.completed_ts && r.status === 'completed' && r.completed_ts) out.completed_ts = Date.parse(r.completed_ts);
    if (out.completed_ts) {
      out.calendar_ms = out.completed_ts - sub;
      out.turnaround_ms = Math.max(0, workingMs(sub, out.completed_ts, cal, hs) - out.hold_ms);
      if (r.needed_by && isYmd(r.needed_by)) out.on_time = out.completed_ts <= viennaTs(r.needed_by, cal.end);
    }
    return out;
  }

  /** Is a moment inside a Vienna date range (inclusive; empty ends = open)? */
  function inDateRange(ts, fromYmd, toYmd) {
    if (ts === null || ts === undefined || isNaN(ts)) return false;
    var d = viennaYmd(ts);
    return (!fromYmd || d >= fromYmd) && (!toYmd || d <= toYmd);
  }

  /** 'YYYY-MM' of a moment in Vienna. */
  function viennaMonth(ts) { return viennaYmd(ts).slice(0, 7); }

  /** The Monday of the Vienna week of a moment ('YYYY-MM-DD'). */
  function viennaWeekStart(ts) { var d = viennaYmd(ts); return addDaysYmd(d, 1 - isoWeekday(d)); }

  function groupBy(rows, keyOf) {
    var g = {};
    rows.forEach(function (r) { var k = keyOf(r) || 'none'; (g[k] = g[k] || []).push(r); });
    return g;
  }

  /**
   * Everything the Analytics page shows, for one filter (M5-1, Q20):
   * @param {Object} d  the data (requests, request_events, holidays, hold_reasons)
   * @param {Object} f  {from_ymd, to_ymd, tool_id, project_id}
   * @param {Object} o  {now_ts, cal, levelOf(r)}
   * "Done" = COMPLETED in the range; demand = SUBMITTED in the range;
   * backlog = open requests at the end of each week (at most 26 weeks).
   */
  function analytics(d, f, o) {
    var cal = o.cal, hs = holidaySet(d.holidays), now = o.now_ts, ev = d.request_events || [];
    var all = (d.requests || []).filter(function (r) {
      return r.status !== 'draft' && (!f.tool_id || r.tool_id === f.tool_id) && (!f.project_id || r.project_id === f.project_id);
    });
    var times = {}, changes = {};
    all.forEach(function (r) { times[r.id] = requestTimes(r, ev, cal, hs, now); changes[r.id] = statusChanges(r.id, ev); });
    var submitted = all.filter(function (r) { return inDateRange(times[r.id].submitted_ts, f.from_ymd, f.to_ymd); });
    var done = all.filter(function (r) { return times[r.id].completed_ts && inDateRange(times[r.id].completed_ts, f.from_ymd, f.to_ymd); });
    var openNow = all.filter(isOpen);

    function tat(rows) {
      var dated = rows.filter(function (r) { return times[r.id].on_time !== null; });
      var ok = dated.filter(function (r) { return times[r.id].on_time; }).length;
      return { n: rows.length, ids: rows.map(function (r) { return r.id; }),
               median_ms: median(rows.map(function (r) { return times[r.id].turnaround_ms; })),
               p90_ms: percentile(rows.map(function (r) { return times[r.id].turnaround_ms; }), 90),
               hold_median_ms: median(rows.map(function (r) { return times[r.id].hold_ms; })),
               dated: dated.length, on_time: ok, on_time_pct: dated.length ? Math.round(ok / dated.length * 1000) / 10 : null };
    }
    function ids(rows) { return rows.map(function (r) { return r.id; }); }
    function counted(g) { return Object.keys(g).map(function (k) { return { key: k === 'none' ? null : k, n: g[k].length, ids: ids(g[k]) }; }).sort(function (a, b) { return b.n - a.n; }); }
    function clarRate(rows) {
      var c = rows.filter(function (r) { return times[r.id].clarifications > 0; }).length;
      return { n: rows.length, with_clarification: c, pct: rows.length ? Math.round(c / rows.length * 1000) / 10 : null,
               ids: ids(rows.filter(function (r) { return times[r.id].clarifications > 0; })) };
    }

    var weeks = [], wEnd = viennaTs(addDaysYmd(viennaWeekStart(now), 6), '23:59');
    var fromTs = f.from_ymd ? viennaTs(f.from_ymd, '00:00') : now - 90 * 86400000;
    for (var k = 0; k < 26 && wEnd >= fromTs; k++) { weeks.unshift(wEnd); wEnd -= 7 * 86400000; }
    var backlog = weeks.map(function (t) {
      var at = Math.min(t, now);
      var open = all.filter(function (r) { var s = statusAt(changes[r.id], at); return !!s && OPEN_STATUSES.indexOf(s) !== -1; });
      return { week: viennaWeekStart(at), open: open.length, ids: ids(open), by_tool: counted(groupBy(open, function (r) { return r.tool_id; })) };
    });

    var holdCount = {}, holdIds = {};
    all.forEach(function (r) {
      times[r.id].holds.forEach(function (h) {
        if (!inDateRange(h.ts, f.from_ymd, f.to_ymd)) return;
        var id = h.reason_id || ((d.hold_reasons || []).filter(function (x) { return x.name === h.reason_text; })[0] || {}).id || 'other';
        holdCount[id] = (holdCount[id] || 0) + 1;
        (holdIds[id] = holdIds[id] || []).indexOf(r.id) === -1 && holdIds[id].push(r.id);
      });
    });

    var months = {};
    submitted.forEach(function (r) { var key = viennaMonth(times[r.id].submitted_ts) + '|' + (r.project_id || ''); (months[key] = months[key] || []).push(r.id); });
    var lineStop = submitted.filter(function (r) { return o.levelOf(r) === 1; });
    var ls = lineStop.map(function (r) { return times[r.id].response_ms; });
    var byToolDone = groupBy(done, function (r) { return r.tool_id; });
    var byToolSub = groupBy(submitted, function (r) { return r.tool_id; });
    var bkmKey = function (r) { return r.bkm_id || (r.bkm_path ? 'own' : 'none'); };
    var byBkm = groupBy(submitted, bkmKey);

    return {
      filter: f, times: times,
      counts: { submitted: submitted.length, done: done.length, open_now: openNow.length,
                late_now: openNow.filter(function (r) { return isLate(r, now, cal); }).length,
                on_hold_now: openNow.filter(function (r) { return r.status === 'on_hold'; }).length },
      turnaround: tat(done),
      turnaround_by_tool: Object.keys(byToolDone).map(function (id) { return Object.assign({ tool_id: id }, tat(byToolDone[id])); }),
      done_by_qe: counted(groupBy(done, function (r) { return r.completed_by; })),
      open_by_tool: counted(groupBy(openNow, function (r) { return r.tool_id; })),
      open_by_assignee: counted(groupBy(openNow, function (r) { return r.assigned_to; })),
      backlog: backlog,
      reopen: { n: done.length, reopened: done.filter(function (r) { return times[r.id].reopens > 0; }).length,
                ids: ids(done.filter(function (r) { return times[r.id].reopens > 0; })) },
      ids: { submitted: ids(submitted), done: ids(done), open_now: ids(openNow),
             late_now: ids(openNow.filter(function (r) { return isLate(r, now, cal); })),
             on_hold_now: ids(openNow.filter(function (r) { return r.status === 'on_hold'; })) },
      clarification_by_tool: Object.keys(byToolSub).map(function (id) { return Object.assign({ tool_id: id }, clarRate(byToolSub[id])); }),
      clarification_by_bkm: Object.keys(byBkm).map(function (id) { return Object.assign({ bkm_id: id }, clarRate(byBkm[id])); }),
      hold_reasons: Object.keys(holdCount).map(function (id) { return { reason_id: id === 'other' ? null : id, n: holdCount[id], ids: holdIds[id] }; })
        .sort(function (a, b) { return b.n - a.n; }),
      per_month_project: Object.keys(months).sort().map(function (key) {
        var p = key.split('|'); return { month: p[0], project_id: p[1] || null, n: months[key].length, ids: months[key] }; }),
      demand_by_tool: counted(byToolSub),
      line_stop: { n: lineStop.length, ids: ids(lineStop), response_median_ms: median(ls), response_p90_ms: percentile(ls, 90) }
    };
  }

  /* ------------------------------------------------------------------ *
   * Personal request templates (Q28, DECISIONS T-1..T-3): what stays the
   * same between similar requests - never the lot, panels, place, dates or
   * the priority reason. A template whose parts were hidden since still
   * works: the missing parts are left empty with a note (T-3).
   * ------------------------------------------------------------------ */

  var TEMPLATE_FIELDS = ['tool_id', 'type_id', 'bkm_id', 'bkm_path', 'project_id', 'part_number_id', 'buildup_id', 'layers',
                         'after', 'after_other', 'priority_id', 'purpose', 'extra'];
  var TEMPLATE_NAME_MAX = 60;

  /** The template part of a request or draft: TEMPLATE_FIELDS only, copied. */
  function templateFieldsOf(r) {
    var out = {};
    TEMPLATE_FIELDS.forEach(function (k) {
      var v = r ? r[k] : undefined;
      out[k] = v === undefined ? (k === 'layers' ? [] : k === 'extra' ? {} : null) : JSON.parse(JSON.stringify(v));
    });
    return out;
  }

  /** A template name: 1-60 characters, unique among one person's templates. */
  function templateNameProblems(name, others) {
    var n = trim(name);
    if (!n) return ['Give the template a name'];
    if (n.length > TEMPLATE_NAME_MAX) return ['Keep the name under ' + TEMPLATE_NAME_MAX + ' characters'];
    if ((others || []).some(function (t) { return normalizeName(t.name) === normalizeName(n); })) return ['You have a template called "' + n + '" already'];
    return [];
  }

  /**
   * Can this template be started today, and with what (T-3)?
   * @returns {{usable, reason, fields, notes: string[]}} - fields with every
   *   part that is no longer available left empty; notes say what was dropped
   */
  function templateCheck(t, d) {
    var f = templateFieldsOf(t && t.fields), notes = [];
    function row(coll, id) { return id ? (d[coll] || []).filter(function (x) { return x.id === id; })[0] || null : null; }
    function live(x) { return !!x && x.active !== false; }
    var tool = row('tools', f.tool_id);
    if (!live(tool)) return { usable: false, reason: 'Its tool is no longer in use', fields: f, notes: [] };
    function drop(key, text) { if (f[key]) { f[key] = key === 'layers' ? [] : null; notes.push(text); } }
    var type = row('measurement_types', f.type_id);
    if (f.type_id && (!live(type) || type.tool_id !== tool.id)) drop('type_id', 'The measurement type of this template is hidden - pick another');
    var bkm = row('bkms', f.bkm_id);
    if (f.bkm_id && (!live(bkm) || bkm.tool_id !== tool.id)) drop('bkm_id', 'The BKM of this template is hidden - pick another');
    if (f.project_id && !live(row('projects', f.project_id))) { drop('project_id', 'The project of this template is hidden - pick another'); f.part_number_id = null; }
    var pn = row('part_numbers', f.part_number_id);
    if (f.part_number_id && (!live(pn) || (f.project_id && (pn.project_ids || []).indexOf(f.project_id) === -1))) drop('part_number_id', 'The part number of this template is hidden - pick another');
    var bu = row('buildups', f.buildup_id);
    if (f.buildup_id && !live(bu)) drop('buildup_id', 'The build-up of this template is hidden - pick another');
    var allowed = layersFor(f.buildup_id ? bu : null);
    var keptLayers = (f.layers || []).filter(function (x) { return allowed.indexOf(x) !== -1; });
    if (keptLayers.length !== (f.layers || []).length) { f.layers = keptLayers; notes.push('Some layers of this template do not exist in its build-up any more'); }
    if (f.priority_id && !live(row('priorities', f.priority_id))) drop('priority_id', 'The priority of this template is hidden - the default is used');
    var extra = {};
    Object.keys(f.extra || {}).forEach(function (fid) {
      var fld = row('tool_fields', fid);
      if (live(fld) && fld.tool_id === tool.id) extra[fid] = f.extra[fid];
      else notes.push('An extra field of this template is hidden');
    });
    f.extra = extra;
    return { usable: true, reason: null, fields: f, notes: notes.filter(function (x, i, a) { return a.indexOf(x) === i; }) };
  }

  /** A draft untouched for 30+ days - flagged for cleanup (Q33). */
  var OLD_DRAFT_DAYS = 30;
  function isOldDraft(r, nowTs) {
    var t = r && r.status === 'draft' ? Date.parse(r.updated_ts || r.created_ts) : NaN;
    return !isNaN(t) && nowTs - t >= OLD_DRAFT_DAYS * 86400000;
  }

  /**
   * The bell (Q19, DECISIONS M4-1): what this person should hear about,
   * newest first - never their own actions.
   *   requester: status changes, comments, edits, assignment notes on their requests
   *   the tool's quality engineers: new requests, edits, answers, reopen, cancel,
   *     comments, requests assigned to them
   *   anyone @mentioned in a comment
   *   admins: people who added themselves (M1-5)
   * @param {Object} user
   * @param {Object} d      the data
   * @param {Object} o      {since_ts: only events after this (ms), limit}
   * @returns {{id, ts, request_id, text, kind, mention}[]}
   */
  function notificationsFor(user, d, o) {
    if (!user) return [];
    o = o || {};
    var since = o.since_ts || 0;
    var reqs = {}, tools = {}, users = {};
    (d.requests || []).forEach(function (r) { reqs[r.id] = r; });
    (d.tools || []).forEach(function (t) { tools[t.id] = t; });
    (d.users || []).forEach(function (u) { users[u.id] = u; });
    function name(id) { return users[id] ? users[id].name : 'Someone'; }
    var out = [];
    (d.request_events || []).forEach(function (e) {
      if (e.user_id === user.id || Date.parse(e.ts) <= since) return;
      var r = reqs[e.request_id];
      if (!r || r.status === 'draft' || !r.request_no) return;
      var mine = r.requester_id === user.id;
      var measurer = isToolMeasurer(user, tools[r.tool_id]);
      var mention = e.kind === 'comment' && (e.mentions || []).indexOf(user.id) !== -1;
      var text = null;
      if (e.kind === 'comment' && (mine || measurer || mention)) {
        text = name(e.user_id) + (mention ? ' mentioned you on ' : ' commented on ') + r.request_no + ': "' + String(e.text).slice(0, 80) + (String(e.text).length > 80 ? '...' : '') + '"';
      } else if (e.kind === 'status') {
        if (e.from === 'draft' && measurer) text = 'New request ' + r.request_no + ' from ' + name(e.user_id);
        else if (e.from !== 'draft' && (mine || measurer)) text = r.request_no + ': ' + REQUEST_STATUS_LABEL[e.to] + ' - ' + name(e.user_id) + (e.text ? ' (' + String(e.text).slice(0, 60) + ')' : '');
      } else if (e.kind === 'edit' && (mine || measurer)) text = r.request_no + ' was changed by ' + name(e.user_id);
      else if (e.kind === 'results_ok' && measurer) text = r.request_no + ': results OK - ' + name(e.user_id);
      else if (e.kind === 'assign' && e.to === user.id) text = r.request_no + ' is assigned to you' + (e.text ? ' - ' + e.text : '');
      else if (e.kind === 'panels' && mine) text = r.request_no + ': panels received by the lab';
      if (text) out.push({ id: e.id, ts: e.ts, request_id: r.id, text: text, kind: e.kind, mention: mention });
    });
    if (hasRole(user, 'admin')) {
      (d.users || []).forEach(function (u) {
        if (u.self_added && u.needs_review && u.created_ts && Date.parse(u.created_ts) > since) {
          out.push({ id: 'usr:' + u.id, ts: u.created_ts, request_id: null, user_id: u.id, text: u.name + ' added themselves - check their roles', kind: 'user', mention: false });
        }
      });
    }
    out.sort(function (a, b) { return a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0; });
    return o.limit ? out.slice(0, o.limit) : out;
  }

  /** The start page for a person (Q16, M3-12): quality engineers -> My queue, engineers -> My requests, else Lab status. */
  function homeFor(user) { return canMeasure(user) ? 'queue' : hasRole(user, 'engineer') ? 'requests' : 'lab'; }

  /**
   * @mentions in a comment (Q11): "@Anna Berger" (full name) or "@aberger"
   * (Windows ID), case ignored. Returns the user IDs, each once.
   */
  function findMentions(text, users) {
    var t = ' ' + String(text || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
    var out = [];
    (users || []).forEach(function (u) {
      if (u.active === false) return;
      var names = [u.name && u.name.toLowerCase().replace(/\s+/g, ' '), u.windows_id].filter(Boolean);
      var hit = names.some(function (n) {
        var i = t.indexOf('@' + n);
        return i !== -1 && !/[a-z0-9._-]/.test(t.charAt(i + 1 + n.length));
      });
      if (hit && out.indexOf(u.id) === -1) out.push(u.id);
    });
    return out;
  }

  var COMMENT_MAX = 2000;

  /**
   * The request ID (Q29): TOOL-YYMMDD-NN, NN running per tool per day
   * (Europe/Vienna date of the submit). Never changes afterwards.
   * @param {string} toolCode  e.g. FIB
   * @param {string} ymd       submit day, 'YYYY-MM-DD'
   * @param {string[]} taken   request numbers that exist already
   */
  function nextRequestNo(toolCode, ymd, taken) {
    var prefix = toolCode + '-' + ymd.slice(2, 4) + ymd.slice(5, 7) + ymd.slice(8, 10) + '-';
    var max = 0;
    (taken || []).forEach(function (no) {
      if (typeof no === 'string' && no.indexOf(prefix) === 0) {
        var n = parseInt(no.slice(prefix.length), 10);
        if (n > max) max = n;
      }
    });
    var next = max + 1;
    return prefix + (next < 10 ? '0' + next : String(next));
  }

  /** The tool's extra fields that apply to a measurement type ("only for", Q5). */
  function fieldsForType(fields, toolId, typeId) {
    return (fields || []).filter(function (f) {
      return f.tool_id === toolId && (!f.type_ids || !f.type_ids.length || f.type_ids.indexOf(typeId) !== -1);
    });
  }

  /**
   * Problems of a request. A draft needs only its tool; a submit needs
   * everything (o.submit). Warnings (Q44) are separate - see submitWarnings.
   * @param {Object} r     the request as it would be saved
   * @param {Object} d     the data (tools, types, lots, ...)
   * @param {Object} o     {submit: bool}
   */
  function requestProblems(r, d, o) {
    var p = [];
    function byId(coll, id) { return id ? (d[coll] || []).filter(function (x) { return x.id === id; })[0] || null : null; }
    var tool = byId('tools', r.tool_id);
    if (!tool) { p.push('Pick a tool'); return p; }
    var submit = !!(o && o.submit);
    var type = byId('measurement_types', r.type_id);
    if (r.type_id && (!type || type.tool_id !== tool.id)) p.push('The measurement type belongs to another tool');
    var lot = byId('lots', r.lot_id);
    if (r.lot_id && !lot) p.push('Lot not found');
    var nl = r.new_lot;
    if (nl) {
      if (!isLotNumber(nl.lot_number)) p.push('Lot number: digits, a split lot adds .01 - e.g. 18178 or 18178.01');
      else if ((d.lots || []).some(function (x) { return x.lot_number === nl.lot_number; })) p.push('Lot ' + nl.lot_number + ' exists already - pick it');
    }
    // project, part number and build-up belong to the request, not the lot (F-6): a lot runs through every build-up
    if (r.project_id && !byId('projects', r.project_id)) p.push('Project not found');
    var pnR = byId('part_numbers', r.part_number_id);
    if (r.part_number_id && !pnR) p.push('Part number not found');
    else if (pnR && r.project_id && (pnR.project_ids || []).indexOf(r.project_id) === -1) p.push('Part number ' + pnR.code + ' does not belong to this project');
    if (r.buildup_id && !byId('buildups', r.buildup_id)) p.push('Build-up not found');
    if (r.panels && !Array.isArray(r.panels)) p.push('Panels must be a list');
    if ((r.panels || []).some(function (x) { return !isPanelId(x); })) p.push('Panels: Hirata IDs are digits, e.g. 3252');
    if ((r.panels || []).some(function (x, i, a) { return a.indexOf(x) !== i; })) p.push('A panel is listed twice');
    if (r.panel_count !== null && r.panel_count !== undefined && (!isNum(r.panel_count) || r.panel_count < 1 || r.panel_count > 99 || Math.floor(r.panel_count) !== r.panel_count)) p.push('How many panels: 1-99');
    var buLayers = layersFor(byId('buildups', r.buildup_id));
    if ((r.layers || []).some(function (x) { return buLayers.indexOf(x) === -1; })) p.push('A layer does not belong to this build-up');
    var magR = byId('magazines', r.magazine_id);
    if (r.magazine_id && !magR) p.push('Magazine not found');
    if ((r.slots || []).some(function (x) { return !isNum(x) || x < 1 || x > (magR ? magR.slots : 24) || Math.floor(x) !== x; })) p.push('Slots: 1-' + (magR ? magR.slots : 24));
    if ((r.slots || []).length && !r.magazine_id) p.push('Pick the magazine of the slots');
    var prio = byId('priorities', r.priority_id);
    if (r.priority_id && !prio) p.push('Priority not found');
    if (r.needed_by && !isYmd(r.needed_by)) p.push('"Needed by" must be a date');
    var bkm = byId('bkms', r.bkm_id);
    if (r.bkm_id && (!bkm || bkm.tool_id !== tool.id)) p.push('The BKM belongs to another tool');
    if (r.bkm_path && !isSharePath(r.bkm_path)) p.push('BKM path: a share path like \\\\server\\share\\... or Z:\\...');
    if (r.process_step_id && !byId('process_steps', r.process_step_id)) p.push('Process step not found');
    if (r.after && AFTER_OPTIONS.indexOf(r.after) === -1) p.push('Pick where the panels go afterwards');
    ['purpose', 'panel_location', 'priority_reason', 'after_other', 'process_step_other'].forEach(function (k) {
      if (r[k] && String(r[k]).length > REQUEST_TEXT_MAX) p.push('Text too long: ' + k);
    });
    var ex = r.extra || {};
    Object.keys(ex).forEach(function (k) { if (!(d.tool_fields || []).some(function (f) { return f.id === k && f.tool_id === tool.id; })) p.push('Unknown field ' + k); });
    if (!submit) return p;

    if (tool.active === false) p.push(tool.code + ' is no longer offered');
    if (!type) p.push('Pick the measurement type');
    if (!r.project_id) p.push('Pick the project');
    if (!lot && !nl) p.push('Pick or type the lot');
    if (!panelCountOf(r)) p.push('Give the panels: their Hirata IDs, or how many');
    var taken = r.magazine_id ? takenSlots(d.requests, r.magazine_id, r.id) : {};
    var clash = (r.slots || []).filter(function (x) { return taken[x]; });
    if (clash.length) p.push('Slot ' + clash.join(', ') + ' of this magazine ' + (clash.length > 1 ? 'are' : 'is') + ' taken by ' + taken[clash[0]]);
    var gone = lot ? (r.panels || []).filter(function (n) { return (lot.scrapped || []).indexOf(n) !== -1; }) : [];
    if (gone.length && !(o && o.allowScrapped)) p.push('Panel ' + gone.join(', ') + (gone.length > 1 ? ' are' : ' is') + ' scrapped');
    if (!prio) p.push('Pick a priority');
    else if (prio.needs_reason && !isStr(r.priority_reason)) p.push(prio.name + ' needs a reason');
    if (!bkm && !r.bkm_path && !isStr(r.purpose)) p.push('Without a BKM, the purpose must say what to measure');
    if (!(r.magazine_id && (r.slots || []).length) && !isStr(r.panel_location)) p.push('Say where the panels are now: the magazine slots, or a note');
    if (tool.destructive && r.destructive_ok !== true) p.push(tool.code + ' destroys the panels - tick that they may be scrapped');
    if (!r.after) p.push('Say where the panels go afterwards');
    else if (r.after === 'other' && !isStr(r.after_other)) p.push('Say where the panels go afterwards (Other)');
    if (tool.destructive && r.after && r.after !== 'scrap') p.push(tool.code + ' destroys the panels - they cannot come back');
    if (r.process_step_other && r.process_step_id) p.push('Pick a process step or type one, not both');
    fieldsForType(d.tool_fields, tool.id, r.type_id).forEach(function (f) {
      if (f.active === false && isEmptyAnswer(ex[f.id])) return;
      p.push.apply(p, extraValueProblems(f, ex[f.id]));
    });
    return p;
  }

  /**
   * Submit warnings (Q44) - shown, never blocking: the tool is Down or in
   * Maintenance (past the needed-by date, or with no date to compare); an open
   * request on the same lot, tool and a shared panel; no BKM (Q45).
   * @returns {{code, text}[]}
   */
  function submitWarnings(r, d) {
    var w = [];
    var tool = (d.tools || []).filter(function (t) { return t.id === r.tool_id; })[0];
    if (tool && tool.status !== 'up') {
      var label = TOOL_STATUS_LABEL[tool.status];
      if (!tool.status_until) w.push({ code: 'tool_down', text: tool.code + ' is ' + label + ' with no date when it is back' });
      else if (!r.needed_by || tool.status_until >= r.needed_by) {
        w.push({ code: 'tool_down', text: tool.code + ' is ' + label + ' until ' + tool.status_until + (r.needed_by ? ', not before your needed-by date ' + r.needed_by : '') });
      }
    }
    var open = OPEN_STATUSES;
    var dup = (d.requests || []).filter(function (x) {
      return x.id !== r.id && open.indexOf(x.status) !== -1 && x.lot_id === r.lot_id && x.tool_id === r.tool_id &&
        (x.panels || []).some(function (n) { return (r.panels || []).indexOf(n) !== -1; });
    })[0];
    if (dup) w.push({ code: 'duplicate', text: dup.request_no + ' is already open for this lot on ' + (tool ? tool.code : 'this tool') + ' with some of the same panels' });
    if (!r.bkm_id && !r.bkm_path) w.push({ code: 'no_bkm', text: 'No BKM - the quality engineer sees a "No BKM" badge and goes by your purpose' });
    return w;
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
    // In the order a new admin should work through it (first-day walkthrough, 2026-09-25):
    // 1 people and tools (without a quality engineer requests reach nobody), 2 the lab calendar
    // (the countdowns run on it), 3 the reference data people pick from, 4 a second admin.
    var out = [];
    var today = (o && o.today_ymd) || '1970-01-01';
    function add(code, text, tab, id, more) { out.push(Object.assign({ severity: 'todo', code: code, text: text, tab: tab, id: id || null }, more || {})); }
    var tools = (data.tools || []).filter(function (t) { return t.active !== false; });

    // 1 people and tools - one line per tool, saying what it still lacks
    var review = (data.users || []).filter(function (u) { return u.active && u.needs_review; });
    review.forEach(function (u) { add('user_review', u.name + ' added themselves - check their roles', 'users', u.id); });
    tools.forEach(function (t) {
      var miss = [];
      if (!t.primary_operator_id) miss.push('primary');
      if (!t.backup_operator_id) miss.push('backup');
      if (!t.results_root) miss.push('results_root');
      if (!(data.measurement_types || []).some(function (m) { return m.tool_id === t.id && m.active !== false; })) miss.push('types');
      if (!miss.length) return;
      var words = { primary: 'primary quality engineer', backup: 'backup quality engineer', results_root: 'results folder', types: 'measurement types' };
      add('tool_setup', t.code + ': no ' + miss.map(function (m) { return words[m]; }).join(', no '), 'tools', t.id, { missing: miss });
    });

    // 2 the lab calendar
    if (!(o && o.calendar_confirmed)) add('calendar_unconfirmed', 'Lab days and hours are not confirmed yet', 'calendar');
    var hol = data.holidays || [];
    if (!hol.some(function (h) { return h.kind === 'closing'; })) add('no_closing_days', 'No company closing days are listed (e.g. 24 and 31 December)', 'calendar');
    var nextYear = String(parseInt(today.slice(0, 4), 10) + 1);
    if (!hol.some(function (h) { return h.date.slice(0, 4) === nextYear; })) add('no_holidays_next_year', 'No holidays listed for ' + nextYear, 'calendar');

    // 3 the reference data people pick from
    var sTypes = (data.measurement_types || []).filter(function (m) { return m.sample; }).length;
    var sBkms = (data.bkms || []).filter(function (b) { return b.sample; }).length;
    var sFields = (data.tool_fields || []).filter(function (f) { return f.sample; }).length;
    if (sTypes) add('sample_types', sTypes + ' measurement type' + (sTypes === 1 ? ' is' : 's are') + ' still sample (made up) - check them with the engineers', 'tools');
    if (sBkms) add('sample_bkms', sBkms + ' BKM' + (sBkms === 1 ? ' is' : 's are') + ' still sample, with fake paths - replace them with the real ones', 'tools');
    if (sFields) add('sample_fields', sFields + ' extra field' + (sFields === 1 ? ' is' : 's are') + ' still sample', 'tools');
    var sMags = (data.magazines || []).filter(function (m) { return m.sample; }).length;
    if (sMags) add('sample_magazines', sMags + ' magazine' + (sMags === 1 ? ' is a' : 's are') + ' sample number' + (sMags === 1 ? '' : 's') + ' (M70345 ...) - enter the real magazine numbers', 'lists');
    if (!(data.process_steps || []).some(function (x) { return x.active !== false; })) {
      add('no_process_steps', 'No process steps yet - requests say which step the panels are at', 'lists');
    }
    if (!(data.part_numbers || []).some(function (x) { return x.active !== false; })) {
      add('no_part_numbers', 'No part numbers yet - requests pick one of their project\'s (optional)', 'lists');
    }
    var sLotF = (data.lot_fields || []).filter(function (f) { return f.sample; }).length;
    if (sLotF) add('sample_lot_fields', sLotF + ' lot field' + (sLotF === 1 ? ' is' : 's are') + ' still sample (first ideas) - check them with the team', 'lists');
    var sLots = (data.lots || []).filter(function (l) { return l.sample; }).length;
    if (sLots) add('sample_lots', sLots + ' sample lot' + (sLots === 1 ? ' is' : 's are') + ' still there - delete them on the Lots page before real use', 'lots');

    // 4 a second admin
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
    var pns = byIdMap(data.part_numbers), bus = byIdMap(data.buildups);
    (data.requests || []).forEach(function (r) {
      var no = r.request_no || 'A draft';
      if (r.project_id && !projects[r.project_id]) add('problem', 'req_bad_project', no + ': its project no longer exists', 'request', r.id);
      if (r.buildup_id && !bus[r.buildup_id]) add('problem', 'req_bad_buildup', no + ': its build-up no longer exists', 'request', r.id);
      if (r.part_number_id && !pns[r.part_number_id]) add('problem', 'req_bad_pn', no + ': its part number no longer exists', 'request', r.id);
    });
    if (!(data.magazines || []).some(function (m) { return m.active !== false; })) {
      add('warning', 'no_magazines', 'No magazines: the request form cannot offer any - add them in Settings > Lists, or "Add the sample magazines" in Settings > Data', 'lists', null);
    }
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
    var sample = (data.measurement_types || []).concat(data.bkms || [], data.tool_fields || [], data.magazines || []).filter(function (x) { return x.sample; }).length;
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
    isLotNumber: isLotNumber,
    isPanelId: isPanelId,
    parsePanelIds: parsePanelIds,
    HIRATA_WEIGHTS: HIRATA_WEIGHTS,
    HIRATA_MAX: HIRATA_MAX,
    HIRATA_FIELDS: HIRATA_FIELDS,
    HIRATA_LENGTH: HIRATA_LENGTH,
    HIRATA_TAIL: HIRATA_TAIL,
    hirataDots: hirataDots,
    hirataDigit: hirataDigit,
    hirataCanSet: hirataCanSet,
    hirataFields: hirataFields,
    hirataCheck: hirataCheck,
    hirataList: hirataList,
    panelsText: panelsText,
    panelCountOf: panelCountOf,
    buildupLayers: buildupLayers,
    layersFor: layersFor,
    placeText: placeText,
    takenSlots: takenSlots,
    isMagazineCode: isMagazineCode,
    parseLotNumbers: parseLotNumbers,
    viennaTs: viennaTs,
    isoWeekday: isoWeekday,
    holidaySet: holidaySet,
    workingMs: workingMs,
    isLabTime: isLabTime,
    countdown: countdown,
    REQUEST_STATUSES: REQUEST_STATUSES,
    REQUEST_STATUS_LABEL: REQUEST_STATUS_LABEL,
    AFTER_OPTIONS: AFTER_OPTIONS,
    AFTER_LABEL: AFTER_LABEL,
    canRequest: canRequest,
    canSeeRequest: canSeeRequest,
    canEditDraft: canEditDraft,
    OPEN_STATUSES: OPEN_STATUSES,
    isOpen: isOpen,
    canComment: canComment,
    canCancel: canCancel,
    isToolMeasurer: isToolMeasurer,
    findMentions: findMentions,
    TRANSITIONS: TRANSITIONS,
    isLate: isLate,
    TEMPLATE_FIELDS: TEMPLATE_FIELDS,
    templateFieldsOf: templateFieldsOf,
    templateNameProblems: templateNameProblems,
    templateCheck: templateCheck,
    median: median,
    percentile: percentile,
    statusChanges: statusChanges,
    statusAt: statusAt,
    requestTimes: requestTimes,
    inDateRange: inDateRange,
    viennaMonth: viennaMonth,
    viennaWeekStart: viennaWeekStart,
    analytics: analytics,
    measuredTools: measuredTools,
    stripCounts: stripCounts,
    sortQueue: sortQueue,
    toolQueueStats: toolQueueStats,
    isOldDraft: isOldDraft,
    notificationsFor: notificationsFor,
    homeFor: homeFor,
    PANEL_OUTCOMES: PANEL_OUTCOMES,
    PANEL_OUTCOME_LABEL: PANEL_OUTCOME_LABEL,
    isClosed: isClosed,
    canAct: canAct,
    actionsFor: actionsFor,
    canReceive: canReceive,
    canTake: canTake,
    canEditSubmitted: canEditSubmitted,
    assignOnSubmit: assignOnSubmit,
    actionProblems: actionProblems,
    COMMENT_MAX: COMMENT_MAX,
    nextRequestNo: nextRequestNo,
    fieldsForType: fieldsForType,
    requestProblems: requestProblems,
    submitWarnings: submitWarnings,
    parsePanels: parsePanels,
    extraValueProblems: extraValueProblems,
    isEmptyAnswer: isEmptyAnswer,
    formatPanels: formatPanels,
    LOT_MAX_PANELS: LOT_MAX_PANELS,
    canRegisterLot: canRegisterLot,
    canEditLot: canEditLot,
    isSharePath: isSharePath,
    validateEntry: validateEntry,
    validatePriorities: validatePriorities,
    setupTodo: setupTodo,
    healthIssues: healthIssues
  };
})();
