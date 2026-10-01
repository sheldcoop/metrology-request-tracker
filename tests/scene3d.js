/**
 * tests/scene3d.js - dev only, no dependencies:  node tests/scene3d.js
 *
 * The Home scene engine (js/ui/scene3d.js) without WebGL: the fake DOM has
 * no canvas, no THREE and no observers, so this asserts the fallback path
 * (still icons, no crash), always-on scenes on every card (HOME-10), light
 * schemes running, reduced motion off, hover raising the energy, and a
 * 50-cycle mount/leave-the-page leak test against a stub THREE that counts
 * every created/disposed resource.
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
      setViewport: function () {}, setScissor: function () {}, setScissorTest: function () {},
      render: function () { log.renders++; },
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
    return { scene: scene, camera: {},
      update: function () { log.updates++; },
      dispose: function () { log.scenes++; } };
  };
}

(async function run() {
  const newLog = () => ({ created: [], disposed: [], updates: 0, scenes: 0, clears: 0, renders: 0, energy: [] });

  // --- 1. no THREE at all: cards keep their still icon, nothing crashes
  {
    const { doc, flush, S } = boot();
    const c = card(doc, 'aoi');
    S.mountAll(doc.getElementById('main'));
    await settle(flush, 4);
    check('no THREE: a clean no-op', S.debug().live === 0 && c.children.length === 0);
    check('...not a session fallback (a later load could still work)', S._test.sessionOff() === false);
  }

  // --- 2. cards without a scene key are ignored
  {
    const { doc, flush, S } = boot();
    check('engine loads with no scenes registered', S.debug().scenes.length === 0 && S.debug().live === 0);
    card(doc, null);
    S.mountAll(doc.getElementById('main'));
    await settle(flush, 2);
    check('cards without a scene key are ignored', S.debug().cards === 0 && S.debug().live === 0);
  }

  // --- 3. every card plays at once, no hover needed; light schemes too
  {
    const { win, doc, flush, S } = boot();
    const log = newLog();
    win.THREE = stubThree(log);
    S.register('t', stubScene(log));
    doc.documentElement.setAttribute('data-scheme', 'light');
    const cs = [card(doc, 't'), card(doc, 't'), card(doc, 't')];
    S.mountAll(doc.getElementById('main'));
    await settle(flush, 4);
    check('all three cards live without hover (light scheme)', S.debug().live === 3 && S.debug().running === 1, JSON.stringify(S.debug()));
    check('...each card got its own canvas', cs.every(c => c.querySelectorAll('canvas').length === 1));
    check('...scenes update and render', log.updates >= 3 && log.renders >= 3, log.updates + '/' + log.renders);
    check('...drawn cards are marked live', cs.every(c => c.classList.contains('is-live')));
    S.mountAll(doc.getElementById('main'));
    check('...mounting again adds nothing', S.debug().cards === 3);
  }

  // --- 4. hover makes the card livelier, leaving calms it again
  {
    const { win, doc, flush, S } = boot();
    const log = newLog();
    win.THREE = stubThree(log);
    S.register('t', stubScene(log));
    const c = card(doc, 't');
    S.mountAll(doc.getElementById('main'));
    await settle(flush, 3);
    const calm = S._test.hover(c);
    c.dispatch('pointerenter');
    await settle(flush, 2);
    const up = S._test.hover(c);
    check('hover raises the energy', calm < 0.01 && up > calm, calm + ' -> ' + up);
    c.dispatch('pointerleave');
    await settle(flush, 2);
    check('...leave lets it fall again, the scene keeps playing', S._test.hover(c) < up && S.debug().live === 1);
  }

  // --- 5. reduced motion: no scene at all
  {
    const { win, doc, flush, S } = boot();
    const log = newLog();
    win.THREE = stubThree(log);
    S.register('t', stubScene(log));
    doc.documentElement.setAttribute('data-motion', 'reduce');
    const c = card(doc, 't');
    S.mountAll(doc.getElementById('main'));
    await settle(flush, 4);
    check('reduced motion: nothing starts', S.debug().live === 0 && log.updates === 0 && c.children.length === 0);
  }

  // --- 6. software WebGL: session fallback, still icons
  {
    const { win, doc, flush, S } = boot();
    const log = newLog();
    win.THREE = stubThree(log, true);
    S.register('t', stubScene(log));
    card(doc, 't');
    S.mountAll(doc.getElementById('main'));
    await settle(flush, 4);
    check('software GL: session fallback, nothing live', S._test.sessionOff() === true && S.debug().live === 0);
  }

  // --- 7. fifty visits to Home and away: no live objects left
  {
    const { win, doc, flush, S } = boot();
    const log = newLog();
    win.THREE = stubThree(log);
    S.register('t', stubScene(log));
    const main = doc.getElementById('main');
    for (let i = 0; i < 50; i++) {
      const c = card(doc, 't');
      S.mountAll(main);
      await settle(flush, 3);
      if (S.debug().live !== 1) { check('visit ' + i + ': scene started', false, JSON.stringify(S.debug())); break; }
      main.removeChild(c);
      await settle(flush, 2);
    }
    check('50 visits: every scene disposed', log.scenes === 50, 'disposed ' + log.scenes);
    check('...every created resource disposed', log.created.length === log.disposed.length && log.created.length === 50 * 5,
      'created ' + log.created.length + ' disposed ' + log.disposed.length);
    check('...nothing live afterwards, loop stopped', S.debug().live === 0 && S.debug().tracked === 0 &&
      S.debug().cards === 0 && S.debug().running === 0, JSON.stringify(S.debug()));
  }

  // --- 8. teardown: everything disposed, cards back to the still icon
  {
    const { win, doc, flush, S } = boot();
    const log = newLog();
    win.THREE = stubThree(log);
    S.register('t', stubScene(log));
    const cs = [card(doc, 't'), card(doc, 't')];
    S.mountAll(doc.getElementById('main'));
    await settle(flush, 3);
    S.teardown();
    check('teardown disposes every scene', log.scenes === 2 && log.created.length === log.disposed.length &&
      cs.every(c => c.children.length === 0 && !c.classList.contains('is-live')), JSON.stringify(S.debug()));
  }

  console.log(passed + ' passed, ' + failures + ' failed');
  if (failures) process.exitCode = 1;
})().catch(e => { console.log('CRASH', e && e.stack || e); process.exitCode = 1; });
