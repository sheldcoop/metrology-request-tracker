# Office setup checklist

What is still fake or empty, and what to check when the tool first runs at the
office. Tick items off as you go; delete this file when everything is done.

All starting data - real and fake - is in **`js/seed.js`**, one file, fake
entries marked `sample: true`. Opening the app on an empty `data\` folder
creates `data\mrt_data.json` from it. When real values come, change them in
two places:
- **`js/seed.js`** - so every *new* data file starts right (replace the entry,
  drop `sample: true`);
- **Settings** - to fix the data file that *already exists* (seed.js never
  changes an existing file).

This checklist will also be inside the app: an admin setup guide in Help and
a live "still to do" list in Settings > Health (DECISIONS M1-11).

---

## 1. Fake data - replace or remove it (Settings, from M1 step 4)

Every entry here carries a "Sample" tag, Lab status counts it, and Health
lists it until it is edited or deleted.

- [ ] **Measurement types**: 25 made-up ones, 5 per tool (DECISIONS M1-8,
      OPEN_QUESTIONS #6). Check them with the engineers; rename, hide or delete.
- [ ] **BKM library**: 25 made-up BKMs with fake paths `\\SAMPLE-SHARE\BKM\...`
      (OPEN_QUESTIONS #7). Replace them with real names, paths and versions.
      Delete fake BKMs *before* their measurement types (a type cannot be
      deleted while a BKM points at it).

## 2. Real, but please confirm

- [ ] **Tools**: HRM, AOI, PRF, QVM, FIB, all Up (Q24). Only FIB is destructive (M2-11).
- [ ] **Priorities**: Line stop P1, Hot P2, Normal P3 (default), Low P4 (Q26).
- [ ] **Projects**: C4F, SHIFT, HORUS. **Build-ups**: BU-01..BU-05, TEST, DOE, OPT
      (copied from ABF Tracker's defaults).
- [ ] **Lab hours**: 07:00-18:00. Days are **Mon-Fri** - not yet confirmed.
- [ ] **Holidays**: Austrian public holidays 2026 and 2027 are filled in.
      Company closing days (e.g. 24 and 31 December) are **not**: add them.

## 3. Empty - needs real data

- [ ] **Quality engineers**: tick the role in Settings > People, then set the
      primary and backup quality engineer per tool (Settings > Tools).
- [ ] **Rights per role**: decide what Operators may do (today: nothing yet) -
      OPEN_QUESTIONS #14.
- [ ] **Results roots**: the real share folder per tool (e.g. `\\server\lab\FIB`).
- [ ] **Extra fields per tool**: none yet (OPEN_QUESTIONS #5).
- [ ] **Part numbers**: none yet. Add them in Settings > Lists and tick their
      project(s) (DECISIONS M1-13); real ones also go into `js/seed.js`.
- [ ] **Lot fields**: 7 sample ones (Purpose of the lot, Started on, Started by,
      DOE / experiment ID, Customer, Expected finish, Lot status) - DECISIONS M2-18.
      Shape them with the team in Settings > Lists; real ones also into `js/seed.js`.
- [ ] **Sample lots**: if "Add 3 sample lots" was used, delete 99901, 99902,
      99902.01 on the Lots page before real use (Health lists them).
- [ ] **Magazines**: 20 sample ones M70345-M70364 (24 slots) (DECISIONS M2-23, F-3) -
      replace with the real magazine numbers in Settings > Lists and `js/seed.js`.
- [ ] **Process steps**: none yet (DECISIONS M2-7). The steps of the line in order,
      e.g. After desmear, After Cu plating - Settings > Lists and `js/seed.js`.
- [ ] **People and roles**: only the first admin exists. Colleagues add
      themselves on first open (as Engineer); set their roles in Settings > Users.

## 4. First run at the office - never tested there yet

- [ ] Get the code on the share: `git clone https://github.com/sheldcoop/metrology-request-tracker.git`
      (needs git + GitHub access on that PC), or download the ZIP from GitHub
      and unpack it.
- [ ] Make an empty folder `data` next to `index.html`.
- [ ] **Everyone who uses the tool needs write access to `data\`** on the share.
- [ ] Double-click `Metrology Tool.cmd`. Edge must open the app.
      - from a mapped drive (e.g. `Z:\...`)
      - from a network path (`\\server\share\...`) - Windows first prints
        "UNC paths are not supported"; that is harmless.
      - if Edge does not open, the window shows the address to paste by hand.
- [ ] The app asks for the data folder once: pick that `data` folder.
- [ ] First run: enter your name and an admin PIN. Check your Windows user
      name is filled in (it comes from the launcher).
- [ ] A colleague opens it on their PC: they should see "Who are you?", not
      your name. After entering their name they are an Engineer.
- [ ] Check `data\backups\` gets a file after the first change of the day.
- [ ] Avoid `!` in the tool folder path (the launcher cannot handle it).
      Folder names with ä/ö/ü are untested.

## 5. Before go-live (rollout plan, DECISIONS R1-R4)

- [ ] After M3: one quality engineer and one engineer test for a few days before M4 -
      checklist in `TEST_RUN.md`.
- [ ] Name a second admin; hand over the PIN, backups and restore.
- [ ] Right before M6: an anonymised sample of the old request list.
- [ ] IT: a small server / Kubernetes slot (asked now; the shared-file version runs meanwhile).

## 6. Not built yet (for reference)

- ~~M1 step 4: Settings, Health, audit log, backups screen, "Change data folder".~~ Done:
  Settings > Health now shows this checklist live.
- ~~M1 step 5: Help page, ui-kit.html, preview, accessibility audit, CONTRIBUTING.md.~~ Done:
  Help > "Admin: setting up the office" holds this checklist too.
- Later milestones: requests (M2-M3), notifications (M4), analytics and Excel
  export (M5), import of the old request list (M6), QR code on the traveller
  slip (M2), real email and local AI (need a server and IT approval).
