'use strict';
/**
 * Metrology Request Tracker - server/db.js (Node only, never in the browser).
 *
 * One SQLite file, WAL mode, foreign keys on. The path comes from the
 * environment (MRT_DB); the default lives under data/ which git ignores,
 * so live data never goes into git. No dependencies: built-in node:sqlite.
 */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function openDb(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

function journalMode(db) {
  return db.prepare('PRAGMA journal_mode').get().journal_mode;
}

function sqliteVersion(db) {
  return db.prepare('SELECT sqlite_version() AS v').get().v;
}

module.exports = { openDb, journalMode, sqliteVersion };
