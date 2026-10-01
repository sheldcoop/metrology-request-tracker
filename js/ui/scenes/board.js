/**
 * Metrology Request Tracker - js/ui/scenes/board.js
 *
 * Board card scene: a calm 3 x 3 tile grid; the line-stop tile pulses
 * red once per 8 s loop while the rest sit still. Solid lit meshes, no
 * textures, no shadows.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('board', function create(ctx) {
  'use strict';
  var T = ctx.T, LOOP = 8;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 2.4, 3.2);
  camera.lookAt(0, 0, 0);

  scene.add(new T.HemisphereLight(0xffffff, 0x0a1a2e, 0.7));
  var key = new T.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 5, 4);
  scene.add(key);

  var tileMat = new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.7, metalness: 0.1 });
  var stopMat = new T.MeshStandardMaterial({
    color: new T.Color(ctx.tokens.danger),
    emissive: new T.Color(ctx.tokens.danger), emissiveIntensity: 0.3, roughness: 0.6
  });

  for (var r = 0; r < 3; r++) {
    for (var c = 0; c < 3; c++) {
      var tile = new T.Mesh(new T.BoxGeometry(0.5, 0.1, 0.5), (r === 0 && c === 0) ? stopMat : tileMat);
      tile.position.set(-0.7 + c * 0.7, 0, -0.7 + r * 0.7);
      scene.add(tile);
    }
  }

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var p = ((t % LOOP) + LOOP) % LOOP / LOOP;
      var d = (p - 0.5) / 0.06;                // the line stop calls once
      stopMat.emissiveIntensity = 0.3 + 2.2 * Math.exp(-d * d);
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
