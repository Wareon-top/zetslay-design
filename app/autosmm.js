/* Cabinet console for AutoSMM. API keys are submitted once and never kept in this view state. */
const autoSmmView = { token: null, sequence: 0, data: null, loading: false, busy: false, error: '', notice: '',
  tab: 'queue', filter: 'attention', selected: null, intent: null, search: null, mapping: {} };
const autoSmmMode = { paused: 'На паузе', review: 'С проверкой продавца', auto: 'Автоматически' };
const autoSmmStates = {
  discovering: 'Проверяем заказ', waiting_link: 'Ждём ссылку', waiting_confirmation: 'Ждём подтверждение покупателя',
  review: 'Нужна ваша проверка', queued: 'В очереди на отправку', blocked: 'Остановлен до проверки',
  sending: 'Отправляется', processing: 'У поставщика', completed: 'Готово у поставщика',
  uncertain: 'Нужна сверка списания', partial: 'Выполнен частично', canceled: 'Отменён', provider_failed: 'Отклонён поставщиком',
};
const autoSmmIssues = {
  SMM_UNCERTAIN: 'Сверьте списание, время и получателя в панели. После сверки привяжите найденный номер.',
  SMM_INSUFFICIENT: 'На балансе поставщика недостаточно средств. Пополните его и верните заказ на проверку.',
  SMM_LIMIT: 'Цена выше лимита заказа или суточного потолка.',
  SMM_RATE_CHANGED: 'Изменилась валюта или стоимость. Проверьте свежий расчёт и условия привязки.',
  SMM_SERVICE: 'Услуга исчезла из каталога или изменился допустимый диапазон.',
  SMM_SETTINGS_CHANGED: 'Привязка, режим или магазин изменились до отправки.',
  SMM_ORDER_CHANGED: 'Оплата или данные заказа на FunPay изменились. Откройте заказ и проверьте его.',
  FULFILLMENT_CONFLICT: 'У этого лота или заказа уже есть другой исполнитель.',
  SMM_UNAVAILABLE: 'Поставщик не ответил. Статус можно проверить ещё раз.',
  SMM_READ_FAILED: 'Не удалось перечитать данные заказа на FunPay.',
  SMM_QUANTITY_OR_DETAILS: 'Количество вне диапазона услуги или у заказа нет полного набора данных.',
};
const autoSmmPath = '/api/v1/plugins/auto-smm/';
function autoSmmReset() {
  Object.assign(autoSmmView, { token: authState.token, sequence: autoSmmView.sequence + 1, data: null,
    loading: false, busy: false, error: '', notice: '', tab: 'queue', filter: 'attention',
    selected: null, intent: null, search: null, mapping: {} });
}
const autoSmmEscape = value => escapeHtml(String(value ?? ''));
const autoSmmButton = (name, action, value, primary = false) =>
  `<button type="button" class="button button--${primary ? 'primary' : 'ghost'}" data-smm-action="${action}" data-smm-value="${autoSmmEscape(value)}" ${autoSmmView.busy ? 'disabled' : ''}>${autoSmmEscape(name)}</button>`;
const autoSmmChoice = (name, action, value, selected) =>
  `<button type="button" class="button button--ghost" data-smm-action="${action}" data-smm-value="${value}" aria-pressed="${selected}" ${autoSmmView.busy ? 'disabled' : ''}>${autoSmmEscape(name)}</button>`;
const autoSmmBadge = (label, state) =>
  `<span class="autosmm-badge" data-state="${autoSmmEscape(state)}">${autoSmmEscape(label)}</span>`;

function autoSmmConfirmation() {
  const { intent } = autoSmmView;
  return intent ? `<div class="autosmm-confirm" role="group" aria-labelledby="autosmm-confirm-title"><strong id="autosmm-confirm-title" tabindex="-1">${autoSmmEscape(intent.text)}</strong><div class="autosmm-bar">${autoSmmButton('Подтвердить', 'accept', '', true)}${autoSmmButton('Отмена', 'dismiss')}</div></div>` : '';
}

