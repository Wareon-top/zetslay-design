(() => {
  const footer = document.querySelector('[data-landing-footer="animated-wave"]');
  if (!footer) return;
  const year = footer.querySelector('[data-footer-year]');
  if (year) year.textContent = String(new Date().getFullYear());
  function revealQuestion(hash) {
    if (!/^#faq-[a-z-]+$/.test(hash)) return null;
    const question = document.getElementById(hash.slice(1));
    if (!question?.matches('details[data-faq-item]')) return null;
    // The FAQ may have a search/category filter; expose the linked answer first.
    if (question.hidden) document.querySelector('[data-faq-reset]')?.click();
    question.open = true;
    return question;
  }
  footer.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest('a');
    if (!anchor || !footer.contains(anchor)) return;
    const hash = anchor.getAttribute('href');
    const question = revealQuestion(hash);
    if (!question) return;
    event.preventDefault();
    if (location.hash !== hash) history.pushState(null, '', hash);
    question.querySelector('summary')?.focus({preventScroll:true});
    question.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  });
  window.addEventListener('hashchange', () => { revealQuestion(location.hash); });
  revealQuestion(location.hash);
})();
