/**
 * Metrology Request Tracker - js/ui/scenes/results.js
 *
 * Results card scene (HOME-18 "the live surface"): the measured surface -
 * a wireframe height map with a bump - turning slowly. A glowing probe orb
 * flies a figure-eight over it with a light trail; the ripple starts where
 * the probe is, so the surface answers it; data cubes lift off the surface
 * under the probe, spin and fade upward - the results. Cool first
 * (HOME-15); hover raises the ripple (energy) and the engine clock.
 * Transparent background.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('results', function create(ctx) {
  'use strict';
  var T = ctx.T, N = 22, SIZE = 3.6, STEP = SIZE / (N - 1), HALF = SIZE / 2, TRAIL = 6, CUBES = 8, RISE = 1.6;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 2.2, 3.6);
  camera.lookAt(0, 0.1, 0);

  scene.add(new T.HemisphereLight(0xffffff, new T.Color(ctx.tokens.surface), 0.8));
  var key = new T.DirectionalLight(0xffffff, 1.1);
  key.position.set(2, 5, 3);
  scene.add(key);

  var world = new T.Group();
  world.position.set(0.45, -0.25, 0);
  scene.add(world);
  var surf = new T.Group();
  world.add(surf);

  /* Grid lines along x and along z, two points per segment. */
  var segs = [], i, j;
  for (i = 0; i < N; i++) {
    for (j = 0; j < N - 1; j++) { segs.push([j, i, j + 1, i]); segs.push([i, j, i, j + 1]); }
  }
  var pos = new Float32Array(segs.length * 6);
  segs.forEach(function (s, k) {
    pos[k * 6] = -HALF + s[0] * STEP; pos[k * 6 + 2] = -HALF + s[1] * STEP;
    pos[k * 6 + 3] = -HALF + s[2] * STEP; pos[k * 6 + 5] = -HALF + s[3] * STEP;
  });
  var geo = new T.BufferGeometry();
  var attr = new T.BufferAttribute(pos, 3);
  geo.setAttribute('position', attr);
  var mesh = new T.LineSegments(geo, new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.line), transparent: true, opacity: 0.9 }));
  mesh.frustumCulled = false;
  surf.add(mesh);

  var ink = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  var orb = new T.Mesh(new T.IcosahedronGeometry(0.08, 1), ink);
  surf.add(orb);
  var haloMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.5 });
  var halo = new T.Mesh(new T.TorusGeometry(0.15, 0.01, 6, 32), haloMat);
  surf.add(halo);
  var trailMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.3 });
  var trailGeo = new T.IcosahedronGeometry(0.05, 0), trail = [];
  for (i = 0; i < TRAIL; i++) { var tm = new T.Mesh(trailGeo, trailMat); surf.add(tm); trail.push(tm); }
  var beamMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.5 });
  var beam = new T.Mesh(new T.BoxGeometry(0.01, 1, 0.01), beamMat);
  surf.add(beam);

  var cubeGeo = new T.BoxGeometry(0.09, 0.09, 0.09), cubeEdges = new T.EdgesGeometry(cubeGeo), cubes = [];
  for (i = 0; i < CUBES; i++) {
    var cm = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0 });
    var c = new T.LineSegments(cubeEdges, new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0 }));
    var box = new T.Mesh(cubeGeo, cm);
    box.add(c);
    surf.add(box);
    cubes.push({ m: box, edge: c });
  }

  function path(t) { return { x: 1.15 * Math.sin(t * 0.7), z: 0.75 * Math.sin(t * 1.4) }; }   // figure eight
  function height(x, z, t, amp, px, pz) {
    var r2 = x * x + z * z, dx = x - px, dz = z - pz, d = Math.sqrt(dx * dx + dz * dz);
    return 0.6 * Math.exp(-r2 / 1.1) + amp * Math.sin(t * 4 - d * 4.5) * Math.exp(-d * d / 1.4);
  }

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t, energy) {
      var amp = 0.1 + 0.14 * (energy || 0), p = path(t), k;
      for (k = 0; k < pos.length; k += 3) pos[k + 1] = height(pos[k], pos[k + 2], t, amp, p.x, p.z);
      attr.needsUpdate = true;
      surf.rotation.y = t * 0.1;
      var hy = height(p.x, p.z, t, amp, p.x, p.z);
      orb.position.set(p.x, hy + 0.55, p.z);
      orb.rotation.set(t, t * 1.3, 0);
      halo.position.set(p.x, hy + 0.02, p.z);
      halo.rotation.x = Math.PI / 2;
      var hs = 1 + 0.4 * Math.sin(t * 6);
      halo.scale.set(hs, hs, 1);
      beam.position.set(p.x, hy + 0.28, p.z);
      beam.scale.set(1, 0.5, 1);
      trail.forEach(function (tm, n) {
        var q = path(t - 0.08 * (n + 1)), s = 1 - n / TRAIL;
        tm.position.set(q.x, height(q.x, q.z, t, amp, p.x, p.z) + 0.55, q.z);
        tm.scale.set(s, s, s);
      });
      cubes.forEach(function (c, n) {            // each lifts off where the probe was when it was born
        var born = Math.floor((t - n * RISE / CUBES) / RISE) * RISE + n * RISE / CUBES, age = (t - born) / RISE;
        var q = path(born), y0 = height(q.x, q.z, born, amp, q.x, q.z);
        c.m.position.set(q.x, y0 + 0.1 + age * 1.1, q.z);
        c.m.rotation.set(age * 4, age * 3, 0);
        var o = age < 0.15 ? age / 0.15 : 1 - (age - 0.15) / 0.85;
        c.m.material.opacity = 0.55 * o;
        c.edge.material.opacity = o;
      });
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
