/**
 * Metrology Request Tracker - ui/glyphs.js
 *
 * Tool glyphs: one line drawing per kind of tool, as an engineer would
 * sketch it on a whiteboard. The admin picks a glyph per tool in Settings,
 * so a new tool needs no code change (it can use the generic reticle).
 *
 *   ui.toolGlyph('fib', {size: 40, state: 'live', label: 'FIB'})
 *     state: 'idle' (default) | 'live' (working: the beam pulses)
 *            | 'maint' (dashed amber beam) | 'off' (Down: no beam, dimmed)
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

  /* Drawn on a 48 x 48 grid, stroke 2, sample surface near the bottom. */
  var DRAW = {
    // HRM: a roughness probe resting on a rough surface
    hrm: '<rect class="tg-body" x="19" y="4" width="10" height="14" rx="2"/>' +
         '<path class="tg-detail" d="M22 8h4M22 12h4"/>' +
         '<path class="tg-body" d="M21 18l3 13 3-13z"/>' +
         '<path class="tg-beam" d="M24 31v3"/>' +
         '<circle class="tg-dot" cx="24" cy="35" r="1.6"/>' +
         '<path class="tg-sample" d="M4 38l4-2 3 3 4-3 3 2 4-3 4 3 3-2 4 3 3-3 4 2 4-2"/>' +
         '<path class="tg-sample" d="M4 44h40" stroke-opacity=".5"/>',

    // AOI: a line camera looking down at a panel, field of view dashed
    aoi: '<rect class="tg-body" x="13" y="4" width="22" height="11" rx="2"/>' +
         '<circle class="tg-detail" cx="31" cy="9.5" r="1.5"/>' +
         '<path class="tg-body" d="M19 15h10l-2 6h-6z"/>' +
         '<path class="tg-beam" d="M21 21L9 35M27 21l12 14" stroke-dasharray="3 3"/>' +
         '<rect class="tg-sample" x="5" y="35" width="38" height="7" rx="1"/>' +
         '<path class="tg-sample" d="M12 35v7M19 35v7M26 35v7M33 35v7M40 35v7" stroke-opacity=".5"/>',

    // PRF: a profilometer stylus on an arm, tracing a step
    prf: '<rect class="tg-body" x="32" y="5" width="12" height="10" rx="2"/>' +
         '<path class="tg-detail" d="M8 10h21"/>' +
         '<circle class="tg-body" cx="30" cy="10" r="2.5"/>' +
         '<path class="tg-detail" d="M8 10v14"/>' +
         '<circle class="tg-dot" cx="8" cy="25.5" r="1.6"/>' +
         '<path class="tg-beam" d="M11 22h6v6h12v-6h9" stroke-dasharray="3 3"/>' +
         '<path class="tg-sample" d="M4 27h13v6h12v-6h15"/>' +
         '<path class="tg-sample" d="M4 42h40" stroke-opacity=".5"/>',

    // QVM: an optics column over the part, reticle on the feature
    qvm: '<rect class="tg-body" x="18" y="3" width="12" height="13" rx="2"/>' +
         '<path class="tg-detail" d="M18 8h12"/>' +
         '<path class="tg-body" d="M20 16h8l-2 7h-4z"/>' +
         '<path class="tg-beam" d="M22 23l-3 9M26 23l3 9"/>' +
         '<circle class="tg-beam" cx="24" cy="37" r="5"/>' +
         '<path class="tg-beam" d="M24 30v3M24 41v3M17 37h3M28 37h3"/>' +
         '<path class="tg-sample" d="M4 44h40"/>',

    // FIB: an ion column firing into the sample and cutting a trench
    fib: '<path class="tg-body" d="M15 4h18l-5 13h-8z"/>' +
         '<path class="tg-detail" d="M17.5 9h13"/>' +
         '<path class="tg-beam" d="M24 17v17"/>' +
         '<path class="tg-beam" d="M20 30l-3-2M28 30l3-2" stroke-opacity=".7"/>' +
         '<path class="tg-block" d="M4 33h15l2 6h6l2-6h15v11H4z"/>',

    // any other tool: a measuring reticle
    generic: '<circle class="tg-body" cx="24" cy="24" r="14"/>' +
             '<path class="tg-detail" d="M24 5v9M24 34v9M5 24h9M34 24h9"/>' +
             '<circle class="tg-beam" cx="24" cy="24" r="6"/>' +
             '<circle class="tg-dot" cx="24" cy="24" r="1.8"/>'
  };

  var GLYPHS = [
    { key: 'hrm', label: 'Roughness probe (HRM)' },
    { key: 'aoi', label: 'Inspection camera (AOI)' },
    { key: 'prf', label: 'Profilometer stylus (PRF)' },
    { key: 'qvm', label: 'Vision optics (QVM)' },
    { key: 'fib', label: 'Ion beam (FIB)' },
    { key: 'generic', label: 'Measuring reticle (any tool)' }
  ];

  var STATES = ['idle', 'live', 'maint', 'off'];

  function toolGlyphState(node, state) {
    var s = STATES.indexOf(state) === -1 ? 'idle' : state;
    STATES.forEach(function (x) { node.classList.toggle('is-' + x, x === s); });
    if (s === 'live') ui.watchOffscreen(node);   // pause the pulse off-screen
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
