# Design rules (STEP 2 foundation, applied globally)

Calm, clinical, uncluttered. Desk PCs first (1440x900, 1920x1080).

## Shapes
- Panels, cards, dialogs: `var(--radius-panel)` (10px).
- Buttons, inputs: `var(--radius)` (6px).
- Chips, filters: 999px. Dots, lamps: 50%.
- No other radii, no literals. Same radii in every theme (`css/app.css`, `:root`).

## Type (5 sizes, 2 weights)
- 12 meta · 13 body · 15 fields + emphasis · 20 titles · 28 KPI.
- Weights 600 + 700 (800 on KPI numerals only).
- Sentence case, except 11px tracked meta labels.
- Mono (`--font-mono`) only for IDs, counts, clocks. System stack otherwise.

## Spacing + density
- 8px grid: 4 / 8 / 12 / 16 / 24. Card padding 12-16, section gap 16-24.
- Compact default. "Comfortable" toggle in the user menu sets
  `data-density="comfortable"` on `<html>` (per-user pref).

## Elevation
- Border OR shadow, never both. `shadow-pop` for overlays only.
- Glow only for Line stop / tool Down alarms (plus card hover lift).

## Colour roles
- Accent = action / focus only.
- Status colour only inside status chips. No row, card, lane, or plate tints.
- Priority = thin left stripe for Line stop and Hot only.
- Late = small red chip only. Max two colour signals per row / card.

## Components (3)
- `ui.statusChip` / `ui.statusBadge` — state + dot (Blocked gets a lock).
- `CountPill` — filter counts only.
- Traveller stamp (`js/ui/traveller.js`) — traveller / request only.
- Removed: LEDs-as-text, "OK" circles, initials on board cards.

## Home cards
- A Home card is a door, not a dashboard: 28px accent icon top-left,
  title, ONE line of description pinned to the bottom. No counts, no hints.
- Tall (`min-height` 168px), generous padding (20px), thin border.
- Grid: exactly 3-wide on desktop, 2 on medium, 1 on mobile; a short last
  row is centred, never stretched.
- Hover lift + soft accent glow; the 3D hover scenes keep working as built.

## Icons
- Lucide-style inline SVG (`ui.icon`), `stroke="currentColor"`, fill none,
  1.5px, round caps.
- Sizes: 16 rows / nav, 18 filters, 32 lanes, 56 plates.
- Every primary / bulk action has one icon. Existing tool glyphs kept.

## Wording
- Short, value-first page subtitles (e.g. "By tool. Click a card to act.").
- One empty-state pattern: `ui.emptyState({icon, title, text, action})`.

## Motion
- `transform` / `opacity` only. Honours `prefers-reduced-motion` and
  `data-motion="reduce"`.
- One exception (D-WEBGL-1): Home card hover scenes render WebGL, calm
  and hover-only. Reduced motion shows one still frame; everywhere else
  the transform/opacity rule stands.
