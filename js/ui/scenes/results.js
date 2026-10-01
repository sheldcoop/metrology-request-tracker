/**
 * Metrology Request Tracker - js/ui/scenes/results.js
 *
 * Results card scene: a measured surface - a wireframe height map (one
 * bump, like a bump or via profile) with a ripple running out from the
 * centre, turning slowly. Hover raises the ripple (energy). Lines in the
 * scene ink, transparent background. Line segments only, no textures.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('results', function create(ctx) {
  'use strict';
  var T = ctx.T, N = 22, SIZE = 4.2, STEP = SIZE / (N - 1), HALF = SIZE / 2;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 2.3, 3.6);
  camera.lookAt(0, 0.15, 0);

  /* Grid lines along x and along z, two points per segment. */
  var segs = [], i, j;
  for (i = 0; i < N; i++) {
    for (j = 0; j < N - 1; j++) {
      segs.push([j, i, j + 1, i]);     // along x
      segs.push([i, j, i, j + 1]);     // along z
    }
  }
  var pos = new Float32Array(segs.length * 6);
  segs.forEach(function (s, k) {
    pos[k * 6] = -HALF + s[0] * STEP; pos[k * 6 + 2] = -HALF + s[1] * STEP;
    pos[k * 6 + 3] = -HALF + s[2] * STEP; pos[k * 6 + 5] = -HALF + s[3] * STEP;
  });
  var geo = new T.BufferGeometry();
  var attr = new T.BufferAttribute(pos, 3);
  geo.setAttribute('position', attr);
  var mesh = new T.LineSegments(geo, new T.LineBasicMaterial({
    color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.8 }));
  mesh.frustumCulled = false;
  var group = new T.Group();
  group.add(mesh);
  scene.add(group);

  function height(x, z, t, amp) {
    var r2 = x * x + z * z, r = Math.sqrt(r2);
    return 0.85 * Math.exp(-r2 / 1.1) + amp * Math.sin(t * 2.2 - r * 2.6) * Math.exp(-r2 / 6);
  }

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t, energy) {
      var amp = 0.07 + 0.16 * (energy || 0), k;
      for (k = 0; k < pos.length; k += 3) pos[k + 1] = height(pos[k], pos[k + 2], t, amp);
      attr.needsUpdate = true;
      group.rotation.y = t * 0.12;
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
