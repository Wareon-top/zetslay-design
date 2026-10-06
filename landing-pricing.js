/* Public presentation only: no payment, plan activation or account mutation. */
(() => {
  const periods = {
    month: { months: 1, discount: 0, label: 'Месяц' },
    quarter: { months: 3, discount: 10, label: '3 месяца' },
    year: { months: 12, discount: 20, label: 'Год' }
  };
  function pricingQuote(monthlyRub, periodId) {
    const period = periods[periodId];
    if (!Number.isSafeInteger(monthlyRub) || monthlyRub <= 0 || monthlyRub > 100000 || !period) return null;
    const monthlyKopecks = monthlyRub * (100 - period.discount);
    return { ...period, monthlyKopecks, totalKopecks: monthlyKopecks * period.months };
  }
  function rubles(kopecks) {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: kopecks % 100 ? 2 : 0,
      maximumFractionDigits: 2
    }).format(kopecks / 100) + ' ₽';
  }
  const root = document.querySelector('[data-landing-pricing="plans-v1"]');
  if (!root) return;
  const picker = root.querySelector('[data-pricing-periods]');
  const buttons = Array.from(root.querySelectorAll('[data-pricing-period]'));
  const announcement = root.querySelector('[data-pricing-announcement]');
  const cards = Array.from(root.querySelectorAll('[data-pricing-plan]')).map(card => ({
    monthlyRub: Number(card.dataset.monthlyRub),
    price: card.querySelector('[data-pricing-price]'),
    original: card.querySelector('[data-pricing-original]'),
    note: card.querySelector('[data-pricing-note]')
  }));
  if (!picker || !buttons.length || !cards.length || cards.some(c => !pricingQuote(c.monthlyRub, 'month') || !c.price || !c.original || !c.note)) return;
  function select(periodId, announce = true) {
    if (!periods[periodId]) return;
    cards.forEach(card => {
      const quote = pricingQuote(card.monthlyRub, periodId);
      card.price.textContent = rubles(quote.monthlyKopecks);
      card.original.hidden = !quote.discount;
      card.original.textContent = rubles(card.monthlyRub * 100);
      card.note.textContent = quote.months === 1
        ? 'Оплата за месяц после запуска подписок'
        : `${rubles(quote.totalKopecks)} за ${quote.months === 3 ? '3 месяца' : 'год'} · скидка ${quote.discount}%`;
    });
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.pricingPeriod === periodId)));
    if (announce && announcement) {
      const period = periods[periodId];
      announcement.textContent = `${period.label}. ${period.discount ? `Скидка ${period.discount}%. ` : ''}Показана стоимость в месяц; полная сумма указана под ценой.`;
    }
  }
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => select(button.dataset.pricingPeriod));
    button.addEventListener('keydown', event => {
      const last = buttons.length - 1;
      const next = event.key === 'ArrowRight' ? (index + 1) % buttons.length
        : event.key === 'ArrowLeft' ? (index + last) % buttons.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? last : null;
      if (next === null) return;
      event.preventDefault();
      buttons[next].focus();
      select(buttons[next].dataset.pricingPeriod);
    });
  });
  select('month', false);
  picker.hidden = false;
})();
