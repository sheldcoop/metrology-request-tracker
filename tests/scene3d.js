/**
 * tests/scene3d.js - dev only, no dependencies:  node tests/scene3d.js
 *
 * The Home hover-scene engine (js/ui/scene3d.js) without WebGL: the fake
 * DOM has no canvas, no THREE and no observers, so this asserts the
 * fallback path (static cards, no crash) plus a 50-cycle hover/leave leak
 * test against a stub THREE that counts every created/disposed resource.
 * Exits 1 on any failure.
 */
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

let failures = 0, passed = 0;
function check(name, cond, detail) {
  if (cond) passed++;
  else { failures++; console.log('FAIL', name, detail !== undefined ? '-> ' + detail : ''); }
}

/** Fresh fake browser with config + the engine, no THREE. */
function boot() {
  const { win, doc, flush } = require('./fake-dom')({ ids: ['main'] });
  const ctx = vm.createContext(win);
  ['js/config.js', 'js/ui/scene3d.js'].forEach(f =>
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
  return { win, doc, flush, S: win.MRT.scene3d };
}

async function settle(flush, n) {
  for (let i = 0; i < (n || 3); i++) { await new Promise(r => setImmediate(r)); flush(); }
}

function card(doc, scene) {
  const c = doc.createElement('a');
  c.setAttribute('class', 'home-card');
  if (scene) c.setAttribute('data-scene', scene);
  doc.getElementById('main').appendChild(c);
  return c;
}

/** Stub THREE: every resource records its creation and disposal. */
function stubThree(log, soft) {
  function res(kind, extra) {
    const o = Object.assign({ kind: kind, disposed: false,
      dispose: function () { this.disposed = true; log.disposed.push(this); } }, extra || {});
    log.created.push(o);
    return o;
  }
  function WebGLRenderer() {
    return { setPixelRatio: function () {}, setSize: function () {}, clear: function () { log.clears++; },
      getContext: function () {
        return { getExtension: function () {
          return soft ? { UNMASKED_RENDERER_WEBGL: 1 } : null;
        }, getParameter: function () { return 'SwiftShader'; } };
      } };
  }
  return { WebGLRenderer: WebGLRenderer, __res: res };
}

/** Stub scene: 2 geometries, 2 materials, 1 texture per instance. */
function stubScene(log) {
  return function (ctx) {
    const tex = ctx.T.__res('tex', { isTexture: true });
    const mat = ctx.T.__res('mat'); mat.map = tex;
    const mat2 = ctx.T.__res('mat2');
    const scene = { traverse: function (fn) {
      fn({ geometry: ctx.T.__res('geo'), material: mat });
      fn({ geometry: ctx.T.__res('geo'), material: [mat2] });
    } };
    return { scene: scene,
      update: function () { log.updates++; },
      dispose: function () { log.scenes++; } };
  };
}

(async function run() {
  // --- 1. no THREE at all: hover stays static, nothing crashes
  {
    const { doc, flush, S } = boot();
    const c = card(doc, 'aoi');
    S.mountAll(doc.getElementById('main'));
    c.dispatch('pointerenter');
    await settle(flush, 4);
    c.dispatch('pointerleave');
    await settle(flush, 2);
    check('no THREE: hover/leave is a clean no-op', S.debug().live === 0 && c.children.length === 0);
    check('...not a session fallback (a later load could still work)', S._test.sessionOff() === false);
  }

  // --- 2. switch off in one place: features.home3d is honoured by default-on config
  {
    const { doc, flush, S } = boot();
    check('engine loads with no scenes registered', S.debug().scenes.length === 0 && S.debug().live === 0);
    const c = card(doc, null);
    S.mountAll(doc.getElementById('main'));
    c.dispatch('pointerenter');
    await settle(flush, 2);
    check('cards without a scene key are ignored', S.debug().live === 0);
  }

  // --- 3. light scheme: static card
  {
    const { win, doc, flush, S } = boot();
    win.THREE = stubThree({ created: [], disposed: [], updates: 0, scenes: 0, clears: 0 });
    S.register('t', stubScene({ created: [], disposed: [], updates: 0, scenes: 0, clears: 0 }));
    doc.documentElement.setAttribute('data-scheme', 'light');
    const c = card(doc, 't');
    S.mountAll(doc.getElementById('main'));
    c.dispatch('pointerenter');
    await settle(flush, 4);
    check('light scheme: no scene starts', S.debug().live === 0 && c.children.length === 0);
  }

  // --- 4. reduced motion: exactly one still frame, then clean teardown
  {
    const { win, doc, flush, S } = boot();
    const log = { created: [], disposed: [], updates: 0, scenes: 0, clears: 0 };
    win.THREE = stubThree(log);
    S.register('t', stubScene(log));
    doc.documentElement.setAttribute('data-motion', 'reduce');
    const c = card(doc, 't');
    S.mountAll(doc.getElementById('main'));
    c.dispatch('pointerenter');
    await settle(flush, 4);
    check('reduced motion: one still frame, scene alive', S.debug().live === 1 && log.updates === 1);
    c.dispatch('pointerleave');
    await settle(flush, 3);
    check('...leave tears it down with nothing live', S.debug().live === 0 && S.debug().tracked === 0 &&
      log.created.length === log.disposed.length && log.created.length > 0, JSON.stringify(S.debug()));
  }

  // --- 5. software WebGL: session fallback, static cards
  {
    const { win, doc, flush, S } = boot();
    const log = { created: [], disposed: [], updates: 0, scenes: 0, clears: 0 };
    win.THREE = stubThree(log, true);
    S.register('t', stubScene(log));
    const c = card(doc, 't');
    S.mountAll(doc.getElementById('main'));
    c.dispatch('pointerenter');
    await settle(flush, 4);
    check('software GL: session fallback, nothing live', S._test.sessionOff() === true && S.debug().live === 0);
  }

  // --- 6. fifty hover/leave cycles: no live objects left
  {
    const { win, doc, flush, S } = boot();
    const log = { created: [], disposed: [], updates: 0, scenes: 0, clears: 0 };
    win.THREE = stubThree(log);
    S.register('t', stubScene(log));
    const c = card(doc, 't');
    S.mountAll(doc.getElementById('main'));
    for (let i = 0; i < 50; i++) {
      c.dispatch('pointerenter');
      await settle(flush, 3);
      if (S.debug().live !== 1) { check('cycle ' + i + ': scene started', false, JSON.stringify(S.debug())); break; }
      c.dispatch('pointerleave');
      await settle(flush, 3);
    }
    check('50 cycles: every scene disposed', log.scenes === 50, 'disposed ' + log.scenes);
    check('...every created resource disposed', log.created.length === log.disposed.length && log.created.length === 50 * 5,
      'created ' + log.created.length + ' disposed ' + log.disposed.length);
    check('...nothing live afterwards', S.debug().live === 0 && S.debug().tracked === 0 && c.children.length === 0,
      JSON.stringify(S.debug()));
  }

  console.log(passed + ' passed, ' + failures + ' failed');
  if (failures) process.exitCode = 1;
})().catch(e => { console.log('CRASH', e && e.stack || e); process.exitCode = 1; });
