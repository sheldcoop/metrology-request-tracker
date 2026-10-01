/**
 * Metrology Request Tracker - js/ui/scenes/hirata.js
 *
 * Hirata card scene: a panel dot code being read. A 10 x 10 dot field on
 * a tilted plate; a scan bar sweeps across and the code's dots light up
 * in the scene ink as it passes; the read code holds, fades, and the next
 * panel's code is read. Solid meshes, transparent background, no shadows.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('hirata', function create(ctx) {
  'use strict';
  var T = ctx.T, N = 10, PITCH = 0.2, LOOP = 6, HALF = (N - 1) * PITCH / 2;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 2.1, 2.9);
  camera.lookAt(0, 0, 0);

  var plate = new T.Group();
  plate.rotation.x = -Math.PI / 2;
  scene.add(plate);

  var dotGeo = new T.CircleGeometry(0.06, 16);
  var offMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.line), transparent: true, opacity: 0.55 });
  var onMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  var dots = [], i, j;
  for (i = 0; i < N; i++) {
    for (j = 0; j < N; j++) {
      var d = new T.Mesh(dotGeo, offMat);
      d.position.set(-HALF + j * PITCH, -HALF + i * PITCH, 0);
      plate.add(d);
      dots.push(d);
    }
  }
  var bar = new T.Mesh(new T.PlaneGeometry(0.03, N * PITCH + 0.2),
    new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.7 }));
  bar.position.z = 0.01;
  plate.add(bar);

  /* The code of read number n: a fixed finder edge (L shape) plus data bits. */
  function bit(n, k) {
    var row = Math.floor(k / N), col = k % N;
    if (col === 0 || row === 0) return true;                         // finder L
    if (row === N - 1) return col % 2 === 0;                          // timing edge
    if (col === N - 1) return row % 2 === 1;
    var x = Math.sin((k + 1) * 12.9898 + n * 78.233) * 43758.5453;   // data dots
    return x - Math.floor(x) > 0.5;
  }

  var shown = -1;
  function paint(n) {
    if (n === shown) return;
    shown = n;
    dots.forEach(function (d, k) { d.userData = { on: bit(n, k) }; });
  }

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var n = Math.floor(t / LOOP), s = t - n * LOOP;
      paint(n);
      var sweep = Math.min(1, s / 2.6), x = -HALF - 0.15 + sweep * (2 * HALF + 0.3);
      var fade = s > 5 ? 1 - (s - 5) : 1;
      bar.position.x = x;
      bar.visible = sweep < 1;
      dots.forEach(function (d) {
        var lit = d.userData.on && d.position.x <= x;
        d.material = lit ? onMat : offMat;
        var sc = lit ? 0.7 + 0.5 * fade : 0.7;
        d.scale.set(sc, sc, 1);
      });
      plate.rotation.z = 0.12 * Math.sin(t * 0.25);
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
