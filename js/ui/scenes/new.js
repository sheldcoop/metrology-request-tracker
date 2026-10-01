/**
 * Metrology Request Tracker - js/ui/scenes/new.js
 *
 * New-request card scene (HOME-12, option B "the form fills itself"): a
 * traveller card slides in blank, then fills like the real form - the
 * tool glyph pops in and its line types on, the panels pop in one by one,
 * the priority stripe runs down the edge - a stamp drops and lands, and
 * the card flies off to the lab with a tilt while the next blank one
 * comes in. Sits right of centre, behind the card's words. Card in the
 * card colour, everything that moves in the scene ink. Solid meshes,
 * transparent background, no shadows. Faster on hover (engine clock).
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('new', function create(ctx) {
  'use strict';
  var T = ctx.T, LOOP = 8, W = 1.9, H = 1.15, LEFT = -W / 2 + 0.32, FACE = 0.04, CELLS = 6;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 0.25, 4);
  camera.lookAt(0, 0, 0);

  scene.add(new T.HemisphereLight(0xffffff, new T.Color(ctx.tokens.surface), 0.8));
  var key = new T.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 4, 5);
  scene.add(key);

  var ink = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  var faint = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.line), transparent: true, opacity: 0.7 });
  var stampMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0 });

  var card = new T.Group();
  scene.add(card);
  var plate = new T.Mesh(new T.BoxGeometry(W, H, 0.06),
    new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.6, metalness: 0.15 }));
  card.add(plate);
  var rim = new T.LineSegments(new T.EdgesGeometry(plate.geometry),
    new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.55 }));
  card.add(rim);

  /* A bar that grows from the left edge: scale.x 0..1. */
  var barGeo = new T.PlaneGeometry(1, 0.07);
  function bar(y, len, mat) {
    var m = new T.Mesh(barGeo, mat);
    m.userData = { len: len, x0: LEFT + 0.32 };
    m.position.set(LEFT + 0.32, y, mat === ink ? FACE + 0.004 : FACE);   // values over the empty lines
    card.add(m);
    return m;
  }
  function grow(m, k) {
    k = Math.max(0.001, Math.min(1, k));
    m.scale.set(m.userData.len * k, 1, 1);
    m.position.x = m.userData.x0 + m.userData.len * k / 2;
  }

  var rows = [0.3, 0, -0.3];
  rows.forEach(function (y) { grow(bar(y, 1.15, faint), 1); });   // the empty form lines
  var val1 = bar(0.3, 0.8, ink), val3 = bar(-0.3, 0.55, ink);

  // row 1: the tool glyph (a lens ring with a probe) pops in
  var tool = new T.Group();
  tool.position.set(LEFT + 0.1, 0.3, FACE);
  tool.add(new T.Mesh(new T.TorusGeometry(0.075, 0.018, 8, 24), ink));
  var probe = new T.Mesh(new T.BoxGeometry(0.025, 0.09, 0.02), ink);
  probe.position.y = -0.11;
  tool.add(probe);
  card.add(tool);

  // row 2: the panels pop in one by one
  var cellGeo = new T.PlaneGeometry(0.11, 0.11), cells = [], i;
  for (i = 0; i < CELLS; i++) {
    var c = new T.Mesh(cellGeo, ink);
    c.position.set(LEFT + 0.38 + i * 0.16, 0, FACE + 0.002);
    card.add(c);
    cells.push(c);
  }
  var count = new T.Mesh(new T.CircleGeometry(0.05, 16), ink);   // the count dot at row start
  count.position.set(LEFT + 0.1, 0, FACE);
  card.add(count);

  // row 3: the priority stripe runs down the left edge
  var stripe = new T.Mesh(new T.PlaneGeometry(0.06, H - 0.1), ink);
  stripe.position.set(-W / 2 + 0.07, 0, FACE);
  card.add(stripe);

  // the stamp: ring + core, drops on the bottom-right corner
  var stamp = new T.Group();
  var ring = new T.Mesh(new T.TorusGeometry(0.17, 0.025, 8, 32), stampMat);
  var core = new T.Mesh(new T.CircleGeometry(0.09, 24), stampMat);
  stamp.add(ring); stamp.add(core);
  stamp.position.set(W / 2 - 0.32, -H / 2 + 0.3, FACE + 0.01);
  card.add(stamp);

  function seg(s, a, b) { return Math.max(0, Math.min(1, (s - a) / (b - a))); }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function pop(x) { var u = x - 1; return x <= 0 ? 0.001 : (x >= 1 ? 1 : 1 + 2.2 * u * u * u + 1.2 * u * u); }   // ease-out-back

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var s = ((t % LOOP) + LOOP) % LOOP;
      var enter = easeOut(seg(s, 0, 0.7)), leave = seg(s, 6.5, 7.4);
      card.position.x = 0.75 - 3.4 * (1 - enter) + 4.2 * leave * leave;
      card.position.y = 0.02 + 0.03 * Math.sin(t * 1.3) + 0.25 * leave;
      card.rotation.set(-0.22 + 0.04 * Math.sin(t * 0.9), -0.32 + 0.05 * Math.sin(t * 0.7), -0.35 * leave);
      card.visible = s < 7.4;

      var g = pop(seg(s, 0.8, 1.2));
      tool.scale.set(g, g, 1);
      tool.rotation.z = 0.6 * (1 - seg(s, 0.8, 1.3));
      grow(val1, easeOut(seg(s, 1.0, 1.8)));
      var n = pop(seg(s, 1.9, 2.2));
      count.scale.set(n, n, 1);
      cells.forEach(function (c, k) {
        var p = pop(seg(s, 2.1 + k * 0.22, 2.4 + k * 0.22));
        c.scale.set(p, p, 1);
      });
      var run = easeOut(seg(s, 3.6, 4.2));
      stripe.scale.set(1, Math.max(0.001, run), 1);
      stripe.position.y = (H - 0.1) / 2 * (1 - run);
      grow(val3, easeOut(seg(s, 3.8, 4.4)));

      var drop = seg(s, 4.6, 5.0);
      var sc = drop < 1 ? 2.2 - 1.2 * easeOut(drop) : 1 + 0.08 * Math.exp(-(s - 5) * 6) * Math.sin((s - 5) * 30);
      stamp.scale.set(sc, sc, 1);
      stamp.rotation.z = -0.5 + 0.5 * easeOut(drop);
      stampMat.opacity = s < 4.6 ? 0 : Math.min(1, drop * 2);
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
