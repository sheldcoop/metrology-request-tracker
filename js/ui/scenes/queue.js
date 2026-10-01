/**
 * Metrology Request Tracker - js/ui/scenes/queue.js
 *
 * My-queue card scene (HOME-16, option A "orbit core"): a spinning
 * wireframe crystal - the tool - glows in the middle; request cubes circle
 * it on three tilted rings, each with a fading light trail. Every few
 * seconds one cube breaks orbit and spirals in; the core flashes and fires
 * a shock ring, and a fresh cube pops in on its ring. Cool first, the job
 * second (HOME-15). Rings in the line colour, cubes and core in the scene
 * ink. Faster on hover (engine clock). Transparent background.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('queue', function create(ctx) {
  'use strict';
  var T = ctx.T, ABS = 3, DIVE = 0.9, TRAIL = 3;
  var RINGS = [{ r: 0.95, tilt: [1.2, 0, 0.3], speed: 0.9, n: 3 },
               { r: 0.75, tilt: [0.5, 0.7, -0.4], speed: -1.25, n: 2 },
               { r: 1.12, tilt: [1.9, -0.5, 0.9], speed: 0.65, n: 3 }];

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 0.2, 4.2);
  camera.lookAt(0, 0, 0);

  scene.add(new T.HemisphereLight(0xffffff, new T.Color(ctx.tokens.surface), 0.8));
  var key = new T.DirectionalLight(0xffffff, 1.1);
  key.position.set(2, 4, 5);
  scene.add(key);

  var sys = new T.Group();
  sys.position.set(0.55, -0.05, 0);
  scene.add(sys);

  // the core: a wire crystal around a glowing solid heart
  var heartMat = new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.4,
    emissive: new T.Color(ctx.tokens.accent), emissiveIntensity: 0.3 });
  var heart = new T.Mesh(new T.IcosahedronGeometry(0.2, 0), heartMat);
  var wire = new T.LineSegments(new T.EdgesGeometry(new T.IcosahedronGeometry(0.34, 0)),
    new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.accent) }));
  var core = new T.Group();
  core.add(heart); core.add(wire);
  sys.add(core);

  // the shock ring fired on each absorption (faces the camera)
  var shockMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0 });
  var shock = new T.Mesh(new T.TorusGeometry(0.3, 0.012, 6, 48), shockMat);
  sys.add(shock);

  // rings with orbiting cubes and their trails
  var ringMat = new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.line), transparent: true, opacity: 0.8 });
  var cubeGeo = new T.BoxGeometry(0.13, 0.13, 0.13), cubeEdges = new T.EdgesGeometry(cubeGeo);
  var cubeMat = new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.accent), roughness: 0.4,
    emissive: new T.Color(ctx.tokens.accent), emissiveIntensity: 0.2 });
  var edgeMat = new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  var trailMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.22 });
  var trailGeo = new T.BoxGeometry(0.08, 0.08, 0.08);
  var cubes = [];
  RINGS.forEach(function (R, ri) {
    var g = new T.Group();
    g.rotation.set(R.tilt[0], R.tilt[1], R.tilt[2]);
    var pts = new Float32Array(97 * 3), k;
    for (k = 0; k <= 96; k++) { var a = k / 96 * Math.PI * 2; pts.set([R.r * Math.cos(a), R.r * Math.sin(a), 0], k * 3); }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pts, 3));
    var loop = new T.Line(geo, ringMat);
    loop.frustumCulled = false;
    g.add(loop);
    for (k = 0; k < R.n; k++) {
      var m = new T.Mesh(cubeGeo, cubeMat);
      m.add(new T.LineSegments(cubeEdges, edgeMat));
      g.add(m);
      var trail = [];
      for (var j = 0; j < TRAIL; j++) { var tm = new T.Mesh(trailGeo, trailMat); g.add(tm); trail.push(tm); }
      cubes.push({ m: m, trail: trail, ring: R, phase: k / R.n * Math.PI * 2 + ri });
    }
    sys.add(g);
  });

  function smooth(x) { return x * x * (3 - 2 * x); }
  function pop(x) { var u = x - 1; return x <= 0 ? 0.001 : (x >= 1 ? 1 : 1 + 2.2 * u * u * u + 1.2 * u * u); }

  /* Where a cube is at time t: angle on its ring, radius (dives in), scale. */
  function where(c, idx, t) {
    var n = Math.floor(t / ABS), since = t - n * ABS, diving = n % cubes.length === idx;
    var a = c.phase + t * c.ring.speed, r = c.ring.r, s = 1;
    if (diving && since < DIVE) {
      var u = smooth(since / DIVE);
      r *= 1 - u; a += u * 4 * Math.sign(c.ring.speed); s = 1 - 0.7 * u;
    } else if (diving) s = pop((since - DIVE) / 0.45);           // the fresh one pops in
    return { x: r * Math.cos(a), y: r * Math.sin(a), s: s };
  }

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      sys.rotation.y = t * 0.25;
      sys.rotation.x = 0.15 * Math.sin(t * 0.4);
      core.rotation.set(t * 0.7, t * 0.9, 0);
      var n = Math.floor(t / ABS), since = t - n * ABS - DIVE;
      var flash = since > 0 ? Math.exp(-since * 5) : 0;
      heartMat.emissiveIntensity = 0.3 + 1.6 * flash + 0.1 * Math.sin(t * 3);
      var cs = 1 + 0.25 * flash;
      core.scale.set(cs, cs, cs);
      var v = since > 0 ? Math.min(1, since / 0.7) : 1;
      shockMat.opacity = 0.9 * (1 - v);
      shock.scale.set(1 + 3 * v, 1 + 3 * v, 1);
      shock.rotation.set(-sys.rotation.x, -sys.rotation.y, 0);   // keep facing the camera
      cubes.forEach(function (c, i) {
        var p = where(c, i, t);
        c.m.position.set(p.x, p.y, 0);
        c.m.scale.set(p.s, p.s, p.s);
        c.m.rotation.set(t * 1.3 + i, t * 0.8, 0);
        c.trail.forEach(function (tm, j) {
          var q = where(c, i, t - 0.07 * (j + 1)), s = q.s * (1 - j / TRAIL);
          tm.position.set(q.x, q.y, 0);
          tm.scale.set(s, s, s);
        });
      });
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
