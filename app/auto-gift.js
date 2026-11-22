/* Telegram Gifts are paid from the personal bot's Stars balance. */
const autoGiftId = 'zetslay.auto-gift';
const autoGift = { scope: '', revision: 0, data: null, busy: false, error: '', tab: 'orders', order: '', draft: {}, intent: null };
const autoGiftModes = { paused: 'На паузе', review: 'С проверкой продавца', auto: 'Автоматически' };
const autoGiftStatuses = {
  waiting_recipient: 'Ждём получателя', review: 'Ждёт решения', queued: 'Готов к отправке', blocked: 'Нужно устранить причину',
  sending: 'Отправляется', uncertain: 'Нужно сверить', completed: 'Доставлено', stopped: 'Остановлено',
};
const autoGiftIssues = {
  GIFT_BALANCE: 'Пополните баланс персонального бота в Stars, затем верните заказ на проверку.',
  GIFT_CATALOG: 'Подарок исчез из каталога или оставшихся экземпляров недостаточно.',
  GIFT_COST: 'Цена в Telegram изменилась или превышает установленный лимит.',
  GIFT_DAILY_LIMIT: 'Достигнут суточный лимит. Он обновляется в 00:00 UTC, в 03:00 по Москве.',
  GIFT_UNCERTAIN: 'Сверьте этот подарок в истории бота и у получателя. Пока он требует сверки, набор приостановлен.',
  GIFT_TELEGRAM_REJECTED: 'Telegram отклонил отправку. Проверьте уже доставленные подарки и решите вопрос с покупателем.',
  GIFT_ORDER_CHANGED: 'Изменились оплата, получатель FunPay или состав заказа. Откройте заказ на FunPay.',
  GIFT_CHECK_FAILED: 'Не удалось проверить FunPay или Telegram. Верните заказ на проверку после устранения проблемы.',
  GIFT_SETTINGS_CHANGED: 'Изменились подключение магазина, бот или привязка лота.',
  GIFT_BOT_WEBHOOK: 'Восстановите подключение персонального бота в профиле, затем верните заказ на проверку.',
  GIFT_LINK_EXPIRED: 'Получатель не подтвердил ссылку за 72 часа.',
  GIFT_STOPPED: 'Продавец остановил оставшуюся выдачу.',
  FULFILLMENT_CONFLICT: 'Заказ или лот уже назначен другому плагину автовыдачи.',
};
const autoGiftActions = {
  approve: ['Отправить', 'Разрешить отправку оставшихся подарков с баланса бота?'],
  retry: ['Вернуть на проверку', 'Вернуть заказ в очередь проверки продавцом?'],
  stop: ['Остановить выдачу', 'Остановить оставшуюся выдачу по этому заказу? Для возврата откройте заказ на FunPay.'],
  'verify-sent': ['Подтвердить доставку', 'Я сверил историю бота и получателя. Подарок с неизвестным результатом действительно доставлен.'],
  reissue: ['Отправить новую ссылку', 'Отправить новую ссылку в этот заказ? Предыдущая ссылка перестанет работать.'],
};
const autoGiftScope = () => [authState.token, authState.workspace?.id].join(':');
const gE = value => escapeHtml(String(value ?? ''));
const gButton = (label, action, value = '', primary = false, pressed = null) =>
  `<button type="button" class="button button--${primary ? 'primary' : 'ghost'}" data-gift-action="${action}" data-gift-value="${gE(value)}"${pressed === null ? '' : ` aria-pressed="${pressed}"`}>${gE(label)}</button>`;
const gBadge = (label, status) => `<span class="autosmm-badge" data-state="${gE(status)}">${gE(label)}</span>`;

function autoGiftMarkup(plugin) {
  if (plugin.id !== autoGiftId || !plugin.installed) return '';
  if (autoGift.scope !== autoGiftScope()) {
    Object.assign(autoGift, { scope: autoGiftScope(), revision: autoGift.revision + 1, data: null, busy: false, error: '',
      tab: 'orders', order: '', draft: {}, intent: null });
  }
  if (!autoGift.data && !autoGift.error && !autoGift.busy && authState.token) {
    const scope = autoGift.scope;
    queueMicrotask(() => { if (scope === autoGiftScope()) void autoGiftRequest('status'); });
  }
  const data = autoGift.data;
  return `<section class="autosmm-panel" data-auto-gift aria-label="Управление Auto GIFT" aria-busy="${autoGift.busy}">
    <div class="autosmm-fallback autosmm-bar" role="group" aria-label="Разделы Auto GIFT">
      ${gButton('Очередь', 'tab', 'orders', false, autoGift.tab === 'orders')}
      ${gButton('Настройки', 'tab', 'settings', false, autoGift.tab === 'settings')}
    </div>
    ${autoGiftPane('orders', 'Очередь Auto GIFT', data)}
    ${autoGiftPane('settings', 'Настройки Auto GIFT', data)}
  </section>`;
}

