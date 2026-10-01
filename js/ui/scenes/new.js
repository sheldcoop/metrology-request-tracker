/**
 * Metrology Request Tracker - js/ui/scenes/new.js
 *
 * New-request card scene: a blank sheet rises and a plus badge flashes
 * once per 8 s loop - the request being created. Solid lit meshes, no
 * textures, no shadows.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('new', function create(ctx) {
  'use strict';
  var T = ctx.T, LOOP = 8;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 1.6, 3.6);
  camera.lookAt(0, 0.2, 0);

  scene.add(new T.HemisphereLight(0xffffff, 0x0a1a2e, 0.7));
  var key = new T.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 5, 4);
  scene.add(key);

  var sheet = new T.Mesh(
    new T.BoxGeometry(1.4, 0.06, 1.8),
    new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.7, metalness: 0.1 }));
  scene.add(sheet);

  // The plus badge: two bars, glowing once per loop.
  var plusMat = new T.MeshStandardMaterial({
    color: new T.Color(ctx.tokens.accent),
    emissive: new T.Color(ctx.tokens.bright), emissiveIntensity: 0.3, roughness: 0.5
  });
  var plus = new T.Group();
  var barV = new T.Mesh(new T.BoxGeometry(0.12, 0.12, 0.44), plusMat);
  var barH = new T.Mesh(new T.BoxGeometry(0.44, 0.12, 0.12), plusMat);
  plus.add(barV); plus.add(barH);
  plus.position.set(0, 0.5, 0.45);
  plus.rotation.x = -0.4;
  scene.add(plus);

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var p = ((t % LOOP) + LOOP) % LOOP / LOOP;
      var rise = p < 0.7 ? p / 0.7 : 1;           // the sheet rises, then rests
      sheet.position.y = -0.5 + 0.8 * rise;
      var d = (p - 0.75) / 0.05;                  // the badge flashes: created
      plusMat.emissiveIntensity = 0.3 + 2.4 * Math.exp(-d * d);
      plus.position.y = 0.5 + sheet.position.y * 0.4;
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
