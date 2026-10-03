/* Only the platform ribbon is controlled here; auth links remain native links. */
(() => {
  const ribbon = document.querySelector('[data-platform-ribbon]');
  const button = ribbon?.querySelector('[data-platform-ribbon-pause]');
  if (!ribbon || !button) return;
  button.addEventListener('click', () => {
    const paused = ribbon.dataset.paused !== 'true';
    ribbon.dataset.paused = String(paused);
    button.setAttribute('aria-pressed', String(paused));
  });
  const updateVisibility = () => {
    ribbon.dataset.suspended = String(document.hidden);
  };
  document.addEventListener('visibilitychange', updateVisibility);
  updateVisibility();
})();
