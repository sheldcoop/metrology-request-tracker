/**
 * tests/css-check.js - dev only, no dependencies:  node tests/css-check.js
 *
 * Guards css/app.css against the easy-to-miss breakages: unbalanced braces
 * (everything after them silently stops applying) and a component's rules
 * going missing in an edit. Exits 1 on failure. It also checks that no rule
 * keys on a theme's name: themes live in js/themes.js, the CSS keys on
 * data-scheme / data-contrast only.
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
  tokens: [':root, [data-theme]', '[data-scheme="light"]', '[data-contrast="high"]'],   // the theme colours: js/themes.js
  themeGallery: ['.tg-card.is-on', '.tg-sample', '.tg-s-lamps .is-ok'],
  statusIcons: ['--ic-ok:', '--ic-warning:', '--ic-critical:', '--ic-late:', '--ic-blocked:', '--ic-hot:', '.chip:is(.ok, .warning, .critical, .expired, .blocked)::before',
                '.led:is(.ok, .warning, .critical, .expired, .blocked)::before', ':is(.q-clock, .tr-clock).is-late::before', '.prio-1 .bcard-prio::before', '.st-ic.is-expired', '.tool-plate-facts dd.is-late::before'],
  panel: ['.panel-head', '.panel-title'], led: ['.led.live::after'],
  buttons: ['.btn-primary', '.btn-danger', '.btn-ghost'], segmented: ['.seg-opt input:checked + span'],
  field: ['.ifield-box', '.ifield.is-invalid'], chip: ['.chip.expired'],
  kpi: ['.kpi-tile-value'], table: ['table.grid th'], tabs: ['.tab-ink'], dialog: ['dialog.modal'],
  toast: ['.toast-progress'], tooltip: ['.tip-card'], menu: ['.menu-item'],
  chart: ['.chart-box'], heatmap: ['.heat-cell::after', '.heat-scale'],
  glyph: ['.tool-glyph .tg-beam', '.tool-glyph.is-off', '.tool-glyph.is-maint', '.tool-glyph.is-live .tg-spin', '.tool-glyph.is-off .tg-lamp',
          '.tool-glyph .tx-alert', '.tool-glyph .tx-detail', '.tool-glyph.is-off .tx-work', '.tool-glyph:hover .tx-detail',
          '.tool-glyph .tx-raster', '.tool-glyph .tx-sweep', '.tool-glyph .tx-glide', '.tool-glyph .tx-turn', '.tool-glyph .tx-draw'],
  shell: ['.topbar', '.nav-item', '.save-led', '.undo-btn', '.alert-banner', '.gate-card', '.nav-item.is-soon', '.gate-error'],
  lab: ['.tool-plate::before', '.tool-plate-facts', '.lab-grid'],
  lots: ['.lots-tools', '.cell-note'],
  request: ['.req-layout', '.tool-bank', '.tool-bench::after', '.tool-bank .tool-pick-opt.is-on::after', '.tool-pick-opt.is-on', '.traveller-mini::before', '.req-errors', '.wz-step.is-done .wz-no', '.wz-dot.is-now', '.lot-main-row', '.layer-chip.is-on', '.panel-chip.is-scrapped'],
  queue: ['.queue-bulk', '.q-clock.is-late', '.queue-list', '.qbox', '.qbox.prio-1::before', '.qgroup', '.qbox.is-done', '.done-today'],
  board: ['.board-lanehead', '.bcard-id', '.bcard-prio', 'dialog.drawer[open]', '.bcard.is-urgent::after', '.bcard::before'],
  slip: ['.slip::before', '.slip-code .barcode', '.slip-warn'],
  bell: ['.bell-count', '.bell-btn'],
  magazine: ['.mz-frame', '.mz-slot.is-picked .mz-panel', '.mz-slot.is-taken .mz-panel'],
  requestPage: ['.traveller.is-urgent::after', '.tr-stamp', '.status-rail', '.rail-step.is-now .rail-dot', '.timeline', '.mention'],
  panelmap: ['.panel-map', '.pm-cell.is-picked::after', '.pm-cell.is-scrapped', '.pm-cell::before'],
  form: ['.form-grid', '.form-checks', '.modal-error'],
  analytics: ['.an-kpis', '.an-grid', '.kpi-tile.is-link', '.link-btn'],
  hirata: ['.cu-panel', '.cu-hole', '.hf-item', '.hg-cell.is-locked', 'print-color-adjust: exact', '.panel-zoom', 'button.panel-hirata-item'],
  help: ['.help-layout', '.help-steps li::marker', '.help-roles', '@media print'],
  settings: ['.sample-tag', '.row-actions', 'tr.is-off', '.setup-note', '.lock-panel', '.settings-cols', 'tr.is-bad', 'tr.is-change'],
  motion: ['[data-motion="reduce"]', '.offscreen']
};
for (const [comp, sels] of Object.entries(REQUIRED)) {
  for (const s of sels) if (!css.includes(s)) { console.log('missing', comp + ':', s); bad++; }
}
// print hides everything clickable, so paper never shows buttons, bars, dialogs or popups
const printCss = css.slice(css.indexOf('@media print'));
['button, .req-actbar, dialog, .menu, .search-results'].forEach(s => { if (!printCss.includes(s)) { console.log('missing print rule:', s); bad++; } });
const byName = css.split('\n').map((l, i) => [l, i + 1]).filter(x => /\[data-theme="/.test(x[0]) && !/^\s*(\/\*|\*)/.test(x[0]) && x[0].indexOf('live in ONE place') === -1);
byName.forEach(x => { console.log('line', x[1], 'keys on a theme name - use data-scheme / data-contrast, or put colours in js/themes.js'); bad++; });
console.log(bad ? bad + ' problem(s)' : 'css ok');
if (bad) process.exitCode = 1;
