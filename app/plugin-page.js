/* Dedicated plugin pages use only the existing authenticated catalog. */
const pluginPageState = { loaded: false, error: '', actionError: '', actionErrorId: null, busyId: null, generation: null };
const PLUGIN_CATEGORIES = Object.freeze({ sales: 'Продажи', chat: 'Общение', analytics: 'Аналитика', control: 'Контроль' });
const PLUGIN_PERMISSION_LABELS = Object.freeze({
  'messages:read': ['Читать сообщения', 'Получать события сообщений покупателей.'],
  'orders:read': ['Читать заказы', 'Получать события оплаченных заказов.'],
  'replies:queue': ['Ставить ответы в очередь', 'Предлагать ответы. Confirm Reminder может отправлять свои напоминания после отдельного разрешения.'],
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
  return `assets/plugin-covers/${category}.svg`;
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
    target.innerHTML = allowed ? `<span class="plugin-admin-label">Администратор</span><button class="button button--ghost" type="button" data-plugin-cover-admin aria-pressed="${state.pluginCoverAdmin}">${icon('external')} Обложки</button><button class="button button--primary" type="button" data-plugin-publish>${icon('plus')} Добавить плагин</button><p class="plugin-cover-guidance">Рамка 16:9 · изображение целиком. PNG, JPEG или WebP до 10 МБ; оригиналы до 2 МБ и 4096 px — без пересжатия.</p>` : '';
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
  const configuration = plugin.id === 'zetslay.auto-reply' ? '[data-plugin-settings]' : plugin.id === 'zetslay.telegram-notifications' ? '[data-telegram-settings]' : '';
  return `<a class="plugin-page-back" href="#plugins">${icon('chevron-right')} Назад в каталог</a>
    <header class="plugin-page-heading"><div><div class="plugin-page-tags"><span>${escapeHtml(PLUGIN_CATEGORIES[plugin.category] || 'Плагин')}</span><span class="plugin-page-status plugin-page-status--${tone}"><i></i>${status}</span></div><h1 id="plugin-page-title">${escapeHtml(plugin.name)}</h1><p>${escapeHtml(summary)}</p></div><span class="plugin-page-brand" aria-hidden="true">${icon('puzzle')}</span></header>
    <div class="plugin-page-layout"><div class="plugin-page-main">
      <figure class="plugin-page-cover"><div class="plugin-page-cover__frame"><img data-plugin-cover data-cover-category="${escapeHtml(plugin.category)}" src="${escapeHtml(pluginCoverSource(plugin))}" alt="Обложка плагина ${escapeHtml(plugin.name)}" decoding="async"></div><figcaption><span>Модуль ZetSlay</span>${manage ? `<button type="button" data-cover-plugin="${escapeHtml(plugin.id)}">${icon('external')} Изменить обложку</button>` : ''}</figcaption></figure>
      <section class="plugin-page-panel" aria-labelledby="plugin-description-title"><div class="plugin-page-section-heading"><span class="plugin-page-section-icon">${icon('list')}</span><div><span class="plugin-page-eyebrow">О модуле</span><h2 id="plugin-description-title">Возможности плагина</h2></div></div><div class="plugin-page-description">${formatPluginDescription(plugin.description)}</div></section>
      <section class="plugin-page-panel" aria-labelledby="plugin-access-title"><div class="plugin-page-section-heading"><span class="plugin-page-section-icon plugin-page-section-icon--blue">${icon('shield')}</span><div><span class="plugin-page-eyebrow">Доступ</span><h2 id="plugin-access-title">Разрешения и события</h2></div></div><div class="plugin-page-permissions">${permissions.map(permission => { const label = PLUGIN_PERMISSION_LABELS[permission] || [permission, 'Разрешение объявлено модулем.']; return `<div>${icon('check')}<span><strong>${escapeHtml(label[0])}</strong><small>${escapeHtml(label[1])}</small></span></div>`; }).join('') || '<p>Разрешения появятся после регистрации модуля.</p>'}</div>${events.length ? `<div class="plugin-page-events"><span>Запускается по событиям</span>${events.map(event => `<strong>${escapeHtml(PLUGIN_EVENT_LABELS[event] || event)}</strong>`).join('')}</div>` : ''}</section>
      ${plugin.id === 'zetslay.confirm-reminder' && typeof reminderSettingsMarkup === 'function' ? reminderSettingsMarkup(plugin) : ''}
    </div><aside class="plugin-page-sidebar" aria-label="Плагин в вашем кабинете"><section class="plugin-page-panel plugin-page-action"><span class="plugin-page-eyebrow">В вашем кабинете</span><div class="plugin-page-price">${escapeHtml(plugin.price || 'Цена не указана')}</div><p class="plugin-page-price-note">Цена из каталога. Покупка плагинов пока не подключена.</p><div class="plugin-page-action-status"><span>Состояние</span><strong class="plugin-page-status plugin-page-status--${tone}"><i></i>${status}</strong></div><button class="button ${plugin.active ? 'button--ghost' : 'button--primary'} button--wide" type="button" data-plugin-id="${escapeHtml(plugin.id)}" ${!available || pending ? 'disabled' : ''} aria-busy="${busy}">${action}${icon(plugin.active ? 'pause' : 'plus')}</button>${plugin.id === 'zetslay.confirm-reminder' && plugin.installed && typeof reminderSettingsMarkup === 'function' ? `<button class="plugin-page-settings" type="button" data-reminder-open-settings>${icon('gear')} Настройки напоминаний</button>` : ''}${configuration && plugin.installed ? `<button class="plugin-page-settings" type="button" data-plugin-open-settings="${escapeHtml(configuration)}">${icon('gear')} Настройки плагина</button>` : ''}<p class="plugin-page-action-error" role="alert" ${actionError ? '' : 'hidden'}>${escapeHtml(actionError)}</p>${plugin.planned ? '<p class="plugin-page-note">Модуль ещё в разработке. Установка станет доступна после его выпуска.</p>' : ''}${manage ? `<div class="plugin-page-admin"><span>Управление карточкой</span><button class="button button--ghost button--wide" type="button" data-plugin-edit="${escapeHtml(plugin.id)}">${icon('list')} Редактировать описание</button></div>` : ''}</section>
      <section class="plugin-page-panel plugin-page-context"><span class="plugin-page-section-icon plugin-page-section-icon--green">${icon('shield')}</span><h2>Контроль остаётся у вас</h2><p>Вы можете остановить модуль в кабинете. ${plugin.id === 'zetslay.confirm-reminder' ? 'Отправка включается отдельно. Перед каждым напоминанием проверяется заказ; после подтверждения или возврата сообщения прекращаются.' : 'Предложенные ответы этого модуля поступают в очередь. Автоматическая доставка доступна только для Confirm Reminder после отдельного разрешения.'}</p><a href="#plugins">Настройки и журнал ${icon('chevron-right')}</a></section>
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
  const plugin = state.plugins.find(item => item.id === route.id && (item.published !== false || canManagePluginCatalog()));
  if (!plugin) { root.innerHTML = pluginPageEmpty('Плагин не найден', 'Карточка могла быть снята с публикации. Выберите другой модуль в каталоге.'); return; }
  document.title = `${plugin.name} — Плагины ZetSlay`;
  root.innerHTML = pluginPageMarkup(plugin);
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
  const settings = event.target.closest('[data-plugin-open-settings]');
  if (settings) {
    location.hash = '#plugins';
    const selector = settings.dataset.pluginOpenSettings;
    if (!['[data-plugin-settings]', '[data-telegram-settings]'].includes(selector)) return;
    window.setTimeout(() => { const form = document.querySelector(selector); form?.scrollIntoView({ behavior: 'smooth', block: 'center' }); form?.querySelector('textarea, input')?.focus({ preventScroll: true }); }, 0);
  }
});
document.addEventListener('error', event => {
  const image = event.target;
  if (!image.matches?.('img[data-plugin-cover]') || image.dataset.coverFallback) return;
  image.dataset.coverFallback = 'true';
  image.src = pluginCoverSource({ category: image.dataset.coverCategory });
}, true);
