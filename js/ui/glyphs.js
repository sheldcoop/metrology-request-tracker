/**
 * Metrology Request Tracker - ui/glyphs.js
 *
 * Tool glyphs: one line drawing per kind of tool, as an engineer would
 * sketch it on a whiteboard. The admin picks a glyph per tool in Settings,
 * so a new tool needs no code change (it can use the generic reticle).
 *
 *   ui.toolGlyph('fib', {size: 40, state: 'live', label: 'FIB'})
 *     state: 'idle' (default) | 'live' (working: its parts move - P1)
 *            | 'maint' (dashed amber beam) | 'off' (Down: dimmed, warning lamp blinks)
 *   ui.toolGlyphState(node, state)   change it later without a redraw
 *   ui.GLYPHS                        [{key, label}] for the Settings dropdown
 *
 * Parts (styled in css/app.css, "Tool glyphs"): tg-body (the instrument),
 * tg-detail, tg-sample (the panel under test), tg-block (solid sample),
 * tg-beam / tg-dot (the probe, beam or scan path, in the accent colour).
 *
 * Adds to MRT.ui (see ui/core.js for the load order).
 * Rule: user text never reaches innerHTML. Only static strings from this
 * file are used as SVG markup.
 */
(function (ui) {
  'use strict';

  /*
   * Drawn on a 48 x 48 grid, stroke 2. Each glyph draws what its tool
   * really does (2026-09-28): HRM the microscope field, AOI golden
   * reference vs scan, QVM the shift between two layers, PRF the via cut
   * in profile, FIB the ion beam milling its trench. Working parts move
   * only while the tool is working (state 'live'); the still drawing IS
   * the last frame, so Reduce motion and idle tools show a complete picture:
   *   tg-focus   HRM lens breathing      tg-trace   HRM caliper drawing in
   *   tg-scan    AOI scan frame sweeping tg-defect  AOI defect boxes blinking
   *   tg-stylus  PRF stylus gliding      tg-trace   PRF profile drawn behind it
   *   tg-reticle QVM crosshair locking   tg-shift   QVM shift arrow nudging
   *   tg-raster  FIB beam rastering      tg-face    FIB cross-section face growing
   *   tg-spin    reticle turning (any other tool)
   *   tg-lamp    warning lamp, shown and blinking only when the tool is Down
   */
  var LAMP = '<circle class="tg-lamp" cx="42" cy="6" r="3"/>';
  var DRAW = {
    // HRM: a microscope field - lens ring and reticle over traces, a pad,
    // and a caliper across the trace width; the lens breathes, the caliper draws in
    hrm: '<circle class="tg-body tg-focus" cx="24" cy="15" r="11"/>' +
         '<circle class="tg-detail" cx="24" cy="15" r="6.5"/>' +
         '<path class="tg-detail" d="M24 6.5V10M24 20v3.5M15.5 15h3.5M29 15h3.5"/>' +
         '<circle class="tg-sample" cx="10" cy="36" r="4.5"/>' +
         '<path class="tg-detail" d="M6.8 32.8l6.4 6.4"/>' +
         '<path class="tg-sample" d="M20 33h20M20 40h20"/>' +
         '<path class="tg-beam tg-trace" d="M40 31v11M38 31h4M38 42h4"/>' + LAMP,

    // AOI: golden reference on the left, scanned panel with defects on the
    // right; the scan frame sweeps, defect boxes light up
    aoi: '<rect class="tg-body" x="14" y="4" width="20" height="10" rx="2"/>' +
         '<circle class="tg-detail" cx="30" cy="9" r="1.5"/>' +
         '<path class="tg-beam" d="M20 14l-6 12M28 14l6 12" stroke-dasharray="3 3"/>' +
         '<rect class="tg-sample" x="4" y="30" width="40" height="12" rx="1"/>' +
         '<path class="tg-sample" d="M24 30v12" stroke-opacity=".5"/>' +
         '<path class="tg-detail" d="M8 34h8M8 38h8"/>' +
         '<rect class="tg-defect" x="28" y="33" width="4" height="3"/>' +
         '<rect class="tg-defect tg-d2" x="35" y="37" width="3" height="3"/>' +
         '<rect class="tg-scan" x="30" y="28" width="10" height="16" rx="1"/>' + LAMP,

    // PRF: a stylus gliding over a via cut in profile - top diameter and
    // depth arrows, the tapered walls, the profile drawing behind the tip
    prf: '<path class="tg-detail" d="M6 8h18"/>' +
         '<circle class="tg-body" cx="24" cy="8" r="2"/>' +
         '<g class="tg-stylus"><path class="tg-detail" d="M8 8v17"/><circle class="tg-dot" cx="8" cy="26.5" r="1.6"/></g>' +
         '<path class="tg-beam tg-trace" d="M4 26h14l3 10h6l3-10h14"/>' +
         '<path class="tg-block" d="M4 32h40v10H4z"/>' +
         '<path class="tg-sample" d="M19 32l2.5 10h5L29 32"/>' +
         '<path class="tg-detail" d="M19 28.5h10M19 27v3M29 27v3"/>' +
         '<path class="tg-detail" d="M43 32v10M41.5 32h3M41.5 42h3"/>' + LAMP,

    // QVM: two stacked layers, shifted - pad on one, via on the other, a
    // shift arrow between them; the crosshair locks the pad, the arrow nudges
    qvm: '<rect class="tg-body" x="18" y="3" width="12" height="9" rx="2"/>' +
         '<path class="tg-beam" d="M21 12l-4 12M27 12l4 12" stroke-dasharray="3 3"/>' +
         '<rect class="tg-sample" x="6" y="34" width="26" height="7"/>' +
         '<rect class="tg-sample" x="12" y="27" width="26" height="7"/>' +
         '<circle class="tg-sample" cx="15" cy="37.5" r="3"/>' +
         '<circle class="tg-dot" cx="23" cy="30.5" r="1.8"/>' +
         '<path class="tg-beam tg-shift" d="M15 37.5l7-6M19.5 31.5h2.5M22 34v-2.5"/>' +
         '<circle class="tg-beam tg-reticle" cx="15" cy="37.5" r="6"/>' + LAMP,

    // FIB: the ion column milling its trench - beam rastering, banks flying,
    // the cross-section face opening between the trench walls
    fib: '<path class="tg-body" d="M15 4h18l-5 13h-8z"/>' +
         '<path class="tg-detail" d="M17.5 9h13"/>' +
         '<path class="tg-beam tg-raster" d="M24 17v15"/>' +
         '<path class="tg-beam tg-sparks" d="M20 32l-3-2M28 32l3-2" stroke-opacity=".7"/>' +
         '<path class="tg-block" d="M4 32h40v10H4z"/>' +
         '<path class="tg-sample" d="M20 32v10M28 32v10"/>' +
         '<path class="tg-face" d="M20 34.5h8M20 37.5h8M20 40.5h8"/>' + LAMP,

    // any other tool: a measuring reticle
    generic: '<circle class="tg-body" cx="24" cy="24" r="14"/>' +
             '<path class="tg-detail" d="M24 5v9M24 34v9M5 24h9M34 24h9"/>' +
             '<circle class="tg-beam tg-spin" cx="24" cy="24" r="6" stroke-dasharray="4 3"/>' +
             '<circle class="tg-dot" cx="24" cy="24" r="1.8"/>' + LAMP
  };

  var GLYPHS = [
    { key: 'hrm', label: 'Microscope (HRM)' },
    { key: 'aoi', label: 'Inspection camera (AOI)' },
    { key: 'prf', label: 'Via profiler (PRF)' },
    { key: 'qvm', label: 'Overlay optics (QVM)' },
    { key: 'fib', label: 'Ion cutter (FIB)' },
    { key: 'generic', label: 'Measuring reticle (any tool)' }
  ];

  var STATES = ['idle', 'live', 'maint', 'off'];

  function toolGlyphState(node, state) {
    var s = STATES.indexOf(state) === -1 ? 'idle' : state;
    STATES.forEach(function (x) { node.classList.toggle('is-' + x, x === s); });
    if (s === 'live' || s === 'off') ui.watchOffscreen(node);   // pause the motion off-screen
    return node;
  }

  /**
   * Build a tool glyph. `key` is one of GLYPHS (unknown keys draw the
   * reticle). With a label it is an image for screen readers; without,
   * it is decoration next to text that already names the tool.
   * @param {string} key
   * @param {Object} o {size, state, label}
   */
  function toolGlyph(key, o) {
    o = o || {};
    var size = o.size || 32;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('class', 'tool-glyph');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    if (o.label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', o.label); }
    else svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = DRAW[key] || DRAW.generic;   // static strings from this file
    svg.dataset.glyph = DRAW[key] ? key : 'generic';
    return toolGlyphState(svg, o.state);
  }

  ui.GLYPHS = GLYPHS;
  ui.toolGlyph = toolGlyph;
  ui.toolGlyphState = toolGlyphState;
})(window.MRT.ui);
