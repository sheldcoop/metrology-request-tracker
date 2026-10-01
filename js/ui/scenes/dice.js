/**
 * Metrology Request Tracker - js/ui/scenes/dice.js
 *
 * Help card scene: one die turning slowly, one slow revolution per 7.5 s
 * loop. One focal event per loop: the top pip glows, the "answer".
 * Solid lit meshes, no textures, no shadows.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('dice', function create(ctx) {
  'use strict';
  var T = ctx.T, LOOP = 7.5, HALF = 0.55;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 1.4, 3.4);
  camera.lookAt(0, 0, 0);

  scene.add(new T.HemisphereLight(0xffffff, 0x0a1a2e, 0.7));
  var key = new T.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 5, 4);
  scene.add(key);

  var die = new T.Group();
  die.position.y = 0.1;
  scene.add(die);

  var cube = new T.Mesh(
    new T.BoxGeometry(1.1, 1.1, 1.1),
    new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.4, metalness: 0.25 }));
  die.add(cube);

  var pipMat = new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.line), roughness: 0.5 });
  var answerMat = new T.MeshStandardMaterial({
    color: new T.Color(ctx.tokens.accent),
    emissive: new T.Color(ctx.tokens.accent), emissiveIntensity: 0.4, roughness: 0.5
  });

  function pip(mat, x, y, z, flat) {
    var m = new T.Mesh(new T.SphereGeometry(0.07, 12, 10), mat);
    m.position.set(x, y, z);
    m.scale.set(flat === 'x' ? 0.35 : 1, flat === 'y' ? 0.35 : 1, flat === 'z' ? 0.35 : 1);
    die.add(m);
  }
  pip(answerMat, 0, HALF, 0, 'y');                       // the answer, on top
  pip(pipMat, -0.22, 0.12, HALF, 'z');                   // two in front
  pip(pipMat, 0.22, -0.12, HALF, 'z');
  pip(pipMat, HALF, 0.22, -0.22, 'x');                   // three on the side
  pip(pipMat, HALF, 0, 0, 'x');
  pip(pipMat, HALF, -0.22, 0.22, 'x');

  // Soft grounding disc so the die sits in the card, not in space.
  var disc = new T.Mesh(
    new T.CircleGeometry(0.85, 28),
    new T.MeshBasicMaterial({ color: new T.Color('#000000'), transparent: true, opacity: 0.35 }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -0.75;
  scene.add(disc);

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var p = ((t % LOOP) + LOOP) % LOOP / LOOP;
      die.rotation.y = t * 2 * Math.PI / LOOP;   // one calm turn per loop
      die.rotation.x = 0.3 * Math.sin(t * 2 * Math.PI / (LOOP * 2));
      die.position.y = 0.1 + 0.05 * Math.sin(t * 1.1);
      var d = (p - 0.6) / 0.05;                  // the answer lights up
      answerMat.emissiveIntensity = 0.4 + 2.2 * Math.exp(-d * d);
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
