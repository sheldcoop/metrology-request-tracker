/**
 * Metrology Request Tracker - js/ui/scenes/aoi.js
 *
 * Lab-status card scene: an AOI camera glides over a panel while a bright
 * scan band sweeps it with a fading trail; the circuit traces light as
 * the scan passes. One focal event per 9 s loop: a defect dot flashes red
 * under the scan. Solid lit meshes, transparent background, no shadows.
 */
window.MRT = window.MRT || {};
window.MRT.scene3d.register('aoi', function create(ctx) {
  'use strict';
  var T = ctx.T, LOOP = 9;

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(36, ctx.view.w / ctx.view.h, 0.1, 50);
  camera.position.set(0, 2.6, 3.4);
  camera.lookAt(0, 0.1, 0);

  scene.add(new T.HemisphereLight(0xffffff, new T.Color(ctx.tokens.surface), 0.75));
  var key = new T.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 5, 4);
  scene.add(key);

  // The panel under inspection.
  var panel = new T.Mesh(
    new T.BoxGeometry(3.2, 0.08, 1.8),
    new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.85, metalness: 0.1 }));
  panel.position.y = -0.04;
  scene.add(panel);

  // Circuit traces in segments that light as the scan passes over them.
  var traces = [];
  [-0.45, 0.45].forEach(function (z) {
    var i, m, seg;
    for (i = 0; i < 6; i++) {
      m = new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.line),
        emissive: new T.Color(ctx.tokens.accent), emissiveIntensity: 0, roughness: 0.5 });
      seg = new T.Mesh(new T.BoxGeometry(0.4, 0.012, 0.05), m);
      seg.position.set(-1.05 + i * 0.42, 0.006, z);
      scene.add(seg);
      traces.push({ mat: m, x: -1.05 + i * 0.42 });
    }
  });

  // The camera rig: body, dark lens barrel, glowing accent ring.
  var rig = new T.Group();
  rig.add(new T.Mesh(new T.BoxGeometry(0.5, 0.3, 0.5),
    new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.line), roughness: 0.4, metalness: 0.5 })));
  var lens = new T.Mesh(new T.CylinderGeometry(0.12, 0.16, 0.28, 20),
    new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.surface), roughness: 0.3, metalness: 0.4 }));
  lens.position.y = -0.28;
  rig.add(lens);
  var ring = new T.Mesh(new T.TorusGeometry(0.13, 0.022, 10, 28),
    new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent) }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.42;
  rig.add(ring);
  rig.position.y = 1.15;
  scene.add(rig);

  // The scan band with its fading trail.
  var scan = new T.Mesh(new T.PlaneGeometry(0.07, 1.7),
    new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.bright), transparent: true, opacity: 0.85 }));
  scan.rotation.x = -Math.PI / 2;
  scan.position.y = 0.015;
  scene.add(scan);
  var trail = new T.Mesh(new T.PlaneGeometry(0.5, 1.7),
    new T.MeshBasicMaterial({ color: new T.Color(ctx.tokens.accent), transparent: true, opacity: 0.18 }));
  trail.rotation.x = -Math.PI / 2;
  trail.position.y = 0.012;
  scene.add(trail);

  // The defect: one small dot that flashes as the scan passes.
  var defectMat = new T.MeshStandardMaterial({ color: new T.Color(ctx.tokens.danger),
    emissive: new T.Color(ctx.tokens.danger), emissiveIntensity: 0.25, roughness: 0.5 });
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
      var dir = p < 0.5 ? 1 : -1;
      var x = -1.1 + 2.2 * smooth(tri);
      rig.position.x = x;
      rig.position.y = 1.15 + 0.03 * Math.sin(t * 1.4);
      scan.position.x = x;
      trail.position.x = x - dir * 0.28;       // the trail follows behind
      var i;
      for (i = 0; i < traces.length; i++) {
        var near = Math.exp(-Math.pow((x - traces[i].x) / 0.35, 2));
        traces[i].mat.emissiveIntensity = 1.1 * near;
      }
      var d = (p - 0.55) / 0.045;              // one red flash per loop
      defectMat.emissiveIntensity = 0.25 + 2.4 * Math.exp(-d * d);
    },
    dispose: function () {
      while (scene.children.length) scene.remove(scene.children[0]);
    }
  };
});
