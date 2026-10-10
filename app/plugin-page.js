/* Dedicated plugin pages use only the existing authenticated catalog. */
const pluginPageState = { loaded: false, error: '', actionError: '', actionErrorId: null, busyId: null, generation: null };
const PLUGIN_CATEGORIES = Object.freeze({ sales: 'Продажи', chat: 'Общение', analytics: 'Аналитика', control: 'Контроль' });
const PLUGIN_PERMISSION_LABELS = Object.freeze({
  'messages:read': ['Читать сообщения', 'Получать события сообщений покупателей.'],
  'orders:read': ['Читать заказы', 'Получать события оплаченных заказов.'],
  'replies:queue': ['Ставить ответы в очередь', 'Предлагать ответы. Confirm Reminder и Review Reminder отправляют свои напоминания после отдельного разрешения.'],
  'telegram:send': ['Уведомлять в Telegram', 'Передавать уведомления подключённому владельцу магазина.']
});
const PLUGIN_EVENT_LABELS = Object.freeze({ 'message.received': 'Новое сообщение', 'order.paid': 'Оплаченный заказ' });

function parsePluginPageRoute(value) {
  if (!String(value).startsWith('plugins/')) return null;
  let id;
  try { id = decodeURIComponent(value.slice(8)); } catch { id = ''; }
  return { id: /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(id) && id.length <= 100 ? id : '' };
}

function pluginPageHref(id) { return `#plugins/${encodeURIComponent(id)}`; }

function pluginCoverSource(plugin) {
  const cover = String(plugin.cover || '');
  if (typeof isPluginCoverDataUrl === 'function' && isPluginCoverDataUrl(cover)) return cover;
  const category = Object.hasOwn(PLUGIN_CATEGORIES, plugin.category) ? plugin.category : 'control';
  return plugin.id === 'zetslay.mass-price-editor' ? 'assets/plugin-covers/mass-price-editor.svg' : `assets/plugin-covers/${category}.svg`;
}

function pluginDisplayStatus(plugin) {
  if (plugin.published === false) return ['Черновик', 'muted'];
  if (plugin.planned) return ['Скоро', 'muted'];
  if (plugin.active) return ['Включён', 'green'];
  if (plugin.installed) return ['На паузе', 'blue'];
  return ['Не установлен', 'muted'];
}

function renderPluginAdminControls() {
  const allowed = canManagePluginCatalog();
  const target = document.querySelector('[data-plugin-admin-controls]');
  if (target) {
    target.hidden = !allowed;
    target.innerHTML = allowed ? `<span class="plugin-admin-label">Администратор</span><button class="button button--ghost" type="button" data-plugin-cover-admin aria-pressed="${state.pluginCoverAdmin}">${icon('external')} Обложки</button><button class="button button--primary" type="button" data-plugin-publish>${icon('plus')} Добавить плагин</button><p class="plugin-cover-guidance">Исходная рамка 4:2,9 · изображение целиком. Например, 1200 × 870 px. Кнопка + под обложкой загружает PNG, JPEG или WebP до 10 МБ; оригиналы до 2 МБ и 4096 px — без пересжатия.</p>` : '';
  }
  // Also hide any controls retained by an older VPS template.
  document.querySelectorAll('[data-plugin-cover-admin], [data-plugin-publish], [data-plugin-edit], [data-cover-plugin]').forEach(button => { button.hidden = !allowed; });
  const dialog = document.querySelector('[data-plugin-dialog]');
  if (!allowed && dialog?.querySelector('[data-plugin-editor]')) { closePluginDialog(); dialog.querySelector('[data-plugin-dialog-body]').innerHTML = ''; }
}

function resetPluginPageState() {
  Object.assign(pluginPageState, { loaded: false, error: '', actionError: '', actionErrorId: null, busyId: null, generation: sessionGeneration });
}

function pluginCatalogLoaded() {
  pluginPageState.loaded = true;
  pluginPageState.error = '';
  pluginPageState.generation = sessionGeneration;
}

function pluginCatalogFailed(error) {
  if (pluginPageState.generation !== sessionGeneration) resetPluginPageState();
  pluginPageState.error = humanError(error);
  renderPluginAdminControls();
  renderPluginPage();
}

function pluginPageEmpty(title, description, retry = false) {
  return `<div class="plugin-page-empty">${icon('puzzle')}<h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p>${retry ? '<button class="button button--primary" type="button" data-plugin-page-retry>Повторить загрузку</button>' : ''}<a class="plugin-page-back" href="#plugins">Вернуться в каталог</a></div>`;
}

