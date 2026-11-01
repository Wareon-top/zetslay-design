/* Native details remain fully usable without this search enhancement. */
(() => {
  const root = document.querySelector('[data-landing-faq="knowledge-v1"]');
  if (!root) return;
  const tools = root.querySelector('[data-faq-tools]');
  const search = root.querySelector('[data-faq-search]');
  const clear = root.querySelector('[data-faq-clear]');
  const reset = root.querySelector('[data-faq-reset]');
  const empty = root.querySelector('[data-faq-empty]');
  const count = root.querySelector('[data-faq-count]');
  const filters = Array.from(root.querySelectorAll('[data-faq-filter]'));
  const normalize = value => value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  const items = Array.from(root.querySelectorAll('[data-faq-item]')).map(node => ({ node, category: node.dataset.faqCategory, text: normalize(node.textContent) }));
  if (!tools || !search || !clear || !reset || !empty || !count || !filters.length || !items.length) return;
  const allowed = new Set(['all', ...items.map(item => item.category)]);
  let category = 'all';
  function update() {
    const query = normalize(search.value.slice(0, 120));
    const terms = query.split(' ').filter(Boolean);
    let shown = 0;
    items.forEach(item => {
      const matches = (category === 'all' || item.category === category) && terms.every(term => item.text.includes(term));
      item.node.hidden = !matches;
      if (matches) shown++;
    });
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.faqFilter === category)));
    clear.hidden = !search.value;
    empty.hidden = shown !== 0;
    count.textContent = `Найдено: ${shown} из ${items.length}`;
  }
  search.addEventListener('input', update);
  search.addEventListener('keydown', event => {
    if (event.key === 'Escape' && search.value) { event.preventDefault(); search.value = ''; update(); }
  });
  clear.addEventListener('click', () => { search.value = ''; update(); search.focus(); });
  reset.addEventListener('click', () => { category = 'all'; search.value = ''; update(); search.focus(); });
  filters.forEach(button => button.addEventListener('click', () => {
    if (!allowed.has(button.dataset.faqFilter)) return;
    category = button.dataset.faqFilter;
    update();
  }));
  // Also maintain a single open answer in browsers without details[name] support.
  items.forEach(item => item.node.addEventListener('toggle', () => {
    if (!item.node.open) return;
    items.forEach(other => { if (other.node !== item.node && other.node.open) other.node.open = false; });
  }));
  update();
  tools.hidden = false;
})();
