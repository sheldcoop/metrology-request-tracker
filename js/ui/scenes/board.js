/**
 * Metrology Request Tracker - js/ui/scenes/board.js
 *
 * Board card scene (HOME-15, option A "the live board"): a tilted 3D board,
 * tool lanes as rows and stages as columns, glowing grid lines. Request
 * cards hop column to column in short arcs with a fading trail; the lanes
 * hop one after another so something always moves; each landing sends a
 * ripple ring across the cell. Cards drop in at the first column and lift
 * off past the last. One late card in red pulses as it goes. A scan light
 * sweeps the columns and the board sways slowly. Faster on hover (engine
 * clock). Transparent background, no shadows.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('board', function create(ctx) {
  'use strict';
  var T = ctx.T, R = 4, C = 4, CW = 0.64, LH = 0.42, HOP = 1.6, AIR = 0.45, PER = 3, TRAIL = 2;
  var X0 = -(C - 1) * CW / 2, Z0 = -(R - 1) * LH / 2;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 2.5, 3.1);
  camera.lookAt(0, -0.15, 0.1);

  scene.add(new T.HemisphereLight(0xffffff, new T.Color(ctx.tokens.surface), 0.8));
  var key = new T.DirectionalLight(0xffffff, 1.2);
  key.position.set(2, 5, 3);
  scene.add(key);

  var board = new T.Group();
  board.position.set(0.25, -0.2, 0);
  scene.add(board);

  // grid lines: lane separators and stage columns
  var segs = [], k;
  for (k = 0; k <= R; k++) segs.push([X0 - CW / 2, Z0 - LH / 2 + k * LH, X0 + (C - 0.5) * CW, Z0 - LH / 2 + k * LH]);
  for (k = 0; k <= C; k++) segs.push([X0 - CW / 2 + k * CW, Z0 - LH / 2, X0 - CW / 2 + k * CW, Z0 + (R - 0.5) * LH]);
  var gpos = new Float32Array(segs.length * 6);
  segs.forEach(function (s, i) { gpos.set([s[0], 0, s[1], s[2], 0, s[3]], i * 6); });
  var ggeo = new T.BufferGeometry();
  ggeo.setAttribute('position', new T.BufferAttribute(gpos, 3));
  var grid = new T.LineSegments(ggeo, new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.line), transparent: true, opacity: 0.9 }));
  grid.frustumCulled = false;
  board.add(grid);

  // column heads: one ink bar per stage
  var headGeo = new T.BoxGeometry(CW * 0.6, 0.02, 0.05);
  var ink = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  for (k = 0; k < C; k++) {
    var h = new T.Mesh(headGeo, ink);
    h.position.set(X0 + k * CW, 0.01, Z0 - LH / 2 - 0.1);
    board.add(h);
  }

  // the scan light sweeping the columns
  var scanMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.12 });
  var scan = new T.Mesh(new T.BoxGeometry(0.16, 0.004, R * LH), scanMat);
  scan.position.z = Z0 + (R - 1) * LH / 2;
  board.add(scan);

  // cards: a pool per lane, plus trail ghosts and a landing ripple per lane
  var cardGeo = new T.BoxGeometry(0.44, 0.05, 0.26), edgeGeo = new T.EdgesGeometry(cardGeo);
  var body = new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.6, metalness: 0.15 });
  var late = new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.danger), roughness: 0.5,
    emissive: new T.Color(ctx.tokens.danger), emissiveIntensity: 0.4 });
  var edgeMat = new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  var ghostMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.18 });
  var ghostGeo = new T.BoxGeometry(0.44, 0.01, 0.26);
  var rippleGeo = new T.TorusGeometry(0.16, 0.012, 6, 32);
  var stripeGeo = new T.BoxGeometry(0.05, 0.052, 0.26);
  var lanes = [];
  for (var L = 0; L < R; L++) {
    var cards = [];
    for (var i = 0; i < PER; i++) {
      var m = new T.Mesh(cardGeo, i === 0 && L === 0 ? late : body);
      m.add(new T.LineSegments(edgeGeo, edgeMat));
      var st = new T.Mesh(stripeGeo, ink);
      st.position.x = -0.19;
      m.add(st);
      var ghosts = [];
      for (var g = 0; g < TRAIL; g++) { var gm = new T.Mesh(ghostGeo, ghostMat); board.add(gm); ghosts.push(gm); }
      board.add(m);
      cards.push({ m: m, ghosts: ghosts });
    }
    var rmat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0 });
    var ring = new T.Mesh(rippleGeo, rmat);
    ring.rotation.x = -Math.PI / 2;
    board.add(ring);
    lanes.push({ cards: cards, ring: ring, rmat: rmat, off: [0, 0.8, 0.4, 1.2][L] * HOP / 1.6 });
  }

  function smooth(x) { return x * x * (3 - 2 * x); }
  function mod(a, n) { return ((a % n) + n) % n; }

  /* Where card `id` of a lane stands at time t: column (fractional mid-hop) and height. */
  function place(lane, L, id, t) {
    var tt = t - lane.off, n = Math.floor(tt / HOP), f = (tt - n * HOP) / AIR;
    var hop = f < 1 ? smooth(f) : 1;
    var col = n + hop - 2 * id + (L % 2) - 1;
    var y = f < 1 ? Math.sin(f * Math.PI) * 0.28 : 0;
    return { col: col, y: y };
  }

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      board.rotation.y = 0.12 * Math.sin(t * 0.3) - 0.08;
      scan.position.x = X0 - CW / 2 + mod(t * 0.5, 1) * C * CW;
      scanMat.opacity = 0.1 + 0.06 * Math.sin(t * 4);
      lanes.forEach(function (lane, L) {
        var tt = t - lane.off, n = Math.floor(tt / HOP);
        lane.cards.forEach(function (c) { c.m.visible = false; c.ghosts.forEach(function (g) { g.visible = false; }); });
        for (var id = Math.floor((n - C) / 2) - 1; id <= Math.floor((n + 2) / 2) + 1; id++) {
          var c = lane.cards[mod(id, PER)], p = place(lane, L, id, t);
          if (p.col < -1 || p.col > C) continue;
          var x = X0 + p.col * CW, y = 0.03 + p.y, s = 1;
          if (p.col < 0) { y += 0.6 * -p.col; s = 1 + p.col; }                 // drops in
          if (p.col > C - 1) { y += 0.6 * (p.col - C + 1); s = C - p.col; }    // lifts off
          c.m.visible = s > 0.02;
          c.m.position.set(x, y, Z0 + L * LH);
          c.m.scale.set(s, s, s);
          var isLate = c.m.material === late;
          if (isLate) late.emissiveIntensity = 0.35 + 0.35 * Math.sin(t * 6);
          c.ghosts.forEach(function (g, k2) {
            var q = place(lane, L, id, t - 0.06 * (k2 + 1));
            if (p.y <= 0.001 || q.col < 0 || q.col > C - 1) return;
            g.visible = true;
            g.position.set(X0 + q.col * CW, 0.03 + q.y, Z0 + L * LH);
          });
        }
        var since = tt - n * HOP - AIR;                       // ripple after each landing
        var r = since > 0 ? Math.min(1, since / 0.6) : 1;
        lane.rmat.opacity = 0.7 * (1 - r);
        var lead = place(lane, L, Math.ceil((n + (L % 2) - C + 1) / 2), t).col;   // the front card that just landed
        lane.ring.position.set(X0 + Math.max(0, Math.min(C - 1, Math.round(lead))) * CW, 0.01, Z0 + L * LH);
        lane.ring.scale.set(1 + 1.4 * r, 1 + 1.4 * r, 1);
      });
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
