/**
 * Metrology Request Tracker - js/ui/scenes/mine.js
 *
 * My-requests card scene: three stacked request plates; the middle one
 * slides out and back once per loop, its accent edge stripe lighting as
 * it returns home. Plates in the card colour. Solid lit meshes,
 * transparent background, no shadows.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('mine', function create(ctx) {
  'use strict';
  var T = ctx.T, LOOP = 8.5;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 1.8, 3.6);
  camera.lookAt(0, 0.1, 0);

  scene.add(new T.HemisphereLight(0xffffff, new T.Color(ctx.tokens.surface), 0.75));
  var key = new T.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 5, 4);
  scene.add(key);

  var plateMat = new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.7, metalness: 0.1 });
  var midMat = new T.MeshStandardMaterial({
    color: new T.Color(ctx.tokens.surface),
    emissive: new T.Color(ctx.tokens.accent), emissiveIntensity: 0.15, roughness: 0.7
  });
  var edgeMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent) });

  var plates = [];
  [-0.16, 0, 0.16].forEach(function (y, i) {
    var m = new T.Mesh(new T.BoxGeometry(1.8, 0.12, 1.1), i === 1 ? midMat : plateMat);
    m.position.y = y;
    scene.add(m);
    plates.push(m);
  });
  var edge = new T.Mesh(new T.BoxGeometry(0.05, 0.13, 1.1), edgeMat);   // accent edge
  edge.position.set(0.9, 0, 0);
  plates[1].add(edge);

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
      var d = (p - 0.62) / 0.05;                // edge lights as it returns
      midMat.emissiveIntensity = 0.15 + 2.2 * Math.exp(-d * d);
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
