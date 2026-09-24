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
- **M1-3** Launcher opens **Edge** with `index.html?who=%USERNAME%`. No hard-coded path: the `.cmd`
  sits next to `index.html` and builds the `file:///` address from its own folder (`%~dp0`), so it
  works from a mapped drive (`Z:\...`) and a UNC path (`\\server\share\...`), and the folder can be
  moved or copied. The app remembers the user per PC and strips `?who=` from the address bar.
- **M1-4** Data lives in `data\` next to `index.html`: `data\mrt_data.json`, backups in
  `data\backups\`. Each person picks that folder once per PC (browser rule). `data/` is in
  `.gitignore`; only seed/sample data for tests goes into git (under `tests/`). Updates replace
  program files only, never `data\` (README "Updating the app"). A schema upgrade writes a backup
  of the old file first.
- **M1-5** First run (empty file): the first person becomes Admin and must set the PIN first; name
  from a short form, Windows ID from the launcher. No seeded people.
  Unknown Windows ID: the person may add themselves, **Engineer role only**. Before that the app
  looks for an existing user with the same name (trimmed, case- and accent-insensitive) and asks
  "Is this you?"; picking yes links the Windows ID (audited). A match that already has a different
  Windows ID is not relinked: "Ask an admin". Admins are told about every self-added user: in M1 a
  "New" mark in Settings > Users until an admin reviews it (+ audit entry); from M4 also the bell.
- **M1-6** Side menu shows the full future layout from M1; unbuilt pages are greyed (not
  clickable, tooltip "Coming in Mx", announced as unavailable), driven by one list in `app.js`.
  Order: Lab status (live in M1: tools, glyphs, Up/Down/Maintenance, operators) · My queue (M3) ·
  My requests (M3) · New request (M2) · Lots (M2) · Board (M3) · Analytics (M5) · Settings (M1) ·
  Help (M1). Bell in the top bar from M4. Start page in M1: Lab status; role-based from M3 (Q16).
- **M1-7** Extra field types per tool: short text, long text, number (unit, optional min/max),
  one choice, several choices, yes/no, date, shared-drive path (Copy button). Each field: label,
  type, required, optional help text, optional "only for these measurement types". Fields and
  choices are referenced by ID (rename-safe); removed choices are hidden, not deleted (Q47).
  No seed fields until Prince gives real ones (OPEN_QUESTIONS #5).
- **M1-8** First-run lists: tools HRM, AOI, PRF, QVM, FIB (all Up, no operators); priorities
  Line stop P1 / Hot P2 / Normal P3 (default) / Low P4; projects C4F (Chiplet4Future), SHIFT, HORUS
  and build-ups BU-01..BU-05, TEST, DOE, OPT (same as ABF); results roots empty.
  **Sample data, allowed by Prince until engineers confirm:** 5 measurement types per tool and one
  BKM per type with fake paths (`\\SAMPLE-SHARE\BKM\<tool>\...`, version `v0 (sample)`).
  Every sample entry carries `sample: true`, shows a "Sample" tag in Settings and is listed by
  Health until edited or replaced (OPEN_QUESTIONS #6, #7).
  - HRM: Cu roughness after treatment, Dielectric roughness after desmear, Solder resist
    roughness, Line roughness Ra/Rz, Areal roughness Sa/Sz
  - AOI: Full panel inspection, Defect review, Line/space check, Via inspection, Registration check
  - PRF: 2D profile, 3D scan, Step height, Bow / warpage, Plating thickness profile
  - QVM: Via diameter, Line width / space, Pad size, Position / registration, Solder mask opening
  - FIB: Via cross-section, Line cross-section, Interface / void check, Layer thickness,
    TEM lamella prep
- **M1-9** Lab calendar (one for the whole lab, Europe/Vienna): Mon-Fri 07:00-18:00. Holidays:
  Austrian public holidays 2026 and 2027 filled in by rule (Easter-based ones computed, tested);
  admin adds company closing days and later years in Settings. Clock maths comes in M2/M3.

- **M1-10** All starting data lives in `js/seed.js` (in the repo, fake entries marked
  `sample: true`); `store.js` only turns it into records. Real values replace the sample ones
  there later; an existing data file is fixed in Settings. Checklist: OFFICE_SETUP.md.
- **M1-11** The office checklist also lives in the app so Prince does not have to remember it:
  Help gets an "Admin: setting up the office" guide (step 5), and Settings > Health shows a live
  "still to do" list - sample entries, tools without operators or results root, no closing
  days, unconfirmed lab days (step 4).

- **M1-12** (2026-09-24) Roles: **Engineer** (requests), **Quality engineer** (new - runs the
  measurements today), **Operator** (kept, **no rights of its own yet**), Manager, Admin. Who
  measures is decided in ONE place, `domain.canMeasure()` - today Quality engineers only. Wherever
  earlier decisions say "operator" as the person who measures (Q2 primary/backup, Q3 Away, Q16
  My queue, Q27 tool status, Q39 board, Q43 queue actions), read "quality engineer". Stored field
  names stay (`primary_operator_id`, `backup_operator_id`) - no data upgrade. The rights per role
  are designed later (OPEN_QUESTIONS #14); giving Operators rights then is a change in canMeasure
  and its tests, not a data change.

- **M1-13** (2026-09-24) Part numbers: stored once in Settings > Lists (code, optional
  description, active) and **linked to one or more projects** - a part number can belong to several
  projects. From M2 a lot picks one project and one part number (of that project); requests take it
  from the lot. Still open: required on a lot? format rule? (OPEN_QUESTIONS #17)
- **M1-14** (2026-09-24) Away (vacation, sick leave): record it now - dates and an optional note,
  **no reason stored** (sick leave is personal data). Set by the person (user menu "I'm away") or by
  an admin (Settings > People). Shown on Lab status, People and Health (warning when a tool's primary
  and backup are both away). Routing new requests to the backup comes in M3 (Q3).

## M2 planning (2026-09-24)
- **M2-1** A lot holds: **lot number** (required, unique), **project** (required), **part number**
  (picked from that project's part numbers - all of them are offered; one is picked for you when
  the project has only one), **build-up** (required), **panel count** (required, draws the panel
  map), **lot owner** (the engineer who registers it, filled in), **note** (optional). No panel size.
  Lot numbers are mostly 5 digits (`18178`); a split lot adds `.01`, `.02` (`18178.01`).
  Linking lots (a split lot to its parent, related lots for analysis) comes later (OPEN_QUESTIONS #20).
- **M2-2** Panels are picked on the panel map **or** typed as ranges ("1-5, 12"); both stay in sync (Q6).
- **M2-3** "Needed by" belongs to each **request**, not the lot (Q10): each tool's request has its own date.
- **M2-4** "Needed by" is **optional** (changed 2026-09-24, Prince; first agreed as required). Without
  a date there is no countdown and the request is never "late"; the priority says how urgent it is.
- **M2-5** Queue order: **Line stop always on top**, then late requests (most overdue first), then
  by needed-by (earliest first); on the same date Hot before Normal before Low. Requests without a
  date come after the dated ones, by priority, then the longest waiting first.
- **M2-6** No date suggested from the priority: the engineer picks the needed-by date themselves.
- **M2-7** Process step ("panels are after ..."): picked from a **process-step list** in Settings,
  or "Other" to type it. The list starts empty until Prince gives the real steps.
- **M2-8** Where the panels are now: a **free-text field** - magazine number, rack/location, "in
  MES", "with Anna" or anything else that helps the quality engineer find them. **Required.**
- **M2-9** Optional **Layer** field on the request (e.g. L3, top SR). Project, part number and
  build-up (BU-01 ...) are picked on the lot and shown on every request of it.
- **M2-10** No "sites / where on the panel" field: **the BKM says where and what to measure** (Q13 -
  pick one from the library or paste the path of the engineer's own BKM PowerPoint). Without a BKM
  the purpose must describe it (Q45).
- **M2-11** Destructive tools: a per-tool setting "destructive" (Settings > Tools; only **FIB** today).
  Requests on such a tool need a **required tick** "Panels may be destroyed / scrapped".
- **M2-12** After measuring, the panels go: **Back to me** (default) / **Back to the line** /
  **Lab may scrap them** / **Other** (type it). Destructive tools (FIB) are set to scrap.
- **M2-13** Purpose is **optional** - except when no BKM is given: then it must say what to
  measure (Q45).
- **M2-14** No "contact if I'm away" field for now - backups cover it. Look again after the test
  run (R1).
- **M2-15** No picture / drawing attachment for now - the BKM covers it.
- **M2-16** No warning when priority and date do not match - the date is optional.
- **M2-17** The tool's quality engineers may change a request's priority; a comment is optional.
  The change shows in the timeline and the audit log; the engineer is notified from M4.
- **M2-18** (2026-09-24, Prince) **Lot fields** are admin-defined in Settings > Lists, like a tool's
  extra fields (same 8 kinds, rename/hide/required, answers stored by field ID). Seven sample ones
  to start, shaped with the team later: Purpose of the lot, Started on, Started by, DOE /
  experiment ID, Customer, Expected finish, Lot status. Lots are registered on the Lots page;
  Settings > Lists links there.
- **M2-19** (2026-09-24, Prince) Settings > Data & PIN > "Add 3 sample lots" (99901, 99902,
  99902.01, tagged Sample) to try the app with a real data file; Health lists them until deleted.
- **M2-20** (2026-09-24, built in step 4) Request form details: the request ID is given **at
  submit** (drafts have none, so no numbers are used up); a draft needs only its tool; the process
  step is optional (the list is still empty); "Copy this request" takes everything except the
  needed-by date, the priority reason and where the panels are now; only the author sees and
  deletes a draft; submitted requests are never deleted (cancel instead, Q35). Every request has
  a timeline from the start (created, submitted) for the request page (step 5).
- **M2-21** (2026-09-24, built in step 5) Request page: the needed-by countdown runs to the **end of
  the lab day** on that date and counts **lab time** (Q36 - lab days/hours minus holidays and closing
  days, Europe/Vienna); outside lab hours it shows "clock paused" (design idea P7, text only). Comments
  from everyone who can see the request; @Name or @windowsid are stored as mentions (the bell/emails
  are M4). Cancel: requester, the tool's quality engineers or an admin, with a reason (Q35). Still to
  come: quality-engineer actions (M3, Q43) and editing a submitted request with a reason (Q14) - planned
  with M3.
- **M2-22** (2026-09-24, Prince) Settings > Lots for admins: the same list as the Lots page (one
  list, two doors - never a copy); extras: add several lots at once ("18178-18180", same set-up,
  all or nothing), change a lot's owner (with a reason), delete any unused lot.
- **Future (not scheduled): Hirata code** - integrate Prince's Hirata coder/decoder HTML app and let
  users attach decoded panel numbers to a lot (OPEN_QUESTIONS #22). Planned when the app is shared.
- **M2 build order** (one branch per step, Prince reviews each): 1 `m2-settings` (process-step
  list, "destructive" per tool) - 2 `lots` - 3 `panel-map` - 4 `request-form` (drafts, submit
  warnings Q44, request ID Q29, duplicate) - 5 `request-page` (traveller card, status rail,
  timeline + comments). Personal templates (Q28) after M2.

## M3 planning (2026-09-24)
- **M3-1** On **Accept** the quality engineer may give an **expected done** date (optional). The
  engineer sees it on the traveller card and in My requests; with a needed-by date both show, so a
  later expected date is visible (Q10 "accepts it or proposes another").
- **M3-2** **Needs clarification** (quality engineer, with a comment saying what is missing, Q11):
  the engineer answers in the timeline and clicks **Answered** - the request goes back to the status
  it had (Submitted or Accepted) and shows in the queue again.
- **M3-3** **Panels received** (Q25) does not block Start: if the panels are not marked received
  yet, Start asks once "Panels received? Kept where (optional)?" with the tick already set.
- **M3-4** **On hold** reason picked from a list in Settings (starting list: Waiting for panels,
  Tool down, Waiting for engineer info, Higher priority first, Other) plus an optional note, so
  analytics can count on-hold reasons (Q20). Hold pauses the turnaround clock (Q9).
- **M3-5** **Editing a submitted request** (Q14): the requester may change everything except the
  tool (the ID is tied to it - cancel and copy instead), with a reason; each change shows in the
  timeline ("panels 1-4 -> 1-6. Reason: ..."), the quality engineer is notified from M4. No edits
  once Completed or Cancelled.
- **M3-6** **Complete** dialog: results folder (required, pre-filled with the proposal Q30, may be
  changed), what happened to the panels (pre-set from the request's "afterwards": Returned / Scrapped
  / Other - FIB always Scrapped, Q25) and an optional note. Then the engineer gets Results OK /
  Reopen (Q34).
- **M3-7** **Assigned to** (Q2, Q3): at submit a request is assigned to the tool's primary quality
  engineer, or to the backup if the primary is away that day (a note on the timeline). My queue shows
  assigned requests first; either quality engineer can **Take it**. Both away: stays with the primary
  (Health warns, M1-14).
- **M3-8** **Board** (Q22, Q39): columns Submitted | Accepted | In progress | Waiting (On hold +
  Needs clarification) | Completed (last 7 days); rows are tool lanes (glyph + status). Cards are mini
  travellers (stripe, ID, lot, panels, countdown); an open Line stop pulses. Only the tool's quality
  engineers and admins drag; allowed columns light up while dragging, the others dim.

Prince, 2026-09-24: "for all further questions follow your best and implement it - we change it
after testing". So M3-9 onwards are Claude's recommendations, to be revisited after the R1 test run.
- **M3-9** **Workflow** (who may do what; the one table is `domain.TRANSITIONS`):
  Accept (Submitted -> Accepted, optional expected-done date) - Start (Submitted/Accepted -> In
  progress, asks "Panels received?" M3-3) - Hold (Submitted/Accepted/In progress -> On hold, reason
  from the list + note) and Resume (back to where it was) - Needs clarification (-> Needs
  clarification, comment required) and Answered by the requester (back to where it was, M3-2) -
  Complete (In progress -> Completed, M3-6). Actions: the tool's quality engineers (primary or
  backup, `canMeasure`) and admins; Answered, Results OK, Reopen: the requester (and admins).
  Reopen (Completed -> Accepted, reason required); Results OK marks it closed; a completed request
  closes by itself 7 days after completion (Q34, computed, no data change).
- **M3-10** **My queue** (quality engineers, Q16/Q43): open requests of the tools where they are
  primary or backup, sorted as M2-5, "assigned to me" first; late ones red; one-click Accept / Start /
  Hold / Complete / Clarify / Panels received / Copy BKM path per row; tick several -> Accept all /
  Start all. Filters: tool, status. 100 rows per page.
- **M3-11** **My requests** (engineers): their requests, open first, with status, needed-by,
  expected done, countdown; filters status / tool / lot; Results OK / Reopen / Answered right there.
- **M3-12** **Start page by role** (Q16): quality engineer -> My queue, engineer -> My requests,
  others -> Lab status; a start page picked in the user menu wins.
- **M3 build order**: 1 `m3-workflow` (actions, hold reasons, request page buttons, edit with
  reason, assignment) - 2 `my-queue` - 3 `my-requests` - 4 `board`. Each merged into main.

## Rollout plan (2026-09-24, Prince)
- **R1** After M3: one quality engineer (the "operator" of the plan, M1-12) and one engineer test
  the app for a few days before M4 starts.
- **R2** Before go-live Prince names a colleague as **second admin**; handover covers the PIN,
  backups and restore (Help > "Admin: backups, restore, audit log, PIN").
- **R3** The old request list for the M6 import: Prince gives an anonymised sample right before M6.
- **R4** Prince asks IT now for a small server / Kubernetes slot (F1). Meanwhile the shared-file
  version is built on, unchanged - the store/adapter split keeps the move cheap.

## Design polish plan (2026-09-24) - PLANNED, NOT BUILT: plan each, ask Prince before building
"Engineered" animations: each one shows something real, like ABF's hourglass. Rules as in ABF:
transform/opacity only (SVG fill/stroke where needed), everything off with Reduce motion (final
frame shown), paused off-screen (`ui.watchOffscreen`), every animation shown in ui-kit.html, and
never the only signal - the text/label says the same thing.
- **P1 Working tool glyphs** (Lab status, "In progress" requests): FIB beam sweeps and cuts a
  cross-section line by line; QVM crosshair locks onto an edge and a measuring line snaps between
  two points; PRF stylus glides over a wavy surface and draws the profile behind it; HRM probe taps
  while a roughness trace scrolls; AOI scan frame sweeps the panel with small defect boxes blinking
  up. Down: glyph greyed, a small warning lamp blinks. (Today: the beam pulses / dashes / is off.)
- **P2 Needed-by gauge** on the traveller card: a needle/scale from green to amber to red as the
  deadline nears; late: past the red mark and pulsing; on hold: needle frozen with a pause symbol.
- **P3 Traveller card**: a rubber stamp ("ACCEPTED", "COMPLETED") slams on at each status change
  with a small bounce; the status rail fills step by step.
- **P4 Panel map**: picked panels light up one by one as ranges are typed ("1-5, 12"); measured
  panels get a check; scrapped (FIB) panels cross out; received panels slide into a "lab" tray.
- **P5 Lab board (Kanban)**: cards slide between lanes; a new request drops into its lane; a Line
  stop card has a pulsing red edge (ABF's critical glow); lanes a card may go to light up while
  dragging, lanes it may not go to stay dim (the transition rules, visible).
- **P6 Small touches**: completing a request - a folder icon closes with a click and the results
  path is copied with a small check; the bell swings once on something new; tool lamps on Lab
  status glow like equipment status lights.
- **P7 Added by Claude**: the working-time clock visibly pauses outside lab hours and on holidays
  (a small pause mark on countdowns), so "why did it stop?" answers itself; Settings > Health
  lines tick off with a check when their fix is saved; an Away person's plate shows a small
  swap arrow primary -> backup; Undo "rewinds" the changed row briefly; the save lamp gives one
  short pulse on each save. Performance budget: at most a handful of looping animations on screen,
  the 1 s tick stays text-only.

## Future-proofing (2026-09-24, not built now)
- **F1** Server later (Docker/Kubernetes, Node + SQLite + API): saving only in `store.js`, rules in
  `domain.js`, ID-based versioned collections, everything configurable (`js/config.js` + Settings).
- **F2** Login later via company SSO: identity from one function (`MRT.identity.detect()`); users
  store `windows_id` (lowercase, no domain), optional `domain` and `email`; roles stay in the app.
- **F3** Email and local AI each behind one adapter module (today: Outlook draft / AI off). No keys
  or passwords in the shared folder. CORS, data rules and IT approval checked before either goes live.
  Details: CLAUDE.md "Architecture" and "Identity"; open points OPEN_QUESTIONS #8-#12.
