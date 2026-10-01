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
- **Changed 2026-09-28, Prince (RBAC):** new role **Analyst** (sees all Completed and
  Analyzed requests across tools; the only one who marks Analyzed). Roles are now Engineer,
  Quality engineer, Analyst, Operator (read-only for now), Manager, Admin. Reason: closing
  a request is an analysis sign-off, not the requester's "Results OK".
- **Changed 2026-09-28, Prince (RBAC):** Q32 is superseded - engineers see only their own
  requests; quality engineers see their tools' queue; analysts see Completed/Analyzed;
  operators see all but read-only; admins see all. Reason: request data stays with its
  people. A future Section Manager role that sees all is parked in OPEN_QUESTIONS.
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
  operator may change it. **Revised 2026-09-29 (Prince):** the proposal is only the Complete dialog's
  prefill — pages and the slip show confirmed folders only ("Not set yet" before that).
- **Q34** After Completed the engineer may mark "Results OK" or "Reopen" (reason → back to the
  operator); auto-closes after 7 days; reopen rate in analytics.
- **Changed 2026-09-28, Prince (RBAC):** Q9 and Q34 are superseded. Status is now Draft →
  Submitted → Accepted → Panels Received → In progress → Completed → Analyzed (terminal).
  Panels Received is a real QE handover state (was event-only). Completed closes only via
  Analyzed by an Analyst; Results OK / auto-close are gone. Q14 is kept: the engineer may
  still edit any time with a reason. Reason: one accountable sign-off per request. Live
  data migrates with backup first and a dry run on a copy.
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
  there later; an existing data file is fixed in Settings. Checklist: docs/OFFICE_SETUP.md.
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
after testing". So M3-9 onwards are the planning recommendations, to be revisited after the R1 test run.
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
- **M3 built** (2026-09-24): workflow + edit + assignment, My queue, My requests, board - each
  merged into main. Next per the rollout plan: R1 test run, then M4.
- **M3 build order**: 1 `m3-workflow` (actions, hold reasons, request page buttons, edit with
  reason, assignment) - 2 `my-queue` - 3 `my-requests` - 4 `board`. Each merged into main.

## Magazines (2026-09-24, Prince)
- **M2-23** A **magazine** is a cassette with **24 slots** (M70345 ...; the list in Settings > Lists,
  20 sample ones for now) standing in a **rack 1-24** (the number of racks is a setting). A lot has one
  or more magazines and a **loading map** (which panel in which slot): panel n goes into slot n by
  default, then the next magazine; the lot owner, a quality engineer or an admin can **move panels**
  (click a slot, then another). The magazine remembers the rack it stands in.
- **M2-24** The request says where the panels are: the magazine (filled in from the lot's map when
  panels are picked) and the **rack**, or a note ("in MES", "with Anna") - one of them is required.
  Shown everywhere as "M70345 · Rack 7 · slots 1-4". Scrapped panels cannot be requested again.
- **M3-13** On **Complete** the quality engineer says where the panels go back: magazine, rack, same
  slots or the first free ones; the lot's map follows. Scrapped panels (FIB) leave the magazine and
  are marked scrapped on the lot.

## Request form v2 (2026-09-25, Prince) - replaces parts of M2-1, M2-2, M2-9, M2-23, M2-24
- **F-1** A panel is identified by its **Hirata ID** (1-8 digits, e.g. 23 or 3252), typed by the
  engineer; the same ID can exist in different lots. If they do not know or care, they give only
  **how many panels** (usually 2). A lot has **no fixed panel count** (optional now) and no "panels 1..N".
- **F-2** **Layers** come from the build-up and several can be picked: core **1FCO / 1BCO**, then
  BU-01 adds 2F / 2B ... BU-04 up to 5F / 5B. Build-ups without a number (TEST, DOE, OPT) offer up to
  5F / 5B; an admin can set the number of build-up layers per build-up in Settings > Lists.
- **F-3** **Where the panels are**: a magazine (PCB magazine, 24 slots stacked, one panel per slot,
  like the ones feeding a Hirata loader) and the **slots** they sit in, picked on a front-view drawing
  of the magazine (click or drag; a picked slot shows the panel's Hirata ID; slots of other open
  requests are shown taken) - or a typed note. The magazine itself has no place of its own; the lot no
  longer stores magazines or a loading map. Complete says which magazine and slots they go back to.
- **F-4** The form is **guided, full screen, tool first**, in five categories: 1 Tool & method -
  2 Sample (one line Project · Lot · Build-up; panels; layers; process step) - 3 Where it is (magazine
  slots or a note; afterwards) - 4 Urgency - 5 Notes & extras; then Review. Each category opens when
  the one before is done and folds into a one-line summary; the traveller card builds up live.
- **F-5** The **lot is typed or picked right in the form**: registered lots are offered as you type;
  a new number is registered automatically on Submit. Part number: optional, under that line.
- **F-6** (2026-09-24, Prince: "don't link project, lot and build-up") **Project, part number and
  build-up belong to the request, not the lot.** One lot (e.g. 19189) runs through every build-up,
  like a complete product. In the form they are three separate choices; typing a lot fills in and
  locks nothing. Project: required; part number: optional, of that project; build-up: **optional**,
  from the Settings list - when picked, the layers come from it (F-2), without it up to 5F / 5B.
  A lot is its number, panel count, note and lot fields; the Lots page shows the projects of its
  requests. Schema 10 moves the old lot values onto each request. Prince chose option A: a lot has no
  fixed project either.
- **F-7** (2026-09-24) A data file whose magazine list stayed empty gets the 20 sample magazines on
  the upgrade to schema 10; Settings > Data also has "Add the sample magazines" (skips those there),
  and Health warns when there are none - so a normal data folder can use every function, not only
  the demo file.
- **F-8** (2026-09-24, Prince: test with the normal folder, later an empty or real database) Settings >
  Data & PIN > Test data: **"Fill with demo data"** replaces the file with the big demo
  (`js/demo-data.js`, now part of the app) - the admin becomes its Prince Khurana with their own
  Windows ID and keeps their PIN, so the launcher still recognises them; **"Start empty"** starts
  like a first run with only that admin. Both copy the current file to `backups/..._before-demo|empty_<time>.json`
  first (never pruned, restorable from the Backups list with its own audit log).

## M4 notifications (2026-09-24, built; Prince: "decide what can be built and build it")
- **M4-1** The bell (Q19) lists the last 30 days: requesters hear every status change, comment,
  edit and "panels received" on their requests; the tool's quality engineers hear of new requests,
  edits, answers, reopen, cancel, comments and requests assigned to them; anyone @mentioned hears of
  that comment; admins hear of people who added themselves. Never your own actions. One rule
  table: `domain.notificationsFor()`.
- **M4-2** Read / unread is kept **per PC** (like the theme): opening the bell writes nothing to
  the shared file. "Mark all as read" clears the count.
- **M4-3** When someone else saved, the app now **reloads by itself when it is safe** (nothing
  unsaved, no dialog or menu open, nobody typing); otherwise the M1 banner asks as before. That
  keeps the bell current.
