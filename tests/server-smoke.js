/**
 * tests/server-smoke.js - dev only:  node tests/server-smoke.js
 *
 * The Phase 1 skeleton (server/ with a throwaway DB in the OS temp dir,
 * never the repo): /api/health answers 200 with journal_mode wal, / serves
 * index.html, unknown /api/* paths are 404, path escapes are refused.
 * Drives the request handler directly: this sandbox forbids listen(), so
 * real socket binding is proven in the Phase 5 Docker step instead.
 * Exits 1 on any failure.
 */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const { openDb } = require('../server/db');
const { handleRequest } = require('../server/server');

let failures = 0, passed = 0;
function check(name, cond, detail) {
  if (cond) passed++;
  else { failures++; console.log('FAIL', name, detail !== undefined ? '-> ' + detail : ''); }
}

/** Minimal node:http res: captures status, headers and body. */
function fakeRes() {
  return { status: 0, headers: {}, chunks: [],
    writeHead: function (code, headers) { this.status = code; this.headers = headers; },
    end: function (body) { if (body) this.chunks.push(Buffer.from(body)); },
    body: function () { return Buffer.concat(this.chunks).toString('utf8'); } };
}

async function get(root, db, url, method) {
  const res = fakeRes();
  await handleRequest(root, db, { method: method || 'GET', url: url }, res);
  return res;
}

(async function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrt-srv-'));
  const db = openDb(path.join(dir, 'test.sqlite3'));
  try {
    const h = JSON.parse((await get(ROOT, db, '/api/health')).body());
    check('health is ok on WAL sqlite', h.ok === true && h.journal_mode === 'wal' && typeof h.sqlite === 'string', JSON.stringify(h));
    const index = await get(ROOT, db, '/');
    check('serves the app', index.status === 200 && /Metrology Request Tracker/.test(index.body()), 'status ' + index.status);
    const js = await get(ROOT, db, '/js/domain.js');
    check('serves static js as javascript', js.status === 200 && (js.headers['Content-Type'] || '').indexOf('javascript') >= 0);
    const missing = await get(ROOT, db, '/api/nope');
    check('unknown api paths are 404', missing.status === 404);
    const esc = await get(ROOT, db, '/..%2f..%2fetc%2fpasswd');
    check('path escape is refused', esc.status !== 200 || !/root:/.test(esc.body()));
    const noPost = await get(ROOT, db, '/api/health', 'POST');
    check('api rejects wrong methods', noPost.status === 404);
  } catch (e) {
    check('requests run', false, e.message);
  }
  try { db.close(); } catch (e) { /* already closed */ }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(passed + ' passed, ' + failures + ' failed');
  if (failures) process.exitCode = 1;
})().catch(e => { console.log('CRASH', e && e.stack || e); process.exitCode = 1; });
