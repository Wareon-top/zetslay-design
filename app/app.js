const state = {
  orders: [],
  conversations: [],
  lots: [],
  automations: [],
  plugins: [
  ],
  pluginFilter: { cat: 'all', query: '', sort: 'default' },
  pluginCoverAdmin: false,
  pluginCanManage: false,
  pluginCatalogRevision: 0,
  proxyDiagnostics: null,
  pluginAudit: [],
  storeFleet: { selectedStoreId: null, capacity: { used: 0, limit: 1 }, liveActionsEnabled: false, stores: [] },
  finance: { stores: [], withdrawalIntents: [], liveWithdrawalEnabled: false },
  storeContent: { observedAt: null, orders: [], messages: [], lots: [] },
  onboarding: null,
  analytics: [],
  products: [],
  events: [],
};

const viewTitles = {
  dashboard: 'Обзор', orders: 'Заказы', messages: 'Сообщения', lots: 'Лоты и товары',
  plugins: 'Плагины', plugin: 'Плагин', telegram: 'Telegram', billing: 'Финансы', security: 'Безопасность',
  guide: 'База знаний', profile: 'Профиль', author: 'Карточка автора',
};

const iconNames = {
  'alert-triangle': 'help', 'arrow-up': 'external', automation: 'bolt',
  'chevron-right': 'chevron', 'file-text': 'list', lot: 'box', message: 'chat',
  'message-square': 'chat', 'more-horizontal': 'more', order: 'bag', package: 'box',
  'refresh-cw': 'bolt', sparkles: 'bolt', system: 'grid', 'trending-up': 'chart',
  users: 'user', warning: 'help', zap: 'bolt',
};
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${iconNames[name] || name}"></use></svg>`;
const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
// Optional dev override: open the cabinet with ?api=http://host:port to point it
// at a running backend (stored in localStorage; use ?api=clear to reset).
const localCabinet = ['localhost', '127.0.0.1'].includes(location.hostname);
const apiOverrideRaw = localCabinet ? new URLSearchParams(location.search).get('api') : null;
if (!localCabinet || apiOverrideRaw === 'clear') {
  localStorage.removeItem('zetslay_api_base_url');
} else if (apiOverrideRaw) {
  try {
    const parsedOverride = new URL(apiOverrideRaw);
    if (['http:', 'https:'].includes(parsedOverride.protocol) && ['localhost', '127.0.0.1'].includes(parsedOverride.hostname)) {
      localStorage.setItem('zetslay_api_base_url', `${parsedOverride.protocol}//${parsedOverride.host}`);
    }
  } catch { /* ignore malformed override */ }
}
const configuredApiUrl = ((localCabinet && localStorage.getItem('zetslay_api_base_url')) || document.querySelector('meta[name="zetslay-api-base-url"]')?.content || '').replace(/\/$/, '');
const API_BASE_URL = !['localhost', '127.0.0.1'].includes(location.hostname) && /localhost|127\.0\.0\.1/.test(configuredApiUrl) ? '' : configuredApiUrl;
const authState = { mode: 'login', token: sessionStorage.getItem('zetslay_session') || '', user: null, workspace: null };
let sessionGeneration = 0;

const errorMessages = {
  API_URL_MISSING: 'Backend ZetSlay ещё не подключён к опубликованному кабинету.',
  INVALID_SESSION: 'Сессия истекла. Войдите в аккаунт ещё раз.',
  PLAN_REQUIRED: 'Для этого действия нужен активный тариф.',
  INVALID_STATE: 'Действие недоступно в текущем состоянии магазина.',
  AUTH_REJECTED: 'Golden Key отклонён или устарел. Получите новый ключ и повторите подключение.',
  PROXY_UNAVAILABLE: 'Не удалось выполнить запрос через прокси. Нажмите «Диагностика прокси».',
  PROXY_TIMEOUT: 'Истекло время ожидания при соединении через прокси. Диагностика покажет этап остановки.',
  PROXY_AUTH_REJECTED: 'Прокси отклонил авторизацию (HTTP 407). Проверьте логин, пароль и режим доступа.',
  PROXY_TLS_REJECTED: 'Ошибка TLS при подключении через прокси. Проверка сертификатов остаётся включённой.',
  PROXY_CONNECTION_REFUSED: 'Соединение отклонено. Проверьте адрес и порт прокси.',
  PROXY_DNS_FAILED: 'Не удалось разрешить сетевой адрес при подключении через прокси.',
  CAPTCHA_REQUIRED: 'FunPay запросил CAPTCHA. ZetSlay остановил подключение — подтвердите вход вручную.',
  RATE_LIMITED: 'Слишком много запросов. Подождите и повторите попытку.',
  TELEGRAM_BOT_REJECTED: 'Bot Token не прошёл проверку Telegram.',
  TELEGRAM_REJECTED: 'Telegram отклонил регистрацию webhook. Проверьте доступность HTTPS API и повторите попытку.',
  TELEGRAM_UNAVAILABLE: 'Telegram API сейчас недоступен. Повторите подключение позже.',
  EMAIL_VERIFICATION_REQUIRED: 'Подтвердите email по ссылке из письма.',
  EMAIL_DELIVERY_UNAVAILABLE: 'Регистрация по email временно недоступна. Можно войти через Telegram или повторить позже.',
};
const humanError = (error) => errorMessages[error?.code] || (error?.message === 'Failed to fetch' ? 'Backend ZetSlay недоступен. Проверьте адрес API и состояние сервера.' : error?.message) || 'Не удалось выполнить действие.';
let registrationEmail = '';

async function apiRequest(path, { method = 'GET', body, authenticated = false } = {}) {
  if (!API_BASE_URL) { const error = new Error('API_URL_MISSING'); error.code = 'API_URL_MISSING'; throw error; }
  const headers = { accept: 'application/json' };
  if (body) headers['content-type'] = 'application/json';
  if (authenticated && authState.token) headers.authorization = `Bearer ${authState.token}`;
  const response = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || 'Запрос отклонён');
    error.code = payload.error?.code || `HTTP_${response.status}`;
    throw error;
  }
  return payload.data;
}

function accountInitials(email = '') {
  return email.split('@')[0].slice(0, 2).toUpperCase() || 'ZL';
}

function renderAuthState() {
  const email = authState.user?.email || '';
  const accountName = email || (authState.user ? 'Telegram-аккаунт' : 'Войти');
  document.querySelectorAll('[data-auth-name]').forEach((node) => { node.textContent = accountName; });
  document.querySelectorAll('[data-auth-avatar]').forEach((node) => { node.textContent = accountInitials(accountName); });
  if (typeof renderCabinetTopbar === 'function') renderCabinetTopbar();
  const sidebar = document.querySelector('.user-card');
  if (sidebar) {
    sidebar.querySelector('strong').textContent = accountName;
    sidebar.querySelector('small').textContent = authState.user ? 'Защищённая сессия' : 'Войти в ZetSlay';
    sidebar.querySelector('.user-card__avatar').textContent = accountInitials(accountName);
  }
  const form = document.querySelector('[data-auth-form]');
  const session = document.querySelector('[data-auth-session]');
  if (form) form.hidden = Boolean(authState.user);
  if (session) {
    session.hidden = !authState.user;
    session.querySelector('[data-auth-session-email]').textContent = accountName;
    session.querySelector('[data-auth-session-avatar]').textContent = accountInitials(accountName);
  }
  document.querySelector('.app-shell')?.toggleAttribute('hidden', !authState.user);
  document.querySelectorAll('[data-auth-only]').forEach((node) => { node.hidden = Boolean(authState.user); });
  if (authState.user) document.querySelector('[data-telegram-login-status]')?.setAttribute('hidden', '');
  renderDashboard();
  const account = document.querySelector('[data-security-account]');
  if (account) account.textContent = authState.user ? `${accountName} · сессия активна` : 'Войдите в аккаунт.';
  if (typeof renderProfile === 'function') renderProfile();
}

function setAuthMode(mode) {
  authState.mode = mode === 'register' ? 'register' : 'login';
  const title = byId('auth-modal-title');
  const submit = document.querySelector('[data-auth-submit]');
  const password = document.querySelector('[data-auth-form] input[name="password"]');
  const intro = document.querySelector('.auth-intro');
  const switchButton = document.querySelector('[data-auth-switch]');
  const switchCopy = document.querySelector('[data-auth-switch-copy]');
  if (title) title.textContent = authState.mode === 'register' ? 'Создать аккаунт' : 'Вход в кабинет';
  if (submit) submit.textContent = authState.mode === 'register' ? 'Зарегистрироваться' : 'Войти';
  if (intro) intro.textContent = authState.mode === 'register'
    ? 'Укажите email и пароль. Письмо подтверждения сейчас не требуется — вход откроется сразу.'
    : 'Войдите, чтобы продолжить работу с вашим магазином.';
  if (switchButton) {
    switchButton.dataset.authMode = authState.mode === 'register' ? 'login' : 'register';
    switchButton.textContent = authState.mode === 'register' ? 'Войти' : 'Создать аккаунт';
  }
  if (switchCopy) switchCopy.textContent = authState.mode === 'register' ? 'Уже есть аккаунт?' : 'Ещё нет аккаунта?';
  document.querySelectorAll('[data-auth-mode]').forEach((button) => button.classList.toggle('is-active', button.dataset.authMode === authState.mode));
  if (password) {
    password.value = '';
    password.type = 'password';
    password.autocomplete = authState.mode === 'register' ? 'new-password' : 'current-password';
  }
  const reveal = document.querySelector('[data-password-toggle]');
  if (reveal) {
    reveal.setAttribute('aria-pressed', 'false');
    reveal.setAttribute('aria-label', 'Показать пароль');
  }
  const message = document.querySelector('[data-auth-message]');
  if (message) { message.textContent = ''; message.className = 'auth-message'; }
  const resend = document.querySelector('[data-auth-resend]');
  if (resend) resend.hidden = true;
}

function setAuthModal(open) {
  if (!open && !authState.user) return;
  const modal = document.querySelector('.auth-modal');
  const backdrop = document.querySelector('.auth-backdrop');
  if (!modal) return;
  if (open) {
    modal.hidden = false;
    renderAuthState();
  }
  requestAnimationFrame(() => {
    modal.classList.toggle('is-open', open);
    backdrop?.classList.toggle('is-open', open);
  });
  document.body.classList.toggle('modal-open', open);
  if (!open) window.setTimeout(() => { if (!modal.classList.contains('is-open')) modal.hidden = true; }, 220);
}

function resetAccountData() {
  if (typeof resetLotsWorkspace === 'function') resetLotsWorkspace();
  if (typeof resetProfileState === 'function') resetProfileState();
  connectionBusy = false;
  connectionError = '';
  connectionResetTarget = null;
  state.orders = [];
  state.conversations = [];
  state.lots = [];
  state.analytics = [];
  state.products = [];
  state.events = [];
  state.storeContent = { observedAt: null, orders: [], messages: [], lots: [] };
  state.storeFleet = { selectedStoreId: null, capacity: { used: 0, limit: 1 }, liveActionsEnabled: false, stores: [] };
  state.finance = { stores: [], withdrawalIntents: [], liveWithdrawalEnabled: false };
  state.onboarding = null;
  state.proxyDiagnostics = null;
  state.pluginAudit = [];
  resetPluginCatalog();
  renderStoreFleet();
  renderOrders();
  renderConversations();
  renderLots();
  renderAnalytics();
  renderEvents();
  renderFinance();
  renderPluginAudit();
  renderTelegramOnboarding();
}

function clearSession() {
  sessionGeneration++;
  stopConnectionLinkPolling();
  connectionStatus = null;
  authState.token = '';
  authState.user = null;
  authState.workspace = null;
  sessionStorage.removeItem('zetslay_session');
  resetAccountData();
  renderAuthState();
  setAuthMode('login');
  setAuthModal(true);
}

async function loadAccountData() {
  const generation = ++sessionGeneration;
  const tasks = [loadPluginCatalog, loadPluginAudit, loadStoreFleet, loadFinance, loadOnboarding];
  if (typeof loadProfile === 'function') tasks.push(loadProfile);
  const results = await Promise.allSettled(tasks.map((task) => task()));
  if (generation !== sessionGeneration) return;
  const errors = results.filter((result) => result.status === 'rejected');
  if (errors.length) showToast('Часть данных кабинета недоступна. Проверьте соединение и обновите страницу.', 'error');
  await syncStoreContent({ silent: true }).catch(() => {});
}

async function acceptSession(session) {
  if (!session?.token || !session?.user) throw new Error('Сервер не вернул сессию');
  resetAccountData();
  authState.token = session.token;
  authState.user = session.user;
  authState.workspace = session.workspace || null;
  sessionStorage.setItem('zetslay_session', session.token);
  renderAuthState();
  setAuthModal(false);
  await loadAccountData();
}

async function submitAuth(form) {
  const message = form.querySelector('[data-auth-message]');
  const submit = form.querySelector('[data-auth-submit]');
  const body = Object.fromEntries(new FormData(form));
  if (!form.reportValidity()) return;
  message.className = 'auth-message';
  message.textContent = 'Проверяем данные…';
  submit.disabled = true;
  try {
    if (authState.mode === 'register') {
      const registration = await apiRequest('/api/v1/auth/register', { method: 'POST', body });
      form.reset();
      if (!registration.verificationRequired) {
        await acceptSession(await apiRequest('/api/v1/auth/login', { method: 'POST', body }));
        showToast('Аккаунт создан. Добро пожаловать в кабинет.', 'success');
        return;
      }
      registrationEmail = body.email;
      setAuthMode('login');
      form.querySelector('input[name="email"]').value = body.email;
      message.classList.add('is-success');
      message.textContent = 'Аккаунт создан. Подтвердите адрес по письму, затем войдите.';
      form.querySelector('[data-auth-resend]').hidden = false;
      return;
    }
    const session = await apiRequest('/api/v1/auth/login', { method: 'POST', body });
    form.reset();
    await acceptSession(session);
    showToast('Вход выполнен через защищённый API', 'success');
  } catch (error) {
    message.classList.add('is-error');
    message.textContent = humanError(error);
    if (['EMAIL_VERIFICATION_REQUIRED', 'EMAIL_DELIVERY_UNAVAILABLE'].includes(error?.code)) {
      registrationEmail = body.email;
      form.querySelector('[data-auth-resend]').hidden = false;
    }
  } finally {
    submit.disabled = false;
  }
}

