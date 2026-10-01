/**
 * Metrology Request Tracker - js/ui/scenes/aoi.js
 *
 * Lab-status card scene (HOME-18 "tool constellation"): a glowing hub with
 * five tools on a tilted ring, each a different spinning wire crystal with
 * a breathing halo. Data packets race hub -> tool -> hub along the spokes
 * with short trails; a radar arm sweeps the ring. Once a loop one tool
 * goes down - it turns red and blinks, its packets stop - then comes back
 * up with a pop and a shock ring. Cool first (HOME-15). Faster on hover
 * (engine clock). Transparent background.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('aoi', function create(ctx) {
  'use strict';
  var T = ctx.T, NT = 5, RAD = 1.05, LOOP = 10, DOWN = 3, TRAIL = 3, TRIP = 1.6;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 1.5, 3.9);
  camera.lookAt(0, -0.05, 0);

  scene.add(new T.HemisphereLight(0xffffff, new T.Color(ctx.tokens.surface), 0.8));
  var key = new T.DirectionalLight(0xffffff, 1.1);
  key.position.set(2, 4, 4);
  scene.add(key);

  var sys = new T.Group();
  sys.position.set(0.55, -0.1, 0);
  scene.add(sys);

  var ink = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  var lineMat = new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.line), transparent: true, opacity: 0.8 });
  var wireMat = new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  var redWire = new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.danger) });

  // the hub
  var hubMat = new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.4,
    emissive: new T.Color(ctx.tokens.accent), emissiveIntensity: 0.5 });
  var hub = new T.Mesh(new T.IcosahedronGeometry(0.16, 1), hubMat);
  sys.add(hub);

  // the ring the tools sit on
  function circle(r, n) {
    var pts = new Float32Array((n + 1) * 3);
    for (var k = 0; k <= n; k++) { var a = k / n * Math.PI * 2; pts.set([r * Math.cos(a), 0, r * Math.sin(a)], k * 3); }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pts, 3));
    var l = new T.Line(g, lineMat);
    l.frustumCulled = false;
    return l;
  }
  sys.add(circle(RAD, 96));
  sys.add(circle(RAD * 0.5, 64));

  // the tools: different crystals, halos, spokes, packets
  var shapes = [new T.BoxGeometry(0.2, 0.2, 0.2), new T.OctahedronGeometry(0.16, 0), new T.TetrahedronGeometry(0.17, 0),
    new T.IcosahedronGeometry(0.15, 0), new T.TorusGeometry(0.11, 0.035, 8, 20)];
  var haloGeo = new T.TorusGeometry(0.24, 0.01, 6, 40), packGeo = new T.BoxGeometry(0.06, 0.06, 0.06);
  var trailMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.25 });
  var tools = [];
  for (var i = 0; i < NT; i++) {
    var a = i / NT * Math.PI * 2, x = RAD * Math.cos(a), z = RAD * Math.sin(a);
    var g = new T.Group();
    g.position.set(x, 0, z);
    var wire = new T.LineSegments(new T.EdgesGeometry(shapes[i]), wireMat);
    g.add(wire);
    var halo = new T.Mesh(haloGeo, new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.5 }));
    halo.rotation.x = Math.PI / 2;
    g.add(halo);
    sys.add(g);
    var sp = new T.BufferGeometry();
    sp.setAttribute('position', new T.BufferAttribute(new Float32Array([0, 0, 0, x, 0, z]), 3));
    sys.add(new T.Line(sp, lineMat));
    var pack = new T.Mesh(packGeo, ink), trail = [];
    sys.add(pack);
    for (var j = 0; j < TRAIL; j++) { var tm = new T.Mesh(packGeo, trailMat); sys.add(tm); trail.push(tm); }
    tools.push({ g: g, wire: wire, halo: halo, x: x, z: z, pack: pack, trail: trail, off: i * TRIP / NT });
  }
  tools[0].wire.material = redWire;   // tracked; restored each frame
  var shockMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0 });
  var shock = new T.Mesh(new T.TorusGeometry(0.2, 0.012, 6, 40), shockMat);
  shock.rotation.x = Math.PI / 2;
  sys.add(shock);

  // the radar arm
  var armMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.35 });
  var arm = new T.Mesh(new T.BoxGeometry(RAD, 0.006, 0.03), armMat);
  var armPivot = new T.Group();
  arm.position.x = RAD / 2;
  armPivot.add(arm);
  sys.add(armPivot);

  /* Packet position on a hub -> tool -> hub trip (0..1). */
  function trip(tl, u) {
    var k = u < 0.5 ? u * 2 : 2 - u * 2;
    k = k * k * (3 - 2 * k);
    return { x: tl.x * k, y: 0.04 + 0.12 * Math.sin(k * Math.PI), z: tl.z * k };
  }

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      sys.rotation.y = t * 0.18;
      hub.rotation.set(t * 0.6, t * 0.8, 0);
      hubMat.emissiveIntensity = 0.5 + 0.25 * Math.sin(t * 3);
      armPivot.rotation.y = -t * 1.4;
      var cyc = Math.floor(t / LOOP), s = t - cyc * LOOP, bad = cyc % NT;
      var isDown = s > 4 && s < 4 + DOWN, back = s - (4 + DOWN);
      tools.forEach(function (tl, i) {
        var down = isDown && i === bad;
        tl.g.rotation.set(t * 0.9 + i, t * 1.2 + i * 2, 0);
        tl.wire.material = down && Math.sin(t * 14) > -0.3 ? redWire : wireMat;
        var hb = 1 + 0.15 * Math.sin(t * 2.4 + i);
        tl.halo.scale.set(hb, hb, 1);
        tl.halo.material.opacity = down ? 0 : 0.35 + 0.2 * Math.sin(t * 2.4 + i);
        var u = ((t + tl.off) % TRIP) / TRIP;
        tl.pack.visible = !down;
        var p = trip(tl, u);
        tl.pack.position.set(p.x, p.y, p.z);
        tl.trail.forEach(function (tm, j) {
          var q = trip(tl, (((t + tl.off - 0.05 * (j + 1)) % TRIP) + TRIP) % TRIP / TRIP), sc = 1 - j / TRAIL;
          tm.visible = !down;
          tm.position.set(q.x, q.y, q.z);
          tm.scale.set(sc, sc, sc);
        });
        if (i === bad && back > 0 && back < 0.3) { var pp = 1 + 0.6 * Math.sin(back / 0.3 * Math.PI); tl.g.scale.set(pp, pp, pp); }
        else tl.g.scale.set(1, 1, 1);
      });
      var v = back > 0 ? Math.min(1, back / 0.8) : 1;
      shockMat.opacity = 0.9 * (1 - v);
      shock.position.set(tools[bad].x, 0, tools[bad].z);
      shock.scale.set(1 + 3 * v, 1 + 3 * v, 1);
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
