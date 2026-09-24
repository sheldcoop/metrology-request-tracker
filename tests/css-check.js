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
  glyph: ['.tool-glyph .tg-beam', '.tool-glyph.is-live', '.tool-glyph.is-off', '.tool-glyph.is-maint'],
  shell: ['.topbar', '.nav-item', '.save-led', '.undo-btn', '.alert-banner', '.gate-card', '.nav-item.is-soon', '.gate-error'],
  lab: ['.tool-plate::before', '.tool-plate-facts', '.lab-grid'],
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