function pluginPageMarkup(plugin) {
  const [status, tone] = pluginDisplayStatus(plugin);
  const busy = pluginPageState.busyId === plugin.id;
  const pending = pluginPageState.busyId !== null;
  const actionError = pluginPageState.actionErrorId === plugin.id ? pluginPageState.actionError : '';
  const available = !plugin.planned && plugin.published !== false;
  const action = busy ? 'Сохраняем…' : plugin.planned ? 'Пока недоступен' : plugin.published === false ? 'Черновик' : plugin.active ? 'Отключить плагин' : plugin.installed ? 'Включить плагин' : 'Установить и включить';
  const summary = String(plugin.description || '').replace(/^>\s?/gm, '').replace(/\*\*/g, '').split(/\r?\n/).find(line => line.trim()) || 'Подробности модуля ZetSlay';
  const permissions = Array.isArray(plugin.permissionsRaw || plugin.permissions) ? (plugin.permissionsRaw || plugin.permissions) : [];
  const events = Array.isArray(plugin.events) ? plugin.events : [];
  const manage = canManagePluginCatalog();
  const configuration = '';
  return `<a class="plugin-page-back" href="#plugins">${icon('chevron-right')} Назад в каталог</a>
    <header class="plugin-page-heading"><div><div class="plugin-page-tags"><span>${escapeHtml(PLUGIN_CATEGORIES[plugin.category] || 'Плагин')}</span><span class="plugin-page-status plugin-page-status--${tone}"><i></i>${status}</span></div><h1 id="plugin-page-title">${escapeHtml(plugin.name)}</h1><p>${escapeHtml(summary)}</p></div><span class="plugin-page-brand" aria-hidden="true">${icon('puzzle')}</span></header>
    <div class="plugin-page-layout"><div class="plugin-page-main">
      <section class="plugin-page-panel" aria-labelledby="plugin-description-title"><div class="plugin-page-section-heading"><span class="plugin-page-section-icon">${icon('list')}</span><div><span class="plugin-page-eyebrow">О модуле</span><h2 id="plugin-description-title">Возможности плагина</h2></div></div><div class="plugin-page-description">${formatPluginDescription(plugin.description)}</div></section>
      <section class="plugin-page-panel" aria-labelledby="plugin-access-title"><div class="plugin-page-section-heading"><span class="plugin-page-section-icon plugin-page-section-icon--blue">${icon('shield')}</span><div><span class="plugin-page-eyebrow">Доступ</span><h2 id="plugin-access-title">Разрешения и события</h2></div></div><div class="plugin-page-permissions">${permissions.map(permission => { const label = PLUGIN_PERMISSION_LABELS[permission] || [permission, 'Разрешение объявлено модулем.']; return `<div>${icon('check')}<span><strong>${escapeHtml(label[0])}</strong><small>${escapeHtml(label[1])}</small></span></div>`; }).join('') || '<p>Модуль не запрашивает событийных разрешений.</p>'}</div>${!['zetslay.lot-cloner','zetslay.mass-price-editor','zetslay.sales-pause'].includes(plugin.id) && events.length ? `<div class="plugin-page-events"><span>Запускается по событиям</span>${events.map(event => `<strong>${escapeHtml(PLUGIN_EVENT_LABELS[event] || event)}</strong>`).join('')}</div>` : ''}</section>
      ${plugin.id === 'zetslay.confirm-reminder' && typeof reminderSettingsMarkup === 'function' ? reminderSettingsMarkup(plugin) : ''}
      ${plugin.id === 'zetslay.review-reminder' && typeof reviewSettingsMarkup === 'function' ? reviewSettingsMarkup(plugin) : ''}
      ${plugin.id === 'zetslay.auto-review-bonus' && typeof bonusSettingsMarkup === 'function' ? bonusSettingsMarkup(plugin) : ''}
      ${plugin.id === 'zetslay.lot-cloner' ? lotClonerGuideMarkup(plugin) : ''}
      ${plugin.id === 'zetslay.mass-price-editor' ? massPriceGuideMarkup(plugin) : ''}
      ${plugin.id === 'zetslay.sales-pause' && typeof salesPauseGuideMarkup === 'function' ? salesPauseGuideMarkup(plugin) : ''}
      ${plugin.id === 'zetslay.kosell-rent' && typeof kosellRentMarkup === 'function' ? kosellRentMarkup(plugin) : ''}
      ${plugin.id === 'zetslay.steam-rent' && typeof steamRentMarkup === 'function' ? steamRentMarkup(plugin) : ''}
      ${plugin.id === 'zetslay.robux-relay' && typeof robuxSettingsMarkup === 'function' ? robuxSettingsMarkup(plugin) : ''}
      ${plugin.id === 'zetslay.stars-relay' && typeof starsSettingsMarkup === 'function' ? starsSettingsMarkup(plugin) : ''}
      ${plugin.id === 'zetslay.roblox-lzt-market' && typeof robloxSettingsMarkup === 'function' ? robloxSettingsMarkup(plugin) : ''}
      ${plugin.id === 'zetslay.tiktok-lzt-market' && typeof tiktokSettingsMarkup === 'function' ? tiktokSettingsMarkup(plugin) : ''}
    </div><aside class="plugin-page-sidebar" aria-label="Плагин в вашем кабинете"><section class="plugin-page-panel plugin-page-action"><span class="plugin-page-eyebrow">В вашем кабинете</span><div class="plugin-page-price">${escapeHtml(plugin.price || 'Цена не указана')}</div><p class="plugin-page-price-note">Цена из каталога. Покупка плагинов пока не подключена.</p><div class="plugin-page-action-status"><span>Состояние</span><strong class="plugin-page-status plugin-page-status--${tone}"><i></i>${status}</strong></div><button class="button ${plugin.active ? 'button--ghost' : 'button--primary'} button--wide" type="button" data-plugin-id="${escapeHtml(plugin.id)}" ${!available || pending ? 'disabled' : ''} aria-busy="${busy}">${action}${icon(plugin.active ? 'pause' : 'plus')}</button>${plugin.id === 'zetslay.confirm-reminder' && plugin.installed && typeof reminderSettingsMarkup === 'function' ? `<button class="plugin-page-settings" type="button" data-reminder-open-settings>${icon('gear')} Настройки напоминаний</button>` : ''}${plugin.id === 'zetslay.review-reminder' && plugin.installed && typeof reviewSettingsMarkup === 'function' ? `<button class="plugin-page-settings" type="button" data-review-open-settings>${icon('gear')} Настройки отзывов</button>` : ''}${configuration && plugin.installed ? `<button class="plugin-page-settings" type="button" data-plugin-open-settings="${escapeHtml(configuration)}">${icon('gear')} Настройки плагина</button>` : ''}<p class="plugin-page-action-error" role="alert" ${actionError ? '' : 'hidden'}>${escapeHtml(actionError)}</p>${plugin.planned ? '<p class="plugin-page-note">Модуль ещё в разработке. Установка станет доступна после его выпуска.</p>' : ''}${manage ? `<div class="plugin-page-admin"><span>Управление карточкой</span><button class="button button--ghost button--wide" type="button" data-cover-plugin="${escapeHtml(plugin.id)}">${icon('external')} Изменить обложку в каталоге</button><button class="button button--ghost button--wide" type="button" data-plugin-edit="${escapeHtml(plugin.id)}">${icon('list')} Редактировать описание</button></div>` : ''}</section>
      <section class="plugin-page-panel plugin-page-context"><span class="plugin-page-section-icon plugin-page-section-icon--green">${icon('shield')}</span><h2>Контроль остаётся у вас</h2><p>Вы можете остановить модуль в кабинете. ${['zetslay.robux-relay','zetslay.tiktok-lzt-market','zetslay.roblox-lzt-market'].includes(plugin.id) ? 'Новая покупка запрещена при неопределённом списании. Выдача засчитывается после подтверждения сообщения. Лимиты и автопокупка включаются отдельно.' : plugin.id === 'zetslay.steam-rent' ? 'Приём оплаченных заказов включается отдельно. Неизвестный результат удерживает аккаунт; выдача и завершение сохраняются до внешнего запроса. При отключении модуля или окончании тарифа вручную закройте действующие доступы Steam.' : plugin.id === 'zetslay.kosell-rent' ? 'Автопокупка включается отдельно. Цена и покупатель проверяются перед выдачей. Неизвестный результат списания запрещает автоматический повтор; операции с арендой требуют подтверждения.' : plugin.id === 'zetslay.sales-pause' ? 'Отключение и восстановление лотов запускаются вручную после сводки и подтверждения. Список сохраняется в базе. Неизвестный результат останавливает задачу; проверка статусов не выполняет повторную запись.' : plugin.id === 'zetslay.mass-price-editor' ? 'Переоценка запускается вручную в вашем боте после расчёта и подтверждения. Стоп прекращает следующие изменения. При неизвестном результате записи выполнение останавливается.' : plugin.id === 'zetslay.lot-cloner' ? 'Создание запускается вручную в вашем боте после подтверждения. Копия выключена; исходный лот не меняется. При неизвестном результате автоматический повтор запрещён.' : plugin.id === 'zetslay.review-reminder' ? 'Перед каждым напоминанием проверяется отзыв и статус заказа. Отзыв или возврат отменяет оставшиеся отправки.' : plugin.id === 'zetslay.confirm-reminder' ? 'Отправка включается отдельно. Перед каждым напоминанием проверяется заказ; после подтверждения или возврата сообщения прекращаются.' : 'Предложенные ответы этого модуля поступают в очередь. Автоматическая доставка доступна для Confirm Reminder и Review Reminder после отдельного разрешения.'}</p><a href="#plugins">Каталог плагинов ${icon('chevron-right')}</a></section>
      <div class="plugin-page-id"><span>ID модуля</span><code>${escapeHtml(plugin.id)}</code></div>
    </aside></div>`;
}

