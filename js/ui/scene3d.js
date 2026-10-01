/**
 * Metrology Request Tracker - js/ui/scene3d.js
 *
 * Home card scenes (DECISIONS D-WEBGL-1, HOME-10): the ONLY WebGL in the
 * app. Every Home card plays its scene all the time in its stage - a calm,
 * slow loop that gets livelier while the pointer (or focus) is on the card.
 * Each scene file registers create(ctx) -> { scene, camera, update(dt, t,
 * energy), dispose() } with ctx = { T: THREE, tokens, rand, view,
 * onResize }; energy runs 0 (calm) .. 1 (hovered). Scenes only move
 * objects; the engine owns rendering.
 *
 * One shared WebGLRenderer draws off-screen; each card's frame is copied
 * into the card's own 2D canvas, so any number of cards costs one GL
 * context. Calm cards draw at 30 fps, the hovered one every frame. Cards
 * off-screen or a hidden tab pause; cards that leave the page are torn
 * down (geometries, materials, textures).
 *
 * Loaded as a static classic script but touches no THREE at load: the
 * vendor build (vendor/three.min.js) is injected shortly after Home shows
 * scene cards, never in index.html. No WebGL, software rendering, or slow
 * frames (> 40 ms average over 1 s) disables scenes for the session and
 * the cards keep their still icon. Reduced motion: no scenes at all.
 * Light schemes draw in near-black ink (tokens from themes.js).
 */
