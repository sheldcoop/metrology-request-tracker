/**
 * Metrology Request Tracker - js/ui/scenes/mine.js
 *
 * My-requests card scene: three stacked request plates; the middle one
 * slides out and back once per 8.5 s loop, its edge flashing as it
 * returns. Solid lit meshes, no textures, no shadows.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('mine', function create(ctx) {
  'use strict';
  var T = ctx.T, LOOP = 8.5;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 1.8, 3.6);
  camera.lookAt(0, 0.1, 0);

  scene.add(new T.HemisphereLight(0xffffff, 0x0a1a2e, 0.7));
  var key = new T.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 5, 4);
  scene.add(key);

  var plateMat = new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.7, metalness: 0.1 });
  var midMat = new T.MeshStandardMaterial({
    color: new T.Color(ctx.tokens.surface),
    emissive: new T.Color(ctx.tokens.accent), emissiveIntensity: 0.2, roughness: 0.7
  });

  var plates = [];
  [-0.16, 0, 0.16].forEach(function (y, i) {
    var m = new T.Mesh(new T.BoxGeometry(1.8, 0.12, 1.1), i === 1 ? midMat : plateMat);
    m.position.y = y;
    scene.add(m);
    plates.push(m);
  });

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var p = ((t % LOOP) + LOOP) % LOOP / LOOP;
      var out = p < 0.35 ? p / 0.35 : (p < 0.7 ? 1 - (p - 0.35) / 0.35 : 0);
      plates[1].position.x = 0.7 * out;          // slides out, then home
      var d = (p - 0.62) / 0.05;                // edge flashes as it returns
      midMat.emissiveIntensity = 0.2 + 2.2 * Math.exp(-d * d);
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
