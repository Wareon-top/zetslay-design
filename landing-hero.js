/* Only the platform ribbon is controlled here; auth links remain native links. */
(() => {
  const ribbon = document.querySelector('[data-platform-ribbon]');
  if (!ribbon) return;
  const updateVisibility = () => {
    ribbon.dataset.suspended = String(document.hidden);
  };
  document.addEventListener('visibilitychange', updateVisibility);
  updateVisibility();
})();
