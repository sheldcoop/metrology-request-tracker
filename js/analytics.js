/**
 * Metrology Request Tracker - analytics.js  (read cache, pattern from ABF)
 *
 * Feeds domain.analytics() from the store and remembers the result per
 * filter, until the data changes (a save, a reload) or a minute passes
 * ("late" and "open now" move with the clock). A chart and its export
 * therefore always show the same numbers. No maths of its own.
 *
 *   MRT.analytics.get({from_ymd, to_ymd, tool_id, project_id}) -> the domain.analytics result
 *   MRT.analytics.defaultFilter(now_ts)                         -> the last 90 days
 */
window.MRT = window.MRT || {};
window.MRT.analytics = (function () {
  'use strict';

  var store = window.MRT.store;
  var D = window.MRT.domain;
  var cache = { key: null, value: null };

  function levelOf(r) { var p = r.priority_id ? store.byId('priorities', r.priority_id) : null; return p ? p.level : 99; }

  function get(f) {
    var now = Date.now();
    var s = store.status();
    var key = JSON.stringify(f) + '|' + s.changeSeq + '|' + s.revision + '|' + Math.floor(now / 60000);
    if (cache.key === key) return cache.value;
    cache.key = key;
    cache.value = D.analytics(store.data(), f, { now_ts: now, cal: store.calendar(), levelOf: levelOf });
    return cache.value;
  }

  function defaultFilter(nowTs) {
    var today = D.viennaYmd(nowTs === undefined ? Date.now() : nowTs);
    return { from_ymd: D.addDaysYmd(today, -89), to_ymd: today, tool_id: '', project_id: '' };
  }

  return { get: get, defaultFilter: defaultFilter, levelOf: levelOf };
})();
