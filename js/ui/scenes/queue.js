/**
 * Metrology Request Tracker - js/ui/scenes/queue.js
 *
 * Queue card scene: three tool lanes, one glowing request block travelling
 * the middle lane with two fading echoes behind it. It hops lightly as it
 * arrives, flashes bright, then a new one starts dim. Solid lit meshes,
 * transparent background, no shadows.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('queue', function create(ctx) {
  'use strict';
  var T = ctx.T, LOOP = 9;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 2.4, 3.2);
  camera.lookAt(0, 0, 0);

  scene.add(new T.HemisphereLight(0xffffff, new T.Color(ctx.tokens.surface), 0.75));
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
  var ghostMat = function (op) {
    return new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: op });
  };
  var block = new T.Mesh(new T.BoxGeometry(0.4, 0.22, 0.26), blockMat);
  var echo1 = new T.Mesh(new T.BoxGeometry(0.4, 0.22, 0.26), ghostMat(0.22));
  var echo2 = new T.Mesh(new T.BoxGeometry(0.4, 0.22, 0.26), ghostMat(0.1));
  block.position.y = 0.11;
  scene.add(block); scene.add(echo1); scene.add(echo2);

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var p = ((t % LOOP) + LOOP) % LOOP / LOOP;
      var x = -1.3 + 2.6 * p;                  // one calm trip down the lane
      var hop = Math.exp(-Math.pow((p - 0.92) / 0.05, 2));   // arrival hop
      block.position.x = x;
      block.position.y = 0.11 + 0.12 * hop;
      echo1.position.set(x - 0.28, 0.11, 0);
      echo2.position.set(x - 0.56, 0.11, 0);
      blockMat.emissiveIntensity = 0.25 + 2.4 * hop;         // arrival flash
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
