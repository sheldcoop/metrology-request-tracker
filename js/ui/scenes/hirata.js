/**
 * Metrology Request Tracker - js/ui/scenes/hirata.js
 *
 * Hirata card scene (HOME-20 "the code drills itself"): a copper panel -
 * copper in every theme, like the real one (DECISIONS H-3) - flips in.
 * Glowing beads swirl around it, then drop one by one, column by column,
 * into a real Hirata code: the start column (all five) and nine digit
 * columns, dots weighted 8 / 4 / 2 / 1 over the always-on baseline. Each
 * bead lands with a flash and becomes a drilled hole; the engraved digits
 * fade in under the columns; a read bar sweeps across and lights each
 * column; then the holes pop back out into the swirl, the panel flips,
 * and the next code drills itself. Spare beads keep orbiting all along.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('hirata', function create(ctx) {
  'use strict';
  var T = ctx.T, COLS = 10, ROWS = 5, PX = 0.18, PY = 0.15, LOOP = 9, BEADS = 52, W = 2.1, H = 1.36;
  var WEIGHTS = [8, 4, 2, 1];
  var CODES = ['231140207', '240913112', '251027305', '260412018'];
  var CU = '#c9784a', CU_INK = '#3d1b0c', HOLE = '#141110';

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 0.3, 4.1);
  camera.lookAt(0, 0, 0);

  scene.add(new T.HemisphereLight(0xffffff, new T.Color('#3a2414'), 0.9));
  var key = new T.DirectionalLight(0xffffff, 1.4);
  key.position.set(-2, 3, 4);
  scene.add(key);

  var sys = new T.Group();
  sys.position.set(0.6, -0.05, 0);
  scene.add(sys);

  /* The copper face: brushed grain, drawn once. */
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  var grainC = canvas(256, 160), g = grainC.getContext('2d'), i;
  g.fillStyle = CU; g.fillRect(0, 0, 256, 160);
  for (i = 0; i < 160; i += 2) { g.fillStyle = i % 4 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; g.fillRect(0, i, 256, 1); }
  var grain = new T.CanvasTexture(grainC);
  var face = new T.MeshStandardMaterial({ map: grain, metalness: 0.55, roughness: 0.38 });
  var side = new T.MeshStandardMaterial({ color: new T.Color('#8f4a2c'), metalness: 0.5, roughness: 0.4 });
  var plate = new T.Group();
  plate.add(new T.Mesh(new T.BoxGeometry(W, H, 0.06), [side, side, side, side, face, side]));
  sys.add(plate);

  /* The engraved digits, redrawn for each code. */
  var digC = canvas(512, 64), dg = digC.getContext('2d');
  var digTex = new T.CanvasTexture(digC);
  var digMat = new T.MeshBasicMaterial({ map: digTex, transparent: true, opacity: 0 });
  var digits = new T.Mesh(new T.PlaneGeometry(W, W / 8), digMat);
  digits.position.set(0, -H / 2 + 0.17, 0.032);
  plate.add(digits);
  function engrave(code) {
    dg.clearRect(0, 0, 512, 64);
    dg.fillStyle = CU_INK;
    dg.font = 'bold 34px Consolas, monospace';
    dg.textAlign = 'center';
    for (var c = 1; c < COLS; c++) dg.fillText(code.charAt(c - 1), (colX(c) / W + 0.5) * 512, 44);
    digTex.needsUpdate = true;
  }

  function colX(c) { return -(COLS - 1) * PX / 2 + c * PX; }
  function rowY(r) { return H / 2 - 0.2 - r * PY; }
  /* The holes of a code: [{c, r}], start column first, column by column. */
  function holes(code) {
    var out = [], c, r;
    for (r = 0; r < ROWS; r++) out.push({ c: 0, r: r });
    for (c = 1; c < COLS; c++) {
      var d = Number(code.charAt(c - 1));
      WEIGHTS.forEach(function (w, k) { if (d & w) out.push({ c: c, r: k }); });
      out.push({ c: c, r: ROWS - 1 });                          // the baseline
    }
    return out;
  }

  var glow = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  var holeMat = new T.MeshBasicMaterial({ color: new T.Color(HOLE) });
  var beadGeo = new T.SphereGeometry(0.045, 12, 8);
  var beads = [];
  for (i = 0; i < BEADS; i++) {
    var b = new T.Mesh(beadGeo, i ? glow : holeMat);
    plate.add(b);                       // beads live in the panel's frame: holes stay on it as it turns
    beads.push({ m: b, rx: 1.25 + (i * 0.618) % 1 * 0.5, ry: 0.55 + (i * 0.37) % 1 * 0.35, sp: 0.6 + (i % 5) * 0.12, a0: i * 2.4 });
  }
  var flashMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0 });
  var flash = new T.Mesh(new T.TorusGeometry(0.07, 0.01, 6, 20), flashMat);
  flash.position.z = 0.04;
  plate.add(flash);
  var barMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0 });
  var bar = new T.Mesh(new T.BoxGeometry(0.03, ROWS * PY + 0.1, 0.02), barMat);
  bar.position.z = 0.05;
  plate.add(bar);

  function seg(s, a, b) { return Math.max(0, Math.min(1, (s - a) / (b - a))); }
  function smooth(x) { return x * x * (3 - 2 * x); }
  var shown = -1, list = [];

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var n = Math.floor(t / LOOP), s = t - n * LOOP, code = CODES[n % CODES.length];
      if (n !== shown) { shown = n; list = holes(code); engrave(code); }
      var flip = smooth(seg(s, 0, 0.6)) - smooth(seg(s, 8.4, 9));
      plate.rotation.set(0.12 * Math.sin(t * 0.5), (1 - flip) * Math.PI / 2 + 0.18 * Math.sin(t * 0.35), 0);
      var step = 2.9 / list.length, read = seg(s, 4.8, 6.6), out = seg(s, 7.6, 8.3);
      digMat.opacity = smooth(seg(s, 3.6, 4.4)) * (1 - out);
      barMat.opacity = read > 0 && read < 1 ? 0.9 : 0;
      bar.position.x = colX(0) - PX / 2 + read * COLS * PX;
      var lastLand = -1;
      beads.forEach(function (b, k) {
        var a = b.a0 + t * b.sp;
        var ox = b.rx * Math.cos(a), oy = b.ry * Math.sin(a) * 0.9, oz = 0.5 * Math.sin(a);
        var h = list[k], land = h ? smooth(seg(s, 0.7 + k * step, 0.7 + k * step + 0.35)) * (1 - smooth(out)) : 0;
        if (h && s > 0.7 + k * step + 0.35 && s < 7.6) lastLand = k;
        var tx = h ? colX(h.c) : 0, ty = h ? rowY(h.r) : 0;
        b.m.position.set(ox + (tx - ox) * land, oy + (ty - oy) * land, oz * (1 - land) + 0.035 * land);
        var lit = h && read > 0 && Math.abs(bar.position.x - colX(h.c)) < PX / 2;
        b.m.material = land > 0.98 && !lit ? holeMat : glow;
        var sc = land > 0.98 ? 1.15 : 0.8 + 0.2 * Math.sin(t * 3 + k);
        b.m.scale.set(sc, sc, land > 0.98 ? 0.4 : sc);
      });
      if (lastLand >= 0) {
        var hh = list[lastLand], since = s - (0.7 + lastLand * step + 0.35);
        flash.position.set(colX(hh.c), rowY(hh.r), 0.04);
        flashMat.opacity = since < 0.3 ? 0.9 * (1 - since / 0.3) : 0;
        var fs = 1 + 2 * Math.min(1, since / 0.3);
        flash.scale.set(fs, fs, 1);
      } else flashMat.opacity = 0;
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
