/**
 * Metrology Request Tracker - js/ui/scenes/dice.js
 *
 * Help card scene: two dice with real faces (1-6 pips on canvas textures)
 * tumbling slowly side by side, faces in the card colour, pips in the
 * theme accent. Transparent background: the card shows through. One calm
 * turn each, counter-rotating. Solid lit meshes, canvas textures, no
 * shadows.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('dice', function create(ctx) {
  'use strict';
  var T = ctx.T;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 1.1, 4.2);
  camera.lookAt(0, 0, 0);

  scene.add(new T.HemisphereLight(0xffffff, new T.Color(ctx.tokens.surface), 0.75));
  var key = new T.DirectionalLight(0xffffff, 1.2);
  key.position.set(3, 5, 4);
  scene.add(key);

  /* One die face: the card colour with accent pips, drawn on canvas. */
  function face(count, bg, fg) {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = fg;
    var at = function (x, y) { g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill(); };
    var L = 34, C = 64, R = 94;
    if (count === 1) at(C, C);
    if (count === 2) { at(L, L); at(R, R); }
    if (count === 3) { at(L, L); at(C, C); at(R, R); }
    if (count === 4) { at(L, L); at(R, R); at(L, R); at(R, L); }
    if (count === 5) { at(L, L); at(R, R); at(L, R); at(R, L); at(C, C); }
    if (count === 6) { at(L, L); at(R, R); at(L, C); at(R, C); at(L, R); at(R, L); }
    var tex = new T.CanvasTexture(c);
    if ('colorSpace' in tex && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
    return new T.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.15 });
  }

  function die() {
    var mats = [1, 2, 3, 4, 5, 6].map(function (n) { return face(n, ctx.tokens.surface, ctx.tokens.accent); });
    var d = new T.Mesh(new T.BoxGeometry(1.15, 1.15, 1.15), mats);
    var edges = new T.LineSegments(
      new T.EdgesGeometry(d.geometry),
      new T.LineBasicMaterial({ color: new T.Color(ctx.tokens.line), transparent: true, opacity: 0.6 }));
    d.add(edges);
    return d;
  }

  var group = new T.Group();
  var d1 = die(), d2 = die();
  d1.position.x = -0.95;
  d2.position.x = 0.95;
  group.add(d1); group.add(d2);
  scene.add(group);

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      group.rotation.y = t * 0.35;                 // the pair turns, calm
      d1.rotation.x = t * 0.55; d1.rotation.y = t * 0.3;
      d2.rotation.x = -t * 0.45; d2.rotation.y = -t * 0.35;   // counter-tumble
      group.position.y = 0.06 * Math.sin(t * 0.9);
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