async function resendVerification(button) {
  const form = document.querySelector('[data-auth-form]');
  const message = form.querySelector('[data-auth-message]');
  const email = form.querySelector('input[name="email"]').value.trim() || registrationEmail;
  if (!email) { message.textContent = 'Введите email для повторной отправки.'; return; }
  button.disabled = true;
  message.className = 'auth-message';
  message.textContent = 'Отправляем письмо…';
  try {
    await apiRequest('/api/v1/auth/resend-verification', { method: 'POST', body: { email } });
    message.classList.add('is-success');
    message.textContent = 'Если адрес ожидает подтверждения, письмо отправлено. Проверьте также папку «Спам».';
  } catch (error) {
    message.classList.add('is-error');
    message.textContent = humanError(error);
  } finally {
    button.disabled = false;
  }
}

let telegramLoginTimer = null;

function stopTelegramLoginPolling() {
  if (telegramLoginTimer) { clearInterval(telegramLoginTimer); telegramLoginTimer = null; }
}

async function startTelegramLogin(button) {
  const statusBox = document.querySelector('[data-telegram-login-status]');
  const link = document.querySelector('[data-telegram-login-link]');
  button.disabled = true;
  try {
    const started = await apiRequest('/api/v1/auth/telegram/start', { method: 'POST', body: {} });
    if (link) link.href = started.url;
    if (statusBox) statusBox.hidden = false;
    window.open(started.url, '_blank', 'noopener');
    stopTelegramLoginPolling();
    const deadline = Date.now() + 10 * 60 * 1000;
    telegramLoginTimer = setInterval(async () => {
      if (Date.now() > deadline) {
        stopTelegramLoginPolling();
        if (statusBox) statusBox.hidden = true;
        showToast('Ссылка входа истекла. Запросите новую', 'error');
        return;
      }
      try {
        const poll = await apiRequest(`/api/v1/auth/telegram/poll?ticket=${encodeURIComponent(started.ticket)}`);
        if (poll.status === 'confirmed') {
          stopTelegramLoginPolling();
          if (statusBox) statusBox.hidden = true;
          await acceptSession(poll);
          showToast('Вход через Telegram выполнен', 'success');
        }
      } catch {
        stopTelegramLoginPolling();
      }
    }, 2500);
  } catch (error) {
    showToast(humanError(error), 'error');
  } finally {
    button.disabled = false;
  }
}

async function restoreSession() {
  if (!authState.token) { renderAuthState(); setAuthModal(true); return; }
  try {
    const context = await apiRequest('/api/v1/me', { authenticated: true });
    authState.user = context.user;
    authState.workspace = context.workspace;
  } catch {
    clearSession();
    return;
  }
  renderAuthState();
  await loadAccountData();
}

async function initializeAuthFlow() {
  const requestedMode = new URLSearchParams(location.search).get('auth');
  await restoreSession();
  if (authState.user) {
    setAuthModal(false);
    if (requestedMode === 'login' || requestedMode === 'register') {
      const cleanUrl = new URL(location.href);
      cleanUrl.searchParams.delete('auth');
      history.replaceState(null, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
    }
  } else if (requestedMode === 'login' || requestedMode === 'register') {
    setAuthMode(requestedMode);
    setAuthModal(true);
  }
  await verifyEmailFromUrl();
}

async function verifyEmailFromUrl() {
  const token = new URLSearchParams(location.search).get('verify');
  if (!token) return;
  if (!authState.user) {
    setAuthMode('login');
    setAuthModal(true);
  }
  const message = document.querySelector('[data-auth-message]');
  if (!authState.user && message) { message.className = 'auth-message'; message.textContent = 'Подтверждаем email…'; }
  try {
    await apiRequest('/api/v1/auth/verify-email', { method: 'POST', body: { token } });
    if (authState.user) showToast('Email подтверждён', 'success');
    else if (message) { message.classList.add('is-success'); message.textContent = 'Email подтверждён. Теперь войдите в ZetSlay.'; }
    const cleanUrl = new URL(location.href); cleanUrl.searchParams.delete('verify'); history.replaceState(null, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
  } catch (error) {
    if (authState.user) showToast(humanError(error), 'error');
    else if (message) { message.classList.add('is-error'); message.textContent = humanError(error); }
  }
}

function formatMinor(amountMinor, currency = 'RUB') {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amountMinor || 0) / 100);
}

const storeStatus = (store) => store.status === 'connected_read_only'
  ? { label: 'Работает · read-only', tone: 'online' }
  : store.status === 'attention'
    ? { label: 'Требует внимания', tone: 'attention' }
    : store.status === 'paused'
      ? { label: 'Остановлен', tone: 'paused' }
      : { label: 'Ожидает подключения', tone: 'waiting' };

const selectedStore = () => state.storeFleet.stores.find((store) => store.id === state.storeFleet.selectedStoreId) || state.storeFleet.stores[0] || null;
const storeAvatar = (store) => {
  const label = escapeHtml((store?.displayName || 'FunPay').slice(0, 2).toUpperCase());
  const avatarUrl = typeof store?.avatarUrl === 'string' && /^https:\/\/(?:[a-z0-9-]+\.)*funpay\.com\//i.test(store.avatarUrl) ? store.avatarUrl : '';
  return avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="" referrerpolicy="no-referrer">` : label;
};

function renderStoreFleet() {
  const fleet = state.storeFleet;
  const selected = selectedStore();
  if (selected && !fleet.selectedStoreId) fleet.selectedStoreId = selected.id;
  document.querySelectorAll('[data-selected-store-name]').forEach((node) => { node.textContent = selected?.displayName || 'Нет магазинов'; });
  const activeName = document.querySelector('[data-active-store-name]');
  const activeStatus = document.querySelector('[data-active-store-status]');
  if (activeName) activeName.textContent = selected?.displayName || 'Подключите магазин';
  if (activeStatus) activeStatus.textContent = selected ? `FunPay · ${storeStatus(selected).label.toLowerCase()}` : 'FunPay · нет подключения';
  const activeMetrics = selected?.metrics || {};
  const balance = document.querySelector('[data-active-store-balance]');
  const lots = document.querySelector('[data-active-store-lots]');
  const unread = document.querySelector('[data-active-store-unread]');
  if (balance) balance.textContent = activeMetrics.balance ?? '—';
  if (lots) lots.textContent = activeMetrics.lots ?? '—';
  if (unread) unread.textContent = activeMetrics.unread ?? '—';
  document.querySelectorAll('[data-active-store-avatar], [data-selected-store-avatar]').forEach((node) => { node.innerHTML = storeAvatar(selected); });
  const runtimeButton = document.querySelector('[data-store-runtime]');
  if (runtimeButton) {
    const awaiting = !selected || selected.status === 'awaiting_credentials';
    runtimeButton.disabled = !awaiting;
    runtimeButton.classList.remove('button--danger');
    runtimeButton.classList.toggle('button--primary', awaiting);
    runtimeButton.innerHTML = `${icon('shield')} ${awaiting ? 'Настроить' : 'Только чтение'}`;
  }
  const systemHealth = document.querySelector('[data-system-health]');
  if (systemHealth) {
    systemHealth.classList.toggle('is-online', selected?.status === 'connected_read_only');
    systemHealth.innerHTML = `<i></i> ${!authState.user ? 'Гостевой режим' : !selected ? 'Нет магазина' : storeStatus(selected).label}`;
  }
  const capacityText = `${fleet.capacity?.used ?? fleet.stores.length} из ${fleet.capacity?.limit ?? 1}`;
  document.querySelectorAll('[data-fleet-capacity]').forEach((node) => { node.textContent = capacityText; });
  document.querySelectorAll('[data-store-capacity]').forEach((node) => { node.textContent = capacityText.replace('из', '/'); });

  document.querySelectorAll('[data-open-connect]').forEach((button) => {
    const connected = selected?.status === 'connected_read_only' || selected?.status === 'paused';
    button.disabled = connected;
    button.title = connected ? 'ZetSlay поддерживает один аккаунт FunPay.' : '';
  });
  const security = document.querySelector('[data-security-connections]');
  if (security) security.textContent = selected ? `FunPay: ${storeStatus(selected).label}. Прокси: ${selected.proxyConfigured ? 'настроен' : 'не настроен'}.` : 'Магазин FunPay ещё не подключён.';
  document.querySelector('[data-nav-orders]')?.replaceChildren(document.createTextNode(String(state.orders.length)));
  document.querySelector('[data-nav-messages]')?.replaceChildren(document.createTextNode(String(state.conversations.length)));
  renderDashboard();
  if (typeof renderProfile === 'function') renderProfile();
  if (typeof renderLotWorkspace === 'function') renderLotWorkspace();
}

// Maps the single FunPay connection to the fleet-shaped view state the
// cabinet already renders (ZetSlay deliberately keeps exactly one account).
function mapConnectionToFleet(connection) {
  const stores = [];
  if (connection.externalStoreId) {
    const existing = state.storeFleet.stores.find((store) => store.id === connection.externalStoreId);
    stores.push({
      id: connection.externalStoreId,
      displayName: connection.displayName || connection.externalStoreId,
      avatarUrl: connection.avatarUrl || '',
      status: connection.status === 'blocked' ? 'attention' : connection.status,
      workerId: connection.workerId,
      lastSeenAt: connection.lastSeenAt,
      proxyConfigured: connection.proxyConfigured,
      metrics: existing?.metrics || null
    });
  }
  return {
    selectedStoreId: stores[0]?.id || null,
    capacity: { used: stores.length, limit: 1 },
    liveActionsEnabled: false,
    stores
  };
}

async function loadStoreFleet() {
  if (!authState.token || !API_BASE_URL) { renderStoreFleet(); return; }
  const token = authState.token;
  const connection = await apiRequest('/api/v1/funpay/connection', { authenticated: true });
  if (token !== authState.token) return;
  state.storeFleet = mapConnectionToFleet(connection);
  renderStoreFleet();
}

async function setStoreRuntime() {
  const store = selectedStore();
  if (!authState.user) { setAuthModal(true); showToast('Войдите, чтобы управлять магазином'); return; }
  if (!store || store.status === 'awaiting_credentials') { setModal(true); return; }
  showToast('Управление запуском недоступно. Сейчас подключение работает только в read-only режиме.');
}

function renderFinance() {
  const storesTarget = byId('finance-store-list');
  const intentsTarget = byId('withdrawal-intent-list');
  const form = document.querySelector('[data-withdrawal-intent-form]');
  if (!storesTarget) return;
  if (!authState.user) {
    storesTarget.innerHTML = '<div class="finance-empty">Войдите, чтобы увидеть балансы подключённых магазинов.</div>';
    if (intentsTarget) intentsTarget.textContent = 'Журнал намерений появится после входа.';
    if (form) form.hidden = true;
    return;
  }
  if (!state.finance.stores.length) {
    storesTarget.innerHTML = '<div class="finance-empty">Баланс пока недоступен текущему read-only коннектору FunPay.</div>';
    if (intentsTarget) intentsTarget.textContent = 'Симулированных намерений пока нет.';
    if (form) form.hidden = true;
    return;
  }
  storesTarget.innerHTML = state.finance.stores.map((store) => `
    <article class="finance-store-card">
      <div><span class="store-logo">FP</span><span><strong>${escapeHtml(store.displayName)}</strong><small>${escapeHtml(store.storeId)} · закреплённый proxy worker</small></span></div>
      <span><small>Доступно</small><strong>${formatMinor(store.availableMinor, store.currency)}</strong></span>
      <span><small>Ожидает</small><strong>${formatMinor(store.pendingMinor, store.currency)}</strong></span>
      <span class="health-pill health-pill--waiting"><i></i> Только подтверждение</span>
    </article>`).join('');
  if (form) {
    form.hidden = false;
    form.elements.storeId.innerHTML = state.finance.stores.map((store) => `<option value="${escapeHtml(store.storeId)}">${escapeHtml(store.displayName)}</option>`).join('');
  }
  if (intentsTarget) intentsTarget.innerHTML = state.finance.withdrawalIntents.length
    ? state.finance.withdrawalIntents.map((intent) => `<article><time>${new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(intent.createdAt))}</time><strong>${formatMinor(intent.amountMinor, intent.currency)}</strong><span>simulated · деньги не отправлены</span></article>`).join('')
    : 'Симулированных намерений пока нет.';
}

async function loadFinance() {
  if (!authState.token || !API_BASE_URL) { renderFinance(); return; }
  const token = authState.token;
  const finance = await apiRequest('/api/v1/finance', { authenticated: true });
  if (token !== authState.token) return;
  state.finance = finance;
  renderFinance();
}

async function refreshFinance() {
  if (!authState.token) { setAuthModal(true); showToast('Войдите, чтобы обновить финансовый снимок'); return; }
  try {
    await apiRequest('/api/v1/finance/refresh', { method: 'POST', authenticated: true, body: {} });
    await loadFinance();
    showToast('Read-only баланс обновлён через закреплённый proxy worker', 'success');
  } catch (error) {
    showToast(humanError(error), 'error');
  }
}

async function createWithdrawalIntent(form) {
  const values = new FormData(form);
  const amountMinor = Math.round(Number(values.get('amount')) * 100);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) { showToast('Введите корректную сумму'); return; }
  try {
    const intent = await apiRequest('/api/v1/finance/withdrawal-intents', {
      method: 'POST', authenticated: true, body: { storeId: values.get('storeId'), amountMinor }
    });
    await loadFinance();
    showToast(`Создано намерение ${formatMinor(intent.amountMinor, intent.currency)}. Деньги не отправлены.`, 'success');
    form.elements.amount.value = '';
  } catch (error) {
    showToast(humanError(error), 'error');
  }
}

function isPluginCatalogOwner() {
  return authState.user?.telegramUserId === '5062414502';
}

function canManagePluginCatalog() {
  return Boolean(authState.token && isPluginCatalogOwner() && state.pluginCanManage === true);
}

function renderPluginAdminAccess() {
  const allowed = canManagePluginCatalog();
  if (document.documentElement) document.documentElement.dataset.catalogAdmin = String(allowed);
  document.querySelectorAll('[data-plugin-admin-controls]').forEach(target => {
    target.hidden = !allowed;
    if (!allowed) target.innerHTML = '';
  });
  document.querySelectorAll('[data-plugin-cover-admin], [data-plugin-publish], [data-plugin-edit], [data-cover-plugin]').forEach(button => { button.hidden = !allowed; });
  if (!allowed) {
    state.pluginCoverAdmin = false;
    const upload = document.querySelector('[data-plugin-cover-input]');
    if (upload) { upload.value = ''; delete upload.dataset.pluginId; }
    const dialog = document.querySelector('[data-plugin-dialog]');
    if (dialog?.querySelector('[data-plugin-editor]')) {
      closePluginDialog();
      const body = dialog.querySelector('[data-plugin-dialog-body]');
      if (body) body.innerHTML = '';
    }
  }
}

function resetPluginCatalog() {
  if (typeof resetPluginPageState === 'function') resetPluginPageState();
  state.pluginCatalogRevision++;
  state.pluginCanManage = false;
  state.pluginCoverAdmin = false;
  closePluginDialog();
  state.plugins = state.plugins.filter(plugin => plugin.published !== false).map((plugin) => plugin.planned ? plugin : { ...plugin, installed: false, active: false, config: {} });
  renderPlugins();
}

async function loadPluginCatalog() {
  if (!authState.token || !API_BASE_URL) return;
  const token = authState.token;
  const revision = ++state.pluginCatalogRevision;
  let catalog;
  try { catalog = await apiRequest('/api/v1/plugin-catalog', { authenticated: true }); }
  catch (error) {
    if (token === authState.token && revision === state.pluginCatalogRevision) {
      state.pluginCanManage = false;
      state.pluginCoverAdmin = false;
      if (typeof pluginCatalogFailed === 'function') pluginCatalogFailed(error);
      renderPlugins();
    }
    throw error;
  }
  if (token !== authState.token || revision !== state.pluginCatalogRevision) return;
  const old = new Map(state.plugins.map(plugin => [plugin.id, plugin]));
  state.pluginCanManage = catalog.canManage === true && isPluginCatalogOwner();
  state.pluginCoverAdmin = state.pluginCanManage && state.pluginCoverAdmin;
  if (typeof pluginCatalogLoaded === 'function') pluginCatalogLoaded();
  state.plugins = catalog.entries.map(backend => ({
    ...old.get(backend.id), ...backend,
    price: backend.priceRub ? `от ${backend.priceRub.toLocaleString('ru-RU')} ₽` : 'Бесплатно',
    permissionsRaw: backend.permissions,
    permissions: backend.permissions,
    installed: Boolean(backend.installation),
    active: Boolean(backend.installation?.enabled),
    config: backend.installation?.config || {}
  }));
  renderPlugins();
  const autoReplyForm = document.querySelector('[data-plugin-settings]');
  const autoReply = state.plugins.find((plugin) => plugin.id === 'zetslay.auto-reply');
  if (autoReplyForm && autoReply) {
    const config = autoReply.config || {};
    autoReplyForm.elements.replyText.value = config.text || '';
    autoReplyForm.elements.scenario.value = config.scenario || 'all';
    autoReplyForm.elements.keywords.value = (config.keywords || []).join(', ');
    autoReplyForm.elements.excludeKeywords.value = (config.excludeKeywords || []).join(', ');
    autoReplyForm.elements.quietEnabled.checked = config.quietHours?.enabled === true;
    autoReplyForm.elements.quietStart.value = config.quietHours?.start || '22:00';
    autoReplyForm.elements.quietEnd.value = config.quietHours?.end || '08:00';
    autoReplyForm.elements.timeZone.value = config.quietHours?.timeZone || 'Asia/Almaty';
    autoReplyForm.elements.quietBehavior.value = config.quietHours?.behavior || 'pause';
    autoReplyForm.elements.quietText.value = config.quietHours?.text || '';
  }
  const telegram = state.plugins.find((plugin) => plugin.id === 'zetslay.telegram-notifications');
  const telegramForm = document.querySelector('[data-telegram-settings]');
  if (telegramForm) {
    telegramForm.elements.messages.checked = telegram?.config?.messages !== false;
    telegramForm.elements.paidOrders.checked = telegram?.config?.paidOrders !== false;
  }
}

function renderPluginAudit() {
  const target = byId('plugin-audit-list');
  if (!target) return;
  if (!authState.user) { target.textContent = 'Войдите, чтобы увидеть журнал текущего магазина.'; return; }
  if (!state.pluginAudit.length) { target.textContent = 'Пока нет действий плагинов. Установите модуль или запустите симуляцию.'; return; }
  const labels = {
    'plugin.installed': 'Плагин установлен', 'plugin.enabled': 'Плагин включён', 'plugin.disabled': 'Плагин остановлен',
    'plugin.configured': 'Настройки сохранены', 'plugin.dispatch.completed': 'Событие обработано', 'plugin.dispatch.failed': 'Обработка остановлена'
  };
  target.innerHTML = state.pluginAudit.map((entry) => {
    const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(entry.at || entry.createdAt));
    const plugin = state.plugins.find((item) => item.id === entry.pluginId)?.name || entry.pluginId || 'ZetSlay';
    const detail = entry.actionCount != null ? `${entry.actionCount} предлож. действий · simulated` : plugin;
    return `<article class="plugin-audit__entry"><time>${escapeHtml(time)}</time><strong>${escapeHtml(labels[entry.event] || 'Событие плагина')}</strong><span>${escapeHtml(detail)}</span></article>`;
  }).join('');
}

async function loadPluginAudit() {
  if (!byId('plugin-audit-list')) return;
  if (!authState.token || !API_BASE_URL) { renderPluginAudit(); return; }
  const token = authState.token;
  const audit = await apiRequest('/api/v1/plugins/audit?limit=30', { authenticated: true });
  if (token !== authState.token) return;
  state.pluginAudit = audit;
  renderPluginAudit();
}

function renderDashboard() {
  const selected = selectedStore();
  const metrics = selected?.metrics || {};
  const setText = (selector, value) => {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  };
  setText('[data-dash-balance]', metrics.balance ?? '—');
  setText('[data-topbar-balance]', metrics.balance ?? '—');
  setText('[data-dash-orders]', String(state.orders.length));
  setText('[data-dash-unread]', state.storeContent.observedAt ? String(state.conversations.length) : '—');
  setText('[data-dash-plan]', authState.workspace?.plan?.active ? (authState.workspace.plan.id || 'Активен') : 'Не активен');

  const statusClass = (tone) => (tone === 'green' || tone === 'muted' ? 'table-status--success' : tone === 'yellow' || tone === 'violet' ? 'table-status--processing' : '');
  const ordersTarget = byId('dash-orders-list');
  if (ordersTarget) {
    ordersTarget.innerHTML = state.orders.length ? state.orders.slice(0, 4).map((order) => `
      <article>
        <span class="dash-list__icon"><svg><use href="#i-bag"/></svg></span>
        <div><strong>${escapeHtml(order.id)} · ${escapeHtml(order.product)}</strong><small>${escapeHtml(order.buyer)} · ${escapeHtml(order.time)}</small></div>
        <span class="table-status ${statusClass(order.tone)}">${escapeHtml(order.status)}</span>
        <b>${escapeHtml(order.total)}</b>
      </article>`).join('') : '<div class="content-empty">Заказы появятся после синхронизации магазина.</div>';
  }

  const financeTarget = byId('dash-finance-list');
  if (financeTarget) {
    financeTarget.innerHTML = state.finance.stores.length ? state.finance.stores.map((store) => `
      <article>
        <span class="dash-list__icon"><svg><use href="#i-card"/></svg></span>
        <div><strong>${escapeHtml(store.displayName)}</strong><small>read-only снимок баланса</small></div>
        <span class="table-status table-status--success">Доступно</span>
        <b>${formatMinor(store.availableMinor, store.currency)}</b>
      </article>
      <article>
        <span class="dash-list__icon"><svg><use href="#i-clock"/></svg></span>
        <div><strong>Ожидает подтверждения</strong><small>вывод средств отключён политикой безопасности</small></div>
        <span class="table-status table-status--processing">Ожидает</span>
        <b>${formatMinor(store.pendingMinor, store.currency)}</b>
      </article>`).join('') : '<div class="content-empty">Баланс пока недоступен текущему read-only коннектору.</div>';
  }

  if (typeof renderOverview === 'function') renderOverview();
  else { renderDashChart(); renderDashDonut(); }
}

function renderDashChart() {
  const target = byId('dash-chart');
  const days = byId('dash-chart-days');
  if (!target || !days) return;
  const data = state.analytics;
  if (!data.length) { target.innerHTML = '<div class="content-empty">FunPay пока не отдаёт даты заказов в read-only снимке.</div>'; days.innerHTML = ''; return; }
  const width = 560;
  const height = 150;
  const pad = 8;
  const values = data.map((point) => point.orders);
  const max = Math.max(...values, 1);
  const step = (width - pad * 2) / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => [pad + index * step, height - 16 - (value / max) * (height - 34)]);
  const curve = points.map((point, index) => {
    if (index === 0) return `M${point[0]},${point[1]}`;
    const [prevX, prevY] = points[index - 1];
    const midX = (prevX + point[0]) / 2;
    return `C${midX},${prevY} ${midX},${point[1]} ${point[0]},${point[1]}`;
  }).join(' ');
  const area = `${curve} L${points.at(-1)[0]},${height - 4} L${points[0][0]},${height - 4} Z`;
  target.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="dash-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f9b32e" stop-opacity=".22"/><stop offset="1" stop-color="#f9b32e" stop-opacity="0"/></linearGradient></defs>
      ${[0.25, 0.5, 0.75].map((ratio) => `<line x1="${pad}" x2="${width - pad}" y1="${16 + ratio * (height - 34)}" y2="${16 + ratio * (height - 34)}" stroke="#1e2129" stroke-dasharray="3 5" stroke-width="1"/>`).join('')}
      <path d="${area}" fill="url(#dash-area)"/>
      <path d="${curve}" fill="none" stroke="#f9b32e" stroke-width="2.2" stroke-linecap="round"/>
      ${points.map((point) => `<circle cx="${point[0]}" cy="${point[1]}" r="3.5" fill="#f9b32e" stroke="#12141a" stroke-width="2.5"/>`).join('')}
    </svg>`;
  days.innerHTML = data.map((point) => `<span>${escapeHtml(point.day)}</span>`).join('');
}

