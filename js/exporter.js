/**
 * Metrology Request Tracker - exporter.js  (pattern from ABF Tracker v2)
 *
 * Exports (Q48, DECISIONS M5-2). With vendor/xlsx.full.min.js (SheetJS) a
 * real .xlsx workbook, one sheet per table; without it the same data as CSV
 * (UTF-8 with BOM, CRLF - Excel opens it), one file per sheet. So a
 * Download button never simply fails.
 *
 *   exporter.requestRows(requests)       one row per request, the same columns everywhere
 *   exporter.historySheets()             "Requests" + "Timeline" (every request, every event)
 *   exporter.exportSheets(base, sheets)  sheets: [{name, rows: [[header...], [cells...]]}]
 *   exporter.rowsButton(label, name, getRows)   a Download button for one table
 *
 * Reads the store (like a screen); the maths come from domain.requestTimes.
 * Times: 'YYYY-MM-DD HH:MM' Europe/Vienna, so Excel sorts them.
 */
window.MRT = window.MRT || {};
window.MRT.exporter = (function () {
  'use strict';

  var store = window.MRT.store;
  var ui = window.MRT.ui;
  var D = window.MRT.domain;

  function hasXlsx() { return typeof window.XLSX !== 'undefined' && !!window.XLSX.utils; }

  /* --- values ----------------------------------------------------------- */

  var stampFmt = new Intl.DateTimeFormat('en-CA', { timeZone: window.MRT.config.time_zone, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

  /** 'YYYY-MM-DD HH:MM' in Vienna ('' when empty). */
  function stamp(ts) {
    if (ts === null || ts === undefined || ts === '') return '';
    var t = typeof ts === 'number' ? ts : Date.parse(ts);
    if (isNaN(t)) return '';
    var p = {};
    stampFmt.formatToParts(new Date(t)).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day + ' ' + (p.hour === '24' ? '00' : p.hour) + ':' + p.minute;
  }

  function hours(ms) { return ms === null || ms === undefined ? '' : Math.round(ms / 360000) / 10; }
  function code(coll, id) { var r = id ? store.byId(coll, id) : null; return r ? (r.code || r.name || '') : ''; }
  function nameOf(coll, id) { var r = id ? store.byId(coll, id) : null; return r ? (r.name || r.code || '') : ''; }

  /* --- tables --------------------------------------------------------------- */

  var REQUEST_HEAD = ['Request ID', 'Status', 'Tool', 'Measurement type', 'Project', 'Part number', 'Lot', 'Build-up', 'Layers',
    'Panels', 'Panel count', 'Priority', 'Requester', 'Assigned to', 'Needed by', 'Expected done', 'Submitted', 'Accepted',
    'Started', 'Completed', 'Results OK', 'Turnaround (lab h, hold out)', 'On hold (lab h)', 'Calendar (h)', 'On time',
    'Clarifications', 'Reopened', 'Results folder', 'Purpose'];

  /** One row per request (Q48 "current table view", the history, the pack). */
  function requestRows(requests) {
    var d = store.data(), cal = store.calendar(), hs = D.holidaySet(d.holidays), now = Date.now(), ev = d.request_events || [];
    return [REQUEST_HEAD].concat((requests || []).map(function (r) {
      var t = D.requestTimes(r, ev, cal, hs, now);
      var lot = r.lot_id ? store.byId('lots', r.lot_id) : null;
      return [r.request_no || '(draft)', D.REQUEST_STATUS_LABEL[r.status] || r.status, code('tools', r.tool_id), nameOf('measurement_types', r.type_id),
        code('projects', r.project_id), code('part_numbers', r.part_number_id), lot ? lot.lot_number : '', code('buildups', r.buildup_id),
        (r.layers || []).join(' '), (r.panels || []).join(', '), D.panelCountOf ? D.panelCountOf(r) : (r.panels || []).length,
        nameOf('priorities', r.priority_id), nameOf('users', r.requester_id), nameOf('users', r.assigned_to),
        r.needed_by || '', r.expected_done || '', stamp(r.submitted_ts), stamp(r.accepted_ts), stamp(r.started_ts),
        stamp(t.completed_ts), stamp(r.results_ok_ts), hours(t.turnaround_ms), hours(t.hold_ms || null), hours(t.calendar_ms),
        t.on_time === null ? '' : t.on_time ? 'yes' : 'no', t.clarifications, t.reopens, r.results_path || '', r.purpose || ''];
    }));
  }

  /** The full request history (Q48): every submitted request, and every timeline event. */
  function historySheets() {
    var d = store.data();
    var reqs = (d.requests || []).filter(function (r) { return r.status !== 'draft'; })
      .sort(function (a, b) { return (a.submitted_ts || '') < (b.submitted_ts || '') ? -1 : 1; });
    var ids = {};
    reqs.forEach(function (r) { ids[r.id] = r.request_no; });
    var events = (d.request_events || []).filter(function (e) { return ids[e.request_id]; })
      .sort(function (a, b) { return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0; });
    return [
      { name: 'Requests', rows: requestRows(reqs) },
      { name: 'Timeline', rows: [['Request ID', 'When', 'Who', 'What', 'From', 'To', 'Text']].concat(events.map(function (e) {
        return [ids[e.request_id], stamp(e.ts), nameOf('users', e.user_id), e.kind,
                D.REQUEST_STATUS_LABEL[e.from] || e.from || '', D.REQUEST_STATUS_LABEL[e.to] || e.to || '', e.text || ''];
      })) }
    ];
  }

  /**
   * The monthly management pack (Q48): one workbook for a month 'YYYY-MM' -
   * Summary, Per tool, Per project, Line stop, On-hold reasons, Clarification,
   * Requests. The numbers are domain.analytics for that month (all tools and
   * projects), so they match the Analytics page for the same range.
   */
  function managementPack(month) {
    var first = month + '-01';
    var next = D.addDaysYmd(first, 32).slice(0, 7) + '-01';
    var last = D.addDaysYmd(next, -1);
    var levelOf = window.MRT.analytics.levelOf;
    var a = D.analytics(store.data(), { from_ymd: first, to_ymd: last }, { now_ts: Date.now(), cal: store.calendar(), levelOf: levelOf });
    var t = a.turnaround;
    function pctOf(v) { return v === null || v === undefined ? '' : v; }
    var reqs = a.ids.submitted.concat(a.ids.done.filter(function (id) { return a.ids.submitted.indexOf(id) === -1; }))
      .map(function (id) { return store.byId('requests', id); }).filter(Boolean);
    return [
      { name: 'Summary', rows: [['Management pack', month], ['From', first], ['To', last], ['Made', stamp(Date.now())], [],
        ['Requests submitted', a.counts.submitted], ['Requests completed', a.counts.done],
        ['Turnaround median (lab h, hold out)', hours(t.median_ms)], ['Turnaround p90 (lab h)', hours(t.p90_ms)], ['Hold median (lab h)', hours(t.hold_median_ms)],
        ['On time %', pctOf(t.on_time_pct)], ['On time / with a date', t.on_time + ' / ' + t.dated],
        ['Line stop requests', a.line_stop.n], ['Line stop response median (lab h)', hours(a.line_stop.response_median_ms)],
        ['Reopened', a.reopen.reopened + ' / ' + a.reopen.n],
        ['Open at month end', a.backlog.length ? a.backlog[a.backlog.length - 1].open : ''], [],
        ['Lab time = lab days and hours (Settings > Lab calendar), holidays out. On time = completed by the end of the needed-by lab day.']] },
      { name: 'Per tool', rows: [['Tool', 'Submitted', 'Completed', 'Turnaround median (lab h)', 'p90 (lab h)', 'Hold median (lab h)', 'On time %', 'With a question %']]
        .concat(store.list('tools', { all: true }).map(function (tool) {
          var tt = a.turnaround_by_tool.filter(function (x) { return x.tool_id === tool.id; })[0] || {};
          var dem = a.demand_by_tool.filter(function (x) { return x.key === tool.id; })[0] || {};
          var cl = a.clarification_by_tool.filter(function (x) { return x.tool_id === tool.id; })[0] || {};
          return [tool.code, dem.n || 0, tt.n || 0, hours(tt.median_ms), hours(tt.p90_ms), hours(tt.hold_median_ms), pctOf(tt.on_time_pct), pctOf(cl.pct)];
        })) },
      { name: 'Per project', rows: [['Project', 'Requests submitted']].concat(a.per_month_project.map(function (x) {
          return [x.project_id ? code('projects', x.project_id) : 'no project', x.n]; })) },
      { name: 'Line stop', rows: requestRows(a.line_stop.ids.map(function (id) { return store.byId('requests', id); }).filter(Boolean)) },
      { name: 'On-hold reasons', rows: [['Reason', 'Times put on hold']].concat(a.hold_reasons.map(function (x) {
          return [x.reason_id ? nameOf('hold_reasons', x.reason_id) : 'other', x.n]; })) },
      { name: 'Clarification', rows: [['Tool / BKM', 'Requests', 'With a question', '%']].concat(
          a.clarification_by_tool.map(function (x) { return ['Tool ' + code('tools', x.tool_id), x.n, x.with_clarification, pctOf(x.pct)]; }),
          a.clarification_by_bkm.map(function (x) { return ['BKM ' + (x.bkm_id === 'own' ? 'own path' : x.bkm_id === 'none' ? 'none' : nameOf('bkms', x.bkm_id)), x.n, x.with_clarification, pctOf(x.pct)]; })) },
      { name: 'Requests', rows: requestRows(reqs) }
    ];
  }

  /* --- writing ---------------------------------------------------------------- */

  function csvOf(rows) {
    return '﻿' + rows.map(function (row) {
      return row.map(function (cell) {
        if (cell === null || cell === undefined) return '';
        var s = String(cell);
        return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
  }

  function download(content, filename, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: type || 'text/plain' }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function safeName(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }

  /**
   * Write sheets: one .xlsx workbook with SheetJS, else one CSV per sheet.
   * @returns {{format, sheets, rows}}
   */
  function exportSheets(base, sheets) {
    var list = (sheets || []).filter(function (s) { return s && s.rows && s.rows.length; });
    if (!list.length) throw new Error('Nothing to export.');
    var file = 'mrt_' + safeName(base) + '_' + D.viennaYmd(Date.now());
    var rows = list.reduce(function (n, s) { return n + s.rows.length - 1; }, 0);
    if (hasXlsx()) {
      var X = window.XLSX, wb = X.utils.book_new(), used = {};
      list.forEach(function (s) {
        var nm = String(s.name).replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31) || 'Sheet';
        while (used[nm]) nm = nm.slice(0, 28) + ' ' + (Object.keys(used).length + 1);
        used[nm] = true;
        X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(s.rows), nm);
      });
      X.writeFile(wb, file + '.xlsx');
      return { format: 'xlsx', sheets: list.length, rows: rows };
    }
    list.forEach(function (s) { download(csvOf(s.rows), file + (list.length > 1 ? '_' + safeName(s.name) : '') + '.csv', 'text/csv;charset=utf-8;'); });
    return { format: 'csv', sheets: list.length, rows: rows };
  }

  /** Run an export and say what happened. */
  function run(base, getSheets) {
    try {
      var out = exportSheets(base, getSheets());
      ui.toast({ kind: 'success', message: out.rows + ' rows downloaded as ' + out.format.toUpperCase() +
        (out.format === 'csv' && out.sheets > 1 ? ' (' + out.sheets + ' files)' : '') + '.' });
      return out;
    } catch (e) {
      ui.toastError('Download failed: ' + e.message, e);
      return null;
    }
  }

  /** A small Download button for one table; getRows() builds its rows on click. */
  function rowsButton(label, name, getRows) {
    return ui.button(label || 'Download', { size: 'sm', icon: 'download',
      title: hasXlsx() ? 'Download as Excel' : 'Download as CSV (Excel opens it)',
      onClick: function () { run(name, function () { return [{ name: name, rows: getRows() }]; }); } });
  }

  return {
    hasXlsx: hasXlsx, stamp: stamp, hours: hours,
    requestRows: requestRows, historySheets: historySheets, managementPack: managementPack,
    csvOf: csvOf, download: download, exportSheets: exportSheets, run: run, rowsButton: rowsButton
  };
})();
