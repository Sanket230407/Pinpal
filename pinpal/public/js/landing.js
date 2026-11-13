// PinPal landing page: the live radar + scroll reveal.
// Plain JavaScript and the <canvas> API, no libraries.
(() => {
  // ---------- 1. Data: the people shown on the radar ----------
  // Each pin is placed with POLAR coordinates (like a real radar):
  //   angle = direction in degrees, dist = 0 (centre) to 1 (edge of radar).
  const PEOPLE = [
    { name: 'Aarav M.', initials: 'AM', color: '#ff4b5c', angle: 28,  dist: 0.52, note: 'cricket · 400 m' },
    { name: 'Diya S.',  initials: 'DS', color: '#1c9c8c', angle: 150, dist: 0.34, note: 'coding · 250 m' },
    { name: 'Kabir S.', initials: 'KS', color: '#5b8def', angle: 245, dist: 0.7,  note: 'music · 1.1 km' },
    { name: 'Ananya I.', initials: 'AI', color: '#f5a524', angle: 320, dist: 0.46, note: 'design · 600 m' },
    { name: 'Rohan P.', initials: 'RP', color: '#b06bf2', angle: 82,  dist: 0.8,  note: 'football · 1.6 km' },
    { name: 'Meera K.', initials: 'MK', color: '#ff7a59', angle: 200, dist: 0.88, note: 'hiking · 1.9 km' },
  ];
  const RING_LABELS = ['500 m', '1 km', '2 km']; // one label per ring, inner to outer
  const SWEEP_SPEED = 0.7;                       // radians per second
  const DRIFT_SPEED = 0.012;                     // how fast pins wander (radians per second)

  // ---------- 2. Logged-in users skip straight to the app ----------
  if (localStorage.getItem('pinpal_token')) {
    document.querySelectorAll('a[href="/register.html"], a[href="/login.html"]').forEach((a) => {
      a.href = '/app.html';
      if (/log in|account/i.test(a.textContent)) a.textContent = 'Open app';
    });
  }

  // ---------- 3. Scroll reveal ----------
  // Any element with data-reveal fades in when it scrolls into view.
  // Siblings get a growing --i value so they appear one after another.
  const revealEls = document.querySelectorAll('[data-reveal]');
  revealEls.forEach((el) => {
    const index = [...el.parentElement.children].indexOf(el);
    el.style.setProperty('--i', index);
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('in'); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.15 });
    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in')); // old browsers: just show everything
  }

  // ---------- 3b. Cursor light ----------
  // Moves the soft red glow in the hero (see .hero::after in style.css) to the cursor.
  const hero = document.querySelector('.hero');
  if (hero && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hero.addEventListener('pointermove', (e) => {
      const box = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', e.clientX - box.left + 'px');
      hero.style.setProperty('--my', e.clientY - box.top + 'px');
    });
  }

  // ---------- 4. Radar ----------
  const canvas = document.getElementById('radar');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const readout = document.getElementById('readout');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Colours come from the CSS tokens, so style.css stays the single source of truth.
  const css = getComputedStyle(document.documentElement);
  const PIN = css.getPropertyValue('--pin').trim();
  const MONO = css.getPropertyValue('--font-mono').trim();
  const DISPLAY = css.getPropertyValue('--font-display').trim();

  let size = 0;                  // canvas width in CSS pixels (it is square)
  let sweep = 0;                 // current sweep angle in radians
  let hovered = null;            // pin under the mouse, if any
  const mouse = { x: -999, y: -999 };

  // Give each pin a radian angle it can drift from.
  const pins = PEOPLE.map((p) => ({ ...p, rad: (p.angle * Math.PI) / 180, x: 0, y: 0, glow: 0 }));

  // Make the canvas sharp on high-DPI screens: draw at (size * ratio) pixels, scale back with CSS.
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    size = canvas.getBoundingClientRect().width;
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  // Angle difference helper: how far (0..2π) the sweep is past a pin.
  function behind(sweepAngle, pinAngle) {
    const TWO_PI = Math.PI * 2;
    return (((sweepAngle - pinAngle) % TWO_PI) + TWO_PI) % TWO_PI;
  }

  function drawRings(cx, cy, maxR) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `10px ${MONO}`;
    ctx.textAlign = 'left';
    RING_LABELS.forEach((label, i) => {
      const r = (maxR * (i + 1)) / RING_LABELS.length;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.setLineDash(i === RING_LABELS.length - 1 ? [] : [3, 5]);
      ctx.stroke();
      ctx.fillText(label, cx + 6, cy - r + 14);
    });
    ctx.setLineDash([]);
    // cross hairs
    ctx.beginPath();
    ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy);
    ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR);
    ctx.stroke();
  }

  function drawSweep(cx, cy, maxR) {
    // A fading wedge trailing behind the sweep line (conic gradient where supported).
    if (ctx.createConicGradient) {
      const g = ctx.createConicGradient(sweep - Math.PI * 0.55, cx, cy);
      g.addColorStop(0, 'rgba(255,75,92,0)');
      g.addColorStop(0.27, 'rgba(255,75,92,0.28)');
      g.addColorStop(0.275, 'rgba(255,75,92,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, maxR, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = PIN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweep) * maxR, cy + Math.sin(sweep) * maxR);
    ctx.stroke();
  }

  function drawYou(cx, cy, t) {
    // "you": a dot with a ring that pulses outward every 2.4 seconds
    const pulse = (t % 2.4) / 2.4;
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - pulse)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 8 + pulse * 40, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PIN;
    ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
  }

  function drawPin(p) {
    const r = 15 + p.glow * 4;
    // glow halo that fades after the sweep passes
    if (p.glow > 0.02) {
      ctx.fillStyle = p.color + Math.round(p.glow * 70).toString(16).padStart(2, '0');
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 14 * p.glow, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 0.35 + 0.65 * Math.max(p.glow, p === hovered ? 1 : 0);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `700 11px ${DISPLAY}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.initials, p.x, p.y + 0.5);
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
  }

  function drawTooltip(p) {
    const text = `${p.name}  ·  ${p.note}`;
    ctx.font = `500 11px ${MONO}`;
    const w = ctx.measureText(text).width + 20;
    // keep the label inside the canvas
    const x = Math.min(Math.max(p.x - w / 2, 8), size - w - 8);
    const y = p.y - 46 < 8 ? p.y + 26 : p.y - 46;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.roundRect(x, y, w, 26, 13); ctx.fill();
    ctx.fillStyle = '#0e1b2e';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 10, y + 13.5);
    ctx.textBaseline = 'alphabetic';
  }

  let lastTime = 0;
  let lastCount = -1;

  function frame(now) {
    const t = now / 1000;
    const dt = Math.min(t - lastTime, 0.05); // cap dt so a background tab does not cause a jump
    lastTime = t;
    if (!reduceMotion) sweep = (sweep + SWEEP_SPEED * dt) % (Math.PI * 2);

    const cx = size / 2, cy = size / 2, maxR = size / 2 - 22;
    ctx.clearRect(0, 0, size, size);
    drawRings(cx, cy, maxR);
    drawSweep(cx, cy, maxR);

    // update pins: drift, convert polar -> x/y, and light up just after the sweep passes
    let lit = 0;
    hovered = null;
    pins.forEach((p) => {
      if (!reduceMotion) p.rad += DRIFT_SPEED * dt;
      p.x = cx + Math.cos(p.rad) * p.dist * maxR;
      p.y = cy + Math.sin(p.rad) * p.dist * maxR;
      p.glow = Math.max(0, 1 - behind(sweep, p.rad) / (Math.PI * 1.1));
      if (reduceMotion) p.glow = 1;
      if (p.glow > 0.3) lit++;
      if (Math.hypot(mouse.x - p.x, mouse.y - p.y) < 20) hovered = p;
    });

    drawYou(cx, cy, t);
    pins.forEach(drawPin);
    if (hovered) drawTooltip(hovered);

    // update the text readout only when the number changes (cheap DOM work)
    if (readout && lit !== lastCount) {
      lastCount = lit;
      readout.innerHTML = `<span><b>${lit}</b> of ${pins.length} pins in range</span><span>sweep radius 2 km</span>`;
    }
    if (!reduceMotion) requestAnimationFrame(frame);
  }

  // mouse / touch position relative to the canvas
  canvas.addEventListener('pointermove', (e) => {
    const box = canvas.getBoundingClientRect();
    mouse.x = e.clientX - box.left;
    mouse.y = e.clientY - box.top;
    if (reduceMotion) requestAnimationFrame(frame); // static mode: redraw on demand
  });
  canvas.addEventListener('pointerleave', () => { mouse.x = mouse.y = -999; });
  window.addEventListener('resize', () => { resize(); if (reduceMotion) requestAnimationFrame(frame); });

  resize();
  requestAnimationFrame(frame);
})();
