# MILESTONE 8 — Components: COMPLETE

## Measured (fake DOM, Node — JS render cost, no layout/paint)
Demo data, 107 requests. Every view renders in 38–66 ms (budget 150 ms):

| view | ms | #main nodes |
|---|---|---|
| lab | 46.7 | 176 |
| queue (53 open rows) | 52.7 | 1898 |
| requests | 44.3 | 406 |
| board | 51.3 | 804 |
| analytics | 65.2 | 327 |
| lots | 40.4 | 301 |
| new | 43.9 | 339 |
| request | 43.8 | 540 |
| settings/health (PIN lock) | 39.2 | 24 |

Heaviest view 1898 nodes — far under the 10,000 DOM budget. Real-browser
feel (layout, paint, the 1 s tick) still needs Prince's Edge check; the
numbers above prove the JS side is cheap.

## New guard: tests/dom-budget.js
Committed. Boots the app on demo data, logs the table above, fails when a
view tops 5000 nodes, and pads the open queue past 100 to prove exactly 100
rows + a more-button render. Green.

## Verified, no change needed
- Paging: `PAGE = 100` in queue, requests, lots, settings-lots, audit.
  Board is bounded by nature (open + this week's closed); reference lists
  and templates are small.
- Reduced motion: `prefers-reduced-motion` media query AND per-user
  `data-motion="reduce"` both kill all animation/transition; off-screen
  animation pauses via IntersectionObserver.
- Empty states: every list view has one (queue, requests, lots, board,
  lab, analytics tabs, audit, templates, hirata).
- Loading states: the only async panels (backups list, Excel import)
  show "Reading…" placeholders; everything else renders sync from memory.
- Error states: the router wraps every page render in try/catch →
  "This page could not be shown" + toast; analytics tabs guarded
  individually; save failures toast with Retry.

## Gates
run-tests 683, app-smoke 303, ui-smoke, css-check, contrast, preview-smoke,
dom-budget green.
