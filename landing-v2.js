/* ZetSlay landing v2 — small progressive enhancements only.
   Content is fully visible without this file; it never touches session, pricing, FAQ or privacy logic. */
(() => {
  /* Mobile menu (native <details>): close after navigation, on Escape and on outside click. Replaces the former inline script. */
  const menu = document.querySelector('.zsh-header .mobile-menu');
  if (menu) {
    const summary = menu.querySelector('summary');
    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { menu.open = false; }));
    menu.addEventListener('toggle', () => { summary?.setAttribute('aria-label', menu.open ? 'Закрыть меню' : 'Открыть меню'); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) { menu.open = false; summary?.focus(); }
    });
    document.addEventListener('click', event => { if (menu.open && !menu.contains(event.target)) menu.open = false; });
  }

  /* Gentle reveal on scroll. Skipped with reduced motion or without IntersectionObserver;
     a timeout reveals everything if the observer never fires (content is never left hidden). */
  const items = Array.from(document.querySelectorAll('[data-reveal]'));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!items.length || reduced.matches || !('IntersectionObserver' in window)) return;
  const showAll = () => items.forEach(node => node.classList.add('is-in'));
  document.documentElement.classList.add('zl-reveal');
  let alive = false;
  const observer = new IntersectionObserver(entries => {
    alive = true;
    entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-in'); observer.unobserve(entry.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
  items.forEach(node => {
    const r = node.getBoundingClientRect();
    if (r.top < window.innerHeight) node.classList.add('is-in'); else observer.observe(node);
  });
  /* Anchors / find-in-page / print must never land on hidden content. */
  /* the observer reports every target once right after observe(); silence means it is broken */
  const failsafe = setTimeout(() => { if (!alive) showAll(); }, 2500);
  window.addEventListener('hashchange', showAll, { once: true });
  window.addEventListener('beforeprint', showAll);
  reduced.addEventListener?.('change', () => { clearTimeout(failsafe); showAll(); });
})();
