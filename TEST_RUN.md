# Test run R1 - everything built so far (M1-M5, Hirata tools, audit fixes)

Rewritten 2026-09-25 (DECISIONS A-10). One quality engineer (QE) and one engineer - or Prince
alone with two browsers - go through it on the real share, in Edge.

**How to report:** tick `[x]` what works. When something does not, write the step number, what
you did, what you expected and what happened in the table at the end (a screenshot helps), e.g.
"T4.7 - clicked Complete, the folder was empty, expected `\\srv\lab\FIB\2026\FIB-...`".
Everything else is welcome too: confusing words, too many clicks, something missing.

**Two people with one PC:** open the app in **Edge** as the QE and in **Chrome** as the engineer
(same data folder). Each browser remembers its own person. Or use your name (top right) >
**Change user** and type the other Windows user name.

**Shortcut for trying everything:** the `demo-data\` folder in the repo is a full demo (admin PIN
**1234**). Settings > Data & PIN > "Fill with demo data" puts it into any data folder (a backup is
kept first). The steps below work on the demo or on a fresh folder.

---

## T0. Before you start (Prince, once)

- [ ] **T0.1** Do: `git pull` on the share copy (or copy the new program files - never `data\`).
      Expect: `index.html`, `Metrology Tool.cmd`, `js\`, `css\` updated; your `data\` untouched.
- [ ] **T0.2** Do: open `tests\test.html` in Edge. Expect: green **ALL 547 TESTS PASSED** (or more).
- [ ] **T0.3** Do: double-click `Metrology Tool.cmd` from a **mapped drive** (`Z:\...`).
      Expect: Edge opens the app; the address bar shows no `?who=` afterwards.
- [ ] **T0.4** Do: the same from the **network path** (`\\server\share\...`).
      Expect: a short "UNC paths are not supported" line in the black window (harmless), then Edge opens the app.
- [ ] **T0.5** Do: first time on this PC: **Choose data folder** > pick `data\`.
      Expect: the app opens. Next start: straight in or one click "Reconnect".
- [ ] **T0.6** Do (only on an old data file): watch for a message after opening.
      Expect: "The data file was upgraded ... A copy of the old file is in backups\" - and that copy exists.

## T1. Shell (everyone)

- [ ] **T1.1** Expect: side menu with Lab status, My queue, My requests, New request, Lots, Board, **Hirata tools**, Settings, Help live; **Analytics greyed "M5"**.
- [ ] **T1.2** Expect: start page by role - QE on **My queue**, engineer on **My requests**, others on Lab status.
      Do: user menu > Start page > pick another; restart. Expect: your choice wins.
- [ ] **T1.3** Expect: the **strip under the top bar** shows Line stop / Late / On hold / Needs clarification counts
      (QE: your tools; engineer: your requests) and a clock. Do: click "Late". Expect: My queue / My requests filtered.
- [ ] **T1.4** Do: user menu > Theme > Dark, Light, HC. Expect: every page readable in all three; remembered per person. Light = calm grey instrument look (no grid, no glow); High contrast = white paper, black 2px lines, blue actions (P8). Note anything that still looks amateur.
- [ ] **T1.5** Do: user menu > Reduce motion on. Expect: nothing moves (glyphs, pulses, entrances); off again moves.
- [ ] **T1.6** Do: `[` key. Expect: side menu collapses to icons; again opens. Remembered.
- [ ] **T1.7** Do: `?` key. Expect: the shortcut list. `g` then `q` / `r` / `l` / `t` / `s` / `h` go to the pages.
- [ ] **T1.8** Do: `/`, type part of a request ID, a lot number, a person, a word from a comment.
      Expect: results for each; Enter opens the first.
- [ ] **T1.9** Do: change something (e.g. a tool status), then **Undo** next to the save lamp within 10 s (or Ctrl+Z).
      Expect: the change is back; the audit log shows both.
- [ ] **T1.10** Expect: the save lamp is green "Saved hh:mm" after every change.

## T2. Settings (admin, PIN)

- [ ] **T2.1** Do: Settings. Expect: PIN asked once per visit; a wrong PIN says "Wrong PIN". A non-admin sees "Settings are for admins".
- [ ] **T2.2** Health: Expect "Still to do before real use" (sample entries, tools without QEs / results root,
      calendar, closing days, people to review) and "Data health". Each line's button opens the right place.
- [ ] **T2.3** People > Add person: name, Windows ID, **Quality engineer** role. Expect: saved; a wrong email is refused inside the dialog.
- [ ] **T2.4** People: someone who added themselves shows **New**; click **Reviewed**. Expect: the mark goes.
- [ ] **T2.5** People > Edit a person > Away from / until (until empty = until further notice). Expect: "Away" shown; Lab status shows it.
- [ ] **T2.6** Tools > Edit FIB: primary and backup QE (only quality engineers offered), results root `\\...`.
      Expect: a path that is not a share path is refused inside the dialog.
- [ ] **T2.7** Tools > pick a tool: measurement types (a "Sample" one: open it, Save unchanged -> it becomes real),
      extra fields (add a "One choice" field with 3 choices, one per line), BKMs (Copy path).
- [ ] **T2.8** Tools: delete a type that has a BKM. Expect: "Cannot delete ... used by 1 BKM - hide it instead".
- [ ] **T2.9** Lists: projects, **part numbers** (linked to one or more projects), build-ups (layers), priorities
      (one default), process steps, on-hold reasons, magazines, lot fields. Add / edit / hide one of each.
- [ ] **T2.10** Lab calendar: "These are right" (or change days/hours); add a closing day (24.12.);
      "Public holidays <next year>". Expect: the Health to-do list gets shorter.
- [ ] **T2.11** Audit log: every change so far, filter by a name. Expect: who / when / old -> new / reason.
- [ ] **T2.12** Data & PIN: Download a copy now (a JSON file arrives); the Backups list shows today;
      Change the PIN (twice, with a reason). Restore: try on the demo folder only.
- [ ] **T2.13** Settings > Lots: add several lots at once ("99950-99952"), change a lot's owner (reason), delete an unused lot.

## T3. Engineer: lots and a new request

- [ ] **T3.1** Lots > Register lot: number (5 digits or `18178.01`), optional panel count, lot fields.
      Expect: saved; a duplicate number is refused.
- [ ] **T3.2** New request: step 1 **Tool & method** - pick FIB (drawing), a measurement type, a BKM or paste an own path.
      Expect: the traveller card on the right fills in live; Next opens step 2.
- [ ] **T3.3** Step 2: Project (part numbers of that project appear), Lot (type a registered one: nothing is filled in or locked;
      type a new number: "new"), Build-up (optional; the layer chips change), layers.
- [ ] **T3.4** Step 2: Hirata IDs `3252-3255`. Expect: four chips, **each with a small copper panel to its right** showing its drilled pattern.
      Type `3252, abc`. Expect: "abc is not a Hirata ID" at the field. Try "Just how many" = 2.
- [ ] **T3.5** Step 3: pick a magazine, **press and drag** over slots (real mouse). Expect: the IDs appear in the slots in order;
      slots of other open requests are grey. Or write a note instead.
- [ ] **T3.6** FIB (destructive): the tick "Panels may be destroyed" is required; "afterwards" is set to scrap.
- [ ] **T3.7** Step 4: priority Line stop -> a reason is required; needed-by date optional.
- [ ] **T3.8** Review: every step green; warnings make sense (no BKM, tool down/maintenance, the same panels already open). Submit.
      Expect: an ID like `FIB-260926-01`; a new lot appears on Lots.
- [ ] **T3.9** Save a draft, close, carry on later (My requests > Drafts), delete a draft. Copy a past request: everything but date, reason, place.
- [ ] **T3.10** The request page: traveller card (priority stripe, stamp, glyph), panels: copper panels light up as you type IDs in the form; after Panels received they sit in an "In the lab tray"; after Complete a check or a red cross (scrapped) - P4; a needle dial under Needed by (green / amber / red zones; the needle moves right as lab time runs out; a pause sign when on hold - P2), countdown "x h lab time left" or
      "clock paused (outside lab hours)", status rail, timeline, BKM path with Copy.
      Expect: under Panels **each panel as a copper panel with its decoded fields**.
- [ ] **T3.11** Comment with `@Name` of the QE. Edit the request with a reason: the timeline shows "panels ... -> ...".
- [ ] **T3.12** Print slip: A6 (or A4). Expect: big ID, barcode, the panels **as copper patterns** (copper colour kept on paper),
      "FIB DESTROYS THESE PANELS". Hold it next to a real panel: does the pattern match?
- [ ] **T3.13** With a hand scanner: scan the slip's barcode on any page (click the page first, not a text field). Expect: the request opens.
- [ ] **T3.15** Templates: on one of your requests "Save as template" (a name). New request: "Start from a template" fills tool,
      type, BKM, project ... but not lot, panels, place, date. My requests > filter "My templates": rename, delete.
- [ ] **T3.14** Cancel a request with a reason. Expect: stays visible as Cancelled; never deleted.

## T4. Quality engineer: the queue

- [ ] **T4.1** My queue: Line stop on top, then late (red), then by date; "assigned to me" first. Filters: tool, status (incl. Line stop, Late).
- [ ] **T4.2** Accept (with and without an expected-done date). Expect: the engineer sees the expected date.
- [ ] **T4.3** Panels received (who, when, where kept). Start: if not received yet it asks once, already ticked.
- [ ] **T4.4** Hold with a reason from the list + note; Resume. Expect: back where it was; the countdown paused meanwhile.
- [ ] **T4.5** Needs clarification (comment required). Engineer: answers in the timeline, clicks **Answered**. Expect: back in the queue.
- [ ] **T4.6** Change the priority as QE. Expect: in the timeline and the audit log.
- [ ] **T4.7** Complete: the results folder is proposed as `<root>\2026\<ID>\` (Copy; does the folder open?);
      what happened to the panels; put back: the same magazine and slots offered - pick other slots once.
- [ ] **T4.8** Engineer: **Results OK**, or **Reopen** with a reason. A completed request closes by itself after 7 days.
- [ ] **T4.9** Tick several rows: Accept all / Start all.
- [ ] **T4.10** Board (redesigned, P5): tool rows with a lamp; tools with nothing on them fold to one line;
      compact cards with a needed-by bar (green, amber under 8 lab hours, red pulsing when late, striped when on hold).
      Click a card: a side panel opens from the right with the traveller and the action buttons; Start / Complete
      ask the same questions as on the request page; the panel closes and the card moves. Esc or a click on the dim
      area closes it. Ctrl+click opens the full request page in a new tab. Nothing can be dragged.
- [ ] **T4.11** Away: set yourself away (user menu > I'm away). Expect: new requests of your tool go to the backup with a note;
      "Take it" lets either QE take a request.
- [ ] **T4.12** Lab status: per tool queue numbers (open, late, oldest, typical wait); set a tool Down / Maintenance (until date, note);
      while a request is In progress the tool drawing moves; a Down tool's lamp blinks.

## T5. Notifications (M4, both)

- [ ] **T5.1** The **bell**: a red count for new things (new request for the QE, status changes for the engineer, @mentions).
      Click a line: the request opens. "Mark all as read" clears it. Read/unread is per PC.
- [ ] **T5.2** Bell > turn on pop-ups. Expect (unknown from `file://`): Windows pop-ups while the app is open - write down if nothing comes.
- [ ] **T5.3** After Submit / Needs clarification / Complete / Cancel: the green message offers "Email ..." -> a ready Outlook draft
      (people need an email in Settings > People). Does it open your Outlook?
- [ ] **T5.4** Two browsers: someone saves while the other only looks. Expect: the other page updates by itself (no dialog open, nobody typing).
- [ ] **T5.5** Both change something at nearly the same time. Expect: "Data was changed by ... Reload?", nothing lost.

## T6. Hirata tools (everyone)

- [ ] **T6.1** Menu > Hirata tools > **Read a panel**: tap dots on the grid (use a real panel).
      Expect: digits under each column, the 9-digit code, each field (Supplier, Year, Week, Day, Lot per day, Panel), the copper panel of the last 4.
- [ ] **T6.2** Tap a dot that would take a column above 9. Expect: it shakes and "cannot go above 9". The bottom row cannot be changed.
- [ ] **T6.3** Type `161234507` in "Or type the digits". Expect: the grid shows it; letters are refused. Copy digits works.
- [ ] **T6.4** **Find a pattern**: `3407, 0119, 161234507, 12x`. Expect: three copper panels with their fields, "Skipped: 12x", the 0-9 reference.
- [ ] **T6.5** Print. Expect: the copper panels print in copper. Hold them against real panels: do they match?
- [ ] **T6.6** Keyboard only: Tab into the grid, arrows move, Space sets a dot.

## T8. Analytics and exports (M5)

- [ ] **T8.1** Menu > Analytics. Expect: tabs My work and My requests; with the **Manager** role also Lab and Management
      (Settings > People: tick Manager for yourself to see them).
- [ ] **T8.2** Filters: From / To / Tool / Project change every number; "Last 90 days" resets.
- [ ] **T8.3** My work (as QE): open, late, due today, on hold, waiting on me; "Done by me, last 14 days".
- [ ] **T8.4** My requests: open with expected finish; **Where is my lot** - pick a lot, see all its requests on every tool.
- [ ] **T8.5** Click any tile, bar or table row. Expect: a list of exactly those requests (links work) with "Download these".
- [ ] **T8.6** Lab: backlog per week, turnaround median / p90 with hold apart, on time, load per QE, clarification per tool / BKM,
      on-hold reasons. Do the numbers look right for requests you know?
- [ ] **T8.7** Management: requests per month by project, on time, Line stop response, demand per tool.
- [ ] **T8.8** Charts: the full-screen button (top right of a chart); hover shows values; readable in all three themes.
- [ ] **T8.9** Downloads open in **Excel** as .xlsx: a chart's Download, My queue / My requests Download (the filtered list),
      Settings > Data "Download the request history" (sheets Requests + Timeline).
- [ ] **T8.10** Management > Monthly management pack: pick last month, Download the pack. Expect: one workbook, seven sheets
      (Summary, Per tool, Per project, Line stop, On-hold reasons, Clarification, Requests); Summary matches the page for that month.

## T7. Help and looks (Prince)

- [ ] **T7.1** Help (?): search "restore", "Hirata", "away"; each guide's button opens its page; Print / PDF works.
- [ ] **T7.2** `ui-kit.html`: every component in all states; "All three" themes side by side - anything unreadable or ugly?
      New sections: Traveller card (four sizes), Hirata code, Panel map (marked unused).
- [ ] **T7.3** `tests\preview.html?audit=1` (and `&theme=light`, `&theme=hc`): F12 console ends with **AUDIT DONE 0 findings**.
      Also on `#/hirata`, `#/queue`, `#/new`, `#/settings/tools` - send me any AUDIT FAIL lines.
- [ ] **T7.4** `tests\preview.html?perf=1`: console PERF lines - any page render above 150 ms?
- [ ] **T7.5** Anything slow with the real file (a page that takes more than a blink)?

---

## Notes

| Step | Date | Who | What I did | What I expected | What happened |
|---|---|---|---|---|---|
|  |  |  |  |  |  |
|  |  |  |  |  |  |
|  |  |  |  |  |  |

**Missing / confusing / too many clicks:**

-
