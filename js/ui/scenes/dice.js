/**
 * Metrology Request Tracker - js/ui/scenes/dice.js
 *
 * Help card scene (HOME-20 "the dice become help", after Prince's studio
 * dice): two dice are thrown in, bounce and spin across a floor of rings,
 * and always land on FIVE, facing you. Then their ten pips lift off the
 * faces and fly up into a glowing question mark - the help - which hangs
 * and breathes in a halo, then the pips fly home, the dice lift away and
 * the next throw comes in. Faces in the card colour, pips and edges in the
 * scene ink. Faster on hover (engine clock). Transparent background.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('dice', function create(ctx) {
  'use strict';
  var T = ctx.T, LOOP = 7, S = 0.5;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 1.5, 4);
  camera.lookAt(0, 0.05, 0);

  scene.add(new T.HemisphereLight(0xffffff, new T.Color(ctx.tokens.surface), 0.8));
  var key = new T.DirectionalLight(0xffffff, 1.2);
  key.position.set(3, 5, 4);
  scene.add(key);

  var world = new T.Group();
  world.position.set(0.5, -0.35, 0);
  scene.add(world);

  /* One die face: the card colour with ink pips, drawn on canvas. */
  function face(count, bg, fg) {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = fg;
    var at = function (x, y) { g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill(); };
    var L = 34, C = 64, R = 94;
    if (count === 1) at(C, C);
    if (count === 2) { at(L, L); at(R, R); }
    if (count === 3) { at(L, L); at(C, C); at(R, R); }
    if (count === 4) { at(L, L); at(R, R); at(L, R); at(R, L); }
    if (count === 5) { at(L, L); at(R, R); at(L, R); at(R, L); at(C, C); }
    if (count === 6) { at(L, L); at(R, R); at(L, C); at(R, C); at(L, R); at(R, L); }
    var tex = new T.CanvasTexture(c);
    if ('colorSpace' in tex && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
    return new T.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.15 });
  }
  var mats = [1, 2, 3, 4, 0, 6].map(function (n) { return face(n, ctx.tokens.surface, ctx.tokens.accent); });   // +z (five) blank: its pips are meshes that can fly
  var boxGeo = new T.BoxGeometry(S, S, S), edgeGeo = new T.EdgesGeometry(boxGeo);
  var edgeMat = new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  function die() {
    var d = new T.Mesh(boxGeo, mats);
    d.add(new T.LineSegments(edgeGeo, edgeMat));
    world.add(d);
    return d;
  }

  // the floor: concentric rings, faint
  var floorMat = new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.line), transparent: true, opacity: 0.6 });
  [0.5, 0.9, 1.3].forEach(function (r) {
    var pts = new Float32Array(65 * 3);
    for (var k = 0; k <= 64; k++) { var a = k / 64 * Math.PI * 2; pts.set([r * Math.cos(a) * 1.4, 0, r * Math.sin(a)], k * 3); }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pts, 3));
    var l = new T.Line(g, floorMat);
    l.frustumCulled = false;
    world.add(l);
  });

  /* The question mark, ten points around Q: hook, stem, dot. */
  var Q = { x: 0, y: 0.95 }, MARK = [];
  [160, 118, 76, 34, -8, -48, -82].forEach(function (d) {
    var r = d * Math.PI / 180; MARK.push({ x: 0.27 * Math.cos(r), y: 0.3 + 0.27 * Math.sin(r) });
  });
  MARK.push({ x: 0.0, y: -0.07 }, { x: 0, y: -0.2 }, { x: 0, y: -0.48 });
  var P5 = [[-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]], PO = 0.117;
  var pipGeo = new T.CylinderGeometry(0.045, 0.045, 0.02, 14), pipMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  var haloMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0 });
  var halo = new T.Mesh(new T.TorusGeometry(0.5, 0.01, 6, 48), haloMat);
  halo.position.set(Q.x, Q.y + 0.08, 0);
  world.add(halo);

  var dice = [-0.42, 0.42].map(function (rest, i) {
    var rm = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0 });
    var ring = new T.Mesh(new T.TorusGeometry(0.3, 0.012, 6, 40), rm);
    ring.rotation.x = Math.PI / 2;
    world.add(ring);
    var m = die(), pips = P5.map(function (p) {
      var pip = new T.Mesh(pipGeo, pipMat);
      pip.rotation.x = Math.PI / 2;
      m.add(pip);
      return { m: pip, x: p[0] * PO, y: p[1] * PO };
    });
    return { m: m, rest: rest, delay: i * 0.18, ring: ring, rm: rm, spin: i ? -1 : 1, pips: pips };
  });

  function seg(s, a, b) { return Math.max(0, Math.min(1, (s - a) / (b - a))); }
  function smooth(x) { return x * x * (3 - 2 * x); }

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var n = Math.floor(t / LOOP), s = t - n * LOOP;
      world.rotation.y = 0.12 * Math.sin(t * 0.35);
      var up = seg(s, 5.9, 6.6), back = seg(s, 5.0, 5.7), hold = s > 3.2 && s < 5.0;
      haloMat.opacity = hold ? 0.35 + 0.25 * Math.sin(t * 4) : 0;
      var hs = 1 + 0.06 * Math.sin(t * 2);
      halo.scale.set(hs, hs, 1);
      dice.forEach(function (d, i) {
        var p = seg(s, d.delay, d.delay + 2), q = 1 - Math.pow(1 - p, 3);
        var bounce = 1.3 * Math.exp(-3.2 * p) * Math.abs(Math.cos(p * Math.PI * 3.2));
        var x = -2.6 + (d.rest + 2.6) * q, y = S / 2 + (p < 1 ? bounce : 0);
        d.m.position.set(x, y + 1.6 * up * up, 0);
        var spin = Math.pow(1 - q, 2) * 14 * d.spin;               // ends exactly at 0: five faces you
        d.m.rotation.set(spin, spin * 0.7, spin * 0.4);
        var sc = Math.max(0.001, 1 - up);
        d.m.scale.set(sc, sc, sc);
        d.pips.forEach(function (pp, k) {
          var idx = i * 5 + k, go = smooth(seg(s, 2.4 + idx * 0.06, 2.9 + idx * 0.06)) * (1 - smooth(back));
          var mk = MARK[idx], bob = hold ? 0.03 * Math.sin(t * 3 + idx * 0.6) : 0;
          var tx = Q.x + mk.x - d.rest, ty = Q.y + mk.y - y + bob;   // die-local: the die is upright by now
          var arc = Math.sin(go * Math.PI) * 0.25;
          pp.m.position.set(pp.x + (tx - pp.x) * go, pp.y + (ty - pp.y) * go, S / 2 + 0.006 + arc);
          var ps = 1 + 0.35 * go + (hold ? 0.15 * Math.sin(t * 5 + idx) : 0);
          pp.m.scale.set(ps, 1, ps);
        });
        var since = s - (d.delay + 2), v = since > 0 ? Math.min(1, since / 0.7) : 1;
        d.rm.opacity = 0.85 * (1 - v);
        d.ring.position.set(d.rest, 0.01, 0);
        d.ring.scale.set(1 + 1.6 * v, 1 + 1.6 * v, 1);
      });
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
