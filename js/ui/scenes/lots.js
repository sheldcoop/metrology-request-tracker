/**
 * Metrology Request Tracker - js/ui/scenes/lots.js
 *
 * Lots card scene: a lot is a stack of panels in a cassette. Six panels
 * slide into their slots one after the other, the cassette holds full for
 * a moment, then the lot moves on (all slide out sideways) and the next one loads.
 * Panels in the card colour with scene-ink edges, cassette frame in the
 * line colour. Solid lit meshes, transparent background, no shadows.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('lots', function create(ctx) {
  'use strict';
  var T = ctx.T, COUNT = 6, LOOP = 9, GAP = 0.2;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(1.3, 1.5, 3.8);
  camera.lookAt(0, 0.05, 0);

  scene.add(new T.HemisphereLight(0xffffff, new T.Color(ctx.tokens.surface), 0.75));
  var key = new T.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 5, 4);
  scene.add(key);

  var frame = new T.LineSegments(
    new T.EdgesGeometry(new T.BoxGeometry(2, GAP * COUNT + 0.12, 1.3)),
    new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.line), transparent: true, opacity: 0.8 }));
  scene.add(frame);

  var panelGeo = new T.BoxGeometry(1.8, 0.05, 1.15);
  var edgeGeo = new T.EdgesGeometry(panelGeo);
  var panelMat = new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.6, metalness: 0.2 });
  var edgeMat = new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  var panels = [], i;
  for (i = 0; i < COUNT; i++) {
    var p = new T.Mesh(panelGeo, panelMat);
    p.add(new T.LineSegments(edgeGeo, edgeMat));
    p.position.y = (i - (COUNT - 1) / 2) * GAP;
    scene.add(p);
    panels.push(p);
  }

  function ease(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var s = ((t % LOOP) + LOOP) % LOOP, out = ease((s - 7.6) / 0.9), k;
      for (k = 0; k < COUNT; k++) {
        var load = ease((s - 0.3 - k * 0.9) / 0.7);          // bottom slot first
        panels[k].position.z = -3.2 * (1 - load);
        panels[k].position.x = 3.6 * out;                    // the lot moves on
        panels[k].visible = load > 0 && out < 1;
      }
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
