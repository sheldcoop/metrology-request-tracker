Metrology Request Tracker - vendor/lucide-sprite.svg
==================================================

What:   Lucide icons used by the app, pinned version 1.49.0, 56 symbols.
Source: npm package lucide-static@1.49.0, files icons/<name>.svg
        (https://www.npmjs.com/package/lucide-static/v/1.49.0),
        repackaged here as <symbol> elements, path data untouched.
Licence: ISC, Copyright (c) Lucide Icons and Contributors.
         Full text: package LICENSE inside lucide-static-1.49.0.tgz,
         and https://github.com/lucide-icons/lucide/blob/main/LICENSE.

Why a sprite file AND inline copies: the app runs from file://, where
fetch() cannot load this file. The sprite is the audited upstream record
(what we vendored, byte-identical path data); the copies actually drawn
live in js/ui/core.js PATHS, inlined so ui.icon() needs no loading.
Regenerate both with node tests/make-lucide.js (bump VERSION there first),
then paste the printed PATHS block into core.js and run the gate.

Loading rule: this file is NEVER in index.html and is never fetched at
runtime. Stroke width stays 1.5px (our rule), set by ui.icon(), not by
the upstream files (which assume 2px).