function renderDashDonut() {
  const svg = byId('dash-donut-svg');
  const legend = byId('dash-status-legend');
  const totalNode = byId('dash-donut-total');
  if (!svg || !legend || !totalNode) return;
  const tones = { 'Новый': '#f9b32e', 'В работе': '#a78bfa', 'Выдан': '#34d399', 'Спор': '#f87171', 'Завершён': '#5b616e' };
  const counts = {};
  state.orders.forEach((order) => { counts[order.status] = (counts[order.status] || 0) + 1; });
  const entries = Object.entries(counts);
  const total = state.orders.length;
  totalNode.textContent = String(total);
  if (!total) {
    svg.innerHTML = '<circle cx="66" cy="66" r="50" fill="none" stroke="#1c1f26" stroke-width="12"/>';
    legend.innerHTML = '<div class="content-empty">Структура появится после синхронизации заказов.</div>';
    return;
  }
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  svg.innerHTML = '<circle cx="66" cy="66" r="50" fill="none" stroke="#1c1f26" stroke-width="12"/>' + entries.map(([status, count]) => {
    const share = count / total;
    const segment = `${share * circumference} ${circumference}`;
    const circle = `<circle cx="66" cy="66" r="50" fill="none" stroke="${tones[status] || '#5b616e'}" stroke-width="12" stroke-dasharray="${segment}" stroke-dashoffset="${-offset}" transform="rotate(-90 66 66)" stroke-linecap="butt"/>`;
    offset += share * circumference;
    return circle;
  }).join('');
  legend.innerHTML = entries.map(([status, count]) => `
    <div><span><i style="background:${tones[status] || '#5b616e'}"></i>${escapeHtml(status)}</span><b>${count}</b><em>${Math.round((count / total) * 100)}%</em></div>
  `).join('');
}

const AVATAR_TONES = ['avatar--amber', 'avatar--blue', 'avatar--violet', 'avatar--green', 'avatar--red'];
const avatarTone = (name) => {
  let hash = 0;
  for (const char of String(name || 'Z')) hash = (hash + char.charCodeAt(0)) % AVATAR_TONES.length;
  return AVATAR_TONES[hash];
};

