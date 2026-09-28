/**
 * Metrology Request Tracker - excel-bridge.js
 *
 * Excel IS the app: one workbook (MRT Master) with one sheet per collection,
 * editable in Excel and uploadable back. The JSON file stays the source of
 * truth; this module only translates between the two. Views never touch XLSX
 * directly - they call this bridge, which builds plain row arrays and hands
 * them to exporter.js for writing.
 *
 * Keys the user sees (never the internal random ids):
 *   Requests  -> request_no ('HRM-260928-01'; drafts show '(draft)')
 *   every reference (tool, type, project, user, lot ...) -> code / name /
 *   windows_id / lot_number. The import side (step 3) resolves them back.
 */
window.MRT = window.MRT || {};
window.MRT.excelBridge = (function () {
  'use strict';

  var store = window.MRT.store;
  var exporter = window.MRT.exporter;
  var D = window.MRT.domain;

  /**
   * The 'meta' sheet: what file this is, and which store revision it came
   * from. Import refuses a workbook whose revision is older than the live
   * store (step 3) - edit a fresh export, never an old copy.
   */
  function metaRows() {
    var d = store.data(), st = store.status(), me = store.currentUser();
    return [
      ['MRT Master Excel - edit the rows, keep the headers and this sheet'],
      ['Exported (Vienna)', exporter.stamp(Date.now())],
      ['Revision', st.revision],
      ['Schema', d.schema_version],
      ['Exported by', me ? (me.name || '') : ''],
      ['Requests', (d.requests || []).length]
    ];
  }

  /** Stable order, so two exports of the same data diff cleanly. */
  function sortedRequests() {
    return (store.data().requests || []).slice().sort(function (a, b) {
      var x = a.request_no || '~~~', y = b.request_no || '~~~';
      return x < y ? -1 : x > y ? 1 : 0;
    });
  }

  /** Step 2: Requests + meta. Step 4: master lists as reference sheets (export
      only - the valid names for the Requests sheet; lists are curated in
      Settings, never bulk-rewritten from Excel). */
  function masterSheets() {
    return [
      { name: 'Requests', rows: exporter.requestRows(sortedRequests()) },
      { name: 'Tools', rows: toolRows() },
      { name: 'Measurement types', rows: typeRows() },
      { name: 'Priorities', rows: listRows('priorities', ['Name', 'Code', 'Level'], function (p) { return [p.name, p.code, p.level]; }) },
      { name: 'Projects', rows: listRows('projects', ['Code', 'Name'], function (p) { return [p.code, p.name || '-']; }) },
      { name: 'Build-ups', rows: listRows('buildups', ['Code', 'Name'], function (p) { return [p.code, p.name || '-']; }) },
      { name: 'BKM', rows: bkmRows() },
      { name: 'meta', rows: metaRows() }
    ];
  }

  function userName(id) { var u = id ? store.byId('users', id) : null; return u ? u.name : '-'; }
  function toolCode(id) { var t = id ? store.byId('tools', id) : null; return t ? t.code : '-'; }

  function listRows(coll, head, fn) {
    return [head].concat(store.list(coll, { all: true }).map(fn));
  }

  function toolRows() {
    return [['Code', 'Name', 'Status', 'Primary QE', 'Backup QE', 'Destructive']].concat(
      store.list('tools', { all: true }).map(function (t) {
        return [t.code, t.name, (window.MRT.domain.TOOL_STATUS_LABEL || {})[t.status] || t.status,
          userName(t.primary_operator_id), userName(t.backup_operator_id), t.destructive ? 'yes' : 'no'];
      }));
  }

  function typeRows() {
    return [['Tool', 'Name']].concat(store.list('measurement_types', { all: true }).map(function (m) {
      return [toolCode(m.tool_id), m.name];
    }));
  }

  function bkmRows() {
    return [['Tool', 'Measurement type', 'Name']].concat(store.list('bkms', { all: true }).map(function (b) {
      var m = b.type_id ? store.byId('measurement_types', b.type_id) : null;
      return [toolCode(b.tool_id), m ? m.name : '-', b.name];
    }));
  }

  /* --- import (step 3): Excel edits data fields only ------------------ */
  /* Status moves stay in the app (actions carry timestamps and side
     effects no sheet could); new requests are made in New Request. An
     emptied cell means "no change", never "clear", so a stray delete
     cannot wipe a date. Users, timeline, calendar and PINs are not
     sheets at all (the working split, 2026-09-28). */

  var EDITABLE = ['Priority', 'Assigned to', 'Needed by', 'Expected done', 'Purpose'];
  var FIELD_OF = { 'Priority': 'priority_id', 'Assigned to': 'assigned_to', 'Needed by': 'needed_by', 'Expected done': 'expected_done', 'Purpose': 'purpose' };

  function hasXlsx() { return typeof window.XLSX !== 'undefined' && !!window.XLSX.utils; }

  /** Raw bytes (FileReader, or XLSX.write in tests) -> {sheet name: rows}. */
  function workbookOf(bytes) {
    if (!hasXlsx()) throw new Error('Excel reading needs vendor/xlsx.full.min.js.');
    var wb = window.XLSX.read(bytes, { type: 'array', cellDates: true });
    var out = {};
    wb.SheetNames.forEach(function (n) {
      out[n] = window.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' });
    });
    return out;
  }

  /** A .xlsx file picked in the browser -> {sheet name: rows}. */
  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { try { resolve(workbookOf(fr.result)); } catch (e) { reject(e); } };
      fr.onerror = function () { reject(new Error('Could not read the file.')); };
      fr.readAsArrayBuffer(file);
    });
  }

  function str(v) { return String(v === null || v === undefined ? '' : v).trim(); }

  /** Whatever Excel made of a date cell -> 'YYYY-MM-DD', or null. */
  function toYmd(v) {
    if (v instanceof Date && !isNaN(v)) return Dated(v.getFullYear(), v.getMonth() + 1, v.getDate());
    if (typeof v === 'number' && isFinite(v) && hasXlsx()) {
      var p = window.XLSX.SSF.parse_date_code(v);
      if (p && p.y > 1900) return Dated(p.y, p.m, p.d);
    }
    var m = str(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
  }
  function Dated(y, m, d) { return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d; }

  function metaValue(metaRows, key) {
    var row = (metaRows || []).filter(function (r) { return str(r[0]) === key; })[0];
    return row ? row[1] : null;
  }

  /** One name -> one live entry, else an error (never a guess). */
  function resolveName(coll, name, label, data) {
    var hits = ((data || {})[coll] || []).filter(function (x) {
      return x.active !== false && D.normalizeName(x.name) === D.normalizeName(name);
    });
    if (!hits.length) return { error: 'Unknown ' + label + ': "' + name + '"' };
    if (hits.length > 1) return { error: 'Ambiguous ' + label + ': "' + name + '" matches ' + hits.length };
    return { row: hits[0] };
  }

  /**
   * Check every Requests row against live data. Pure: needs no store.
   * @returns {fatal, metaRevision, stale, rows:[{line, key, changes, errors, item}]}
   * item = {request_no, fields} for the rows clean enough to save.
   */
  function validateSheets(sheets, data) {
    var out = { fatal: null, metaRevision: null, stale: false, rows: [] };
    if (!sheets || !sheets.Requests || !sheets.Requests.length || !sheets.meta) {
      out.fatal = 'This is not a Master Excel file: it needs the Requests and meta sheets of a fresh export.';
      return out;
    }
    var rev = metaValue(sheets.meta, 'Revision');
    out.metaRevision = typeof rev === 'number' ? rev : parseInt(rev, 10) || null;
    out.stale = out.metaRevision !== data.revision;
    var head = sheets.Requests[0], col = function (n) { return head.indexOf(n); };
    if (col('Request ID') === -1) { out.fatal = 'The Requests sheet lost its "Request ID" header column.'; return out; }
    var byNo = {};
    (data.requests || []).forEach(function (r) { if (r.request_no) byNo[r.request_no] = r; });
    sheets.Requests.slice(1).forEach(function (cells, i) {
      var line = 'row ' + (i + 2), key = str(cells[col('Request ID')]);
      var row = { line: line, key: key || '(blank)', changes: [], errors: [], item: null };
      var r = byNo[key];
      if (!key || key === '(draft)') { row.errors.push('New requests are made in the app (New Request), not in Excel.'); out.rows.push(row); return; }
      if (!r) { row.errors.push('No request ' + key + ' exists (fresh export?).'); out.rows.push(row); return; }
      var statusCell = col('Status') === -1 ? '' : str(cells[col('Status')]);
      if (statusCell && statusCell !== (D.REQUEST_STATUS_LABEL[r.status] || r.status))
        row.errors.push('Status moves happen in the app (' + key + ' is ' + (D.REQUEST_STATUS_LABEL[r.status] || r.status) + ').');
      var cand = JSON.parse(JSON.stringify(r));
      function changed(field, to, show) {
        if ((cand[field] || '') !== (to || '')) {
          row.changes.push({ label: show[0], from: show[1], to: show[2] });
          cand[field] = to;
        }
      }
      EDITABLE.forEach(function (h) {
        if (col(h) === -1) return;
        var cell = cells[col(h)], field = FIELD_OF[h];
        if (field === 'priority_id') {
          if (!str(cell)) return;
          var p = resolveName('priorities', str(cell), 'priority', data);
          if (p.error) row.errors.push(line + ': ' + p.error + '.');
          else changed(field, p.row.id, ['Priority', nameOf(data, 'priorities', r.priority_id), p.row.name]);
        } else if (field === 'assigned_to') {
          if (!str(cell)) return;
          var u = resolveName('users', str(cell), 'person', data);
          if (u.error) row.errors.push(line + ': ' + u.error + '.');
          else changed(field, u.row.id, ['Assigned to', nameOf(data, 'users', r.assigned_to), u.row.name]);
        } else if (field === 'needed_by' || field === 'expected_done') {
          if (!str(cell) && cell !== 0) return;
          var ymd = toYmd(cell);
          if (!ymd) row.errors.push(line + ': "' + h + '" must be a date (YYYY-MM-DD).');
          else changed(field, ymd, [h, r[field] || '-', ymd]);
        } else if (field === 'purpose') {
          if (!str(cell)) return;
          changed(field, str(cell), [h, r.purpose ? '(set)' : '-', '(changed)']);
        }
      });
      if (!row.errors.length) {
        // allowScrapped: scrapped panels are app state (FIB cuts), not something the sheet changed
        var problems = D.requestProblems(cand, data, { submit: cand.status !== 'draft', allowScrapped: true });
        problems.forEach(function (t) { row.errors.push(key + ': ' + t); });
      }
      if (!row.errors.length && row.changes.length)
        row.item = { request_no: key, fields: { priority_id: cand.priority_id, assigned_to: cand.assigned_to, needed_by: cand.needed_by, expected_done: cand.expected_done, purpose: cand.purpose } };
      out.rows.push(row);
    });
    return out;
  }

  function nameOf(data, coll, id) {
    var r = ((data || {})[coll] || []).filter(function (x) { return x.id === id; })[0];
    return r ? (r.name || r.code || '') : '-';
  }

  return { masterSheets: masterSheets, metaRows: metaRows, EDITABLE: EDITABLE,
    hasXlsx: hasXlsx, workbookOf: workbookOf, readFile: readFile, validateSheets: validateSheets };
})();
