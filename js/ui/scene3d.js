/**
 * Metrology Request Tracker - js/ui/scene3d.js
 *
 * Home card hover scenes (DECISIONS D-WEBGL-1): the ONLY WebGL in the app.
 * One shared WebGLRenderer, one live scene at a time. Each scene file
 * registers create(ctx) -> { scene, camera, update(dt, t), dispose() } with
 * ctx = { T: THREE, tokens, rand, view, onResize }. The engine renders
 * scene through camera after every update; scenes only move objects.
 *
 * Loaded as a static classic script but touches no THREE at load: the
 * vendor build (vendor/three.min.js) is injected on the first card hover
 * only, after a 150 ms delay. No WebGL, software rendering, or slow
 * frames (> 40 ms average over 1 s) disables scenes for the session and
 * the cards stay static. Reduced motion renders one still frame; light
 * colour schemes stay static. Everything is torn down (geometries,
 * materials, textures) on leave, blur, hide, or off-screen.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d = (function () {
  'use strict';

  var HOVER_MS = 150, FADE_MS = 260, SLOW_MS = 40, SLOW_WINDOW_MS = 1000, MAX_PR = 1.5;

  var registry = {};          // scene key -> create(ctx)
  var renderer = null, canvas = null, threePromise = null;
  var live = null;            // { card, key, inst, scene, raf, ro, io, resizeFns, tracked, fadeTimer, slow }
  var sessionOff = false;     // fallback for this session: keep the static card

  function featuresOn() {
    try { return !window.MRT.config || !window.MRT.config.features || window.MRT.config.features.home3d !== false; }
    catch (e) { return true; }
  }

  function darkScheme() {
    try { return (document.documentElement.getAttribute('data-scheme') || 'dark') === 'dark'; }
    catch (e) { return true; }
  }

  function reduced() {
    try {
      if (window.MRT.ui && window.MRT.ui.reducedMotion) return !!window.MRT.ui.reducedMotion();
    } catch (e) { /* fall through to the OS setting */ }
    try {
      if (document.documentElement.getAttribute('data-motion') === 'reduce') return true;
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function tokens() {
    var out = { accent: '#02E8CD', bright: '#02E8CD', danger: '#DA1E28', surface: '#0C3D6E', line: '#2A5A8C' };
    try {
      var cs = window.getComputedStyle(document.documentElement);
      var g = function (k, fb) { var v = (cs.getPropertyValue(k) || '').trim(); return v || fb; };
      out.accent = g('--accent-fill', g('--accent', out.accent));
      out.bright = g('--accent-bright', out.accent);
      out.danger = g('--danger', out.danger);
      out.surface = g('--surface', out.surface);
      out.line = g('--line-strong', g('--line', out.line));
    } catch (e) { /* defaults above */ }
    return out;
  }

  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (threePromise) return threePromise;
    threePromise = new Promise(function (resolve, reject) {
      try {
        var s = document.createElement('script');
        s.src = 'vendor/three.min.js';
        s.onload = function () { resolve(window.THREE || null); };
        s.onerror = function () { reject(new Error('three.js failed to load')); };
        document.head.appendChild(s);
      } catch (e) { reject(e); }
    });
    return threePromise;
  }

  function softwareGL(gl) {
    try {
      var ext = gl.getExtension('WEBGL_debug_renderer_info');
      var name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
      return /swiftshader|llvmpipe|software|basic render/i.test(name);
    } catch (e) { return false; }
  }

  function ensureRenderer() {
    if (renderer) return renderer;
    var T = window.THREE;
    canvas = document.createElement('canvas');
    canvas.className = 'home-scene';
    canvas.setAttribute('aria-hidden', 'true');
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    if (softwareGL(renderer.getContext())) throw new Error('software WebGL');
    return renderer;
  }

  /** Every GPU object of a scene, so teardown leaves nothing behind. */
  function track(scene, set) {
    try {
      scene.traverse(function (o) {
        if (o.geometry) set.add(o.geometry);
        [].concat(o.material || []).forEach(function (m) {
          if (!m) return;
          set.add(m);
          Object.keys(m).forEach(function (k) {
            if (m[k] && m[k].isTexture) set.add(m[k]);
          });
        });
      });
    } catch (e) { /* stub scenes in tests traverse their own way */ }
    return set;
  }

  function disposeSet(set) {
    set.forEach(function (o) { try { if (o && o.dispose) o.dispose(); } catch (e) { /* keep going */ } });
    set.clear();
  }

  function teardown() {
    if (live && live.fadeTimer) { try { clearTimeout(live.fadeTimer); } catch (e) {} }
    var l = live;
    live = null;
    if (!l) return;
    try { if (l.raf && window.cancelAnimationFrame) window.cancelAnimationFrame(l.raf); } catch (e) {}
    try { if (l.ro && l.ro.disconnect) l.ro.disconnect(); } catch (e) {}
    try { if (l.io && l.io.disconnect) l.io.disconnect(); } catch (e) {}
    try { if (l.inst && l.inst.dispose) l.inst.dispose(); } catch (e) {}
    disposeSet(l.tracked);
    try { if (renderer) renderer.clear(); } catch (e) {}
    try { if (l.card) l.card.classList.remove('is-live'); } catch (e) {}
    try { if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas); } catch (e) {}
  }

  /** Ease out, then tear everything down. */
  function stop() {
    if (!live) return;
    var l = live;
    try { if (l.raf && window.cancelAnimationFrame) window.cancelAnimationFrame(l.raf); } catch (e) {}
    l.raf = 0;
    try { l.card.classList.add('is-leaving'); l.card.classList.remove('is-live'); } catch (e) {}
    l.fadeTimer = setTimeout(function () {
      if (live !== l) return;
      try { l.card.classList.remove('is-leaving'); } catch (e) {}
      teardown();
    }, FADE_MS);
  }

  function sizeTo(card) {
    var r = { width: 280, height: 120 };
    try { var b = card.getBoundingClientRect(); if (b.width > 0) r = b; } catch (e) {}
    var pr = MAX_PR;
    try { pr = Math.min(window.devicePixelRatio || 1, MAX_PR); } catch (e) {}
    try {
      renderer.setPixelRatio(pr);
      renderer.setSize(r.width || 280, r.height || 120, false);
    } catch (e) {}
    return { w: r.width || 280, h: r.height || 120 };
  }

  function start(card, key, T) {
    teardown();
    var create = registry[key];
    if (!create) return;   // no scene for this card yet: stay static
    var tracked = new Set();
    var resizeFns = [];
    var v = sizeTo(card);
    var ctx = { T: T, tokens: tokens(), rand: Math.random,
      view: { w: v.w, h: v.h }, onResize: function (fn) { resizeFns.push(fn); } };
    var inst;
    try {
      inst = create(ctx) || {};
      track(inst.scene, tracked);
    } catch (e) { teardown(); return; }
    try { card.appendChild(canvas); } catch (e) { teardown(); return; }
    try { card.classList.add('is-live'); card.classList.remove('is-leaving'); } catch (e) {}
    var l = live = { card: card, key: key, inst: inst, tracked: tracked, raf: 0, fadeTimer: 0,
      slow: { acc: 0, n: 0, t0: 0 } };
    try {
      if ('ResizeObserver' in window) {
        l.ro = new ResizeObserver(function () {
          if (live !== l) return;
          var s = sizeTo(card);
          resizeFns.forEach(function (fn) { try { fn(s.w, s.h); } catch (e) {} });
          if (reduced()) { try { inst.update(0, 0); } catch (e) {} }
        });
        l.ro.observe(card);
      }
    } catch (e) {}
    try {
      if ('IntersectionObserver' in window) {
        l.io = new IntersectionObserver(function (es) {
          if (live === l && es.length && !es[es.length - 1].isIntersecting) stop();
        });
        l.io.observe(card);
      }
    } catch (e) {}
    if (reduced()) {   // one still frame instead of animating
      try { inst.update(0, 0); render(inst); } catch (e) { teardown(); }
      return;
    }
    var last = 0;
    l.slow.t0 = now();
    function frame(t) {
      if (live !== l) return;
      var dt = last ? Math.min((t - last) / 1000, 0.1) : 0.016;
      last = t;
      var s = l.slow;
      s.acc += dt * 1000; s.n++;
      if (t - s.t0 >= SLOW_WINDOW_MS) {
        if (s.n > 5 && s.acc / s.n > SLOW_MS) { sessionOff = true; teardown(); return; }  // weak PC: static cards
        s.acc = 0; s.n = 0; s.t0 = t;
      }
      try { inst.update(dt, t / 1000); render(inst); }
      catch (e) { teardown(); return; }
      try { l.raf = window.requestAnimationFrame(frame); } catch (e) { teardown(); }
    }
    try { l.raf = window.requestAnimationFrame(frame); }
    catch (e) { try { inst.update(0.016, 0); render(inst); } catch (e2) { teardown(); } }
  }

  function now() {
    try { return window.performance.now(); } catch (e) { return Date.now(); }
  }

  /** Scenes move objects; the engine owns the single render call. */
  function render(inst) {
    try {
      if (inst && inst.camera && renderer && renderer.render) renderer.render(inst.scene, inst.camera);
    } catch (e) {}
  }

  function begin(card, key) {
    if (!featuresOn() || sessionOff || live || !darkScheme()) return;
    loadThree().then(function (T) {
      if (!T || live) return;
      try { ensureRenderer(); }
      catch (e) { sessionOff = true; return; }   // no WebGL or software rendering: static cards
      start(card, key, T);
    }).catch(function () { /* vendor failed: stay static */ });
  }

  var hoverTimer = 0;

  function schedule(card, key) {
    cancel();
    try {
      hoverTimer = setTimeout(function () { hoverTimer = 0; begin(card, key); }, HOVER_MS);
    } catch (e) { begin(card, key); }
  }

  function cancel() {
    if (hoverTimer) { try { clearTimeout(hoverTimer); } catch (e) {} hoverTimer = 0; }
  }

  function mount(card, key) {
    if (!card || !key || !card.addEventListener) return;
    card.addEventListener('pointerenter', function () { schedule(card, key); });
    card.addEventListener('pointerleave', function () { cancel(); stop(); });
    card.addEventListener('focusin', function () { schedule(card, key); });
    card.addEventListener('focusout', function () { cancel(); stop(); });
  }

  function mountAll(root) {
    if (!root || !root.querySelectorAll) return;
    var cards = root.querySelectorAll('.home-card[data-scene]');
    for (var i = 0; i < cards.length; i++) mount(cards[i], cards[i].getAttribute('data-scene'));
  }

  // global exits: blur, hidden tab, theme switch (rebuild live in new colours)
  var wired = false;
  function wireGlobal() {
    if (wired) return;
    wired = true;
    try {
      window.addEventListener('blur', function () { cancel(); teardown(); });
      document.addEventListener('visibilitychange', function () { if (document.hidden) { cancel(); teardown(); } });
    } catch (e) {}
    try {
      var mo = new MutationObserver(function () {
        if (!live) return;
        var l = live;
        teardown();
        begin(l.card, l.key);
      });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    } catch (e) {}
  }

  return {
    register: function (key, fn) { registry[key] = fn; },
    mount: function (card, key) { wireGlobal(); mount(card, key); },
    mountAll: function (root) { wireGlobal(); mountAll(root); },
    teardown: teardown,
    debug: function () {
      return { live: live ? 1 : 0, tracked: live ? live.tracked.size : 0,
        sessionOff: sessionOff, scenes: Object.keys(registry).sort() };
    },
    _test: {
      reset: function () { teardown(); sessionOff = false; threePromise = null; },
      sessionOff: function () { return sessionOff; }
    }
  };
})();
