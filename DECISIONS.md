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
  `TEST_RUN.md`; the M4 audit is covered by that run. M5 is planned and built meanwhile
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
- **S-1** (2026-09-25, first-day walkthrough on a fresh folder) The setup to-do list (Health) is in the
  order a new admin works through it - tools and people, the lab calendar, the lists, a second admin -
  with one line per tool ("FIB: no primary quality engineer, no backup quality engineer, no results
  folder") instead of three (23 lines became 14). The 20 sample magazines are on it now; the part-number
  line no longer talks about lots (F-6). While quality engineers are missing, Health says how colleagues
  get into the app (open the launcher once, then an admin ticks their roles).
