/**
 * Metrology Request Tracker - js/ui/scenes/aoi.js
 *
 * Lab-status card scene (HOME-20 "the lab floor"): five machines on a lab
 * floor, each working the way the real tool does - HRM microscope turret
 * turning over a sliding stage, AOI camera running along its gantry with a
 * flickering light sheet, PRF stylus tracing a profile, QVM zoom lens
 * riding up and down under a pulsing ring light, FIB column firing its
 * beam with sparks. Each has a status lamp; once a loop one tool goes to
 * maintenance (red lamp, stands still). A cart carries a copper panel
 * along the front lane and docks at each tool, which works harder while
 * the panel is there. Bodies in the card colour with ink edges.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('aoi', function create(ctx) {
  'use strict';
  var T = ctx.T, XS = [-1.44, -0.72, 0, 0.72, 1.44], DOCK = 1.1, MOVE = 0.55, LOOP = XS.length * (DOCK + MOVE) + 1;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 1.75, 3.7);
  camera.lookAt(0, 0.12, 0);
  scene.add(new T.HemisphereLight(0xffffff, new T.Color(ctx.tokens.surface), 0.85));
  var key = new T.DirectionalLight(0xffffff, 1.2);
  key.position.set(2, 5, 4);
  scene.add(key);

  var lab = new T.Group();
  lab.position.set(0.4, -0.5, 0);
  scene.add(lab);

  var bodyMat = new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.55, metalness: 0.2 });
  var edgeMat = new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.8 });
  var ink = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  var red = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.danger) });
  function glowMat() { return new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.4 }); }
  function body(parent, geo, x, y, z) {
    var m = new T.Mesh(geo, bodyMat);
    m.position.set(x, y, z);
    m.add(new T.LineSegments(new T.EdgesGeometry(geo), edgeMat));
    parent.add(m);
    return m;
  }
  function part(parent, geo, mat, x, y, z) { var m = new T.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; }

  // the floor: lane lines
  var fl = [], k;
  for (k = -3; k <= 3; k++) fl.push(-1.9, 0, k * 0.22, 1.9, 0, k * 0.22);
  var fgeo = new T.BufferGeometry();
  fgeo.setAttribute('position', new T.BufferAttribute(new Float32Array(fl), 3));
  var floor = new T.LineSegments(fgeo, new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.line), transparent: true, opacity: 0.5 }));
  floor.frustumCulled = false;
  lab.add(floor);

  var tools = XS.map(function (x) { var g = new T.Group(); g.position.set(x, 0, -0.3); lab.add(g); return g; });
  var lampGeo = new T.SphereGeometry(0.04, 10, 8), lamps = [];
  tools.forEach(function (g) { lamps.push(part(g, lampGeo, ink, 0.2, 0.62, 0.12)); });
  lamps[0].material = red;   // so the engine tracks (and disposes) the red lamp too

  // HRM: base, pillar, arm, turning turret with objectives, sliding stage
  var hrm = tools[0];
  body(hrm, new T.BoxGeometry(0.42, 0.08, 0.34), 0, 0.04, 0);
  body(hrm, new T.BoxGeometry(0.07, 0.5, 0.07), 0, 0.33, -0.12);
  body(hrm, new T.BoxGeometry(0.08, 0.07, 0.22), 0, 0.55, -0.02);
  var turret = new T.Group(); turret.position.set(0, 0.47, 0.06); hrm.add(turret);
  var objGeo = new T.CylinderGeometry(0.018, 0.012, 0.12, 8);
  [0, 2.1, 4.2].forEach(function (a) { var o = part(turret, objGeo, ink, 0.05 * Math.cos(a), -0.05, 0.05 * Math.sin(a)); o.rotation.z = 0.25; });
  var stage = body(hrm, new T.BoxGeometry(0.26, 0.03, 0.2), 0, 0.1, 0.05);

  // AOI: gantry, running camera, light sheet
  var aoi = tools[1];
  body(aoi, new T.BoxGeometry(0.42, 0.06, 0.34), 0, 0.03, 0);
  var postGeo = new T.BoxGeometry(0.04, 0.48, 0.04);
  body(aoi, postGeo, -0.19, 0.3, 0); body(aoi, postGeo, 0.19, 0.3, 0);
  body(aoi, new T.BoxGeometry(0.44, 0.05, 0.06), 0, 0.55, 0);
  var cam = body(aoi, new T.BoxGeometry(0.09, 0.1, 0.1), 0, 0.47, 0);
  var sheetMat = glowMat();
  var sheet = part(aoi, new T.BoxGeometry(0.1, 0.34, 0.006), sheetMat, 0, 0.25, 0);

  // PRF: granite block, bridge, stylus arm tracing a profile
  var prf = tools[2];
  body(prf, new T.BoxGeometry(0.44, 0.12, 0.34), 0, 0.06, 0);
  body(prf, new T.BoxGeometry(0.05, 0.38, 0.05), -0.18, 0.31, -0.1);
  body(prf, new T.BoxGeometry(0.4, 0.05, 0.05), 0, 0.48, -0.1);
  var arm = new T.Group(); prf.add(arm);
  body(arm, new T.BoxGeometry(0.05, 0.05, 0.2), 0, 0.42, 0);
  var stylus = part(arm, new T.CylinderGeometry(0.008, 0.002, 0.24, 6), ink, 0, 0.27, 0.09);

  // QVM: body, column, zoom lens, ring light
  var qvm = tools[3];
  body(qvm, new T.BoxGeometry(0.42, 0.1, 0.34), 0, 0.05, 0);
  body(qvm, new T.BoxGeometry(0.1, 0.52, 0.08), 0, 0.36, -0.13);
  var lens = body(qvm, new T.CylinderGeometry(0.05, 0.05, 0.2, 14), 0, 0.38, 0.02);
  var ringMat = glowMat();
  var ring = part(qvm, new T.TorusGeometry(0.07, 0.012, 6, 24), ringMat, 0, 0.27, 0.02);
  ring.rotation.x = Math.PI / 2;

  // FIB: chamber, tapered column, beam, sparks
  var fib = tools[4];
  body(fib, new T.BoxGeometry(0.4, 0.12, 0.34), 0, 0.06, 0);
  body(fib, new T.BoxGeometry(0.05, 0.5, 0.05), -0.15, 0.37, -0.12);
  body(fib, new T.CylinderGeometry(0.09, 0.04, 0.32, 14), 0, 0.46, 0);   // the column, tip down
  var beamMat = glowMat();
  part(fib, new T.CylinderGeometry(0.008, 0.008, 0.18, 6), beamMat, 0, 0.21, 0);
  var sparkGeo = new T.BoxGeometry(0.02, 0.02, 0.02), sparks = [];
  for (k = 0; k < 6; k++) sparks.push(part(fib, sparkGeo, ink, 0, 0.13, 0));

  // the cart with a copper panel
  var cart = new T.Group(); lab.add(cart);
  body(cart, new T.BoxGeometry(0.3, 0.06, 0.2), 0, 0.05, 0);
  part(cart, new T.BoxGeometry(0.24, 0.015, 0.16),
    new T.MeshStandardMaterial({ color: new T.Color('#c9784a'), metalness: 0.55, roughness: 0.35 }), 0, 0.09, 0);

  function smooth(x) { return x * x * (3 - 2 * x); }

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var cyc = Math.floor(t / LOOP), s = t - cyc * LOOP, down = (cyc + 2) % XS.length;
      lab.rotation.y = 0.14 * Math.sin(t * 0.3);
      // the cart: move, dock, move ... then out to the right and back in from the left
      var slot = Math.floor(s / (DOCK + MOVE)), f = s - slot * (DOCK + MOVE), at = -1, cx;
      if (slot < XS.length) {
        var from = slot ? XS[slot - 1] : -2.3;
        cx = f < MOVE ? from + (XS[slot] - from) * smooth(f / MOVE) : XS[slot];
        if (f >= MOVE) at = slot;
      } else cx = XS[XS.length - 1] + (2.4 - XS[XS.length - 1]) * smooth((s - XS.length * (DOCK + MOVE)) / 1);
      cart.position.set(cx, 0, 0.42);
      cart.visible = cx < 2.3;
      function busy(i) { return i === down ? 0 : (i === at ? 1.8 : 1); }
      lamps.forEach(function (l, i) {
        l.material = i === down && Math.sin(t * 9) > 0 ? red : (i === down ? bodyMat : ink);
        var p = i === at ? 1.3 + 0.3 * Math.sin(t * 12) : 1;
        l.scale.set(p, p, p);
      });
      var b0 = busy(0), b1 = busy(1), b2 = busy(2), b3 = busy(3), b4 = busy(4);
      turret.rotation.y += dt * 1.6 * b0;
      stage.position.x = 0.06 * Math.sin(t * 1.2) * Math.min(1, b0);
      cam.position.x = 0.15 * Math.sin(t * 1.6 * b1 + 1);
      sheet.position.x = cam.position.x;
      sheetMat.opacity = b1 ? 0.2 + 0.25 * Math.abs(Math.sin(t * 9)) : 0;
      arm.position.x = 0.15 * Math.sin(t * 0.9 * b2);
      stylus.position.y = 0.27 + (b2 ? 0.015 * Math.sin(t * 11) + 0.01 * Math.sin(t * 23) : 0);
      lens.position.y = 0.38 + (b3 ? 0.05 * Math.sin(t * 1.4 * b3) : 0);
      ringMat.opacity = b3 ? 0.35 + 0.35 * Math.abs(Math.sin(t * 3 * b3)) : 0.1;
      beamMat.opacity = b4 ? 0.35 + 0.6 * Math.abs(Math.sin(t * 17)) : 0;
      sparks.forEach(function (sp, i) {
        var life = ((t * 1.8 * Math.max(b4, 0.001) + i / sparks.length) % 1);
        var a = i * 1.05 + Math.floor(t * 1.8 + i / sparks.length) * 0.7;
        sp.visible = b4 > 0;
        sp.position.set(Math.cos(a) * 0.14 * life, 0.13 + 0.12 * life - 0.18 * life * life, Math.sin(a) * 0.14 * life);
        var sc = 1 - life;
        sp.scale.set(sc, sc, sc);
      });
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
