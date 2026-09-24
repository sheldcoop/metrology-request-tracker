# Test run (rollout R1) - before M4

One quality engineer (QE) and one engineer use the app for a few days on the real share.
Tick what works; write down what does not (what you did, what you expected, what happened).
A screenshot helps. Everything else is welcome too: missing fields, confusing words, too many clicks.

## Before the test run (optional)
- [ ] Click through everything with the big demo file first (README "Trying everything with the
      big demo file"): `demo-data\` folder, admin PIN 1234.

## 0. Admin, once (Prince)
- [ ] Pull `main`, open with `Metrology Tool.cmd` in Edge from the share. The data file upgrades
      (pop-up about backups\ - fine).
- [ ] Settings > People: give the QE the **Quality engineer** role, the engineer **Engineer**.
- [ ] Settings > Tools: make the QE **primary** of one tool (e.g. FIB), set its **results root**.
- [ ] Settings > Lists: add a real **process step** or two; check the **on-hold reasons**; check the **build-up layers** (BU-04 = up to 5F / 5B).
- [ ] Settings > Data & PIN > "Add 3 sample lots", or register real lots on the Lots page.

## 1. Engineer
- [ ] Opens on **My requests**.
- [ ] Lots > Register lot: lot number, panels (optional), lot fields - no project or build-up any more.
- [ ] Your own data folder: Settings > Lists > Magazines shows M70345-M70364 after the upgrade (or use
      Settings > Data > "Add the sample magazines"); the form's step 3 then offers them.
- [ ] New request (guided): tool drawing, type, BKM (or own path) -> Next. Project · Lot · Build-up on one
      line, three separate choices: pick the project (part numbers appear), type a registered lot
      (nothing fills in), then a new number ("New lot"). Build-up optional: pick one, the layers change. Hirata IDs ("3252-3255")
      or "Just how many". Tick a layer. Is it easy to follow? Do the folded lines say the right thing?
- [ ] Step 3: pick a magazine, press and drag over slots (real mouse); the IDs show in the slots in order.
      Slots of another open request are grey. Or write a note instead.
- [ ] Priority, date, purpose. Review: every step green. Submit. A new lot shows up on Lots.
- [ ] Warnings before submit make sense (no BKM, tool down, same panels open).
- [ ] The request page: traveller card, countdown in lab time, status rail, Copy buttons.
- [ ] Comment with @Name of the QE.
- [ ] Edit the request with a reason; the timeline shows the change.
- [ ] Save a draft, carry on later, delete a draft.
- [ ] When the QE asks a question: answer it from My requests (Answered).
- [ ] When completed: Results OK - or Reopen with a reason.

## 2. Quality engineer
- [ ] Opens on **My queue**; the Line stop is on top, late ones red.
- [ ] Accept (with and without an expected-done date), Panels received, Start.
- [ ] Hold with a reason, Resume. Needs clarification.
- [ ] Complete: the proposed results folder is right (Copy works, the folder can be opened).
      Put back: the same magazine and slots are offered; pick other slots once.
- [ ] Tick several rows: Accept all / Start all.
- [ ] **Board**: drag a card to the next column (Edge, real mouse); the allowed columns light up.
- [ ] Set yourself Away (user menu): new requests go to the backup.

## 2b. New since M3 (both)
- [ ] The **bell**: a red count for new things; click a line opens the request; Mark all as read.
- [ ] Bell > "Turn on pop-ups": do Windows pop-ups appear while the app is open? (Unknown from `file://`.)
- [ ] After Submit / a question / Complete / Cancel: "Email ..." on the green message opens a ready
      Outlook draft (people need an email in Settings > People).
- [ ] Someone else saves while you only look: your page updates by itself.
- [ ] Request page > **Print slip**: prints on A6 (or A4); a hand scanner reading the barcode opens
      the request (click somewhere on the page first, not in a text field).
- [ ] Lab status: queue numbers per tool; while a request is In progress, the tool drawing moves;
      a Down tool shows a blinking lamp. With Reduce motion (user menu) everything stands still.

## 3. Both, all the time
- [ ] Two people saving at nearly the same time: the "someone else saved" message, nothing lost.
- [ ] Undo (10 s, Ctrl+Z) after a change.
- [ ] The three themes (user menu) - all readable?
- [ ] Anything slow (a page that takes more than a blink)?
- [ ] Help (?) answers the questions you had.

## Notes
| Date | Who | What happened | Expected |
|---|---|---|---|
|  |  |  |  |
