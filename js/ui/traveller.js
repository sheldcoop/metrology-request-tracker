/**
 * Metrology Request Tracker - ui/traveller.js
 *
 * THE traveller card (Q22, Q42): a request drawn as the lab card that
 * travels with the panels - priority stripe, request ID, tool glyph,
 * status stamp, the facts. One drawing in four sizes, so its look is
 * changed in one place (M2 audit, 2026-09-25):
 *   full  the request page          mini  the live preview in the form
 *   card  a board card (a link)     slip  the printable A6 slip
 *
 * It reads no data: the screen passes plain values -
 *   ui.traveller({
 *     id: 'FIB-260925-03', subtitle: 'FIB · Via cross-section',
 *     glyph: {key, state, label} | null, icon: 'request_new' (when no glyph),
 *     level: 1..4 (priority; 1 = Line stop), urgent: bool, late: bool,
 *     prio: {name, code} | null, stamp: {label, kind} | null,
 *     fields: [{label, value (text or Node), sub, cls ('wide'), extra (Node)}],
 *     lines: [[text or Node, ...], ...]   (card only; the first line is mono)
 *     code: Node (slip barcode), warn: text (slip), footer: Node (magazine view),
 *     href, ariaLabel
 *   }, {size: 'full' | 'mini' | 'card' | 'slip'})
 * Adds to MRT.ui (see ui/core.js for the load order).
 * Rule: user text never reaches innerHTML - every value goes in as text or a Node.
 */
