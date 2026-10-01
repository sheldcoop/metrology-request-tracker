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
  function indexLogs(rootName, logs, rootPath) {
    var index = {}, lots = {}, problems = [];
    // py root_parts = the FULL root path; the browser only knows the picked
    // folder's name, unless the person pasted its full path (rootPath).
    var rootParts = rootPath && rootPath.length ? rootPath : [rootName];
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

  /**
   * A pasted Windows path -> folder names: 'L:\a\b c\BU-01\' -> ['L:', 'a', 'b c', 'BU-01'].
   * Quotes around it (Explorer's "Copy as path") are dropped; / works too.
   */
  function splitPath(text) {
    return String(text || '').trim().replace(/^"+|"+$/g, '').split(/[\\\/]+/)
      .map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /** Does a pasted path end in the picked folder's name? (case-insensitive, like Windows) */
  function pathEndsWith(parts, name) {
    return !!parts.length && parts[parts.length - 1].toLowerCase() === String(name || '').trim().toLowerCase();
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

  /* =====================================================================
   * Part 2: roughness and via statistics, site checks, summary (py 454-805,
   * minus the Charts sheet - DECISIONS: no charts in the app).
   * ===================================================================== */

  /**
   * One roughness file -> {row, raw: [line rows]} (py 524 process_roughness,
   * called once per file; the caller loops files x labels together, same as
   * the script's zip(files, labels)).
   * meta: the row's lot/buildup/panel fields, copied in as-is.
   * cfg: {flagFactor, filterOutliers, nrSigma}.
   */
  function roughnessRow(lines, unit, pos, site, meta, side, cfg) {
    var df = parseRoughness(lines).rows;
    var rz = df.map(function (r) { return need(r, 'Rz'); });
    var medRz = median(rz);
    var flags = df.map(function (r) { return need(r, 'Rz') > cfg.flagFactor * medRz; });

    var used = df.map(function () { return true; });
    if (cfg.filterOutliers && df.length > 2) {
      var ra = df.map(function (r) { return need(r, 'Ra'); });
      var raM = mean(ra), raS = std(ra, 0), rzM = mean(rz), rzS = std(rz, 0);
      used = df.map(function (r, i) {
        var za = raS ? Math.abs((ra[i] - raM) / raS) : (ra[i] === raM ? 0 : Infinity);
        var zz = rzS ? Math.abs((rz[i] - rzM) / rzS) : (rz[i] === rzM ? 0 : Infinity);
        return za < cfg.nrSigma && zz < cfg.nrSigma;
      });
    }
    var kept = df.filter(function (r, i) { return used[i]; });

    var row = Object.assign({}, meta, { Side: side, Type: unitType(unit), Unit: asLabel(unit),
      Measurement_Position: pos, Site: site });
    ['Ra', 'Rz'].forEach(function (p) {
      var nm = kept.map(function (r) { return need(r, p) * 1000; });
      row[p + '_Mean_nm'] = round(mean(nm), 6);
      row[p + '_Std_nm'] = round(std(nm, 1), 6);
      row[p + '_Min_nm'] = round(minOf(nm), 6);
      row[p + '_Max_nm'] = round(maxOf(nm), 6);
    });
    row.Lines_Used = used.filter(Boolean).length;
    row.Lines_Flagged = flags.filter(Boolean).length;
    row.Flag = row.Lines_Flagged ? 'CHECK' : '';

    var raw = df.map(function (r, i) {
      return { Lot_Number: meta.Lot_Number, Buildup: meta.Buildup, Panel: meta.Panel, Side: side, Unit: unit,
        Measurement_Position: pos, Site: site, Line: i + 1,
        Ra_nm: round(need(r, 'Ra') * 1000, 6), Rq_nm: round(need(r, 'Rq') * 1000, 6),
        Rz_nm: round(need(r, 'Rz') * 1000, 6), Rpv_nm: round(need(r, 'Rpv') * 1000, 6),
        Rku: round(need(r, 'Rku'), 6), Used: used[i], Flag: flags[i] ? 'CHECK' : '' };
    });
    return { row: row, raw: raw, flagMessage: row.Flag ? ('Roughness site ' + site + ': ' + row.Lines_Flagged + ' spiky line(s). Row flagged.') : null };
  }

  /**
   * Roughness side -> {rows, raw, messages}. files: [{path, lines, site}]
   * sorted by site. (py 524: wraps file-count checks + the loop above.)
   */
  function processRoughness(files, units, positions, cfg, meta, side) {
    var msgs = [];
    var labels = [];
    units.forEach(function (u) { positions.forEach(function (p) { labels.push([u, p]); }); });
    if (!units.length) {
      msgs.push({ level: 'ERROR', text: 'Roughness: ' + files.length + ' files found but no roughness units set. Roughness skipped.' });
      return { rows: [], raw: [], messages: msgs };
    }
    if (files.length !== labels.length) {
      msgs.push({ level: 'ERROR', text: 'Roughness: ' + files.length + ' files but ' + units.length + ' units x ' + positions.length + ' positions = ' + labels.length + '. Roughness skipped.' });
      return { rows: [], raw: [], messages: msgs };
    }
    var rows = [], raw = [];
    files.forEach(function (f, i) {
      var out = roughnessRow(f.lines, labels[i][0], labels[i][1], f.site, meta, side, cfg);
      rows.push(out.row);
      raw = raw.concat(out.raw);
      if (out.flagMessage) msgs.push({ level: 'WARNING', text: out.flagMessage });
    });
    return { rows: rows, raw: raw, messages: msgs };
  }

  /** D (average diameter), roundness % (py 584 circle_values). */
  function circleValues(c) {
    var L = need(c, 'MajorAxis'), S = need(c, 'MinorAxis'), D = (L + S) / 2;
    var R = (1 - (L - S) / D) * 100;
    return { L: L, S: S, D: D, R: R };
  }

  /** One via file -> {row, raw} (py 644 process_via, one file at a time). */
  function viaRow(lines, label, viaNo, site, meta, side) {
    var df = parseVia(lines).rows.map(function (c) { return Object.assign({}, c, { D: circleValues(c).D }); });
    df.sort(function (a, b) { return b.D - a.D; });
    var n = df.length, unit = asLabel(label);
    var flag = n === 2 ? '' : n + ' circles';
    var top = n >= 1 ? df[0] : null, bot = n >= 2 ? df[n - 1] : null;

    var row = Object.assign({}, meta, { Side: side, Type: unitType(label), Unit: unit, Via: viaNo, Site: site });
    ['Average_Via_Depth_um', 'Bottom_Diameter_um', 'Top_Diameter_um', 'Bottom_Roundness_pct', 'Top_Roundness_pct',
     'Aspect_Ratio', 'Bottom_Top_Ratio_pct', 'Taper_um', 'Taper_Angle_deg', 'Wall_Angle_deg'].forEach(function (c) { row[c] = NaN; });

    if (top) {
      var t = circleValues(top);
      row.Top_Diameter_um = round(t.D, 6);
      row.Top_Roundness_pct = round(t.R, 6);
    }
    if (bot) {
      var b = circleValues(bot), depth = Math.abs(need(bot, 'AvgHeight'));
      row.Average_Via_Depth_um = round(depth, 6);
      row.Bottom_Diameter_um = round(b.D, 6);
      row.Bottom_Roundness_pct = round(b.R, 6);
      var tD = circleValues(top).D, taper = tD - b.D;
      row.Taper_um = round(taper, 6);
      row.Bottom_Top_Ratio_pct = round(b.D / tD * 100, 6);
      if (depth > 0) {
        row.Aspect_Ratio = round(depth / tD, 6);
        var ang = Math.atan(taper / (2 * depth)) * 180 / Math.PI;
        row.Taper_Angle_deg = round(ang, 6);
        row.Wall_Angle_deg = round(90 - ang, 6);
      }
    }
    row.Flag = flag;

    var raw = df.map(function (c, i) {
      var v = circleValues(c), ctype = i === 0 ? 'Top' : (i === n - 1 ? 'Bottom' : 'Extra');
      return { Lot_Number: meta.Lot_Number, Buildup: meta.Buildup, Panel: meta.Panel, Side: side, Type: unitType(label),
        Unit: unit, Via: viaNo, Site: site, Circle_Type: ctype, CenterX: need(c, 'CenterX'), CenterY: need(c, 'CenterY'),
        Long_Axis_um: v.L, Short_Axis_um: v.S, Diameter_um: round(v.D, 6), Roundness_pct: round(v.R, 6),
        AvgHeight_um: need(c, 'AvgHeight'), MinHeight_um: need(c, 'MinHeight'), MaxHeight_um: need(c, 'MaxHeight'), Flag: flag };
    });
    return { row: row, raw: raw, flagMessage: flag ? ('Site ' + site + ': ' + flag + ' (expected 2). Row flagged.') : null };
  }

  /** Via side -> {rows, raw, messages}. files: [{path, lines, site}] sorted by site (py 644). */
  function processVia(files, units, meta, side, sequence, counts) {
    var lab = viaLabels(files.length, units, sequence, counts);
    var msgs = lab.messages.slice();
    if (!lab.labels.length) return { rows: [], raw: [], messages: msgs };
    var rows = [], raw = [];
    files.forEach(function (f, i) {
      var out = viaRow(f.lines, lab.labels[i][0], lab.labels[i][1], f.site, meta, side);
      rows.push(out.row);
      raw = raw.concat(out.raw);
      if (out.flagMessage) msgs.push({ level: 'WARNING', text: out.flagMessage });
    });
    return { rows: rows, raw: raw, messages: msgs };
  }

  /* --- site checks (py 470 check_sites) -------------------------------- */

  /**
   * typed: [[site, 'R'|'V'|'?'], ...] sorted by site. n_pos: roughness
   * positions per unit. rUnits/vUnits: unit lists (block pattern size).
   * sequence: truthy skips the block-pattern check, same as the script.
   * -> [{level, text}]
   */
  function checkSites(typed, rUnits, vUnits, nPos, sequence) {
    var msgs = [];
    var sites = typed.map(function (t) { return t[0]; });

    var counts = {};
    sites.forEach(function (s) { counts[s] = (counts[s] || 0) + 1; });
    var dups = unique(sites.filter(function (s) { return counts[s] > 1; })).sort(function (a, b) { return a - b; });
    if (dups.length) msgs.push({ level: 'WARNING', text: 'Duplicate site numbers: ' + compress(dups) });

    if (sites.length && Math.max.apply(null, sites) > 0) {
      var top = Math.max.apply(null, sites), all = [];
      for (var i = 1; i <= top; i++) all.push(i);
      var missing = all.filter(function (s) { return sites.indexOf(s) < 0; });
      if (missing.length) msgs.push({ level: 'WARNING', text: 'Missing sites: ' + compress(missing) + ' (found ' + sites.length + ', highest site ' + top + ')' });
      else msgs.push({ level: 'INFO', text: 'Sites complete: 1-' + top });
    }

    var rSites = typed.filter(function (t) { return t[1] === 'R'; }).map(function (t) { return t[0]; });
    if (nPos > 1 && rSites.length && rSites.length % nPos === 0) {
      var bad = [];
      for (var k = 0; k < rSites.length; k += nPos) {
        var grp = rSites.slice(k, k + nPos);
        if (grp[grp.length - 1] - grp[0] !== nPos - 1) bad.push(grp.join('/'));
      }
      if (bad.length) msgs.push({ level: 'WARNING', text: 'Roughness sites not consecutive: ' + bad.join(', ') + '. Position labels may be wrong.' });
    }

    var n = rUnits.length;
    if (sequence) {
      msgs.push({ level: 'INFO', text: 'Site pattern check skipped (via sequence is uneven by design).' });
    } else if (n && n === vUnits.length && typed.length && typed.length % n === 0) {
      var size = typed.length / n;
      var pattern = function (b) { return typed.slice(b * size, (b + 1) * size).map(function (t) { return t[1]; }).join(''); };
      var ref = pattern(0), odd = [];
      for (var b = 0; b < n; b++) if (pattern(b) !== ref) odd.push(b);
      if (odd.length) {
        var txt = odd.map(function (b) { return 'block ' + (b + 1) + ' (sites ' + typed[b * size][0] + '-' + typed[(b + 1) * size - 1][0] + ') = ' + pattern(b); }).join('; ');
        msgs.push({ level: 'WARNING', text: 'Site pattern differs from block 1 (' + ref + '): ' + txt + '. Check for missing/extra files.' });
      } else {
        msgs.push({ level: 'INFO', text: 'Site pattern OK: ' + n + ' blocks of ' + ref + ' (V=via, R=roughness)' });
      }
    } else if (typed.length) {
      msgs.push({ level: 'INFO', text: 'Site pattern check skipped (unit counts or file count do not match blocks).' });
    }
    return msgs;
  }

  /* --- summary + spec limits (py 708-794) ------------------------------ */

  var SPEC_KEYS = {
    via_depth: ['T2B', 'Average_Via_Depth_um'], top_diameter: ['T2B', 'Top_Diameter_um'],
    bottom_diameter: ['T2B', 'Bottom_Diameter_um'], top_roundness: ['T2B', 'Top_Roundness_pct'],
    bottom_roundness: ['T2B', 'Bottom_Roundness_pct'], aspect_ratio: ['T2B', 'Aspect_Ratio'],
    bottom_top_ratio: ['T2B', 'Bottom_Top_Ratio_pct'], taper: ['T2B', 'Taper_um'],
    taper_angle: ['T2B', 'Taper_Angle_deg'], wall_angle: ['T2B', 'Wall_Angle_deg'],
    ra_mean: ['Roughness', 'Ra_Mean_nm'], rz_mean: ['Roughness', 'Rz_Mean_nm']
  };
  var SUMMARY_PARAMS = {
    T2B: ['Average_Via_Depth_um', 'Top_Diameter_um', 'Bottom_Diameter_um', 'Top_Roundness_pct', 'Bottom_Roundness_pct',
          'Aspect_Ratio', 'Bottom_Top_Ratio_pct', 'Taper_um', 'Taper_Angle_deg', 'Wall_Angle_deg'],
    Roughness: ['Ra_Mean_nm', 'Rz_Mean_nm']
  };
  var SPECIAL_NAMES = { Bottom_Top_Ratio_pct: 'Bottom/Top Ratio (%)' };
  var UNIT_SUFFIX = [['_um', ' (µm)'], ['_nm', ' (nm)'], ['_pct', ' (%)'], ['_deg', ' (°)']];

  /** Top_Diameter_um -> 'Top Diameter (µm)' (py 919 pretty). */
  function pretty(col) {
    if (SPECIAL_NAMES[col]) return SPECIAL_NAMES[col];
    for (var i = 0; i < UNIT_SUFFIX.length; i++) {
      var suf = UNIT_SUFFIX[i][0];
      if (col.slice(-suf.length) === suf) return col.slice(0, -suf.length).replace(/_/g, ' ') + UNIT_SUFFIX[i][1];
    }
    return col.replace(/_/g, ' ');
  }

  /**
   * {internal column: [lo, hi]} from spec_limits settings; unknown keys warn
   * (py 735 get_limits). limits: {key: [lo|null, hi|null]}.
   */
  function getLimits(limits) {
    var out = {}, msgs = [];
    Object.keys(limits || {}).forEach(function (key) {
      if (!SPEC_KEYS[key]) { msgs.push({ level: 'WARNING', text: 'Unknown spec limit "' + key + '" ignored.' }); return; }
      var v = limits[key];
      if (!Array.isArray(v) || v.length !== 2) { msgs.push({ level: 'WARNING', text: 'Spec limit "' + key + '" must be [min, max]. Ignored.' }); return; }
      var lo = v[0], hi = v[1];
      if (lo === null && hi === null) return;
      out[SPEC_KEYS[key][1]] = [lo, hi];
    });
    return { limits: out, messages: msgs };
  }

  function groupBy(rows, keyFn) {
    var order = [], map = {};
    rows.forEach(function (r) {
      var k = JSON.stringify(keyFn(r));
      if (!map[k]) { map[k] = []; order.push(k); }
      map[k].push(r);
    });
    return order.map(function (k) { return { key: JSON.parse(k), rows: map[k] }; });
  }

  /**
   * [{Lot_Number, Buildup, Panel, Side, Measurement, Parameter, N, Mean, Std,
   * Min, Max, LSL, USL, Result}] (py 752 build_summary). t2bRows/roughRows:
   * the per-site rows from processVia/processRoughness. limits: from getLimits.
   */
  function buildSummary(t2bRows, roughRows, limits) {
    var rows = [];
    [{ sheet: 'T2B', data: t2bRows, extra: [] }, { sheet: 'Roughness', data: roughRows, extra: ['Measurement_Position'] }]
      .forEach(function (src) {
        if (!src.data.length) return;
        var keys = ['Lot_Number', 'Buildup', 'Panel', 'Side'].concat(src.extra);
        groupBy(src.data, function (r) { return keys.map(function (k) { return r[k]; }); }).forEach(function (g) {
          SUMMARY_PARAMS[src.sheet].forEach(function (col) {
            var v = finite(g.rows.map(function (r) { return r[col]; }));
            if (!v.length) return;
            var lim = limits[col], lo = lim ? lim[0] : null, hi = lim ? lim[1] : null;
            var result = '';
            if (lim) {
              var okv = (lo === null || minOf(v) >= lo) && (hi === null || maxOf(v) <= hi);
              result = okv ? 'PASS' : 'FAIL';
            }
            rows.push({ Lot_Number: g.key[0], Buildup: g.key[1], Panel: g.key[2], Side: g.key[3],
              Measurement: src.sheet === 'T2B' ? 'Via (T2B)' : ('Roughness - ' + g.key[4]),
              Parameter: pretty(col), N: v.length, Mean: mean(v), Std: v.length > 1 ? std(v, 1) : 0,
              Min: minOf(v), Max: maxOf(v), LSL: lo, USL: hi, Result: result });
          });
        });
      });
    return rows;
  }

  /**
   * Front vs Back mean per panel / measurement / parameter (py 777
   * build_comparison). summary: rows from buildSummary.
   */
  function buildComparison(summary) {
    var sides = unique(summary.map(function (r) { return r.Side; }));
    if (!summary.length || sides.length < 2) return [];
    var byKey = {};
    summary.forEach(function (r) {
      var k = [r.Lot_Number, r.Buildup, r.Panel, r.Measurement, r.Parameter].join('\u0001');
      if (!byKey[k]) byKey[k] = { Lot_Number: r.Lot_Number, Buildup: r.Buildup, Panel: r.Panel, Measurement: r.Measurement, Parameter: r.Parameter };
      byKey[k][r.Side] = r.Mean;
    });
    var out = [];
    Object.keys(byKey).forEach(function (k) {
      var r = byKey[k];
      if (!notNull(r.Front) || !notNull(r.Back) || isNaN(r.Front) || isNaN(r.Back)) return;
      var diff = r.Back - r.Front;
      out.push({ Lot_Number: r.Lot_Number, Buildup: r.Buildup, Panel: r.Panel, Measurement: r.Measurement, Parameter: r.Parameter,
        'Front Mean': r.Front, 'Back Mean': r.Back, 'Difference (Back - Front)': diff,
        'Difference (%)': r.Front !== 0 ? diff / r.Front * 100 : NaN });
    });
    return out;
  }

  /* =====================================================================
   * Part 3: the Excel file name (py 929-962), status text (py 1341-1362).
   * ===================================================================== */

  /** '[^A-Za-z0-9-.]' stripped (py 948 output_path's "clean" lambda). */
  function cleanToken(s) { return String(s || '').replace(/[^A-Za-z0-9\-.]/g, ''); }

  /** ['a','b'] -> 'a-b'; more than n items -> 'first-last' (py 939 join_short). */
  function joinShort(items, n) {
    n = n || 3;
    var list = (items || []).map(String).filter(Boolean);
    if (!list.length) return '';
    return list.length <= n ? list.join('-') : list[0] + '-' + list[list.length - 1];
  }

  /** ['BU01','BU02'] -> 'BU01-02' (py 929 bu_text). */
  function buText(bus) {
    var list = unique((bus || []).filter(Boolean)).sort();
    if (!list.length) return '';
    if (list.length === 1) return list[0];
    return list[0] + '-' + list.slice(1).map(function (b) { return b.replace(/^BU/, ''); }).join('-');
  }

  /**
   * The Excel file name, without extension or a de-dupe suffix (py 947
   * output_path; the "does a file by this name already exist, add _2" loop
   * needs the output folder, so it stays in the adapter/view, not here).
   * o: {parts, lots, bus (labels), process, panels, flagged, dateYmd}
   */
  function buildOutputName(o) {
    var panels = (o.panels || []).slice().sort(function (a, b) { return a - b; });
    var ptxt = panels.length <= 4 ? panels.join('-') : panels[0] + '-' + panels[panels.length - 1];
    var name = 'PRF_' + (cleanToken(joinShort(o.parts)) || 'Part') + '_' + (cleanToken(joinShort(o.lots)) || 'Lot') + '_' +
      (cleanToken(buText(o.bus)) || 'BU') + '_' + cleanToken(String(o.process || '')).replace(/-/g, '') + '_P' + ptxt + '_' + o.dateYmd;
    return o.flagged ? name + '__INSPECT__' : name;
  }

  /**
   * Overall status text (py 1341 finish): 'OK' or the pipe-joined reasons.
   * o: {errors, flagged, specFail, siteWarn} (booleans, from the run's rows/log)
   */
  function runStatus(o) {
    var parts = [];
    if (o.errors) parts.push('ERRORS - see Log');
    if (o.flagged) parts.push('Flagged rows');
    if (o.specFail) parts.push('Out of spec');
    if (o.siteWarn) parts.push('Site warnings - see Log');
    return parts.length ? parts.join(' | ') : 'OK';
  }

  return {
    toFloat: toFloat, round: round, isNum: isNum, finite: finite, mean: mean, std: std, median: median,
    minOf: minOf, maxOf: maxOf,
    buNumber: buNumber, buLabel: buLabel, panelSideFromPath: panelSideFromPath, lotFromPath: lotFromPath,
    indexLogs: indexLogs, siteNumber: siteNumber, splitPath: splitPath, pathEndsWith: pathEndsWith,
    textToLines: textToLines, splitLine: splitLine, classify: classify, parseRoughness: parseRoughness,
    parseVia: parseVia, need: need,
    unitType: unitType, asLabel: asLabel, parseUnits: parseUnits, parseSequence: parseSequence,
    sequenceText: sequenceText, countsFromDefaults: countsFromDefaults, viaLabels: viaLabels, compress: compress,
    roughnessRow: roughnessRow, processRoughness: processRoughness, circleValues: circleValues,
    viaRow: viaRow, processVia: processVia, checkSites: checkSites,
    pretty: pretty, getLimits: getLimits, buildSummary: buildSummary, buildComparison: buildComparison,
    SPEC_KEYS: Object.keys(SPEC_KEYS),
    cleanToken: cleanToken, joinShort: joinShort, buText: buText, buildOutputName: buildOutputName, runStatus: runStatus
  };
})();
