/**
 * Metrology Request Tracker - js/ui/scenes/hirata.js
 *
 * Hirata card scene (HOME-18 "the code assembles"): a hundred dots swirl
 * in a spinning galaxy, then fly in one after another and snap into a
 * 10 x 10 panel dot code - code dots bright, the rest faint. A scan beam
 * sweeps the code, it flashes as read with a shock ring, holds, then
 * bursts back out into the swirl and the next panel's code assembles.
 * Cool first (HOME-15). Faster on hover (engine clock). Transparent
 * background.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('hirata', function create(ctx) {
  'use strict';
  var T = ctx.T, N = 10, PITCH = 0.15, LOOP = 8, HALF = (N - 1) * PITCH / 2;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 0.6, 3.8);
  camera.lookAt(0, 0, 0);

  var sys = new T.Group();
  sys.position.set(0.6, -0.05, 0);
  scene.add(sys);

  var onMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  var offMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.line), transparent: true, opacity: 0.7 });
  var dotGeo = new T.BoxGeometry(0.075, 0.075, 0.075);
  var dots = [], i;
  for (i = 0; i < N * N; i++) {
    var d = new T.Mesh(dotGeo, i % 2 ? onMat : offMat);
    sys.add(d);
    dots.push({ m: d, gx: -HALF + (i % N) * PITCH, gy: HALF - Math.floor(i / N) * PITCH,
      orbit: 0.6 + (i * 0.6180339) % 1 * 0.75, ang: i * 2.39996, lift: ((i * 0.37) % 1 - 0.5) * 0.5 });
  }

  var beamMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0 });
  var beam = new T.Mesh(new T.BoxGeometry(0.025, N * PITCH + 0.25, 0.025), beamMat);
  sys.add(beam);
  var frameMat = new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0 });
  var frame = new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(N * PITCH + 0.12, N * PITCH + 0.12)), frameMat);
  sys.add(frame);
  var shockMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0 });
  var shock = new T.Mesh(new T.TorusGeometry(0.8, 0.012, 6, 64), shockMat);
  sys.add(shock);

  /* The code of read number n: a finder L, timing edges, data dots. */
  function bit(n, k) {
    var row = Math.floor(k / N), col = k % N;
    if (col === 0 || row === N - 1) return true;
    if (row === 0) return col % 2 === 0;
    if (col === N - 1) return row % 2 === 1;
    var x = Math.sin((k + 1) * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x) > 0.5;
  }

  function seg(s, a, b) { return Math.max(0, Math.min(1, (s - a) / (b - a))); }
  function smooth(x) { return x * x * (3 - 2 * x); }

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var n = Math.floor(t / LOOP), s = t - n * LOOP;
      var read = seg(s, 2.6, 3.8), flash = s > 3.8 ? Math.exp(-(s - 3.8) * 4) : 0;
      sys.rotation.y = 0.35 * Math.sin(t * 0.4);
      sys.rotation.x = 0.12 * Math.sin(t * 0.3);
      dots.forEach(function (d, k) {
        var on = bit(n, k);
        var a = d.ang + t * (0.9 + 0.3 * (k % 3)), ox = d.orbit * Math.cos(a) * 1.25, oy = d.orbit * Math.sin(a) * 0.55 + d.lift;
        var oz = d.orbit * Math.sin(a) * 0.6;
        var stag = (k % N + Math.floor(k / N)) / (2 * N - 2) * 0.9;
        var inn = smooth(seg(s, 0.3 + stag, 1.3 + stag)), out = smooth(seg(s, 6.6, 7.6)), g = inn * (1 - out);
        d.m.position.set(ox + (d.gx - ox) * g, oy + (d.gy - oy) * g, oz * (1 - g));
        d.m.rotation.set(t * 2 * (1 - g) + k, t * 1.5 * (1 - g), 0);
        d.m.material = on || g < 0.95 ? onMat : offMat;
        var lit = on && d.gx <= -HALF + read * (2 * HALF + 0.1) && read > 0 && s < 6.6;
        var sc = (g < 0.95 ? 0.7 : (on ? 1 : 0.6)) * (lit ? 1.15 + 0.5 * flash : 1);
        d.m.scale.set(sc, sc, sc);
      });
      var sweeping = read > 0 && read < 1;
      beamMat.opacity = sweeping ? 0.85 : 0;
      beam.position.set(-HALF - 0.05 + read * (2 * HALF + 0.1), 0, 0.06);
      frameMat.opacity = s > 1.6 && s < 6.6 ? 0.35 + 0.6 * flash : 0;
      shockMat.opacity = 0.8 * flash;
      var r = 1 + (1 - flash) * 1.2;
      shock.scale.set(r, r, 1);
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
