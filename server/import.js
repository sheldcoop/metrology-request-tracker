'use strict';
/**
 * Metrology Request Tracker - server/import.js (Node only, one-time use).
 *
 *   node server/import.js <mrt_data.json> [--force]
 *
 * Reads a JSON data file into the Stage A document row. The source file is
 * only ever read, never modified. Older schema versions are accepted as-is:
 * the app runs its own MIGRATIONS chain on load and saves the upgraded
 * document back. Refuses when the database already holds a document unless
 * --force is given. Demo data only in tests; live data never goes into git.
 */
const fs = require('node:fs');
const path = require('node:path');
const { openDb } = require('./db');
const { initDoc, getDoc, putDoc } = require('./doc-store');

function currentSchema() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'store.js'), 'utf8');
  const m = src.match(/var SCHEMA_VERSION = (\d+);/);
  return m ? Number(m[1]) : null;
}

function fail(msg) { console.error('import: ' + msg); process.exit(2); }

function main() {
  const file = process.argv[2];
  const force = process.argv[3] === '--force';
  if (!file) fail('usage: node server/import.js <mrt_data.json> [--force]');
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { fail('cannot read/parse ' + file + ': ' + e.message); }
  if (!doc || typeof doc !== 'object') fail('not a data document: ' + file);
  if (typeof doc.revision !== 'number' || typeof doc.schema_version !== 'number') {
    fail('not a data document (needs numeric revision + schema_version): ' + file);
  }
  const latest = currentSchema();
  if (latest === null) fail('cannot find SCHEMA_VERSION in js/store.js');
  if (doc.schema_version > latest) {
    fail('schema ' + doc.schema_version + ' is newer than this app (' + latest + '): update the app first');
  }

  const dbFile = process.env.MRT_DB || path.join(__dirname, '..', 'data', 'mrt.sqlite3');
  const db = openDb(dbFile);
  try {
    initDoc(db);
    const existing = getDoc(db);
    if (existing && !force) fail('database already holds revision ' + existing.revision + ': pass --force to replace it');
    const r = putDoc(db, existing ? existing.revision : 0, doc, doc.saved_by || null);
    if (r.code || r.conflict) fail('write refused: ' + JSON.stringify(r));
    const counts = {};
    Object.keys(doc).forEach((k) => { if (Array.isArray(doc[k])) counts[k] = doc[k].length; });
    console.log('imported revision ' + r.revision + ' schema ' + doc.schema_version + ' from ' + file);
    console.log(JSON.stringify(counts));
  } finally {
    try { db.close(); } catch (e) { /* already closed */ }
  }
}

main();