function autoGiftPane(tab, title, data) {
  return `<section class="plugin-page-panel autosmm-pane" data-gift-tab="${tab}" data-smm-active="${autoGift.tab === tab}">
    <header class="autosmm-head"><div><h2>${title}</h2>${data ? gBadge(autoGiftModes[data.mode], data.mode) : ''}</div>${gButton('Обновить', 'reload')}</header>
    ${autoGift.error ? `<p class="autosmm-warning" role="alert">${gE(autoGift.error)}</p>` : ''}
    ${!data ? (autoGift.error ? '' : '<p role="status">Проверяем состояние Auto GIFT…</p>') : `
      <dl class="autosmm-facts"><div><dt>Баланс бота</dt><dd>${data.telegram ? gE(data.telegram.balance) + ' ⭐' : 'Проверить'}</dd></div>
      <div><dt>Привязки</dt><dd>${data.mappings.length}</dd></div><div><dt>Лимит на заказ</dt><dd>${gE(data.orderBudget || 'Не задан')}${data.orderBudget ? ' ⭐' : ''}</dd></div></dl>
      ${!data.workerEnabled || !data.sendEnabled || !data.buyerMessagesEnabled ? '<p class="autosmm-warning">Выдача пока недоступна. Можно подготовить настройки и проверить бота.</p>'
        : data.mode !== 'paused' && !data.baselineReady ? '<p role="status">Ждём первой синхронизации. Auto GIFT возьмёт в работу новые оплаты.</p>' : ''}
      ${autoGift.intent?.tab === tab ? `<div class="autosmm-confirm" role="group" aria-labelledby="gift-confirmation"><strong id="gift-confirmation" tabindex="-1">${gE(autoGift.intent.question)}</strong>
        <div class="autosmm-bar">${gButton('Подтвердить', 'confirm', '', true)}${gButton('Отмена', 'cancel')}</div></div>` : ''}
      ${tab === 'orders' ? autoGiftOrders(data) : autoGiftSettings(data)}`}
  </section>`;
}

function autoGiftOrders(data) {
  const task = data.tasks.find(order => order.id === autoGift.order);
  const operations = task?.reason === 'GIFT_LINK_EXPIRED' ? ['reissue'] :
    ({ review: ['approve', 'stop'], waiting_recipient: ['reissue', 'stop'], queued: ['stop'], blocked: task?.canRetry ? ['retry', 'stop'] : ['stop'],
      uncertain: ['verify-sent', 'stop'] })[task?.status] || [];
  const order = task ? `<div class="autosmm-provider autosmm-detail">
    <h3 tabindex="-1">Заказ #${gE(task.orderId)}</h3>
    ${gBadge(autoGiftStatuses[task.status] || task.status, task.status)}
    <dl class="autosmm-facts"><div><dt>Отправлено</dt><dd>${task.sent} из ${task.gifts}</dd></div>
    <div><dt>Списано</dt><dd>${gE(task.spent)} ⭐</dd></div><div><dt>Лот FunPay</dt><dd>${gE(task.lotId || '—')}</dd></div></dl>
    ${task.reason ? `<p>${gE(autoGiftIssues[task.reason] || 'Откройте заказ для проверки.')}</p>` : ''}
    ${task.failedGift ? `<p>Требует сверки подарок №${task.failedGift.position}, ${task.failedGift.stars} ⭐.</p>` : ''}
    ${task.reconciliation ? `<p>В проверенной истории Stars возможных совпадений: ${task.reconciliation.matches}. Подтвердите результат после сверки.</p>` : ''}
    ${task.noticeUnconfirmed ? '<p>Доставка сообщения в чате FunPay не подтверждена.</p>' : ''}
    ${task.journal?.length ? `<details><summary>История отправки</summary><ol>${task.journal.map(item =>
      `<li>Подарок №${item.position} · ${item.stars} ⭐ · ${item.verified ? 'Подтверждён продавцом' : 'Подтверждён Telegram'}</li>`).join('')}</ol></details>` : ''}
    <div class="autosmm-bar"><a href="https://funpay.com/orders/${encodeURIComponent(task.orderId)}/" target="_blank" rel="noopener noreferrer">Открыть заказ на FunPay ↗</a>
    ${task.status === 'uncertain' ? gButton('Проверить списания Stars', 'check-stars') : ''}
    ${operations.map(action => gButton(autoGiftActions[action][0], 'order-action', action)).join('')}</div>
  </div>` : '';
  const list = data.tasks.map(item => `<button class="autosmm-order" type="button" data-gift-action="order" data-gift-value="${gE(item.id)}"
    aria-pressed="${autoGift.order === item.id}"><strong>#${gE(item.orderId)}</strong>${gBadge(autoGiftStatuses[item.status] || item.status, item.status)}
    <small>${item.sent} из ${item.gifts}</small></button>`).join('');
  return list ? `<div class="autosmm-queue"><div class="autosmm-order-list" aria-label="Заказы">${list}</div>${order}</div>`
    : '<p class="autosmm-empty">Заказов пока нет. Привяжите лот и выберите режим выдачи в настройках.</p>';
}

