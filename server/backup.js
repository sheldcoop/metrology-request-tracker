'use strict';
/**
 * Metrology Request Tracker - server/backup.js (Node only, run nightly).
 *
 *   node server/backup.js
 *
 * Online copy of the live database to a SECOND location (MRT_BACKUP_COPY),
 * keeping the last MRT_BACKUP_KEEP files (default 30). Uses SQLite's backup
 * API, so the copy is consistent even mid-save. Run it from cron/systemd on
 * the host - never from inside the served app.
 */
const fs = require('node:fs');
const path = require('node:path');
const { openDb } = require('./db');

function fail(msg) { console.error('backup: ' + msg); process.exit(2); }

async function main() {
  const dbFile = process.env.MRT_DB || path.join(__dirname, '..', 'data', 'mrt.sqlite3');
  const destDir = process.env.MRT_BACKUP_COPY;
  if (!destDir) fail('set MRT_BACKUP_COPY to the second location first');
  const keep = Number(process.env.MRT_BACKUP_KEEP || 30);
  if (!fs.existsSync(dbFile)) fail('no database at ' + dbFile);
  fs.mkdirSync(destDir, { recursive: true });

  const day = new Date().toISOString().slice(0, 10);
  const dest = path.join(destDir, 'mrt_' + day + '.sqlite3');
  const db = openDb(dbFile);
  try {
    // VACUUM INTO writes a consistent snapshot even mid-save (atomic).
    db.exec("VACUUM INTO '" + dest.replace(/'/g, "''") + "'");
  } finally {
    try { db.close(); } catch (e) { /* already closed */ }
  }

  const copies = fs.readdirSync(destDir)
    .filter((n) => /^mrt_\d{4}-\d{2}-\d{2}\.sqlite3$/.test(n))
    .sort();
  const extra = copies.slice(0, Math.max(0, copies.length - keep));
  extra.forEach((n) => { try { fs.unlinkSync(path.join(destDir, n)); } catch (e) { /* keep going */ } });
  console.log('backup: ' + dest + ' (kept ' + (copies.length - extra.length) + ')');
}

main().catch((e) => fail(e.message));