function renderPluginPage() {
  const root = document.querySelector('[data-plugin-page]');
  if (!root) return;
  const route = parsePluginPageRoute(location.hash.slice(1));
  if (!route) { root.innerHTML = ''; return; }
  if (pluginPageState.generation !== sessionGeneration) resetPluginPageState();
  if (!authState.user) { root.innerHTML = pluginPageEmpty('Войдите в кабинет', 'Страница плагина станет доступна после входа.'); return; }
  if (pluginPageState.error) { root.innerHTML = pluginPageEmpty('Каталог не загрузился', pluginPageState.error, true); return; }
  if (!pluginPageState.loaded) { root.innerHTML = pluginPageEmpty('Загружаем плагин', 'Получаем актуальное описание и состояние из каталога.'); return; }
  const plugin = state.plugins.find(item => item.id === route.id && !item.planned && !String(item.id).startsWith('planned.') && !['zetslay.auto-reply', 'zetslay.telegram-notifications'].includes(item.id) && (item.published !== false || canManagePluginCatalog()));
  if (!plugin) { root.innerHTML = pluginPageEmpty('Плагин не найден', 'Карточка могла быть снята с публикации. Выберите другой модуль в каталоге.'); return; }
  document.title = `${plugin.name} — Плагины ZetSlay`;
  root.innerHTML = pluginPageMarkup(plugin);
  if (typeof fitPluginDetailCover === 'function') root.querySelectorAll?.('img[data-plugin-cover-detail]')?.forEach(fitPluginDetailCover);
}