function autoSmmMarkup(plugin) {
  if (plugin.id !== 'zetslay.auto-smm' || !plugin.installed) return '';
  const v = autoSmmView;
  if (v.token !== authState.token) autoSmmReset();
  if (!v.data && !v.error && !v.loading) {
    v.loading = true;
    queueMicrotask(() => autoSmmRequest('status'));
  }
  const s = v.data;
  const note = v.error || v.notice || (s && (!s.runnable
    ? 'Для обработки заказов проверьте подключение магазина, разрешения и состояние плагина.'
    : !s.purchaseEnabled ? 'Отправка заказов поставщику выключена администратором.'
    : s.mode !== 'paused' && !s.baselineReady ? 'Ждём первой синхронизации FunPay. В обработку попадут новые заказы.' : ''));
  const toolbar = `<div class="autosmm-head autosmm-toolbar">
    <div>${s ? autoSmmBadge(autoSmmMode[s.mode], s.mode) : v.loading ? '<span role="status" class="autosmm-note">Загружаем AutoSMM…</span>' : ''}</div>
    ${autoSmmButton('Обновить', 'reload')}
  </div><p class="autosmm-note" role="status">${autoSmmEscape(note)}</p>`;
  return `<section class="autosmm-panel" aria-label="Управление AutoSMM" data-autosmm aria-busy="${v.busy}">
    <div class="autosmm-fallback autosmm-bar" role="group" aria-label="Разделы AutoSMM">
      ${autoSmmChoice('Очередь', 'tab', 'queue', v.tab === 'queue')}
      ${autoSmmChoice('Настройки', 'tab', 'settings', v.tab === 'settings')}
    </div>
    <section class="plugin-page-panel autosmm-pane" data-smm-active="${v.tab === 'queue'}">
      <h2 hidden>Очередь заказов</h2>${toolbar}${s ? autoSmmQueue(s) : ''}
    </section>
    <section class="plugin-page-panel autosmm-pane" data-smm-active="${v.tab === 'settings'}">
      <h2 hidden>Настройки</h2>${toolbar}${s ? autoSmmSettings(s) : ''}
    </section>
  </section>`;
}
function autoSmmQueue(s) {
  const v = autoSmmView;
  const list = v.filter === 'attention' ? s.attention : s.orders;
  const task = [...s.orders, ...s.attention].find(item => item.id === v.selected);
  const empty = v.filter === 'attention' ? 'Сейчас нет заказов, которые требуют вашего внимания.' : 'Здесь появятся заказы по привязанным лотам FunPay.';
  return `<div class="autosmm-queue" ${task ? 'data-order-open' : ''}><section class="plugin-page-panel autosmm-card">
    <h2>Заказы</h2><div class="autosmm-bar" role="group" aria-label="Фильтр заказов">
    ${autoSmmChoice(`Требуют внимания (${s.attention.length})`, 'filter', 'attention', v.filter === 'attention')}
    ${autoSmmChoice('Последние заказы', 'filter', 'all', v.filter === 'all')}</div>
    <div class="autosmm-order-list">${list.map(item => `<button type="button" class="autosmm-order" data-smm-action="open" data-smm-value="${autoSmmEscape(item.id)}" aria-pressed="${item.id === v.selected}">
      <span><strong>#${autoSmmEscape(item.orderId)}</strong><small>${autoSmmEscape(s.panels.find(p => p.id === item.panelId)?.name || 'FunPay')}${item.quantity ? ' · ' + autoSmmEscape(item.quantity) + ' ед.' : ''}</small></span>
      ${autoSmmBadge(autoSmmStates[item.status], item.status)}
    </button>`).join('') || `<p class="autosmm-empty">${empty}</p>`}</div></section>
    ${task ? autoSmmOrder(s, task) : ''}</div>`;
}
function autoSmmOrder(s, task) {
  const status = task.status;
  const retry = ['SMM_UNAVAILABLE','SMM_READ_FAILED','SMM_INSUFFICIENT','SMM_LIMIT','SMM_RATE_CHANGED','SMM_SERVICE'].includes(task.issue);
  return `<section class="plugin-page-panel autosmm-card autosmm-detail"><header class="autosmm-head"><div><h2 tabindex="-1">Заказ #${autoSmmEscape(task.orderId)}</h2>${autoSmmBadge(autoSmmStates[status], status)}</div>
    <a class="button button--ghost" href="https://funpay.com/orders/${autoSmmEscape(task.orderId)}/" target="_blank" rel="noopener noreferrer">Открыть FunPay ↗</a></header>
    <dl class="autosmm-facts">
      <div><dt>Количество</dt><dd>${autoSmmEscape(task.quantity ?? '—')}</dd></div>
      <div><dt>Расчёт</dt><dd>${task.quoted ? autoSmmEscape(task.quoted + ' ' + task.currency) : '—'}</dd></div>
      <div><dt>Списано</dt><dd>${task.charge ? autoSmmEscape(task.charge + ' ' + task.currency) : '—'}</dd></div>
      <div><dt>У поставщика</dt><dd>${autoSmmEscape(task.providerOrderId || '—')}</dd></div>
    </dl>
    ${task.remains !== null && task.remains !== undefined ? `<p>Осталось выполнить: ${autoSmmEscape(task.remains)}.</p>` : ''}
    ${task.issue ? `<p class="autosmm-warning">${autoSmmEscape(autoSmmIssues[task.issue] || 'Проверьте состояние заказа и панель поставщика.')}</p>` : ''}
    <div class="autosmm-bar">
      ${status === 'review' && s.mode !== 'paused' ? autoSmmButton('Разрешить отправку', 'task-intent', 'approve', true) : ''}
      ${status === 'blocked' && retry ? autoSmmButton('Вернуть на проверку', 'task', 'retry') : ''}
      ${status === 'processing' ? autoSmmButton('Проверить статус', 'task', 'refresh') : ''}
      ${['review','queued','waiting_link','waiting_confirmation','blocked'].includes(status) ? autoSmmButton('Пропустить', 'task-intent', 'skip') : ''}
    </div>
    ${autoSmmView.intent?.action === 'task' ? autoSmmConfirmation() : ''}
    ${status === 'uncertain' ? `<form data-smm-form="reconcile"><fieldset ${autoSmmView.busy ? 'disabled' : ''}><legend>Привязать подтверждённый номер</legend>
      <label class="field">Номер в панели<input class="input" name="providerOrderId" autocomplete="off" inputmode="numeric" pattern="[1-9][0-9]{0,17}" required></label>
      <label class="autosmm-check"><input name="verified" type="checkbox" required>Я сверил заказ, получателя, время и сумму</label>
      <button type="submit" class="button button--primary">Сверить и привязать</button></fieldset></form>` : ''}
    <details><summary>История заказа</summary><ol class="autosmm-timeline">${(task.events || []).map(event => `<li><time datetime="${autoSmmEscape(event.at)}">${autoSmmEscape(new Date(event.at).toLocaleString('ru-RU'))}</time><span>${autoSmmEscape(autoSmmStates[event.status] || 'Проверка')}</span></li>`).join('')}</ol></details>
  </section>`;
}
function autoSmmSettings(s) {
  const v = autoSmmView, m = v.mapping, options = s.panels.filter(p => p.connected);
  const selected = m.panelId || options[0]?.id || '';
  const panel = s.panels.find(p => p.id === selected);
  const inventory = typeof currentLotsModel === 'function' ? currentLotsModel() : null;
  const knownLots = inventory?.loaded && typeof selectedStore === 'function' && String(selectedStore()?.id) === s.storeId
    ? inventory.lots.filter(lot => /^[1-9][0-9]{0,17}$/.test(lot.id)).slice(0, 250) : [];
  const fields = (name, label, placeholder = '', extra = '') =>
    `<label class="field">${label}<input class="input" name="${name}" value="${autoSmmEscape(m[name])}" placeholder="${placeholder}" autocomplete="off" required ${extra}></label>`;
  return `<div class="autosmm-settings">
    <section class="plugin-page-panel autosmm-card"><h2>Приём заказов</h2><p>В режиме проверки вы разрешаете каждый заказ. В автоматическом режиме достаточно подтверждения покупателя и проверки лимитов.</p>
      <div class="autosmm-bar" role="group" aria-label="Режим приёма">${Object.entries(autoSmmMode).map(([id, label]) => autoSmmChoice(label, 'mode', id, id === s.mode)).join('')}</div>
      ${v.intent?.action === 'mode' ? autoSmmConfirmation() : ''}</section>
    <section class="plugin-page-panel autosmm-card"><h2>Поставщики</h2><div class="autosmm-provider-grid">${s.panels.map(p => `<article class="autosmm-provider">
      <header class="autosmm-head"><h3>${autoSmmEscape(p.name)}</h3>${autoSmmBadge(p.connected ? 'Подключён' : 'Не подключён', p.connected ? 'connected' : 'paused')}</header>
      ${p.connected ? `<dl class="autosmm-facts"><div><dt>Баланс</dt><dd>${autoSmmEscape(p.balance.amount + ' ' + p.balance.currency)}</dd></div><div><dt>Услуг</dt><dd>${autoSmmEscape(p.serviceCount)}</dd></div></dl>` : ''}
      ${p.checkedAt ? `<small>Проверено ${autoSmmEscape(new Date(p.checkedAt).toLocaleString('ru-RU'))}</small>` : ''}
      ${p.spendingSuspended ? '<p class="autosmm-warning">Новые списания на паузе. Сверьте фактическую сумму в панели.</p>' : ''}
      <div class="autosmm-bar">
        ${p.connected ? autoSmmButton('Проверить баланс', 'panel-refresh', p.id) : ''}
        ${p.spendingSuspended && s.mode === 'paused' ? autoSmmButton('Снять ограничение', 'panel-resume', p.id) : ''}
        ${p.connected && s.mode === 'paused' && !s.mappings.some(m => m.panelId === p.id) ? autoSmmButton('Отключить', 'panel-disconnect', p.id) : ''}
      </div>
      ${v.intent?.body.panelId === p.id ? autoSmmConfirmation() : ''}
      <details><summary>${p.connected ? 'Заменить API-ключ' : 'Подключить'}</summary>
        <form data-smm-form="panel" data-smm-panel="${p.id}"><fieldset ${v.busy ? 'disabled' : ''}>
          <label class="field">API-ключ<input class="input" type="password" name="key" minlength="8" maxlength="256" autocomplete="new-password" required></label>
          <button type="submit" class="button button--primary">Проверить и сохранить</button>
        </fieldset></form></details></article>`).join('')}</div></section>
    <section class="plugin-page-panel autosmm-card"><h2>Привязки лотов</h2><p>${s.storeId ? 'Укажите номер действующего лота. Количество услуги на единицу умножается на количество единиц в заказе.' : 'Подключите магазин FunPay, чтобы добавлять привязки.'}</p>
      ${options.length && s.storeId ? `<form data-smm-form="mapping" class="autosmm-binding"><fieldset ${v.busy ? 'disabled' : ''}>
        <label class="field">Поставщик<select class="input" name="panelId">${options.map(p => `<option value="${p.id}" ${selected === p.id ? 'selected' : ''}>${autoSmmEscape(p.name)}</option>`).join('')}</select></label>
        ${fields('lotId','Лот FunPay','Номер или выбор из списка','inputmode="numeric" pattern="[1-9][0-9]{0,17}" list="autosmm-funpay-lots"')}
        <datalist id="autosmm-funpay-lots">${knownLots.map(lot => `<option value="${autoSmmEscape(lot.id)}">${autoSmmEscape(lot.title)}</option>`).join('')}</datalist>
        ${fields('serviceId','Номер услуги','Из каталога панели','inputmode="numeric" pattern="[1-9][0-9]{0,17}"')}
        ${fields('unitsPerItem','Количество на единицу','Например, 100','type="number" min="1" max="10000000"')}
        <label class="field">Домен ссылки<select class="input" name="allowedDomain">${s.domains.map(domain => `<option ${m.allowedDomain === domain ? 'selected' : ''}>${autoSmmEscape(domain)}</option>`).join('')}</select></label>
        ${fields('maxCost',`Лимит на заказ, ${autoSmmEscape(panel?.balance.currency)}`,'0.50','inputmode="decimal"')}
        ${fields('dailyLimit',`Лимит на сутки, ${autoSmmEscape(panel?.balance.currency)}`,'5.00','inputmode="decimal"')}
        <button type="submit" class="button button--primary">Сохранить привязку</button>
      </fieldset></form>
      <form data-smm-form="search"><label class="field">Поиск услуги<input class="input" name="query" maxlength="120" placeholder="Название, категория или номер"></label><button type="submit" class="button button--ghost" ${v.busy ? 'disabled' : ''}>Найти</button></form>
      ${v.search ? `<div class="autosmm-services">${v.search.map(item => `<div><span><strong>${autoSmmEscape(item.name)}</strong><small>#${item.id} · ${item.min}–${item.max} · ${autoSmmEscape(item.rate)} / 1000</small></span>
        ${autoSmmButton('Выбрать', 'service', item.id)}</div>`).join('') || '<p class="autosmm-empty">Услуги не найдены. Измените запрос или обновите каталог.</p>'}</div>` : ''}` : ''}
      <div class="autosmm-mappings">${s.mappings.map(item => `<article><span><strong>Лот ${autoSmmEscape(item.lotId)} → ${autoSmmEscape(item.serviceName)}</strong><small>${item.unitsPerItem} ед. · ${autoSmmEscape(item.allowedDomain)} · заказ до ${autoSmmEscape(item.maxCost + ' ' + item.currency)}${item.enabled ? '' : ' · На паузе'}</small></span><div class="autosmm-bar">
        ${autoSmmButton('Изменить', 'mapping-edit', item.lotId)}${autoSmmButton(item.enabled ? 'Пауза' : 'Включить', 'mapping-toggle', item.lotId)}${s.mode === 'paused' ? autoSmmButton('Удалить привязку', 'mapping-remove', item.lotId) : ''}</div>
        ${v.intent?.body.lotId === item.lotId ? autoSmmConfirmation() : ''}</article>`).join('')}</div></section>
  </div>`;
}
function autoSmmRender() {
  if (location.hash.includes('zetslay.auto-smm')) renderPluginPage();
}
async function autoSmmRequest(action, body = {}) {
  const v = autoSmmView;
  if (!authState.token || v.busy || v.token !== authState.token) return;
  const sequence = ++v.sequence;
  v.busy = true; v.error = ''; v.notice = '';
  const section = document.querySelector('[data-autosmm]');
  if (section) section.setAttribute('inert', '');
  try {
    const signal = AbortSignal.timeout(35000);
    const result = await apiRequest(autoSmmPath + (action === 'status' ? 'status' : 'action'), action === 'status'
      ? { authenticated: true, signal } : { authenticated: true, method: 'POST', body: { action, body }, signal });
    if (sequence !== v.sequence || v.token !== authState.token) return;
    if (action === 'services') v.search = result.services;
    else v.data = result;
    if (action === 'mapping') { v.mapping = {}; v.search = null; }
    if (action !== 'status' && action !== 'services') v.notice = 'Изменения сохранены.';
  } catch (error) {
    if (sequence === v.sequence && v.token === authState.token) v.error = humanError(error);
  } finally {
    if (sequence === v.sequence) { v.busy = false; v.loading = false; section?.removeAttribute('inert'); autoSmmRender(); }
  }
}
function autoSmmRememberMapping() {
  const form = document.querySelector('[data-smm-form="mapping"]');
  if (form) autoSmmView.mapping = Object.fromEntries(new FormData(form));
}
document.addEventListener('change', event => {
  const field = event.target;
  if (field.name === 'panelId' && field.closest?.('[data-smm-form="mapping"]')) {
    autoSmmRememberMapping();
    autoSmmView.mapping.serviceId = '';
    autoSmmView.search = null;
    autoSmmRender();
  }
});
document.addEventListener('click', event => {
  const element = event.target.closest?.('[data-autosmm] [data-smm-action]');
  if (!element || autoSmmView.busy) return;
  const v = autoSmmView, action = element.dataset.smmAction, value = element.dataset.smmValue;
  autoSmmRememberMapping();
  v.notice = ''; v.error = '';
  if (action === 'reload') return void autoSmmRequest('status');
  if (action === 'panel-refresh') return void autoSmmRequest('refresh-panel', { panelId: value });
  if (action === 'panel-disconnect') v.intent = { action: 'disconnect-panel', body: { panelId: value }, text: 'Отключить поставщика и удалить сохранённый API-ключ?' };
  if (action === 'panel-resume') v.intent = { action: 'resume-panel', body: { panelId: value, verified: true }, text: 'Вы проверили фактические списания и согласны снять ограничение?' };
  if (action === 'mapping-toggle') return void autoSmmRequest('mapping-toggle', { lotId: value, enabled: !v.data.mappings.find(m => m.lotId === value)?.enabled });
  if (action === 'task') return void autoSmmRequest('task', { id: v.selected, action: value });
  if (action === 'mode' && value !== 'auto') return void autoSmmRequest('mode', { mode: value });
  if (action === 'accept' && v.intent) {
    const intent = v.intent; v.intent = null; return void autoSmmRequest(intent.action, intent.body);
  }
  if (action === 'dismiss') v.intent = null;
  if (action === 'tab') { v.tab = value; v.intent = null; }
  if (action === 'filter') { v.filter = value; v.selected = null; v.intent = null; }
  if (action === 'open') { v.selected = value; v.intent = null; }
  if (action === 'mapping-edit') { v.mapping = { ...v.data.mappings.find(m => m.lotId === value) }; v.search = null; }
  if (action === 'mapping-remove') v.intent = { action: 'mapping-remove', body: { lotId: value }, text: 'Удалить привязку? История заказов сохранится.' };
  if (action === 'service') v.mapping.serviceId = value;
  if (action === 'mode') v.intent = { action: 'mode', body: { mode: value }, text: 'Разрешить отправку новых заказов после подтверждения покупателем?' };
  if (action === 'task-intent') v.intent = { action: 'task', body: { id: v.selected, action: value },
    text: value === 'approve' ? 'Разрешить отправку после проверки суммы, оплаты и лимитов?' : 'Убрать заказ из автоматической обработки?' };
  autoSmmRender();
  if (action === 'open') document.querySelector('[data-autosmm] .autosmm-detail h2')?.focus();
  else if (v.intent) document.getElementById('autosmm-confirm-title')?.focus();
  else if (action === 'tab' || action === 'filter') {
    document.querySelector(`[data-autosmm] [data-smm-action="${action}"][aria-pressed="true"]`)?.focus();
  }
});
document.addEventListener('submit', event => {
  const form = event.target.closest?.('[data-autosmm] [data-smm-form]');
  if (!form) return;
  event.preventDefault();
  if (autoSmmView.busy) return;
  const vals = new FormData(form);
  switch (form.dataset.smmForm) {
    case 'panel': {
      const key = vals.get('key'); form.reset(); void autoSmmRequest('panel', { panelId: form.dataset.smmPanel, key }); break;
    }
    case 'mapping':
      autoSmmRememberMapping(); void autoSmmRequest('mapping', autoSmmView.mapping); break;
    case 'search':
      autoSmmRememberMapping(); void autoSmmRequest('services', { panelId: autoSmmView.mapping.panelId, query: vals.get('query') }); break;
    case 'reconcile':
      void autoSmmRequest('task', { id: autoSmmView.selected, action: 'reconcile', providerOrderId: vals.get('providerOrderId'), verified: vals.has('verified') }); break;
  }
});
const autoSmmPreviousRender = renderPluginPage;
renderPluginPage = function () {
  if (autoSmmView.token !== authState.token) autoSmmReset();
  return autoSmmPreviousRender.apply(this, arguments);
};
