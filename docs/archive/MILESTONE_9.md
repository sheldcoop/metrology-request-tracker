# MILESTONE 9 — Themes & UI kit: COMPLETE

All five DoD items verified; one stale comment fixed.

## Verified
- Zero theme names in CSS: `grep` for all six theme keys in `css/app.css`
  finds nothing; `css-check.js` fails the build on any `[data-theme="..."]`
  selector. Keys live only on `data-scheme` / `data-contrast`.
- Contrast: `tests/contrast.js` checks every text/background token pair in
  all 6 themes at WCAG AA 4.5:1, plus CIEDE2000 separation of the status
  colours — 0 failures.
- ui-kit: 25 sections covering every `js/ui/` module in every state
  (tokens, type, panels, LEDs, buttons, choices, fields, form, chips, KPIs,
  theme gallery, glyphs, charts, panel map, Hirata, traveller, board wall,
  queue strip, magazines, barcode, heatmap, tables, tabs, overlays,
  skeletons) + a live contrast table computed from the real tokens, in one
  theme or all six side by side (`?mode=<key>|all`, `?motion=reduce`).
- Aliases: 15 retired keys (`dark`, `ocean`, `light`, `hc`, `carbon-g100`,
  `gruvbox-light`, ...) resolve via `ALIASES` + `byKey`; app-smoke proves
  old saved choices still resolve.
- Default is `ats` (`DEFAULT = 'ats'`, first in the generated CSS).

## Fix
- `js/ui-kit.js` header comment still said "all three side by side" and
  `?mode=light|dark|hc|all` — updated to the six-theme reality (comment
  only; the code already handles every key).

## Gates
run-tests 683, app-smoke 303, ui-smoke, css-check, contrast, preview-smoke,
dom-budget green.

## Addendum — Step 1, dashboard-front-page branch
Theme list is now 7 (ats DEFAULT, frost, signal, dark-teal, pure-white,
slate, quant); deep-lab/cleanroom/minimal retired with ALIASES kept.
`tests/contrast.js` still dynamic (0 fails); app-smoke/preview-smoke
expectations updated to the new keys. Original record above stands as
verified at the time.

## Addendum — Step 1, redesign pass (2026-09-30)
Five themes (ats DEFAULT, pure-white, dark-teal, slate, quant); signal and
frost retired with ALIASES kept (`signal` -> dark-teal, `frost` ->
pure-white). `ats` is dark navy now; `pure-white` uses brand navy #0C3D6E.
High contrast is a user-menu switch on top of any theme, not a theme.
`tests/contrast.js` dynamic (0 fails, CIEDE2000 distinct); app-smoke,
ui-smoke, kit and Look expectations updated. Details: DECISIONS T-12.
