/* Keep the instruction visible when the subscription gate renders its own overview. */
(() => {
  'use strict';
  const root = document.querySelector('[data-view="dashboard"]');
  const original = root?.querySelector('[data-video-guide="dashboard"]');
  if (!root || !original) return;
  const mount = () => {
    const gate = root.querySelector(':scope > [data-access-gate]');
    if (!gate || gate.querySelector('[data-video-guide="dashboard-preview"]')) return;
    const heading = gate.querySelector('.demo-intro, .access-heading');
    if (!heading) return;
    const card = original.cloneNode(true);
    card.hidden = false;
    card.dataset.videoGuide = 'dashboard-preview';
    const title = card.querySelector('h2');
    if (title) {
      title.id = 'video-guide-dashboard-preview-title';
      card.setAttribute('aria-labelledby', title.id);
    }
    heading.after(card);
  };
  const observer = new MutationObserver(mount);
  observer.observe(root, {childList:true, subtree:true});
  mount();
})();
