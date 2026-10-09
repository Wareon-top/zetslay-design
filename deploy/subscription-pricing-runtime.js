/* Generated from subscription-plans.json. Quotes only; no payment or permission mutation. */
(() => {
  const catalog = __CATALOG__;
  const periods = Object.freeze(Object.fromEntries(Object.entries(catalog.periods).map(([key,value])=>[key,Object.freeze(value)])));
  const plans = Object.freeze(catalog.plans.map(plan => Object.freeze({ ...plan, features:Object.freeze(plan.features), includes:Object.freeze(plan.includes) })));
  function pricingQuote(monthlyRub, periodId) {
    const period = Object.hasOwn(periods, periodId) ? periods[periodId] : null;
    if (!Number.isSafeInteger(monthlyRub) || monthlyRub <= 0 || monthlyRub > 100000 || !period) return null;
    const monthlyKopecks = monthlyRub * (100 - period.discount);
    return { ...period, monthlyKopecks, totalKopecks:monthlyKopecks * period.months };
  }
  function rubles(kopecks) {
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits:kopecks % 100 ? 2 : 0, maximumFractionDigits:2 }).format(kopecks / 100) + ' ₽';
  }
  function quote(planId, periodId = 'month') {
    const plan = plans.find(plan => plan.id === planId);
    const value = plan && pricingQuote(plan.monthlyRub, periodId);
    return value ? { ...value, planId:plan.id, name:plan.name, features:plan.features, includes:plan.includes, currency:catalog.currency } : null;
  }
  globalThis.ZetSlayPricing = Object.freeze({ plans, periods, quote, rubles, paymentAvailable:false });
  const root = document.querySelector('[data-landing-pricing="plans-v1"]');
  if (!root) return;
  const picker=root.querySelector('[data-pricing-periods]'),buttons=Array.from(root.querySelectorAll('[data-pricing-period]'));
  const announcement=root.querySelector('[data-pricing-announcement]');
  const cards=Array.from(root.querySelectorAll('[data-pricing-plan]')).map(card => ({
    id:card.dataset.pricingPlan,monthlyRub:Number(card.dataset.monthlyRub),
    price:card.querySelector('[data-pricing-price]'),original:card.querySelector('[data-pricing-original]'),note:card.querySelector('[data-pricing-note]')
  }));
  if (!picker || buttons.length!==3 || cards.length!==4 || cards.some((card,index) => card.id !== plans[index].id || card.monthlyRub !== plans[index].monthlyRub || !card.price || !card.original || !card.note)) return;
  function select(periodId, announce=true) {
    if (!Object.hasOwn(periods,periodId)) return;
    root.dataset ||= {};
    root.dataset.pricingPeriod=periodId;
    cards.forEach(card => {
      const value=quote(card.id,periodId);
      card.price.textContent=rubles(value.monthlyKopecks);
      card.original.hidden=!value.discount;
      card.original.textContent=rubles(card.monthlyRub*100);
      card.note.textContent=value.months===1 ? `Итого ${rubles(value.totalKopecks)} за 1 месяц доступа` : `${rubles(value.totalKopecks)} за ${value.months===3?'3 месяца':'12 месяцев'} · скидка ${value.discount}% · оплата целиком`;
    });
    buttons.forEach(button => button.setAttribute('aria-pressed',String(button.dataset.pricingPeriod===periodId)));
    if(announce && announcement) {
      const period=periods[periodId];
      announcement.textContent=`${period.label}. ${period.discount ? `Скидка ${period.discount}%. ` : ''}Показана стоимость в месяц; полная сумма указана под ценой.`;
    }
  }
  buttons.forEach((button,index) => {
    button.addEventListener('click',()=>select(button.dataset.pricingPeriod));
    button.addEventListener('keydown',event => {
      const last=buttons.length-1;
      const next=event.key==='ArrowRight' ? (index+1)%buttons.length : event.key==='ArrowLeft' ? (index+last)%buttons.length : event.key==='Home' ? 0 : event.key==='End' ? last : null;
      if(next===null)return;
      event.preventDefault();buttons[next].focus();select(buttons[next].dataset.pricingPeriod);
    });
  });
  select('month',false);picker.hidden=false;
})();
