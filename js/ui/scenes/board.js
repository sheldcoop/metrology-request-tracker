/**
 * Metrology Request Tracker - js/ui/scenes/board.js
 *
 * Board card scene: a 3 x 3 tile grid breathing in a slow ripple that
 * runs corner to corner, while the line-stop tile calls red once per
 * loop. Tiles in the card colour, stop tile in danger. Solid lit meshes,
 * transparent background, no shadows.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('board', function create(ctx) {
  'use strict';
  var T = ctx.T, LOOP = 8;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 2.6, 3.0);
  camera.lookAt(0, 0, 0);

  scene.add(new T.HemisphereLight(0xffffff, new T.Color(ctx.tokens.surface), 0.75));
  var key = new T.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 5, 4);
  scene.add(key);

  var tileMat = new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.55, metalness: 0.2 });
  var stopMat = new T.MeshStandardMaterial({
    color: new T.Color(ctx.tokens.danger),
    emissive: new T.Color(ctx.tokens.danger), emissiveIntensity: 0.3, roughness: 0.6
  });

  var tiles = [];
  var r, c, tile;
  for (r = 0; r < 3; r++) {
    for (c = 0; c < 3; c++) {
      tile = new T.Mesh(new T.BoxGeometry(0.5, 0.1, 0.5), (r === 0 && c === 0) ? stopMat : tileMat);
      tile.position.set(-0.7 + c * 0.7, 0, -0.7 + r * 0.7);
      scene.add(tile);
      tiles.push({ mesh: tile, phase: (r + c) * 0.9, stop: r === 0 && c === 0 });
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
      var i, e;
      for (i = 0; i < tiles.length; i++) {
        e = tiles[i];
        if (!e.stop) e.mesh.position.y = 0.045 * Math.sin(t * 1.1 - e.phase);   // the ripple
      }
      var d = (p - 0.5) / 0.06;                // the line stop calls once
      stopMat.emissiveIntensity = 0.3 + 2.4 * Math.exp(-d * d);
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
