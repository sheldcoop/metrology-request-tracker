# MILESTONE 7 — Analyst & admin flow: COMPLETE

## Analyst walkthrough: verified end to end
- Analyst sees Completed/Analyzed across all tools (`canSeeRequest`),
  "To analyze (all tools)" panel in My requests (`requests.js`, gated by
  `canAnalyze`), Mark analyzed on the request — then stamp Closed.
- New app-smoke check (303 now): Ruth the analyst finds the completed
  request under "To analyze (all tools)" before signing it off.
- Edge checked: an analyst's own completed request is excluded from "To
  analyze" but still signable from their own list (row buttons include
  analyze). No bug.

## Admin: verified
- 15 store functions behind `requireAdmin` (role check in the store, not
  the view): restore, replace/import data, theme, user review, PIN change,
  all reference-data save/delete, sample lots/magazines, lot owner,
  calendar + holidays. Templates deliberately separate (`canSaveTemplate`).
- PIN: salted hash, asked once per Settings visit (`unlockedFor`);
  wrong PIN refused in the field (app-smoke). M3 proved no bypass.
- Q52 respected: Lab/Management analytics stay Manager-only even for
  admins — changing an agreed decision needs Prince (new Q30, Medium).

## EXISTS / PARTIAL / MISSING (DoD: flag, don't build)
- Audit log viewer: EXISTS (filter, newest-first paging, Download).
- Health page: EXISTS (setup to-do + issues incl. the new stuck-on-hold
  flag, fix-links per tab).
- Backup restore UI: EXISTS (daily list, one-click Restore, current file
  kept as safety copy first).
- Nothing missing among the three — no build items filed.

## Open questions added
- Q30 [Medium]: admin without Manager role sees no Lab/Management tabs.
- Q31 [Low]: nudge requests stuck in clarification? (M6 follow-up.)

## Gates
run-tests 683, app-smoke 303, ui-smoke, css-check, contrast, preview-smoke green.
