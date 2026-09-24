# Metrology Request Tracker - how we work

Engineers request measurements (HRM, AOI, PRF, QVM, FIB ...) on panels of a lot; lab operators
run them and hand back a results folder. Decisions: `DECISIONS.md`. Parked items: `OPEN_QUESTIONS.md`.
Sister project for reference: `../abf-tracker` (same author, same philosophy). Read it, never edit it.

## Working agreement (with Prince)
- **Plan first.** Before building, ask questions one at a time, give a recommended option, and wait
  for "done" / "got it". Never assume a requirement; unclear → ask. New unknowns go to OPEN_QUESTIONS.md.
- **Small steps.** Build one milestone step at a time; commit and push each step; Prince reviews.
- **Answers:** short, plain words, a few lines. Always recommend one option and say why.
- **Honesty:** say what was not checked. Never invent data, paths, values or datasheet numbers.
- **When unsure how to do something, look at `../abf-tracker` first** - it already solved most of it.
- **No browser runs by Claude** (Prince tests in the browser; it saves tokens). Claude runs only
  code-level checks: `node -e "new Function(require('fs').readFileSync(f,'utf8'))"` syntax checks,
  `node tests/css-check.js`, `node tests/contrast.js`, `node tests/ui-smoke.js`,
  `node tests/run-tests.js` (the same tests as `tests/test.html`), `node tests/app-smoke.js` (the
  real app in a fake browser on an in-memory folder: flows, not looks), and writes tests into
  `tests/tests.js` for Prince to open in `tests/test.html`. Headless Chromium or screenshots only when Prince asks.

