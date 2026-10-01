/**
 * tests/scenes.js - dev only, no dependencies:  node tests/scenes.js
 *
 * The ten Home scenes (aoi, bars, dice, new, mine, queue, board, results, hirata, welcome) against a fake THREE:
 * every scene registers, returns { scene, camera, update, dispose },
 * survives a full loop sweep including the wrap with no throw, answers
 * resize, and empties its scene on dispose. Each file stays <= 250 lines.
 * Exits 1 on any failure.
 */
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

let failures = 0, passed = 0;
function check(name, cond, detail) {
  if (cond) passed++;
  else { failures++; console.log('FAIL', name, detail !== undefined ? '-> ' + detail : ''); }
}

/** Smallest THREE that the scenes touch: objects, transforms, dispose. */
function fakeThree() {
  function tracked(o) { o.__disposed = false; o.dispose = function () { o.__disposed = true; }; return o; }
  function obj3d() {
    return { children: [], position: { x: 0, y: 0, z: 0, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } },
      rotation: { x: 0, y: 0, z: 0, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } },
      scale: { x: 1, y: 1, z: 1, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } },
      add: function (c) { this.children.push(c); return this; },
      remove: function (c) { this.children = this.children.filter(function (k) { return k !== c; }); } };
  }
  function geo() { return tracked({ translate: function () {} }); }
  function mat(o) { return tracked(o || {}); }
  return {
    Scene: function () { return obj3d(); },
    PerspectiveCamera: function () { var o = obj3d(); o.aspect = 1; o.updateProjectionMatrix = function () {};
      o.lookAt = function () {}; return o; },
    Group: function () { return obj3d(); },
    Mesh: function (g, m) { var o = obj3d(); o.geometry = g; o.material = m; return o; },
    Line: function (g, m) { var o = obj3d(); o.geometry = g; o.material = m; return o; },
    BufferGeometry: function () { var attrs = {}; return tracked({ setAttribute: function (n, a) { attrs[n] = a; }, attributes: attrs }); },
    BufferAttribute: function (arr, size) { return { array: arr, itemSize: size,
      getX: function (i) { return this.array[i * this.itemSize]; },
      setY: function (i, v) { this.array[i * this.itemSize + 1] = v; }, needsUpdate: false }; },
    LineBasicMaterial: mat,
    HemisphereLight: function () { return obj3d(); },
    DirectionalLight: function () { var o = obj3d(); o.target = obj3d(); return o; },
    BoxGeometry: geo, CylinderGeometry: geo, TorusGeometry: geo, IcosahedronGeometry: geo, OctahedronGeometry: geo, TetrahedronGeometry: geo,
    PlaneGeometry: geo, SphereGeometry: geo, CircleGeometry: geo,
    EdgesGeometry: function (g) { return tracked({ source: g }); },
    LineSegments: function (g, m) { var o = obj3d(); o.geometry = g; o.material = m; return o; },
    CanvasTexture: function (c) { return tracked({ image: c }); },
    SRGBColorSpace: 'srgb',
    MeshStandardMaterial: mat, MeshBasicMaterial: mat,
    Color: function (c) { this.value = c; }
  };
}

function loadScenes() {
  const registry = {};
  const win = { MRT: { scene3d: { register: function (k, fn) { registry[k] = fn; } } } };
  win.window = win;
  win.document = { createElement: function (tag) {   // dice faces paint here
    if (tag !== 'canvas') throw new Error('unexpected element ' + tag);
    return { width: 0, height: 0, getContext: function () {
      return { fillRect: function () {}, beginPath: function () {}, arc: function () {}, fill: function () {},
        clearRect: function () {}, fillText: function () {} }; } }; } };
  const ctx = vm.createContext(win);
  ['aoi', 'bars', 'dice', 'new', 'mine', 'queue', 'board', 'results', 'hirata', 'welcome'].forEach(k =>
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/ui/scenes/' + k + '.js'), 'utf8'), ctx, { filename: k }));
  return registry;
}

function mkctx(T) {
  const resizers = [];
  return { T: T, tokens: { accent: '#02E8CD', bright: '#7DF9EA', danger: '#DA1E28', surface: '#123', line: '#456' },
    rand: function () { return 0.5; }, view: { w: 280, h: 120 },
    onResize: function (fn) { resizers.push(fn); }, _resizers: resizers };
}

(function run() {
  const keys = ['aoi', 'bars', 'dice', 'new', 'mine', 'queue', 'board', 'results', 'hirata', 'welcome'];
  const registry = loadScenes();
  check('all ten scenes register', keys.every(k => typeof registry[k] === 'function'),
    Object.keys(registry).join(','));

  keys.forEach(function (key) {
    const T = fakeThree(), ctx = mkctx(T);
    let inst = null;
    try { inst = registry[key](ctx); } catch (e) { check(key + ': create runs', false, e.message); return; }
    check(key + ': returns scene, camera, update, dispose',
      inst && inst.scene && inst.camera && typeof inst.update === 'function' && typeof inst.dispose === 'function');
    if (!inst || typeof inst.update !== 'function') return;
    let threw = null;
    try {
      for (let t = 0; t <= 20; t += 0.25) inst.update(0.016, t, (t % 4) / 4);  // sweeps every loop wrap, calm to hovered
      ctx._resizers.forEach(fn => { fn(300, 150); fn(200, 100); });
      for (let t = 0; t <= 20; t += 0.25) inst.update(0.016, t);
    } catch (e) { threw = e; }
    check(key + ': loop sweep + resize never throws', threw === null, threw && threw.message);
    check(key + ': camera tracks the card shape', inst.camera.aspect === 200 / 100, inst.camera.aspect);
    const before = inst.scene.children.length;
    try { inst.dispose(); } catch (e) { threw = e; }
    check(key + ': dispose empties the scene', threw === null && inst.scene.children.length === 0 &&
      before > 0, 'children ' + before + ' -> ' + (inst.scene && inst.scene.children.length));
  });

  keys.forEach(function (key) {
    const file = 'js/ui/scenes/' + key + '.js';
    const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n').length;
    check(key + ': stays small (' + lines + ' lines)', lines <= 250);
  });

  // The engine renders through the returned camera: stub scenes without one stay static-safe.
  const { win, doc, flush } = require('./fake-dom')({ ids: ['main'] });
  const c2 = vm.createContext(win);
  ['js/config.js', 'js/ui/scene3d.js'].forEach(f =>
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c2, { filename: f }));
  check('engine loads beside the scene files', !!win.MRT.scene3d);

  console.log(passed + ' passed, ' + failures + ' failed');
  if (failures) process.exitCode = 1;
})();
