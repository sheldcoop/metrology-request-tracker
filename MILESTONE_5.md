# MILESTONE 5 — Engineer flow: COMPLETE

Engineer journey walked end to end (New → Submit → Edit → Cancel → Track).
One real bug found and fixed; the rest verified already solid.

## Fix: submit assigned to a deactivated primary (Medium)
- `assignOnSubmit` (`js/domain.js`) ignored `active`: a deactivated primary
  still received every new request, with no timeline note.
- Now: inactive/missing/away primary falls through to an available backup with
  a timeline note ("Olga is deactivated - assigned to the backup, Otto").
  Both unavailable → stays with the primary (unchanged fallback).
- 3 new unit tests (`tests/tests.js`): deactivated primary, no primary set,
  nobody set. Suite: 678 → 681, all green.

## Verified, no change needed
- Priority tabs render from the store list; adding lives in Settings only
  (`js/views/new.js` paintUrgency, comment dated 2026-09-28). `needs_reason`
  enforced in `domain.requestProblems`, not just UI.
- Panel entry modes: "Hirata IDs" vs "How many" — count mode hides the Hirata
  box (app-smoke "How many asks a number..."). Count-only submit valid (F-1).
- Engineer button set on a request: Edit (canEditSubmitted), Cancel
  (canCancel), Copy, Print + workflow bar Answer only under clarification —
  all domain-gated; app-smoke "Edit, Cancel, Copy, Print - and no workflow
  bar" and "only Answered appears" cover it.
- Reopen: store-level tested (needs reason, accepted + reopened=1, no reopen
  after analyze). Reopen *button* visibility covered in app-smoke; full
  reopen click-through left out (would need a second full request cycle in
  the smoke script; store path is the trusted one).
- Request numbers: per tool per day, running, cancelled numbers never reused
  (taken = all requests). Second FIB request gets -02, covered in app-smoke.
- Draft privacy (Q33), delete-draft, edit-submitted with reason + timeline
  diff: all covered in app-smoke.

## Gates
run-tests 681, app-smoke, ui-smoke, css-check, contrast, preview-smoke green.
