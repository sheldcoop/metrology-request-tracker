/**
 * Metrology Request Tracker - ui/barcode.js
 *
 * A Code 128 (set B) barcode as SVG, drawn here - no vendor file, no
 * internet (CLAUDE.md: local generator only). Used on the printable
 * traveller slip (Q38): a hand scanner reads the request ID and types it
 * into the search box, which jumps to the request.
 *
 *   ui.code128('FIB-260924-03', {height: 48, module: 2, label: 'FIB-260924-03'}) -> <svg>
 *
 * Set B covers printable ASCII (space .. ~), which is all a request ID uses.
 * Adds to MRT.ui. Only static strings and numbers reach the SVG markup.
 */
(function (ui) {
  'use strict';

  // Bar/space widths (modules) of the 107 Code 128 symbols; 104 = Start B, 106 = Stop.
  var PATTERNS = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 ' +
    '122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 ' +
    '212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 ' +
    '113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 ' +
    '431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 ' +
    '241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 ' +
    '131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112').split(' ');

  /** The symbol values for a text: Start B, the characters, the checksum, Stop. */
  function code128Values(text) {
    var s = String(text);
    var vals = [104];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 32 || c > 126) throw new Error('Code 128 B cannot encode "' + s.charAt(i) + '"');
      vals.push(c - 32);
    }
    var sum = 104;
    for (var j = 1; j < vals.length; j++) sum += vals[j] * j;
    vals.push(sum % 103);
    vals.push(106);
    return vals;
  }

  /** The bars as [x, width] in modules, after a 10-module quiet zone. */
  function code128Bars(text) {
    var x = 10, bars = [];
    code128Values(text).forEach(function (v) {
      var p = PATTERNS[v];
      for (var k = 0; k < p.length; k++) {
        var w = +p.charAt(k);
        if (k % 2 === 0) bars.push([x, w]);    // even positions are bars, odd are spaces
        x += w;
      }
    });
    return { bars: bars, width: x + 10 };
  }

  function code128(text, o) {
    o = o || {};
    var m = o.module || 2, h = o.height || 48;
    var b = code128Bars(text);
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + b.width + ' 1');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('width', b.width * m);
    svg.setAttribute('height', h);
    svg.setAttribute('class', 'barcode');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Barcode ' + (o.label || text));
    svg.setAttribute('shape-rendering', 'crispEdges');
    b.bars.forEach(function (bar) {
      var r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', bar[0]); r.setAttribute('y', 0); r.setAttribute('width', bar[1]); r.setAttribute('height', 1);
      svg.appendChild(r);
    });
    return svg;
  }

  ui.code128 = code128;
  ui.code128Values = code128Values;
  ui.CODE128_PATTERNS = PATTERNS;
})(window.MRT.ui);
