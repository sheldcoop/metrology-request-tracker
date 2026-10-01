/**
 * Metrology Request Tracker - js/ui/scenes/aoi.js
 *
 * Lab-status card scene: an AOI camera glides over a panel while a scan
 * line sweeps it. One focal event per 9 s loop: a defect dot flashes red
 * as the scan passes it. Solid lit meshes, no textures, no shadows.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('aoi', function create(ctx) {
  'use strict';
  var T = ctx.T, LOOP = 9;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 2.6, 3.4);
  camera.lookAt(0, 0.1, 0);

  scene.add(new T.HemisphereLight(0xffffff, 0x0a1a2e, 0.7));
  var key = new T.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 5, 4);
  scene.add(key);

  var matOpts = function (color, extra) {
    var o = { color: new T.Color(color), roughness: 0.65, metalness: 0.15 };
    if (extra) for (var k in extra) o[k] = extra[k];
    return new T.MeshStandardMaterial(o);
  };

  // The panel under inspection.
  var panel = new T.Mesh(new T.BoxGeometry(3.2, 0.08, 1.8), matOpts(ctx.tokens.surface, { roughness: 0.85 }));
  panel.position.y = -0.04;
  scene.add(panel);

  // Two faint circuit traces on the panel.
  var traceMat = matOpts(ctx.tokens.line, { roughness: 0.5 });
  [-0.45, 0.45].forEach(function (z) {
    var trace = new T.Mesh(new T.BoxGeometry(2.6, 0.012, 0.05), traceMat);
    trace.position.set(0, 0.006, z);
    scene.add(trace);
  });

  // The camera rig: body, lens barrel, glowing front ring.
  var rig = new T.Group();
  var body = new T.Mesh(new T.BoxGeometry(0.5, 0.3, 0.5), matOpts(ctx.tokens.line, { roughness: 0.4, metalness: 0.5 }));
  rig.add(body);
  var lens = new T.Mesh(new T.CylinderGeometry(0.12, 0.16, 0.28, 20), matOpts('#101820', { roughness: 0.35 }));
  lens.position.y = -0.28;
  rig.add(lens);
  var ringMat = new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent) });
  var ring = new T.Mesh(new T.TorusGeometry(0.13, 0.022, 10, 28), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.42;
  rig.add(ring);
  rig.position.y = 1.15;
  scene.add(rig);

  // The scan line sweeping the panel under the rig.
  var scanMat = new T.MeshBasicMaterial({
    color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.5
  });
  var scan = new T.Mesh(new T.PlaneGeometry(0.07, 1.7), scanMat);
  scan.rotation.x = -Math.PI / 2;
  scan.position.y = 0.015;
  scene.add(scan);

  // The defect: one small dot that flashes as the scan passes.
  var defectMat = matOpts(ctx.tokens.danger, { emissive: new T.Color(ctx.tokens.danger), emissiveIntensity: 0.25 });
  var defect = new T.Mesh(new T.SphereGeometry(0.05, 14, 12), defectMat);
  defect.position.set(0.55, 0.03, 0.2);
  scene.add(defect);

  ctx.onResize(function (w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  function smooth(x) { return x * x * (3 - 2 * x); }

  return {
    scene: scene,
    camera: camera,
    update: function (dt, t) {
      var p = ((t % LOOP) + LOOP) % LOOP / LOOP;
      var tri = p < 0.5 ? p * 2 : 2 - p * 2;   // glide there and back, calm
      var x = -1.1 + 2.2 * smooth(tri);
      rig.position.x = x;
      rig.position.y = 1.15 + 0.03 * Math.sin(t * 1.4);
      scan.position.x = x;
      var d = (p - 0.55) / 0.045;              // one red flash per loop
      defectMat.emissiveIntensity = 0.25 + 2.2 * Math.exp(-d * d);
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
