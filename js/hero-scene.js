// ============================================================
// HERO 3D SCENE: a glowing sphere of dots that ripples like a voice.
// Only loaded by main.js when: WebGL works, the visitor has NOT asked
// for reduced motion, and the page has finished loading.
// ============================================================

import * as THREE from 'three';

const ACCENT = new THREE.Color('#3ddbb4'); // keep in sync with --accent in styles.css

export function startHeroScene(container, { lowPower }) {
  // ---------- Renderer: draws the scene into a <canvas> ----------
  const renderer = new THREE.WebGLRenderer({
    antialias: !lowPower,           // smoothing costs GPU time, skip it on weak devices
    alpha: true,                    // transparent background so the CSS gradient shows through
    powerPreference: 'low-power',   // ask laptops to use the battery-friendly GPU
  });
  // Pixel ratio = how many real pixels per CSS pixel. Phones report 3, which is
  // 9x the work of 1. Capping it saves a lot of battery with little visible loss.
  const maxRatio = lowPower ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxRatio));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 4.2;

  // ---------- Geometry: N dots spread evenly over a sphere ----------
  const count = lowPower ? 2200 : 6000; // fewer dots on weak devices
  const positions = new Float32Array(count * 3); // x, y, z for every dot
  const randoms = new Float32Array(count);       // a random 0-1 per dot, for variety
  const golden = Math.PI * (3 - Math.sqrt(5));   // the "golden angle"

  for (let i = 0; i < count; i++) {
    // Fibonacci sphere: walk from top (y=1) to bottom (y=-1),
    // turning by the golden angle each step. Gives near-perfect spacing.
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = golden * i;
    positions[i * 3] = Math.cos(theta) * radius;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(theta) * radius;
    randoms[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

  // ---------- Material: custom shaders that run on the GPU ----------
  // "Uniforms" are values we send from JS to the shader every frame.
  const uniforms = {
    uTime: { value: 0 },
    uLevel: { value: 0 },   // 0 = silent, 1 = loud syllable
    uColor: { value: ACCENT },
    uPixelRatio: { value: renderer.getPixelRatio() },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending, // overlapping dots add up = glow
    // Vertex shader: runs once per dot, decides WHERE it goes and how big it is.
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uLevel;
      uniform float uPixelRatio;
      attribute float aRandom;
      varying float vGlow;

      void main() {
        vec3 p = position;
        float angle = atan(p.z, p.x);

        // Two waves: one rolls top-to-bottom, one spins around the middle.
        float wave = sin(p.y * 9.0 - uTime * 3.2) * 0.55
                   + sin(angle * 5.0 + uTime * 2.1) * 0.45;

        // Push the dot outward along its direction from the center.
        float push = (wave * 0.09 + aRandom * 0.03) * uLevel;
        p += normalize(position) * push;

        // Brighter where the wave is high.
        vGlow = 0.5 + 0.5 * clamp(0.5 + wave * uLevel * 0.6, 0.0, 1.0);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        // Dots farther from the camera are drawn smaller (perspective).
        gl_PointSize = (2.6 + aRandom * 2.4) * uPixelRatio * (4.0 / -mv.z);
      }
    `,
    // Fragment shader: runs per pixel of each dot, decides its COLOR.
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vGlow;

      void main() {
        // Turn the square point into a soft round dot.
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, d) * vGlow;
        gl_FragColor = vec4(uColor * vGlow, alpha);
      }
    `,
  });

  const sphere = new THREE.Points(geometry, material);
  scene.add(sphere);

  // ---------- Sizing: match the canvas to its container ----------
  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); // false = let CSS control the displayed size
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Desktop: sphere sits to the right of the headline. Phone: centered behind it.
    const wide = w >= 900;
    sphere.position.set(wide ? 1.35 : 0, wide ? 0 : 0.35, 0);
    sphere.scale.setScalar(wide ? 1.15 : 1.0);
  }
  new ResizeObserver(resize).observe(container);
  resize();

  // ---------- Fake "voice" envelope ----------
  // Real speech comes in bursts (syllables) with short pauses.
  // Multiplying slow and fast sine waves imitates that rhythm.
  function voiceLevel(t) {
    const phrase = Math.max(0, Math.sin(t * 0.9)) ** 0.6;          // talking vs pausing
    const syllables = 0.55 + 0.45 * Math.abs(Math.sin(t * 6.3) * Math.sin(t * 2.7 + 1.3));
    return 0.25 + 0.75 * phrase * syllables;                        // never fully still
  }

  // ---------- Render loop with pausing ----------
  const clock = new THREE.Clock();
  let running = false;
  let heroVisible = true;
  let level = 0;
  let t = 0; // our own time counter, so pausing doesn't make the waves jump

  // Low-power devices draw at most 30 frames per second instead of 60: half the work,
  // and a slow, subtle background looks the same either way.
  const minFrameMs = lowPower ? 1000 / 30 : 0;
  let lastDraw = 0;

  function frame(now) {
    if (!running) return;
    if (now - lastDraw < minFrameMs) {
      requestAnimationFrame(frame); // too soon, skip this frame
      return;
    }
    lastDraw = now;
    // getDelta = seconds since last frame. Capped so a lag spike can't cause a big jump.
    t += Math.min(clock.getDelta(), 0.1);
    // Ease toward the target level so it pulses smoothly instead of jittering.
    level += (voiceLevel(t) - level) * 0.08;
    uniforms.uTime.value = t;
    uniforms.uLevel.value = level;
    sphere.rotation.y = t * 0.08;
    sphere.rotation.x = Math.sin(t * 0.2) * 0.15;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function play() {
    if (running) return;
    running = true;
    clock.getDelta(); // throw away the time that passed while paused
    requestAnimationFrame(frame);
  }
  function pause() {
    running = false;
  }
  // Only run when the hero is on screen AND the browser tab is visible.
  function updateRunning() {
    if (heroVisible && !document.hidden) play();
    else pause();
  }

  // IntersectionObserver tells us when the hero scrolls in or out of view.
  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
    updateRunning();
  }).observe(container);
  document.addEventListener('visibilitychange', updateRunning);

  updateRunning();
  // Fade the canvas in (CSS transition on .is-ready) after the first frame is drawn.
  requestAnimationFrame(() => renderer.domElement.classList.add('is-ready'));
}
