/**
 * tests/storage-api.js - dev only:  node tests/storage-api.js
 *
 * The real js/adapters/storage-api.js against the in-process server: the
 * 12-method contract holds, the data file round-trips through /api/doc,
 * other paths through /api/files, and a stale document write rejects with
 * code 'revision_conflict' plus the banner fields. Exits 1 on any failure.
 */
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const { withServer } = require('./server-harness');

let failures = 0, passed = 0;
function check(name, cond, detail) {
  if (cond) passed++;
  else { failures++; console.log('FAIL', name, detail !== undefined ? '-> ' + detail : ''); }
}

function boot(fetch) {
  const win = { MRT: { config: { data_file: 'mrt_data.json', backup_dir: 'backups', backup_prefix: 'mrt_data_', api_base: '' },
    adapters: {} }, fetch: fetch };
  win.window = win;
  const ctx = vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/adapters/storage-api.js'), 'utf8'), ctx, { filename: 'storage-api.js' });
  return win.MRT.adapters.storageApi;
}

(async function run() {
  const srv = withServer();
  const a = boot(srv.fetch);
  try {
    check('id is api', a.id === 'api');
    check('supported where fetch exists', a.isSupported() === true);
    check('connect checks health', await a.connect().then(() => true).catch(() => false));
    check('reconnect is true', await a.reconnect({ silent: true }) === true);
    check('missing reads null', await a.read('mrt_data.json') === null && await a.read('backups/x.json') === null);

    const text1 = JSON.stringify({ schema_version: 14, revision: 1, users: [] });
    await a.write('mrt_data.json', text1);
    check('doc round-trips', await a.read('mrt_data.json') === text1);

    const stale = JSON.stringify({ schema_version: 14, revision: 1, users: [{ id: 'u' }] });
    let err = null;
    try { await a.write('mrt_data.json', stale); } catch (e) { err = e; }
    check('stale write rejects', !!err, 'no error thrown');
    check('...with the conflict code', !!err && err.code === 'revision_conflict', err && err.code);
    check('...with the banner fields', !!err && !!err.detail && err.detail.revision === 1, err && JSON.stringify(err.detail));

    await a.write('backups/b.json', '{}');
    const list = await a.list('backups');
    check('list finds the backup', list.length === 1 && list[0].name === 'b.json' && typeof list[0].size === 'number');
    await a.remove('backups/b.json');
    check('remove works', (await a.list('backups')).length === 0);
  } catch (e) {
    check('adapter runs', false, e && e.message);
  }
  srv.close();
  console.log(passed + ' passed, ' + failures + ' failed');
  if (failures) process.exitCode = 1;
})().catch(e => { console.log('CRASH', e && e.stack || e); process.exitCode = 1; });
