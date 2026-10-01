/**
 * Metrology Request Tracker - js/ui/scenes/new.js
 *
 * New-request card scene: a blank sheet rises, three request lines type
 * onto it one after another, then a plus badge flashes - the request
 * created. Sheet in the card colour, lines and badge in accent. Solid lit
 * meshes, transparent background, no shadows.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('new', function create(ctx) {
  'use strict';
  var T = ctx.T, LOOP = 8;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 1.6, 3.6);
  camera.lookAt(0, 0.2, 0);

  scene.add(new T.HemisphereLight(0xffffff, new T.Color(ctx.tokens.surface), 0.75));
  var key = new T.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 5, 4);
  scene.add(key);

  var form = new T.Group();
  scene.add(form);

  var sheet = new T.Mesh(
    new T.BoxGeometry(1.4, 0.06, 1.8),
    new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.7, metalness: 0.1 }));
  form.add(sheet);

  // Three request lines that type on as the sheet rises.
  var lineMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  var lines = [-0.5, -0.1, 0.3].map(function (z, i) {
    var geo = new T.BoxGeometry(1.0 - i * 0.25, 0.012, 0.07);
    geo.translate(-(1.0 - i * 0.25) / 2, 0, 0);   // type from the left
    var m = new T.Mesh(geo, lineMat);
    m.position.set(-0.5, 0.04, z);
    m.scale.x = 0.001;
    form.add(m);
    return m;
  });

  // The plus badge: two bars, glowing once per loop.
  var plusMat = new T.MeshStandardMaterial({
    color: new T.Color(ctx.tokens.accent),
    emissive: new T.Color(ctx.tokens.bright), emissiveIntensity: 0.3, roughness: 0.5
  });
  var plus = new T.Group();
  plus.add(new T.Mesh(new T.BoxGeometry(0.12, 0.12, 0.44), plusMat));
  plus.add(new T.Mesh(new T.BoxGeometry(0.44, 0.12, 0.12), plusMat));
  plus.position.set(0, 0.55, 0.45);
  plus.rotation.x = -0.4;
  form.add(plus);

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var p = ((t % LOOP) + LOOP) % LOOP / LOOP;
      form.position.y = -0.5 + 0.8 * smooth(p / 0.55);      // the sheet rises
      var i;
      for (i = 0; i < 3; i++) lines[i].scale.x = Math.max(0.001, smooth((p - 0.1 - i * 0.13) / 0.12));
      var d = (p - 0.78) / 0.05;                             // the badge: created
      plusMat.emissiveIntensity = 0.3 + 2.4 * Math.exp(-d * d);
      var pop = 1 + 0.25 * Math.exp(-d * d);
      plus.scale.set(pop, pop, pop);
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
