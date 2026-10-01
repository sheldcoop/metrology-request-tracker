/**
 * tests/make-prf-demo.js - dev only:  node tests/make-prf-demo.js
 *
 * Builds a tiny made-up PRF log folder (demo-data/prf-logs/, git-ignored)
 * with the same layout as a real Zeta run, so the PRF page can be tried
 * without real data: pick the BU-01 folder, paste the path below, scan.
 * Pasted path:  L:\LabData\Chiplet4Future\FHR0020\19197\BU-01
 * (project Chiplet4Future, part FHR0020, lot 19197 - all made up).
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'demo-data', 'prf-logs', 'BU-01');

function roughness(site) {
  const rows = [];
  for (let i = 0; i < 3; i++) {
    rows.push((0.4 + site * 0.01 + i * 0.002).toFixed(3) + ', ' + (0.5 + site * 0.01 + i * 0.003).toFixed(3));
  }
  return 'Ra, Rq\n' + rows.join('\n') + '\n';
}

function via(site) {
  const rows = [];
  for (let i = 0; i < 3; i++) {
    rows.push((i + 1) + ', ' + (10 + site + i * 0.5).toFixed(1) + ', ' + (20 + i * 0.4).toFixed(1) + ', ' + (45 + i).toFixed(1));
  }
  return 'Index, CenterX, CenterY, MajorAxis\n' + rows.join('\n') + '\n';
}

const files = {
  'Panel 1/Front/log': { 'Ra_Site1.txt': roughness(1), 'Ra_Site2.txt': roughness(2), 'Via_Site1.txt': via(1), 'Via_Site2.txt': via(2) },
  'Panel 1/Back/log': { 'Ra_Site1.txt': roughness(1), 'Via_Site1.txt': via(1), 'Operator_Notes.txt': 'made-up demo folder: this file matches nothing, on purpose.\n' },
  'Panel 2/Front/log': { 'Ra_Site1.txt': roughness(1), 'Via_Site3.txt': via(3) },
  'Panel 2/Back/log': { 'Ra_Site2.txt': roughness(2), 'Via_Site1.txt': via(1), 'Via_Site2.txt': via(2) }
};

fs.rmSync(path.join(__dirname, '..', 'demo-data', 'prf-logs'), { recursive: true, force: true });
Object.keys(files).forEach((dir) => {
  fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
  Object.keys(files[dir]).forEach((name) => {
    fs.writeFileSync(path.join(ROOT, dir, name), files[dir][name]);
  });
});
fs.writeFileSync(path.join(ROOT, 'README.txt'),
  'Made-up PRF demo folder (tests/make-prf-demo.js). Pick THIS folder (BU-01)\n' +
  'on the PRF page and paste  L:\\LabData\\Chiplet4Future\\FHR0020\\19197\\BU-01\n' +
  'as its full path. Every value in here is invented.\n');
const count = Object.keys(files).reduce((n, d) => n + Object.keys(files[d]).length, 0);
console.log('prf demo ok (' + count + ' files under ' + ROOT + ')');
