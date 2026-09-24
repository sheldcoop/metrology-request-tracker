/**
 * tests/css-check.js - dev only, no dependencies:  node tests/css-check.js
 *
 * Guards css/app.css against the easy-to-miss breakages: unbalanced braces
 * (everything after them silently stops applying) and a component's rules
 * going missing in an edit. Exits 1 on failure.
 */
const fs = require('fs'), path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'css/app.css'), 'utf8');

let depth = 0, line = 1, bad = 0;
for (const ch of css) {
  if (ch === '\n') line++;
  if (ch === '{') depth++;
  if (ch === '}' && --depth < 0) { console.log('unbalanced } at line', line); bad++; depth = 0; }
}
if (depth) { console.log('unclosed { at end of file'); bad++; }

// one or more key selectors per component; add yours when you add one
const REQUIRED = {
  tokens: [':root', '[data-theme="light"]', '[data-theme="hc"]'],
  panel: ['.panel-head', '.panel-title'], led: ['.led.live::after'],
  buttons: ['.btn-primary', '.btn-danger', '.btn-ghost'], segmented: ['.seg-opt input:checked + span'],
  field: ['.ifield-box', '.ifield.is-invalid'], chip: ['.chip.expired'],
  kpi: ['.kpi-tile-value'], table: ['table.grid th'], tabs: ['.tab-ink'], dialog: ['dialog.modal'],
  toast: ['.toast-progress'], tooltip: ['.tip-card'], menu: ['.menu-item'],
  chart: ['.chart-box'], heatmap: ['.heat-cell::after', '.heat-scale'],
  glyph: ['.tool-glyph .tg-beam', '.tool-glyph.is-off', '.tool-glyph.is-maint', '.tool-glyph.is-live .tg-probe', '.tool-glyph.is-live .tg-scan',
          '.tool-glyph.is-live .tg-stylus', '.tool-glyph.is-live .tg-reticle', '.tool-glyph.is-live .tg-raster', '.tool-glyph.is-off .tg-lamp'],
  shell: ['.topbar', '.nav-item', '.save-led', '.undo-btn', '.alert-banner', '.gate-card', '.nav-item.is-soon', '.gate-error'],
  lab: ['.tool-plate::before', '.tool-plate-facts', '.lab-grid'],
  lots: ['.lots-tools', '.cell-note'],
  request: ['.req-layout', '.tool-pick-opt.is-on', '.traveller-mini::before', '.req-errors', '.wz-step.is-done .wz-no', '.wz-dot.is-now', '.lot-line', '.layer-chip.is-on', '.panel-chip.is-scrapped'],
  queue: ['.q-row.is-late > td', '.queue-bulk', '.q-clock.is-late'],
  board: ['.board-cell.is-target', '.board-cell.is-dim', '.bcard.is-urgent::after', '.bcard::before'],
  slip: ['.slip::before', '.slip-code .barcode', '.slip-warn'],
  bell: ['.bell-count', '.bell-btn'],
  magazine: ['.mz-frame', '.mz-slot.is-picked .mz-panel', '.mz-slot.is-taken .mz-panel'],
  requestPage: ['.traveller.is-urgent::after', '.tr-stamp', '.status-rail', '.rail-step.is-now .rail-dot', '.timeline', '.mention'],
  panelmap: ['.panel-map', '.pm-cell.is-picked::after', '.pm-cell.is-scrapped', '.pm-cell::before'],
  form: ['.form-grid', '.form-checks', '.modal-error'],
  help: ['.help-layout', '.help-steps li::marker', '.help-roles', '@media print'],
  settings: ['.sample-tag', '.row-actions', 'tr.is-off', '.setup-note', '.lock-panel', '.settings-cols'],
  motion: ['[data-motion="reduce"]', '.offscreen']
};
for (const [comp, sels] of Object.entries(REQUIRED)) {
  for (const s of sels) if (!css.includes(s)) { console.log('missing', comp + ':', s); bad++; }
}
console.log(bad ? bad + ' problem(s)' : 'css ok');
if (bad) process.exitCode = 1;
