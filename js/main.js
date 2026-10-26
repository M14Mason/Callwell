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
setupHeader();
setupMobileBar();
document.getElementById('year').textContent = new Date().getFullYear();

if (!reduceMotion) {
  playCallDemo();
  // The scroll animations are all below the first screen, so GSAP isn't needed until
  // the visitor scrolls. Waiting keeps the first seconds free for the important stuff.
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
// 2. Missed-revenue calculator
// ------------------------------------------------------------
function setupCalculator() {
  const form = document.getElementById('calc');
  const total = document.getElementById('calc-total');
  const WEEKS_PER_MONTH = 52 / 12; // about 4.33
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  let shown = 0;       // the number currently on screen
  let tweenId = 0;     // lets a new animation cancel an old one

  function update() {
    const calls = Number(form.elements.calls.value);
    const value = Number(form.elements.value.value);
    const rate = Number(form.elements.rate.value);

    // Show each slider's value next to its label
    document.getElementById('calls-val').textContent = calls;
    document.getElementById('value-val').textContent = money.format(value);
    document.getElementById('rate-val').textContent = rate + '%';

    // Color each slider's track up to the thumb (CSS reads --fill)
    for (const input of form.querySelectorAll('input[type="range"]')) {
      const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
      input.style.setProperty('--fill', pct + '%');
    }

    const target = calls * (rate / 100) * value * WEEKS_PER_MONTH;
    animateNumber(target);
  }

  // Count from the current number to the new one over 400ms.
  function animateNumber(target) {
    if (reduceMotion) {
      shown = target;
      total.textContent = money.format(target);
      return;
    }
    const from = shown;
    const start = performance.now();
    const id = ++tweenId;
    function step(now) {
      if (id !== tweenId) return; // a newer animation took over
      const t = Math.min(1, (now - start) / 400);
      const eased = 1 - Math.pow(1 - t, 3); // "ease out": fast, then slows down
      shown = from + (target - from) * eased;
      total.textContent = money.format(shown);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  form.addEventListener('input', update);                      // live update while dragging
  form.addEventListener('submit', (e) => e.preventDefault());  // Enter key: don't reload page
  shown = 4333; // matches the number already in the HTML, so the first load doesn't count up from 0
  update();
}

// ------------------------------------------------------------
// 3. Header: hide on scroll down, show on scroll up
// ------------------------------------------------------------
function setupHeader() {
  const header = document.getElementById('site-header');
  let lastY = window.scrollY;
  let ticking = false;

  window.addEventListener('scroll', () => {
    // requestAnimationFrame "throttle": run at most once per frame, no matter how
    // many scroll events fire. Scroll events can fire far more often than frames.
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 10);
      // Only hide after 400px, and never while the keyboard focus is inside the header.
      const goingDown = y > lastY;
      const hide = goingDown && y > 400 && !header.contains(document.activeElement);
      header.classList.toggle('is-hidden', hide);
      lastY = y;
      ticking = false;
    });
  }, { passive: true });
}

// ------------------------------------------------------------
// 4. Mobile call bar: appears once the hero buttons scroll off screen
// ------------------------------------------------------------
function setupMobileBar() {
  const bar = document.getElementById('mobile-bar');
  const heroCtas = document.getElementById('hero-ctas');
  // IntersectionObserver tells us when an element enters or leaves the screen.
  new IntersectionObserver(([entry]) => {
    const scrolledPast = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    bar.classList.toggle('is-visible', scrolledPast);
  }).observe(heroCtas);
}

