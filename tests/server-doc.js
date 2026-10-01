/**
 * tests/server-doc.js - dev only:  node tests/server-doc.js
 *
 * Stage A document + file endpoints over the in-process harness: empty doc
 * reads null, first write wins, a stale revision gets the 409 with the
 * conflict fields the banner reads, file paths round-trip, traversal is
 * refused. Exits 1 on any failure.
 */
'use strict';
const { withServer } = require('./server-harness');

let failures = 0, passed = 0;
function check(name, cond, detail) {
  if (cond) passed++;
  else { failures++; console.log('FAIL', name, detail !== undefined ? '-> ' + detail : ''); }
}

function doc(revision, extra) {
  return Object.assign({ schema_version: 14, revision: revision,
    users: [{ id: 'u1', name: 'Admin', roles: ['admin'], active: true }] }, extra || {});
}

async function put(fetch, expected, d, by) {
  const r = await fetch('/api/doc', { method: 'PUT', headers: { 'X-MRT-User': 'u1' },
    body: JSON.stringify({ expected_revision: expected, doc: d, saved_by: by || null }) });
  return { status: r.status, body: await r.json() };
}

(async function run() {
  const srv = withServer();
  try {
    const empty = await srv.fetch('/api/doc');
    check('empty doc reads 404 empty', empty.status === 404 && (await empty.json()).code === 'empty');

    const first = await put(srv.fetch, 0, doc(1), 'u1');
    check('first write wins', first.status === 200 && first.body.revision === 1, JSON.stringify(first.body));

    const read = await (await srv.fetch('/api/doc')).json();
    check('doc round-trips', read.revision === 1 && JSON.parse(read.doc).revision === 1 && read.saved_by === 'u1');

    const stale = await put(srv.fetch, 0, doc(1), 'u2');
    check('stale revision is 409', stale.status === 409 && stale.body.code === 'revision_conflict', JSON.stringify(stale.body));
    check('...with the banner fields', stale.body.revision === 1 && stale.body.saved_by === 'u1' && typeof stale.body.saved_ts !== 'undefined',
      JSON.stringify(stale.body));

    const second = await put(srv.fetch, 1, doc(2), 'u2');
    check('fresh revision writes', second.status === 200 && second.body.revision === 2);

    const missing = await srv.fetch('/api/files?path=' + encodeURIComponent('backups/x.json'));
    check('missing file reads 404', missing.status === 404);

    const w = await srv.fetch('/api/files?path=' + encodeURIComponent('backups/b.json'),
      { method: 'PUT', body: JSON.stringify({ text: '{"revision":0}' }) });
    check('file writes', w.status === 200);
    const back = await srv.fetch('/api/files?path=' + encodeURIComponent('backups/b.json'));
    check('file round-trips', back.status === 200 && (await back.text()) === '{"revision":0}');
    const list = await (await srv.fetch('/api/files?dir=' + encodeURIComponent('backups'))).json();
    check('dir lists name + size', list.length === 1 && list[0].name === 'b.json' && typeof list[0].size === 'number', JSON.stringify(list));
    const del = await srv.fetch('/api/files?path=' + encodeURIComponent('backups/b.json'), { method: 'DELETE' });
    const gone = await srv.fetch('/api/files?path=' + encodeURIComponent('backups/b.json'));
    check('remove works', del.status === 200 && gone.status === 404);

    const evil = await srv.fetch('/api/files?path=' + encodeURIComponent('../../etc/passwd'));
    check('traversal is refused', evil.status === 400);
    const badJson = await srv.fetch('/api/doc', { method: 'PUT', body: 'not json' });
    check('bad json is 400', badJson.status === 400);
  } catch (e) {
    check('requests run', false, e && e.message);
  }
  srv.close();
  console.log(passed + ' passed, ' + failures + ' failed');
  if (failures) process.exitCode = 1;
})().catch(e => { console.log('CRASH', e && e.stack || e); process.exitCode = 1; });
