# Test run (rollout R1) - before M4

One quality engineer (QE) and one engineer use the app for a few days on the real share.
Tick what works; write down what does not (what you did, what you expected, what happened).
A screenshot helps. Everything else is welcome too: missing fields, confusing words, too many clicks.

## 0. Admin, once (Prince)
- [ ] Pull `main`, open with `Metrology Tool.cmd` in Edge from the share. The data file upgrades
      (pop-up about backups\ - fine).
- [ ] Settings > People: give the QE the **Quality engineer** role, the engineer **Engineer**.
- [ ] Settings > Tools: make the QE **primary** of one tool (e.g. FIB), set its **results root**.
- [ ] Settings > Lists: add a real **process step** or two; check the **on-hold reasons**.
- [ ] Settings > Data & PIN > "Add 3 sample lots", or register real lots on the Lots page.

## 1. Engineer
- [ ] Opens on **My requests**.
- [ ] Lots > Register lot: lot number, project -> part numbers appear, build-up, panels, lot fields.
- [ ] New request: tool drawing, type, BKM (or own path), lot, pick panels on the map
      (click, Shift+click, type "1-5, 12"), where the panels are, priority, date. Submit.
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
