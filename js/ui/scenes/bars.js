/**
 * Metrology Request Tracker - js/ui/scenes/bars.js
 *
 * Analytics card scene (HOME-18 "bar city"): a 6 x 4 field of glowing
 * bars on a turning platform, rising and falling in rolling waves. A
 * trend line runs across the front row's tops with a bright head and a
 * trail racing along it; now and then one bar spikes - a peak - flashes
 * and fires a shock ring. Cool first (HOME-15); hover lifts the waves
 * (energy) and the engine clock. Transparent background.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('bars', function create(ctx) {
  'use strict';
  var T = ctx.T, NX = 6, NZ = 4, GAP = 0.36, PEAK = 3.5, TRAIL = 5, SEGS = 40;
  var X0 = -(NX - 1) * GAP / 2, Z0 = -(NZ - 1) * GAP / 2;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 1.9, 3.7);
  camera.lookAt(0, 0.25, 0);

  scene.add(new T.HemisphereLight(0xffffff, new T.Color(ctx.tokens.surface), 0.8));
  var key = new T.DirectionalLight(0xffffff, 1.2);
  key.position.set(3, 5, 4);
  scene.add(key);

  var city = new T.Group();
  city.position.set(0.5, -0.45, 0);
  scene.add(city);

  var plate = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(NX * GAP + 0.2, 0.04, NZ * GAP + 0.2)),
    new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.line) }));
  city.add(plate);

  var barGeo = new T.BoxGeometry(0.22, 1, 0.22);
  barGeo.translate(0, 0.5, 0);                     // grows up from the plate
  var edgeGeo = new T.EdgesGeometry(barGeo);
  var body = new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.5,
    emissive: new T.Color(ctx.tokens.accent), emissiveIntensity: 0.08 });
  var hot = new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.accent), roughness: 0.4,
    emissive: new T.Color(ctx.tokens.accent), emissiveIntensity: 0.6 });
  var edgeMat = new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.85 });
  var bars = [], i, j;
  for (j = 0; j < NZ; j++) {
    for (i = 0; i < NX; i++) {
      var b = new T.Mesh(barGeo, i + j === 0 ? hot : body);
      b.add(new T.LineSegments(edgeGeo, edgeMat));
      b.position.set(X0 + i * GAP, 0.02, Z0 + j * GAP);
      city.add(b);
      bars.push({ m: b, i: i, j: j });
    }
  }

  // the trend line over the front row, its head and trail
  var tpos = new Float32Array(SEGS * 3), tgeo = new T.BufferGeometry();
  var tattr = new T.BufferAttribute(tpos, 3);
  tgeo.setAttribute('position', tattr);
  var trend = new T.Line(tgeo, new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.accent) }));
  trend.frustumCulled = false;
  city.add(trend);
  var ink = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  var headGeo = new T.IcosahedronGeometry(0.05, 1);
  var head = new T.Mesh(headGeo, ink);
  city.add(head);
  var trailMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.3 });
  var trail = [];
  for (i = 0; i < TRAIL; i++) { var tm = new T.Mesh(headGeo, trailMat); city.add(tm); trail.push(tm); }
  var shockMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0 });
  var shock = new T.Mesh(new T.TorusGeometry(0.16, 0.012, 6, 32), shockMat);
  shock.rotation.x = Math.PI / 2;
  city.add(shock);

  function height(x, z, t, amp) {
    return 0.18 + amp * (0.55 + 0.45 * Math.sin(x * 2.6 + t * 1.6) * Math.cos(z * 2.2 - t * 1.1));
  }
  var front = Z0 + (NZ - 1) * GAP + 0.16;
  function trendY(x, t, amp) { return height(x, front, t, amp) + 0.12; }

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t, energy) {
      var amp = 0.55 + 0.35 * (energy || 0), k;
      city.rotation.y = -0.35 + 0.3 * Math.sin(t * 0.25);
      var pn = Math.floor(t / PEAK), ps = t - pn * PEAK, pk = (pn * 7) % bars.length;
      var spike = ps < 0.9 ? Math.sin(ps / 0.9 * Math.PI) : 0;
      bars.forEach(function (b, n) {
        var x = b.m.position.x, z = b.m.position.z;
        var h = height(x, z, t, amp) + (n === pk ? 0.8 * spike : 0);
        b.m.scale.set(1, h, 1);
        b.m.material = n === pk && spike > 0.05 ? hot : body;
      });
      hot.emissiveIntensity = 0.4 + 0.6 * spike;
      for (k = 0; k < SEGS; k++) {
        var x = X0 - 0.1 + (NX - 1 + 0.2) * GAP * k / (SEGS - 1);
        tpos.set([x, trendY(x, t, amp), front], k * 3);
      }
      tattr.needsUpdate = true;
      var span = (NX - 1 + 0.2) * GAP, hx = function (tt) { return X0 - 0.1 + ((tt * 0.9) % 1 + 1) % 1 * span; };
      head.position.set(hx(t), trendY(hx(t), t, amp), front);
      trail.forEach(function (tm, n) {
        var x = hx(t - 0.04 * (n + 1)), s = 1 - n / TRAIL;
        tm.position.set(x, trendY(x, t, amp), front);
        tm.scale.set(s, s, s);
      });
      var b = bars[pk].m, v = Math.min(1, ps / 0.9);
      shockMat.opacity = ps < 0.9 ? 0.8 * (1 - v) : 0;
      shock.position.set(b.position.x, 0.03, b.position.z);
      shock.scale.set(1 + 2.5 * v, 1 + 2.5 * v, 1);
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
