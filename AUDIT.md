# Holistic gap audit — 2026-09-28 (report only, nothing fixed)

Gates at audit time: 640/640 unit tests · app-smoke 285/285 · ui-smoke ok ·
css-check ok · contrast 0 fails · preview-smoke 13. Main == origin/main, tree clean.
Scale: EXISTS = works + covered · PARTIAL = works but untested, warn-only, or by-design limit ·
MISSING = absent.

## TIER 1 — Data safety
1. Concurrent writes, two users — PARTIAL. Last-writer protection exists
   (`store.js` save() re-reads; higher revision refuses `revision_conflict`;
   banner+reload in `js/app.js:804`, smoke-tested `tests/app-smoke.js:974-982`).
   No true two-adapter concurrency test in `tests/tests.js`.
2. Write atomicity — PARTIAL. Single `createWritable().write().close()`
   (`js/adapters/storage-folder.js:140-144`); no temp+rename, so a crash/power
   cut mid-write can tear the live file. Mitigation tested: damaged file is
   reported not overwritten (`tests/tests.js:1411`), restore from backup is
   tested end-to-end (same file:1214-1272).
3. Backup restore e2e — EXISTS. `store.js` restoreBackup + safety copies,
   `tests/tests.js:1214-1272` (restore, safety copy kept, never pruned).
4. Corrupted JSON recovery — EXISTS. `bad_json` refused on load
   (`tests/tests.js:1411`); recovery path = restore a backup (see 3).
5. State machine dead-ends — EXISTS. `domain.js:863` TRANSITIONS plus
   `store.js:1439` submitRequest (draft→submitted); clarification→answer→back,
   on_hold→resume→back, completed→reopen→accepted. Terminals (cancelled,
   analyzed) are intentional (`domain.js` isClosed).
6. ID collision entropy — PARTIAL. `store.js:73` newId = prefix +
   Date.now-base36 + 32-bit random; no collision test. User-facing
   request_no uniqueness IS enforced and tested (`tests/tests.js:1296`).
7. Scheduled backups — EXISTS (event-driven, no scheduler). Trigger: the first
   save of the day (`store.js` save() → dailyBackup). Nothing time-based exists.
8. Same-request concurrent edit — PARTIAL. File-level revision gate only: the
   loser is refused and must reload and redo (no lock, no merge).
   `store.js:441-444`, `js/app.js:804-834`.

## TIER 2 — Daily usability
9. Notifications — EXISTS. `domain.js` notificationsFor (@mentions, assignment,
   clarification), bell view, demo-tested (`tests/tests.js:1324`).
10. Bulk operations — EXISTS. Queue Accept all / Start all, sequential saves
    (`js/views/queue.js:111-121`, Q43).
11. Global search — EXISTS (`js/app.js` search across tools/types/BKMs/requests/
    lots/users; smoke `tests/app-smoke.js:113,361`).
12. RBAC in domain.js — EXISTS (hasRole/canAct/canMeasure/canAnalyze/canRequest,
    matrix-tested).
13. Identity flow — EXISTS. `js/identity.js` detect() reads launcher `?who=`;
    `domain.js:134-151` normalises `ATS\PKhurana` → id+domain. SSO later.
14. Undo after bulk — PARTIAL. Single-change undo for 10 s (`store.js:1964+`);
    bulk paths (import/replaceData/demo) use `undo:false` + safety copy instead.
    Bulk Accept undoes one request, not the batch.
15. Form draft auto-save — PARTIAL. Drafts + manual Save draft exist
    (`js/views/new.js:867,939`); no auto-save on input.
16. Deep linking — EXISTS (`#/request/<id>`, `#/lab/<tool>`, `#/queue/late`;
    smoke-navigated throughout `tests/app-smoke.js`).
17. Session restoration — EXISTS. Folder handle in IndexedDB
    (`js/adapters/storage-folder.js:44-72`), silent reconnect
    (`js/app.js` boot via hasSavedConnection/reconnect).
18. Multi-tab sync — EXISTS. 30 s poll (`js/config.js` revision_poll_ms),
    banner + auto-reload, smoke-tested (`tests/app-smoke.js:974-982`).

## TIER 3 — Polish
19. Empty states — EXISTS (`ui.emptyState` on every list/page).
20. Error message quality — PARTIAL (judgment). Specific messages + reason-required
    patterns throughout; no tone/consistency pass done.
21. Loading states — PARTIAL. `ui.skeleton()` exists (`js/ui/components.js:441`,
    kit-demoed); adoption per view not audited.
22. Tool DOWN routing — PARTIAL. Down/maintenance is warned, never enforced:
    `domain.js:1600` submitWarnings (Q44 shown, never blocking). A request CAN be
    submitted onto a down tool.
23. Working-time clock — PARTIAL. Vienna via Intl, holidays, lab calendar, all
    tested; DST edges specifically untested (3 mentions in `tests/tests.js`).
24. Help page — EXISTS (`js/views/help.js`, incl. Master Excel guide).
25. Print slip — EXISTS (`js/views/slip.js`, A6, barcode, print CSS).
26. Edge AND Safari — PARTIAL by design. Chromium-only (File System Access);
    `js/app.js:212` showUnsupported points at Edge. Safari can never run this
    architecture.
27. Crash recovery — PARTIAL. Page-level isolation (`js/app.js:553` render
    try/catch) + `unhandledrejection` (`js/app.js:1149`); no `window.onerror`.
