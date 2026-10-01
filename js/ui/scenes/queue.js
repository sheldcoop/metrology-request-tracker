/**
 * Metrology Request Tracker - js/ui/scenes/queue.js
 *
 * Queue card scene: three tool lanes, one request block travelling the
 * middle lane per 9 s loop. It flashes bright as it arrives, then a new
 * one starts dim. Solid lit meshes, no textures, no shadows.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('queue', function create(ctx) {
  'use strict';
  var T = ctx.T, LOOP = 9;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 2.4, 3.2);
  camera.lookAt(0, 0, 0);

  scene.add(new T.HemisphereLight(0xffffff, 0x0a1a2e, 0.7));
  var key = new T.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 5, 4);
  scene.add(key);

  var laneMat = new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.85, metalness: 0.1 });
  [-0.6, 0, 0.6].forEach(function (z) {
    var lane = new T.Mesh(new T.BoxGeometry(3.0, 0.06, 0.34), laneMat);
    lane.position.set(0, -0.03, z);
    scene.add(lane);
  });

  var blockMat = new T.MeshStandardMaterial({
    color: new T.Color(ctx.tokens.accent),
    emissive: new T.Color(ctx.tokens.bright), emissiveIntensity: 0.25, roughness: 0.55
  });
  var block = new T.Mesh(new T.BoxGeometry(0.4, 0.22, 0.26), blockMat);
  block.position.y = 0.11;
  scene.add(block);

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var p = ((t % LOOP) + LOOP) % LOOP / LOOP;
      block.position.x = -1.3 + 2.6 * p;        // one calm trip down the lane
      var d = (p - 0.92) / 0.05;               // arrival flash, then restart
      blockMat.emissiveIntensity = 0.25 + 2.4 * Math.exp(-d * d);
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
