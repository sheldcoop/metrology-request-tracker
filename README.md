# Metrology Request Tracker

Engineers request measurements (HRM, AOI, PRF, QVM, FIB) on panels of a lot;
lab operators run them and hand back a results folder.

Zero install: static files on the shared drive, opened in Microsoft Edge.
No server, no build step, no internet.

> M1 (the shell) is done: Lab status, Settings and Help. M2 is being built:
> Lots works; the request form and request page follow. The other menu
> entries are greyed until their milestone.

## What the pages do (M1)

**Lab status** - every tool as a nameplate: its glyph, Up / Maintenance /
Down with an "until" date, its quality engineers, measurement types and
BKMs. The tool's quality engineers and admins set the status here.

**Lots** - register a lot: lot number (18178, split lot 18178.01), project,
part number (of that project), build-up, panel count, note. Any engineer
registers one; the owner or an admin changes it.

**Away** - your name (top right) > "I'm away...": first and last day and an
optional note, never a reason. Shown on Lab status, People and Health.

**Settings** (admins, PIN once per visit):
- *Health* - "still to do before real use" (the office checklist, live:
  sample entries, missing operators and results roots, calendar, closing
  days, people to review) and "data health" (broken links, odd states).
  Every line links to where it is fixed.
- *People* - name, Windows ID, email, roles (ticks), active, away; review
  people who added themselves. Roles: Engineer (requests), Quality engineer
  (measures), Operator (no rights yet), Manager, Admin.
- *Tools* - code, glyph, primary and backup quality engineer, results root; per tool its measurement
  types, extra fields (8 kinds) and BKM library (Copy path).
- *Lists* - projects, part numbers (each linked to one or more projects),
  build-ups, process steps, priorities.
- *Lab calendar* - lab days and hours, public holidays and closing days.
- *Audit log* - every change, filterable.
- *Data & PIN* - the data file, a copy to download, daily backups with
  restore, the admin PIN.

Entries in use are hidden, not deleted. A "Sample" tag marks made-up
entries; save one (changed or not) to confirm it as real.

**Help** (the ? button) - step-by-step guides for every task, searchable and
printable, including "Admin: setting up the office".

---

## Getting started

1. Put the tool folder on the share (or anywhere) and make an empty folder
   `data` next to `index.html`.
2. Double-click **`Metrology Tool.cmd`**. It opens the app in Microsoft Edge
   and tells it your Windows user name. (Opening `index.html` directly works
   too; the app then asks for your Windows user name once.)
3. Click **Choose data folder** and pick `data`. The browser remembers it;
   later visits need one click ("Reconnect") at most.
4. **First run** (empty `data`): enter your name and an admin PIN. You become
   the first Admin. Tools, lists and sample data are set up for you.
5. **Everyone else**: the first time, say who you are. If an admin already
   added you, pick your name ("Is this you?"); otherwise you are added as an
   Engineer and an admin sets your roles.

Chrome works too, but the launcher opens Edge. Firefox and Safari cannot
write to a folder, so they are not supported.

---

## Folder layout on the share

```
Metrology Tool.cmd      the launcher: opens the app in Edge with your Windows ID
index.html              the app
css/ js/ vendor/        program files
data/                   YOUR DATA - never replace or delete
  mrt_data.json         the data file
  backups/              daily copies
```

The launcher finds its own folder, so the whole tool folder can be moved or
copied without changing anything.

---

## Updating the app

**Only program files are replaced. The `data\` folder is never touched.**

1. Tell the team to close the app (a save in progress must not be cut off).
2. Copy a backup of `data\` somewhere safe (belt and braces).
3. Copy the new program files over the old ones: `index.html`,
   `Metrology Tool.cmd`, `css\`, `js\`, `vendor\` (and `tests\`, `ui-kit.html`
   if you use them).
4. **Do not copy a `data\` folder from the new version, and do not delete the
   existing one.** A new version never ships one; if you see one, skip it.
5. Open the app. If the new version needs a newer data format, it upgrades
   `mrt_data.json` itself, and first keeps a copy of the old file in
   `data\backups\`.

`data/` is excluded from git, so a copy of the repository never contains live data.

---

## Tests

- Open **`tests/test.html`** in Edge or Chrome: every rule of `domain.js` and
  `store.js`, run against an in-memory folder. It must say **ALL ... TESTS PASSED**.
- The same from a terminal, plus the code checks:

  ```
  node tests/run-tests.js      domain + store tests (same as test.html)
  node tests/app-smoke.js      the real app in a fake browser: first run, sign-up, Settings, Help, save errors
  node tests/preview-smoke.js  the dev preview boots on demo data
  node tests/ui-smoke.js       every UI component and the UI kit
  node tests/css-check.js      CSS braces balance, component rules present
  node tests/contrast.js       WCAG AA contrast of every text colour, 3 themes
  ```
- **`ui-kit.html`** - every component in every state; "All three" shows the themes side by side.
- **`tests/preview.html`** - the real app on demo data in memory (nothing is
  saved); `?audit=1` runs the accessibility audit, `?perf=1` times the pages.
  Details and the rules for changing code: `CONTRIBUTING.md`.

