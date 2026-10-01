/**
 * tests/server-import.js - dev only:  node tests/server-import.js
 *
 * The one-time import CLI against throwaway dirs (never the repo, never the
 * live file): imports demo-data/mrt_data.json read-only (old schema v10 is
 * accepted - the app upgrades on load), prints collection counts, refuses a
 * second import without --force, and leaves the source byte-identical.
 * Exits 1 on any failure.
 */
'use strict';
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const DEMO = path.join(ROOT, 'demo-data', 'mrt_data.json');
const { openDb } = require('../server/db');
const { getDoc } = require('../server/doc-store');

let failures = 0, passed = 0;
function check(name, cond, detail) {
  if (cond) passed++;
  else { failures++; console.log('FAIL', name, detail !== undefined ? '-> ' + detail : ''); }
}

function sha(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

function runImport(dbFile, args) {
  return cp.spawnSync(process.execPath, [path.join(ROOT, 'server', 'import.js')].concat(args), {
    env: Object.assign({}, process.env, { MRT_DB: dbFile }),
    encoding: 'utf8'
  });
}

(function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mrt-imp-'));
  const dbFile = path.join(dir, 'mrt.sqlite3');
  try {
    const before = sha(DEMO);
    const demo = JSON.parse(fs.readFileSync(DEMO, 'utf8'));

    const r1 = runImport(dbFile, [DEMO]);
    check('import exits 0', r1.status === 0, (r1.stderr || '') + (r1.stdout || ''));
    check('...and names the revision', /imported revision 1/.test(r1.stdout), r1.stdout);

    const db = openDb(dbFile);
    let row;
    try { row = getDoc(db); } finally { try { db.close(); } catch (e) {} }
    check('old schema imports as-is', !!row && row.revision === 1, row && row.revision);
    const body = JSON.parse(row.body);
    check('...with all 267 demo requests', body.requests.length === 267, body.requests.length);
    check('...and the demo schema version kept', body.schema_version === demo.schema_version);

    const r2 = runImport(dbFile, [DEMO]);
    check('second import is refused', r2.status !== 0 && /already holds/.test(r2.stderr), r2.status + ' ' + r2.stderr);

    const r3 = runImport(dbFile, [DEMO, '--force']);
    check('--force replaces it', r3.status === 0, r3.stderr);

    check('source file untouched', sha(DEMO) === before);
  } catch (e) {
    check('import runs', false, e && e.message);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(passed + ' passed, ' + failures + ' failed');
  if (failures) process.exitCode = 1;
})();
