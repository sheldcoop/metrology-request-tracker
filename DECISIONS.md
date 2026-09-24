# Metrology Request Tracker - locked decisions

Agreed with Prince on 2026-09-24, one question at a time (Q1-Q52). Change only after asking him;
record the change here with the date.

## Platform & data
- **Q1** Runs like ABF Tracker: static files on the shared drive, opened in Chrome/Edge; data in a
  JSON file on the shared drive. No server, nothing to install.
- **Q15** Small team (< 15 people). JSON with ABF-style revision check, daily backups, audit log.
  All saving in one store layer so a server + SQLite can replace it later without touching screens.
- **Q31** Office PCs only (1920x1080, 1440x900 first).
- **Q40** Everything stays searchable; admin archives closed requests older than ~2 years into a
  yearly archive file (still readable by analytics).
- **Q49** Go-live: all tools at once on a set date, after the import (Q23).

## People & roles
- **Q17 / Q52** Roles are ticks, several per person: Engineer, Operator, Manager, Admin.
  Admin actions also need the PIN.
- **Q18** Identity via launcher `Metrology Tool.cmd`: passes the Windows `%USERNAME%`; admin maps
  Windows IDs to users; unknown ID → "Who are you?" once. (Supersedes "pick name" from Q1.)
- **Q2** Each tool has a primary operator and a backup operator (Settings). New requests land in
  the primary's queue; the backup sees them too.
- **Q3** An operator can mark themselves Away (with dates); their new requests route to the backup
  with a note.
- **Q32** Everyone can read all requests; only the requester, that tool's operators and admins can
  change them.

## Lots & requests
- **Q7 / Q8** Lots are registered like in ABF (lot with project, build-up, panel count ...); any
  engineer can register a lot; admin manages the lists; the request form uses dropdowns.
- **Q4** One request = one tool. Several tools on a lot = separate requests, linked by the lot.
- **Q51** Measurement types are defined per tool by the admin (e.g. PRF → 2D profile, 3D scan).
  Engineer picks tool, then type.
- **Q5** Every request has the same core fields + admin-defined extra fields per tool (may depend
  on the measurement type). No code change to add a tool or field.
- **Q6** Engineer picks panels on a panel map or types ranges ("1-5, 12"); count fills itself.
- **Q13** BKM library in Settings (name, tool, shared-drive path, version); engineer picks one or
  pastes a one-off path.
- **Q28** Duplicate any past request; engineers can save personal templates.
- **Q29** Request ID `FIB-260924-03` = tool code - YYMMDD - running number per tool per day.
  The ID never changes, even if the tool is edited later.
- **Q33** Private drafts (author only); drafts older than 30 days flagged for cleanup.
- **Q44** Submit warnings: tool Down/Maintenance past the needed-by date; an open duplicate (same
  lot + tool + panels); missing BKM. No "unrealistic date" warning.
- **Q45** Missing BKM is a warning only; the purpose must then describe what to measure; operator
  sees a "No BKM" badge.

## Workflow
- **Q9** Status: Draft → Submitted → Accepted → In progress → Completed. Side states: Needs
  clarification (back to engineer), Cancelled, On hold (needs a reason, pauses the turnaround clock).
- **Q10** Engineer picks a "needed by" date; operator accepts it or proposes another. Countdown and
  late colouring against that date.
- **Q11** Each request has a timeline: status changes + comments, @mentions notify. Needs
  clarification requires a comment saying what is missing.
- **Q12** Completing requires a results folder path (shared drive, Copy path button). No result
  values or verdict for now.
- **Q14** Engineer may edit a request any time with a reason; operator notified; audited.
- **Q25** Panel hand-over tracked: "Panels received" (who, when, where stored), then "Returned" or
  "Scrapped" (FIB is destructive).
- **Q26** Priorities: **Line stop** (P1) / **Hot** (P2) / **Normal** (P3, default) / **Low** (P4).
  Word shown big, code small; renamable in Settings. Line stop and Hot need a reason; visible to
  managers in analytics.
- **Q27** Tool status Up / Down / Maintenance (with until-date), set by operator or admin; shown on
  the board; new requests warn. Capacity numbers later.