// ------------------------------------------------------------
// 5. Live call demo in the hero card
// Shows each line one at a time, like a real call, then loops.
// ------------------------------------------------------------
function playCallDemo() {
  const card = document.getElementById('call-demo');
  const steps = [...card.querySelectorAll('[data-step]')];
  const timer = document.getElementById('call-timer');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Track whether the card is on screen. If not, the loop waits (saves battery).
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(card);
  const whenVisible = async () => { while (!visible || document.hidden) await sleep(400); };

  // Call timer: counts up mm:ss while the call is "live"
  let seconds = 0;
  let timerId;
  const tick = () => {
    seconds++;
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    timer.textContent = `${m}:${s}`;
  };

  card.classList.add('is-playing'); // CSS now hides the lines until we show them

  async function loop() {
    while (true) {
      await whenVisible();
      // Reset
      steps.forEach((s) => s.classList.remove('is-shown', 'is-typing'));
      seconds = 0;
      timer.textContent = '00:00';
      clearInterval(timerId);
      timerId = setInterval(tick, 1000);
      await sleep(700);

      for (const step of steps) {
        await whenVisible();
        const isAgent = step.classList.contains('msg--agent');
        if (isAgent) {
          // Show the bubble with "typing" dots first, then the words
          step.classList.add('is-shown', 'is-typing');
          await sleep(1100);
          step.classList.remove('is-typing');
        } else {
          step.classList.add('is-shown');
        }
        // Longer lines stay up longer before the next one, like real reading time
        await sleep(600 + step.textContent.trim().length * 22);
      }

      clearInterval(timerId);
      await sleep(4500); // hold the finished call so people can read it
    }
  }
  loop();
}

// ------------------------------------------------------------
// 6. GSAP scroll animations
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

    // a) Headlines: each word slides up out of its own mask, one after another.
    document.querySelectorAll('[data-split]').forEach((el) => {
      const words = splitWords(el, true);
      gsap.from(words, {
        yPercent: 110,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.06,
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      });
    });

    // b) Problem paragraph: words go from faint to solid as you scroll.
    //    "scrub" ties the animation to the scrollbar instead of a timer.
    const scrub = document.querySelector('[data-scrub]');
    if (scrub) {
      const words = splitWords(scrub, false);
      gsap.fromTo(words, { opacity: 0.15 }, {
        opacity: 1,
        stagger: 0.1,
        ease: 'none',
        scrollTrigger: { trigger: scrub, start: 'top 80%', end: 'bottom 45%', scrub: true },
      });
    }

    // c) How it works: the orange line fills as you scroll through the steps.
    gsap.fromTo('.how__progress-fill', { scaleY: 0 }, {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: '.how__steps', start: 'top 70%', end: 'bottom 60%', scrub: true },
    });

    // d) Lists fade up item by item.
    ['.steps', '.trades', '.specs', '.receipt__lines', '.faq'].forEach((selector) => {
      const list = document.querySelector(selector);
      if (!list) return;
      gsap.from(list.children, {
        opacity: 0,
        y: 28,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: { trigger: list, start: 'top 85%', once: true },
      });
    });

    // e) Feature icons "draw" themselves (see pathLength in the HTML).
    gsap.from('.spec__icon *', {
      strokeDashoffset: 1,
      duration: 1.2,
      ease: 'power2.inOut',
      stagger: 0.05,
      scrollTrigger: { trigger: '.specs', start: 'top 80%', once: true },
    });

    // f) Pricing receipt drops in with a slight tilt that straightens out.
    gsap.from('.receipt', {
      y: 60,
      rotate: -2,
      opacity: 0,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: { trigger: '.receipt', start: 'top 85%', once: true },
    });

    // g) Footer wordmark slides in from the right as the footer appears.
    gsap.from('.footer-mark', {
      xPercent: 15,
      ease: 'none',
      scrollTrigger: { trigger: '.site-footer', start: 'top bottom', end: 'bottom bottom', scrub: true },
    });
  } catch (err) {
    console.warn('Animations skipped:', err);
  }
}

// Wrap each word of an element in a <span> so GSAP can animate words separately.
// masked = true also wraps each word in a clipping "mask" span (for slide-up reveals).
function splitWords(el, masked) {
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = '';
  return words.map((word, i) => {
    const span = document.createElement('span');
    span.className = 'word';
    span.textContent = word;
    if (masked) {
      const mask = document.createElement('span');
      mask.className = 'word-mask';
      mask.appendChild(span);
      el.appendChild(mask);
    } else {
      el.appendChild(span);
    }
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    return span;
  });
}

// ------------------------------------------------------------
// 7. Three.js waveform, lazy loaded
// ------------------------------------------------------------
function scheduleHeroScene() {
  // Check for WebGL BEFORE downloading Three.js (~650 KB). No WebGL = keep the SVG fallback.
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
    // Any failure just leaves the static SVG showing.
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