28. Memory leaks over 8 h — MISSING. Nothing measured; design is tick-text-only
    but unproven.

## TIER 4 — Strategic
29. Audit log viewer UI — EXISTS (`js/views/settings-audit.js`, filter+search).
30. Health page — EXISTS (`js/views/settings-health.js`, setup to-do incl. QE
    coverage per tool).
31. Archive strategy — PARTIAL. Decided: yearly archive file, analytics-readable
    (`DECISIONS.md:12` Q40). Not built; no tracking item in OPEN_QUESTIONS.md
    (left untouched — report only).
32. Schema migration — EXISTS. Numbered MIGRATIONS to v11 (`store.js:288`),
    tested, pre-upgrade backup (`store.js:414`).
33. Audit log growth/pruning — MISSING. `audit_log` and `request_events` grow
    forever (`store.js:2003` "history only grows"); no cap, no archive, no
    pruning. Slow-burn file-size risk.
34. Search at 5,000 requests — PARTIAL. Big-file render timed in
    `tests/preview-smoke.js` (fake DOM); search itself unmeasured at scale.
35. Measured < 150 ms — PARTIAL. Measured in fake DOM only (e.g. `#/queue`
    39 ms); never measured in a real browser.
36. Test coverage gaps — PARTIAL (judgment). 640 tests + 285 smoke checks; gaps
    are exactly the PARTIALs/MISSINGs in this file.
37. Docs current — PARTIAL. DECISIONS.md/OPEN_QUESTIONS.md live (capacity C-1/C-2,
    M6 items); today's Excel bridge + restyle decisions are NOT yet recorded
    there (left untouched — report only).

## TIER 5 — Security & compliance
38. No user text in innerHTML — EXISTS. Rule comments in every ui module;
    innerHTML only for static PATHS/DRAW strings (`js/ui/core.js:146`,
    `js/ui/glyphs.js:226`); user text via textContent/`el()` (e.g. commentBody).
39. Admin PIN URL bypass — EXISTS. `#/settings/*` renders lock without role
    (`renderNotAdmin`) or PIN (`renderLock`, PIN per visit per user:
    `js/views/settings.js:23-35,73-84`); writes re-check `requireAdmin` in store.
40. No secrets — EXISTS. `js/config.js:9` bans secrets; none in repo (demo PIN
    is documented demo data).
41. Every action checks canAct() — EXISTS. requestAction/submitRequest/cancel/
    comment/tool-status/edit paths assert their domain predicate
    (`js/store.js`, `domain.js:74,851,896`).
42. Role escalation prevention — PARTIAL. Role writes go through admin-gated
    store paths (`requireAdmin`, `js/store.js:719,940,952`) + PIN page gate;
    first-run bootstrap (`createFirstAdmin`) and PIN strength unreviewed.
43. Role change propagation — PARTIAL. `recheckUser()` repaints from the live
    user object (`js/app.js:432`); cross-PC changes arrive via reload path (18).
    No explicit role-revocation drill.
44. GDPR / retention — MISSING. No deletion/anonymisation path for a leaver's
    name, Windows ID or email (deactivation flag exists; erasure does not);
    no retention rule recorded.
45. Excel import validation — EXISTS (as built today). resolve→validate→preview→
    atomic save; 10 committed tests (`tests/tests.js` Excel import group).

## TIER 6 — Bigger picture
46. QE onboarding — PARTIAL. Help covers roles + getting started; no guided
    first-run path.
47. Disaster recovery plan — PARTIAL. Daily backups + tested restore + Help
    "Updating the app" file-copy steps; no written RTO/RPO statement.
48. Bus factor — PARTIAL (judgment). Clean layers + recorded decisions; single
    author, Prince reviews each step.
49. Vendor exit — EXISTS. Zero runtime dependencies: vanilla JS, vendored
    Chart/SheetJS (offline), system fonts, inline SVG. Leaving Muse Code loses
    nothing; the repo builds nothing.
50. Attachments (panel photos) — MISSING. Only a "Later" roadmap mention
    (`js/views/help.js:335`).
51. Comment edit/delete + audit — MISSING. `addComment` only
    (`js/store.js:1486`); a typo is permanent.
52. Offline degradation — PARTIAL. `file://` is offline-native; share loss shows
    reconnect UI; no degraded-mode drill.
53. Accessibility — PARTIAL. `tests/a11y-audit.js` exists, shortcuts + focus
    styles exist; real-browser keyboard/focus-trap pass is Prince's step,
    not done.
54. Multi-user conflict UX — EXISTS (see 18).
55. Adapter boundary — EXISTS. Nothing outside `store.js` + `js/adapters/`
    touches the share (zero hits in views/ui/domain/analytics/exporter/bridge).
    Non-share locals: `localStorage` (theme last-used `js/themes.js`, per-PC
    prefs `js/app.js`, kit demo `js/ui-kit.js`), IndexedDB folder handle
    (`js/adapters/storage-folder.js`), user-picked file bytes
    (`js/excel-bridge.js` FileReader), launcher `?who=` (`js/identity.js`),
    `mailto:` (`js/adapters/mail.js`). Swap = new `storage-api.js` + one
    `js/config.js` flag; no view/domain/store change needed.
56. Lot linked to Project + Part Number — MISSING. A lot carries no
    project/part-number of its own (a migration deleted direct links:
    `js/store.js:363`); `lotProjects()` derives them from the lot's requests
    (`js/views/lots.js:31,153`). A lot is project-less until its first request.
