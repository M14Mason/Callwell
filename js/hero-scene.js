// ============================================================
// HERO WAVEFORM: stacked horizontal lines that ripple like a voice
// on an oscilloscope. Center lines are orange, outer lines fade out.
// Only loaded by main.js when: WebGL works, the visitor has NOT asked
// for reduced motion, and the page has finished loading.
// ============================================================

import * as THREE from 'three';

// Keep in sync with --ink and --accent in styles.css
const INK = new THREE.Color('#15120e');
const ACCENT = new THREE.Color('#ff5b1f');

export function startHeroScene(container, { lowPower }) {
  // ---------- Renderer: draws into a <canvas> ----------
  const renderer = new THREE.WebGLRenderer({
    antialias: !lowPower,           // smoother lines, but costs GPU time on weak devices
    alpha: true,                    // transparent background so the paper color shows through
    powerPreference: 'low-power',   // ask laptops to use the battery-friendly GPU
  });
  // Pixel ratio = real pixels per CSS pixel. Phones report 3, which is 9x the work of 1.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // Our shader writes screen positions directly, so the camera is never actually used.
  // three.js just requires one to call render().
  const camera = new THREE.Camera();

  // ---------- Geometry: many short segments that form each line ----------
  const rows = lowPower ? 18 : 28;      // number of lines
  const points = lowPower ? 110 : 220;  // points per line (more = smoother curve)
  const segs = points - 1;

  // Each segment needs 2 vertices. Each vertex stores:
  //   position.x: where along the line it is (-1 = left edge, 1 = right edge)
  //   aRow:       which line it belongs to (0 = bottom, 1 = top)
  // The y position is calculated on the GPU every frame.
  const positions = new Float32Array(rows * segs * 2 * 3);
  const rowAttr = new Float32Array(rows * segs * 2);
  let v = 0;
  for (let r = 0; r < rows; r++) {
    const row = r / (rows - 1);
    for (let i = 0; i < segs; i++) {
      for (const k of [i, i + 1]) {
        positions[v * 3] = -1 + (2 * k) / segs;
        rowAttr[v] = row;
        v++;
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aRow', new THREE.BufferAttribute(rowAttr, 1));

  // "Uniforms" are values we send from JS to the shader every frame.
  const uniforms = {
    uTime: { value: 0 },
    uLevel: { value: 0 }, // 0 = silent, 1 = loud syllable
    uInk: { value: INK },
    uAccent: { value: ACCENT },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthTest: false,
    // Vertex shader: runs once per vertex and decides WHERE it goes.
    // The same math is used in Python to draw the static SVG fallback in index.html.
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uLevel;
      attribute float aRow;
      varying float vAlpha;
      varying float vAccent;

      void main() {
        float x = position.x;

        // Three sine waves at different speeds = an irregular, voice-like wiggle.
        float n = sin(x * 9.0  + uTime * 2.4 + aRow * 7.0)  * 0.5
                + sin(x * 17.0 - uTime * 3.1 + aRow * 13.0) * 0.3
                + sin(x * 31.0 + uTime * 4.7 + aRow * 3.0)  * 0.2;

        // Bell-curve "envelope": big wiggles in the middle, flat at the edges.
        // The center drifts slowly so it feels alive.
        float cx = x - 0.12 * sin(uTime * 0.3);
        float amp = exp(-pow(cx * 1.8, 2.0)) * (0.06 + 0.22 * uLevel);

        float baseY = mix(-0.85, 0.85, aRow); // spread rows from bottom to top
        float y = baseY + n * amp * (0.6 + 0.4 * sin(aRow * 20.0 + uTime));

        // center = 1 for the middle row, 0 for the top and bottom rows
        float center = 1.0 - abs(aRow - 0.5) * 2.0;
        vAccent = smoothstep(0.8, 0.95, center);     // only middle rows turn orange
        vAlpha = (0.14 + 0.55 * center)
               * smoothstep(1.0, 0.75, abs(x));      // fade out at the left and right edges

        // Clip space: x and y from -1 to 1 fill the canvas exactly.
        gl_Position = vec4(x, y, 0.0, 1.0);
      }
    `,
    // Fragment shader: decides each pixel's COLOR.
    fragmentShader: /* glsl */ `
      uniform vec3 uInk;
      uniform vec3 uAccent;
      varying float vAlpha;
      varying float vAccent;

      void main() {
        gl_FragColor = vec4(mix(uInk, uAccent, vAccent), vAlpha);
      }
    `,
  });

  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false; // three.js can't know where the shader moves things, so never skip drawing
  scene.add(lines);

  // ---------- Sizing: match the canvas to its container ----------
  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w && h) renderer.setSize(w, h, false); // false = let CSS control the displayed size
  }
  new ResizeObserver(resize).observe(container);
  resize();

  // ---------- Fake "voice" envelope ----------
  // Real speech comes in bursts (syllables) with short pauses.
  // Multiplying slow and fast sine waves imitates that rhythm.
  function voiceLevel(t) {
    const phrase = Math.max(0, Math.sin(t * 0.9)) ** 0.6;          // talking vs pausing
    const syllables = 0.55 + 0.45 * Math.abs(Math.sin(t * 6.3) * Math.sin(t * 2.7 + 1.3));
    return 0.2 + 0.8 * phrase * syllables;                          // never fully still
  }

  // ---------- Render loop with pausing ----------
  const clock = new THREE.Clock();
  let running = false;
  let onScreen = true;
  let level = 0;
  let t = 0; // our own time counter, so pausing doesn't make the waves jump

  // Low-power devices draw at most 30 frames per second instead of 60.
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
  // Only run when the waveform is on screen AND the browser tab is visible.
  function updateRunning() {
    if (onScreen && !document.hidden) play();
    else pause();
  }

  // IntersectionObserver tells us when the waveform scrolls in or out of view.
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    updateRunning();
  }).observe(container);
  document.addEventListener('visibilitychange', updateRunning);

  updateRunning();
  // Cross-fade: canvas fades in, SVG fallback fades out (CSS handles both).
  requestAnimationFrame(() => {
    renderer.domElement.classList.add('is-ready');
    container.classList.add('has-canvas');
  });
}
