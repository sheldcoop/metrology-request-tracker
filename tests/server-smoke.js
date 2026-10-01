/**
 * tests/server-smoke.js - dev only:  node tests/server-smoke.js
 *
 * The Phase 1 skeleton over the in-process harness (throwaway DB, never the
 * repo): /api/health answers 200 with journal_mode wal, / serves index.html,
 * unknown /api/* paths are 404, path escapes are refused. Socket binding is
 * forbidden in some sandboxes, so the handler is driven directly; real
 * binding is proven in the Phase 5 Docker step instead.
 * Exits 1 on any failure.
 */
'use strict';
const { withServer } = require('./server-harness');

let failures = 0, passed = 0;
function check(name, cond, detail) {
  if (cond) passed++;
  else { failures++; console.log('FAIL', name, detail !== undefined ? '-> ' + detail : ''); }
}

(async function run() {
  const srv = withServer();
  try {
    const h = await (await srv.fetch('/api/health')).json();
    check('health is ok on WAL sqlite', h.ok === true && h.journal_mode === 'wal' && typeof h.sqlite === 'string', JSON.stringify(h));
    const index = await srv.fetch('/');
    const text = await index.text();
    check('serves the app', index.status === 200 && /Metrology Request Tracker/.test(text), 'status ' + index.status);
    const js = await srv.fetch('/js/domain.js');
    check('serves static js as javascript', js.status === 200 && (js.headers.get('Content-Type') || '').indexOf('javascript') >= 0);
    const missing = await srv.fetch('/api/nope');
    check('unknown api paths are 404', missing.status === 404);
    const esc = await srv.fetch('/..%2f..%2fetc%2fpasswd');
    check('path escape is refused', esc.status !== 200 || !/root:/.test(await esc.text()));
    const noPost = await srv.fetch('/api/health', { method: 'POST' });
    check('api rejects wrong methods', noPost.status === 404);
  } catch (e) {
    check('requests run', false, e.message);
  }
  srv.close();
  console.log(passed + ' passed, ' + failures + ' failed');
  if (failures) process.exitCode = 1;
})().catch(e => { console.log('CRASH', e && e.stack || e); process.exitCode = 1; });
