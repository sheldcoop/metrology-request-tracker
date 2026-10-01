/**
 * Metrology Request Tracker - js/ui/scenes/lots.js
 *
 * Lots card scene (HOME-23 "the lot tower"): a lot is a stack of panels.
 * Eight copper panels (copper in every theme) fly in one by one from
 * different sides and drop onto the stack with a small bounce; a laser
 * line runs up the stack and lights each panel's edge as it is read; the
 * stack then fans open into a turning spiral like a deck of cards, folds
 * back, and the panels scatter out for the next lot. Edges and laser in
 * the scene ink. Faster on hover (engine clock). Transparent background.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('lots', function create(ctx) {
  'use strict';
  var T = ctx.T, N = 8, GAP = 0.085, LOOP = 9, FLY = 0.28;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 1.5, 4);
  camera.lookAt(0, 0.1, 0);
  scene.add(new T.HemisphereLight(0xffffff, new T.Color('#3a2414'), 0.9));
  var key = new T.DirectionalLight(0xffffff, 1.3);
  key.position.set(-2, 4, 4);
  scene.add(key);

  var tower = new T.Group();
  tower.position.set(0.6, -0.45, 0);
  scene.add(tower);

  // the base plate and its ring
  var baseGeo = new T.CylinderGeometry(0.85, 0.85, 0.04, 40);
  tower.add(new T.LineSegments(new T.EdgesGeometry(baseGeo, 30),
    new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.line), transparent: true, opacity: 0.8 })));

  var panelGeo = new T.BoxGeometry(1.1, 0.04, 0.8), edgeGeo = new T.EdgesGeometry(panelGeo);
  var cu = new T.MeshStandardMaterial({ color: new T.Color('#c9784a'), metalness: 0.55, roughness: 0.35 });
  var panels = [], i;
  for (i = 0; i < N; i++) {
    var p = new T.Mesh(panelGeo, cu);
    var em = new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.35 });
    p.add(new T.LineSegments(edgeGeo, em));
    tower.add(p);
    var a = i * 2.4;
    panels.push({ m: p, em: em, from: { x: 2.6 * Math.cos(a), y: 1.4 + (i % 3) * 0.3, z: 1.6 * Math.sin(a) } });
  }
  var laserMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0 });
  var laser = new T.Mesh(new T.BoxGeometry(1.3, 0.012, 0.012), laserMat);
  laser.position.z = 0.42;
  tower.add(laser);

  function seg(s, a2, b2) { return Math.max(0, Math.min(1, (s - a2) / (b2 - a2))); }
  function smooth(x) { return x * x * (3 - 2 * x); }
  function bounce(x) { return x < 1 ? 1 - Math.pow(1 - x, 3) + 0.12 * Math.sin(x * Math.PI) * x : 1; }

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var s = ((t % LOOP) + LOOP) % LOOP;
      tower.rotation.y = 0.25 * Math.sin(t * 0.3);
      var read = seg(s, 3.0, 4.0), fan = smooth(seg(s, 4.3, 5.3)) * (1 - smooth(seg(s, 6.6, 7.4)));
      var out = smooth(seg(s, 7.9, 8.8));
      laserMat.opacity = read > 0 && read < 1 ? 0.95 : 0;
      laser.position.y = 0.04 + read * N * GAP;
      panels.forEach(function (p, k) {
        var land = bounce(seg(s, 0.2 + k * FLY, 0.2 + k * FLY + 0.55));
        var sy = 0.04 + k * GAP;
        var x = p.from.x + (0 - p.from.x) * land, y = p.from.y + (sy - p.from.y) * land, z = p.from.z + (0 - p.from.z) * land;
        var turn = (1 - land) * 3 * (k % 2 ? 1 : -1);
        // the fan: each panel swings round the stack's corner and climbs a little
        var fa = fan * (k - (N - 1) / 2) * 0.32, fy = fan * k * 0.06;
        x += Math.sin(fa) * 0.45 * fan; z += (1 - Math.cos(fa)) * 0.3 * fan;
        // the scatter for the next lot
        x += (p.from.x - x) * out; y += (p.from.y - y) * out; z += (p.from.z - z) * out;
        p.m.position.set(x, y + fy, z);
        p.m.rotation.set(turn * 0.4, turn + fa + t * 0.6 * fan, turn * 0.2);
        p.m.visible = land > 0.001 && out < 0.999;
        var lit = read > 0 && Math.abs(laser.position.y - sy) < GAP * 0.7;
        p.em.opacity = lit ? 1 : 0.35 + 0.4 * fan;
      });
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
