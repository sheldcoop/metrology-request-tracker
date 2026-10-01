/**
 * tests/make-prf-demo.js - dev only:  node tests/make-prf-demo.js
 *
 * Builds a tiny made-up PRF log folder (demo-data/prf-logs/, git-ignored)
 * with the same layout as a real Zeta run, so the PRF page can be tried
 * without real data. Mirrors the real tree:
 *   Chiplet4Future/FHR0020/19197/BU-01/{Front,Back}/Panel {1,3}/log/SiteNNN.txt
 * Every value in the files is invented. Pick the lot folder (19197) - or any
 * folder above the logs - and Project, Part number and Lot fill in by
 * themselves; the pasted full path is only needed when picking deep inside:
 *   L:\LabData\Chiplet4Future\FHR0020\19197\BU-01
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'demo-data', 'prf-logs');
const CHAIN = ['Chiplet4Future', 'FHR0020', '19197', 'BU-01'];

function viaFile(panel, site) {
  const rows = [];
  for (let i = 0; i < 3; i++) {
    const cx = (90 + panel * 3 + site * 0.7 + i * 0.4).toFixed(3);
    const cy = (70 + site * 0.5 + i * 0.3).toFixed(3);
    const major = (40 - i * 4 + site * 0.2).toFixed(3);
    const minor = (39 - i * 4 + site * 0.2).toFixed(3);
    const depth = (-24 - site * 0.3 - i * 0.5).toFixed(3);
    rows.push((i + 1) + '\t' + cx + '\t' + cy + '\t' + major + '\t' + minor +
      '\t0.200\t0.300\t6.000\t2.500\t' + depth + '\t-30.000\t-6.000');
  }
  return 'Zeta Analysis Report\r\n' +
    'Image Name:\tZeta Demo' + site + '\tFile Name:\t\r\n' +
    'Date Acquired:\tTue Sep 22 12:00:00 2026\tToday:\tTue Sep 22 12:00:01 2026\r\n' +
    'Z Range:\t72um\tNo. of Steps:\t480\tStep Size:\t0.150um\tField of View:\t98um x 73um\r\n' +
    'Total Area =  28611.024, Diamond Area =   1400.000, Ratio =       4.89%\r\n' +
    'Index\tCenterX\tCenterY\tMajorAxis\tMinorAxis\tSa\tSq\tSpv\tSz\tAvgHeight\tMinHeight\tMaxHeight\r\n' +
    'Index\t\t\t\t\t\t\t\t\t\t\t\r\n' +
    rows.join('\r\n') + '\r\n';
}

fs.rmSync(path.join(ROOT), { recursive: true, force: true });
let count = 0;
['Front', 'Back'].forEach((side) => {
  [1, 3].forEach((panel) => {
    const dir = path.join.apply(null, [ROOT].concat(CHAIN, [side, 'Panel ' + panel, 'log']));
    fs.mkdirSync(dir, { recursive: true });
    for (let site = 1; site <= 10; site++) {
      const name = 'Site' + String(site).padStart(3, '0') + '.txt';
      fs.writeFileSync(path.join(dir, name), viaFile(panel, site));
      count++;
    }
  });
});
fs.writeFileSync(path.join(ROOT, 'README.txt'),
  'Made-up PRF demo tree (tests/make-prf-demo.js). Pick the 19197 folder on\n' +
  'the PRF page - Project, Part number and Lot fill in by themselves.\n' +
  'Every value in here is invented.\n');
console.log('prf demo ok (' + count + ' files under ' + ROOT + ')');