function autoGiftSettings(data) {
  const paused = data.mode === 'paused';
  const draft = autoGift.draft;
  const gifts = data.telegram?.gifts || [];
  const lotOptions = (typeof state !== 'undefined' ? state.lots || [] : []).filter(lot => /^\d+$/.test(String(lot.id))).slice(0, 250)
    .map(lot => `<option value="${gE(lot.id)}">${gE(lot.title || lot.description || '')}</option>`).join('');
  const options = chosen => gifts.map(gift => `<option value="${gE(gift.id)}" ${chosen === gift.id ? 'selected' : ''}>${gE(gift.emoji)} · ${gE(gift.stars)} ⭐${gift.remaining !== null ? ` · осталось ${gE(gift.remaining)}` : ''}</option>`).join('');
  const selections = (draft.gifts || ['']).map((id, index) =>
    `<label class="field">Подарок ${index + 1}<select class="input" name="gift" required><option value="">Выберите из каталога</option>${options(id)}</select></label>`).join('');
  const quote = (draft.gifts || []).reduce((sum, id) => sum + (gifts.find(gift => gift.id === id)?.stars || 0), 0);
  return `<div class="autosmm-settings">
    <div class="autosmm-bar">${gButton('Проверить Telegram и Stars', 'diagnose')}${gButton('С проверкой', 'mode', 'review')}
      ${gButton('Автоматически', 'mode', 'auto')}${gButton('Пауза', 'mode', 'paused')}</div>
    ${!data.botConnected || !data.storeId ? '<p>Подключите магазин FunPay и активируйте персонального бота в профиле.</p>' : ''}
    ${!paused ? '<p>Чтобы изменить лимиты и наборы, поставьте выдачу на паузу.</p>' : ''}
    <form data-gift-form="budgets"><fieldset class="autosmm-provider" ${paused ? '' : 'disabled'}>
      <legend>Лимиты Stars</legend>
      <label class="field">На заказ<input class="input" name="orderBudget" type="number" min="1" max="100000" required value="${gE(data.orderBudget || '')}"></label>
      <label class="field">На сутки<input class="input" name="dailyBudget" type="number" min="1" max="1000000" required value="${gE(data.dailyBudget || '')}"></label>
      <button type="submit" class="button button--primary">Сохранить лимиты</button>
    </fieldset></form>
    <form data-gift-form="mapping"><fieldset class="autosmm-provider" ${paused && gifts.length && data.storeId ? '' : 'disabled'}>
      <legend>Привязка подарков к лоту</legend>
      <label class="field">Номер лота FunPay<input class="input" name="lotId" list="auto-gift-lots" required inputmode="numeric" pattern="[1-9][0-9]{0,19}" value="${gE(draft.lotId)}"></label>
      <datalist id="auto-gift-lots">${lotOptions}</datalist>
      ${selections}<p>За одну единицу лота${quote ? ' · ' + quote + ' ⭐' : ''}</p>
      <div class="autosmm-bar">${(draft.gifts || ['']).length < 10 ? gButton('Добавить в набор', 'more') : ''}${draft.gifts?.length > 1 ? gButton('Убрать последний', 'less') : ''}
      <button type="submit" class="button button--primary">Сохранить привязку</button></div>
    </fieldset></form>
    <div class="autosmm-mappings">${data.mappings.map(item => `<article><span><strong>Лот ${gE(item.lotId)}</strong><small>${item.giftIds.length} шт. · ${gE(item.cost)} ⭐</small></span>
      ${paused ? `<div class="autosmm-bar">${gButton('Изменить', 'edit', item.lotId)}${gButton('Удалить', 'remove', item.lotId)}</div>` : ''}</article>`).join('')}</div>
  </div>`;
}