- **Q30** Admin sets a results root per tool; app proposes `<root>\YYYY\<request ID>\` (Copy path);
  operator may change it.
- **Q34** After Completed the engineer may mark "Results OK" or "Reopen" (reason → back to the
  operator); auto-closes after 7 days; reopen rate in analytics.
- **Q35** Requester can cancel any time (reason); operator can cancel with a reason (engineer
  notified). Cancelled stays visible, never deleted.
- **Q36** Working-time clock: admin sets lab days/hours + holidays (Europe/Vienna). Turnaround and
  lateness in working time; calendar time also stored.

## Screens
- **Q16** Role-based start: operators → My queue (their tools, sorted by needed-by + priority,
  late in red); engineers → My requests. Table by default, Kanban toggle.
- **Q39** Kanban: only the tool's operators + admins drag; transition rules enforced (Completed
  needs a results path, On hold needs a reason ...). Engineers read-only on the board.
- **Q42** Request page: traveller card on top (ID, tool glyph, lot, panel map, priority stripe,
  needed-by countdown) + status rail (each step, who/when); timeline below; BKM and results paths
  with Copy buttons at the side.
- **Q43** One click from queue rows/cards: Accept / Start / Hold / Complete (small dialog only when a
  reason or path is needed), Panels received, Copy BKM path. Bulk select → Accept all / Start all.
- **Q41** Global search: request IDs (also partial), lots and panels, people, text in purpose/comments.
- **Q46** Public lab status page: per tool Up/Down, queue length, oldest open request, typical wait.
- **Q38** Printable traveller slip (A6/A4): big request ID, lot, panels, tool, priority, needed-by,
  requester + QR/barcode of the request ID (scanner or search jumps to it; phones cannot open
  `file://` links). QR generator as a local vendor file.
- **Q21** Name: Metrology Request Tracker (repo `metrology-request-tracker`).
- **Q22** Design identity: engineered tool glyphs; request as a lab traveller card with priority
  stripe and status stamps; panel map; Kanban as a lab board with tool lanes, Line stop cards pulse.

## Admin
- **Q24** Seed tools: HRM (roughness), AOI, PRF (profilometer), QVM (vision measuring), FIB. Admin can
  add / edit / hide / delete (delete only if unused).
- **Q47** Lists are referenced by ID: a rename shows everywhere and is recorded in the audit log;
  delete only if unused, otherwise hide.

## Notifications
- **Q19** In-app bell (unread count) + browser pop-up while the app is open + ready Outlook draft
  (mailto) on key events. Real automatic email later, when a server/SMTP exists.

## Analytics & export
- **Q20** Views per persona (all filterable, exportable, click-through):
  - Operator: my queue (overdue/today first), waiting on me, on hold + why, my week.
  - Engineer: my requests + expected finish, "where is my lot" across tools, typical turnaround per tool.
  - Section manager: backlog per tool/operator + trend, turnaround median & p90 (hold time
    separate), on time vs needed-by, primary/backup load, clarification rate per tool/BKM, on-hold reasons.
  - Management: requests per month by project, on-time %, Line stop count + response time,
    capacity vs demand per tool.
- **Q52** Section-manager and management views only for users with the Manager role; operator and
  engineer views for everyone.
- **Q48** Exports: current table view (as filtered), full request history with all status
  timestamps, monthly management pack workbook.

## Build order (Q37)
| Milestone | Content | |
|---|---|---|
| M1 | Shell copied from ABF (tokens, ui/*, store pattern, app shell, Help, tests, ui-kit) + Settings lists + users/launcher | |
| M2 | Lots + request form + request page with timeline | |
| M3 | My queue / My requests table + Kanban | usable from here |
| M4 | Notifications | |
| M5 | Analytics + exports | |
| M6 | Import of the old request list | |

## Working rules (Q50)
Rules in `CLAUDE.md`, decisions here, parked items in `OPEN_QUESTIONS.md`.

## M1 planning (2026-09-24)
- **M1-1** Version control: local git only (branch `main`), one commit per step. No push; GitHub later.
- **M1-2** The alert strip under the top bar stays in the shell as a stub. Later it shows queue
  counts (Line stop, late, on hold), like ABF's status strip.