function claimPluginAction(pluginId) {
  if (pluginPageState.generation !== sessionGeneration) resetPluginPageState();
  if (pluginPageState.busyId) return false;
  pluginPageState.busyId = pluginId;
  pluginPageState.actionError = '';
  pluginPageState.actionErrorId = pluginId;
  renderPlugins();
  return true;
}

function releasePluginAction(pluginId) {
  if (pluginPageState.busyId === pluginId) pluginPageState.busyId = null;
  renderPlugins();
}

document.addEventListener('click', event => {
  const retry = event.target.closest('[data-plugin-page-retry]');
  if (retry && !retry.disabled) {
    retry.disabled = true;
    retry.textContent = 'Загружаем…';
    loadPluginCatalog().catch(() => {}).finally(() => { if (retry.isConnected) { retry.disabled = false; retry.textContent = 'Повторить загрузку'; } });
  }
  const reminderSettings = event.target.closest('[data-reminder-open-settings]');
  if (reminderSettings) {
    const panel = document.querySelector('[data-reminder-panel]');
    panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    panel?.querySelector('select, input, textarea')?.focus({ preventScroll: true });
    return;
  }
  const reviewSettings = event.target.closest('[data-review-open-settings]');
  if (reviewSettings) {
    const panel = document.querySelector('[data-review-panel]');
    panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    panel?.querySelector('input, select, textarea')?.focus({ preventScroll: true });
    return;
  }
});
document.addEventListener('error', event => {
  const image = event.target;
  if (!image.matches?.('img[data-plugin-cover]') || image.dataset.coverFallback) return;
  image.dataset.coverFallback = 'true';
  image.src = pluginCoverSource({ category: image.dataset.coverCategory });
}, true);

