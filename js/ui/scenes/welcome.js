/**
 * Metrology Request Tracker - js/ui/scenes/welcome.js
 *
 * Welcome scene (HOME-22): behind the first-visit card and the sign-in
 * slot. A copper PCB panel (copper in every theme, like the Hirata panel)
 * turns slowly on the right. From the chip in its middle, glowing traces
 * grow out to the edge vias once, on arrival; then signals race along the
 * traces for as long as the card is open, each via flashing as a signal
 * lands, and small sparks rise off the board. Traces, signals and sparks
 * in the scene ink. Transparent background.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('welcome', function create(ctx) {
  'use strict';
  var T = ctx.T, W = 2.2, H = 1.5, NTR = 12, PTS = 24, SPARKS = 14, BUILD = 2.4, RUN = 1.6, FACE = 0.03;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(34, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 0.2, 4.4);
  camera.lookAt(0, 0, 0);
  scene.add(new T.HemisphereLight(0xffffff, new T.Color('#3a2414'), 0.9));
  var key = new T.DirectionalLight(0xffffff, 1.3);
  key.position.set(-2, 3, 4);
  scene.add(key);

  var board = new T.Group();
  board.position.set(ctx.view.w / ctx.view.h > 2 ? 1.75 : 0.9, 0, 0);
  scene.add(board);
  board.add(new T.Mesh(new T.BoxGeometry(W, H, 0.05),
    new T.MeshStandardMaterial({ color: new T.Color('#c9784a'), metalness: 0.55, roughness: 0.38 })));
  var chipGeo = new T.BoxGeometry(0.42, 0.42, 0.08);
  var chip = new T.Mesh(chipGeo, new T.MeshStandardMaterial({ color: new T.Color('#1b1714'), roughness: 0.5 }));
  chip.position.z = 0.05;
  chip.add(new T.LineSegments(new T.EdgesGeometry(chipGeo), new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.accent) })));
  board.add(chip);

  /* Twelve traces: out of a chip side, one bend, on to a via near the edge. */
  var ink = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  var traceMat = new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  var viaGeo = new T.TorusGeometry(0.035, 0.01, 6, 16), sigGeo = new T.SphereGeometry(0.028, 10, 8);
  var traces = [], k;
  for (k = 0; k < NTR; k++) {
    var side = k % 4, o = (Math.floor(k / 4) - 1) * 0.12, bend = (k % 3 - 1) * 0.28;
    var a, b, c;
    if (side === 0) { a = [0.21, o]; b = [0.5, o]; c = [W / 2 - 0.12, o + bend]; }
    else if (side === 1) { a = [-0.21, o]; b = [-0.5, o]; c = [-W / 2 + 0.12, o - bend]; }
    else if (side === 2) { a = [o, 0.21]; b = [o, 0.42]; c = [o + bend * 1.6, H / 2 - 0.1]; }
    else { a = [o, -0.21]; b = [o, -0.42]; c = [o - bend * 1.6, -H / 2 + 0.1]; }
    var pos = new Float32Array(PTS * 3), geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    var line = new T.Line(geo, traceMat);
    line.frustumCulled = false;
    board.add(line);
    var via = new T.Mesh(viaGeo, new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.5 }));
    via.position.set(c[0], c[1], FACE);
    board.add(via);
    var sig = new T.Mesh(sigGeo, ink);
    board.add(sig);
    traces.push({ a: a, b: b, c: c, pos: pos, geo: geo, via: via, sig: sig, delay: k * 0.12, off: (k * 0.37) % 1 });
  }

  var sparkMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.6 });
  var sparkGeo = new T.BoxGeometry(0.025, 0.025, 0.025), sparks = [];
  for (k = 0; k < SPARKS; k++) { var sp = new T.Mesh(sparkGeo, sparkMat); board.add(sp); sparks.push(sp); }

  /* Point at u (0..1) along a trace: two straight legs, split by length. */
  function at(tr, u) {
    var l1 = Math.hypot(tr.b[0] - tr.a[0], tr.b[1] - tr.a[1]), l2 = Math.hypot(tr.c[0] - tr.b[0], tr.c[1] - tr.b[1]);
    var d = u * (l1 + l2), p, q, f;
    if (d <= l1) { p = tr.a; q = tr.b; f = l1 ? d / l1 : 0; } else { p = tr.b; q = tr.c; f = l2 ? (d - l1) / l2 : 1; }
    return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
  }
  function seg(s, a2, b2) { return Math.max(0, Math.min(1, (s - a2) / (b2 - a2))); }

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    board.position.x = w / h > 2 ? 1.75 : 0.9;
  });

  var t0 = null;   // the engine starts scene clocks at a random point; the build starts at the first frame

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      if (t0 === null) t0 = t;
      var since = t - t0;
      board.rotation.set(-0.35 + 0.08 * Math.sin(t * 0.4), -0.45 + 0.25 * Math.sin(t * 0.25), 0.05 * Math.sin(t * 0.3));
      chip.position.z = 0.05 + 0.01 * Math.sin(t * 2);
      traces.forEach(function (tr) {
        var grow = seg(since, 0.3 + tr.delay, 0.3 + tr.delay + BUILD * 0.5), i;
        for (i = 0; i < PTS; i++) { var p = at(tr, grow * i / (PTS - 1)); tr.pos.set([p[0], p[1], FACE], i * 3); }
        tr.geo.attributes.position.needsUpdate = true;
        var live = since > 0.3 + tr.delay + BUILD * 0.5, u = ((t / RUN + tr.off) % 1);
        tr.sig.visible = live;
        var q = at(tr, u);
        tr.sig.position.set(q[0], q[1], FACE + 0.02);
        var hit = live && u > 0.9 ? (u - 0.9) / 0.1 : 0;
        tr.via.material.opacity = grow < 1 ? 0.15 : 0.45 + 0.55 * hit;
        var vs = 1 + 1.2 * hit;
        tr.via.scale.set(vs, vs, 1);
      });
      sparks.forEach(function (sp, i) {
        var life = (t * 0.5 + i / SPARKS) % 1, a2 = i * 2.39;
        sp.position.set(Math.cos(a2) * (0.3 + 0.7 * ((i * 0.618) % 1)), Math.sin(a2) * 0.6, FACE + life * 0.9);
        var sc = 1 - life;
        sp.scale.set(sc, sc, sc);
        sp.rotation.set(t * 2 + i, t, 0);
      });
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
