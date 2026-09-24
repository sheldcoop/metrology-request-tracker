# Metrology Request Tracker

Engineers request measurements (HRM, AOI, PRF, QVM, FIB) on panels of a lot;
lab operators run them and hand back a results folder.

Zero install: static files on the shared drive, opened in Microsoft Edge.
No server, no build step, no internet.

> Work in progress (milestone M1). Getting started, pages and tests are
> added here as they are built.

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
