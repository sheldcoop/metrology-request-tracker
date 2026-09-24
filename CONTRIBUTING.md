# Contributing to the Metrology Request Tracker

Short rules that keep the code small, layered and consistent (the same
philosophy as ABF Tracker). Read this before changing a screen. The working
agreement with Prince is in `CLAUDE.md`; decisions in `DECISIONS.md`.

## 1. Layers - who may do what

| Layer | Files | May | May not |
|---|---|---|---|
| Rules & maths | `js/domain.js` | pure functions, unit suffixes (`_h`, `_ts`, `_ymd`), `now_ts` passed in | touch the DOM, the store, `Date.now()` |
| Starting data | `js/seed.js` | the values of a brand-new data file; fake ones marked `sample: true` | people (no personal data on GitHub) |
| Data | `js/store.js` | the ONLY writer: validate (via domain), audit, save, backups, undo; every write returns a Promise | format for display |
| Storage | `js/adapters/storage-*.js` | read/write text (today a folder; later an API) | know what is in the text |
| Identity | `js/identity.js` | say who is at the keyboard (`detect()`) | anything else |
| Components | `js/ui/*.js` | build DOM, format, animate | read the store or call domain |
| Screens | `js/views/*.js`, `js/app.js` | compose components, call store writes | re-implement rules, write data directly |

- New rules go into `domain.js` **with a test** in `tests/tests.js`.
- Who may measure is decided in one place: `domain.canMeasure()` (today: the
  Quality engineer role). Never test a role name for that in a screen.
- Nothing hard-coded: file names, times, adapter choice live in
  `js/config.js`; everything a person edits lives in Settings.
- Never put passwords, keys or tokens in the repo, `config.js` or the data file.

## 2. The 1 s ticker

`view.tick()` runs every second. It may only change **text**. Never
re-render a panel or rebuild data in a tick.

## 3. Components - use, don't rebuild

| Need | Use |
|---|---|
| a box with a title | `ui.panel({title, icon, status, actions, body})` |
| a button | `ui.button(label, {kind: 'primary'|'danger'|'ghost', icon, size, onClick})` |
| a choice of 2-5 | `ui.segmented({label, options, value, onChange})` |
| a tick box / switch | `ui.toggle({label, checked, kind: 'switch'})` |
| one input | `ui.field({label, type, unit, hint, options, multiline})` + `setState('valid'|'invalid', msg)` |
| a form (dialogs, later the request form) | `ui.form(specs, values)` -> `values()`, `setError(key, msg)`; kinds: text, longtext, number, date, email, password, path, select, check, checks; `showIf` |
| a tool drawing | `ui.toolGlyph(key, {size, state: 'idle'|'live'|'maint'|'off', label})` |
| a status | `ui.statusChip(status)`, `ui.led(status, label)` |
| a number that matters | `ui.kpiTile({label, value, status, icon, sub})` |
| a chart | `ui.chart(theme => config, {height, onPick, format, expand: true})` |
| a grid of counts | `ui.heatmap({rows, cols, values, label, unit})` |
| tabs / dialog / toast / tooltip / menu | `ui.tabs`, `ui.dialog` (with `submit` to keep it open on an error), `ui.confirm`, `ui.promptReason`, `ui.toast`, `ui.bindTips`, `ui.menu` |
| copy a share path | `ui.copyText(text, label)` |
| nothing to show | `ui.emptyState({icon, title, text})` |
| Settings tables and dialogs | `MRT.settingsKit` (`table`, `editDialog`, `deleteButton`, `copyButton`, `sampleTag`) |

A new component goes into `js/ui/`, into `ui-kit.html` (all its states,
`js/ui-kit.js`) and into this table. A new Settings tab is its own file
`js/views/settings-<name>.js` that registers in `MRT.settingsTabs`.

## 4. Styling

- Colours only through tokens (`var(--ok)`, `var(--warning-fg)`, ...). No hex
  in component rules (print is the one exception). Fill colours for bars and
  glows; `-fg` variants for small text; errors and destructive actions use
  `--danger`.
- Tool status: Up = OK green, Maintenance = Warning amber, Down = Expired red.
  Made-up data: the dashed amber "Sample" tag.
- 8 px spacing grid; `--radius` for inputs, `--radius-panel` for panels.
- Numbers and paths in `.mono` / `.num` (Cascadia Mono, tabular).

## 5. Motion

- Animate only `transform` and `opacity` (SVG fill/stroke where needed).
- Check `ui.reducedMotion()` before starting JS motion; CSS is covered by the
  global switches. Long-running animations get `ui.watchOffscreen(node)`.
- Entrances use `animation-fill-mode: backwards`, never `both`.

## 6. Safety

- User text never reaches `innerHTML`: use `ui.el(..., {text})`.
- No inline `onclick` in markup; delegate with `[data-action]` or use
  `el(..., {onclick})`.
- No new libraries, no CDN. Optional vendor files live in `vendor/` and the
  app works without them.
- Live data never goes into git; commit files by name, never `git add -A`.

## 7. Checks before a commit

```
node tests/run-tests.js         every domain + store rule (the same as tests/test.html)
node tests/app-smoke.js         the real app in a fake browser: first run, sign-up, Settings, Help, errors
node tests/preview-smoke.js     the preview boots; preview.html matches index.html
node tests/ui-smoke.js chart    every component and the kit build and react
node tests/css-check.js         braces balance, every component's rules present
node tests/contrast.js          every text token pair passes WCAG AA, 3 themes
node tests/make-preview.js      after changing index.html (regenerates tests/preview.html)
```

In the browser (Prince):

```
tests/test.html                         ALL ... TESTS PASSED
ui-kit.html (?mode=all)                 every component, every state, every theme
tests/preview.html                      the real app on demo data (see tests/preview.js for ?as= ?theme= ...)
tests/preview.html?audit=1              accessibility audit: console "AUDIT ..." lines, 0 findings wanted
tests/preview.html#/settings/tools?audit=1&theme=hc   the same for any page and theme
tests/preview.html?perf=1               render and tick times: console "PERF ..." lines
```

## 8. Budgets

| | budget |
|---|---|
| any page render | < 150 ms |
| the 1 s tick | < 5 ms, text only |
| DOM nodes on a page | < 10 000 |
| lists | paged (100 rows, "Show more") |

The accessibility audit must report 0 findings on every page and dialog in
all three themes. Every form field needs a label (`ui.linkLabels` runs after
each render); clickable rows need a real link or button in them.
