/* Account finance presentation. Payment and promotion endpoints are not yet provided by the API. */
const billingUi = { session:'', busy:false, error:'', request:0, dialog:null };
const BILLING_PLAN_NAMES = Object.freeze({ start:'Старт', growth:'Рост', pro:'Профи', maximum:'Максимум', pro_demo:'Демо-тариф' });
const billingEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const billingMoney = (minor, currency) => new Intl.NumberFormat('ru-RU', { style:'currency', currency, maximumFractionDigits:2 }).format(minor / 100);

function billingModel(user, workspace, store, content) {
  const signedIn = Boolean(user);
  const id = signedIn && store?.id != null ? String(store.id) : '';
  const matching = Boolean(id && content?.profile?.id != null && String(content.profile.id) === id);
  const validMinor = value => Number.isSafeInteger(value) && value >= 0;
  const balance = matching && ['RUB','USD','EUR'].includes(content?.balance?.currency) ? content.balance : null;
  const total = validMinor(balance?.totalMinor) ? balance.totalMinor : null;
  const observedAt = matching && typeof content?.observedAt === 'string' && Number.isFinite(Date.parse(content.observedAt)) ? content.observedAt : null;
  const plan = signedIn ? workspace?.plan : null;
  const connected = Boolean(signedIn && id && store.status === 'connected_read_only');
  return {
    signedIn, connected, id,
    name: signedIn && id ? String(matching && content.profile.displayName || store.displayName || 'Магазин FunPay') : 'Магазин не подключён',
    amount:total === null ? '—' : `${balance.approximate === true ? '≈ ' : ''}${billingMoney(total, balance.currency)}`,
    balanceKnown:total !== null,
    available:validMinor(balance?.availableMinor) ? billingMoney(balance.availableMinor, balance.currency) : null,
    pending:validMinor(balance?.pendingMinor) ? billingMoney(balance.pendingMinor, balance.currency) : null,
    observedAt,
    approximate:balance?.approximate === true,
    planName:plan?.active ? BILLING_PLAN_NAMES[plan.id] || 'Активный тариф' : 'Не активен',
    planActive:Boolean(plan?.active),
    currentPlan:plan?.active && ['start','growth','pro','maximum'].includes(plan.id) ? plan.id : null
  };
}

function closeBillingDialog() {
  const dialog = billingUi.dialog;
  billingUi.dialog = null;
  if (dialog?.open) dialog.close();
  dialog?.remove();
}

function renderBilling() {
  const root = document.querySelector('[data-billing]');
  if (!root || typeof authState === 'undefined' || typeof state === 'undefined') return false;
  const session = `${authState.token || ''}:${typeof sessionGeneration === 'number' ? sessionGeneration : ''}`;
  if (billingUi.session !== session) {
    billingUi.session = session;
    billingUi.request++;
    billingUi.busy = false;
    billingUi.error = '';
    closeBillingDialog();
  }
  const model = billingModel(authState.user, authState.workspace, selectedStore(), state.storeContent);
  const set = (selector, value) => { const node = root.querySelector(selector); if (node) node.textContent = value; };
  set('[data-billing-funpay-balance]', model.amount);
  set('[data-billing-store-name]', model.name);
  set('[data-billing-store-status]', model.connected ? 'Подключён' : 'Подключение не подтверждено');
  root.querySelector('[data-billing-store-status]')?.classList.toggle('is-connected', model.connected);
  set('[data-billing-plan-name]', model.planName);
  set('[data-billing-plan-status]', model.planActive ? 'Доступ активен' : 'Выберите подходящий тариф ниже');
  set('[data-billing-updated]', model.observedAt ? `Снимок: ${new Date(model.observedAt).toLocaleString('ru-RU', { dateStyle:'medium', timeStyle:'short' })}` : 'Снимок баланса ещё не получен');
  set('[data-billing-balance-note]', model.balanceKnown ? model.approximate ? 'Сумма в шапке FunPay может быть округлена' : 'По последнему снимку магазина' : 'Обновите данные подключённого магазина');
  set('[data-billing-available]', model.available || '—');
  set('[data-billing-pending]', model.pending || '—');
  const avatar = root.querySelector('[data-billing-avatar]');
  if (avatar) avatar.innerHTML = typeof storeIdentityModel === 'function' && typeof storeIdentityAvatar === 'function'
    ? storeIdentityAvatar(storeIdentityModel(selectedStore(), state.storeContent, state.plugins || [], model.signedIn))
    : '<span class="billing-store-fallback" aria-hidden="true">FP</span>';
  const refresh = root.querySelector('[data-billing-refresh]');
  if (refresh) { refresh.disabled = billingUi.busy || !model.connected; refresh.setAttribute('aria-busy', String(billingUi.busy)); }
  set('[data-billing-refresh-label]', billingUi.busy ? 'Обновляем…' : 'Обновить данные');
  const error = root.querySelector('[data-billing-error]');
  if (error) { error.hidden = !billingUi.error; error.textContent = billingUi.error; }
  root.querySelectorAll('[data-billing-current]').forEach(badge => { badge.hidden = badge.dataset.billingCurrent !== model.currentPlan; });
  return true;
}

