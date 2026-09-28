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

  /** Step 2: Requests + meta. Master-list sheets join in step 4. */
  function masterSheets() {
    return [
      { name: 'Requests', rows: exporter.requestRows(sortedRequests()) },
      { name: 'meta', rows: metaRows() }
    ];
  }

  return { masterSheets: masterSheets, metaRows: metaRows };
})();
