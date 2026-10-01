'use strict';
/**
 * Metrology Request Tracker - server/doc-store.js (Node only, never in the browser).
 *
 * Stage A: the whole data document is ONE row (id 1) with a revision column.
 * Saves run as a single compare-and-swap: UPDATE ... WHERE revision matches
 * what the writer read. Zero changed rows means someone else saved first -
 * the caller gets { conflict } with the current revision, saved_by and
 * saved_ts, the same fields the file version carries, so the app's
 * "someone else saved" banner works unchanged.
 */
function initDoc(db) {
  db.exec('CREATE TABLE IF NOT EXISTS doc (' +
    'id INTEGER PRIMARY KEY CHECK (id = 1), ' +
    'revision INTEGER NOT NULL, body TEXT NOT NULL, ' +
    'saved_by TEXT, saved_ts TEXT)');
}

function getDoc(db) {
  const row = db.prepare('SELECT revision, body, saved_by, saved_ts FROM doc WHERE id = 1').get();
  return row || null;
}

/**
 * expectedRevision: the revision the writer read (0 or null when it read nothing).
 * Returns { ok: true, revision } or { conflict: true, current }.
 */
function putDoc(db, expectedRevision, doc, savedBy) {
  const body = typeof doc === 'string' ? doc : JSON.stringify(doc);
  let revision = 0, savedTs = null;
  try {
    const parsed = typeof doc === 'string' ? JSON.parse(doc) : doc;
    if (parsed && typeof parsed.revision === 'number') revision = parsed.revision;
    if (parsed && typeof parsed.saved_ts === 'string') savedTs = parsed.saved_ts;
  } catch (e) { return { ok: false, code: 'bad_json' }; }
  const current = getDoc(db);
  if (!current) {
    db.prepare('INSERT INTO doc (id, revision, body, saved_by, saved_ts) VALUES (1, ?, ?, ?, ?)')
      .run(revision, body, savedBy || null, savedTs);
    return { ok: true, revision: revision };
  }
  if (expectedRevision !== null && expectedRevision !== undefined && current.revision !== expectedRevision) {
    return { conflict: true, current: { revision: current.revision, saved_by: current.saved_by, saved_ts: current.saved_ts } };
  }
  db.prepare('UPDATE doc SET revision = ?, body = ?, saved_by = ?, saved_ts = ? WHERE id = 1')
    .run(revision, body, savedBy || null, savedTs);
  return { ok: true, revision: revision };
}

module.exports = { initDoc, getDoc, putDoc };