## Git rules
- Local git only for now (no push); GitHub comes later.
- **Author:** Prince Khurana (set in this repo's git config). Never mention Claude or AI in commit
  messages, branch names or files: no "Co-Authored-By", no "Generated with".
- **Branches:** always start from `main`, with short human names like `settings-users` or
  `request-form`. Merge back into `main` once Prince approves the step.
- **Commit messages:** short and plain, the way a person writes them, e.g. "Add tool list to Settings".

## Philosophy
- **Every component looks like what it is, as if an engineer designed it.** Tool glyphs (FIB beam and
  cut, QVM optics, PRF stylus, AOI camera, HRM probe), a request drawn as a lab **traveller card** with
  a priority stripe and status stamps, the **panel map** for picking panels, the queue as a **lab board**
  with tool lanes. No generic cards where a real object fits.
- **Mission Control look:** dark theme first, glowing status, live countdowns; Light and High-contrast
  themes too. Desk PCs first (1920x1080, 1440x900).
- **Purposeful motion:** only `transform`/`opacity` animate; `[data-motion="reduce"]` and
  `prefers-reduced-motion` turn it off; pause off-screen animation. Same feel as ABF.
- **Everything configurable in Settings** (admin PIN): tools, measurement types per tool, per-tool
  extra fields, BKM library, projects, build-ups, operators (primary/backup), priorities, working
  hours/holidays, results roots, users + Windows IDs + roles. No code change to add a tool or field.

## Hard constraints
- Vanilla JS, classic `<script src>` in dependency order; runs from `file://` on the shared drive in
  Chrome/Edge. No frameworks, no CDN, no npm runtime, no server, no internet.
- Local vendor files only: `vendor/chart.umd.min.js` (Chart.js 4), optional `vendor/xlsx.full.min.js`
  (SheetJS; CSV fallback), a local QR/barcode generator.
- Fonts: system stacks ("Segoe UI Variable", "Segoe UI", system-ui); numbers "Cascadia Mono",
  Consolas, monospace, tabular-nums. Icons: inline SVG only. No emojis.
- Safety: user text never reaches `innerHTML` (use `el()`/textContent or `esc()`); event delegation
  via `[data-action]`; no inline `onclick` attributes.
- Time: Europe/Vienna; working-time clock for turnaround.

## Layers - who may do what
| Layer | Files | May | May not |
|---|---|---|---|
| Rules & maths | `js/domain.js` | pure functions (status transitions, working-time clock, turnaround, IDs), unit suffixes (`_h`, `_ts`), `now_ts` passed in | touch DOM, store, `Date.now()` |
| Data | `js/store.js` | the ONLY writer: JSON file on the share, validate, revision check ("someone else saved"), audit log, daily backups + restore, undo, delete-if-unused | format for display |
| Read caches | `js/summaries.js`, `js/analytics.js` | feed domain from store, memoise per data change / filter | own maths |
| Components | `js/ui/*.js` | build DOM, format, animate | read store, call domain |
| Screens | `js/views/*.js`, `js/app.js` | compose components, call store writes | re-implement rules |
`store.js` must stay swappable for a server + SQLite later without touching screens.

## Architecture - ready for a server later (not built now)
Future target: Node + SQLite + a small API, in Docker on the company server / Kubernetes. Rules
so that the move needs **no screen changes**:
- **All saving in `store.js`**, all rules in `domain.js`, screens never touch data. Screens call
  store functions that return Promises for every write (a server call is async too); reads come from
  the in-memory copy the store loaded. Today the store talks to a folder; later it talks to the API.
- **Data = clean, ID-based collections** (`users`, `tools`, ...). Every record has a stable `id`
  (prefix + random, e.g. `tool_k3f9...`) and a row `version`; references are by ID, never by name.
  The file carries `schema_version` + `revision`; every schema change is a numbered migration step.
  One collection maps to one SQLite table later. Timestamps ISO UTC, shown in Europe/Vienna.
- **Nothing hard-coded:** file names, folders, backup count, undo time, time zone, adapter choice
  live in `js/config.js` (program settings, no secrets); everything a person edits lives in Settings.
  No server names, share paths or URLs in code.
- **Adapters:** anything that talks to the outside sits behind one small module with one interface:
  `js/adapters/storage-folder.js` (today; later `storage-api.js`), `js/adapters/mail.js` (today:
  Outlook draft via `mailto:`; later: server SMTP), `js/adapters/ai.js` (today: off; later: our local
  LLM on ProKube). `config.js` picks the adapter. Screens call the adapter, never `fetch` directly.
- **Never** put API keys, passwords or tokens in the shared folder, in `config.js` or in the data
  file. Secrets exist only on the server later.
- Before any adapter talks to a server: check CORS from `file://`, which data may be sent, and IT
  approval (OPEN_QUESTIONS).

## Reuse from `../abf-tracker` (copy once, then this repo evolves on its own)
- `css/app.css` sections 1-4 (tokens for 3 themes, base, components, shell) and the motion rules.
- `js/ui/core.js, components.js, overlays.js, charts.js, heatmap.js` (panel, field, segmented, toggle,
  tabs, dialog, toast, tip card, menu, chart + full-screen expand, heatmap, empty state, linkLabels).
- `js/store.js` patterns: folder connect (File System Access), revision check, audit, backups +
  restore, undo, admin list delete-if-unused. `js/app.js` shell: router, collapsible nav, save lamp +
  Undo, user menu, themes, keyboard shortcuts, search. `js/exporter.js`. `js/views/help.js` pattern.
- Dev tooling: `tests/test.html` harness, `tests/preview.html` + `preview.js`, `tests/a11y-audit.js`,
  `contrast.js`, `css-check.js`, `ui-smoke.js`, `ui-kit.html` + `js/ui-kit.js`.
- Do NOT copy: hourglass, film roll, floor-life maths, Edge Offset, ABF data model.

## Must have (like ABF)
ui-kit.html (every component, all states, 3 themes) · tests for every domain/store rule · Settings ·
audit log · Health page · daily backups + restore · Undo (10 s, Ctrl+Z) · in-app Help page ·
keyboard shortcuts · collapsible menu · full-screen charts · exports · 3 themes.

## Identity
Launcher `Metrology Tool.cmd` on the share opens the app and passes `%USERNAME%`; admin maps Windows
IDs to users (roles: Engineer, Operator, Manager, Admin - several allowed). Unknown ID → "Who are you?"
once. Admin actions need the PIN.
- **Identity comes from ONE function**, `MRT.identity.detect()` in `js/identity.js`. Today it reads
  the launcher's `?who=`; later it reads the company SSO (Windows / Entra ID). Nothing else in the
  app reads `?who=`, `%USERNAME%` or a login token.
- Each user stores `windows_id` (lowercase, no domain, e.g. `pkhurana`), `domain` (optional, e.g.
  `CORP`) and `email` (optional, company address), all editable in Settings > Users. `detect()`
  returns `{windows_id, domain, email, source}`; the store matches by `windows_id` (+ domain when
  both are known) today, and by email or `DOMAIN\user` under SSO. `domain.js` normalises IDs
  (`CORP\PKhurana` -> `pkhurana` + `CORP`).
- **Roles stay in our app** (Engineer, Operator, Manager, Admin), never taken from SSO groups.

## Quality targets (Prince verifies in the browser)
`tests/test.html` all green · a11y audit 0 findings in 3 themes · page render < 150 ms ·
< 10 000 DOM nodes · 1 s tick < 5 ms, text-only updates · lists paged (100 rows).
