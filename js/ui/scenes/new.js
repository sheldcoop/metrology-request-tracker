/**
 * Metrology Request Tracker - js/ui/scenes/new.js
 *
 * New-request card scene (HOME-24 "pick, build, launch" - the flagship): a
 * copper panel lies in the lab light with its pad grid. A targeting ring
 * glides over it and picks five pads, each popping up as a glowing cube.
 * The cubes spiral together and build the request: a traveller card grows
 * out of them, edges drawing on, priority stripe igniting. Two rings
 * converge on it as it charges, then it launches along an arc with a light
 * trail and sparks into the lab portal turning in the distance; the portal
 * flashes, fires a shock ring and shows a check - request received. Then
 * the pads settle and the next request begins. Copper in every theme;
 * everything that moves in the scene ink. Faster on hover (engine clock).
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('new', function create(ctx) {
  'use strict';
  var T = ctx.T, LOOP = 10, GX = 6, GZ = 4, PITCH = 0.22, NPICK = 5, TRAIL = 6, SPARKS = 14;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 1.25, 4.3);
  camera.lookAt(0.25, 0.15, 0);
  scene.add(new T.HemisphereLight(0xffffff, new T.Color('#3a2414'), 0.9));
  var key = new T.DirectionalLight(0xffffff, 1.3);
  key.position.set(-2, 4, 4);
  scene.add(key);

  var world = new T.Group();
  scene.add(world);
  function glow(o) { return new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: o }); }
  var ink = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent) });

  // the copper panel and its pads
  var PANEL = { x: -0.55, y: -0.62, z: 0.25 };
  var panel = new T.Group();
  panel.position.set(PANEL.x, PANEL.y, PANEL.z);
  world.add(panel);
  panel.add(new T.Mesh(new T.BoxGeometry(GX * PITCH + 0.2, 0.05, GZ * PITCH + 0.2),
    new T.MeshStandardMaterial({ color: new T.Color('#c9784a'), metalness: 0.55, roughness: 0.38 })));
  var padGeo = new T.BoxGeometry(0.16, 0.03, 0.15), padMat = new T.MeshStandardMaterial({ color: new T.Color('#8f4a2c'), metalness: 0.5, roughness: 0.45 });
  var padLit = glow(0.9), pads = [], i;
  function cellX(c) { return -(GX - 1) * PITCH / 2 + (c % GX) * PITCH; }
  function cellZ(c) { return -(GZ - 1) * PITCH / 2 + Math.floor(c / GX) * PITCH; }
  for (i = 0; i < GX * GZ; i++) pads.push(part(panel, padGeo, i ? padMat : padLit, cellX(i), 0.04, cellZ(i)));
  function part(parent, geo, mat, x, y, z) { var m = new T.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; }

  var cursor = part(world, new T.TorusGeometry(0.13, 0.012, 6, 32), ink, 0, 0, 0);
  cursor.rotation.x = Math.PI / 2;

  // the five picked cubes
  var cubeGeo = new T.BoxGeometry(0.12, 0.12, 0.12), cubeEdges = new T.EdgesGeometry(cubeGeo);
  var cubeMat = new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.accent), emissive: new T.Color(ctx.tokens.accent), emissiveIntensity: 0.4 });
  var cubes = [];
  for (i = 0; i < NPICK; i++) {
    var cb = part(world, cubeGeo, cubeMat, 0, 0, 0);
    cb.add(new T.LineSegments(cubeEdges, new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.accent) })));
    cubes.push(cb);
  }

  // the request card
  var C = { x: -0.1, y: 0.32, z: 0.55 };
  var card = new T.Group();
  world.add(card);
  var plateGeo = new T.BoxGeometry(0.9, 0.56, 0.04);
  card.add(new T.Mesh(plateGeo, new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.5,
    emissive: new T.Color(ctx.tokens.accent), emissiveIntensity: 0.08 })));
  var edgeMat = new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0 });
  card.add(new T.LineSegments(new T.EdgesGeometry(plateGeo), edgeMat));
  var stripe = part(card, new T.BoxGeometry(0.05, 0.5, 0.045), new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.danger) }), -0.4, 0, 0);
  var lineGeo = new T.BoxGeometry(1, 0.035, 0.045), lines = [];
  [[0.14, 0.52], [0.02, 0.4], [-0.1, 0.46]].forEach(function (l) {
    var m = part(card, lineGeo, ink, -0.28, l[0], 0.003); m.userData = { len: l[1] }; lines.push(m);
  });
  var rings = [0, 1].map(function () { var r = part(world, new T.TorusGeometry(0.62, 0.012, 6, 48), glow(0), C.x, C.y, C.z); return r; });

  // the lab portal
  var P = { x: 1.75, y: 0.72, z: -1.1 };
  var portal = new T.Group();
  portal.position.set(P.x, P.y, P.z);
  world.add(portal);
  var outer = part(portal, new T.TorusGeometry(0.46, 0.022, 8, 64), ink, 0, 0, 0);
  var inner = part(portal, new T.TorusGeometry(0.32, 0.012, 6, 48), glow(0.6), 0, 0, 0);
  var coreMat = glow(0.12);
  part(portal, new T.CircleGeometry(0.44, 40), coreMat, 0, 0, -0.01);
  var shockMat = glow(0);
  var shock = part(portal, new T.TorusGeometry(0.46, 0.015, 6, 64), shockMat, 0, 0, 0);
  var check = new T.Group();
  part(check, new T.BoxGeometry(0.1, 0.035, 0.02), ink, -0.05, -0.03, 0.02).rotation.z = -0.8;
  part(check, new T.BoxGeometry(0.22, 0.035, 0.02), ink, 0.05, 0.02, 0.02).rotation.z = 0.9;
  portal.add(check);

  // trail ghosts and sparks of the launch
  var ghostGeo = new T.BoxGeometry(0.6, 0.36, 0.02), ghostMat = glow(0.16), ghosts = [];
  for (i = 0; i < TRAIL; i++) ghosts.push(part(world, ghostGeo, ghostMat, 0, 0, 0));
  var sparkGeo = new T.BoxGeometry(0.03, 0.03, 0.03), sparkMat = glow(0.8), sparks = [];
  for (i = 0; i < SPARKS; i++) sparks.push(part(world, sparkGeo, sparkMat, 0, 0, 0));

  function seg(s, a, b) { return Math.max(0, Math.min(1, (s - a) / (b - a))); }
  function smooth(x) { return x * x * (3 - 2 * x); }
  function pop(x) { var u = x - 1; return x <= 0 ? 0.001 : (x >= 1 ? 1 : 1 + 2.2 * u * u * u + 1.2 * u * u); }
  function picks(n) {                                       // five different pads per request
    var out = [], k = 0;
    while (out.length < NPICK) { var c = (n * 7 + k * 5 + (k * k) % 4) % (GX * GZ); if (out.indexOf(c) === -1) out.push(c); k++; }
    return out;
  }
  function cell(c) { return { x: PANEL.x + cellX(c), y: PANEL.y + 0.06, z: PANEL.z + cellZ(c) }; }
  function arc(u) {                                         // the launch path: up and over into the portal
    var a = { x: C.x, y: C.y, z: C.z }, b = { x: 0.9, y: 1.45, z: 0.4 }, v = 1 - u;
    return { x: v * v * a.x + 2 * v * u * b.x + u * u * P.x, y: v * v * a.y + 2 * v * u * b.y + u * u * P.y,
             z: v * v * a.z + 2 * v * u * b.z + u * u * P.z };
  }
  var LAUNCH = [5.2, 6.3];
  function cardAt(s) { var u = seg(s, LAUNCH[0], LAUNCH[1]); return arc(u * u * (3 - 2 * u) * 0.6 + u * u * 0.4); }

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var n = Math.floor(t / LOOP), s = t - n * LOOP, pk = picks(n);
      world.rotation.y = 0.1 * Math.sin(t * 0.3) - 0.05;
      outer.rotation.z = t * 0.6; inner.rotation.z = -t * 1.1;
      // the cursor: to each pick in turn, then wanders
      var j = Math.min(NPICK - 1, Math.max(0, Math.floor((s - 0.6) / 0.45)));
      var f = seg(s, 0.6 + j * 0.45, 0.6 + j * 0.45 + 0.3), prev = cell(j ? pk[j - 1] : 0), at = cell(pk[j]);
      var cx = s < 3 ? prev.x + (at.x - prev.x) * smooth(f) : PANEL.x + 0.5 * Math.sin(t * 0.8);
      var cz = s < 3 ? prev.z + (at.z - prev.z) * smooth(f) : PANEL.z + 0.25 * Math.sin(t * 1.1);
      cursor.position.set(cx, PANEL.y + 0.1, cz);
      var cs = 1 + 0.15 * Math.sin(t * 6);
      cursor.scale.set(cs, cs, 1);
      // the pads light while picked; the cubes pop up, then spiral into the card
      var build = seg(s, 3.0, 3.9);
      pads.forEach(function (p, c) {
        var k = pk.indexOf(c), picked = k !== -1 && s > 0.9 + k * 0.45 && s < 7.5;
        p.material = picked ? padLit : padMat;
      });
      cubes.forEach(function (cb, k) {
        var from = cell(pk[k]), up = pop(seg(s, 0.9 + k * 0.45, 1.25 + k * 0.45)), b = smooth(build);
        var sw = (1 - b) * 0.5 + 0.0001, ang = b * 5 + k * 1.26;
        var hx = from.x, hy = from.y + 0.28 * up + 0.04 * Math.sin(t * 3 + k), hz = from.z;
        cb.position.set(hx + (C.x + Math.cos(ang) * sw * b - hx) * b, hy + (C.y - hy) * b, hz + (C.z + Math.sin(ang) * sw * b - hz) * b);
        var sc = up * (1 - b * 0.9);
        cb.scale.set(sc, sc, sc);
        cb.rotation.set(t * 2 + k, t * 1.5, 0);
        cb.visible = s > 0.9 + k * 0.45 && b < 1;
      });
      // the card: grows, edges draw, stripe ignites, charges, launches
      var grow = pop(seg(s, 3.4, 4.0)), launched = s > LAUNCH[0], u = seg(s, LAUNCH[0], LAUNCH[1]);
      var pos = launched ? cardAt(s) : { x: C.x, y: C.y + 0.04 * Math.sin(t * 2.2), z: C.z };
      card.position.set(pos.x, pos.y, pos.z);
      var shrink = 1 - 0.65 * u;
      card.scale.set(grow * shrink, grow * shrink, grow * shrink);
      card.rotation.set(-0.15 + 0.4 * u, -0.25 + 0.5 * u + (launched ? 0 : 0.08 * Math.sin(t)), 0.35 * Math.sin(u * Math.PI));
      card.visible = s > 3.4 && u < 1;
      edgeMat.opacity = seg(s, 3.6, 4.1);
      stripe.scale.set(1, Math.max(0.001, pop(seg(s, 3.9, 4.3))), 1);
      lines.forEach(function (l, k) {
        var g = Math.max(0.001, smooth(seg(s, 4.0 + k * 0.12, 4.4 + k * 0.12))) * l.userData.len;
        l.scale.set(g, 1, 1); l.position.x = -0.32 + g / 2;
      });
      var charge = seg(s, 4.2, 5.2);
      rings.forEach(function (r, k) {
        var c = (charge + k * 0.5) % 1, on = charge > 0 && charge < 1;
        r.material.opacity = on ? 0.7 * c : 0;
        var rs = 2.2 - 1.5 * c;
        r.scale.set(rs, rs * 0.7, 1);
        r.position.set(C.x, C.y, C.z);
        r.rotation.z = t * (k ? -1 : 1);
      });
      ghosts.forEach(function (g, k) {
        var q = cardAt(s - 0.045 * (k + 1)), on = launched && u < 1 && s - 0.045 * (k + 1) > LAUNCH[0];
        g.visible = on;
        g.position.set(q.x, q.y, q.z);
        var gs = (1 - k / TRAIL) * (1 - 0.65 * seg(s - 0.045 * (k + 1), LAUNCH[0], LAUNCH[1]));
        g.scale.set(gs, gs, 1);
        g.rotation.set(card.rotation.x, card.rotation.y, card.rotation.z);
      });
      sparks.forEach(function (sp, k) {
        var born = LAUNCH[0] + (k / SPARKS) * (LAUNCH[1] - LAUNCH[0]), life = seg(s, born, born + 0.5);
        var q = arc(seg(born, LAUNCH[0], LAUNCH[1])), a = k * 2.4;
        sp.visible = life > 0 && life < 1;
        sp.position.set(q.x + Math.cos(a) * 0.3 * life, q.y + Math.sin(a) * 0.3 * life - 0.2 * life * life, q.z);
        var ss = 1 - life;
        sp.scale.set(ss, ss, ss);
      });
      // arrival: flash, shock ring, check
      var arr = seg(s, LAUNCH[1], LAUNCH[1] + 0.7), fade = 1 - seg(s, 7.2, 8.0);
      coreMat.opacity = 0.12 + 0.6 * (arr > 0 && arr < 1 ? 1 - arr : 0);
      shockMat.opacity = arr > 0 && arr < 1 ? 0.9 * (1 - arr) : 0;
      shock.scale.set(1 + 1.8 * arr, 1 + 1.8 * arr, 1);
      var ck = pop(seg(s, LAUNCH[1] + 0.1, LAUNCH[1] + 0.45)) * fade;
      check.scale.set(Math.max(0.001, ck), Math.max(0.001, ck), 1);
      var ps = 1 + 0.15 * (arr > 0 && arr < 1 ? Math.sin(arr * Math.PI) : 0) + 0.03 * Math.sin(t * 2);
      portal.scale.set(ps, ps, ps);
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
