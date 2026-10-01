# MAP — every file, what it does, who owns it

Written 2026-09-29 (M10 audit). Layers from CLAUDE.md: rules & maths
(`domain.js`), data (`store.js`), read caches, components (`js/ui/`),
screens (`js/views/`, `js/app.js`), adapters, config, themes.

## Rules & maths — pure functions, no DOM, no store

| file | purpose |
|---|---|
| `js/domain.js` | Every rule: transitions, permissions, visibility, working-time clock, IDs, validation, health issues, Hirata decode. The only place decisions are made. |

## Data — the only writer

| file | purpose |
|---|---|
| `js/store.js` | Loads/saves `mrt_data.json` via the storage adapter, revision gate, daily backups + restore, undo, audit log, all writes as Promises. Screens never touch data directly. |
| `js/seed.js` | First-run reference data (tools, types, BKMs, projects, calendar...). Live data never; people never. |
| `js/demo-data.js` | `MRT.demoData()` — 107 requests + office for testing ("Fill with demo data", perf guard). |

## Read caches — feed domain from store

| file | purpose |
|---|---|
| `js/analytics.js` | Filter defaults + levels for the Analytics page. |
| `js/summaries.js` | (listed in CLAUDE.md; not present — summaries live in views/analytics via `js/analytics.js`. If re-added, it belongs here.) |

## Screens — compose components, call store writes

| file | purpose |
|---|---|
| `js/app.js` | Shell: router (+ error page), menu, save lamp + Undo, user menu, themes, shortcuts, search, bell, alert strip. |
| `js/identity.js` | `MRT.identity.detect()` — the ONE reader of `?who=` / launcher ID. |
| `js/exporter.js` | CSV/XLSX downloads (request rows, audit...). |
| `js/excel-bridge.js` | Master-Excel import: validate all rows, all-or-nothing save. |
| `js/views/lab.js` | Lab status: tool plates with glyphs + set-status. |
| `js/views/queue.js` | My queue: QE work list, bulk actions, paging. |
| `js/views/requests.js` | My requests + "To analyze (all tools)" for analysts. |
| `js/views/request.js` | One request: traveller card, rail, timeline, owner buttons. |
| `js/views/request-actions.js` | Workflow buttons + dialogs, shared by request/queue/requests/board. |
| `js/views/new.js` | Request wizard: tool → lot → where → urgency → details → review; drafts; edit-submitted. |
| `js/views/lots.js` | Lot register + list. |
| `js/views/board.js` | Board wall: lanes × status columns. |
| `js/views/hirata.js` | Hirata decoder page. |
| `js/views/slip.js` | A6 print slip with barcode. |
| `js/views/templates.js` | Request templates: save/list/apply. |
| `js/views/extra-fields.js` | Per-tool extra field rendering in the form. |
| `js/views/analytics.js` | Analytics: My work / My requests / Lab / Management tabs. |
| `js/views/help.js` | In-app Help page. |
| `js/views/home.js` | Home: gated card grid into every page, live counts from existing functions. |
| `js/views/settings.js` | Settings shell: admin gate + PIN lock. |
| `js/views/settings-health.js` | Health: setup to-do + data issues. |
| `js/views/settings-users.js` | People: roles, Windows IDs, review. |
| `js/views/settings-tools.js` | Tools: QEs, types, fields, BKMs, status. |
| `js/views/settings-lists.js` | Projects, part numbers, priorities, places... |
| `js/views/settings-lots.js` | Lot admin (fields, owners). |
| `js/views/settings-calendar.js` | Working hours, holidays, closing days. |
| `js/views/settings-audit.js` | Audit log viewer + download. |
| `js/views/settings-data.js` | File, backups + restore, demo/empty, Excel import. |
| `js/views/settings-look.js` | Office theme default. |

## Components — build DOM, format, animate (never read store)

