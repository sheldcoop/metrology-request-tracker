Metrology Request Tracker - vendor/three.min.js
=============================================

What:   three.js, pinned UMD build, version 0.160.0 (r160).
Source: npm package three@0.160.0, file build/three.min.js
        (https://www.npmjs.com/package/three/v/0.160.0).
Licence: MIT, Copyright (c) 2010-2023 three.js authors.
         Full text: package LICENSE inside three-0.160.0.tgz,
         and https://github.com/mrdoob/three.js/blob/r160/LICENSE.

Why this build: r160 is the LAST three.js release that still ships
build/three.min.js as a classic (non-module) script. The UMD builds
were deprecated after r150 and removed in r161+, so a newer version
would need ES modules + an import map, which do not load from
file:// (CLAUDE.md hard constraint: classic <script src> only).
The build prints one harmless deprecation warning to the console
("deprecated with r150+..."); that is expected and ignored.

Loading rule (DECISIONS D-WEBGL-1): this file is NEVER in index.html
as a static <script>. js/ui/scene3d.js injects it as a dynamic
<script src="vendor/three.min.js"> on the FIRST Home card hover
only, after a 150 ms delay. Other pages never load it.
