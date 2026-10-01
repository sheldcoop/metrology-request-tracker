/**
 * Metrology Request Tracker - js/ui/scenes/mine.js
 *
 * My-requests card scene (HOME-13, option A "the journey"): a curved track
 * with four stations - Submitted, Queued, Measuring, Done. A traveller card
 * rides it stop-and-go; the track fills in behind it, each station lights
 * and pulses as it arrives. At Measuring a probe dips and a scan line
 * sweeps the card; at Done a check mark pops with a small burst, then the
 * next card starts. Track and stations in the line colour, everything
 * that moves in the scene ink, card in the card colour. Faster on hover
 * (engine clock). Transparent background, no shadows.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('mine', function create(ctx) {
  'use strict';
  var T = ctx.T, LOOP = 9, N = 64, STOPS = [0, 1 / 3, 2 / 3, 1], BURST = 8;
  /* [time, u]: the card's stop-and-go schedule along the track. */
  var PLAN = [[0.4, 0], [1.6, STOPS[1]], [2.2, STOPS[1]], [3.4, STOPS[2]], [5.0, STOPS[2]], [6.2, 1]];
  var ARRIVE = [0.4, 1.6, 3.4, 6.2];

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 0.9, 4);
  camera.lookAt(0, -0.05, 0);

  scene.add(new T.HemisphereLight(0xffffff, new T.Color(ctx.tokens.surface), 0.8));
  var key = new T.DirectionalLight(0xffffff, 1.1);
  key.position.set(2, 4, 5);
  scene.add(key);

  var ink = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  var dim = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.line) });
  var burstMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0 });
  var scanMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0 });

  var world = new T.Group();
  world.rotation.x = 0.28;
  world.position.y = -0.1;
  scene.add(world);

  function P(u) { return { x: -1.65 + 3.4 * u, y: 0.2 * Math.sin(u * Math.PI * 2 - 0.6) }; }
  function slope(u) { var a = P(u - 0.01), b = P(u + 0.01); return Math.atan2(b.y - a.y, b.x - a.x); }

  function line(color, opacity) {
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(N * 3);
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    var l = new T.Line(geo, new T.LineBasicMaterial({ color: new T.Color(color), transparent: true, opacity: opacity }));
    l.frustumCulled = false;
    world.add(l);
    return { pos: pos, geo: geo };
  }
  function trace(l, upTo) {
    for (var i = 0; i < N; i++) {
      var p = P(Math.min(i / (N - 1), upTo));
      l.pos[i * 3] = p.x; l.pos[i * 3 + 1] = p.y; l.pos[i * 3 + 2] = 0;
    }
    l.geo.attributes.position.needsUpdate = true;
  }
  var track = line(ctx.tokens.line, 0.9), done = line(ctx.tokens.accent, 1);
  trace(track, 1);

  // the four stations: a ring and a core that lights on arrival
  var ringGeo = new T.TorusGeometry(0.11, 0.018, 8, 28), coreGeo = new T.CircleGeometry(0.06, 20);
  var stations = STOPS.map(function (u) {
    var p = P(u), g = new T.Group();
    g.position.set(p.x, p.y, 0);
    var ring = new T.Mesh(ringGeo, dim), core = new T.Mesh(coreGeo, ink);
    g.add(ring); g.add(core);
    world.add(g);
    return { g: g, ring: ring, core: core };
  });

  // the traveller card: plate, ink edge stripe, two ink lines
  var card = new T.Group();
  var plate = new T.Mesh(new T.BoxGeometry(0.46, 0.3, 0.03),
    new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.6, metalness: 0.15 }));
  card.add(plate);
  card.add(new T.LineSegments(new T.EdgesGeometry(plate.geometry), new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.accent) })));
  var stripe = new T.Mesh(new T.PlaneGeometry(0.04, 0.26), ink);
  stripe.position.set(-0.19, 0, 0.02);
  card.add(stripe);
  [0.06, -0.04].forEach(function (y, k) {
    var l = new T.Mesh(new T.PlaneGeometry(k ? 0.18 : 0.26, 0.03), ink);
    l.position.set(-0.03 - (k ? 0.04 : 0), y, 0.02);
    card.add(l);
  });
  var scan = new T.Mesh(new T.PlaneGeometry(0.025, 0.34), scanMat);
  scan.position.z = 0.03;
  card.add(scan);
  world.add(card);

  // Measuring: the probe above station 3
  var probe = new T.Group();
  var arm = new T.Mesh(new T.BoxGeometry(0.035, 0.36, 0.035), ink);
  var tip = new T.Mesh(new T.CylinderGeometry(0.035, 0.002, 0.08, 12), ink);
  tip.position.y = -0.22;
  probe.add(arm); probe.add(tip);
  var p3 = P(STOPS[2]);
  probe.position.set(p3.x, p3.y + 0.75, 0.05);
  world.add(probe);

  // Done: check mark and a burst of dots
  var check = new T.Group();
  var c1 = new T.Mesh(new T.BoxGeometry(0.1, 0.035, 0.02), ink), c2 = new T.Mesh(new T.BoxGeometry(0.2, 0.035, 0.02), ink);
  c1.position.set(-0.05, -0.02, 0); c1.rotation.z = -0.8;
  c2.position.set(0.04, 0.02, 0); c2.rotation.z = 0.9;
  check.add(c1); check.add(c2);
  var p4 = P(1);
  check.position.set(p4.x, p4.y + 0.32, 0.05);
  world.add(check);
  var dotGeo = new T.CircleGeometry(0.025, 10), dots = [], i;
  for (i = 0; i < BURST; i++) { var d = new T.Mesh(dotGeo, burstMat); world.add(d); dots.push(d); }

  function seg(s, a, b) { return Math.max(0, Math.min(1, (s - a) / (b - a))); }
  function smooth(x) { return x * x * (3 - 2 * x); }
  function pop(x) { var u = x - 1; return x <= 0 ? 0.001 : (x >= 1 ? 1 : 1 + 2.2 * u * u * u + 1.2 * u * u); }
  function at(s) {
    if (s <= PLAN[0][0]) return 0;
    for (var k = 1; k < PLAN.length; k++) {
      if (s <= PLAN[k][0]) return PLAN[k - 1][1] + (PLAN[k][1] - PLAN[k - 1][1]) * smooth(seg(s, PLAN[k - 1][0], PLAN[k][0]));
    }
    return 1;
  }

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var s = ((t % LOOP) + LOOP) % LOOP, u = at(s), p = P(u);
      var out = seg(s, 8.2, 8.8), inn = pop(seg(s, 0, 0.4)), sc = inn * (1 - out) + 0.001;
      card.position.set(p.x, p.y + 0.25 + 0.03 * Math.sin(t * 3), 0.06);
      card.rotation.set(0, 0, slope(u) * 0.8);
      card.scale.set(sc, sc, 1);
      trace(done, s < 8.2 ? u : u * (1 - out));

      stations.forEach(function (st, k) {
        var since = s - ARRIVE[k], lit = since >= 0 && s < 8.2;
        var pulse = lit ? Math.exp(-since * 4) : 0;
        var c = lit ? 1 + 0.6 * pulse : 0.001;
        st.core.scale.set(c, c, 1);
        st.ring.material = lit ? ink : dim;
        var r = 1 + 0.5 * pulse + (lit ? 0.04 * Math.sin(t * 2 + k) : 0);
        st.ring.scale.set(r, r, 1);
      });

      var dip = smooth(seg(s, 3.5, 3.8)) * (1 - smooth(seg(s, 4.6, 5.0)));
      probe.position.y = p3.y + 0.8 - 0.28 * dip;
      var sweep = seg(s, 3.8, 4.6);
      scanMat.opacity = sweep > 0 && sweep < 1 ? 0.9 : 0;
      scan.position.x = -0.21 + 0.42 * sweep;

      var ck = pop(seg(s, 6.2, 6.55)) * (1 - out);
      check.scale.set(ck, ck, 1);
      var b = seg(s, 6.2, 7.1);
      burstMat.opacity = b > 0 && b < 1 ? 1 - b : 0;
      dots.forEach(function (d, k) {
        var a = k / BURST * Math.PI * 2, r = 0.15 + 0.4 * Math.sqrt(b);
        d.position.set(p4.x + Math.cos(a) * r, p4.y + 0.32 + Math.sin(a) * r, 0.05);
      });
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
