/* Decorative motion only. Authentication remains in the existing session client. */
(() => {
  const ribbon = document.querySelector('[data-platform-ribbon]');
  const hero = document.querySelector('[data-landing-hero="orderflow"]');
  const canvas = hero?.querySelector('[data-hero-particles]');
  const context = canvas?.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const lowData = window.navigator?.connection?.saveData === true;
  let visible = true, frame = 0, last = 0, width = 0, height = 0;
  let particles = [];

  function seed() {
    const count = lowData ? 0 : Math.min(64, Math.max(18, Math.round(width / 24)));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width, y: Math.random() * height,
      radius: .55 + Math.random() * 1.15, speed: 5 + Math.random() * 10,
      opacity: .12 + Math.random() * .25, phase: Math.random() * Math.PI * 2,
      warm: Math.random() > .62
    }));
  }
  function paint(delta = 0) {
    context.clearRect(0, 0, width, height);
    for (const dot of particles) {
      dot.y -= dot.speed * delta;
      if (dot.y < -8) { dot.y = height + 8; dot.x = Math.random() * width; }
      const overCopy = dot.x > width * .18 && dot.x < width * .82 && dot.y > height * .25 && dot.y < height * .62;
      const opacity = dot.opacity * (overCopy ? .32 : 1);
      const x = dot.x + Math.sin(dot.phase + dot.y * .003) * 5;
      context.beginPath();
      context.fillStyle = dot.warm ? `rgba(246,164,116,${opacity})` : `rgba(201,193,190,${opacity})`;
      context.arc(x, dot.y, dot.radius, 0, Math.PI * 2);
      context.fill();
    }
  }
  function tick(now) {
    frame = 0;
    if (document.hidden || !visible || reduced.matches || lowData) return;
    // Integrate seconds and cap drawing at 30fps for slow, efficient movement.
    if (!last || now - last >= 32) {
      paint(last ? Math.min((now - last) / 1000, .08) : 0);
      last = now;
    }
    frame = window.requestAnimationFrame(tick);
  }
  function sync() {
    const suspended = document.hidden || !visible;
    if (ribbon) ribbon.dataset.suspended = String(document.hidden);
    if (hero) document.body.dataset.heroSuspended = String(suspended);
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0; last = 0;
    if (!context) return;
    if (!suspended && !reduced.matches && !lowData) frame = window.requestAnimationFrame(tick);
    else paint();
  }
  function resize() {
    if (!context) return;
    const rect = hero.getBoundingClientRect();
    width = rect.width; height = rect.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    seed(); paint();
  }
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener?.('change', sync);
  if (context) {
    resize();
    if ('ResizeObserver' in window) new window.ResizeObserver(resize).observe(hero);
    else window.addEventListener('resize', resize, { passive: true });
    if ('IntersectionObserver' in window) new window.IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false;
      sync();
    }, { threshold: 0 }).observe(hero);
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
