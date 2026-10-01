/**
 * Metrology Request Tracker - prf.js
 *
 * PRF data (DECISIONS in OPEN_QUESTIONS / PRF notes): a port of PRF_Insight.py
 * (the reference, never changed). Pure rules only - no DOM, no store, no
 * Date.now(), no file access. The folder adapter reads files; the view calls
 * these functions. Every rule below names the line of PRF_Insight.py it copies
 * ("py 377") so numbers stay the same as the script's.
 *
 * Part 1: paths, file reading, parsing, unit labels, via split.
 */
window.MRT = window.MRT || {};
window.MRT.prf = (function () {
  'use strict';

  /* --- numbers (py: float(), round(), pandas mean/std/median) --------- */

  var FLOAT_RE = /^[+-]?(\d+(_\d+)*\.?(\d+(_\d+)*)?|\.\d+(_\d+)*)([eE][+-]?\d+)?$/;
  var SPECIAL_RE = /^[+-]?(nan|inf|infinity)$/i;

  /** Python float(text): null when it is not a number ('' is NOT 0). */
  function toFloat(s) {
    var t = String(s).trim();
    if (SPECIAL_RE.test(t)) {
      var low = t.toLowerCase().replace('+', '');
      return low.indexOf('nan') >= 0 ? NaN : (low.charAt(0) === '-' ? -Infinity : Infinity);
    }
    if (!FLOAT_RE.test(t) || t === '') return null;
    return Number(t.replace(/_/g, ''));
  }

  /** Python round(x, n) for the digits we use (NaN stays NaN). */
  function round(x, n) {
    if (typeof x !== 'number' || !isFinite(x)) return x;
    return Number(x.toFixed(n));
  }

  function isNum(x) { return typeof x === 'number' && !isNaN(x); }
  function finite(list) { return list.filter(isNum); }

  function mean(v) {
    if (!v.length) return NaN;
    var s = 0;
    for (var i = 0; i < v.length; i++) s += v[i];
    return s / v.length;
  }

  /** ddof 1 = pandas .std() (sample), ddof 0 = numpy/population. */
  function std(v, ddof) {
    if (v.length - ddof <= 0) return NaN;
    var m = mean(v), s = 0;
    for (var i = 0; i < v.length; i++) s += (v[i] - m) * (v[i] - m);
    return Math.sqrt(s / (v.length - ddof));
  }

  function median(v) {
    var a = v.slice().sort(function (x, y) { return x - y; }), n = a.length;
    if (!n) return NaN;
    return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
  }

  function minOf(v) { return v.length ? Math.min.apply(null, v) : NaN; }
  function maxOf(v) { return v.length ? Math.max.apply(null, v) : NaN; }

  /* --- build-up / panel / side / lot from a path (py 279-324) --------- */

  var BU_RE = /(?<![a-z])bu[\s_\-]*0*(\d+)(?!\d)/i;
  var PANEL_RE = /^\s*panel[\s_\-]*0*(\d+)(?!\d)/i;
  var SIDE_RE = /(?<![a-z])(front|back)(?![a-z])/ig;
  var LOT_RE = /^\d{5}(?:\.\d+)?$/;
  var ANCHOR_RE = /^(prf|bu[\s_\-]*0*\d+)$/i;

  /** 'BU-01' / 'BU01' / 'bu 1' -> 1, else null (py 282). */
  function buNumber(text) {
    var m = BU_RE.exec(String(text));
    return m ? parseInt(m[1], 10) : null;
  }

  function buLabel(n) { return n !== null && n !== undefined ? 'BU' + (n < 10 ? '0' : '') + n : ''; }

  /** {panels:[..], sides:['Front'|'Back']} found in folder names (py 296). */
  function panelSideFromPath(parts) {
    var panels = [], sides = [];
    parts.forEach(function (p) {
      var m = PANEL_RE.exec(p);
      if (m && panels.indexOf(parseInt(m[1], 10)) < 0) panels.push(parseInt(m[1], 10));
      var s, re = new RegExp(SIDE_RE.source, 'ig');
      while ((s = re.exec(p)) !== null) {
        var name = s[1].charAt(0).toUpperCase() + s[1].slice(1).toLowerCase();
        if (sides.indexOf(name) < 0) sides.push(name);
      }
    });
    return { panels: panels, sides: sides };
  }

  /**
   * <Project>\<Part>\<Lot> in a list of folder names (py 309).
   * -> {project, part, lot} | null | 'several'
   */
  function lotFromPath(parts) {
    var hits = [], i;
    parts.forEach(function (p, k) { if (LOT_RE.test(p.trim())) hits.push(k); });
    if (!hits.length) {
      var anchors = [];
      parts.forEach(function (p, k) { if (ANCHOR_RE.test(p.trim())) anchors.push(k); });
      if (!anchors.length || anchors[0] < 1) return null;
      hits = [anchors[0] - 1];
    }
    var seen = {};
    hits.forEach(function (k) { seen[parts[k].trim()] = true; });
    if (Object.keys(seen).length > 1) return 'several';
    i = hits[hits.length - 1];
    return { part: i >= 1 ? parts[i - 1].trim() : '', project: i >= 2 ? parts[i - 2].trim() : '', lot: parts[i].trim() };
  }

  /**
   * Group the log folders found under the root (py 327 index_log_folders).
   * rootName: name of the picked folder. logs: [{rel: [folder names from the
   * root down to the folder that CONTAINS 'log'], ref: text to show}].
   * The browser cannot see the path above the picked folder, so lot / part /
   * project are only read from the root's own name and below.
   * -> {index: {'lot|bu|panel|side': {lot,bu,panel,side,refs:[]}}, lots: {lot:{project,part}}, problems:[]}
   */
  function indexLogs(rootName, logs) {
    var index = {}, lots = {}, problems = [], rootParts = [rootName];
    logs.forEach(function (lg) {
      var rel = lg.rel.filter(function (x) { return x !== '.' && x !== ''; });
      var full = lg.ref;
      var ps = panelSideFromPath(rel), panels = ps.panels, sides = ps.sides;
      var rootPs = panelSideFromPath(rootParts);
      if (!panels.length) panels = rootPs.panels;
      if (!sides.length) sides = rootPs.sides;
      if (panels.length !== 1) { problems.push((panels.length ? 'Several' : 'No') + ' panel number in path, skipped: ' + full); return; }
      if (sides.length !== 1) { problems.push((sides.length ? 'Both' : 'No') + ' Front/Back in path, skipped: ' + full); return; }
      var bus = unique(rel.map(buNumber).filter(notNull));
      if (!bus.length) bus = unique(rootParts.map(buNumber).filter(notNull));
      if (bus.length > 1) { problems.push('Several buildups in path, skipped: ' + full); return; }
      var bu = bus.length ? bus[0] : null;
      var found = lotFromPath(rootParts.concat(rel)), lot = null;
      if (found === 'several') { problems.push('Several lot folders in path, skipped: ' + full); return; }
      if (found) {
        lot = found.lot;
        if (!lots[lot]) lots[lot] = { project: found.project, part: found.part };
      }
      var key = [lot, bu, panels[0], sides[0]].join('|');
      if (!index[key]) index[key] = { lot: lot, bu: bu, panel: panels[0], side: sides[0], refs: [] };
      index[key].refs.push(full);
    });
    return { index: index, lots: lots, problems: problems };
  }

  function notNull(x) { return x !== null && x !== undefined; }
  function unique(list) { return list.filter(function (x, i) { return list.indexOf(x) === i; }); }

  /** Last number in the file name, -1 if none (py 377). */
  function siteNumber(name) {
    var base = String(name).replace(/^.*[\\\/]/, '').replace(/\.[^.]*$/, '');
    var nums = base.match(/\d+/g);
    return nums ? parseInt(nums[nums.length - 1], 10) : -1;
  }

  /* --- reading and sorting files (py 385-451) ------------------------- */

  /**
   * Text -> lines the way py read_lines does: utf-8, bad bytes dropped (not
   * replaced), a BOM stays (python's utf-8 keeps it), splitlines().
   */
  function textToLines(text) {
    return String(text).replace(/\uFFFD/g, '').split(/\r\n|\r|\n|\v|\f|\x1c|\x1d|\x1e|\x85|\u2028|\u2029/)
      .filter(function (ln, i, all) { return !(i === all.length - 1 && ln === ''); });
  }

  /** Tab if the line has a tab, else comma; cells trimmed (py 390). */
  function splitLine(line) {
    var sep = line.indexOf('\t') >= 0 ? '\t' : ',';
    return line.split(sep).map(function (c) { return c.trim(); });
  }

  function nonEmpty(cells) { return cells.filter(function (c) { return c !== ''; }); }

  /** 'via' | 'roughness' | 'unknown' (py 395). */
  function classify(lines) {
    var text = lines.join('\n');
    if (text.indexOf('Diamond Area') >= 0 || /Index\s*[\t,]\s*CenterX/.test(text)) return 'via';
    for (var i = 0; i < lines.length; i++) {
      var cells = nonEmpty(splitLine(lines[i]));
      if (cells[0] === 'Ra' && cells[1] === 'Rq') return 'roughness';
    }
    return 'unknown';
  }

  var STOP_ROWS = ['Min', 'Max', 'Mean', 'SD', 'Var%'];

  /** Roughness table: {header, rows: [{Ra, Rq, ...}]} in the file's units (um) (py 413). */
  function parseRoughness(lines) {
    var header = null, rows = [];
    for (var i = 0; i < lines.length; i++) {
      var clean = nonEmpty(splitLine(lines[i]));
      if (header === null) {
        if (clean[0] === 'Ra' && clean[1] === 'Rq') header = clean;
        continue;
      }
      if (!clean.length) continue;
      if (STOP_ROWS.indexOf(clean[0]) >= 0) break;
      var vals = clean.map(toFloat);
      if (vals.length >= header.length && vals.slice(0, header.length).every(notNull)) {
        var row = {};
        header.forEach(function (h, k) { row[h] = vals[k]; });
        rows.push(row);
      }
    }
    if (header === null) throw new Error('roughness header not found');
    return { header: header, rows: rows };
  }

  /** Circle table: {header, rows: [{CenterX, MajorAxis, ...}]} (py 435). */
  function parseVia(lines) {
    var header = null, rows = [];
    for (var i = 0; i < lines.length; i++) {
      var cells = splitLine(lines[i]);
      if (header === null) {
        if (cells.length && cells[0] === 'Index' && cells.indexOf('CenterX') >= 0) header = nonEmpty(cells);
        continue;
      }
      if (!cells.length || !/^\d+$/.test(cells[0])) continue;
      var vals = nonEmpty(cells).map(toFloat);
      if (vals.length >= header.length) {
        var row = {};
        header.forEach(function (h, k) { row[h] = vals[k] === null ? NaN : vals[k]; });
        rows.push(row);
      }
    }
    if (header === null) throw new Error('via header not found');
    return { header: header, rows: rows };
  }

  /** A column the file must have; py raises KeyError('Rpv') (message "'Rpv'"). */
  function need(row, key) {
    if (!Object.prototype.hasOwnProperty.call(row, key)) throw new Error("'" + key + "'");
    return row[key];
  }

  /* --- unit labels and via split (py 208-230, 159-205, 610-641) ------- */

  /** '3' -> 'Unit', 'C1' -> 'Coupon' (py 208). */
  function unitType(label) { return /^-?\d+$/.test(String(label).trim()) ? 'Unit' : 'Coupon'; }

  /** Numbers stay numbers, coupons stay text (py 213). */
  function asLabel(label) {
    var t = String(label).trim();
    return /^-?\d+$/.test(t) ? parseInt(t, 10) : t;
  }

  /**
   * Typed units, order kept: '5,4,2,3,6' or '5 4 2 3 6' or 'C1 3'.
   * -> {units: [...labels], bad: [text that is not a unit]}
   */
  function parseUnits(text) {
    var units = [], bad = [];
    String(text || '').split(/[\s,;]+/).filter(Boolean).forEach(function (t) {
      if (/^[A-Za-z]*\d+$/.test(t)) units.push(asLabel(t)); else bad.push(t);
    });
    return { units: units, bad: bad };
  }

  /**
   * Via sequence (py 159-205). Text '3x3, 2x4, C1x5' or a list [[3,3],['C1',5]].
   * -> {items: [[label, count]], error: ''}  (items null when empty or wrong)
   */
  function parseSequence(seq) {
    var items = [], error = '';
    if (!seq || (Array.isArray(seq) && !seq.length)) return { items: null, error: '' };
    if (typeof seq === 'string') {
      var parts = seq.split(/[,;]/);
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i].trim();
        if (!part) continue;
        var m = /^([A-Za-z]*\d+)\s*[xX*]\s*(\d+)$/.exec(part);
        if (!m) return { items: null, error: 'Bad via sequence part "' + part + '". Expected e.g. 3x4. Sequence ignored.' };
        items.push([m[1], m[2]]);
      }
      if (!items.length) return { items: null, error: '' };
    } else {
      for (var j = 0; j < seq.length; j++) {
        if (!Array.isArray(seq[j]) || seq[j].length !== 2) return { items: null, error: 'Bad via sequence entry ' + JSON.stringify(seq[j]) + '. Sequence ignored.' };
        items.push(seq[j]);
      }
    }
    var out = [];
    for (var k = 0; k < items.length; k++) {
      var count = Number(items[k][1]);
      if (!/^\s*\d+\s*$/.test(String(items[k][1]))) return { items: null, error: 'Bad via count "' + items[k][1] + '". Sequence ignored.' };
      if (count < 1) return { items: null, error: 'Via count must be 1 or more (' + items[k][0] + '). Sequence ignored.' };
      out.push([String(items[k][0]).trim(), count]);
    }
    return { items: out, error: error };
  }

  /** '3x3, 2x4' text for a sequence list. */
  function sequenceText(items) { return (items || []).map(function (x) { return x[0] + 'x' + x[1]; }).join(', '); }

  /** [[unit, vias]] when vias per unit / coupon are set (py 601). */
  function countsFromDefaults(units, perUnit, perCoupon) {
    if (!perUnit || !units || !units.length) return null;
    var pc = perCoupon || perUnit;
    return units.map(function (u) { return [u, unitType(u) === 'Coupon' ? pc : perUnit]; });
  }

  /**
   * One [label, via number] per via file, in site order (py 610 via_labels).
   * -> {labels: [] (empty when it does not fit), messages: [{level, text}]}
   */
  function viaLabels(nFiles, units, sequence, counts) {
    var msgs = [], total, out = [];
    function lab(pairs) { return pairs.map(function (p) { return p[0] + ' x' + p[1]; }).join(', '); }
    function expand(pairs) {
      pairs.forEach(function (p) { for (var i = 0; i < p[1]; i++) out.push([p[0], i + 1]); });
      return out;
    }
    if (sequence) {
      total = sequence.reduce(function (n, p) { return n + p[1]; }, 0);
      if (total !== nFiles) {
        msgs.push({ level: 'ERROR', text: 'Via: sequence covers ' + total + ' files but ' + nFiles + ' via files found. T2B skipped.' });
        return { labels: [], messages: msgs };
      }
      msgs.push({ level: 'INFO', text: 'Via sequence: ' + lab(sequence) });
      return { labels: expand(sequence), messages: msgs };
    }
    if (counts) {
      total = counts.reduce(function (n, p) { return n + p[1]; }, 0);
      if (total !== nFiles) {
        msgs.push({ level: 'ERROR', text: 'Via: vias_per_unit/vias_per_coupon give ' + total + ' files but ' + nFiles + ' via files found. T2B skipped.' });
        return { labels: [], messages: msgs };
      }
      msgs.push({ level: 'INFO', text: 'Vias per unit: ' + lab(counts) });
      return { labels: expand(counts), messages: msgs };
    }
    var n = units.length;
    if (!n || nFiles % n !== 0) {
      msgs.push({ level: 'ERROR', text: 'Via: ' + nFiles + ' via files cannot be split evenly into ' + n + ' units. Use a via sequence, or correct the unit list. T2B skipped.' });
      return { labels: [], messages: msgs };
    }
    var per = nFiles / n;
    msgs.push({ level: 'INFO', text: nFiles + ' via files / ' + n + ' units = ' + per + ' vias per unit' });
    for (var k = 0; k < nFiles; k++) out.push([units[Math.floor(k / per)], k % per + 1]);
    return { labels: out, messages: msgs };
  }

  /** [1,2,3,7,9,10] -> '1-3, 7, 9-10' (py 457). */
  function compress(nums) {
    var out = [], a = nums.slice().sort(function (x, y) { return x - y; }), i = 0;
    while (i < a.length) {
      var j = i;
      while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
      out.push(i === j ? String(a[i]) : a[i] + '-' + a[j]);
      i = j + 1;
    }
    return out.join(', ');
  }

  return {
    toFloat: toFloat, round: round, isNum: isNum, finite: finite, mean: mean, std: std, median: median,
    minOf: minOf, maxOf: maxOf,
    buNumber: buNumber, buLabel: buLabel, panelSideFromPath: panelSideFromPath, lotFromPath: lotFromPath,
    indexLogs: indexLogs, siteNumber: siteNumber,
    textToLines: textToLines, splitLine: splitLine, classify: classify, parseRoughness: parseRoughness,
    parseVia: parseVia, need: need,
    unitType: unitType, asLabel: asLabel, parseUnits: parseUnits, parseSequence: parseSequence,
    sequenceText: sequenceText, countsFromDefaults: countsFromDefaults, viaLabels: viaLabels, compress: compress
  };
})();
