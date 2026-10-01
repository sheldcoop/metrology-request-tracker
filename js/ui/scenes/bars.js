/**
 * Metrology Request Tracker - js/ui/scenes/bars.js
 *
 * Analytics card scene: a signal wave rolling up and down behind the card -
 * one accent trace with a faint echo, amplitude breathing slowly between
 * calm and lively (the engine gives scenes no hover state, so the wave
 * carries its own slow swell instead). Transparent background: the card
 * shows through. Solid lines, no textures, no shadows.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('bars', function create(ctx) {
  'use strict';
  var T = ctx.T, N = 65, HALF_W = 1.7;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 0.35, 3.6);
  camera.lookAt(0, 0.35, 0);

  function trace(color, opacity, width) {
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(N * 3);
    var i;
    for (i = 0; i < N; i++) {
      pos[i * 3] = -HALF_W + (2 * HALF_W * i) / (N - 1);
      pos[i * 3 + 1] = 0.35;
      pos[i * 3 + 2] = 0;
    }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    var line = new T.Line(geo, new T.LineBasicMaterial({
      color: new T.Color(color), transparent: true, opacity: opacity }));
    line.position.z = width;
    line.frustumCulled = false;
    scene.add(line);
    return geo;
  }

  var main = trace(ctx.tokens.accent, 0.95, 0);
  var echo = trace(ctx.tokens.line, 0.5, -0.08);

  function roll(geo, t, amp, speed, phase) {
    var pos = geo.attributes.position, i, x;
    for (i = 0; i < N; i++) {
      x = pos.getX(i);
      pos.setY(i, 0.35 + amp * (Math.sin(x * 1.7 + t * speed + phase) +
                                0.45 * Math.sin(x * 3.1 - t * speed * 0.7 + phase * 2)));
    }
    pos.needsUpdate = true;
  }

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var swell = 0.16 * (0.65 + 0.35 * Math.sin(t * 0.35));   // calm <-> lively
      roll(main, t, swell, 1.1, 0);
      roll(echo, t * 0.8, swell * 0.7, 0.9, 1.7);
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
