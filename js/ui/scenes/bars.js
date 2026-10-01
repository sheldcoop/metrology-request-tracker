/**
 * Metrology Request Tracker - js/ui/scenes/bars.js
 *
 * Analytics card scene: five bars breathing gently on a base plate. One
 * focal event per 9.5 s loop: the tallest bar flashes bright, then
 * settles. Solid lit meshes, no textures, no shadows.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('bars', function create(ctx) {
  'use strict';
  var T = ctx.T, LOOP = 9.5, COUNT = 5;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 1.7, 3.8);
  camera.lookAt(0, 0.6, 0);

  scene.add(new T.HemisphereLight(0xffffff, 0x0a1a2e, 0.7));
  var key = new T.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 5, 4);
  scene.add(key);

  var group = new T.Group();
  scene.add(group);

  var base = new T.Mesh(
    new T.BoxGeometry(3.0, 0.1, 1.1),
    new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.85, metalness: 0.1 }));
  base.position.y = -0.05;
  group.add(base);

  var barMat = new T.MeshStandardMaterial({
    color: new T.Color(ctx.tokens.accent), roughness: 0.55, metalness: 0.2,
    emissive: new T.Color(ctx.tokens.accent), emissiveIntensity: 0.15
  });
  var topMat = new T.MeshStandardMaterial({
    color: new T.Color(ctx.tokens.accent), roughness: 0.55, metalness: 0.2,
    emissive: new T.Color(ctx.tokens.bright), emissiveIntensity: 0.3
  });

  var baseH = [0.5, 0.9, 1.35, 1.0, 0.7];
  var bars = [];
  for (var i = 0; i < COUNT; i++) {
    var geo = new T.BoxGeometry(0.34, 1, 0.5);
    geo.translate(0, 0.5, 0);   // grow from the plate, never sink into it
    var bar = new T.Mesh(geo, i === 2 ? topMat : barMat);
    bar.position.set(-1.2 + i * 0.6, 0, 0);
    bar.scale.y = baseH[i];
    group.add(bar);
    bars.push(bar);
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
      for (var i = 0; i < COUNT; i++) {
        bars[i].scale.y = baseH[i] * (1 + 0.06 * Math.sin(t * 0.9 + i * 1.3));
      }
      var d = (p - 0.6) / 0.05;               // one bright flash per loop
      topMat.emissiveIntensity = 0.3 + 2.5 * Math.exp(-d * d);
      group.rotation.y = 0.1 * Math.sin(t * 2 * Math.PI / LOOP);
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
