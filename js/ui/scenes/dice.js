/**
 * Metrology Request Tracker - js/ui/scenes/dice.js
 *
 * Help card scene (HOME-18 "the throw", after Prince's studio dice): two
 * dice with real 1-6 faces are thrown in, bounce across a glowing floor
 * grid while spinning hard, settle on their faces with a landing ripple,
 * hover and turn gently, then lift away - and the next throw comes in
 * with new faces. Faces in the card colour, pips and edges in the scene
 * ink. Cool first (HOME-15). Faster on hover (engine clock). Transparent
 * background.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('dice', function create(ctx) {
  'use strict';
  var T = ctx.T, LOOP = 6, S = 0.5;
  var FACES = [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2], [-Math.PI / 2, 0], [0, -Math.PI / 2], [Math.PI, 0]];

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
  var mats = [1, 2, 3, 4, 5, 6].map(function (n) { return face(n, ctx.tokens.surface, ctx.tokens.accent); });
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

  var dice = [-0.42, 0.42].map(function (rest, i) {
    var rm = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0 });
    var ring = new T.Mesh(new T.TorusGeometry(0.3, 0.012, 6, 40), rm);
    ring.rotation.x = Math.PI / 2;
    world.add(ring);
    return { m: die(), rest: rest, delay: i * 0.18, ring: ring, rm: rm, spin: i ? -1 : 1 };
  });

  function seg(s, a, b) { return Math.max(0, Math.min(1, (s - a) / (b - a))); }

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var n = Math.floor(t / LOOP), s = t - n * LOOP;
      world.rotation.y = 0.15 * Math.sin(t * 0.35);
      dice.forEach(function (d, i) {
        var p = seg(s, d.delay, d.delay + 2), q = 1 - Math.pow(1 - p, 3);
        var up = seg(s, 4.9, 5.6);
        var target = FACES[(n * 7 + i * 3) % 6];
        var bounce = 1.3 * Math.exp(-3.2 * p) * Math.abs(Math.cos(p * Math.PI * 3.2));
        var x = -2.6 + (d.rest + 2.6) * q, y = S / 2 + (p < 1 ? bounce : 0) + 0.04 * Math.sin(t * 2 + i) * (p >= 1 ? 1 : 0);
        d.m.position.set(x, y + 1.6 * up * up, 0.1 * i);
        var spin = Math.pow(1 - q, 2) * 14 * d.spin;
        d.m.rotation.set(target[0] + spin, target[1] + spin * 0.7 + (p >= 1 ? 0.25 * Math.sin(t * 0.8 + i) : 0), spin * 0.4);
        var sc = 1 - up;
        d.m.scale.set(Math.max(0.001, sc), Math.max(0.001, sc), Math.max(0.001, sc));
        var since = s - (d.delay + 2), v = since > 0 ? Math.min(1, since / 0.7) : 1;
        d.rm.opacity = 0.85 * (1 - v);
        d.ring.position.set(d.rest, 0.01, 0.1 * i);
        d.ring.scale.set(1 + 1.6 * v, 1 + 1.6 * v, 1);
      });
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
