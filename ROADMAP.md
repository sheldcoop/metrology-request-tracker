# Roadmap - what is built, what is left, and why

Updated 2026-09-24. Decisions: `DECISIONS.md`; parked questions: `OPEN_QUESTIONS.md`.

## Built
- **M1** shell, Settings, Help, UI kit, audit, backups, undo, themes; part numbers, Away.
- **M2** lots (+ Settings > Lots, lot fields, sample lots), panel map, request form (drafts,
  warnings, request ID), request page (traveller card, lab-time countdown, rail, timeline, comments).
- **M3** workflow (accept ... complete, hold, clarify, reopen, edit with a reason, assignment,
  Take it), My queue, My requests, board. Test checklist: `TEST_RUN.md`.
- Lab status queue part (Q46): open, late, oldest open, typical wait per tool.

## Being built now (no outside input needed)
| Item | Decision | Note |
|---|---|---|
| Working tool glyphs | P1 | Prince 2026-09-24: "glyph replacement nice" - approval for P1 only |
| Search in comments | Q41 | small gap |
| Old drafts flagged | Q33 | small gap |
| Printable traveller slip + barcode | Q38 | own Code 128 generator (no vendor file, no internet) |
| M4 notifications | Q19 | bell, browser pop-up, Outlook draft (mailto) - all work offline |

## Left, and why
| Item | Decision | Why not now |
|---|---|---|
| R1 test run | R1 | needs a quality engineer and an engineer on the real share (`TEST_RUN.md`) |
| M5 analytics + exports | Q20, Q48, Q52 | after the test run and M4; needs real requests to be worth checking |
| M6 import of the old list | R3 | Prince gives an anonymised sample right before M6 |
| Personal request templates | Q28 | "Copy this request" covers most of it; after the test run shows if needed |
| Yearly archive | Q40 | only matters after ~2 years of data |
| Design polish P2-P7 | P2-P7 | planned; each needs Prince's OK first (only P1 approved) |
| Hirata code on lots | OQ #22 | waits for Prince's Hirata app |
| Server, SSO, real email, local AI | F1-F3, R4 | needs IT (a server slot, app registration, SMTP) |
| Real reference data | OQ #5-#7, M2-7, M2-18 | types, BKMs, extra fields, process steps, part numbers, lot fields - from the team |
| Rights per role (Operators) | OQ #14 | Prince decides later |
| Part number required? format? lot number rule | OQ #17, #21 | Prince confirms; today: optional, provisional formats |
| Capacity per tool, result values | OQ #3, #4 | later, if wanted |
| Measured in a browser: speed, a11y audit, looks, real drag | CLAUDE.md quality targets | Prince checks in the browser; code-level checks are all green |
