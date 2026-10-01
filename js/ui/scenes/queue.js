/**
 * Metrology Request Tracker - js/ui/scenes/queue.js
 *
 * My-queue card scene (HOME-14, option A "the tool at work"): request
 * blocks wait on a conveyor in priority order (the urgent one carries a
 * red stripe). Each cycle the belt steps the next block under the tool
 * head; the head lowers, a laser line sweeps the block, the block turns
 * from outline to solid ink with a small pop, the head lifts, and the
 * belt carries it out while a new request joins at the back. Belt and
 * gantry in the line colour, everything that works in the scene ink.
 * Faster on hover (engine clock). Transparent background, no shadows.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('queue', function create(ctx) {
  'use strict';
  var T = ctx.T, CYCLE = 2.6, GAP = 0.62, TOOL_X = 0.55, POOL = 7, TICKS = 12, SPAN = 4.4;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 1.4, 4);
  camera.lookAt(0, -0.1, 0);

  scene.add(new T.HemisphereLight(0xffffff, new T.Color(ctx.tokens.surface), 0.8));
  var key = new T.DirectionalLight(0xffffff, 1.2);
  key.position.set(2, 5, 4);
  scene.add(key);

  var ink = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  var lineMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.line) });
  var red = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.danger) });
  var body = new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.6, metalness: 0.15 });
  var solid = new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.accent), roughness: 0.5, metalness: 0.1,
    emissive: new T.Color(ctx.tokens.accent), emissiveIntensity: 0.25 });
  var laserMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0 });

  var world = new T.Group();
  world.position.y = -0.3;
  world.rotation.y = -0.3;
  scene.add(world);

  // the belt and its moving ticks
  var belt = new T.Mesh(new T.BoxGeometry(SPAN, 0.05, 0.6), body);
  belt.position.y = -0.03;
  world.add(belt);
  world.add(new T.LineSegments(new T.EdgesGeometry(belt.geometry), new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.line) })));
  var tickGeo = new T.BoxGeometry(0.03, 0.01, 0.5), ticks = [], i;
  for (i = 0; i < TICKS; i++) { var tk = new T.Mesh(tickGeo, lineMat); tk.position.y = 0.0; world.add(tk); ticks.push(tk); }

  // the gantry and the tool head
  var postGeo = new T.BoxGeometry(0.05, 1.05, 0.05);
  [-0.38, 0.38].forEach(function (z) {
    var p = new T.Mesh(postGeo, lineMat);
    p.position.set(TOOL_X, 0.5, z);
    world.add(p);
  });
  var beam = new T.Mesh(new T.BoxGeometry(0.08, 0.06, 0.84), lineMat);
  beam.position.set(TOOL_X, 1.02, 0);
  world.add(beam);
  var head = new T.Group();
  var housing = new T.Mesh(new T.BoxGeometry(0.2, 0.22, 0.2), ink);
  var nozzle = new T.Mesh(new T.CylinderGeometry(0.05, 0.02, 0.1, 12), ink);
  nozzle.position.y = -0.15;
  head.add(housing); head.add(nozzle);
  world.add(head);
  var beamLine = new T.Mesh(new T.BoxGeometry(0.012, 1, 0.012), laserMat);   // head -> block, scaled to length
  world.add(beamLine);
  var spot = new T.Mesh(new T.BoxGeometry(0.02, 0.006, 0.34), laserMat);       // the line on the block
  world.add(spot);

  // the request blocks: a pool reused as the belt runs
  var blockGeo = new T.BoxGeometry(0.4, 0.22, 0.34), edgeGeo = new T.EdgesGeometry(blockGeo);
  var edgeMat = new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  var stripeGeo = new T.BoxGeometry(0.06, 0.005, 0.34);
  var pool = [];
  for (i = 0; i < POOL; i++) {
    var b = new T.Mesh(blockGeo, body);
    b.add(new T.LineSegments(edgeGeo, edgeMat));
    var st = new T.Mesh(stripeGeo, red);
    st.position.set(-0.15, 0.115, 0);
    b.add(st);
    world.add(b);
    pool.push({ m: b, stripe: st });
  }
  pool[0].m.material = solid;   // so the engine tracks (and disposes) both block materials

  function seg(s, a, b) { return Math.max(0, Math.min(1, (s - a) / (b - a))); }
  function smooth(x) { return x * x * (3 - 2 * x); }
  function mod(a, n) { return ((a % n) + n) % n; }

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var n = Math.floor(t / CYCLE), ph = t - n * CYCLE;
      var run = n - 1 + smooth(seg(ph, 0, 0.7));             // belt position: block n reaches the tool
      var down = smooth(seg(ph, 0.7, 1.0)) * (1 - smooth(seg(ph, 1.8, 2.1)));
      var sweep = seg(ph, 1.0, 1.8), done = ph >= 1.8;

      ticks.forEach(function (tk, k) { tk.position.x = mod(k * SPAN / TICKS + run * GAP, SPAN) - SPAN / 2; });

      var headY = 0.78 - 0.32 * down;
      head.position.set(TOOL_X, headY, 0);
      var lit = sweep > 0 && sweep < 1;
      laserMat.opacity = lit ? 0.85 : 0;
      var lx = TOOL_X - 0.18 + 0.36 * sweep, top = 0.22;
      beamLine.position.set(lx, (headY - 0.2 + top) / 2, 0);
      beamLine.scale.set(1, Math.max(0.001, headY - 0.2 - top), 1);
      spot.position.set(lx, top + 0.004, 0);

      pool.forEach(function (p) { p.m.visible = false; });
      for (var id = n - 2; id <= n + POOL - 3; id++) {
        var p = pool[mod(id, POOL)], x = TOOL_X + (run - id) * GAP;
        if (x < -SPAN / 2 + 0.2 || x > SPAN / 2 - 0.2) continue;
        var measured = id < n || (id === n && done);
        var pop = id === n && done ? 1 + 0.15 * Math.exp(-(ph - 1.8) * 8) : 1;
        var edge = Math.min(1, (x + SPAN / 2 - 0.2) / 0.3, (SPAN / 2 - 0.2 - x) / 0.3);
        p.m.visible = true;
        p.m.position.set(x, 0.11, 0);
        p.m.material = measured ? solid : body;
        p.m.scale.set(pop * edge, pop * edge, pop * edge);
        p.stripe.visible = mod(id, 4) === 1 && !measured;    // the urgent one
      }
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