async function refreshBilling() {
  renderBilling();
  if (billingUi.busy || !authState.token || !authState.user || selectedStore()?.status !== 'connected_read_only') return;
  const token = authState.token, generation = sessionGeneration, request = ++billingUi.request;
  billingUi.busy = true;
  billingUi.error = '';
  renderBilling();
  try { await syncStoreContent({ silent:true }); }
  catch (error) {
    if (token === authState.token && generation === sessionGeneration && request === billingUi.request)
      billingUi.error = `${humanError(error)} Показан последний доступный снимок.`;
  } finally {
    if (token === authState.token && generation === sessionGeneration && request === billingUi.request) {
      billingUi.busy = false;
      renderBilling();
    }
  }
}

function openBillingDialog(kind, opener) {
  const root = document.querySelector('[data-billing]');
  if (!root || !authState.user || !authState.token) return;
  let title, copy, detail = '';
  if (kind === 'topup') {
    title = 'Пополнить баланс';
    copy = 'Приём платежей ещё не подключён. Пополнение баланса ZetSlay станет доступно после запуска оплаты.';
    detail = '<div class="billing-dialog-info"><strong>Счёт ZetSlay</strong><p>Используется для оплаты подписки сервиса. Баланс вашего магазина FunPay отображается отдельно.</p></div>';
  } else if (kind === 'promo') {
    title = 'Ввести промокод';
    copy = 'Применение промокодов появится вместе с оплатой подписок. Сейчас проверка кодов недоступна.';
  } else {
    const card = [...root.querySelectorAll('[data-pricing-plan]')].find(item => item.dataset.pricingPlan === kind);
    if (!card) return;
    const name = card.querySelector('h3')?.textContent || '';
    const price = card.querySelector('[data-pricing-price]')?.textContent || '';
    const note = card.querySelector('[data-pricing-note]')?.textContent || '';
    title = `Тариф «${name}»`;
    copy = 'Оформление коммерческой подписки пока недоступно. Ваш действующий доступ сохраняется.';
    detail = `<div class="billing-dialog-quote"><strong>${billingEscape(price)}<small> / месяц</small></strong><p>${billingEscape(note)}</p></div>`;
    const period = root.querySelector('[data-billing-pricing]')?.dataset?.pricingPeriod || 'month';
    const quote = typeof ZetSlayPricing === 'object' ? ZetSlayPricing.quote(kind, period) : null;
    if (quote) {
      title = `Тариф «${quote.name}»`;
      detail = `<div class="billing-dialog-quote"><strong>${billingEscape(ZetSlayPricing.rubles(quote.totalKopecks))}<small> за ${quote.months === 1 ? '1 месяц' : quote.months === 3 ? '3 месяца' : '12 месяцев'}</small></strong><p>${billingEscape(ZetSlayPricing.rubles(quote.monthlyKopecks))} в месяц${quote.discount ? ` · скидка ${quote.discount}%` : ''}. Весь период оплачивается целиком.</p></div><div class="billing-dialog-info"><strong>Включено в подписку</strong><ul>${quote.features.map(feature => `<li>${billingEscape(feature)}</li>`).join('')}</ul><p>Один магазин FunPay. Прокси, товары и баланс внешних сервисов оплачиваются отдельно. Срок доступа отсчитывается с активации. Регулярные списания не подключены.</p><p><a href="../legal/offer.html">Условия использования</a> · <a href="../legal/refunds.html">Оплата и возвраты</a></p></div>`;
    }
  }
  closeBillingDialog();
  const dialog = document.createElement('dialog');
  dialog.className = 'billing-dialog';
  dialog.setAttribute('aria-labelledby', 'billing-dialog-title');
  dialog.setAttribute('aria-describedby', 'billing-dialog-description');
  dialog.innerHTML = `<header><span class="billing-dialog-icon">${icon(kind === 'promo' ? 'gift' : 'card')}</span><button type="button" class="icon-button" data-billing-close aria-label="Закрыть окно">${icon('close')}</button></header><h2 id="billing-dialog-title">${billingEscape(title)}</h2><p id="billing-dialog-description">${billingEscape(copy)}</p>${detail}<footer><button class="button button--primary" type="button" data-billing-close autofocus>Понятно</button></footer>`;
  const token = authState.token;
  const generation = sessionGeneration;
  dialog.addEventListener('click', event => { if (event.target === dialog || event.target.closest?.('[data-billing-close]')) dialog.close(); });
  dialog.addEventListener('close', () => {
    if (billingUi.dialog === dialog) billingUi.dialog = null;
    dialog.remove();
    if (token === authState.token && generation === sessionGeneration && !root.hidden && opener?.isConnected) opener.focus();
  });
  root.append(dialog);
  billingUi.dialog = dialog;
  dialog.showModal();
}

(() => {
  if (!document.querySelector('[data-billing]')) return;
  if (typeof renderFinance === 'function') {
    const previous = renderFinance;
    renderFinance = function(...args) { if (!renderBilling()) return previous.apply(this, args); };
  }
  if (typeof renderStoreIdentity === 'function') {
    const previous = renderStoreIdentity;
    renderStoreIdentity = function(...args) { const result = previous.apply(this, args); renderBilling(); return result; };
  }
  if (typeof setView === 'function') {
    const previous = setView;
    setView = function(...args) { const result = previous.apply(this, args); if (document.querySelector('[data-billing]')?.hidden) closeBillingDialog(); renderBilling(); return result; };
  }
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-billing-open], [data-billing-plan], [data-billing-refresh]');
    if (!button || button.disabled || !document.querySelector('[data-billing]')?.contains(button)) return;
    if (button.hasAttribute('data-billing-refresh')) { refreshBilling(); return; }
    openBillingDialog(button.dataset.billingOpen || button.dataset.billingPlan, button);
  });
  renderBilling();
})();
