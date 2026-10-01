'use strict';
/**
 * Metrology Request Tracker - server/index.js (Node only).
 *
 * Start:  node server/index.js
 * Env:    MRT_PORT (default 8080), MRT_DB (default <repo>/data/mrt.sqlite3),
 *         MRT_ROOT (default the repo root, the parent of this folder).
 * Stops cleanly on SIGTERM/SIGINT: open connections drain, then the DB closes.
 */
const path = require('node:path');
const { openDb } = require('./db');
const { createServer } = require('./server');

const ROOT = process.env.MRT_ROOT || path.join(__dirname, '..');
const PORT = Number(process.env.MRT_PORT || 8080);
const DB_FILE = process.env.MRT_DB || path.join(ROOT, 'data', 'mrt.sqlite3');

const db = openDb(DB_FILE);
const server = createServer(ROOT, db);
server.listen(PORT, () => {
  console.log('MRT server on http://localhost:' + server.address().port + ' db=' + DB_FILE);
});

let stopping = false;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  server.close(() => {
    try { db.close(); } catch (e) { /* already closed */ }
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
