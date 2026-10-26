// ============================================================
// MAIN SCRIPT
// Runs after the HTML is parsed (type="module" scripts are deferred).
// Everything here is an "enhancement": if any of it fails, the page
// text and buttons still work, because they live in the HTML itself.
// ============================================================

import { CONFIG } from './config.js';

// Ask the OS once: did the visitor turn on "reduce motion"?
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

applyConfig();
setupCalculator();
document.getElementById('year').textContent = new Date().getFullYear();

if (!reduceMotion) {
  // The animated sections are below the first screen, so GSAP isn't needed until the
  // visitor scrolls. Waiting keeps the first few seconds free for the important stuff.
  // If the page opened already scrolled (refresh, #link), load it right away.
  if (window.scrollY > 0) setupScrollAnimations();
  else window.addEventListener('scroll', setupScrollAnimations, { once: true, passive: true });
  scheduleHeroScene();
}

// ------------------------------------------------------------
// 1. Fill the page with values from config.js
// ------------------------------------------------------------
function applyConfig() {
  // Format a number like 149 as "$149"
  const dollars = (n) => '$' + n.toLocaleString('en-US');

  // querySelectorAll finds every element with that attribute.
  document.querySelectorAll('[data-demo-number]').forEach((el) => {
    el.textContent = CONFIG.demoNumberDisplay;
  });
  document.querySelectorAll('[data-demo-link]').forEach((el) => {
    el.href = 'tel:' + CONFIG.demoNumberDial;
  });
  document.querySelectorAll('[data-booking-link]').forEach((el) => {
    el.href = CONFIG.bookingUrl;
  });
  document.querySelectorAll('[data-email]').forEach((el) => {
    el.textContent = CONFIG.email;
  });
  document.querySelectorAll('[data-email-link]').forEach((el) => {
    el.href = 'mailto:' + CONFIG.email;
  });
  // data-price="monthly" -> CONFIG.price.monthly, data-price="setup" -> CONFIG.price.setup
  document.querySelectorAll('[data-price]').forEach((el) => {
    const amount = CONFIG.price[el.dataset.price];
    if (typeof amount === 'number') el.textContent = dollars(amount);
  });
}

// ------------------------------------------------------------
// 2. Missed-revenue calculator (plain JS, runs on every keystroke)
// ------------------------------------------------------------
function setupCalculator() {
  const form = document.getElementById('calc');
  const output = document.getElementById('calc-total');
  const WEEKS_PER_MONTH = 52 / 12; // about 4.33

  // Read a field as a number. Empty or negative input counts as 0.
  const read = (name) => Math.max(0, Number(form.elements[name].value) || 0);

  function update() {
    const calls = read('calls');
    const value = read('value');
    const rate = Math.min(100, read('rate')) / 100; // 50 -> 0.5

    const monthlyLoss = calls * rate * value * WEEKS_PER_MONTH;

    // Intl.NumberFormat turns 4333.33 into "$4,333"
    output.textContent = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(monthlyLoss);
  }

  form.addEventListener('input', update);           // live update while typing
  form.addEventListener('submit', (e) => e.preventDefault()); // Enter key: don't reload page
  update();
}

// ------------------------------------------------------------
// 3. GSAP scroll animations
// Loaded with a dynamic import(), so the page never waits for GSAP.
// If the CDN is down, the catch() leaves everything visible.
// ------------------------------------------------------------
async function setupScrollAnimations() {
  try {
    const [{ gsap }, { ScrollTrigger }] = await Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
    ]);
    gsap.registerPlugin(ScrollTrigger);

    // Each group fades up, one item after another ("stagger"),
    // the first time it scrolls 85% of the way up the screen.
    const groups = ['.steps', '.features', '.trades'];
    groups.forEach((selector) => {
      const list = document.querySelector(selector);
      if (!list) return;
      gsap.from(list.children, {
        opacity: 0,
        y: 32,
        duration: 0.7,
        ease: 'power2.out',
        stagger: 0.12,
        scrollTrigger: { trigger: list, start: 'top 85%', once: true },
      });
    });
  } catch (err) {
    console.warn('Animations skipped:', err);
  }
}

// ------------------------------------------------------------
// 4. Three.js hero, lazy loaded
// ------------------------------------------------------------
function scheduleHeroScene() {
  // Check for WebGL BEFORE downloading Three.js (~650 KB). No WebGL = keep the CSS gradient.
  if (!hasWebGL()) return;

  const start = () => {
    // requestIdleCallback waits until the browser has nothing else to do.
    // Safari doesn't support it, so fall back to a short timeout.
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 300));
    idle(loadHero, { timeout: 2500 });
  };

  // Wait for the full page "load" event so the 3D never competes with text, CSS, or fonts.
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

async function loadHero() {
  try {
    const { startHeroScene } = await import('./hero-scene.js');
    startHeroScene(document.getElementById('hero-visual'), {
      lowPower: isLowPowerDevice(),
    });
  } catch (err) {
    // Any failure just leaves the static gradient showing.
    console.warn('3D hero skipped:', err);
  }
}

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

// Rough guess at "phone or weak computer". These signals aren't perfect,
// so we combine several. Any one of them = treat as low power.
function isLowPowerDevice() {
  const smallScreen = window.matchMedia('(max-width: 768px)').matches;
  const touchFirst = window.matchMedia('(pointer: coarse)').matches;
  const fewCores = (navigator.hardwareConcurrency || 4) <= 4;
  const lowMemory = (navigator.deviceMemory || 8) <= 4; // Chrome only; others report undefined
  return smallScreen || touchFirst || fewCores || lowMemory;
}
