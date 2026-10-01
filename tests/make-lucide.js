/**
 * tests/make-lucide.js - dev only, no dependencies:  node tests/make-lucide.js
 *
 * Re-vendors the Lucide icons used by js/ui/core.js PATHS. Downloads each
 * mapped icon from the pinned lucide-static version, writes the single
 * sprite vendor/lucide-sprite.svg (untouched upstream path data) and prints
 * the PATHS block to paste into core.js. Run again to upgrade Lucide:
 * bump VERSION, re-run, paste, gate.
 */
const https = require('https'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const VERSION = '1.49.0';
const BASE = 'https://unpkg.com/lucide-static@' + VERSION + '/icons/';

/* Our PATHS name -> Lucide file. No good match stays hand-drawn in core.js
 * (logo: brand mark; hirata: dot pattern; motion: unused speed lines). */
const MAP = {
  dashboard: 'layout-dashboard', lots: 'package', settings: 'settings', search: 'search',
  folder: 'folder', alert: 'triangle-alert', check: 'check', close: 'x', refresh: 'refresh-cw',
  download: 'download', upload: 'upload', save: 'save', sun: 'sun', moon: 'moon', contrast: 'contrast',
  user: 'user', 'log-out': 'log-out', inbox: 'inbox', clock: 'clock', archive: 'archive', restore: 'history',
  edit: 'pencil', move: 'move', plus: 'plus', filter: 'funnel', trash: 'trash-2', home: 'house',
  chevron_left: 'chevron-left', expand: 'maximize-2', info: 'info', lock: 'lock', activity: 'activity',
  gauge: 'gauge', chart: 'chart-column', analytics: 'chart-column', grid: 'grid-2x2',
  chevron_down: 'chevron-down', chevron_right: 'chevron-right', sliders: 'sliders-horizontal',
  ruler: 'ruler', requests: 'clipboard-list', request_new: 'file-plus', board: 'kanban', bell: 'bell',
  copy: 'copy', wrench: 'wrench', users: 'users', calendar: 'calendar', tag: 'tag',
  keyboard: 'keyboard', mail: 'mail', 'plus-circle': 'circle-plus', list: 'list', kanban: 'kanban',
  'bar-chart': 'chart-column', layers: 'layers', 'circle-help': 'circle-help'
};

function get(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return resolve(get(res.headers.location));
      if (res.statusCode !== 200) return reject(new Error(res.statusCode + ' ' + url));
      var body = '';
      res.on('data', function (c) { body += c; });
      res.on('end', function () { resolve(body); });
    }).on('error', reject);
  });
}

function inner(svg, name) {
  var m = svg.replace(/\n/g, '').match(/<svg[^>]*>(.*)<\/svg>/);
  if (!m) throw new Error('no svg in ' + name);
  return m[1].replace(/ \/>/g, '/>').trim();
}

(async function () {
  var names = Object.keys(MAP), inner_map = {}, missing = [];
  for (const n of names) {
    try { inner_map[n] = inner(await get(BASE + MAP[n] + '.svg'), MAP[n]); }
    catch (e) { missing.push(n + ' (' + e.message + ')'); }
  }
  if (missing.length) { console.log('MISSING - kept hand-drawn:\n' + missing.join('\n')); }
  var symbols = names.filter(function (n) { return inner_map[n]; })
    .map(function (n) { return '  <symbol id="i-' + n + '" viewBox="0 0 24 24">' + inner_map[n] + '</symbol>'; });
  var sprite = '<!-- Lucide v' + VERSION + ' (ISC licence, https://lucide.dev) - upstream path data, untouched.\n' +
    '     Inlined copies live in js/ui/core.js PATHS (file:// cannot fetch this file); regenerate with node tests/make-lucide.js -->\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n' +
    symbols.join('\n') + '\n</svg>\n';
  fs.writeFileSync(path.join(ROOT, 'vendor', 'lucide-sprite.svg'), sprite);
  console.log('wrote vendor/lucide-sprite.svg (' + symbols.length + ' symbols)');
  console.log('--- PATHS block (inner strings) ---');
  names.filter(function (n) { return inner_map[n]; }).forEach(function (n) {
    console.log('    ' + (/^[a-z_]+$/.test(n) ? n : "'" + n + "'") + ": '" + inner_map[n].replace(/'/g, "\\'") + "',");
  });
})().catch(function (e) { console.log('FETCH FAILED: ' + e.message); process.exitCode = 1; });
