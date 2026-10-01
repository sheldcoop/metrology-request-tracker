/**
 * Metrology Request Tracker - ui/core.js  (copied from ABF Tracker v2)
 *
 * DOM building and escaping, icons, display formatting, motion helpers,
 * status (displayStatus, chip, LED), page header.
 *
 * MRT.ui is built from plain scripts, loaded in this order:
 *   core.js, components.js, glyphs.js, heatmap.js, overlays.js, charts.js
 * Each later file adds its components to MRT.ui. No modules, so it
 * still runs from file://. ui-kit.html shows every component.
 *
 * Rule: user text never reaches innerHTML. Use el()/text() or esc().
 */
window.MRT = window.MRT || {};
window.MRT.ui = (function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Escaping and DOM building
   * ------------------------------------------------------------------ */

  /** Escape text for the rare case where a string must go into markup. */
  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * Build an element.
   * el('div', {class: 'card', dataset: {action: 'x'}}, ['text', childEl])
   * Text children are set with textContent, so they can never inject markup.
   */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (key) {
      var v = attrs[key];
      if (v === null || v === undefined || v === false) return;
      if (key === 'class') node.className = v;
      else if (key === 'text') node.textContent = v;
      else if (key === 'html') node.innerHTML = v;       // static markup only
      else if (key === 'dataset') Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
      else if (key === 'style') Object.keys(v).forEach(function (s) { node.style[s] = v[s]; });
      else if (key.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(key.slice(2), v);
      else if (v === true) node.setAttribute(key, '');
      else node.setAttribute(key, v);
    });
    append(node, children);
    return node;
  }

  /** Append children. Nested arrays are flattened, so callers can group freely. */
  function append(parent, children) {
    if (children === null || children === undefined) return parent;
    (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) return append(parent, c);
      parent.appendChild(typeof c === 'object' && c.nodeType ? c : document.createTextNode(String(c)));
    });
    return parent;
  }

  /** Replace everything inside a node. */
  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function mount(node, children) { return append(clear(node), children); }

  /* ------------------------------------------------------------------ *
   * Icons - inline SVG, no emojis
   * ------------------------------------------------------------------ */

  var PATHS = {
    dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/>  <rect width="7" height="5" x="14" y="3" rx="1"/>  <rect width="7" height="9" x="14" y="12" rx="1"/>  <rect width="7" height="5" x="3" y="16" rx="1"/>',
    lots: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/>  <path d="M12 22V12"/>  <polyline points="3.29 7 12 12 20.71 7"/>  <path d="m7.5 4.27 9 5.15"/>',
    settings: '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/>  <circle cx="12" cy="12" r="3"/>',
    search: '<path d="m21 21-4.34-4.34"/>  <circle cx="11" cy="11" r="8"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>  <path d="M12 9v4"/>  <path d="M12 17h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    close: '<path d="M18 6 6 18"/>  <path d="m6 6 12 12"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>  <path d="M21 3v5h-5"/>  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>  <path d="M8 16H3v5"/>',
    download: '<path d="M12 15V3"/>  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>  <path d="m7 10 5 5 5-5"/>',
    upload: '<path d="M12 3v12"/>  <path d="m17 8-5-5-5 5"/>  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
    save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>  <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/>  <path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
    sun: '<circle cx="12" cy="12" r="4"/>  <path d="M12 2v2"/>  <path d="M12 20v2"/>  <path d="m4.93 4.93 1.41 1.41"/>  <path d="m17.66 17.66 1.41 1.41"/>  <path d="M2 12h2"/>  <path d="M20 12h2"/>  <path d="m6.34 17.66-1.41 1.41"/>  <path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>',
    contrast: '<circle cx="12" cy="12" r="10"/>  <path d="M12 18a6 6 0 0 0 0-12v12z"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>  <circle cx="12" cy="7" r="4"/>',
    logo: '<circle cx="12" cy="12" r="7.5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="1.6"/>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>  <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    clock: '<circle cx="12" cy="12" r="10"/>  <path d="M12 6v6l4 2"/>',
    archive: '<rect width="20" height="5" x="2" y="3" rx="1"/>  <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/>  <path d="M10 12h4"/>',
    restore: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>  <path d="M3 3v5h5"/>  <path d="M12 7v5l4 2"/>',
    edit: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>  <path d="m15 5 4 4"/>',
    move: '<path d="M12 2v20"/>  <path d="m15 19-3 3-3-3"/>  <path d="m19 9 3 3-3 3"/>  <path d="M2 12h20"/>  <path d="m5 9-3 3 3 3"/>  <path d="m9 5 3-3 3 3"/>',
    plus: '<path d="M5 12h14"/>  <path d="M12 5v14"/>',
    filter: '<path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"/>',
    trash: '<path d="M10 11v6"/>  <path d="M14 11v6"/>  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>  <path d="M3 6h18"/>  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>  <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    chevron_left: '<path d="m15 18-6-6 6-6"/>',
    expand: '<path d="M15 3h6v6"/>  <path d="m21 3-7 7"/>  <path d="m3 21 7-7"/>  <path d="M9 21H3v-6"/>',
    info: '<circle cx="12" cy="12" r="10"/>  <path d="M12 16v-4"/>  <path d="M12 8h.01"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
    gauge: '<path d="m12 14 4-4"/>  <path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
    'chart-column': '<path d="M3 3v16a2 2 0 0 0 2 2h16"/>  <path d="M18 17V9"/>  <path d="M13 17V5"/>  <path d="M8 17v-3"/>',
    grid: '<path d="M12 3v18"/>  <path d="M3 12h18"/>  <rect x="3" y="3" width="18" height="18" rx="2"/>',
    chevron_down: '<path d="m6 9 6 6 6-6"/>',
    chevron_right: '<path d="m9 18 6-6-6-6"/>',
    sliders: '<path d="M10 5H3"/>  <path d="M12 19H3"/>  <path d="M14 3v4"/>  <path d="M16 17v4"/>  <path d="M21 12h-9"/>  <path d="M21 19h-5"/>  <path d="M21 5h-7"/>  <path d="M8 10v4"/>  <path d="M8 12H3"/>',
    motion: '<path d="M3 8h10M3 12h14M3 16h8"/><path d="M17 8h4M19 16h2"/>',
    ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/>  <path d="m14.5 12.5 2-2"/>  <path d="m11.5 9.5 2-2"/>  <path d="m8.5 6.5 2-2"/>  <path d="m17.5 15.5 2-2"/>',
    requests: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>  <path d="M12 11h4"/>  <path d="M12 16h4"/>  <path d="M8 11h.01"/>  <path d="M8 16h.01"/>',
    request_new: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/>  <path d="M14 2v5a1 1 0 0 0 1 1h5"/>  <path d="M9 15h6"/>  <path d="M12 18v-6"/>',
    board: '<path d="M5 3v14"/>  <path d="M12 3v8"/>  <path d="M19 3v18"/>',
    bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/>  <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>  <path d="M16 3.128a4 4 0 0 1 0 7.744"/>  <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>  <circle cx="9" cy="7" r="4"/>',
    calendar: '<path d="M8 2v3"/>  <path d="M16 2v3"/>  <rect x="3" y="3" width="18" height="18" rx="2"/>  <path d="M3 9h18"/>',
    tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/>  <circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    hirata: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8" cy="8.5" r="1.3"/><circle cx="8" cy="12" r="1.3"/><circle cx="8" cy="15.5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="16" cy="8.5" r="1.3"/><circle cx="16" cy="15.5" r="1.3"/>',
    'log-out': '<path d="m16 17 5-5-5-5"/>  <path d="M21 12H9"/>  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>',
    keyboard: '<path d="M10 8h.01"/>  <path d="M12 12h.01"/>  <path d="M14 8h.01"/>  <path d="M16 12h.01"/>  <path d="M18 8h.01"/>  <path d="M6 8h.01"/>  <path d="M7 16h10"/>  <path d="M8 12h.01"/>  <rect width="20" height="16" x="2" y="4" rx="2"/>',
    mail: '<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/>  <rect x="2" y="4" width="20" height="16" rx="2"/>',
    'plus-circle': '<circle cx="12" cy="12" r="10"/>  <path d="M8 12h8"/>  <path d="M12 8v8"/>',
    list: '<path d="M3 5h.01"/>  <path d="M3 12h.01"/>  <path d="M3 19h.01"/>  <path d="M8 5h13"/>  <path d="M8 12h13"/>  <path d="M8 19h13"/>',
    kanban: '<path d="M5 3v14"/>  <path d="M12 3v8"/>  <path d="M19 3v18"/>',
    layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/>  <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/>  <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
    'circle-help': '<circle cx="12" cy="12" r="10"/>  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>  <path d="M12 17h.01"/>'
  };

  /** Inline SVG icon element. `name` must be one of PATHS - never user text. */
  function icon(name, size) {
    var s = size || 18;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', s);
    svg.setAttribute('height', s);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = PATHS[name] || PATHS.alert; // static strings from this file
    return svg;
  }

  /* ------------------------------------------------------------------ *
   * Formatting (display only - never used for storage)
   * ------------------------------------------------------------------ */

  var VIENNA = 'Europe/Vienna';

  /** dd.mm.yyyy HH:MM in Europe/Vienna, 24 h. */
  function formatTs(ts) {
    if (!ts) return '-';
    var d = (ts instanceof Date) ? ts : new Date(typeof ts === 'number' ? ts : String(ts));
    if (isNaN(d.getTime())) return '-';
    var parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: VIENNA, day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(d).reduce(function (o, p) { o[p.type] = p.value; return o; }, {});
    return parts.day + '.' + parts.month + '.' + parts.year + ' ' + parts.hour + ':' + parts.minute;
  }

  /** dd.mm.yyyy without the time. */
  function formatDate(ts) {
    var s = formatTs(ts);
    return s === '-' ? s : s.slice(0, 10);
  }

  /** A duration in hours as "12 d 7 h" / "7 h 30 min" / "45 min". */
  function formatDurationH(hours) {
    if (!isFinite(hours)) return '-';
    if (hours < 0) hours = 0;
    // round once, then split, so 30 h 59.6 min reads 31 h, never 30 h 60 min
    if (hours < 48) {
      var mins = Math.round(hours * 60);
      if (mins < 60) return mins + ' min';
      var h = Math.floor(mins / 60), m = mins % 60;
      return m ? h + ' h ' + m + ' min' : h + ' h';
    }
    var totalH = Math.round(hours);
    var days = Math.floor(totalH / 24), rem = totalH % 24;
    return rem ? days + ' d ' + rem + ' h' : days + ' d';
  }

  /** Thousands-separated number with fixed decimals. */
  function formatNumber(value, decimals) {
    if (!isFinite(value)) return '-';
    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: decimals || 0, maximumFractionDigits: (decimals === undefined) ? 0 : decimals
    }).format(value);
  }


  function formatPct(value) {
    return isFinite(value) ? formatNumber(value, 1) + ' %' : '-';
  }

  /**
   * Split a duration in hours into whole days, hours, minutes and seconds,
   * for a live countdown. Negative input reads as all zeros.
   */
  function countdownParts(hours) {
    var total = Math.max(0, Math.floor((isFinite(hours) ? hours : 0) * 3600));
    return {
      days: Math.floor(total / 86400),
      hours: Math.floor((total % 86400) / 3600),
      minutes: Math.floor((total % 3600) / 60),
      seconds: total % 60,
      total_seconds: total
    };
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ------------------------------------------------------------------ *
   * Motion helpers
   *
   * Everything that moves checks reducedMotion() first. Two sources:
   * the OS setting, and the per-user toggle (data-motion on <html>).
   * ------------------------------------------------------------------ */

  function reducedMotion() {
    if (document.documentElement.getAttribute('data-motion') === 'reduce') return true;
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /**
   * Pause CSS animations while a node is off-screen. One shared observer;
   * nodes that left the DOM are dropped every so often so it never leaks.
   */
  var offscreenIO = null;
  var offscreenNodes = [];
  function watchOffscreen(node) {
    if (!node || !('IntersectionObserver' in window)) return node;
    if (!offscreenIO) {
      offscreenIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { e.target.classList.toggle('offscreen', !e.isIntersecting); });
      }, { rootMargin: '80px' });
    }
    offscreenIO.observe(node);
    offscreenNodes.push(node);
    if (offscreenNodes.length % 64 === 0) {
      offscreenNodes = offscreenNodes.filter(function (n) {
        if (n.isConnected) return true;
        offscreenIO.unobserve(n);
        return false;
      });
    }
    return node;
  }

  /** Stagger the entrance of a container's children, 40 ms apart. */
  function stagger(container) {
    var kids = container.children;
    for (var i = 0; i < kids.length; i++) kids[i].style.setProperty('--i', Math.min(i, 14));
    container.classList.add('stagger');
    return container;
  }

  /** Replace a container's content with a short fade (tab panels). */
  function fadeSwap(container, children) {
    mount(container, children);
    container.classList.remove('fade-in');
    void container.offsetWidth; // restart the animation
    container.classList.add('fade-in');
    return container;
  }

  /** Count a number up from 0 on first paint. Text only. */
  function countUp(node, to, opts) {
    var o = opts || {};
    var fmt = o.format || function (v) { return formatNumber(v, o.decimals || 0); };
    if (!isFinite(to) || reducedMotion() || o.animate === false) { node.textContent = fmt(to); return; }
    var dur = o.duration || 900;
    var from = o.from || 0;
    var t0 = null;
    function step(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / dur);
      var eased = 1 - Math.pow(1 - k, 3);
      node.textContent = fmt(from + (to - from) * eased);
      if (k < 1) requestAnimationFrame(step);
    }
    node.textContent = fmt(from);
    requestAnimationFrame(step);
  }

  /** 12345 -> "12 345" with a narrow no-break space, for big readouts. */
  function groupDigits(n) {
    return String(Math.floor(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  /* ------------------------------------------------------------------ *
   * Status
   * ------------------------------------------------------------------ */

  var STATUS_LABEL = {
    ok: 'OK', warning: 'Warning', critical: 'Critical',
    expired: 'Expired', blocked: 'Blocked', neutral: 'Unknown'
  };


  /**
   * THE one place that decides which status the UI shows.
   * Accepts a status name or an object {status, expired, blocked};
   * expired wins over blocked. Request statuses, lateness and priorities
   * are mapped onto these five in M2/M3.
   *
   * @param {Object|string} stats a status name or a status object
   * @returns {string} ok | warning | critical | expired | blocked | neutral
   */
  function displayStatus(stats) {
    if (!stats) return 'neutral';
    if (typeof stats === 'string') return stats;
    if (stats.expired) return 'expired';
    if (stats.blocked) return 'blocked';
    return stats.status || 'neutral';
  }

  /** Status chip. Accepts a status name or a status object. Blocked gets a lock. */
  function statusChip(statusResult) {
    var name = displayStatus(statusResult);
    var label = STATUS_LABEL[name] || STATUS_LABEL.neutral;
    return el('span', { class: 'chip ' + name + (name === 'blocked' ? ' has-icon' : '') }, [
      name === 'blocked' ? icon('lock', 12) : null,
      label
    ]);
  }

  /** A small status light. Critical and Expired pulse. */
  function led(status, label) {
    var s = displayStatus(status);
    var live = s === 'critical' || s === 'expired';
    var node = el('span', { class: 'led ' + s + (live ? ' live' : ''), 'aria-hidden': label ? null : 'true' });
    if (label) { node.setAttribute('role', 'img'); node.setAttribute('aria-label', label); }
    return live ? watchOffscreen(node) : node;
  }

  /**
   * THE way to show a status (DECISIONS T-8): its icon + its word, never colour alone.
   * status: ok | warning | critical | expired | blocked | neutral. The icon shape comes from
   * css/app.css (--ic-*): tick, triangle, stop octagon, clock, lock.
   *   ui.statusBadge('expired', 'Late')      a chip: icon + word
   *   ui.statusIcon('critical')              the icon alone, beside words you already show
   */
  var STATUS_KINDS = ['ok', 'warning', 'critical', 'expired', 'blocked', 'neutral'];
  function statusBadge(status, text, o) {
    var s = STATUS_KINDS.indexOf(status) === -1 ? 'neutral' : status;
    return el('span', { class: 'chip ' + s + (o && o.cls ? ' ' + o.cls : ''), title: (o && o.title) || null, text: text });
  }
  function statusIcon(status) {
    var s = STATUS_KINDS.indexOf(status) === -1 ? 'neutral' : status;
    return el('span', { class: 'st-ic is-' + s, 'aria-hidden': 'true' });
  }

  var seq = 0;
  function uid(prefix) { seq += 1; return prefix + seq; }

  /**
   * Tie each form label to its control for assistive tech. Many forms are
   * built as <div.field><label>Text</label><input></div>; a label without
   * `for` is not linked. For every .field, give the first control
   * an id if it has none and point the label at it; further controls in the
   * same field get an aria-label. Safe to run repeatedly.
   */
  var labelSeq = 0;
  function linkLabels(root) {
    if (!root || !root.querySelectorAll) return root;
    Array.prototype.forEach.call(root.querySelectorAll('.field, .ifield'), function (f) {
      var label = f.querySelector(':scope > label, :scope > .ifield-label');
      var controls = Array.prototype.filter.call(
        f.querySelectorAll('input:not([type="hidden"]), select, textarea'),
        function (x) { return !label || !label.contains(x); });
      if (!label || !controls.length) return;
      var text = label.textContent.trim();
      // the label names the first control; any others (a "custom value" box,
      // a second part) are named after it plus their own placeholder
      var ctl = controls[0];
      if (!ctl.id) { labelSeq += 1; ctl.id = 'lbl' + labelSeq; }
      if (label.tagName === 'LABEL') label.setAttribute('for', ctl.id);
      else if (!ctl.getAttribute('aria-label')) ctl.setAttribute('aria-label', text);
      controls.slice(1).forEach(function (other) {
        if (!other.getAttribute('aria-label')) {
          other.setAttribute('aria-label', text + ' - ' + (other.getAttribute('placeholder') || 'value'));
        }
      });
    });
    return root;
  }

  /** Page header with a title, optional subtitle and right-aligned actions. */
  function pageHead(title, subtitle, actions) {
    return el('div', { class: 'page-head' }, [
      el('div', {}, [
        el('h1', { text: title }),
        subtitle ? el('div', { class: 'page-sub', text: subtitle }) : null
      ]),
      el('div', { class: 'spacer' }),
      actions || null
    ]);
  }

  /** Initials for the user avatar, e.g. "Prince Khurana" -> "PK". */
  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2)
      .map(function (w) { return w[0].toUpperCase(); }).join('');
  }


  return {
    STATUS_LABEL: STATUS_LABEL,
    append: append,
    clear: clear,
    countUp: countUp,
    countdownParts: countdownParts,
    displayStatus: displayStatus,
    el: el,
    esc: esc,
    fadeSwap: fadeSwap,
    formatDate: formatDate,
    formatDurationH: formatDurationH,
    formatNumber: formatNumber,
    formatPct: formatPct,
    formatTs: formatTs,
    groupDigits: groupDigits,
    icon: icon,
    initials: initials,
    led: led,
    statusBadge: statusBadge,
    statusIcon: statusIcon,
    mount: mount,
    pad2: pad2,
    pageHead: pageHead, linkLabels: linkLabels,
    reducedMotion: reducedMotion,
    stagger: stagger,
    statusChip: statusChip,
    uid: uid,
    watchOffscreen: watchOffscreen
  };
})();
