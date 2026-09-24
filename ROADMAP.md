# Roadmap - what is built, what is left, and why

Updated 2026-09-24. Decisions: `DECISIONS.md`; parked questions: `OPEN_QUESTIONS.md`.

## Built
- **M1** shell, Settings, Help, UI kit, audit, backups, undo, themes; part numbers, Away.
- **M2** lots (+ Settings > Lots, lot fields, sample lots), panel map, request form (drafts,
  warnings, request ID), request page (traveller card, lab-time countdown, rail, timeline, comments).
- **M3** workflow (accept ... complete, hold, clarify, reopen, edit with a reason, assignment,
  Take it), My queue, My requests, board. Test checklist: `TEST_RUN.md`.
- Lab status queue part (Q46): open, late, oldest open, typical wait per tool.
- Working tool glyphs (design plan P1): alive while their tool measures; Down lamp blinks.
- Search finds words in comments (Q41); drafts untouched for 30 days are flagged (Q33).
- Printable A6 traveller slip with a Code 128 barcode (Q38); a scanner opens the request. Not yet
  tried with a real scanner or printer.
- **M4** notifications: bell, pop-ups, Outlook drafts, quiet reload (M4-1..M4-5). Not yet tried:
  pop-ups from `file://` in Edge, mailto with the office Outlook.

## Being built now (no outside input needed)
Nothing - everything that needs no outside input is built. Next: the R1 test run.


## Quick tasks (2026-09-24)
Who | Task | How
---|---|---
Prince | Click through the demo | `git pull`, app > Change data folder > `demo-data`, PIN 1234
Prince | Browser check: looks, 3 themes, drag on the board, glyph motion | Edge; `tests/preview.html?demo=big&audit=1` for the a11y audit
Prince | Office check: launcher, share, two PCs saving, pop-ups, Outlook draft, A6 print | `TEST_RUN.md` sections 0, 2b, 3
Prince | Try a hand scanner on a printed slip | request page > Print slip, scan anywhere in the app
Prince | Decide: QR code on the slip too (phones)? | today Code 128 only; a phone app would only show the ID
Prince | Real data from the team | types, BKMs, extra fields, process steps, part numbers, magazine numbers
Prince | Ask IT | server slot, SSO, SMTP (OPEN_QUESTIONS #2, #8, #9, #19)
Both | R1 test run | `TEST_RUN.md`; notes back -> fixes
Development | After R1: fixes, then M5 analytics + exports | -

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