function autoGiftRender() {
  if (location.hash.startsWith('#plugins/' + autoGiftId)) renderPluginPage();
}

async function autoGiftRequest(action, body = {}) {
  if (!authState.token || autoGift.busy || autoGift.scope !== autoGiftScope()) return;
  const scope = autoGift.scope;
  const revision = ++autoGift.revision;
  autoGift.busy = true;
  autoGift.error = '';
  const panel = document.querySelector('[data-auto-gift]');
  panel?.setAttribute('aria-busy', 'true');
  panel?.setAttribute('inert', '');
  const current = () => scope === autoGiftScope() && revision === autoGift.revision;
  try {
    const options = { authenticated: true, signal: AbortSignal.timeout(30000) };
    const data = await apiRequest('/api/v1/plugins/auto-gift/' + (action === 'status' ? 'status' : 'action'),
      action === 'status' ? options : { ...options, method: 'POST', body: { action, body } });
    if (!current()) return;
    autoGift.data = data;
    if (action === 'mapping') autoGift.draft = {};
  } catch (error) {
    if (current()) autoGift.error = humanError(error);
  } finally {
    if (current()) {
      autoGift.busy = false;
      panel?.removeAttribute('inert');
      autoGiftRender();
    }
  }
}

function rememberAutoGiftDraft() {
  const form = document.querySelector('[data-gift-form="mapping"]');
  if (!form || form.querySelector('fieldset')?.disabled) return;
  const values = new FormData(form);
  autoGift.draft = { lotId: values.get('lotId'), gifts: values.getAll('gift') };
}

document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-auto-gift] [data-gift-action]');
  if (!button || autoGift.busy || autoGift.scope !== autoGiftScope()) return;
  const { giftAction: action, giftValue: value } = button.dataset;
  rememberAutoGiftDraft();
  if (action === 'reload') return void autoGiftRequest('status');
  if (action === 'diagnose') return void autoGiftRequest('diagnose');
  if (action === 'check-stars') return void autoGiftRequest('task', { id: autoGift.order, operation: action });
  if (action === 'confirm' && autoGift.intent) {
    const { action, body } = autoGift.intent;
    autoGift.intent = null;
    return void autoGiftRequest(action, body);
  }
  autoGift.intent = null;
  if (action === 'tab') autoGift.tab = value;
  if (action === 'order') autoGift.order = value;
  if (action === 'more') autoGift.draft.gifts.push('');
  if (action === 'less') autoGift.draft.gifts.pop();
  if (action === 'edit') {
    const item = autoGift.data.mappings.find(item => item.lotId === value);
    autoGift.draft = { lotId: item.lotId, gifts: item.giftIds };
  }
  if (action === 'remove') autoGift.intent = { tab: 'settings', action, body: { lotId: value }, question: 'Удалить привязку? История заказа сохранится.' };
  if (action === 'mode') {
    if (value === 'paused') return void autoGiftRequest('mode', { mode: value });
    autoGift.intent = { tab: 'settings', action, body: { mode: value, confirmed: true }, question: `Включить режим «${autoGiftModes[value]}» с расходом Stars в пределах лимитов?` };
  }
  if (action === 'order-action') autoGift.intent = {
    tab: 'orders', action: 'task', body: { id: autoGift.order, operation: value, confirmed: true }, question: autoGiftActions[value][1],
  };
  autoGiftRender();
  if (autoGift.intent) document.getElementById('gift-confirmation')?.focus();
  else if (action === 'order') document.querySelector('[data-auto-gift] .autosmm-detail h3')?.focus();
  else if (action === 'tab') document.querySelector('[data-auto-gift] [data-gift-action="tab"][aria-pressed="true"]')?.focus();
});

document.addEventListener('submit', event => {
  const form = event.target.closest?.('[data-auto-gift] [data-gift-form]');
  if (!form) return;
  event.preventDefault();
  if (autoGift.busy || autoGift.scope !== autoGiftScope()) return;
  const values = new FormData(form);
  rememberAutoGiftDraft();
  if (form.dataset.giftForm === 'mapping') {
    void autoGiftRequest('mapping', { lotId: values.get('lotId'), giftIds: values.getAll('gift') });
  } else {
    void autoGiftRequest('budgets', { orderBudget: Number(values.get('orderBudget')), dailyBudget: Number(values.get('dailyBudget')) });
  }
});