| file | purpose |
|---|---|
| `js/ui/core.js` | `el`, mount, form primitives. |
| `js/ui/components.js` | panel, button, field, segmented, toggle, tabs, table, KPI... |
| `js/ui/overlays.js` | dialog, toast, tooltip, menu. |
| `js/ui/charts.js` | Chart.js wrapper: themed, gradients, expand, click-through. |
| `js/ui/glyphs.js` | Tool drawings (HRM, AOI, PRF, QVM, FIB...). |
| `js/ui/heatmap.js` | Calendar heatmap. |
| `js/ui/panelmap.js` | Panel picker (unused since form v2; kept for Q22). |
| `js/ui/barcode.js` | Code 128 for slips. |
| `js/ui/magazine.js` | Magazine slot picker. |
| `js/ui/scene3d.js` | Home hover-scene engine: one shared renderer, lazy THREE, full disposal, static fallback. |
| `js/ui/scenes/*.js` | One hover scene each (`create(ctx)` → `{scene, camera, update, dispose}`; engine renders), ≤ ~250 lines: `aoi` (9 s scan + red flash), `bars` (9.5 s breathe + bright flash), `dice` (7.5 s turn + answer pip). |
| `js/ui/traveller.js` | Traveller card (full/mini/card/slip sizes). |
| `js/ui/hirata.js` | Copper panels, decoded fields, dot grid. |
| `js/ui/theme-gallery.js` | Theme picker cards. |

## Adapters — the only modules that talk outside

| file | purpose |
|---|---|
| `js/adapters/storage-folder.js` | File System Access: read/write/list/remove. The ONLY filesystem touchpoint (M10 grep proof). |
| `js/adapters/mail.js` | Outlook draft via `mailto:` (later: server SMTP). |
| `js/config.js` | Picks the adapters (`folder`/`api`, `outlook-draft`/`smtp`, `off`/`local-llm`) + file names, limits, time zone. No secrets. |

(`ai.js` does not exist yet — config `ai: 'off'`, OPEN_QUESTIONS #11.)

## Themes, style, shell

| file | purpose |
|---|---|
| `js/themes.js` | All 6 themes' tokens + retired-key aliases. The only place themes live. |
| `css/app.css` | All styling; keys on `data-scheme`/`data-contrast`, never a theme name (guarded). |
| `index.html` | Shell + `<script src>` list in dependency order. |
| `ui-kit.html` + `js/ui-kit.js` | Component gallery, every state, every theme. |
| `Metrology Tool.cmd` | Share launcher: opens the app, passes `%USERNAME%`. |
| `vendor/chart.umd.min.js` | Chart.js 4, local copy. |
| `vendor/xlsx.full.min.js` | SheetJS, local copy (CSV fallback without it). |
| `vendor/three.min.js` + `three.README.md` | Three.js r160 UMD (last UMD release), lazy-loaded on first Home hover only. |

## Tests (dev only, `node tests/<file>.js`)

| file | purpose |
|---|---|
| `tests/tests.js` + `run-tests.js` | 683 unit tests (same set as `test.html`). |
| `tests/test.html` | Browser harness Prince opens. |
| `tests/app-smoke.js` | 303-check persona walkthrough in a fake browser. |
| `tests/ui-smoke.js` | Every component/state built + clicked in a fake DOM. |
| `tests/dom-budget.js` | M8: render ms + node counts per view, paging guard. |
| `tests/css-check.js` | Brace balance, required selectors, no theme names in CSS. |
| `tests/contrast.js` | WCAG AA every pair × every theme + status separation. |
| `tests/preview-smoke.js` + `preview.js`/`preview.html` | Preview page checks. |
| `tests/a11y-audit.js` | Accessibility audit. |
| `tests/fake-dom.js` | The fake browser. |
| `tests/scene3d.js` | Engine fallback path + 50-cycle hover/leave leak test (stub THREE). |
| `tests/scenes.js` | Scene contract: register, loop sweep + resize, dispose empties, size cap (fake THREE). |
| `tests/memory-storage.js` | In-memory storage adapter (proves the adapter interface swaps). |
| `tests/make-demo-data.js`, `make-preview.js` | Generators. |

## Docs

`CLAUDE.md` (working agreement) · `DECISIONS.md` (agreed decisions) ·
`DESIGN_RULES.md` (STEP 2 foundation: shape, type, spacing, elevation, colour roles) ·
`OPEN_QUESTIONS.md` (parked items) · `OFFICE_SETUP.md` (seed changelog) ·
`README.md` · `ROADMAP.md` · `CONTRIBUTING.md` · `AUDIT.md` · `TEST_RUN.md` ·
`MILESTONE_1..10.md` · `FINAL_REPORT.md`.
