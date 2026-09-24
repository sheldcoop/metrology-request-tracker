/**
 * tests/make-demo-data.js - dev only:  node tests/make-demo-data.js [folder]
 *
 * Writes the big made-up demo data file (tests/demo-data.js) to
 * demo-data/mrt_data.json (or the folder given). Open the app, user menu >
 * Change data folder, pick that folder. Admin PIN: 1234. Your real data
 * folder is never touched. demo-data/mrt_data.json IS committed (Prince, 2026-09-24), so a clone has it.
 */
const vm = require('vm'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const win = { console, crypto: globalThis.crypto, TextEncoder, Intl, Date, Math, JSON, Promise, setTimeout, clearTimeout,
              Uint32Array, Uint8Array, Array, Object, String, Number, RegExp, Error };
win.window = win;
const ctx = vm.createContext(win);
['js/config.js', 'js/domain.js', 'js/seed.js', 'js/store.js', 'tests/demo-data.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

const PIN = '1234', SALT = 'salt_demo';
const data = win.MRT.demoData({ now_ts: Date.now() });
const hash = crypto.createHash('sha256').update(SALT + ':' + PIN).digest('hex');
data.settings.forEach(s => {
  if (s.key === 'admin_pin_salt') s.value_json = JSON.stringify(SALT);
  if (s.key === 'admin_pin_hash') s.value_json = JSON.stringify(hash);
});
const dir = path.resolve(process.argv[2] || path.join(ROOT, 'demo-data'));
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'mrt_data.json');
if (fs.existsSync(file)) fs.copyFileSync(file, path.join(dir, 'mrt_data.before-demo.json'));
fs.writeFileSync(file, JSON.stringify(data, null, 1));
const by = {};
data.requests.forEach(r => { by[r.status] = (by[r.status] || 0) + 1; });
console.log('wrote ' + file);
console.log(data.users.length + ' people, ' + data.lots.length + ' lots, ' + data.requests.length + ' requests, ' + data.request_events.length + ' timeline events');
console.log('requests by status: ' + Object.keys(by).map(k => k + ' ' + by[k]).join(', '));
console.log('Open the app > user menu > Change data folder > pick ' + dir + '  (admin PIN ' + PIN + ')');