// LOT_CLONER_GUIDE_START
function lotClonerGuideMarkup(plugin) {
  return `<section class="plugin-page-panel lot-cloner-guide" data-lot-cloner-guide aria-labelledby="lot-cloner-title"><div class="plugin-page-section-heading"><span class="plugin-page-section-icon">${icon('puzzle')}</span><div><h2 id="lot-cloner-title">Создайте копию в своём боте</h2></div></div><div class="plugin-page-description"><p>${plugin.active ? 'Плагин включён. Откройте личного Telegram-бота подключённого магазина.' : 'Сначала установите и включите плагин, затем откройте личного Telegram-бота магазина.'}</p><ol><li>Отправьте <code>/clone_lot 1234567</code>, заменив число на ID своего лота. Команда <code>/clone_lot</code> также откроет ввод ID.</li><li>Проверьте название, цену и число изображений. Нажмите «Создать выключенную копию».</li><li>Откройте созданное предложение по ссылке из бота. Проверьте его перед ручной активацией.</li></ol><blockquote>Копируются русские и английские заголовки и описания, цена, публичные параметры и изображения по сохранённым ID. Лоты с автовыдачей не поддерживаются; товары, секреты и сообщения после оплаты не переносятся.</blockquote><p>Пометка «(Копия)» добавляется к русскому заголовку. Изменение оригинала отменяет подтверждение. Если результат создания неизвестен, сначала проверьте «Мои предложения» на FunPay. События заказов не запускают клонирование.</p></div></section>`;
}
// LOT_CLONER_GUIDE_END

// MASS_PRICE_GUIDE_START
function massPriceGuideMarkup(plugin) {
  const modes=[['Фиксированная цена','Единая стоимость для группы товаров','100.00 → 500.00'],['Прибавить сумму','Учтите выросшие затраты: +50','100.00 → 150.00'],['Отнять сумму','Подготовьте акцию: −25','100.00 → 75.00'],['Повысить на процент','Переоцените категорию: +10%','100.00 → 110.00'],['Понизить на процент','Запустите скидку: −5%','100.00 → 95.00']];
  const botName=typeof state!=='undefined' ? String(state.onboarding?.telegram?.bot?.username||'') : '';
  const botLink=/^[a-zA-Z0-9_]{5,32}$/.test(botName)?`https://t.me/${botName}`:null;
  return `<section class="mass-price-guide" data-mass-price-guide aria-labelledby="mass-price-guide-title"><div class="mass-price-guide__intro"><span class="mass-price-guide__mark">${icon('chart')}</span><div><h2 id="mass-price-guide-title">Ваши цены. Один понятный запуск.</h2><p>Выберите товары, проверьте расчёт и подтвердите переоценку. Массовое обновление с контролем каждого лота.</p></div></div><div class="mass-price-guide__modes">${modes.map(([name,text,example])=>`<article class="mass-price-guide__mode"><strong>${name}</strong><span>${text}</span><code>${example}</code></article>`).join('')}</div><h3>От выбора до результата</h3><ol class="mass-price-guide__steps"><li><div><strong>Игра и разделы</strong>Отметьте нужные категории в подключённом боте. «Выбрать всё» действует на текущую страницу.</div></li><li><div><strong>Действие и значение</strong>Сумма — в валюте лота, процент — числом. Можно вернуться назад и поменять выбор.</div></li><li><div><strong>Проверьте «было → станет»</strong>Бот рассчитывает каждый лот, показывает первые восемь примеров и число товаров. Изменение цен начинается после вашего подтверждения.</div></li><li><div><strong>Следите за переоценкой</strong>Прогресс, успехи, пропуски и ошибки обновляются в боте. Стоп прекращает следующие изменения.</div></li></ol><div class="mass-price-guide__command"><code>/mass_price_editor</code>${botLink?`<a href="${botLink}" target="_blank" rel="noopener noreferrer">Открыть своего бота ↗</a>`:'<span>Команда для вашего подключённого бота</span>'}</div><p>${plugin.active?'Модуль включён. Откройте своего рабочего бота и отправьте команду.':'Сначала установите и включите модуль кнопкой на этой странице.'}</p><div class="mass-price-guide__note">До 500 обычных лотов за запуск. Игровая валюта (chips) исключена. Округление до копеек, минимум 0.01. Описания, изображения, активность и параметры автовыдачи сохраняются. Лот, изменённый после расчёта, пропускается. Отправленный до остановки запрос может завершиться; автоматического отката нет. При неизвестном результате проверьте указанный лот на FunPay.</div></section>`;
}
// MASS_PRICE_GUIDE_END
