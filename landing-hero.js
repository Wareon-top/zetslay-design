/* Decorative ASCII field, adapted from the supplied noise component. */
(() => {
  const ribbon = document.querySelector('[data-platform-ribbon]');
  const hero = document.querySelector('[data-landing-hero="orderflow"]');
  // Retain the existing canvas hook so a narrow update preserves the live hero.
  const canvas = hero?.querySelector('[data-hero-ascii], [data-hero-particles]');
  const context = canvas?.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const lowData = window.navigator?.connection?.saveData === true;
  const ramp = ' .:-=+*#%@';
  const cursor = { x: 0, y: 0, tx: 0, ty: 0, strength: 0, active: false };
  let visible = true, pageActive = true, frame = 0, last = null, time = 0;
  let width = 0, height = 0, cols = 0, rows = 0, cell = 14, ink = '#d6c4ba';
  let resizeTimer = 0;

  function noise(x, y, t) {
    return (Math.sin(x * 1.7 + t * .6) + Math.sin(y * 2.3 - t * .4)
      + Math.sin((x + y) * 1.1 + t * .25)
      + Math.sin(Math.hypot(x - 6, y - 4) * 1.9 - t * .7)) / 8 + .5;
  }
  function readInk() {
    ink = window.getComputedStyle?.(canvas).color || '#d6c4ba';
  }
  function paint(delta = 0) {
    if (!context || !width || !height) return;
    context.clearRect(0, 0, width, height);
    context.fillStyle = ink;
    time += delta * 1.68;
    const ease = delta ? 1 - Math.pow(.88, delta * 60) : 1;
    cursor.x += (cursor.tx - cursor.x) * ease;
    cursor.y += (cursor.ty - cursor.y) * ease;
    cursor.strength += ((cursor.active ? 1 : 0) - cursor.strength) * ease;
    const radius2 = 140 * 140;
    for (let gy = 0; gy < rows; gy++) {
      const py = gy * cell + cell / 2;
      // Keep the bright, solid coin silhouettes free of the character field.
      const horizon = Math.max(0, Math.min(1, (.74 - py / height) / .2));
      if (!horizon) continue;
      for (let gx = 0; gx < cols; gx++) {
        const px = gx * cell + cell / 2;
        let lum = Math.pow(noise(gx * .35 + time * .22, gy * .35, time), 1.7);
        if (cursor.strength > .001) {
          const d2 = (px - cursor.x) ** 2 + (py - cursor.y) ** 2;
          if (d2 < radius2 * 4) lum = Math.min(1, lum + Math.exp(-d2 / radius2) * .7 * cursor.strength);
        }
        const glyph = ramp[Math.floor(lum * (ramp.length - 1))];
        if (glyph === ' ') continue;
        // Extra attenuation behind the title, description and actions; CSS
        // additionally limits the entire layer to 11% opacity (9% on phones).
        const copyVeil = 1 - .8 * Math.exp(-(((px - width * .5) / (width * .33)) ** 2 + ((py - height * .35) / (height * .22)) ** 2));
        context.globalAlpha = (.25 + lum * .75) * copyVeil * horizon;
        context.fillText(glyph, px, py);
      }
    }
    context.globalAlpha = 1;
  }
  function tick(now) {
    frame = 0;
    if (document.hidden || !pageActive || !visible || reduced.matches || lowData) return;
    if (last === null || now - last >= 32) {
      paint(last === null ? 0 : Math.min((now - last) / 1000, .08));
      last = now;
    }
    frame = window.requestAnimationFrame(tick);
  }
  function sync() {
    const suspended = document.hidden || !pageActive || !visible;
    if (ribbon) ribbon.dataset.suspended = String(document.hidden || !pageActive);
    if (hero) document.body.dataset.heroSuspended = String(suspended || reduced.matches || lowData);
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0; last = null;
    if (!context || suspended) return;
    if (!reduced.matches && !lowData) frame = window.requestAnimationFrame(tick);
    else paint();
  }
  function resize() {
    if (!context) return;
    const rect = hero.getBoundingClientRect();
    width = Math.max(0, rect.width); height = Math.max(0, rect.height);
    // Limit glyph work on ultrawide displays and pixel work on high-DPR phones.
    cell = Math.max(width < 600 ? 16 : 14, Math.sqrt(width * height / 8500));
    cols = Math.ceil(width / cell); rows = Math.ceil(height / cell);
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.font = `${cell * .85}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    context.textAlign = 'center'; context.textBaseline = 'middle';
    readInk(); paint();
  }
  function queueResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => { resizeTimer = 0; resize(); }, 150);
  }
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener?.('change', sync);
  window.addEventListener('pagehide', () => { pageActive = false; sync(); });
  window.addEventListener('pageshow', () => { pageActive = true; sync(); });
  if (context) {
    resize();
    if ('ResizeObserver' in window) new window.ResizeObserver(queueResize).observe(hero);
    else window.addEventListener('resize', queueResize, { passive: true });
    if ('IntersectionObserver' in window) new window.IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false;
      sync();
    }, { threshold: 0 }).observe(hero);
    // Observe the hero: the decorative canvas never intercepts a button click.
    hero.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch' || reduced.matches || lowData) return;
      const rect = hero.getBoundingClientRect();
      if (!cursor.active && cursor.strength < .001) { cursor.x = event.clientX - rect.left; cursor.y = event.clientY - rect.top; }
      cursor.tx = event.clientX - rect.left; cursor.ty = event.clientY - rect.top;
      cursor.active = true;
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { cursor.active = false; }, { passive: true });
    if ('MutationObserver' in window) new window.MutationObserver(() => {
      readInk(); if (reduced.matches || lowData) paint();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
  }
  sync();
  const menu = document.querySelector('.site-header .mobile-menu');
  if (menu) {
    menu.querySelectorAll('nav a').forEach(link => link.addEventListener('click', () => { menu.open = false; }));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary')?.focus(); }
    });
    document.addEventListener('click', event => { if (menu.open && !menu.contains(event.target)) menu.open = false; });
  }
})();