function renderOrders() {
  if (typeof renderOrderWorkspace === 'function' && renderOrderWorkspace()) { renderDashboard(); return; }
  const target = byId('orders-table-body');
  if (!target) return;
  target.innerHTML = state.orders.length ? state.orders.map((order) => `
    <tr>
      <td><div class="order-cell"><strong>${escapeHtml(order.id)}</strong><small>${escapeHtml(order.time)}</small></div></td>
      <td><div class="product-cell"><i>${escapeHtml(String(order.product).slice(0, 2).toUpperCase())}</i><span>${escapeHtml(order.product)}</span></div></td>
      <td><div class="buyer-cell"><span class="avatar ${avatarTone(order.buyer)}">${escapeHtml(String(order.buyer).slice(0, 2).toUpperCase())}</span><span>${escapeHtml(order.buyer)}</span></div></td>
      <td class="cell-right"><strong class="order-amount">${escapeHtml(order.total)}</strong></td>
      <td><span class="source-pill source-pill--web"><i></i>FunPay</span></td>
      <td><span class="table-status ${order.tone === 'green' || order.tone === 'muted' ? 'table-status--success' : order.tone === 'yellow' || order.tone === 'violet' ? 'table-status--processing' : ''}"><i></i>${escapeHtml(order.status)}</span></td>
      <td><span class="cell-muted">${escapeHtml(order.time)}</span></td>
      <td class="cell-right">—</td>
    </tr>`).join('') : '<tr><td colspan="8"><div class="content-empty"><span class="chat-empty__icon"><svg><use href="#i-bag"/></svg></span><strong>Заказов пока нет</strong><p>Запустите магазин и выполните синхронизацию — заказы появятся здесь.</p></div></td></tr>';
  const total = state.orders.length;
  const active = state.orders.filter((order) => !['Завершён', 'Выдан'].includes(order.status)).length;
  document.querySelector('[data-orders-total]')?.replaceChildren(document.createTextNode(String(total)));
  document.querySelector('[data-orders-active]')?.replaceChildren(document.createTextNode(String(active)));
  document.querySelector('[data-orders-done]')?.replaceChildren(document.createTextNode(String(total - active)));
  document.querySelector('[data-orders-updated]')?.replaceChildren(document.createTextNode(state.storeContent.observedAt ? new Date(state.storeContent.observedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—'));
  document.querySelector('[data-orders-count]')?.replaceChildren(document.createTextNode(total ? `Показано ${total} заказов` : 'Нет синхронизированных заказов'));
  renderDashboard();
}

function renderConversations() {
  if (typeof renderMessagesWorkspace === 'function' && renderMessagesWorkspace()) return;
  const target = byId('conversation-items');
  if (!target) return;
  target.innerHTML = state.conversations.length ? state.conversations.map((chat) => `
    <button class="conversation-item${chat.active ? ' is-active' : ''}" type="button" data-chat="${escapeHtml(chat.threadId || chat.name)}">
      <span class="chat-avatar ${avatarTone(chat.name)}">${escapeHtml(chat.initials)}</span>
      <span><strong>${escapeHtml(chat.name)}</strong><p>${escapeHtml(chat.preview)}</p></span>
      <span class="conversation-item__meta"><time>${escapeHtml(chat.time)}</time>${chat.unread ? `<b>${chat.unread}</b>` : ''}</span>
    </button>`).join('') : '<div class="content-empty">Сообщений пока нет.</div>';
  document.querySelector('[data-message-count]')?.replaceChildren(document.createTextNode(String(state.conversations.length)));
  renderActiveConversation();
}

function renderActiveConversation() {
  if (typeof renderMessagesWorkspace === 'function' && renderMessagesWorkspace()) return;
  const chat = state.conversations.find((item) => item.active) || state.conversations[0];
  const body = document.querySelector('[data-chat-body]');
  const name = document.querySelector('[data-chat-name]');
  const avatar = document.querySelector('[data-chat-avatar]');
  if (name) name.textContent = chat?.name || 'Выберите диалог';
  if (avatar) {
    avatar.textContent = chat?.initials || '—';
    avatar.className = `chat-avatar chat-avatar--header ${chat ? avatarTone(chat.name) : ''}`;
  }
  if (!body) return;
  const emptyState = '<div class="chat-empty"><span class="chat-empty__icon"><svg><use href="#i-chat"/></svg></span><strong>Диалог не выбран</strong><p>Запустите магазин и синхронизируйте сообщения — здесь появится переписка.</p></div>';
  if (!chat?.messages?.length) { body.innerHTML = emptyState; return; }
  body.innerHTML = `<div class="chat-date">Read-only синхронизация</div>${chat.messages.map((message) => `<article class="chat-message ${message.sender === 'seller' ? 'chat-message--seller' : 'chat-message--buyer'}"><p>${escapeHtml(message.text || 'Сообщение без текста')}</p><time>${escapeHtml(message.time || '')}</time></article>`).join('')}`;
}

function normalizeStoreContent(content) {
  const statusLabels = { paid: 'Новый', processing: 'В работе', completed: 'Завершён', delivered: 'Выдан', refunded: 'Спор' };
  state.storeContent = content;
  state.orders = (content.orders || []).map((order, index) => {
    const status = statusLabels[String(order.status || '').toLowerCase()] || String(order.status || 'Новый');
    return {
      id: String(order.id || `order-${index + 1}`).replace(/^([^#])/, '#$1'),
      product: order.product || order.title || 'Заказ FunPay',
      buyer: order.buyer || order.buyerName || 'Покупатель FunPay',
      total: order.totalMinor != null ? formatMinor(order.totalMinor, order.currency || 'RUB') : '—',
      status,
      tone: ['Завершён', 'Выдан'].includes(status) ? 'green' : status === 'Спор' ? 'red' : 'yellow',
      time: order.createdAt ? new Date(order.createdAt).toLocaleString('ru-RU') : '—',
      createdAt: order.createdAt || null
    };
  });
  const grouped = new Map();
  (content.messages || []).forEach((message, index) => {
    const threadId = String(message.threadId || `thread-${index + 1}`);
    const group = grouped.get(threadId) || { threadId, name: message.buyer || message.author || threadId, messages: [] };
    group.messages.push({ text: message.text, sender: message.sender, time: message.createdAt ? new Date(message.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '' });
    grouped.set(threadId, group);
  });
  state.conversations = [...grouped.values()].map((group, index) => ({ ...group, initials: group.name.slice(0, 2).toUpperCase(), preview: group.messages.at(-1)?.text || 'Сообщение без текста', time: group.messages.at(-1)?.time || '—', unread: 0, active: index === 0 }));
  state.lots = (content.lots || []).map((lot) => ({ tag: String(lot.id || 'LOT').slice(0, 12).toUpperCase(), title: lot.title || 'Лот FunPay', price: lot.priceMinor != null ? formatMinor(lot.priceMinor, lot.currency || 'RUB') : '—', stock: lot.stock ?? '—', sales: lot.sales ?? '—', position: lot.position ?? '—', active: lot.status !== 'paused' }));
  const days = new Map();
  state.orders.forEach((order) => {
    if (!order.createdAt) return;
    const date = new Date(order.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const key = date.toISOString().slice(0, 10);
    const point = days.get(key) || { day: date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }), revenue: 0, orders: 0 };
    point.orders++;
    days.set(key, point);
  });
  state.analytics = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-7).map(([, point]) => point);
  renderAnalytics();
}

// Share one read request between cabinet views within the same account session.
let storeContentSyncFlight = null;
function syncStoreContent(options = {}) {
  const generation = sessionGeneration;
  if (storeContentSyncFlight?.generation === generation) return storeContentSyncFlight.promise;
  const promise = readStoreContent(options);
  const flight = { generation, promise };
  storeContentSyncFlight = flight;
  const release = () => { if (storeContentSyncFlight === flight) storeContentSyncFlight = null; };
  promise.then(release, release);
  return promise;
}

async function readStoreContent({ silent = false } = {}) {
  const store = selectedStore();
  if (!authState.user) { setAuthModal(true); return; }
  if (!store || store.status !== 'connected_read_only') {
    if (!silent) showToast('Сначала завершите read-only подключение FunPay.');
    return;
  }
  const generation = sessionGeneration;
  try {
    const content = await apiRequest('/api/v1/funpay/content', { authenticated: true });
    if (generation !== sessionGeneration) return;
    normalizeStoreContent(content);
    store.metrics = { balance: content.balance?.availableMinor != null ? formatMinor(content.balance.availableMinor, content.balance.currency || 'RUB') : '—', lots: content.lots?.length ?? '—', unread: '—' };
    renderStoreFleet(); renderOrders(); renderConversations(); renderLots();
    const health = document.querySelector('[data-messages-health]');
    if (health) { health.className = 'health-pill health-pill--active'; health.innerHTML = '<i></i> Синхронизировано'; }
    if (!silent) showToast('Заказы и сообщения обновлены', 'success');
  } catch (error) {
    if (['AUTH_REJECTED', 'CAPTCHA_REQUIRED', 'READ_ONLY_VIOLATION', 'PLATFORM_UNAVAILABLE'].includes(error?.code)) {
      await Promise.allSettled([loadOnboarding(), loadStoreFleet()]);
    }
    if (!silent) showToast(humanError(error), 'error');
    throw error;
  }
}

function renderTelegramOnboarding() {
  const onboarding = state.onboarding;
  const configured = Boolean(onboarding?.telegram?.botConfigured);
  const linked = Boolean(onboarding?.telegram?.linked);
  const step = linked ? 2 : configured ? 1 : 0;

  // Bot card
  const avatar = document.querySelector('[data-tg-avatar]');
  const name = document.querySelector('[data-tg-name]');
  const meta = document.querySelector('[data-tg-meta]');
  const status = document.querySelector('[data-tg-status]');
  const botUsername = onboarding?.telegram?.bot?.username;
  if (avatar) {
    avatar.textContent = botUsername ? botUsername.slice(0, 1).toUpperCase() : 'Z';
    avatar.classList.toggle('tg-bot__avatar--on', linked);
  }
  if (name) name.textContent = botUsername ? `@${botUsername}` : linked ? 'Telegram-бот' : 'Ещё не настроен';
  if (meta) meta.textContent = configured ? (linked ? 'Работает и принимает события' : 'Токен сохранён в vault') : 'Создайте бота через @BotFather';
  if (status) {
    status.className = `tg-bot__status${linked ? ' tg-bot__status--on' : configured ? ' tg-bot__status--wait' : ''}`;
    status.textContent = linked ? 'Онлайн' : configured ? 'Ожидает /start' : 'Не готов';
  }

  // Progress steps
  document.querySelectorAll('[data-tg-step]').forEach((stepEl) => {
    const index = Number(stepEl.dataset.tgStep);
    stepEl.classList.toggle('is-done', index < step);
    stepEl.classList.toggle('is-active', index === step);
    stepEl.querySelector('b').textContent = index < step ? '✓' : String(index + 1);
  });

  // Health pill
  const health = document.querySelector('[data-telegram-health]');
  if (health) {
    health.className = `health-pill ${linked ? 'health-pill--active' : 'health-pill--waiting'}`;
    health.innerHTML = `<i></i> ${linked ? 'Подключён' : configured ? 'Ожидает /start' : 'Не подключён'}`;
  }

  // Form / link / done visibility
  const form = document.querySelector('[data-telegram-onboarding-form]');
  const linkBlock = document.querySelector('[data-telegram-link-code]');
  const doneBlock = document.querySelector('[data-tg-done]');
  const waiting = document.querySelector('[data-tg-waiting]');
  if (form) form.hidden = configured;
  if (linkBlock) linkBlock.hidden = !configured || linked;
  if (doneBlock) doneBlock.hidden = !linked;
  if (waiting) waiting.hidden = linked;

  // Deep link with code
  const deepLink = document.querySelector('[data-tg-deep-link]');
  const code = validConnectionCode();
  const codeNode = document.querySelector('[data-tg-code]');
  if (codeNode) codeNode.textContent = code || '——';
  if (deepLink) {
    deepLink.style.display = code && /^[A-Za-z0-9_]{5,32}$/.test(botUsername || '') ? '' : 'none';
    if (code && botUsername) deepLink.href = `https://t.me/${botUsername}?start=${encodeURIComponent(code)}`;
  }

  const hint = document.querySelector('[data-tg-hint]');
  if (hint) hint.textContent = linked
    ? 'Всё готово: бот принимает события. Включите уведомления в каталоге плагинов.'
    : configured
      ? `Шаг 2 из 3: отправьте команду своему боту ${botUsername ? `@${botUsername}` : ''} после получения кода.`
      : 'Шаг 1 из 3: вставьте Bot Token от @BotFather в защищённое поле.';

  const message = document.querySelector('[data-telegram-message]');
  if (message) message.textContent = authState.user ? '' : 'Войдите в аккаунт, чтобы подключить бота.';
  if (typeof renderProfile === 'function') renderProfile();
}

// Service bot username for deep links (server tells it via onboarding status or ?bot= override)
let serviceBotUsername = new URLSearchParams(location.search).get('bot') || '';
let onboardingRevision = 0;
async function loadServiceBotUsername() {
  if (serviceBotUsername || !authState.token || !API_BASE_URL) return;
  try {
    const onboarding = await apiRequest('/api/v1/onboarding', { authenticated: true });
    serviceBotUsername = onboarding?.serviceBot || '';
  } catch { /* ignore */ }
}

async function loadOnboarding() {
  if (!authState.token || !API_BASE_URL) { renderTelegramOnboarding(); return; }
  const token = authState.token;
  const revision = onboardingRevision;
  const onboarding = await apiRequest('/api/v1/onboarding', { authenticated: true });
  if (token !== authState.token || revision !== onboardingRevision) return;
  state.onboarding = onboarding;
  await loadServiceBotUsername();
  renderTelegramOnboarding();
}

let telegramLinkTimer = null;
function stopTelegramLinkPolling() {
  if (telegramLinkTimer) { clearInterval(telegramLinkTimer); telegramLinkTimer = null; }
}

function startTelegramLinkPolling() {
  stopTelegramLinkPolling();
  telegramLinkTimer = setInterval(async () => {
    try {
      state.onboarding = await apiRequest('/api/v1/onboarding', { authenticated: true });
      if (state.onboarding?.telegram?.linked) {
        stopTelegramLinkPolling();
        renderTelegramOnboarding();
        showToast('Telegram привязан к аккаунту', 'success');
      }
    } catch { /* ignore */ }
  }, 3000);
}

async function issueTelegramCode() {
  if (!authState.user) { setAuthModal(true); return; }
  try {
    state.onboarding = await apiRequest('/api/v1/onboarding/telegram/webhook', { method: 'POST', authenticated: true, body: {} });
    const result = await apiRequest('/api/v1/onboarding/telegram/link-code', { method: 'POST', authenticated: true, body: {} });
    state.onboarding = result.onboarding;
    connectionStatus = { linkCode: result.code, expiresAt: result.expiresAt, workspaceId: result.onboarding.workspaceId };
    const block = document.querySelector('[data-telegram-link-code]');
    if (block) {
      block.hidden = false;
      const codeNode = block.querySelector('[data-tg-code]');
      if (codeNode) codeNode.textContent = result.code;
    }
    renderTelegramOnboarding();
    startTelegramLinkPolling();
    showToast('Одноразовый Telegram-код создан', 'success');
  } catch (error) {
    showToast(humanError(error), 'error');
  }
}

async function copyTelegramCode() {
  const code = validConnectionCode();
  if (!code) return;
  try {
    await navigator.clipboard.writeText(`/start ${code}`);
    showToast('Код скопирован', 'success');
  } catch {
    showToast(`/start ${code}`);
  }
}

async function submitTelegramOnboarding(form) {
  if (!authState.user) { setAuthModal(true); return; }
  const button = form.querySelector('button[type="submit"]');
  const statusNode = form.querySelector('[data-tg-token-status]');
  const token = new FormData(form).get('token');
  button.disabled = true;
  if (statusNode) statusNode.className = 'tg-token-status'; statusNode && (statusNode.textContent = 'Проверяем через Telegram API…');
  try {
    state.onboarding = await apiRequest('/api/v1/onboarding/telegram/bot', { method: 'POST', authenticated: true, body: { token } });
    form.reset();
    if (statusNode) { statusNode.className = 'tg-token-status tg-token-status--ok'; statusNode.textContent = 'Токен принят. Бот подключён.'; }
    renderTelegramOnboarding();
    await issueTelegramCode();
  } catch (error) {
    if (statusNode) { statusNode.className = 'tg-token-status tg-token-status--fail'; statusNode.textContent = humanError(error); }
    showToast(humanError(error), 'error');
  } finally {
    button.disabled = false;
  }
}

function renderLots() {
  if (typeof renderLotWorkspace === 'function') { renderLotWorkspace(); return; }
  const target = byId('lot-grid');
  if (target) target.textContent = 'Обновите страницу, чтобы загрузить раздел лотов.';
}

function renderAutomations() {
  const target = byId('automation-cards');
  if (!target) return;
  const colors = ['255,210,28', '143,114,255', '112,223,160', '255,108,120'];
  target.innerHTML = state.automations.map((automation, index) => `
    <article class="automation-card" style="--module-rgb:${colors[index % colors.length]}">
      <span class="automation-card__icon">${icon(automation.icon)}</span>
      <div><h3>${automation.name}</h3><p>${automation.description}</p></div>
      <div class="automation-card__meta"><span>${automation.runs} за 7 дней</span><button class="toggle${automation.active ? ' is-on' : ''}" type="button" role="switch" aria-checked="${automation.active}" data-toggle="automation-${index}" aria-label="Состояние автоматизации"></button></div>
    </article>`).join('');
}

function renderPlugins() {
  renderPluginAdminAccess();
  if (typeof renderPluginAdminControls === 'function') renderPluginAdminControls();
  const target = byId('plugin-grid');
  if (!target) { if (typeof renderPluginPage === 'function') renderPluginPage(); return; }
  document.querySelectorAll('[data-plugin-cover-admin], [data-plugin-publish]').forEach(button => { button.hidden = !canManagePluginCatalog(); });
  const categorySelect = document.querySelector('[data-plugin-category]');
  if (categorySelect) categorySelect.value = state.pluginFilter.cat;
  const colors = ['249,179,46', '167,139,250', '96,165,250', '52,211,153', '248,113,113', '203,128,255'];
  const visible = state.plugins.filter(plugin => !plugin.planned && !String(plugin.id).startsWith('planned.') && !['zetslay.auto-reply', 'zetslay.telegram-notifications'].includes(plugin.id) && (plugin.published !== false || canManagePluginCatalog()));
  const installed = visible.filter(plugin => plugin.installed).length;
  const total = visible.filter(plugin => !plugin.planned).length;
  if (byId('plugin-total')) byId('plugin-total').textContent = `${total} доступно`;
  if (byId('plugin-installed')) byId('plugin-installed').textContent = `${installed} установлено`;
  const catNames = { sales: 'Продажи', chat: 'Общение', analytics: 'Аналитика', control: 'Контроль' };
  const catLabel = byId('plugin-cat-label');
  if (catLabel) catLabel.textContent = state.pluginFilter.cat === 'all' ? `Все категории (${visible.length})` : (catNames[state.pluginFilter.cat] || 'Все категории');
  document.querySelectorAll('[data-plugin-cat]').forEach(button => button.classList.toggle('is-active', button.dataset.pluginCat === state.pluginFilter.cat));
  const list = filterPluginCatalog(visible, state.pluginFilter);
  const actionOf = plugin => plugin.planned || plugin.published === false ? 'Скоро' : plugin.active ? 'Отключить' : plugin.installed ? 'Включить' : 'Установить';
  target.innerHTML = list.length ? list.map(plugin => {
    const index = state.plugins.indexOf(plugin);
    const href = typeof pluginPageHref === 'function' ? pluginPageHref(plugin.id) : `#plugins/${encodeURIComponent(plugin.id)}`;
    const cover = typeof pluginCoverSource === 'function' ? pluginCoverSource(plugin) : plugin.cover;
    const [status, tone] = typeof pluginDisplayStatus === 'function' ? pluginDisplayStatus(plugin) : [plugin.planned ? 'Скоро' : plugin.active ? 'Включён' : plugin.installed ? 'На паузе' : 'Не установлен', 'muted'];
    const adminMark = canManagePluginCatalog() && state.pluginCoverAdmin ? `<button class="plugin-cover__edit" type="button" data-cover-plugin="${escapeHtml(plugin.id)}" aria-label="Загрузить обложку для ${escapeHtml(plugin.name)}">${icon('plus')}</button>` : '';
    const busy = typeof pluginPageState !== 'undefined' && pluginPageState.busyId === plugin.id;
    const pending = typeof pluginPageState !== 'undefined' && pluginPageState.busyId !== null;
    return `<article class="plugin-card" style="--plugin-rgb:${colors[index % colors.length]}">
      <div class="plugin-card__cover"><a href="${escapeHtml(href)}" aria-label="Подробнее о плагине ${escapeHtml(plugin.name)}">${cover ? `<img data-plugin-cover data-cover-category="${escapeHtml(plugin.category)}" src="${escapeHtml(cover)}" alt="${escapeHtml(plugin.name)}" loading="lazy">` : `<span class="plugin-cover__placeholder">${icon('puzzle')}</span>`}</a>${typeof pluginRarityMarkup === 'function' ? pluginRarityMarkup(plugin) : ''}</div>${adminMark ? `<div class="plugin-card__cover-meta">${adminMark}</div>` : ''}
      <div class="plugin-card__body"><h3><a class="plugin-card__title-link" href="${escapeHtml(href)}">${escapeHtml(plugin.name)}</a></h3><p>${escapeHtml(String(plugin.description || '').replace(/^>\s?/gm, '').replace(/\*\*/g, ''))}</p>
        <div class="plugin-permissions">${(plugin.permissions || []).map(permission => `<span>${escapeHtml(typeof PLUGIN_PERMISSION_LABELS !== 'undefined' ? PLUGIN_PERMISSION_LABELS[permission]?.[0] || permission : permission)}</span>`).join('')}</div>
        <div class="plugin-card__bottom"><div class="plugin-card__price"><small>Цена</small><strong>${escapeHtml(plugin.price)}</strong></div><span class="plugin-card__status">${status}</span></div>
        <div class="plugin-card__navigation"><a href="${escapeHtml(href)}" data-plugin-page-link>Подробнее ${icon('chevron-right')}</a><button type="button" data-plugin-id="${escapeHtml(plugin.id)}" ${plugin.planned || plugin.published === false || pending ? 'disabled' : ''} aria-busy="${busy}" aria-label="${actionOf(plugin)} ${escapeHtml(plugin.name)}">${busy ? 'Сохраняем…' : actionOf(plugin)}</button></div>
      </div></article>`;
  }).join('') : '<div class="content-empty" style="grid-column:1/-1"><span class="chat-empty__icon"><svg><use href="#i-puzzle"/></svg></span><strong>Ничего не найдено</strong><p>Попробуйте другой запрос или категорию.</p></div>';
  if (typeof renderPluginPage === 'function') renderPluginPage();
}

async function changePluginState(pluginId) {
  const plugin = state.plugins.find(item => item.id === pluginId);
  if (!plugin || plugin.planned || ['zetslay.auto-reply', 'zetslay.telegram-notifications'].includes(plugin.id) || plugin.published === false) return;
  if (!authState.token) {
    setAuthModal(true);
    showToast('Войдите, чтобы управлять плагинами');
    return;
  }
  if (typeof claimPluginAction === 'function' && !claimPluginAction(pluginId)) return;
  const token = authState.token;
  const generation = sessionGeneration;
  const current = () => token === authState.token && generation === sessionGeneration;
  try {
    if (!plugin.installed) {
      await apiRequest(`/api/v1/plugins/${encodeURIComponent(plugin.id)}/install`, {
        method: 'POST', authenticated: true, body: { permissions: plugin.permissionsRaw || (plugin.id === 'zetslay.auto-reply' ? ['messages:read', 'replies:queue'] : ['messages:read', 'orders:read', 'telegram:send']), config: {} }
      });
      if (!current()) return;
      await apiRequest(`/api/v1/plugins/${encodeURIComponent(plugin.id)}/enable`, { method: 'POST', authenticated: true });
      if (!current()) return;
      showToast(`${plugin.name} установлен и включён`, 'success');
    } else if (plugin.active) {
      await apiRequest(`/api/v1/plugins/${encodeURIComponent(plugin.id)}/disable`, { method: 'POST', authenticated: true });
      if (!current()) return;
      showToast(`${plugin.name} остановлен`);
    } else {
      await apiRequest(`/api/v1/plugins/${encodeURIComponent(plugin.id)}/enable`, { method: 'POST', authenticated: true });
      if (!current()) return;
      showToast(`${plugin.name} включён`, 'success');
    }
    await loadPluginCatalog();
    if (current()) await loadPluginAudit().catch(() => {});
  } catch (error) {
    if (current()) {
      if (typeof pluginPageState !== 'undefined') pluginPageState.actionError = humanError(error);
      showToast(humanError(error), 'error');
    }
  } finally {
    if (current() && typeof releasePluginAction === 'function') releasePluginAction(pluginId);
  }
}

async function savePluginSettings(form) {
  const autoReply = state.plugins.find((plugin) => plugin.id === 'zetslay.auto-reply');
  const values = new FormData(form);
  const text = values.get('replyText')?.trim();
  if (!text) { showToast('Введите текст автоответа'); return; }
  if (!authState.token) { setAuthModal(true); showToast('Войдите, чтобы сохранить настройки'); return; }
  if (!autoReply?.installed) { showToast('Сначала установите Автоответчик'); return; }
  const terms = (name) => String(values.get(name) || '').split(',').map((term) => term.trim()).filter(Boolean).slice(0, 20);
  const config = {
    text,
    scenario: values.get('scenario') || 'all',
    keywords: terms('keywords'),
    excludeKeywords: terms('excludeKeywords'),
    quietHours: {
      enabled: form.elements.quietEnabled.checked,
      start: values.get('quietStart') || '22:00',
      end: values.get('quietEnd') || '08:00',
      timeZone: values.get('timeZone') || 'Asia/Almaty',
      behavior: values.get('quietBehavior') || 'pause',
      text: values.get('quietText')?.trim() || ''
    }
  };
  if (config.scenario === 'keywords' && !config.keywords.length) { showToast('Добавьте хотя бы одно ключевое слово'); return; }
  if (config.quietHours.enabled && config.quietHours.behavior === 'alternate' && !config.quietHours.text) { showToast('Введите ответ для тихих часов'); return; }
  try {
    await apiRequest('/api/v1/plugins/zetslay.auto-reply/config', { method: 'POST', authenticated: true, body: { config } });
    autoReply.config = config;
    await loadPluginAudit().catch(() => {});
    showToast('Настройки автоответчика сохранены', 'success');
  } catch (error) {
    showToast(humanError(error), 'error');
  }
}

async function saveTelegramSettings(form) {
  const telegram = state.plugins.find((plugin) => plugin.id === 'zetslay.telegram-notifications');
  if (!authState.token) { setAuthModal(true); showToast('Войдите, чтобы сохранить уведомления'); return; }
  if (!telegram?.installed) { showToast('Сначала установите Telegram-уведомления'); return; }
  const config = { messages: form.elements.messages.checked, paidOrders: form.elements.paidOrders.checked };
  try {
    await apiRequest('/api/v1/plugins/zetslay.telegram-notifications/config', { method: 'POST', authenticated: true, body: { config } });
    telegram.config = config;
    await loadPluginAudit().catch(() => {});
    showToast('Настройки Telegram сохранены', 'success');
  } catch (error) {
    showToast(humanError(error), 'error');
  }
}

async function simulatePluginEvent(form) {
  const output = document.querySelector('[data-plugin-simulation-output]');
  if (!authState.token) { setAuthModal(true); showToast('Войдите, чтобы запустить симуляцию'); return; }
  const input = new FormData(form);
  const type = input.get('type');
  const value = input.get('value')?.trim();
  if (output) output.textContent = 'Симуляция выполняется…';
  try {
    const data = type === 'message.received'
      ? { text: value, isFirstMessage: form.elements.isFirstMessage.checked, occurredAt: form.elements.occurredAt.value || undefined }
      : { orderId: value };
    const result = await apiRequest('/api/v1/plugins/simulate', { method: 'POST', authenticated: true, body: { type, data } });
    const actions = result.results.flatMap((item) => item.actions || []).map((action) => action.type);
    if (output) output.textContent = actions.length
      ? `Готово: ${actions.join(', ')}. Статус — simulated, в FunPay ничего не отправлено.`
      : 'Действий нет: плагин выключен либо сообщение не прошло выбранные условия или тихие часы.';
    await loadPluginAudit().catch(() => {});
  } catch (error) {
    if (output) output.textContent = humanError(error);
  }
}

function renderAnalytics() {
  const chart = byId('bar-chart');
  if (chart) {
    chart.innerHTML = state.analytics.map((item) => `
      <div class="bar-group"><i style="height:${item.revenue}%" title="Выручка ${item.revenue}%"></i><i style="height:${item.orders}%" title="Заказы ${item.orders}%"></i><span>${item.day}</span></div>`).join('');
  }
  const list = byId('top-products-list');
  if (list) {
    list.innerHTML = state.products.map((product, index) => `
      <article class="top-product"><span>0${index + 1}</span><div><strong>${product.name}</strong><small>Индекс продаж ${product.share}%</small></div><b>${product.revenue}</b></article>`).join('');
  }
}

function renderEvents() {
  const target = byId('event-log');
  if (!target) return;
  const colors = { violet: '143,114,255', yellow: '255,210,28', green: '112,223,160', blue: '109,157,255', muted: '150,153,165', red: '255,108,120' };
  target.innerHTML = state.events.map((event) => `
    <article class="event-entry" style="--event-rgb:${colors[event.tone]}"><time>${event.time}</time><span class="event-entry__icon">${icon(event.type === 'warning' ? 'alert-triangle' : event.type === 'system' ? 'refresh-cw' : event.type)}</span><div><strong>${event.title}</strong><p>${event.detail}</p></div><span><b>${event.type}</b><small>Demo</small></span></article>`).join('');
}

function setView(viewName, updateHash = true) {
  viewName = typeof normalizeProfileRoute === 'function' ? normalizeProfileRoute(viewName) : viewName;
  const authorId = typeof parseAuthorRoute === 'function' ? parseAuthorRoute(viewName) : null;
  const route = typeof parsePluginPageRoute === 'function' ? parsePluginPageRoute(viewName) : null;
  const resolvedView = authorId ? 'author' : route ? 'plugin' : viewTitles[viewName] ? viewName : 'dashboard';
  document.querySelectorAll('[data-view]').forEach(view => {
    const active = view.dataset.view === resolvedView;
    view.hidden = !active;
    view.classList.toggle('is-active', active);
  });
  document.querySelectorAll('[data-view-target]').forEach(item => {
    const active = item.dataset.viewTarget === (resolvedView === 'plugin' ? 'plugins' : resolvedView);
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-current', active ? 'page' : 'false');
    if (active) item.closest('.nav-group')?.setAttribute('open', '');
  });
  const label = byId('current-view-label');
  if (label) label.textContent = resolvedView === 'plugin' ? 'Плагины / Подробнее' : viewTitles[resolvedView];
  document.title = `${viewTitles[resolvedView]} — ZetSlay Control`;
  setSidebar(false);
  if (updateHash) history.replaceState(null, '', `#${route || authorId ? viewName : resolvedView}`);
  if (typeof renderPluginPage === 'function') renderPluginPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (typeof renderProfileRoute === 'function') renderProfileRoute(authorId ? viewName : resolvedView);
  if (resolvedView === 'lots' && typeof renderLotWorkspace === 'function') renderLotWorkspace();
}

function setSidebar(open) {
  document.querySelector('.sidebar')?.classList.toggle('is-open', open);
  document.querySelector('.sidebar-backdrop')?.classList.toggle('is-open', open);
  document.body.classList.toggle('sidebar-open', open);
}

function showToast(message, tone = 'default') {
  const stack = document.querySelector('.toast-region');
  if (!stack) return;
  const toast = document.createElement('div');
  toast.className = `toast toast--${tone}`;
  toast.innerHTML = `<i>${tone === 'success' ? '✓' : tone === 'error' ? '!' : 'ZL'}</i><span><strong>${tone === 'success' ? 'Готово' : tone === 'error' ? 'Нужно внимание' : 'ZetSlay'}</strong><span>${escapeHtml(message)}</span></span>`;
  stack.append(toast);
  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    window.setTimeout(() => toast.remove(), 220);
  }, 3100);
}

let connectionStep = 0;
let connectionStatus = null;
let connectionBusy = false;
let connectionLoading = false;
let connectionLoadFailed = false;
let connectionError = '';
let connectionResetTarget = null;
let connectionLinkTimer = null;
function stopConnectionLinkPolling() {
  if (connectionLinkTimer) { clearInterval(connectionLinkTimer); connectionLinkTimer = null; }
}
function startConnectionLinkPolling() {
  stopConnectionLinkPolling();
  connectionLinkTimer = setInterval(async () => {
    if (connectionBusy || connectionLoading) return;
    try {
      const status = await apiRequest('/api/v1/onboarding', { authenticated: true });
      if (document.querySelector('.connect-modal')?.hidden) return;
      state.onboarding = status;
      if (status.telegram?.linked) {
        stopConnectionLinkPolling();
        connectionStatus = null;
        connectionStep = wizardInitialStep();
        renderTelegramOnboarding();
        showToast('Бот подтвердил привязку', 'success');
      }
      renderConnectionWizard();
    } catch { /* A manual status check remains available. */ }
  }, 3000);
}
function validConnectionCode() {
  if (!connectionStatus?.linkCode) return null;
  if (state.onboarding?.workspaceId && connectionStatus.workspaceId !== state.onboarding.workspaceId) { connectionStatus = null; return null; }
  if (Date.now() >= Date.parse(connectionStatus.expiresAt)) { connectionStatus = null; return null; }
  return connectionStatus.linkCode;
}
const connectionDemoSteps = [
  { icon: 'card', title: 'Один аккаунт FunPay', text: 'ZetSlay подключает только один аккаунт к одному рабочему пространству. В демонстрации реальные секретные поля отключены.', points: ['Один аккаунт FunPay', 'Один worker', 'Один закреплённый proxy'], action: 'Посмотреть Golden Key' },
  { icon: 'lock', title: 'Golden Key вашего аккаунта', text: 'Ключ передаётся только защищённому API, шифруется в vault и никогда не возвращается в интерфейс.', points: ['Отдельная vault-ссылка', 'Нет ключа в PostgreSQL', 'Поле очищается после отправки'], action: 'Посмотреть прокси' },
  { icon: 'shield', title: 'Обязательный закреплённый прокси', text: 'Прокси хранится отдельно от Golden Key и используется только worker вашего магазина.', points: ['Один аккаунт — один прокси', 'Пароль не отображается повторно', 'Стабильный маршрут соединения'], action: 'Посмотреть проверку' },
  { icon: 'check', title: 'Read-only проверка', text: 'Preflight проверяет пару Golden Key + прокси, не выполняя действий в FunPay.', points: ['Доступен безопасный режим чтения', 'Worker закреплён за магазином', 'Автоматические действия заблокированы'], action: 'Закрыть демонстрацию' },
];

const liveConnectionMode = () => Boolean(authState.user && API_BASE_URL);

// Live wizard mirrors the backend onboarding journey:
// bot token -> link code confirmation -> Golden Key -> proxy -> read-only preflight.
const wizardInitialStep = () => {
  const onboarding = state.onboarding;
  if (!onboarding) return 0;
  if (!onboarding.telegram?.botConfigured) return 0;
  if (!onboarding.telegram?.linked) return 1;
  if (onboarding.state === 'blocked') return onboarding.funPay?.canRetryPreflight === true ? 4 : 2;
  if (!onboarding.funPay?.credentialConfigured) return 2;
  if (!onboarding.funPay?.proxyConfigured) return 3;
  return 4;
};

function renderConnectionWizard() {
  const modal = document.querySelector('.connect-modal');
  if (!modal) return;
  const body = modal.querySelector('.connect-modal__body');
  const action = modal.querySelector('[data-connect-next]');
  const back = modal.querySelector('[data-connect-back]');
  const reset = modal.querySelector('[data-connect-reset]');
  const mode = modal.querySelector('[data-connection-mode]');
  const error = modal.querySelector('[data-connect-error]');
  if (error) { error.textContent = connectionError; error.hidden = !connectionError; }
  if (reset) { reset.hidden = !liveConnectionMode() || !state.onboarding || Boolean(state.onboarding.funPay?.store) || connectionLoading || connectionLoadFailed || Boolean(connectionResetTarget); reset.disabled = connectionBusy; }
  if (back) { back.hidden = connectionStep === 0 || connectionLoading || connectionLoadFailed; back.disabled = connectionBusy; }
  modal.querySelectorAll('.connect-progress > span').forEach((item, index) => {
    item.classList.toggle('is-active', index === connectionStep);
    item.classList.toggle('is-complete', index < connectionStep);
  });
  modal.querySelectorAll('.connect-progress > span').forEach((item, index) => { item.style.display = index > 4 ? 'none' : ''; });
  if (!liveConnectionMode()) {
    const step = connectionDemoSteps[connectionStep];
    if (mode) mode.textContent = 'Connection wizard / Demo';
    if (body) body.innerHTML = `<span class="connect-illustration${connectionStep === 3 ? ' connect-illustration--success' : ''}">${icon(step.icon)}<i></i></span><h3>${step.title}</h3><p>${step.text}</p><ul>${step.points.map((point) => `<li>${icon('check')} ${point}</li>`).join('')}</ul>`;
    if (action) action.innerHTML = `${step.action} ${icon('chevron-right')}`;
    return;
  }
  if (mode) mode.textContent = 'Один аккаунт FunPay · защищённое подключение';
  if (connectionLoading || connectionLoadFailed) {
    if (body) body.innerHTML = connectionLoading
      ? `<span class="connect-illustration">${icon('shield')}<i></i></span><h3>Загружаем состояние подключения</h3><p>Проверяем тариф и шаги подключения вашего магазина.</p>`
      : `<span class="connect-illustration">${icon('help')}<i></i></span><h3>Статус не загрузился</h3><p>Повторите запрос. Пока статус неизвестен, данные для подключения не принимаются.</p>`;
    if (action) {
      action.disabled = connectionLoading;
      action.innerHTML = `${connectionLoading ? 'Загружаем…' : 'Повторить загрузку'} ${icon('chevron-right')}`;
    }
    return;
  }
  const onboarding = state.onboarding;
  if (connectionResetTarget) {
    const descriptions = {
      proxy: ['Изменить прокси?', 'Сохранённый прокси будет удалён из vault. Golden Key и привязка Telegram сохранятся. Затем введите новый адрес прокси.'],
      key: ['Изменить Golden Key?', 'Сохранённые Golden Key и прокси будут удалены из vault. Привязка Telegram сохранится. Затем введите ключ и прокси заново.'],
      all: ['Начать подключение заново?', 'Bot Token, Golden Key и прокси этого незавершённого подключения будут удалены из vault, а webhook рабочего бота отключён. Тариф и вход в кабинет сохранятся. Все шаги подключения нужно будет пройти заново.']
    };
    const [title, description] = descriptions[connectionResetTarget];
    if (body) body.innerHTML = `<span class="connect-illustration">${icon('help')}<i></i></span><h3>${title}</h3><p>${description}</p>`;
    if (back) { back.hidden = false; back.disabled = connectionBusy; }
    if (action) { action.disabled = connectionBusy; action.innerHTML = connectionBusy ? 'Удаляем…' : 'Подтвердить удаление'; }
    return;
  }
  const planRequired = onboarding?.state === 'plan_required' || (!onboarding && !connectionStatus);
  const linkCode = validConnectionCode();
  const initialStep = wizardInitialStep();
  const configuredBot = Boolean(onboarding?.telegram?.botConfigured);
  const linkedBot = Boolean(onboarding?.telegram?.linked);
  const botName = onboarding?.telegram?.bot?.username;
  const botLink = /^[A-Za-z0-9_]{5,32}$/.test(botName || '') ? `https://t.me/${botName}` : null;
  const worker = state.storeFleet.stores[0]?.workerId || 'будет создан автоматически';
  const checks = [
    `Телеграм-бот <b>${onboarding?.telegram?.botConfigured ? 'Проверен' : 'Ожидается'}</b>`,
    `Привязка <b>${onboarding?.telegram?.linked ? 'Подтверждена' : 'Ожидается'}</b>`,
    `Golden Key <b>${onboarding?.funPay?.credentialConfigured ? 'Сохранён' : 'Ожидается'}</b>`,
    `Прокси <b>${onboarding?.funPay?.proxyConfigured ? 'Сохранён' : 'Ожидается'}</b>`
  ];
  const pages = [
    planRequired
      ? `<span class="connect-illustration">${icon('card')}<i></i></span><h3>Сначала активный тариф</h3><p>${onboarding?.demoPlanAvailable ? 'На этом сервере доступна демо-активация тарифа для проверки подключения.' : 'Тариф пока не активен. Подключение магазина станет доступно после активации тарифа ZetSlay.'}</p><div class="connection-checks"><span>Тариф <b>Не активен</b></span></div>`
      : linkedBot ? `<span class="connect-illustration">${icon('check')}<i></i></span><h3>Бот подключён</h3><p>Ваш бот ${escapeHtml(botName ? `@${botName}` : '')} уже привязан. Можно вернуться к следующим шагам.</p>`
        : `<span class="connect-illustration">${icon('send')}<i></i></span><h3>${configuredBot ? 'Заменить Telegram-бота' : 'Ваш рабочий бот Telegram'}</h3><p>${configuredBot ? `Сейчас сохранён ${escapeHtml(botName ? `@${botName}` : 'бот')}. Новый Bot Token заменит его и сбросит выданный код привязки.` : 'Создайте бота через @BotFather и вставьте его Bot Token. Он будет отправлять уведомления вашего магазина.'}</p><div class="connection-form"><label>Bot Token<input type="password" name="botToken" minlength="10" maxlength="256" autocomplete="off" spellcheck="false" placeholder="123456789:AA..."></label><small>Токен отправится только в зашифрованный vault. Не передавайте его в Telegram.</small></div>${configuredBot ? '<div class="connect-helper"><button type="button" data-connect-return>Вернуться к коду без замены</button></div>' : ''}`,
    `<span class="connect-illustration">${icon('user')}<i></i></span><h3>${linkedBot ? 'Telegram привязан' : 'Привязка Telegram'}</h3><p>${linkedBot ? 'Подтверждение получено. Продолжайте подключение магазина.' : `Команду нужно отправить именно вашему боту ${escapeHtml(botName ? `@${botName}` : '')}. Сначала проверьте его связь и получите код.`}</p>${!linkedBot && linkCode ? `<div class="connection-store-badge"><span class="store-logo">TG</span><span><strong>/start ${escapeHtml(linkCode)}</strong><small>Код действует до ${escapeHtml(new Date(connectionStatus.expiresAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))}; команда отправляется боту, не @BotFather.</small></span></div>` : ''}${!linkedBot ? `<div class="connect-helper">${botLink ? `<a href="${botLink}${linkCode ? `?start=${encodeURIComponent(linkCode)}` : ''}" target="_blank" rel="noopener noreferrer">Открыть @${escapeHtml(botName)} в Telegram</a>` : ''}${linkCode ? '<button type="button" data-connect-repair>Проверить webhook бота</button>' : ''}</div><div class="connection-checks"><span>Ответ бота <b>После /start проверьте подтверждение в чате</b></span></div>` : ''}`,
    `<span class="connect-illustration">${icon('lock')}<i></i></span><h3>Golden Key</h3><p>${onboarding?.funPay?.credentialConfigured && connectionStep < initialStep ? 'Ключ уже сохранён в vault. Значение повторно не показывается.' : onboarding?.state === 'blocked' ? 'Предыдущая проверка остановлена. Укажите актуальный ключ и затем прокси для повторной проверки.' : 'Ключ отправляется напрямую в vault для вашего единственного аккаунта и не возвращается обратно.'}</p>${onboarding?.funPay?.credentialConfigured && connectionStep < initialStep ? '' : '<div class="connection-form"><label>Golden Key<input type="password" name="goldenKey" minlength="12" maxlength="4096" autocomplete="off" spellcheck="false" placeholder="Вставьте ключ один раз"></label><small>Не отправляйте Golden Key в Telegram или поддержку.</small></div>'}`,
    `<span class="connect-illustration">${icon('shield')}<i></i></span><h3>Обязательный прокси</h3><p>${onboarding?.funPay?.proxyConfigured && connectionStep < initialStep ? 'Прокси уже закреплён за магазином. Значение повторно не показывается.' : `Этот прокси будет использовать только worker <strong>${escapeHtml(worker)}</strong> для стабильного подключения.`}</p>${onboarding?.funPay?.proxyConfigured && connectionStep < initialStep ? '' : '<div class="connection-form"><label>Proxy URL<input type="password" name="proxyUrl" maxlength="2048" autocomplete="off" spellcheck="false" placeholder="host:port:login:password"></label><small>Формат: host:port:login:password или login:password@host:port — используется HTTP. Для выбора протокола укажите полный URL http://, https:// или socks5://. Адрес и пароль не появятся в ответе API.</small></div>'}`,
    `<span class="connect-illustration connect-illustration--success">${icon('check')}<i></i></span><h3>Read-only проверка</h3><p>ZetSlay проверит аккаунт, чтение заказов и чатов через закреплённый прокси. Лоты и баланс сейчас недоступны; данные на FunPay не изменяются.</p><div class="connection-checks">${checks.map((line) => `<span>${line.split(' <b>')[0]} <b>${line.split(' <b>')[1]}</b></span>`).join('')}<span>Live-действия <b>Отключены</b></span></div>`
  ];
  if (body) body.innerHTML = pages[connectionStep] || pages.at(-1);
  if (body && !onboarding?.funPay?.store) {
    const edits = [];
    if (onboarding?.funPay?.proxyConfigured && connectionStep >= 3) edits.push('<button type="button" data-connect-edit="proxy">Изменить прокси</button>');
    if (onboarding?.funPay?.credentialConfigured && connectionStep >= 2) edits.push('<button type="button" data-connect-edit="key">Изменить Golden Key</button>');
    if (edits.length) body.innerHTML += `<div class="connect-helper">${edits.join('')}</div>`;
  }
  if (body && onboarding?.funPay?.proxyConfigured && connectionStep >= 3) {
    body.innerHTML += `<div class="connect-helper"><button type="button" data-connect-proxy-diagnostics ${connectionBusy ? 'disabled' : ''}>Диагностика прокси</button></div>`;
    if (state.proxyDiagnostics) body.innerHTML += formatProxyDiagnostics(state.proxyDiagnostics);
  }
  if (action) {
    const labels = planRequired ? [onboarding?.demoPlanAvailable ? 'Активировать демо-тариф' : 'Тариф не активен'] : [configuredBot && !linkedBot ? 'Заменить бота' : 'Сохранить Bot Token', linkedBot ? 'Продолжить' : linkCode ? 'Проверить привязку' : 'Проверить бота и получить код', 'Сохранить Golden Key', 'Закрепить прокси', 'Запустить read-only проверку'];
    action.disabled = connectionBusy || (planRequired && !onboarding?.demoPlanAvailable);
    action.innerHTML = `${connectionBusy ? 'Проверяем…' : connectionStep < initialStep && !(connectionStep === 0 && configuredBot && !linkedBot) ? 'Продолжить' : labels[connectionStep] || labels.at(-1)} ${icon('chevron-right')}`;
  }
}

async function refreshConnectionWizard() {
  if (connectionLoading) return;
  connectionLoading = true;
  connectionLoadFailed = false;
  connectionError = '';
  renderConnectionWizard();
  try {
    await loadOnboarding();
    connectionStep = wizardInitialStep();
    if (connectionStep === 1 && validConnectionCode()) startConnectionLinkPolling();
  } catch (error) {
    connectionLoadFailed = true;
    connectionError = humanError(error);
  } finally {
    connectionLoading = false;
    renderConnectionWizard();
  }
}

function setModal(open) {
  const modal = document.querySelector('.connect-modal');
  const backdrop = document.querySelector('.modal-backdrop');
  if (!modal) return;
  if (open) {
    modal.hidden = false;
    validConnectionCode();
    connectionResetTarget = null;
    connectionStep = liveConnectionMode() ? wizardInitialStep() : 0;
    connectionError = '';
    if (liveConnectionMode()) refreshConnectionWizard();
    else renderConnectionWizard();
  }
  requestAnimationFrame(() => {
    modal.classList.toggle('is-open', open);
    backdrop?.classList.toggle('is-open', open);
  });
  document.body.classList.toggle('modal-open', open);
  if (open) {
    window.setTimeout(() => modal.querySelector('button')?.focus(), 30);
  } else {
    stopConnectionLinkPolling();
    window.setTimeout(() => {
      if (!modal.classList.contains('is-open')) modal.hidden = true;
    }, 220);
  }
}

function backConnectionWizard() {
  if (connectionBusy || connectionLoading) return;
  if (connectionResetTarget) { connectionResetTarget = null; connectionError = ''; renderConnectionWizard(); return; }
  if (connectionStep <= 0) return;
  connectionError = '';
  connectionStep -= 1;
  renderConnectionWizard();
}

function formatProxyDiagnostics(report) {
  const stages = { tcp: 'TCP', proxy_tls: 'TLS к прокси', socks_greeting: 'Ответ SOCKS5',
    proxy_auth: 'Авторизация прокси', proxy_connect: 'Туннель CONNECT', target_tls: 'TLS к сайту', target_http: 'Ответ сайта',
    proxy_dns: 'DNS прокси', curl_request: 'Запрос через curl (этап не подтверждён)' };
  const codes = { TIMEOUT: 'таймаут', CLOSED: 'соединение закрыто', AUTH_REJECTED: 'авторизация отклонена',
    METHOD_REJECTED: 'способ авторизации отклонён', TUNNEL_REJECTED: 'туннель отклонён',
    BAD_RESPONSE: 'неожиданный ответ', ECONNREFUSED: 'соединение отклонено',
    DNS_FAILED: 'адрес не разрешён', TLS_REJECTED: 'сертификат или TLS отклонён', UNAVAILABLE: 'запрос не выполнен' };
  const rows = (report.results || []).map(result => {
    const value = result.ok ? `HTTP ${result.targetStatus}`
      : `${stages[result.stage] || result.stage}: ${result.code === 'HTTP_STATUS' ? `HTTP ${result.targetStatus}` : codes[result.code] || result.code}`;
    return `<span>${escapeHtml(result.protocol.toUpperCase())}${result.client === 'curl' ? ' · curl' : ''} · ${escapeHtml(result.target)}<b>${escapeHtml(value)}</b></span>`;
  }).join('');
  const configuredWorks = (report.results || []).some(result => result.protocol === report.configuredProtocol && result.target === 'funpay.com' && result.ok);
  const socksWorks = (report.results || []).some(result => result.protocol === 'socks5' && result.target === 'funpay.com' && result.ok);
  const hint = socksWorks && !configuredWorks && report.configuredProtocol !== 'socks5'
    ? '<p>SOCKS5 отвечает. Если HTTP/HTTPS не работает, нажмите «Изменить прокси» и введите тот же адрес, логин и пароль со схемой socks5://. Затем запустите read-only проверку магазина.</p>' : '';
  const client = report.client === 'curl' ? 'Клиент коннектора: curl. Проверяется только сохранённый протокол. ' : report.client === 'node-probe' ? 'Проверка протоколов: Node. ' : '';
  return `${hint}<div data-proxy-diagnostics-result><p>Сохранённый адрес: ${escapeHtml(report.endpoint)}. Сохранённый протокол: ${escapeHtml((report.configuredProtocol || 'не указан').toUpperCase())}. ${client}Диагностика проверяет соединение без Golden Key. Успешный ответ сайта ещё не означает, что магазин привязан.</p><div class="connection-checks">${rows}</div></div>`;
}

async function diagnoseConnectionProxy() {
  if (connectionBusy || !authState.token || !state.onboarding?.funPay?.proxyConfigured) return;
  const token = authState.token;
  connectionBusy = true; connectionError = ''; state.proxyDiagnostics = null;
  renderConnectionWizard();
  try {
    const report = await apiRequest('/api/v1/onboarding/proxy-diagnostics', { method: 'POST', authenticated: true, body: {} });
    if (token !== authState.token) return;
    state.proxyDiagnostics = report;
  } catch (error) {
    if (token === authState.token) connectionError = humanError(error);
  } finally {
    if (token === authState.token) { connectionBusy = false; renderConnectionWizard(); }
  }
}

function beginConnectionReset(target) {
  if (connectionBusy || connectionLoading || state.onboarding?.funPay?.store || !['all', 'key', 'proxy'].includes(target)) return;
  connectionResetTarget = target;
  connectionError = '';
  renderConnectionWizard();
}

async function confirmConnectionReset() {
  const target = connectionResetTarget;
  if (!target || connectionBusy || connectionLoading) return;
  connectionBusy = true;
  connectionError = '';
  stopConnectionLinkPolling();
  renderConnectionWizard();
  try {
    const updated = await apiRequest('/api/v1/onboarding/reset', { method: 'POST', authenticated: true, body: { target, confirmed: true } });
    onboardingRevision += 1;
    state.onboarding = updated;
    state.proxyDiagnostics = null;
    connectionStatus = null;
    connectionResetTarget = null;
    connectionStep = wizardInitialStep();
    renderTelegramOnboarding();
    showToast(target === 'all' ? 'Подключение сброшено. Можно начать заново.' : 'Сохранённые данные удалены. Введите новое значение.', 'success');
  } catch (error) {
    connectionError = humanError(error);
  } finally {
    connectionBusy = false;
    renderConnectionWizard();
  }
}

async function repairConnectionWebhook() {
  if (connectionBusy || connectionLoading) return;
  connectionBusy = true;
  connectionError = '';
  renderConnectionWizard();
  try {
    state.onboarding = await apiRequest('/api/v1/onboarding/telegram/webhook', { method: 'POST', authenticated: true, body: {} });
    showToast('Связь с ботом восстановлена. Отправьте команду /start ещё раз.', 'success');
  } catch (error) {
    connectionError = humanError(error);
  } finally {
    connectionBusy = false;
    renderConnectionWizard();
  }
}

async function advanceConnectionWizard() {
  if (!liveConnectionMode()) {
    if (connectionStep < connectionDemoSteps.length - 1) {
      connectionStep += 1;
      renderConnectionWizard();
      return;
    }
    setModal(false);
    showToast('Демонстрация завершена. Реальные секреты не вводились.', 'success');
    return;
  }
  if (connectionBusy || connectionLoading) return;
  if (connectionResetTarget) { await confirmConnectionReset(); return; }
  if (connectionLoadFailed || !state.onboarding) { await refreshConnectionWizard(); return; }
  const modal = document.querySelector('.connect-modal');
  const planRequired = state.onboarding?.state === 'plan_required';
  if (!planRequired && connectionStep < wizardInitialStep() &&
      !(connectionStep === 0 && state.onboarding.telegram?.botConfigured && !state.onboarding.telegram?.linked)) {
    connectionStep += 1;
    renderConnectionWizard();
    return;
  }
  let submittedValue = null;
  if (connectionStep === 0 && !planRequired) {
    submittedValue = modal.querySelector('input[name="botToken"]')?.value;
    if (!submittedValue) { showToast('Введите Bot Token от @BotFather'); return; }
  }
  if (connectionStep === 2) {
    submittedValue = modal.querySelector('input[name="goldenKey"]')?.value;
    if (!submittedValue) { showToast('Введите Golden Key'); return; }
  }
  if (connectionStep === 3) {
    submittedValue = modal.querySelector('input[name="proxyUrl"]')?.value;
    if (!submittedValue) { showToast('Введите host:port:login:password или полный URL прокси с портом'); return; }
  }
  connectionError = '';
  connectionBusy = true;
  renderConnectionWizard();
  try {
    if (connectionStep === 0 && planRequired) {
      const activated = await apiRequest('/api/v1/onboarding/demo-plan', { method: 'POST', authenticated: true, body: {} });
      onboardingRevision += 1;
      authState.workspace = activated.workspace;
      state.onboarding = activated.onboarding;
      connectionStep = wizardInitialStep();
      renderDashboard();
      renderTelegramOnboarding();
      showToast('Демо-тариф активирован', 'success');
      return;
    }
    if (connectionStep === 0) {
      state.onboarding = await apiRequest('/api/v1/onboarding/telegram/bot', { method: 'POST', authenticated: true, body: { token: submittedValue } });
      submittedValue = null;
      connectionStatus = null;
      showToast('Bot Token принят', 'success');
    } else if (connectionStep === 1) {
      if (!validConnectionCode()) {
        state.onboarding = await apiRequest('/api/v1/onboarding/telegram/webhook', { method: 'POST', authenticated: true, body: {} });
        const issued = await apiRequest('/api/v1/onboarding/telegram/link-code', { method: 'POST', authenticated: true, body: {} });
        connectionStatus = { linkCode: issued.code, expiresAt: issued.expiresAt, workspaceId: issued.onboarding.workspaceId };
        state.onboarding = issued.onboarding;
        startConnectionLinkPolling();
        showToast('Код создан. Отправьте команду вашему боту в Telegram.', 'success');
        renderConnectionWizard();
        return;
      }
      const status = await apiRequest('/api/v1/onboarding', { authenticated: true });
      state.onboarding = status;
      if (!status.telegram?.linked) {
        connectionError = 'Подтверждение ещё не получено. Отправьте команду своему боту и проверьте его ответ. При отсутствии ответа нажмите «Проверить webhook бота».';
        return;
      }
      stopConnectionLinkPolling();
      connectionStatus = null;
      showToast('Telegram привязан', 'success');
    } else if (connectionStep === 2) {
      state.onboarding = await apiRequest('/api/v1/onboarding/funpay/key', { method: 'POST', authenticated: true, body: { goldenKey: submittedValue } });
      submittedValue = null;
      const field = modal.querySelector('input[name="goldenKey"]');
      if (field) field.value = '';
      showToast('Golden Key сохранён в vault', 'success');
    } else if (connectionStep === 3) {
      state.onboarding = await apiRequest('/api/v1/onboarding/funpay/proxy', { method: 'POST', authenticated: true, body: { proxyUrl: submittedValue } });
      submittedValue = null;
      const field = modal.querySelector('input[name="proxyUrl"]');
      if (field) field.value = '';
      state.proxyDiagnostics = null;
      showToast('Прокси закреплён', 'success');
    } else if (connectionStep === 4) {
      state.onboarding = await apiRequest('/api/v1/onboarding/funpay/preflight', { method: 'POST', authenticated: true, body: {} });
      await loadStoreFleet();
      let contentLoaded = true;
      try { await syncStoreContent({ silent: true }); } catch { contentLoaded = false; }
      setModal(false);
      showToast(contentLoaded ? 'Магазин подключён: заказы и чаты доступны для чтения' : 'Магазин привязан, но обновление данных не удалось. Повторите синхронизацию.', contentLoaded ? 'success' : 'error');
      return;
    }
    connectionStep += 1;
    showToast(`Шаг ${connectionStep + 1} из 5`, 'success');
  } catch (error) {
    connectionError = humanError(error);
    showToast(connectionError, 'error');
  } finally {
    connectionBusy = false;
    renderConnectionWizard();
  }
}

function bindInteractions() {
  document.addEventListener('click', (event) => {
    const noticeDismiss = event.target.closest('[data-notice-dismiss]');
    if (noticeDismiss) { noticeDismiss.closest('.notice-banner')?.remove(); return; }
    const passwordToggle = event.target.closest('[data-password-toggle]');
    if (passwordToggle) {
      const password = document.querySelector('[data-auth-form] input[name="password"]');
      if (!password) return;
      const visible = password.type === 'password';
      password.type = visible ? 'text' : 'password';
      passwordToggle.setAttribute('aria-pressed', String(visible));
      passwordToggle.setAttribute('aria-label', visible ? 'Скрыть пароль' : 'Показать пароль');
      return;
    }
    const authMode = event.target.closest('[data-auth-mode]');
    if (authMode) { setAuthMode(authMode.dataset.authMode); return; }
    const telegramLogin = event.target.closest('[data-telegram-login]');
    if (telegramLogin) { startTelegramLogin(telegramLogin); return; }
    if (event.target.closest('[data-auth-open]')) { if (authState.user) setView('profile'); else setAuthModal(true); return; }
    if (event.target.closest('[data-auth-close]')) { stopTelegramLoginPolling(); setAuthModal(false); return; }
    if (event.target.closest('[data-auth-logout]')) {
      apiRequest('/api/v1/auth/logout', { method: 'POST', authenticated: true }).catch(() => {});
      clearSession();
      setView('dashboard');
      return;
    }
    const viewButton = event.target.closest('[data-view-target], [data-view-link]');
    if (viewButton) {
      event.preventDefault();
      const targetView = viewButton.dataset.viewTarget || viewButton.dataset.viewLink;
      setView(targetView);
      if (targetView === 'telegram') loadOnboarding().catch((error) => showToast(humanError(error), 'error'));
      return;
    }

    if (event.target.closest('[data-sidebar-open]')) {
      setSidebar(true);
      return;
    }
    if (event.target.closest('[data-sidebar-close]')) {
      setSidebar(false);
      return;
    }
    if (event.target.closest('[data-open-connect]')) {
      const switcherPanel = document.querySelector('[data-store-switcher-panel]');
      if (switcherPanel) switcherPanel.hidden = true;
      setModal(true);
      return;
    }
    const storeSwitcher = event.target.closest('[data-store-switcher]');
    if (storeSwitcher) {
      const panel = document.querySelector('[data-store-switcher-panel]');
      if (panel) panel.hidden = !panel.hidden;
      storeSwitcher.setAttribute('aria-expanded', String(panel ? !panel.hidden : false));
      return;
    }
    if (event.target.closest('[data-store-runtime]')) { setStoreRuntime(); return; }
    if (event.target.closest('[data-sync-content]')) { syncStoreContent().catch(() => {}); return; }
    if (event.target.closest('[data-telegram-issue-code]')) { issueTelegramCode(); return; }
    if (event.target.closest('[data-tg-copy]')) { copyTelegramCode(); return; }
    if (event.target.closest('[data-close-connect]') || event.target.matches('.modal-backdrop')) {
      setModal(false);
      return;
    }
    if (event.target.closest('[data-connect-return]')) { connectionStep = 1; connectionError = ''; renderConnectionWizard(); return; }
    if (event.target.closest('[data-connect-proxy-diagnostics]')) { diagnoseConnectionProxy(); return; }
    if (event.target.closest('[data-connect-repair]')) { repairConnectionWebhook(); return; }
    const editConnection = event.target.closest('[data-connect-edit]');
    if (editConnection) { beginConnectionReset(editConnection.dataset.connectEdit); return; }
    if (event.target.closest('[data-connect-reset]')) { beginConnectionReset('all'); return; }

    const guideTab = event.target.closest('[data-guide-target]');
    if (guideTab) {
      const target = guideTab.dataset.guideTarget;
      document.querySelectorAll('[data-guide-target]').forEach((button) => button.classList.toggle('is-active', button === guideTab));
      document.querySelectorAll('[data-guide-panel]').forEach((panel) => {
        const active = panel.dataset.guidePanel === target;
        panel.hidden = !active;
        panel.classList.toggle('is-active', active);
      });
      return;
    }

    const toggle = event.target.closest('[data-toggle]');
    if (toggle) {
      const next = toggle.getAttribute('aria-checked') !== 'true';
      toggle.setAttribute('aria-checked', String(next));
      toggle.classList.toggle('is-on', next);
      showToast(next ? 'Функция включена в демо-режиме' : 'Функция приостановлена в демо-режиме', next ? 'success' : 'default');
      return;
    }

    const period = event.target.closest('[data-period]');
    if (period) {
      period.parentElement.querySelectorAll('[data-period]').forEach((button) => button.classList.remove('is-active'));
      period.classList.add('is-active');
      showToast(`Период аналитики: ${period.textContent.trim()}`);
      return;
    }

    if (event.target.closest('[data-finance-refresh]')) {
      refreshFinance();
      return;
    }

    const plugin = event.target.closest('[data-plugin-id]');
    if (plugin) {
      changePluginState(plugin.dataset.pluginId);
      return;
    }

    if (event.target.closest('[data-plugin-dialog-close]')) { closePluginDialog(); return; }
    const editor = event.target.closest('[data-plugin-edit]');
    if (editor) { openPluginEditor(editor.dataset.pluginEdit); return; }
    if (event.target.closest('[data-plugin-publish]')) { openPluginEditor(); return; }
    const coverEdit = event.target.closest('[data-cover-plugin]');
    if (coverEdit) {
      if (!canManagePluginCatalog()) return;
      const input = document.querySelector('[data-plugin-cover-input]');
      if (input) { input.dataset.coverFor = coverEdit.dataset.coverPlugin; input.click(); }
      return;
    }
    if (event.target.closest('[data-plugin-cover-admin]')) {
      if (!canManagePluginCatalog()) return;
      state.pluginCoverAdmin = !state.pluginCoverAdmin;
      renderPlugins();
      showToast(state.pluginCoverAdmin ? 'Режим обложек: нажмите + на карточке, чтобы загрузить изображение' : 'Режим обложек выключен', state.pluginCoverAdmin ? 'success' : 'default');
      return;
    }
    const catButton = event.target.closest('[data-plugin-cat]');
    if (catButton) {
      state.pluginFilter.cat = catButton.dataset.pluginCat;
      renderPlugins();
      return;
    }

    const details = event.target.closest('[data-plugin-details]');
    if (details) { openPluginDetails(details.dataset.pluginDetails); return; }

    const quickReply = event.target.closest('[data-quick-reply]');
    if (quickReply) {
      const composer = byId('message-composer');
      if (composer) {
        composer.value = quickReply.dataset.quickReply;
        composer.focus();
      }
      return;
    }

    const conversation = event.target.closest('[data-chat]');
    if (conversation) {
      state.conversations.forEach((item) => { item.active = (item.threadId || item.name) === conversation.dataset.chat; });
      renderConversations();
      return;
    }

    const toastTrigger = event.target.closest('[data-toast]');
    if (toastTrigger) showToast(toastTrigger.dataset.toast);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setModal(false);
      setSidebar(false);
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      showToast('Глобальный поиск появится после подключения backend');
    }
  });

  document.querySelector('[data-connect-next]')?.addEventListener('click', () => advanceConnectionWizard());
  document.querySelector('[data-connect-back]')?.addEventListener('click', () => backConnectionWizard());

  document.querySelector('[data-plugin-search]')?.addEventListener('input', (event) => {
    state.pluginFilter.query = event.target.value || '';
    renderPlugins();
  });
  document.querySelector('[data-plugin-category]')?.addEventListener('change', event => {
    state.pluginFilter.cat = event.target.value; renderPlugins();
  });
  document.querySelector('[data-plugin-sort]')?.addEventListener('change', event => {
    state.pluginFilter.sort = event.target.value; renderPlugins();
  });
  document.addEventListener('input', event => {
    if (event.target.matches('[data-plugin-description-input]')) {
      const preview = document.querySelector('[data-plugin-preview]');
      if (preview) preview.innerHTML = formatPluginDescription(event.target.value);
    }
  });
  document.addEventListener('submit', event => {
    if (event.target.matches('[data-plugin-editor]')) { event.preventDefault(); savePluginEditor(event.target); }
  });
  document.querySelector('[data-plugin-cover-input]')?.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    const pluginId = event.target.dataset.coverFor;
    event.target.value = '';
    if (!canManagePluginCatalog() || !file || !pluginId) return;
    const token = authState.token;
    try {
      const cover = await compressPluginCover(file);
      if (token !== authState.token || !canManagePluginCatalog()) return;
      const plugin = state.plugins.find(item => item.id === pluginId);
      await saveCatalogEntry({ ...plugin, cover });
      if (token !== authState.token) return;
      await loadPluginCatalog();
      showToast('Обложка сохранена', 'success');
    } catch (error) { showToast(humanError(error), 'error'); }
  });

  byId('send-message')?.addEventListener('click', () => {
    const composer = byId('message-composer');
    if (!composer?.value.trim()) {
      showToast('Введите сообщение перед отправкой');
      return;
    }
    composer.value = '';
    showToast('Отправка отключена: кабинет работает в безопасном read-only режиме.');
  });
}

