(function () {
  "use strict";

  gsap.registerPlugin(ScrollTrigger);

  var YEARS = ["2016", "2017", "2018"];
  var ROW_HEIGHT = 64;

  var stage = document.getElementById("jtStage");
  var canvas = document.getElementById("jtCanvas");
  var track = document.getElementById("jtTrack");
  var yearRows = Array.prototype.slice.call(track.querySelectorAll(".jt-year"));
  var descEls = Array.prototype.slice.call(document.querySelectorAll(".jt-desc-text"));
  var progressEl = document.getElementById("jtProgress");

  // ================= placeholder textures =================
  // Temporary images only: a flat panel + big label, drawn on an
  // offscreen canvas so the test needs no external image files.
  function makePlaceholderTexture(label) {
    var c = document.createElement("canvas");
    c.width = 1024;
    c.height = 640;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#1c1c1c";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#3a3a3a";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, c.width - 6, c.height - 6);
    ctx.fillStyle = "#6e6e6e";
    ctx.font = "600 40px -apple-system, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PHOTO " + label, c.width / 2, c.height / 2);
    var tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  // ================= three.js scene =================
  var scene = new THREE.Scene();

  var camera = new THREE.PerspectiveCamera(
    45,
    stage.clientWidth / stage.clientHeight,
    0.1,
    100
  );
  camera.position.z = 5;

  var renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(stage.clientWidth, stage.clientHeight, false);

  var PLANE_W = 4;
  var PLANE_H = 2.5;
  var geometry = new THREE.PlaneGeometry(PLANE_W, PLANE_H, 1, 1);

  var vertexShader = [
    "varying vec2 vUv;",
    "void main() {",
    "  vUv = uv;",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
    "}"
  ].join("\n");

  var fragmentShader = [
    "uniform sampler2D map;",
    "uniform float opacity;",
    "uniform float blurAmount;",
    "varying vec2 vUv;",
    "void main() {",
    "  vec4 color = vec4(0.0);",
    "  float total = 0.0;",
    "  for (int x = -2; x <= 2; x++) {",
    "    for (int y = -2; y <= 2; y++) {",
    "      vec2 offset = vec2(float(x), float(y)) * blurAmount;",
    "      color += texture2D(map, vUv + offset);",
    "      total += 1.0;",
    "    }",
    "  }",
    "  color /= total;",
    "  gl_FragColor = vec4(color.rgb, color.a * opacity);",
    "}"
  ].join("\n");

  var planes = YEARS.map(function (label, i) {
    var material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: makePlaceholderTexture(label) },
        opacity: { value: i === 0 ? 1 : 0 },
        blurAmount: { value: 0 }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true
    });
    var mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = i === 0 ? 0 : -10;
    scene.add(mesh);
    return mesh;
  });

  // ================= single render loop =================
  function render() {
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  // ================= resize =================
  window.addEventListener("resize", function () {
    var w = stage.clientWidth;
    var h = stage.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  });

  // ================= timeline UI (continuous, distance-based) =================
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function clamp01(t) {
    return Math.max(0, Math.min(1, t));
  }

  // Piecewise-linear interpolation between the spec's discrete tiers
  // (active / ±1 / ±2 / beyond), driven every frame by the continuous
  // scroll progress so size and opacity never jump — they ease exactly
  // in step with the scrub.
  function styleForDistance(dRaw) {
    var d = Math.abs(dRaw);
    var size = d <= 1 ? lerp(42, 20, clamp01(d)) : 20;
    var opacity;
    if (d <= 1) opacity = lerp(1, 0.35, clamp01(d));
    else if (d <= 2) opacity = lerp(0.35, 0.16, clamp01(d - 1));
    else if (d <= 3) opacity = lerp(0.16, 0.08, clamp01(d - 2));
    else opacity = 0.08;
    return { size: size, opacity: opacity, weight: d < 0.5 ? 700 : 400 };
  }

  function updateTimeline(progress) {
    // progress: continuous 0..(YEARS.length-1)
    track.style.transform = "translateY(" + (-progress * ROW_HEIGHT) + "px)";

    yearRows.forEach(function (row, i) {
      var s = styleForDistance(i - progress);
      row.style.fontSize = s.size + "px";
      row.style.opacity = s.opacity;
      row.style.fontWeight = s.weight;
    });

    var activeIndex = Math.round(progress);
    descEls.forEach(function (el, i) {
      el.classList.toggle("is-active", i === activeIndex);
    });
  }

  updateTimeline(0);

  // ================= scroll-synced 3D depth transitions =================
  // One pinned scrub across the whole sequence; each year-to-year
  // handoff is one unit of timeline time. Outgoing and incoming planes
  // move through real z-depth simultaneously, tied 1:1 to scroll.
  var segments = YEARS.length - 1;
  var master = gsap.timeline({
    scrollTrigger: {
      trigger: stage,
      start: "top top",
      end: "+=" + segments * 100 + "%",
      scrub: true,
      pin: true,
      onUpdate: function (self) {
        var progress = self.progress * segments;
        updateTimeline(progress);
        var pct = Math.round(self.progress * 100);
        progressEl.textContent = "[" + (pct < 10 ? "0" + pct : pct) + "%]";
      }
    }
  });

  planes.forEach(function (mesh, i) {
    if (i === segments) return;
    var next = planes[i + 1];
    var t = i;

    // outgoing: active (z:0) accelerates through the camera and fades
    master.fromTo(mesh.position, { z: 0 }, {
      z: 5,
      duration: 1,
      ease: "none"
    }, t);
    master.fromTo(mesh.material.uniforms.opacity, { value: 1 }, {
      value: 0,
      duration: 1,
      ease: "none"
    }, t);

    // incoming: approaches from far (z:-10) to active (z:0), sharpening
    // and losing its faint tilt as it arrives
    master.fromTo(next.position, { z: -10 }, {
      z: 0,
      duration: 1,
      ease: "none"
    }, t);
    master.fromTo(next.material.uniforms.opacity, { value: 0 }, {
      value: 1,
      duration: 1,
      ease: "none"
    }, t);
    master.fromTo(next.rotation, { x: 0.02, y: -0.03 }, {
      x: 0,
      y: 0,
      duration: 1,
      ease: "none"
    }, t);
    master.fromTo(next.material.uniforms.blurAmount, { value: 0.006 }, {
      value: 0,
      duration: 1,
      ease: "none"
    }, t);
  });
})();
