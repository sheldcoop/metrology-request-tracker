# Metrology Request Tracker

Engineers request measurements (HRM, AOI, PRF, QVM, FIB) on panels of a lot;
lab operators run them and hand back a results folder.

Zero install: static files on the shared drive, opened in Microsoft Edge.
No server, no build step, no internet.

> Work in progress (milestone M1): Lab status works; Settings and Help
> follow in the next steps. The other menu entries are greyed until their
> milestone.

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
  node tests/app-smoke.js      the real app in a fake browser: first run, sign-up, menu, status, save errors
  node tests/ui-smoke.js       every UI component in every state
  node tests/css-check.js      CSS braces balance, component rules present
  node tests/contrast.js       WCAG AA contrast of every text colour, 3 themes
  ```