function updateClock() {
  const time = byId('system-clock');
  if (!time) return;
  time.textContent = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Almaty', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date());
}

function init() {
  renderOrders();
  renderConversations();
  renderLots();
  renderAutomations();
  renderPlugins();
  renderPluginAudit();
  renderAnalytics();
  renderEvents();
  const composer = document.querySelector('.composer textarea');
  const sendButton = document.querySelector('.composer .send-button');
  if (composer) composer.id = 'message-composer';
  if (sendButton) {
    sendButton.id = 'send-message';
    sendButton.removeAttribute('data-toast');
  }
  document.querySelectorAll('.quick-replies button').forEach((button) => {
    button.dataset.quickReply = button.textContent.trim();
  });
  const securityToggle = document.querySelector('.security-row .toggle');
  if (securityToggle) securityToggle.dataset.toggle = 'two-factor';
  bindInteractions();
  document.querySelector('[data-auth-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    submitAuth(event.currentTarget);
  });
  document.querySelector('[data-auth-resend]')?.addEventListener('click', (event) => resendVerification(event.currentTarget));
  document.querySelector('[data-plugin-settings]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    savePluginSettings(event.currentTarget);
  });
  document.querySelector('[data-plugin-simulator]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    simulatePluginEvent(event.currentTarget);
  });
  document.querySelector('[data-telegram-settings]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    saveTelegramSettings(event.currentTarget);
  });
  document.querySelector('[data-telegram-onboarding-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    submitTelegramOnboarding(event.currentTarget);
  });
  document.querySelector('[data-withdrawal-intent-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    createWithdrawalIntent(event.currentTarget);
  });
  renderFinance();
  renderStoreFleet();
  renderTelegramOnboarding();
  initializeAuthFlow().catch((error) => showToast(humanError(error), 'error'));
  setView(location.hash.slice(1) || 'dashboard', false);
  updateClock();
  window.setInterval(updateClock, 1000);
  window.addEventListener('hashchange', () => setView(location.hash.slice(1), false));
}

