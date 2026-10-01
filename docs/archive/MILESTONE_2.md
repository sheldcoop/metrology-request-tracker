# Milestone 2 — Store layer: COMPLETE

Date: 2026-09-29. Branch: `m2-store`.

## Verdicts (evidence, not belief)

- Concurrent writes: EXISTS. Revision check on every save refuses stale
  writes with a named message (`store.js:save`, `revision_conflict`).
  Tested (`tests/tests.js` saving group).
- Atomic writes: PARTIAL-BY-PLATFORM, SAFE. File System Access has no
  rename API, so literal temp+rename is impossible; atomicity comes from
  the API's commit-on-close plus the store's own prev-copy before every
  save (`mrt_data.prev.json`) and torn-write recovery on load
  (`recoveredFromPrev`). Tested: torn data file recovers from prev; two
  torn copies refuse with `bad_json` and leave files untouched (no wipe).
- Corrupted JSON: EXISTS. Same tests as above.
- Backup restore: EXISTS. Daily backups + restore, tested end-to-end
  (backups group).
- Undo: FIXED + TESTED. Single-change undo existed and is tested. Bulk
  operations used to leave N undo units (undo reverted only the last
  item); new `beginUndoGroup`/`endUndoGroup` makes a bulk op one unit.
  `queue.runAll` (Accept / Receive & start / Start all) is wrapped.
  Tested in unit (2 saves, one undo) and smoke (Accept all 2, undo,
  both back, re-accept).
- Adapter boundary: CLEAN. Only `js/adapters/storage-folder.js` calls
  File System Access / IndexedDB APIs. `store.js:241` defaults the
  adapter, `app.js:153` wires it. No view touches files. (Adapter
  selection is hardcoded, not config-driven — see M10.)

## Files changed

- `js/store.js`: undo groups + exports.
- `js/views/queue.js`: `runAll` wrapped in one undo unit.
- `tests/tests.js`, `tests/app-smoke.js`: group + bulk-undo tests.

## Gates

670/670 unit, app-smoke 302, ui-smoke ok, css ok, contrast 0, preview 13.
