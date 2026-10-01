# Milestone 4 — RBAC & visibility: COMPLETE

Date: 2026-09-29. Branch: `m4-rbac`.

## Fixes (role checks moved views -> domain)

New semantic helpers in `js/domain.js`, views call them:

- `canUseSettings` (was `hasRole(me,'admin')` in `settings.js:34`)
- `canSaveTemplate` (was inline in `request.js:69`)
- `canEditComment` (was inline in `request.js:306`)
- `canSeeManagement` (was `isManager` in `analytics.js`)
- `defaultAnalyticsTab` (was inline ternary in `analytics.js:134`)
- `adminNames` (display list in `settings.js:67`)

Grep proof: zero `hasRole` in `js/views/` and `js/ui/`. Remaining
`roles` mentions are display (labels, chips, the roles editor itself),
help prose, and `app.js` identity sublabels — no authorization.

Behavior preserved exactly (verified by unchanged smoke suite).
Noted for M7: admins without the Manager role do NOT see the Lab /
Management analytics tabs (pre-existing rule, now explicit in
`canSeeManagement`).

## Tests added

- Role x status visibility matrix: 8 personas x 10 statuses = 80 combos,
  oracle from documented rules. Engineer isolation, QE tool scoping,
  analyst done-only, operator/manager/admin read-all-except-drafts.
- Gate matrix for the 6 new helpers (17 assertions incl. tab defaults).

## Gates

678/678 unit, app-smoke 302, ui-smoke ok, css ok, contrast 0, preview 13.
