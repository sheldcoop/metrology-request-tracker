# Milestone 1 — Domain layer: COMPLETE

Date: 2026-09-29. Branch: `m1-domain`.

## What was checked

- `canAct()` / `actionsFor()` / `canSeeRequest()` against `TRANSITIONS`
  (`js/domain.js:883-935`).
- Working-time clock (`workingMs`, `isLabTime`, `viennaYmd`, `viennaTs`).
- ID generation (`store.newId`, crypto 64-bit + timestamp).

## Tests added (`tests/tests.js`)

- Action x status x persona matrix: 10 actions x 10 statuses x 9 personas =
  900 combos. The oracle is rebuilt from the `TRANSITIONS` table declaration,
  not from `canAct`, so it is an independent check. Zero mismatches.
- Graph proof: every status reachable from `draft`; only `analyzed` and
  `cancelled` terminal (both by design). No dead ends, no unreachable states.
- `actionsFor` order follows table order.
- ID uniqueness bumped 20,000 -> 100,000 iterations (64-bit random, safe).
- Working-time clock vs Vienna DST (March + October jumps) and a holiday:
  already covered, verified still green.

## Fixes in domain.js

None needed. No gaps found.

## Gates

669/669 unit, app-smoke 299, ui-smoke ok, css ok, contrast 0, preview 13.
