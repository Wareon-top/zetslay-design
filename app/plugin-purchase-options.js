/* Commercial presentation only. Installation never counts as a purchase. */
function pluginPurchaseModel(plugin, pricing = typeof ZetSlayPricing === 'object' ? ZetSlayPricing : null) {
  const rarity = typeof pluginRarity === 'function' ? pluginRarity(plugin) : { key:'common', label:'Обычный' };
  const amount = typeof pluginCatalogPrice === 'function' ? pluginCatalogPrice(plugin)
    : typeof plugin.priceRub === 'number' && Number.isFinite(plugin.priceRub) && plugin.priceRub >= 0 && Number.isSafeInteger(Math.round(plugin.priceRub * 100)) ? Math.round(plugin.priceRub * 100) : null;
  const format = minor => new Intl.NumberFormat('ru-RU', { minimumFractionDigits:minor % 100 ? 2 : 0, maximumFractionDigits:2 }).format(minor / 100) + ' ₽';
  const available = !plugin.planned && plugin.published !== false;
  const quotes = pricing && Array.isArray(pricing.plans) && typeof pricing.quote === 'function'
    ? pricing.plans.map(plan => pricing.quote(plan.id, 'month')).filter(quote => quote && quote.months === 1 && Number.isSafeInteger(quote.totalKopecks) && quote.totalKopecks > 0 && Array.isArray(quote.includes) && quote.includes.includes(rarity.key)) : [];
  quotes.sort((a,b) => a.totalKopecks - b.totalKopecks || String(a.planId).localeCompare(String(b.planId)));
  const quote = quotes[0] || null;
  const names = { common:'обычные', advanced:'продвинутые', ultra:'ультра', legendary:'легендарные' };
  return { available, amount, price:amount === null ? 'Цена уточняется' : amount === 0 ? 'Бесплатно' : format(amount),
    plan:quote ? { id:quote.planId, name:quote.name, price:format(quote.totalKopecks),
      levels:['common','advanced','ultra','legendary'].filter(key => quote.includes.includes(key)).map(key => names[key]).join(', ') } : null };
}

function pluginPurchaseOptionsMarkup(plugin) {
  const model = pluginPurchaseModel(plugin);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const plan = model.plan;
  return `<div class="plugin-purchase-options" aria-label="Варианты доступа к плагину">
    <section class="plugin-purchase-option plugin-purchase-option--lifetime" aria-label="Разовая покупка">
      <div class="plugin-purchase-option__heading"><span>Разовая покупка</span><strong>Без продления</strong></div>
      <h2>Плагин навсегда</h2><div class="plugin-page-price">${safe(model.price)}${model.amount > 0 ? '<small>один раз</small>' : ''}</div>
      <p>${model.amount === 0 ? 'Бесплатный доступ к этому плагину. Без ежемесячной платы за его лицензию.' : 'Бессрочный доступ к этому плагину после покупки. Без ежемесячной платы за его лицензию.'}</p>
      ${model.amount === 0 && model.available ? '<p class="plugin-purchase-option__availability">Этот модуль можно установить бесплатно.</p>' : `<button class="button button--primary button--wide" type="button" disabled>${!model.available ? 'Пока недоступен' : 'Купить навсегда · скоро'}</button><p class="plugin-purchase-option__availability">${!model.available ? 'Покупка станет доступна после публикации модуля.' : 'Разовая покупка станет доступна после подключения оплаты.'}</p>`}
    </section>
    <div class="plugin-purchase-options__divider"><span>или доступ по подписке</span></div>
    <section class="plugin-purchase-option plugin-purchase-option--subscription" aria-label="Подписка на месяц">
      <div class="plugin-purchase-option__heading"><span>Подписка на месяц</span><strong>Набор плагинов</strong></div>
      ${plan ? `<h2>Тариф «${safe(plan.name)}»</h2><div class="plugin-page-price">${safe(plan.price)}<small>за 1 месяц</small></div><p>Этот плагин и все опубликованные собственные плагины ZetSlay включённых редкостей: ${safe(plan.levels)}.</p><p class="plugin-purchase-option__term">Доступ на оплаченный месяц. Автоматических списаний нет.</p>${model.available ? `<a class="button button--ghost button--wide" href="#billing" data-plugin-subscription="${safe(plan.id)}" data-plugin-subscription-id="${safe(plugin.id)}">Посмотреть условия тарифа</a>` : '<button class="button button--ghost button--wide" type="button" disabled>Модуль пока недоступен</button>'}` : '<h2>Сравнить тарифы</h2><p>Условия подписки сейчас не загружены. Откройте раздел «Финансы», чтобы посмотреть актуальный состав и стоимость.</p><a class="button button--ghost button--wide" href="#billing">Перейти к тарифам</a>'}
    </section>
    <p class="plugin-purchase-options__note">Прокси, покупки у поставщиков и комиссии внешних площадок оплачиваются отдельно.</p>
  </div>`;
}

(() => {
  if (typeof pluginPageMarkup !== 'function' || pluginPageMarkup.purchaseOptions) return;
  const previous = pluginPageMarkup;
  pluginPageMarkup = function(plugin) {
    const html = previous(plugin);
    return html.replace(/<span class="plugin-page-eyebrow">В вашем кабинете<\/span><div class="plugin-page-price">[\s\S]*?<\/div><p class="plugin-page-price-note">[\s\S]*?<\/p>/, () => pluginPurchaseOptionsMarkup(plugin));
  };
  Object.assign(pluginPageMarkup, previous);
  pluginPageMarkup.purchaseOptions = true;
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-plugin-subscription]');
    const root = document.querySelector('[data-plugin-page]');
    if (!button || button.disabled || !root?.contains(button) || typeof authState === 'undefined' || !authState.user || !authState.token) return;
    const plugin = typeof state !== 'undefined' && state.plugins.find(entry => entry.id === button.dataset.pluginSubscriptionId);
    const model = plugin && pluginPurchaseModel(plugin);
    if (!model?.available || !model.plan || model.plan.id !== button.dataset.pluginSubscription) return;
    if (typeof setView !== 'function' || typeof openBillingDialog !== 'function') return;
    event.preventDefault();
    setView('billing');
    const month = document.querySelector('[data-billing-pricing] [data-pricing-period="month"]');
    if (!month || typeof month.click !== 'function') return;
    month.click();
    openBillingDialog(model.plan.id, button);
  });
  if (typeof renderPluginPage === 'function') renderPluginPage();
})();
