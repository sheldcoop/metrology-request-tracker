/**
 * tests/server-safety.js - dev only:  node tests/server-safety.js
 *
 * Torn-write and concurrency safety plus the nightly backup copy, all on
 * throwaway dirs: two saves with the same expected revision serialize to
 * one win + one 409, a rolled-back write keeps the old document, and
 * backup.js copies the live DB and prunes past the keep count.
 * Exits 1 on any failure.
 */
'use strict';
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const { withServer } = require('./server-harness');
const { openDb } = require('../server/db');
const { initDoc, getDoc } = require('../server/doc-store');

let failures = 0, passed = 0;
function check(name, cond, detail) {
  if (cond) passed++;
  else { failures++; console.log('FAIL', name, detail !== undefined ? '-> ' + detail : ''); }
}

function doc(revision) {
  return { schema_version: 14, revision: revision,
    users: [{ id: 'u1', name: 'Admin', roles: ['admin'], active: true }] };
}

function putAs(fetch, expected, d) {
  return fetch('/api/doc', { method: 'PUT', headers: { 'X-MRT-User': 'u1' },
    body: JSON.stringify({ expected_revision: expected, doc: d }) });
}

(async function run() {
  const srv = withServer();
  try {
    await putAs(srv.fetch, 0, doc(1));

    // Two writers read revision 1; both save. One must win, one must 409.
    const both = await Promise.all([2, 3].map((r) => putAs(srv.fetch, 1, doc(r))));
    const codes = both.map((r) => r.status).sort().join(',');
    check('concurrent saves serialize to win + 409', codes === '200,409', codes);
    const winner = await (await srv.fetch('/api/doc')).json();
    check('...the winner stays', winner.revision === 2 || winner.revision === 3, winner.revision);

    // A torn write (crash between BEGIN and COMMIT) keeps the old document.
    const raw = openDb(path.join(srv.dir, 'test.sqlite3'));
    try {
      initDoc(raw);
      const before = getDoc(raw).revision;
      raw.exec('BEGIN IMMEDIATE');
      raw.prepare('UPDATE doc SET revision = 9999, body = ? WHERE id = 1').run('{"torn":true}');
      raw.exec('ROLLBACK');   // the crash: nothing committed
      check('rolled-back write keeps the old revision', getDoc(raw).revision === before, getDoc(raw).revision);
    } finally { try { raw.close(); } catch (e) {} }
  } catch (e) {
    check('safety runs', false, e && e.message);
  }
  srv.close();

  // The nightly copy: real CLI, throwaway source and destination.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrt-bak-'));
  try {
    const live = path.join(dir, 'live.sqlite3');
    const dest = path.join(dir, 'copies');
    const db = openDb(live);
    try {
      initDoc(db);
      const { putDoc } = require('../server/doc-store');
      putDoc(db, 0, doc(1), null);
    } finally { try { db.close(); } catch (e) {} }
    fs.mkdirSync(dest, { recursive: true });
    for (let d = 1; d <= 4; d++) {
      fs.writeFileSync(path.join(dest, 'mrt_2026-09-0' + d + '.sqlite3'), 'old');
    }
    const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'server', 'backup.js')], {
      env: Object.assign({}, process.env, { MRT_DB: live, MRT_BACKUP_COPY: dest, MRT_BACKUP_KEEP: '3' }),
      encoding: 'utf8'
    });
    check('backup exits 0', r.status === 0, (r.stderr || '') + (r.stdout || ''));
    const kept = fs.readdirSync(dest).filter((n) => /^mrt_.*\.sqlite3$/.test(n)).sort();
    check('...copies the live DB and prunes to keep', kept.length === 3, kept.join(','));
    const today = new Date().toISOString().slice(0, 10);
    const hit = kept.indexOf('mrt_' + today + '.sqlite3') >= 0;
    check('...including today', hit, kept.join(','));
    if (hit) {
      const copy = openDb(path.join(dest, 'mrt_' + today + '.sqlite3'));
      let rev = null;
      try { rev = getDoc(copy).revision; } finally { try { copy.close(); } catch (e) {} }
      check('...and the copy holds the document', rev === 1, rev);
    }
  } catch (e) {
    check('backup runs', false, e && e.message);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(passed + ' passed, ' + failures + ' failed');
  if (failures) process.exitCode = 1;
})().catch(e => { console.log('CRASH', e && e.stack || e); process.exitCode = 1; });