window.MRT = window.MRT || {};
window.MRT.scene3d = (function () {
  'use strict';

  var LOAD_MS = 200, SLOW_MS = 40, SLOW_WINDOW_MS = 1000, MAX_PR = 1.5, IDLE_FPS = 30;
  var SPEED_CALM = 0.55, SPEED_HOVER = 1.6, EASE_PER_S = 3;

  var registry = {};          // scene key -> create(ctx)
  var renderer = null, glCanvas = null, threePromise = null;
  var cards = [];             // { card, key, stage, view, g2d, inst, tracked, visible, hover, energy, t, w, h, resizeFns, io, ro, drawn }
  var loop = { raf: 0, timer: 0, last: 0, idle: 0, slow: { acc: 0, n: 0, t0: 0 } };
  var glSize = { w: 0, h: 0 };
  var sessionOff = false;     // fallback for this session: keep the still icons

  function featuresOn() {
    try { return !window.MRT.config || !window.MRT.config.features || window.MRT.config.features.home3d !== false; }
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

  /** The card's colours (custom properties inherit, so per-theme tile tokens apply). */
  function tokens(card) {
    var out = { accent: '#02E8CD', bright: '#02E8CD', danger: '#DA1E28', surface: '#0C3D6E', line: '#2A5A8C' };
    try {
      var cs = window.getComputedStyle(card || document.documentElement);
      var g = function (k, fb) { var v = (cs.getPropertyValue(k) || '').trim(); return v && v !== 'x' ? v : fb; };
      out.accent = g('--scene-ink', g('--accent-fill', out.accent));
      out.bright = out.accent;
      out.danger = g('--danger', out.danger);
      out.surface = g('--tile', g('--surface', out.surface));
      out.line = g('--scene-line', g('--line-strong', out.line));
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

  function pixelRatio() {
    try { return Math.min(window.devicePixelRatio || 1, MAX_PR); } catch (e) { return 1; }
  }

  function ensureRenderer() {
    if (renderer) return renderer;
    var T = window.THREE;
    glCanvas = document.createElement('canvas');
    renderer = new T.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    if (softwareGL(renderer.getContext())) { renderer = null; throw new Error('software WebGL'); }
    try { renderer.setPixelRatio(pixelRatio()); } catch (e) {}
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

  /** Drop one card's scene (the card itself stays, with its still icon). */
  function unbuild(e) {
    try { if (e.inst && e.inst.dispose) e.inst.dispose(); } catch (x) {}
    if (e.tracked) disposeSet(e.tracked);
    try { if (e.ro && e.ro.disconnect) e.ro.disconnect(); } catch (x) {}
    try { if (e.view && e.view.parentNode) e.view.parentNode.removeChild(e.view); } catch (x) {}
    try { e.card.classList.remove('is-live'); } catch (x) {}
    e.inst = null; e.view = null; e.g2d = null; e.ro = null; e.drawn = false; e.resizeFns = [];
  }

  function forget(e) {
    unbuild(e);
    try { if (e.io && e.io.disconnect) e.io.disconnect(); } catch (x) {}
    e.io = null;
  }

  function measure(e) {
    var r = { width: 340, height: 200 };
    try { var b = e.stage.getBoundingClientRect(); if (b.width > 0 && b.height > 0) r = b; } catch (x) {}
    e.w = Math.round(r.width); e.h = Math.round(r.height);
    var pr = pixelRatio();
    try { e.view.width = Math.round(e.w * pr); e.view.height = Math.round(e.h * pr); } catch (x) {}
  }

  function build(e) {
    var create = registry[e.key];
    if (!create || !renderer) return false;
    e.tracked = new Set();
    e.resizeFns = [];
    try {
      e.view = document.createElement('canvas');
      e.view.className = 'home-scene';
      e.view.setAttribute('aria-hidden', 'true');
      e.g2d = e.view.getContext ? e.view.getContext('2d') : null;
    } catch (x) { e.g2d = null; }
    measure(e);
    var ctx = { T: window.THREE, tokens: tokens(e.card), rand: Math.random,
      view: { w: e.w, h: e.h }, onResize: function (fn) { e.resizeFns.push(fn); } };
    try {
      e.inst = create(ctx) || {};
      track(e.inst.scene, e.tracked);
      e.stage.appendChild(e.view);
    } catch (x) { unbuild(e); e.failed = true; return false; }
    try {
      if ('ResizeObserver' in window) {
        e.ro = new ResizeObserver(function () {
          if (!e.inst) return;
          measure(e);
          e.resizeFns.forEach(function (fn) { try { fn(e.w, e.h); } catch (x) {} });
        });
        e.ro.observe(e.stage);
      }
    } catch (x) {}
    return true;
  }

  /** Scenes move objects; the engine owns the render and the copy into the card. */
  function draw(e) {
    var pr = pixelRatio(), w = e.w, h = e.h;
    if (w > glSize.w || h > glSize.h) {
      glSize.w = Math.max(glSize.w, w); glSize.h = Math.max(glSize.h, h);
      try { renderer.setPixelRatio(pr); renderer.setSize(glSize.w, glSize.h, false); } catch (x) {}
    }
    try {
      if (renderer.setViewport) renderer.setViewport(0, 0, w, h);
      if (renderer.setScissor) { renderer.setScissor(0, 0, w, h); renderer.setScissorTest(true); }
      renderer.clear();
      if (e.inst.camera) renderer.render(e.inst.scene, e.inst.camera);
    } catch (x) {}
    if (e.g2d && glCanvas) {
      try {
        var sw = Math.round(w * pr), sh = Math.round(h * pr);
        e.g2d.clearRect(0, 0, e.view.width, e.view.height);
        e.g2d.drawImage(glCanvas, 0, glCanvas.height - sh, sw, sh, 0, 0, e.view.width, e.view.height);
      } catch (x) {}
    }
    if (!e.drawn) { e.drawn = true; try { e.card.classList.add('is-live'); } catch (x) {} }
  }

  function now() {
    try { return window.performance.now(); } catch (e) { return Date.now(); }
  }

  function canRun() {
    return featuresOn() && !sessionOff && !reduced();
  }

  function stopLoop() {
    try { if (loop.raf && window.cancelAnimationFrame) window.cancelAnimationFrame(loop.raf); } catch (e) {}
    loop.raf = 0; loop.last = 0;
  }

  function frame(ts) {
    loop.raf = 0;
    cards = cards.filter(function (e) {
      if (e.card.isConnected) return true;
      forget(e);
      return false;
    });
    if (!cards.length || !renderer || !canRun()) { stopLoop(); return; }
    try { if (document.hidden) { stopLoop(); return; } } catch (x) {}
    var dt = loop.last ? Math.max(0, Math.min((ts - loop.last) / 1000, 0.1)) : 0.016;
    loop.last = ts;
    var s = loop.slow;
    s.acc += dt * 1000; s.n++;
    if (ts - s.t0 >= SLOW_WINDOW_MS) {
      if (s.n > 5 && s.acc / s.n > SLOW_MS) { sessionOff = true; teardown(); return; }   // weak PC: still icons
      s.acc = 0; s.n = 0; s.t0 = ts;
    }
    loop.idle += dt;
    var idleDue = loop.idle >= 1 / IDLE_FPS;
    if (idleDue) loop.idle = 0;
    cards.forEach(function (e) {
      var target = e.hover ? 1 : 0;
      e.energy += (target - e.energy) * Math.min(1, dt * EASE_PER_S);
      var step = dt * (SPEED_CALM + (SPEED_HOVER - SPEED_CALM) * e.energy);
      e.t += step;
      if (!e.visible || e.failed) { e.pend = 0; return; }
      if (!e.inst && !build(e)) return;
      e.pend = (e.pend || 0) + step;
      if (!(idleDue || e.hover || e.energy > 0.02 || !e.drawn)) return;
      try { e.inst.update(e.pend, e.t, e.energy); } catch (x) { unbuild(e); e.failed = true; return; }
      e.pend = 0;
      draw(e);
    });
    try { loop.raf = window.requestAnimationFrame(frame); } catch (x) { stopLoop(); }
  }

  function startLoop() {
    if (loop.raf || !cards.length || !canRun()) return;
    loop.slow = { acc: 0, n: 0, t0: now() };
    loop.last = 0;
    try { loop.raf = window.requestAnimationFrame(frame); } catch (x) {}
  }

  /** Load THREE once (shortly after Home shows), then run every mounted card. */
  function kick() {
    if (loop.timer || loop.raf || !cards.length || !canRun()) return;
    var go = function () {
      loop.timer = 0;
      if (!cards.length || !canRun()) return;
      loadThree().then(function (T) {
        if (!T || !canRun()) return;
        try { ensureRenderer(); }
        catch (e) { sessionOff = true; return; }   // no WebGL or software rendering: still icons
        startLoop();
      }).catch(function () { /* vendor failed: still icons */ });
    };
    if (renderer) { go(); return; }
    try { loop.timer = setTimeout(go, LOAD_MS); } catch (e) { go(); }
  }

  function mount(card, key) {
    if (!card || !key || !card.addEventListener || card.__mrtScene) return;
    var e = { card: card, key: key, stage: (card.querySelector && card.querySelector('.home-stage')) || card,
      inst: null, view: null, g2d: null, tracked: null, visible: true, hover: false, energy: 0,
      t: Math.random() * 20, w: 0, h: 0, resizeFns: [], io: null, ro: null, drawn: false, failed: false };
    card.__mrtScene = e;
    var on = function () { e.hover = true; }, off = function () { e.hover = false; };
    card.addEventListener('pointerenter', on);
    card.addEventListener('pointerleave', off);
    card.addEventListener('focusin', on);
    card.addEventListener('focusout', off);
    try {
      if ('IntersectionObserver' in window) {
        e.io = new IntersectionObserver(function (es) {
          if (es.length) e.visible = !!es[es.length - 1].isIntersecting;
        });
        e.io.observe(card);
      }
    } catch (x) {}
    cards.push(e);
  }

  function mountAll(root) {
    if (!root || !root.querySelectorAll) return;
    var list = root.querySelectorAll('.home-card[data-scene]');
    for (var i = 0; i < list.length; i++) mount(list[i], list[i].getAttribute('data-scene'));
    kick();
  }

  /** Everything off: scenes disposed, cards back to their still icon. */
  function teardown() {
    stopLoop();
    cards.forEach(forget);
    cards.forEach(function (e) { try { delete e.card.__mrtScene; } catch (x) { e.card.__mrtScene = null; } });
    cards = [];
  }

  // global: hidden tab pauses; theme switch rebuilds in the new colours; motion switch stops/starts
  var wired = false;
  function wireGlobal() {
    if (wired) return;
    wired = true;
    try {
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stopLoop(); else kick();
      });
    } catch (e) {}
    try {
      var mo = new MutationObserver(function () {
        cards.forEach(function (e) { unbuild(e); e.failed = false; });
        if (!canRun()) stopLoop(); else kick();
      });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-scheme', 'data-motion'] });
    } catch (e) {}
  }

  return {
    register: function (key, fn) { registry[key] = fn; },
    mount: function (card, key) { wireGlobal(); mount(card, key); kick(); },
    mountAll: function (root) { wireGlobal(); mountAll(root); },
    teardown: teardown,
    debug: function () {
      var live = 0, tracked = 0;
      cards.forEach(function (e) { if (e.inst) { live++; tracked += e.tracked ? e.tracked.size : 0; } });
      return { live: live, tracked: tracked, cards: cards.length, running: loop.raf ? 1 : 0,
        sessionOff: sessionOff, scenes: Object.keys(registry).sort() };
    },
    _test: {
      reset: function () { teardown(); sessionOff = false; threePromise = null; renderer = null; glCanvas = null; glSize = { w: 0, h: 0 }; },
      sessionOff: function () { return sessionOff; },
      hover: function (card) { return card && card.__mrtScene ? card.__mrtScene.energy : 0; }
    }
  };
})();