(function (ui) {
  'use strict';

  var el = ui.el;

  function prioBadge(p, cls) {
    return p ? el('span', { class: cls }, [el('b', { text: p.name }), el('span', { class: 'mono' + (cls === 'tr-prio' ? ' muted' : ''), text: p.code })]) : null;
  }

  function glyphOf(m, size) {
    if (m.glyph) return ui.toolGlyph(m.glyph.key, { size: size, state: m.glyph.state, label: m.glyph.label });
    return m.icon ? ui.icon(m.icon, Math.round(size * 0.75)) : null;
  }

  function full(m) {
    return el('article', { class: 'traveller prio-' + (m.level || 3) + (m.urgent ? ' is-urgent' : ''), 'aria-label': m.ariaLabel || 'Traveller card ' + m.id }, [
      el('header', { class: 'tr-head' }, [
        glyphOf(m, 56),
        el('div', { class: 'tr-id' }, [el('h2', { class: 'mono', text: m.id }), el('div', { class: 'muted', text: m.subtitle || '' })]),
        m.stamp ? el('span', { class: 'tr-stamp is-' + (m.stamp.kind || 'neutral'), text: m.stamp.label }) : null
      ]),
      el('div', { class: 'tr-grid' }, (m.fields || []).filter(Boolean).map(function (f) {
        return el('div', { class: 'tr-cell' }, [el('div', { class: 'tr-label', text: f.label }), el('div', { class: 'tr-value' }, f.value),
          f.sub ? el('div', { class: 'tr-sub', text: f.sub }) : null, f.extra || null]);
      })),
      m.footer ? el('div', { class: 'tr-mag' }, m.footer) : null
    ]);
  }

  function mini(m) {
    return el('div', { class: 'traveller-mini prio-' + (m.level || 3) }, [
      el('div', { class: 'tm-head' }, [
        glyphOf(m, 32),
        el('div', {}, [el('div', { class: 'tm-id mono', text: m.id }), el('div', { class: 'muted', text: m.subtitle || '' })]),
        prioBadge(m.prio, 'tm-prio')
      ]),
      el('dl', { class: 'facts' }, (m.fields || []).filter(Boolean).map(function (f) {
        return [el('dt', { text: f.label }), el('dd', { class: f.cls || null }, f.value)];
      })),
      m.footer ? el('div', { class: 'tm-mag' }, m.footer) : null
    ]);
  }

  function card(m) {
    return el('a', { class: 'bcard prio-' + (m.level || 3) + (m.urgent ? ' is-urgent' : '') + (m.late ? ' is-late' : ''),
      href: m.href || null, 'aria-label': m.ariaLabel || m.id }, [
      el('div', { class: 'bcard-top' }, [el('b', { class: 'mono', text: m.id }), m.prio ? el('span', { class: 'bcard-prio', text: m.prio.name }) : null]),
      (m.lines || []).map(function (line, i) { return el('div', { class: 'bcard-line' + (i === 0 ? ' mono' : '') }, line); })
    ]);
  }

  function slip(m) {
    return el('article', { class: 'slip prio-' + (m.level || 3), 'aria-label': m.ariaLabel || 'Traveller slip ' + m.id }, [
      el('header', { class: 'slip-head' }, [glyphOf(m, 40), el('div', { class: 'slip-id mono', text: m.id }), prioBadge(m.prio, 'slip-prio')]),
      m.code ? el('div', { class: 'slip-code' }, m.code) : null,
      el('div', { class: 'slip-grid' }, (m.fields || []).filter(Boolean).map(function (f) {
        return el('div', { class: 'slip-f' + (f.cls ? ' ' + f.cls : '') }, [el('span', { text: f.label }), el('b', {}, f.value === null || f.value === undefined || f.value === '' ? '-' : f.value)]);
      })),
      m.warn ? el('div', { class: 'slip-warn', text: m.warn }) : null
    ]);
  }

  var SIZES = { full: full, mini: mini, card: card, slip: slip };

  function traveller(model, o) {
    var draw = SIZES[(o && o.size) || 'full'] || full;
    return draw(model || {});
  }

  /**
   * The needed-by dial (P2): a half-circle meter, green / amber / red zones,
   * the needle moves right as lab time runs out. Plain values in:
   *   var g = ui.needleGauge(); g.set(fraction 0..1 used, 'ok'|'soon'|'late'|'paused'|'none')
   * Only the needle turns (transform). The text beside it says the same.
   */
  function needleGauge() {
    var NS = 'http://www.w3.org/2000/svg';
    function s(tag, attrs) { var n = document.createElementNS(NS, tag); Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); }); return n; }
    function arc(a0, a1) {   // angles in degrees, 180 = left, 0 = right, radius 40 around (50, 50)
      var p = function (a) { var r = a * Math.PI / 180; return (50 + 40 * Math.cos(r)).toFixed(2) + ' ' + (50 - 40 * Math.sin(r)).toFixed(2); };
      return 'M ' + p(a0) + ' A 40 40 0 0 1 ' + p(a1);
    }
    var svg = s('svg', { viewBox: '0 0 100 58', class: 'ngauge', 'aria-hidden': 'true' });
    svg.appendChild(s('path', { d: arc(180, 36), class: 'ng-zone ng-ok' }));
    svg.appendChild(s('path', { d: arc(36, 8), class: 'ng-zone ng-soon' }));
    svg.appendChild(s('path', { d: arc(8, 0), class: 'ng-zone ng-late' }));
    for (var i = 0; i <= 10; i++) {
      var a = (180 - i * 18) * Math.PI / 180, r1 = i % 5 ? 33 : 30;
      svg.appendChild(s('line', { x1: 50 + 36 * Math.cos(a), y1: 50 - 36 * Math.sin(a), x2: 50 + r1 * Math.cos(a), y2: 50 - r1 * Math.sin(a), class: 'ng-tick' }));
    }
    var needle = s('g', { class: 'ng-needle' });
    needle.appendChild(s('line', { x1: 50, y1: 50, x2: 16, y2: 50 }));
    svg.appendChild(needle);
    svg.appendChild(s('circle', { cx: 50, cy: 50, r: 3.5, class: 'ng-hub' }));
    var pause = s('g', { class: 'ng-pause' });
    pause.appendChild(s('rect', { x: 45, y: 30, width: 3, height: 10 }));
    pause.appendChild(s('rect', { x: 52, y: 30, width: 3, height: 10 }));
    svg.appendChild(pause);
    function set(used, state) {
      var f = Math.max(0, Math.min(1, used || 0));
      needle.style.transform = 'rotate(' + (f * 180).toFixed(1) + 'deg)';
      svg.setAttribute('class', 'ngauge is-' + (state || 'ok'));
    }
    set(0, 'none');
    return { node: svg, set: set };
  }

  ui.traveller = traveller;
  ui.needleGauge = needleGauge;
  ui.TRAVELLER_SIZES = Object.keys(SIZES);
})(window.MRT.ui);
