# MILESTONE 10 — Adapters, docs: COMPLETE

## Storage boundary: proven, one gap closed
- `grep` over `js/` for every filesystem/network API (`FileSystem*`,
  `fetch`, `XMLHttpRequest`, `IndexedDB`) hits exactly one file:
  `js/adapters/storage-folder.js`. The store reaches it only through
  `adapter()` → `read/write/list/remove/connect/reconnect/...`.
- `tests/memory-storage.js` implements the same interface and powers every
  test — the swap is proven in practice, not just on paper.
- Gap found + fixed: the store hardcoded `adapters.storageFolder` instead
  of reading `config.adapters.storage`. Now config-driven (`api` →
  `storageApi`), so swapping in `storage-api.js` touches exactly:
  1. NEW `js/adapters/storage-api.js` (same 12-method interface),
  2. `index.html` (one `<script>` line),
  3. `js/config.js` (`storage: 'api'`).
  No store, view, or domain edit needed. Full suite green after the change.
- `localStorage` users (`app.js` prefs, `themes.js`, `identity.js`,
  `ui-kit.js`) hold per-PC preferences only — no live data, unaffected by
  the server move.

## Mail boundary: clean
- `mailto:` exists only inside `js/adapters/mail.js`; the single caller is
  `request-actions.js` via `adapters.mail.draft()`. SMTP later = this one
  file. No `ai.js` yet (config `off`, open #11).

## Docs
- NEW `MAP.md`: every file → purpose → owner layer (incl. the note that
  `js/summaries.js` from CLAUDE.md does not exist — analytics reads live
  in views via `js/analytics.js`).
- `DECISIONS.md`: H-1..H-10 entry with this pass's calls.
- `OPEN_QUESTIONS.md`: Q30 (admin analytics, Medium) + Q31 (clarification
  nudge, Low) from M7; Q13–14 untouched as asked. No new M10 questions —
  the server blockers (#8, #9, #12) already cover it.

## Gates
Full suite green; counts in FINAL_REPORT.md.