function filterPluginCatalog(plugins, filter) {
  const query = (filter.query || '').trim().toLocaleLowerCase('ru-RU');
  const list = plugins.filter(p => (filter.cat === 'all' || p.category === filter.cat) &&
    (!query || `${p.name} ${p.description}`.toLocaleLowerCase('ru-RU').includes(query)));
  const price = p => Number.isInteger(p.priceRub) ? p.priceRub : Number(String(p.price).replace(/\D/g, '')) || 0;
  if (filter.sort === 'price-asc') list.sort((a, b) => price(a) - price(b));
  if (filter.sort === 'price-desc') list.sort((a, b) => price(b) - price(a));
  if (filter.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  if (filter.sort === 'installed') list.sort((a, b) => Number(Boolean(b.installed)) - Number(Boolean(a.installed)));
  return list;
}

function formatPluginDescription(text) {
  const inline = value => escapeHtml(value).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  return String(text || '').split(/\r?\n/).map(line =>
    line.startsWith('>') ? `<blockquote>${inline(line.slice(1).trimStart())}</blockquote>`
      : line.trim() ? `<p>${inline(line)}</p>` : '<br>').join('');
}

function closePluginDialog() {
  const dialog = document.querySelector('[data-plugin-dialog]');
  if (dialog?.open) dialog.close();
}

function showPluginDialog(html) {
  const dialog = document.querySelector('[data-plugin-dialog]');
  if (!dialog) return;
  dialog.querySelector('[data-plugin-dialog-body]').innerHTML = html;
  if (!dialog.open) dialog.showModal();
}

function openPluginDetails(id) {
  const plugin = state.plugins.find(item => item.id === id);
  if (!plugin || (plugin.published === false && !canManagePluginCatalog())) return;
  location.hash = `#plugins/${encodeURIComponent(id)}`;
}

function openPluginEditor(id = '') {
  if (!canManagePluginCatalog()) return;
  const p = state.plugins.find(item => item.id === id) || {
    id: '', name: '', category: 'control', priceRub: 0, description: '', published: false
  };
  showPluginDialog(`<header class="plugin-dialog__header"><h2 id="plugin-dialog-title">${id ? 'Редактировать плагин' : 'Новый плагин'}</h2><button class="icon-button" type="button" data-plugin-dialog-close aria-label="Закрыть">×</button></header>
    <form class="plugin-editor" data-plugin-editor>
      <label>ID плагина<input name="id" value="${escapeHtml(p.id)}" ${id ? 'readonly' : ''} required maxlength="100" pattern="[a-z][a-z0-9]*([.][a-z0-9]+|-[a-z0-9]+)*" placeholder="zetslay.review-reminder"></label>
      <small>ID должен совпадать с manifest.id рабочего модуля. Без модуля в runtime карточка будет отмечена «Скоро».</small>
      <label>Название<input name="name" value="${escapeHtml(p.name)}" required maxlength="100"></label>
      <div class="plugin-editor__row"><label>Категория<select name="category">${[['sales','Продажи'],['chat','Общение'],['analytics','Аналитика'],['control','Контроль']].map(([v,l]) => `<option value="${v}" ${p.category === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Цена от, ₽<input name="priceRub" type="number" min="0" max="1000000" step="1" value="${p.priceRub || 0}" required></label></div>
      <small>Цена отображается в каталоге. Оплата покупки плагинов пока не реализована.</small>
      <label>Описание<textarea name="description" rows="8" required maxlength="8000" data-plugin-description-input>${escapeHtml(p.description)}</textarea></label>
      <small>**Жирный текст** · &gt; Цитата на отдельной строке. HTML не выполняется.</small>
      <div class="plugin-description plugin-editor__preview" data-plugin-preview>${formatPluginDescription(p.description)}</div>
      <label class="plugin-editor__checkbox"><input name="published" type="checkbox" ${p.published ? 'checked' : ''}> Опубликовать в каталоге</label>
      <p role="alert" class="plugin-editor__error" data-plugin-editor-error></p>
      <footer class="plugin-dialog__footer"><button class="button button--ghost" type="button" data-plugin-dialog-close>Отмена</button><button class="button button--primary" type="submit">Сохранить</button></footer>
    </form>`);
}

async function saveCatalogEntry(entry) {
  if (!canManagePluginCatalog()) throw new Error('Публикация доступна только администратору');
  const { id, name, category, priceRub, description, cover = '', published = true } = entry;
  return apiRequest('/api/v1/plugin-catalog', { method: 'POST', authenticated: true,
    body: { id, name, category, priceRub, description, cover, published } });
}

async function savePluginEditor(form) {
  if (!canManagePluginCatalog() || form.dataset.busy === 'true') return;
  const token = authState.token;
  const fields = form.elements;
  const button = form.querySelector('[type="submit"]');
  const error = form.querySelector('[data-plugin-editor-error]');
  form.dataset.busy = 'true'; button.disabled = true; error.textContent = '';
  try {
    const previous = state.plugins.find(p => p.id === fields.id.value);
    await saveCatalogEntry({ id: fields.id.value, name: fields.name.value, category: fields.category.value,
      priceRub: Number(fields.priceRub.value), description: fields.description.value,
      cover: previous?.cover || '', published: fields.published.checked });
    if (token !== authState.token) return;
    closePluginDialog();
    showToast('Карточка сохранена', 'success');
    try { await loadPluginCatalog(); }
    catch { showToast('Карточка сохранена. Обновите страницу, чтобы загрузить каталог.', 'error'); }
  } catch (failure) {
    if (token === authState.token) error.textContent = humanError(failure);
  } finally { form.dataset.busy = 'false'; button.disabled = false; }
}

async function compressPluginCover(file) {
  return preparePluginCover(file);
}

init();
