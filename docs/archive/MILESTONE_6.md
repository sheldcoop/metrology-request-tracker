# MILESTONE 6 — QE flow: COMPLETE

QE journey verified; stuck-state detection built (was missing).

## Built: stuck-on-hold flag (M6 DoD, was missing)
- `domain.healthIssues` now warns per request on hold longer than
  `STUCK_HOLD_DAYS = 7`: "FIB-260910-01: on hold for 13 days (since
  2026-09-10) - check with the lab", tab `request`, severity `warning`.
- Hold start comes from the latest status→on_hold timeline event — no schema
  change, works for holds placed before this release.
- The Health page renders `issues` generically and already links tab
  `request`, so the warning appears with zero view changes.
- 2 new unit tests: old hold flagged, 1-day hold and resumed request quiet.
  Suite: 681 → 683, all green.
- Architect note: only On hold is flagged, not Needs clarification — a
  clarification waits on the engineer, the lab is not stuck. Open question
  for Prince whether clarification > N days should nudge the requester.

## Verified, no change needed
- Full legal cycle at store level: accept → hold → resume → receive →
  clarify → answer → start → complete → reopen → analyze, each illegal step
  refused (`not_allowed`/`invalid`). Hold/clarify remember `return_to`;
  resume/answer restore it.
- Typed hold reasons auto-register into the list; reason ID kept on the
  event for analytics.
- Tool DOWN: warning-only at submit by design (Q44: never blocking) —
  tested for past-date, back-before-date, and no-until-date.
- Receive & start one-step UI maps onto the same two engine transitions;
  timeline keeps both entries.

## Gates
run-tests 683, app-smoke, ui-smoke, css-check, contrast, preview-smoke green.
