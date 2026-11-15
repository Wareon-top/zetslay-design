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

/* Reviews of ZetSlay from cabinet users (public GET, no session). The section stays hidden
   until real reviews arrive: nothing is invented, an unreachable API simply leaves it out. */
(() => {
  const root = document.querySelector('[data-landing-reviews]'), base = document.querySelector('meta[name="zetslay-api-base-url"]')?.content;
  if (!root || !base || !window.fetch) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stars = n => `<span class="zl-stars" role="img" aria-label="Оценка ${n} из 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'is-on' : ''}"></i>`).join('')}</span>`;
  const day = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }); };
  const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c;
  const card = r => `<article class="zl-review"><header>${r.author?.avatarUrl ? `<span class="zl-review__avatar"><img src="${esc(base.replace(/\/$/, '') + r.author.avatarUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>` : `<span class="zl-review__avatar zl-review__avatar--initials" aria-hidden="true">${esc(r.author?.initials || 'ZS')}</span>`}
    <div><strong>${esc(r.author?.displayName || 'Участник ZetSlay')}</strong><span>${stars(r.rating)}<time datetime="${esc(r.createdAt)}">${esc(day(r.createdAt))}</time></span></div></header><p>${esc(r.text)}</p></article>`;
  const controller = new AbortController(); setTimeout(() => controller.abort(), 8000);
  fetch(base.replace(/\/$/, '') + '/api/v1/reviews?target=service&limit=9', { credentials: 'omit', signal: controller.signal })
    .then(r => r.ok ? r.json() : null).then(body => {
      const data = body?.data; if (!data?.reviews?.length) return;
      root.querySelector('[data-landing-reviews-wall]').innerHTML = data.reviews.map(card).join('');
      const { count, average } = data.summary || {};
      if (count) root.querySelector('[data-landing-reviews-score]').innerHTML = `<b>${String(average).replace('.', ',')}</b><div>${stars(Math.round(average))}<span>${count} ${plural(count, 'отзыв', 'отзыва', 'отзывов')}</span></div>`;
      root.hidden = false;
    }).catch(() => {});
})();