- **M4-4** Outlook drafts (`js/adapters/mail.js`, mailto): after Submit (to the tool's quality
  engineers), Needs clarification and Complete (to the requester), Cancel (to the other side) a
  toast offers "Email ..." with a ready draft; only people with an email address in Settings >
  People. Real automatic email later with a server (OPEN_QUESTIONS #2, #10).
- **M4-5** Browser pop-ups while the app is open, once the person turns them on in the bell;
  otherwise a toast. Not verified: whether Edge allows pop-ups for a page opened from `file://`.

## M1 audit (2026-09-25, Prince)
- **A-1** Away: the "until" date stays **optional** ("until further notice", e.g. sick leave with no
  known end); the person or an admin clicks "I'm back". Confirms how M1-14 was built.
- **A-2** Three merge commits carry "Claude" as author (42d2de4, a2e051c, 7686e02). History is **left
  as it is** (no rewrite, no force push); every new commit uses the repo's author (Prince Khurana),
  checked before each push.
- **A-3** Demo note "Mia covers FIB" (Mia is an Operator) stays - demo text only.

## M2 audit (2026-09-25, Prince)
- **A-4** M2-20 (request form details) and M2-21 (request page: countdown to the end of the lab day
  in lab time, "clock paused", comments and @mentions, who may cancel) were built without asking -
  **confirmed as built**.
- **A-5** The traveller card was built four times (request page, form preview, board card, print
  slip). Now **one component**, `ui.traveller(model, {size: full | mini | card | slip})` in
  `js/ui/traveller.js`, drawn from plain values (it reads no data), in the ui-kit in every size.
- **A-6** The panel map (`js/ui/panelmap.js`) is unused since form v2 - **kept** for the Hirata
  decoder / panels by position (#22), marked "unused" in its file and the ui-kit.

## M3 audit (2026-09-25, Prince)
- **A-7** The **alert strip** (M1-2) was never built - **built now**: on every page, Line stop /
  Late / On hold / Needs clarification counts for a quality engineer's tools (admins: all tools),
  otherwise the person's own requests; each count opens My queue / My requests on that filter
  (`#/queue/late` ...). Rule: `domain.stripCounts` + `domain.measuredTools` (now shared with My queue).
- **A-8** Board look: Prince was not happy with it -> redesigned in P5 (2026-09-25, see P5-1..P5-3).
- **A-9** M3-9 .. M3-12 (who does what, My queue, My requests, start page by role) were
  recommendations - **confirmed as built**.
- **A-10** R1: Prince tests everything built (M1-M4, Hirata tools, the audit fixes) from
  `docs/TEST_RUN.md`; the M4 audit is covered by that run. M5 is planned and built meanwhile
  (Prince, 2026-09-25: "I will test tomorrow, you build M5 today").

## M5 analytics and exports (2026-09-25, Prince: plan A, build today)
- **M5-1** One Analytics page, four tabs: **My work** (quality engineers), **My requests**
  (engineers; incl. "where is my lot"), **Lab** and **Management** (Manager role only, Q52). Filters:
  date range (default last 90 days), tool, project; every number clicks through to its requests.
  Turnaround = submitted -> completed in **lab time with hold taken out** (hold shown apart);
  calendar time kept too; response = submitted -> first Accept/Start; **on time** = completed by the
  end of the needed-by lab day (undated requests not counted); backlog = open requests at each
  week's end; "done" = completed in the range, demand = submitted in the range. Capacity is not
  known (OPEN #3): demand only. Rules: `domain.analytics` + helpers, with tests; cache `js/analytics.js`.
- **M5-2** Exports (Q48): every table/chart has Download; full request history (a row per request
  with every status time + a row per timeline event); monthly management pack (one workbook, a
  sheet per topic). **SheetJS** `vendor/xlsx.full.min.js` 0.20.3 (downloaded with Prince's OK,
  official cdn.sheetjs.com, offline) makes real .xlsx; without it CSV.
- **M5-3** From now on a hold's timeline event also stores its reason ID (older holds are matched
  by the reason's name).
- **M5 build order**: 1 `m5-rules` - 2 `m5-exports` - 3 `m5-analytics` - 4 `m5-pack`.
- **M5 built** (2026-09-25): all four steps merged into main. Exports: My queue / My requests
  "Download" (the list as filtered), Settings > Data "Download the request history", every
  Analytics chart and table, the monthly management pack (Analytics > Management, pick a month).
  Not verified: real Excel on the office PCs, Chart.js looks in the three themes (Prince, R1 T8).

## Personal request templates (2026-09-25, Prince; Q28) - built
- **T-1** A template keeps what stays the same: tool, measurement type, BKM (or own path), project,
  part number, build-up, layers, afterwards, priority, purpose, extra fields; **never** the lot,
  panels, magazine slots, place, needed-by date or priority reason. **Personal**: only the owner
  sees, uses, renames and deletes it (audited). Data: `templates` collection, schema 11.
- **T-2** Save: "Save as template" on the request page (own requests; admins any) and on the form's
  last step. Start: a new empty form offers "Start from a template"; picking one fills the form
  (`#/new?template=<id>`). Manage: My requests > "My templates".
- **T-3** Parts hidden since (type, BKM, project, part number, build-up, layers, priority, extra
  fields) are left empty with a note; a template whose tool is out of use cannot be started, only
  deleted. Rules: `domain.templateFieldsOf / templateNameProblems / templateCheck`, with tests.
- **Changed 2026-09-28, Prince:** a template keeps **everything** filled in on the form - lot,
  panels, process step, magazine slots, place, needed-by date and priority reason too.
  Unavailable parts (lot gone, magazine/process step hidden, new names that exist by now)
  are left empty with a note, as in T-3.

## Hirata code (2026-09-25, Prince) - PLANNED, ask before building
Prince's Hirata tool (decoder + pattern finder) is built into the app, rebuilt to our rules
(no `innerHTML` with typed text, our themes and components). The code has **9 digits**: supplier
(1), year (1), week (2), day (1), lot per day (2), panel (2); each digit is a column of dots
weighted 8/4/2/1 plus a baseline dot, never above 9, with a start column for orientation.
- **H-1** A panel stores the **full 9-digit code when known, and at least the last 4 digits**
  (lot per day + panel) - enough to draw the pattern and match the panel. Replaces "1-8 digits"
  of F-1 once built.
- **H-2** Planned places: `domain.js` (encode/decode, field split, max 9 - with tests);
  `js/ui/hirata.js` (the **copper panel** drawing - copper colours **fixed in every theme** - and
  the dot grid, in the ui-kit); request form Panels step "Decode a panel"; copper patterns on the
  request page and the slip; a "Hirata tools" page (decoder + pattern finder + print); attach
  decoded panels to a lot (#22). Open before building: listed in OPEN_QUESTIONS #22.
- **H-3** (2026-09-25, Prince; **built**) A sidebar page **"Hirata tools"** (#/hirata) for anyone,
  nothing saved: *Read a panel* (tap the dots or type the digits -> the full code field by field
  and the copper panel) and *Find a pattern* (the last 4 digits or the full 9, several at once ->
  copper panels; print; 0-9 reference). In the request form each typed Hirata ID shows its small
  copper panel **to the right** of it; the request page and the printed slip show every panel as
  copper with its decoded fields. The field widths are **fixed in the code** (Supplier 1, Year 1,
  Week 2, Day 1, Lot per day 2, Panel 2), like Prince's tool. Copper colours fixed in every theme
  and kept when printing. Panel IDs now take 1-9 digits (the full code fits); the minimum of 4 is
  not enforced yet so existing panels (e.g. "23") stay valid - open question. Not built yet:
  attaching decoded panels to a lot, a PNG download.
- **H-4** (2026-09-28, Prince; **to build**) The New Request form takes **exactly 4 digits**
  per Hirata ID and refuses anything longer at the field with a plain message.
  Reason: the lab matches by the last 4 (`HIRATA_TAIL`); longer entries can never
  match. Full 9-digit codes stay decodable on the Hirata tools page. Existing
  records (e.g. "23") stay valid - only new entries are strict. A request hardly
  ever has more than 2-3 panels (2026-09-28, Prince).
- **H-5** (2026-09-28, Prince; **to build**) Panel previews stay inline (2-3 max, no
  lens): ID chip + one small copper mini beside it; tapping either opens the big
  view (full copper, decoded digits, scrapped warning) in a dialog.
- **Tool physics** (2026-09-28, Prince; for the glyph redesign): HRM is a
  microscope - trace width, space, pad diameter. AOI is automated optical
  inspection - golden reference vs scanned panel, finds defects. QVM checks
  shift between two layers - pad-to-via and via-to-pad. PRF is the
  profilometer - drilling, roughness, mostly ABF thickness, taper ratio, top
  and bottom diameter. FIB stays the ion column + cross-section.
- **Glyph redesign** (2026-09-28, Prince; **to build**): all five glyphs redrawn
  from the physics above - HRM microscope field, AOI golden-vs-scan, QVM layer
  shift, PRF via cut, FIB ion cut - each with a live behaviour tied to real
  request state, frozen frames under Reduce motion. No new libraries: hand-built
  SVG + CSS keeps the offline `file://` rule.
- **Living icons v2, built (2026-09-28):** look over physics, max 3 moving
  parts per icon, native SVG filters only (glow + holographic shimmer, no SMIL -
  shimmer is a CSS opacity pulse). `toolGlyph` takes rate (queue speed),
  alert (late pulse) and destructive (FIB shows the cut variant, automatic).
  Lab plates and board lanes feed all three from real queue data. Node budget
  under 100 per icon; hover fades in the reading; off-screen icons pause via
  the existing observer; Reduce motion shows finished frames.
- **Fourth theme** (2026-09-28, Prince; **to build**): one glass flagship theme
  alongside Deep Lab / Cleanroom / Signal, Apple-minimalist philosophy -
  restraint, whitespace, frosted surfaces, one accent, quiet type. The other
  three get a polish pass from the same inspiration.
- **Minimal theme** (2026-09-28, Prince: "go with your best"): black, white and
  grays everywhere EXCEPT the four status colors, which stay standard - a gray
  line-stop is a safety regression, and statuses are signals, not decoration
  (same reason copper stays copper). Proven on the gate first: a pure-gray
  status ramp cannot pass the distinctness rule (9 failures) and its texts
  would be near-identical anyway.

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
  **P1 BUILT** (2026-09-24, Prince: "glyph replacement nice"): the glyphs come alive while their
  tool has a request In progress (Lab status, board, request page); a Down tool's lamp blinks.
- **P2 Needed-by gauge** on the traveller card: a needle/scale from green to amber to red as the
  deadline nears; late: past the red mark and pulsing; on hold: needle frozen with a pause symbol.
- **P3 Traveller card**: a rubber stamp ("ACCEPTED", "COMPLETED") slams on at each status change
  with a small bounce; the status rail fills step by step.
- **P4 Panel map**: picked panels light up one by one as ranges are typed ("1-5, 12"); measured
  panels get a check; scrapped (FIB) panels cross out; received panels slide into a "lab" tray.
- **P5 built (2026-09-25), Prince's answers:** P5-1 the look was the problem -> a lab rack: tool lanes with
  glyph, lamp and open count, empty lanes fold to one line, numbered status slots with counts.
  P5-2 compact cards: ID, priority stripe, lot, panels, needed-by bar, QE initials.
  P5-3 **click only, no dragging**: a click opens a side panel (ui.drawer) with the full traveller and the
  usual action buttons; Ctrl+click opens the page. (Replaces the drag of Q39.)
- **P2 built (2026-09-25):** Prince chose a **needle dial** on the request page (ui.needleGauge): half circle,
  green/amber/red zones, needle = share of lab time used from submitted to needed by (all of it when late),
  pause sign when on hold or outside lab hours; board cards keep the small bar.
- **P3 built (2026-09-25):** on a status change the new stamp presses onto the traveller and the rail fills to the new step (only when the status changed since the page was last drawn; still with Reduce motion).
- **P4 built (2026-09-25):** panels light up as their Hirata ID is typed; once received (open request) they sit in an "In the lab tray" well and slide in when that just happened; after Complete: a check (measured) or a red cross-out (panels outcome Scrapped).
- **P6/P7 built (2026-09-25), all eight:** Complete toast with a folder that closes + "Copy results path" (✓ on copy);
  the bell swings once when the count goes up; board tool lamps glow (steady up, slow blink maintenance, red down);
  countdowns show ⏸ outside lab hours (queue, board); Health lists "Fixed since you last looked" struck through;
  People panel shows ⇄ backup when the primary QE is away; Undo gives the page a short rewind; the save lamp pulses once per save.
- **P5-4 Board tool picker (Prince, 2026-09-25):** chips on top - All tools, My tools (QEs), then one chip per tool
  (glyph, code, open count); picking one shows only that lane. Remembered per person on this PC. Replaces "Only my tools".
- **P5-5..P5-7 (Prince, 2026-09-25):** a "Show" row under the tool picker: Everything / Line stop / Late / Assigned to me
  (with counts; Line stop red when any); a Find box (request, lot or Hirata ID - others dim, focus kept); a
  "Completed column" switch (remembered). Later (listed): wall-screen mode, column limits (needs capacity), "stuck" age tag.
- **Quality pass (2026-09-25, code only):** board empty state when there are no tools; empty settings tables framed with an
  icon; high contrast board cells without ruling; panel marks readable in every theme; pause sign forced to text style (no emoji on Windows).
- **P9 Own themes, built (2026-09-28):** six themes, all ours - AT&S (default,
  company navy #003366, corporate red #CC0000 only for late/danger), Deep Lab,
  Cleanroom, Signal (high-contrast successor), Frost (glass flagship,
  Apple-minimalist), Minimal (monochrome except standard statuses - a gray
  line-stop would be a safety regression, proven on the gate). The 2026-09-25
  set is retired; old keys resolve through ALIASES (old `minimal` lands on the
  new Minimal). One list in `js/themes.js`, CSS keys on scheme/contrast only.
- **P8 Themes, built (2026-09-25):** Prince found light and high-contrast "not like an expert engineer" and chose
  **"instrument panel"**: light = calm neutral greys, crisp 1px lines, no grid, no glows, flat surfaces, smaller
  radii, one engineering blue (#0B5CAD). High contrast = a technical drawing: white paper, black ink, 2px lines,
  blue for actions, dark status colours (was black with yellow). Dark unchanged. Contrast check passes.
- **P5 Lab board (Kanban)** - Prince is not happy with its look (A-8): redesign; cards slide between lanes; a new request drops into its lane; a Line
  stop card has a pulsing red edge (ABF's critical glow); lanes a card may go to light up while
  dragging, lanes it may not go to stay dim (the transition rules, visible).
- **P6 Small touches**: completing a request - a folder icon closes with a click and the results
  path is copied with a small check; the bell swings once on something new; tool lamps on Lab
  status glow like equipment status lights.
- **P7 Extra ideas**: the working-time clock visibly pauses outside lab hours and on holidays
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

## Themes (2026-09-25, Prince: "the themes, starting with high contrast, suck - take inspiration from theme-factory, make it configurable and central")
- **T-1** All themes live in ONE file, `js/themes.js`: name, mood, swatches and colour tokens. css/app.css
  only uses the tokens and keys the few look differences on `data-scheme` (dark/light) and
  `data-contrast` (high), never on a theme's name (tests/css-check.js enforces it). tests/contrast.js
  checks WCAG AA for every theme from that file. A new theme = one entry there.
- **T-2** Eleven themes, inspired by the theme-factory palettes and tuned for an instrument screen:
  dark Mission Control (default), Ocean Depths, Midnight Galaxy, Forest Canopy, Tech Innovation; light
  Instrument, Arctic Frost, Modern Minimalist, Golden Hour, Desert Rose; High contrast. Status colours
  keep their meaning in every theme. Fonts stay the system stacks (no downloads from file://).
- **T-3** High contrast is now black / white / signal yellow (like Windows high contrast), 2px ink and a
  3px focus ring - the white-paper version is gone.
- **T-4** User menu > Theme... opens a gallery of live samples; a pick is kept per person on the PC.
  Settings > Look: an admin sets the office default theme (audited); "Office default" in the gallery
  follows it. The last used theme shows at start-up before anything is drawn (no flash).
- **T-5** (2026-09-25, Prince: "I hated all" the theme-factory set) **Proposal, waiting for Prince's OK:**
  three themes from full app design systems, colours taken from the official token sources, not
  memory - IBM Carbon `@carbon/themes` (themes.json + colors.json: g100, white) and GitHub Primer
  `primer/primitives` (dark-high-contrast, with its "dark" fallback, as Primer's build does).
  1 Dark default: **Carbon Gray 100** (#161616 / #262626 / #f4f4f4, links #78a9ff, buttons #0f62fe),
  flat and square, glow only on the status lamps. 2 Light: **Carbon White** (#ffffff / #f4f4f4 /
  #161616, #0f62fe). 3 **Primer High Contrast** (#010409 / #151b23 / #ffffff, accent #74b9ff, strong
  #b7bdc8 borders, no transparency: Primer's see-through status backgrounds mixed to solid, no glow).
  Primer's current values differ a little from the ones Prince had (older release): background
  #010409 not #0a0c10, text #ffffff not #f0f3f6, accent #74b9ff not #71b7ff, OK #2bd853 not #26cd4d.
  A new token `--accent-fill` (buttons, ticks, selection) lets Carbon dark use #0f62fe for buttons
  and #78a9ff for links. Shown in ui-kit.html (opens on "Proposal"), not yet in the app. After the
  OK: these three become the app's themes, the theme-factory ones go; Nord / Catppuccin Mocha later
  as optional personal themes.
- **T-6** (2026-09-25, Prince: Catppuccin Mocha + Gruvbox Light as **personal** themes, not office
  default) Official palettes: catppuccin/palette (mocha) and morhetz/gruvbox (light: light0..4 /
  dark1..4 / faded accents). Only status tokens (and one chart colour) leave the palettes:
  Gruvbox status text darkened for AA and its orange text moved away from red; Catppuccin's third chart
  colour is mauve, not pink (never taken for the pinkish red). In the proposal themes: Carbon White
  critical text = orange 60 (70 was too close to red); Primer HC warning = yellow 2 (Primer's
  attention and severe are nearly the same orange).
- **T-7** Status colours must stay **clearly apart**: tests/contrast.js measures CIEDE2000 between
  OK / Warning / Critical / Late - fills (lamps, stripes, card edges) >= 15, text colours >= 12
  (text always comes with its word and icon; on Gruvbox's cream readable amber / orange / red text
  can't be pushed further than ~14). Checked for the new themes; the older ones are listed only.
  Note: in the app Line stop and Late share the critical orange (the top strip uses red for Late),
  Hot and Warning share amber - open question to Prince.
- **T-8** **Status = icon + text, never colour alone.** One shape per meaning, inline SVG masks in
  css/app.css (--ic-*): tick OK, triangle Warning, stop octagon Critical / Line stop, clock Late,
  lock Blocked, flame Hot. Applied centrally: every status chip, every lamp (the glow follows the
  shape), priority names (Line stop, Hot), "late" clocks, the tool lamps on the board.
- **T-9** (2026-09-25, Prince: "do it") **Late is red everywhere** (the expired colour + clock icon):
  queue rows, clocks, board cards and gauges, the needed-by dial, Lab status. Line stop stays orange
  with the stop octagon; Hot and Warning stay amber, told apart by flame vs triangle and their words.
- **T-10** (2026-09-25, Prince: "do all") **Applied:** the app's themes are now Main - Carbon Gray 100
  (default), Carbon White, Primer High Contrast - and Personal - Catppuccin Mocha, Gruvbox Light. The
  eleven older themes are gone; their keys map onto the new ones (dark-looking -> Carbon Gray 100,
  light-looking -> Carbon White, hc -> Primer HC), so saved choices and an office default keep working.
- **T-11** One shared way to show a status: `ui.statusBadge(status, word)` (a chip: icon + word) and
  `ui.statusIcon(status)` (the icon beside words already shown), in js/ui/core.js. Every status chip
  of the screens goes through it; KPI tiles (Analytics, Lab status, Health) show the status icon
  before their label; Lab status "1 late" carries the clock. A new screen cannot forget the icon.
- **T-12** (2026-09-30, Prince, redesign Step 1) **Five themes, high contrast as a switch.** `ats`
  (still the default) is now dark navy: page #082B4F, surface #0C3D6E, white writing, white primary
  buttons with navy text; late/danger #FF7A70 (text shades lightened where tests/contrast.js failed:
  expired-fg #FF9A92, critical-fg #FFA76B). `pure-white` takes the brand navy #0C3D6E for top bar,
  headers, primary buttons and active nav (warning-fg #7A5410, late #B42318, ok #1F7A4D). `dark-teal`,
  `slate` and `quant` match the studio website tokens (studio src/tailwind.config.ts .dark / .slate /
  .quant, HSL converted to hex by script) - their values already matched, so only the source note
  changed. `signal` and `frost` are retired (`signal` -> dark-teal, `frost` -> pure-white in ALIASES);
  every older key still resolves, so saved choices and the office default keep working. High contrast
  is no longer a theme: the CSS already keyed the stronger ink off `data-contrast="high"`, so the
  user menu has a "High contrast" switch that works on top of any theme, remembered per user on the
  PC (same pattern as Reduce motion). AT&S and Dark Teal look alike at a glance (both dark) on
  purpose - the accents tell them apart (white vs teal); no fix proposed.
- **S-1** (2026-09-25, first-day walkthrough on a fresh folder) The setup to-do list (Health) is in the
  order a new admin works through it - tools and people, the lab calendar, the lists, a second admin -
  with one line per tool ("FIB: no primary quality engineer, no backup quality engineer, no results
  folder") instead of three (23 lines became 14). The 20 sample magazines are on it now; the part-number
  line no longer talks about lots (F-6). While quality engineers are missing, Health says how colleagues
  get into the app (open the launcher once, then an admin ticks their roles).
- **E-1** (2026-09-28, Prince: "go with your best") **Master Excel** (`js/excel-bridge.js`):
  one workbook, Requests keyed by readable `request_no` (no ID-scheme change was
  needed - it already existed), six reference sheets (Tools, Measurement types,
  Priorities, Projects, Build-ups, BKM), meta sheet with the live revision.
  Import edits 5 fields only (Priority, Assigned to, Needed by, Expected done,
  Purpose); status moves and new requests stay in the app; empty cell = no
  change; stale revision refused; safety copy + all-or-nothing save in
  `store.importRequests`. Not a storage adapter (folder read/write interface
  does not fit workbooks); views never touch XLSX. No migration needed.
- **E-2** Master lists export as reference only; bulk list import deliberately
  out (lists are curated in Settings; silent rewrites rejected).
- **R-1** (2026-09-28, Prince: "go", page-by-page) One design language: ghost
  station numerals, quiet-until-attention colour (neutral steel, red only on
  down/late), 800-weight mono numerals (shift strips, KPI tiles), priority
  stripe shared by board cards, queue rows, request rows. Order: Board (wall) >
  Queue (shift) > Request detail (command strip, rail pulse, timeline thread) >
  Lab (engraved plates, attention washes) > My requests (strip) > New request
  (rail numerals, open-step edge). Lots/Hirata/slip unchanged (utility/print).
- **A-1** (2026-09-28, Prince: "report only") Holistic audit `docs/AUDIT.md`: 56
  items, EXISTS/PARTIAL/MISSING with file refs; severity summary in chat.
  Fixes tracked as the "fix all" goal (2026-09-29).
- **F-7** (2026-09-29, Prince: one lot is one project + one part number) Revises
  F-6: lots may link `project_id` + `part_number_id` (optional, validated,
  migration 11->12). The request form inherits them when its own are unset (and
  drops them again when another lot is picked); explicit request choices always
  win. Lots page shows the lot's own links, else the projects of its requests.
- **P-1** (2026-09-29, Prince data rule: one lot -> one PN, one project -> many
  PNs, PN never shared) `part_numbers.project_ids[]` -> single `project_id`
  (required, validated, migration 12->13 keeps first). Suggest still lists all
  PNs but flags cross-project ones; lot/request/template/health checks compare
  single IDs; a project with PNs cannot be deleted.
- **X-1** (2026-09-29, "fix all" goal) Requester: the card shows the queue
  place (`domain.queuePosition`, accepted/received/in-progress on the tool by
  submitted time); drafts delete from My requests rows. Admin: the audit log
  downloads (filtered rows). Manager pages reviewed, no change.
- **X-2** (2026-09-29, Prince: no separate receive) Receiving always starts:
  one "Receive & start" button (and bulk "Receive & start all") asks the
  place once, then runs receive + start; the timeline keeps both entries.
  Paths on the request page are clickable `file://` links; the read-only
  magazine folds empty runs; Hirata panels share the row (max 4); the New
  Request side panels collapse (remembered per PC).
- **X-3** (2026-09-29, review goal) IDs: 64-bit crypto random + 20k
  uniqueness test. Health warns past 20k audit / 50k timeline entries
  (download first; archiving still open #27). Queue sort has a 5k
  correctness + time tripwire. Docs refreshed (P-1 supersedes M1-13).
- **A-02** (2026-09-29, Prince Q&A) Addendum 02: panel logistics row (Where
  now, Where after, Magazine) with managed panel_locations + destinations
  (select-or-add-new, close-match hints, migration 13->14 turns distinct
  texts into entries, After enum deleted). Live names, no frozen snapshots;
  FIB scrap forcing dropped (destructive tick kept). Board gains an
  Analyzed column (last 7 days, analyst + date). Exports carry the three
  adjacent columns, magazine as text.
- **H-1..H-10** (2026-09-29, autonomous hardening pass, architect's call;
  Prince reviews in FINAL_REPORT.md) H-4: role checks moved out of views
  into six domain helpers; H-5: submit skips a deactivated/missing/away
  primary for the backup, with a timeline note; H-6: on hold > 7 days
  warns on the Health page (from timeline events, no schema change);
  clarification is NOT flagged (waits on the engineer, open #31); H-7:
  Q52 kept strict — admins without the Manager role see no Lab/Management
  tabs (open #30); H-8: DOM budget guard (`tests/dom-budget.js`, 5000
  nodes/view, queue paging); H-10: the store picks its storage adapter
  from `config.adapters.storage`, so the server move needs no store edit.
- **DASH-1** (dashboard-front-page, Step 1: studio themes) Four studio
  palettes ported to `js/themes.js`, all HSL values converted by script
  (never by hand). Mapping rules: surface-2 = studio secondary,
  surface-3 = secondary +5 lightness, line-strong = border +8, faint =
  muted -7 (dark) / +7 (light), accent = primary, status blocks adopted
  from deep-lab (dark three) and cleanroom (pure-white), radii/shadows
  adopted the same way; quant violet only as `line-hi` highlights.
  Retired deep-lab, cleanroom, minimal; old keys resolve via ALIASES
  (deep-lab -> dark-teal, cleanroom/minimal -> pure-white; 2026-09-28
  aliases repointed directly since `byKey` resolves one hop). DEFAULT
  stays `ats`. Final list (7): ats, frost, signal, dark-teal,
  pure-white, slate, quant. Contrast fixes, script-computed, verified
  by `tests/contrast.js` (0 fails): pure-white fg-faint #76869D ->
  #627289; slate fg-muted #676E83 -> #878CA0, fg-faint #575D6F ->
  #888FA2; quant fg-faint #6E7E87 -> #85929C. Gallery order is
  dark-teal, pure-white, signal, frost, ats, slate, quant (ats-first
  reordering left open).
- **DASH-2** (dashboard-front-page, Step 2: topbar theme button) New
  `themeBtn` icon button in `.topbar-right` (contrast glyph, same as the
  user-menu entry) opening the same `themeGallery()` in a popup menu,
  wrapped in `.theme-compact` (one row per theme: name + swatch preview,
  samples and moods hidden by CSS only). No `extra`: "Office default"
  stays out of the personal picker (user-menu Theme... dialog keeps it).
  The gallery stays open on a pick, so all 7 themes are one click away
  (no cycling). Keyboard: gallery radiogroup + roving tabindex + arrows,
  current card focused on open, Esc/outside click closes via `ui.menu`.
  `setTheme()` reused untouched, so `rethemeCharts()` still runs.
- **DASH-3** (dashboard-front-page, Step 3: icons) Six names added to
  `js/ui/core.js` PATHS (60 total): plus-circle, list, kanban, bar-chart,
  layers, circle-help; inbox/activity/settings reused, not duplicated.
  No tool-glyph reuse: no Home card depicts a physical instrument, so the
  48-grid living drawings stay on Lab/tool surfaces. Global stroke-width
  1.8 -> 1.75 (no test asserted it; visually negligible). Card mapping:
  New request plus-circle, My requests list, My queue inbox, Lab status
  activity, Board kanban, Analytics bar-chart, Lots layers, Help
  circle-help, Settings settings. Kit shows the 9 in the Tool glyphs
  section (own `kit-icon-cell` class, so the 28-cell glyph count holds);
  CONTRIBUTING table gained the icon row.
- **DASH-4** (dashboard-front-page, Step 4: Home) New route `#/home`
  (`js/views/home.js`, NAV first, shortcut `g m`): a card per page with
  STEP 3 icon, one line, live count. Cards reuse existing functions only
  (stripCounts, toolQueueStats, notificationsFor, analytics.get; the drafts
  / mine / lots / guides / problems reads mirror their own views).
  Gates: New request canRequest, My queue + Board canMeasure, Analytics
  canSeeManagement, Lots canRegisterLot, Settings canUseSettings; Lab
  status, My requests, Help are read surfaces open to all. Routes guarded
  only where green stays green: `#/new` + `#/lots` show "You don't have
  access, ask an admin." `#/requests`, `#/queue`, `#/board`, `#/analytics`
  stay readable (Ruth the analyst works in requests, Prince the
  non-manager admin reads analytics, Olga reads queue/board) and Settings
  keeps its own admin message (app-smoke asserts it). Role start pages
  stay (homeFor); Home is only a start page when picked in the user menu
  (existing mechanism, no change). `+ New` topbar button (canRequest,
  repainted in paintUser). Budgets: Home in dom-budget.js (150 ms,
  10,000 nodes).
- **DASH-5** (dashboard-front-page, Step 5: card hover) Lift
  (`translateY(-2px)`) + soft accent glow on `.home-card` and Lab
  `.tool-plate`. transform/opacity only: the glow lives on an `::after`
  overlay (`box-shadow: var(--accent-glow), 0 10px 30px
  var(--accent-soft)`, theme tokens only) whose opacity fades in - no
  box-shadow is ever transitioned. Stops under both switches: the global
  `prefers-reduced-motion` / `[data-motion="reduce"]` rules already kill
  transitions, plus explicit rules zero the hover end states so nothing
  jumps. `.tool-plate` keeps its existing border/box transitions for
  state changes (is-selected etc.); transform appended for the lift.
- **DASH-6** (dashboard-front-page, Step 6: small extras) "Waiting on me"
  on the side menu from `notificationsFor` (same read watermark as the
  bell): my requests' updates on My requests, lab-side updates (measurer
  or assignee) on My queue; unread only, capped at 99+, `warning` badge
  style, "N waiting on me" hover title; repainted with the bell and on
  menu rebuild. Empty states: settings tables already carry table empty
  texts, so only Help's search-no-results became a real `ui.emptyState`
  (Home cannot be empty: lab/requests/help cards are unconditional).
  Status-lamp legend: new Help guide (all five lamps as live `ui.led`
  with words, shapes spelled out, Lab link).
- **DASH-7** (dashboard-front-page, redesign Step 2: foundation) One shape
  rule (`--radius` buttons/inputs, `--radius-panel` panels/cards/dialogs,
  999px chips, 50% dots; same radii every theme), 5 type sizes
  (12/13/15/20/28, weights 600+700, mono for IDs/counts/clocks), 8px grid
  with compact default + per-user Comfortable density switch, border-OR-shadow
  elevation (glow only for Line stop / tool Down), colour roles (accent for
  action only, status colour in chips only, no tints, stripe for Line stop/Hot
  only, late as red chip), 3 merged components (StatusChip, CountPill, traveller
  Stamp; LEDs-as-text, OK circles and board initials removed), Lucide-style
  icons at 1.5px round caps (16 rows/nav, 18 filters), short value-first
  subtitles, one empty-state pattern, transform/opacity motion only.
  Rules live in `docs/DESIGN_RULES.md`.
- **DASH-8** (dashboard-front-page, redesign Step 3: frame) Top bar left to
  right: search, "+ New" (primary, was plain), bell, save lamp (+ Undo),
  theme button, user menu. The help and shortcuts icon buttons are gone:
  Help lives in the nav, shortcuts live in the user menu (and on `?`).
  Nav regrouped Home | New/My requests/My queue/Board | Lab/Lots/Results/
  Hirata | Analytics | Settings/Help with thin dividers; active item is the
  3px bar + bold label (border dropped). Strip is counts only (four filter
  links, no state label, clock or "N open"). Bell keeps the list of what
  changed; incoming changes no longer toast (toasts confirm my own actions
  only); pop-ups only when opted in, never beside a toast.
- **DASH-9** (dashboard-front-page, redesign Step 4: request box) My queue
  is one box per request (`js/ui/request-box.js`, plain values in): line 1
  tool glyph, mono ID, priority word for Line stop/Hot only, status chip,
  red Late chip when late, assignee right; line 2 lot + build-up; bottom
  line one filled primary (Accept / Receive & start / Start / Complete),
  Hold + Needs clarification as quiet text buttons, the rest (Take it, Copy
  BKM path, Cancel...) behind "...". Stripe for Line stop/Hot only, hover
  accent-soft + lift. Neutral sticky groups Line stop / Late / Due this
  week / Rest (pilot, queue only); paging kept (100 boxes + more-button).
  Ticking shows "N selected:" with one primary bulk + "..." + Clear. On
  Complete the box reads "Completed" and fades (1.2 s) with a 10 s Undo
  toast into a collapsed "Done today (N)" section; Undo withdraws the
  entry. Strip counts are filter links (open/late/yours). Countdown clocks
  are gone from the queue (the shell tick has nothing to repaint).
- **DASH-10** (dashboard-front-page, redesign Step 5: My requests) The same
  box; line 2 adds the process step (e.g. "After lamination"). Completed
  requests keep Reopen and the results folder link on the bottom line (no
  "Results OK" button exists since Q34, so it is Reopen only). Analyzed ones
  moved from the filter list to a History filter. "To analyze" left its
  bottom panel and is its own tab (`#/requests/toanalyze`). Drafts carry on
  from their box (Carry on + delete). No countdown clocks here either.
- **DASH-11** (dashboard-front-page, redesign Step 6b: board) Numbered
  columns kept, their coloured top borders and numeral colours gone. The
  TOOL column is gone: one slim sticky lane header per tool (glyph, code,
  open count; the glyph still shows Down/Maintenance); empty lanes are a
  thin strip. Completed + Analyzed are OFF by default (remembered).
  Cards are rebuilt, not mini travellers: stripe for Line stop/Hot only
  (plain otherwise), the tiny priority word for those two, truncated mono
  ID with the full number in the tooltip, lot + build-up, the needed-by
  clock (text only) and one status/Late chip - plus Stuck past 2 lab days
  on hold. No gauges, initials, dates or red card borders; the drawer keeps
  the traveller, the actions and an explicit "Open page" link (renamed from
  "Open full page"). Filter row: Scope All/Mine + tool dropdown with counts,
  Show, Done toggle, search. Stuck uses the same rule as Health now: both
  count lab days (`domain.holdLabDays`, 2 by `STUCK_HOLD_LAB_DAYS`); the old
  7-calendar-day Health rule is replaced. Width budget: 5 columns take
  774 px, 7 take 1086 px (150 px columns + 6 px gaps) - both fit 1440 px
  with the nav open. Lane headers slide under the sticky stations instead
  of a second brittle sticky offset.

- **DASH-12** (dashboard-front-page, redesign Step 7: request page) Above
  the fold: head, traveller facts, one action bar - at most two buttons
  (the primary workflow action from `requestActions.primary()`, Copy
  results path) plus "..." with the rest of the workflow, Edit, Print,
  Copy, templates and Cancel. Below in one stack: paths (one row each),
  status rail, details, people, timeline of status changes, comments last.
  The late countdown is one red line. Queue boxes use the same shared
  primary, so both bars agree on what comes first.
- **DASH-13** (dashboard-front-page, redesign Step 8: new request form)
  The form takes the full page: progress strip plus folding steps, no
  side column. "What the lab will see" and "Your requests" stack below
  the form in the same `.req-stack` as the request page. The two-column
  `.req-layout` / `.req-side` CSS is retired; path rows keep full width
  via `.req-stack .cell-path`.
- **DASH-14** (dashboard-front-page, redesign Step 9: home replacement)
  Home (`#/home`) is the start page for everyone; the user menu's Start
  page pick still wins. The role rule `domain.homeFor` stays untouched
  (Q16, still unit-tested) but no longer picks the landing. This
  supersedes the M3-12 landing part only.
- **DASH-15** (dashboard-front-page, Part A frame) One top bar, 56 px:
  mark + "Metrology" (M1 pill gone), search centred to 560 px ("Search
  requests, lots, panels"), save state as quiet muted text (shows
  "Saved" 4 s after a save; colour only for Saving/failed), "+ New" the
  only filled button at full 36 px, bell dot with the count inside the
  panel, avatar menu gains Help and "Sign out" (was "Change user";
  Reduce motion, Reload, Change folder stay). All controls 36 px, 18 px
  icons. The strip bar is gone with its clock (already clockless since
  DASH-8): My queue badge carries Line stop + Late on the person's
  tools, the queue page opens with a plain filter-link counts line
  (late colour on Line stop/Late numbers above zero). One slim calm
  line-stop banner under the bar for the first undismissed open Line
  stop on the QE's tools, dismissed per request per person on the PC.
- **DASH-16** (dashboard-front-page, Part A board) Cards are two lines at
  58 px: short ID (no tool prefix) + "N pnl", or red "late N d" (calendar
  days, like the request page) with the count moved to line 2; line 2 is
  lot + build-up with P1/P2 code and at most one chip (Stuck covers On
  hold). Thin 3 px stripe for P1/P2 only. Countdown and panels live in
  the hover tooltip (repainted by the 1 s text-only tick) and the
  drawer. Columns are plain `surface` with 10 px gaps (5 cols 790 px,
  7 cols 1110 px - still inside 1440 px); empty cells say "Nothing
  here". The `.q-clock` rules are retired (traveller clocks are
  `.tr-clock`).
- **D-WEBGL-1** (home-3d, Step 1: Home hover scenes) WebGL is allowed on
  Home cards only - one shared renderer, hover-only scenes, calm and
  capped at 1.5 pixel ratio for weak lab PCs. Everything else keeps
  transform/opacity motion. No WebGL, software rendering, or slow frames
  (> 40 ms over 1 s) keeps the static card for the session; reduced
  motion renders one still frame; light schemes stay static. Off in one
  place: `MRT.config.features.home3d`. Pinned local UMD
  `vendor/three.min.js` (r160, last UMD release), lazy-loaded on the
  first card hover, never in index.html.
- **D-WEBGL-2** (home-3d, Step 5: the rest of the cards) All seven Home
  cards get a scene (new, mine, queue, board join aoi, bars, dice); the
  Board scene stays (a calm tile grid). Icons are unchanged, light
  schemes stay static.
- **HOME-1** (home-final, Step 1: the theme set) The agreed set is FIVE keys:
  ats (default), pure-white, dark-teal, slate, quant, plus the
  high-contrast switch on top of any theme (`data-contrast`, per user).
  This supersedes DASH-1's "final list (7)": frost and signal are correctly
  retired as ALIASES (frost -> pure-white, signal -> dark-teal), with
  deep-lab, cleanroom and minimal. Verified 2026-10-01: all 20 retired keys
  resolve through `byKey`, so a saved choice always lands somewhere
  sensible; no code change needed. Nobody "restores" frost/signal as themes.
- **HOME-2** (home-final, Step 2: hero tagline) Centred hero above the grid:
  typing tagline through four lines settling on "From Request to Result",
  which stays permanently (never loops, cursor stops - a loop is tiring in
  a tool opened all day). Key nouns in accent; quiet muted sentence under;
  Home only. Vanilla `setTimeout` driver (`tagNext`, pure and unit-tested:
  settled state is a fixed point, no timer scheduled on settle); hidden tab
  pauses. Reduced motion shows only the final line, no cursor.
- **HOME-3** (home-final, Step 3: sign-in slot) The Who-are-you forms
  (`showAskId`, `showWhoAreYou`, `showIsThisYou`) render in a `home-slot`
  box on Home instead of the gate overlay: hero and sentence above, form
  where the cards would be, zero cards until identity is known. Same
  forms, same behaviour (moved, not duplicated); first input focused.
  Signing in clears the slot and the role's cards render on the same page
  (the existing `page-enter` fade; instant under reduced motion). Folder
  connect, first-run and account-off stay in the overlay. REAL LOGIN IS
  NOT BUILT HERE: no PIN, accounts, password, guest mode or schema change
  (see OPEN_QUESTIONS #9) - the server login will drop into this slot
  with no layout change.
- **HOME-4** (home-final, Step 4: the cards) Seven tall cards, 3-wide grid
  (2 medium, 1 mobile; short last row centred): 28px accent icon top-left,
  title, one bottom line; hover lift + glow; scenes untouched. This
  REVERSES DASH-4 deliberately: the live counts made Home feel like a
  dashboard instead of a welcome page - counts stay on the real pages and
  the nav badge. Removed the Lots and Settings cards (sidebar-only, like
  Results and Hirata; neither had a scene). Scene audit: new, mine,
  queue, board, aoi (Lab), bars (Analytics), dice (Help) all still bound;
  no scene orphaned, no card sceneless. Display only: `stripCounts`,
  `toolQueueStats`, `notificationsFor` untouched (nav badge + queue counts
  line verified in the gate).
- **HOME-5** (home-final, Step 5: Lucide icons) Nav, page, system and
  workflow icons are Lucide v1.49.0, vendored as one inline sprite
  (`vendor/lucide-sprite.svg` + `vendor/lucide-README.md`: version, size,
  ISC licence). The sprite is the upstream record; the drawn copies live
  inlined in `js/ui/core.js` PATHS because `file://` cannot fetch at
  runtime. Regenerate with `node tests/make-lucide.js`. The custom tool
  glyphs (hrm, aoi, prf, qvm, fib) stay in `js/ui/glyphs.js` - no set
  draws lab instruments. Stroke stays one width, 1.5px, set by `ui.icon()`.
  Merged: help into circle-help; chart + analytics + bar-chart into
  chart-column (callers updated). Kept hand-drawn: logo (brand mark),
  hirata (dot pattern), motion (unused, no good match). `clock` kept -
  still used (timeline, calendar, Analytics). Full map (ours -> Lucide):
  dashboard -> layout-dashboard, lots -> package, settings -> settings,
  search -> search, folder -> folder, alert -> triangle-alert, check ->
  check, close -> x, refresh -> refresh-cw, download -> download, upload
  -> upload, save -> save, sun -> sun, moon -> moon, contrast -> contrast,
  user -> user, inbox -> inbox, clock -> clock, archive -> archive,
  restore -> history, edit -> pencil, move -> move, plus -> plus, filter
  -> funnel, trash -> trash-2, home -> house, chevron_left ->
  chevron-left, expand -> maximize-2, info -> info, lock -> lock,
  activity -> activity, gauge -> gauge, grid -> grid-2x2, chevron_down ->
  chevron-down, chevron_right -> chevron-right, sliders ->
  sliders-horizontal, ruler -> ruler, requests -> clipboard-list,
  request_new -> file-plus, board -> kanban, bell -> bell, copy -> copy,
  wrench -> wrench, users -> users, calendar -> calendar, tag -> tag,
  keyboard -> keyboard, mail -> mail, plus-circle -> circle-plus, list ->
  list, kanban -> kanban, layers -> layers, circle-help -> circle-help,
  chart-column (new) -> chart-column.
- **HOME-6** (home-final: People allowlist, no self-registration) Until
  real login lands, only people an admin put in Settings > People get in.
  Unknown Windows IDs stop at "You are not in yet" (same Home slot, with
  an "I was added - continue" retry + change-user) and no user is created.
  The Who-are-you name form, Is-this-you linking and self-registration
  are removed from the app (the store keeps the API for the server login
  later). First-run admin setup is unchanged. Help, README and the office
  checklist say the same.
- **HOME-7** (home-final: Analytics wave) The Analytics card scene is a
  signal wave rolling up and down (accent trace + faint echo, transparent
  background), not bars. The engine gives scenes no hover state, so the
  wave breathes on its own between calm and lively; reduced motion keeps
  the one still frame.
- **HOME-8** (home-final: outstanding scenes) All seven Home scenes
  reworked on the studio recipe: the living element always in `accent`
  (slate orange, quant green, dark-teal teal, pure-white navy, ats white),
  faces/plates in the card colour, transparent background, no hardcoded
  dark discs. Dice: two tumbling dice with real 1-6 canvas faces, accent
  pips, edge lines (no black disc). AOI: scan band with trail, circuit
  traces in segments that light as the scan passes, red defect flash.
  Board: corner-to-corner ripple + red line-stop call. Queue: travelling
  block with two fading echoes + arrival hop and flash. Mine: sliding
  plate with an accent edge stripe. New: sheet rises, lines type on, plus
  badge pops. Analytics: the wave. Hemisphere ground follows the theme
  (was hardcoded dark navy). Test stub mirrors the canvas/texture API.
- **HOME-9** (home-final: six doors per role) Every role sees exactly six
  Home cards (full 3+3 grid, no orphan row). New gates in `domain.js`
  (unit-tested): `boardFor` (quality/manager/operator/analyst - the route
  was never guarded), `resultsFor` (all but engineers - their own results
  live on My requests), `hirataFor` (engineer/operator/analyst - whoever
  handles panels). Sets: Engineer new/requests/lab/lots/hirata/help; QE
  requests/queue/board/lab/results/help; Manager
  requests/board/lab/results/analytics/help; Admin
  new/requests/lab/results/lots/help; Operator and Analyst
  requests/board/lab/results/hirata/help. Lots keeps `canRegisterLot`;
  Settings stays sidebar-only. Lots/results/hirata cards are static (no
  scene); the seven scene cards untouched.
- **HOME-10** (home-final: always-on scenes, AT&S white, 2026-10-01, Prince)
  Every Home card has a scene and it plays ALL THE TIME in a stage on top
  of the card (calm loop at 30 fps; livelier on hover/focus - the engine
  passes `energy` 0..1 and speeds the clock). New scenes: Results
  (plinko-style wireframe height map, ripple grows on hover), Lots (panels
  load a cassette, the lot moves on), Hirata (dot code read by a scan
  bar). Light schemes animate too, in near-black ink (`--scene-ink`).
  Engine: one off-screen WebGLRenderer, each card's frame copied into its
  own 2D canvas (one GL context for all cards); off-screen cards and a
  hidden tab pause; cards that leave the page are disposed. THREE loads
  ~200 ms after Home shows scene cards (was: first hover), still never in
  index.html. Unchanged: slow-frame / software-GL fallback to the still
  icon, reduced motion = no scene, off in one place (`features.home3d`).
  This replaces D-WEBGL-1's "hover-only" and "light schemes stay static".
  AT&S (option B): white room, #262626 replaces the navy for text,
  actions and lines; Home tiles are dark #262626 with white writing and
  white scenes (`--tile`, `--tile-fg`, `--tile-fg-muted`, `--tile-accent`,
  `--scene-ink` in themes.js; every theme defaults them from its own
  surface/fg/accent). Other panels in AT&S are white with #262626 ink.
- **HOME-11** (home-final: AT&S blue, 2026-10-01, Prince, option A) AT&S
  is a white page with AT&S blue (#0C3D6E) panels, tiles, top bar and
  sidebar, all writing and scenes white inside them. This replaces the
  #262626 look of HOME-10 the same day. Mechanism, theme-neutral: a theme
  may name a `page` palette (AT&S: pure-white); themes.js emits --pg-*
  and --pn-* copies of the colour keys (ZONE) for every theme; .main
  swaps to the page copy, the panel-like boxes (list in css/app.css,
  guarded by css-check) swap back. Controls take the zone they sit in, so
  a button or field straight on the page is light, inside a panel blue.
  Text straight on the page (titles, hero, empty states) reads in dark
  ink - white on white is impossible. Themes without `page` are
  unchanged (both copies equal). contrast.js checks both zones.
- **HOME-12** (home-final: card layout back + New request scene, 2026-10-01,
  Prince) The Home card keeps the studio layout Prince designed from
  (Lucide icon top-left, title, one line at the bottom); the scene plays
  in a layer BEHIND the words, all the time - the HOME-10 stage on top of
  the card is dropped. Scene redesign goes card by card, each movement
  showing the card's purpose. New request = option B "the form fills
  itself": a traveller card slides in blank, tool glyph pops in and its
  line types on, the panels pop in one by one, the priority stripe runs
  down the edge, a stamp drops and lands, the card flies off to the lab.
- **HOME-13** (home-final: My requests scene, 2026-10-01, Prince, option A
  "the journey") A curved track with four stations (Submitted, Queued,
  Measuring, Done); a traveller card rides it stop-and-go, the track fills
  behind it, stations light and pulse on arrival; at Measuring a probe
  dips and a scan line sweeps the card; at Done a check mark pops with a
  burst; then the next card starts.
- **HOME-14** (home-final: My queue scene, 2026-10-01, Prince, option A
  "the tool at work") Request blocks wait on a conveyor in priority order
  (urgent one with a red stripe); each cycle the belt steps the next block
  under the gantry tool head, the head lowers, a laser line sweeps it, the
  block turns from outline to solid ink with a pop, the head lifts and the
  belt carries it out while a new request joins at the back.
- **HOME-15** (home-final: Board scene + the rule, 2026-10-01, Prince) Rule
  for every scene from now on: COOL FIRST, the exact job second (Prince:
  "does not have to show exactly what my queue does but should be
  cooler"). Board = option A "the live board": tilted 3D board, lanes x
  stages with glowing grid lines; cards hop column to column in arcs with
  a fading trail, lanes staggered so something always moves; landing
  ripple rings; cards drop in at the first column and lift off past the
  last; a red late card pulses; a scan light sweeps the columns; slow sway.
  My queue (HOME-14) is reopened for a cooler design.
- **HOME-16** (home-final: My queue "orbit core" + tile size, 2026-10-01,
  Prince) My queue scene = option A "orbit core": a spinning wire crystal
  (the tool) with a glowing heart; request cubes circle it on three tilted
  rings with light trails; every 3 s one cube spirals in, the core flashes
  and fires a shock ring, a fresh cube pops in. Replaces HOME-14. Tiles:
  a 3 x 2 grid, max 1200 px wide, each tile 16:10 - six tiles fit under
  the hero on 1440x900 and 1920x1080 without scrolling (2 columns under
  1100 px, 1 under 700 px).
- **HOME-17** (home-final: six doors for everyone + Scripts, 2026-10-01,
  Prince) Board, Lab status, Results, Hirata and Help are open to every
  signed-in person and on every Home. The sixth tile is the role's main
  job and never a page the role cannot use (`domain.homeRoleDoor`): My
  queue (quality) > New request (engineer, admin) > Analytics (manager) >
  My requests (operator, analyst - Analytics was NOT opened to analysts;
  that would be a new permission). Lots and My requests leave Home (still
  in the sidebar); the Lots scene is removed. Replaces HOME-9's sets and
  the boardFor/resultsFor/hirataFor gates. Under the tiles a small
  "Scripts" strip, open to everyone, NOT tiles: pill launchers with the
  live tool glyph, "> name" in mono with a blinking caret, an arrow that
  slides on hover. PRF Insight opens #/prf (the PRF_Insight.py port); HRM
  AutoLot shows "coming soon" (no page yet - OPEN_QUESTIONS).
- **HOME-18** (home-final: five scenes in the queue style, 2026-10-01,
  Prince: "I love queue, build things like that, you decide") Lab status
  "tool constellation" (hub + five spinning tool crystals on a tilted
  ring, packets racing the spokes, radar arm, one tool goes down red and
  comes back with a shock ring); Results "the live surface" (wireframe
  height map, a probe orb flies a figure-eight with a trail, the ripple
  follows it, data cubes lift off and fade up); Hirata "the code
  assembles" (100 dots swirl, snap into the dot code, scan beam, flash +
  shock ring, burst out); Help "the throw" (two real dice thrown in,
  bounce and spin, settle with a landing ripple, lift away); Analytics
  "bar city" (6 x 4 bars rolling in waves, trend line with racing head,
  a peak bar spikes with a shock ring). New request, My requests and
  Board stay as built today.
- **HOME-19** (home-final: themes, 2026-10-01, Prince) Quant is replaced by
  NEUTRAL (light grey room #F3F3F1, #262626 ink, graphite Home tiles with
  white writing and white scenes) - Quant and Dark Teal were near twins;
  the key `quant` now aliases to neutral. New theme COPPER, the PCB panel:
  dark laminate room #15100C, copper-clad tiles #3B2414 with a copper edge,
  bright copper #E0915A for actions, copper scene ink. Six themes: AT&S,
  Dark Teal, Pure White, Slate, Neutral, Copper. Contrast AA in both zones.
- **HOME-20** (home-final: purpose scenes, 2026-10-01, Prince: "like queue"
  meant movement and complexity, not the same look) Each scene gets its
  own visual language. Hirata = "the code drills itself": a copper panel
  (copper in every theme, H-3) flips in, glowing beads swirl around it and
  drop column by column into a REAL Hirata code (start column of five,
  then 8/4/2/1 over the baseline per digit), each becoming a drilled hole
  with a flash; engraved digits fade in; a read bar lights each column;
  the holes pop back out and the next code drills. Lab status = "the lab
  floor": HRM turret over a sliding stage, AOI camera on its gantry with
  a light sheet, PRF stylus tracing, QVM zoom lens under a ring light, FIB
  column firing with sparks; status lamps, one tool in maintenance per
  loop; a cart carries a copper panel and docks at each tool, which works
  harder while it is there. Help = "the dice become help": two dice always
  land on FIVE; their ten pips fly up into a glowing question mark in a
  halo, then fly home and the dice lift away.
- **HOME-21** (home-final: AT&S retired, 2026-10-01, Prince) AT&S is
  retired ("not good"); its key aliases to dark-teal. Dark Teal is the new
  default ("dark theme first", Mission Control). Five themes: Dark Teal,
  Pure White, Slate, Neutral, Copper. The page/panel zone mechanism
  (HOME-11) stays in themes.js/app.css; no theme uses a `page` palette now.
- **HOME-22** (home-final: first-login welcome, 2026-10-01, Prince, option
  A) The first time a signed-in person opens Home they see a welcome card
  instead of the tiles: "Welcome, <first name>", their role chips and the
  three things they will do most (copy keyed by `domain.homeRoleDoor`).
  A new "welcome" scene plays behind it: a copper PCB panel turning, traces
  growing from the chip on arrival, signals racing to flashing vias,
  sparks rising. "Let's go" folds the card away and the six tiles fly in
  (staggered, transform/opacity; instant under reduced motion). Shown once
  per person per PC (`welcomed` pref in localStorage - no schema change;
  moves to the user record with the server login). The "You are not in
  yet" sign-in slot wears the same card and scene.
- **HOME-23** (home-final: admin nine, engineer Lots, 2026-10-01, Prince)
  Admins see all nine doors on Home, a full 3 x 3 (New request, My
  requests, Analytics, Board, Lab status, Results, Lots, Hirata, Help).
  Engineers get Lots in place of Results (lot status matters more to
  them). Lots has a scene again, "the lot tower": eight copper panels fly
  in and stack with a bounce, a laser runs up and reads each edge, the
  stack fans into a turning spiral, folds back and scatters for the next
  lot. Pure White tiles get a soft grey-blue #F3F6FA with a #C7D3E2 edge
  so they read as objects on the white page; scenes stay black.
- **HOME-24** (home-final: New request is the flagship + welcome copy,
  2026-10-01, Prince: "new request should be the greatest") New request =
  "pick, build, launch": a copper panel with a 6 x 4 pad grid; a targeting
  ring picks five pads that pop up as glowing cubes; the cubes spiral
  together and build the traveller card (edges draw on, red priority
  stripe ignites, three lines type on); two rings converge as it charges;
  it launches on an arc with a light trail and sparks into a turning lab
  portal, which flashes, fires a shock ring and shows a check. Replaces
  HOME-12's "form fills itself". Welcome copy gets a line with a smile per
  role; admins get their own ("You hold the keys to the whole lab. No
  pressure - there is a daily backup.") with Settings-first steps.
- **HOME-25** (home-final: top bar, 2026-10-01, Prince) The theme button
  sits right next to the bell (one click opens the five themes, one more
  click switches - kept per person on this PC), and a sign-out icon
  (Lucide log-out, added to the sprite and core.js PATHS) sits beside it;
  it runs the same "change-user" as the user menu's Sign out.
- **HOME-26** (home-final: theme button cycles, 2026-10-01, Prince: "people
  keep on clicking and changing") The topbar theme button no longer opens a
  menu: every click switches straight to the next theme (Dark Teal, Pure
  White, Slate, Neutral, Copper, round again), with a short toast naming
  it; the button's tooltip says which theme is on. Kept per person on this
  PC. Reverses the Step 2 "no cycling" popup; the full gallery with Office
  default stays in the user menu's Theme... dialog.
