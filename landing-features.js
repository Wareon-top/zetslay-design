/* Progressive enhancement only: content stays visible without JavaScript. */
(() => {
  const grid = document.querySelector('[data-landing-features="reference-bento"] .landing-bento__grid');
  if (!grid || !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cards = grid.querySelectorAll('.bento-card');
  cards.forEach((card, index) => card.style.setProperty('--bento-index', index));
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    grid.dataset.bentoReveal = 'visible';
    observer.disconnect();
  }, { rootMargin: '0px 0px -50px 0px', threshold: 0 });
  observer.observe(grid);
  grid.dataset.bentoReveal = 'pending';
})();
