/* Store identity uses the selected connection and its matching read-only snapshot. */
function safeStoreAvatar(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['funpay.com', 's.funpay.com', 'sfunpay.com'].includes(url.hostname) && !url.username && !url.password && !url.port && !url.hash ? url.href : '';
  } catch { return ''; }
}
function storeIdentityModel(store, content, plugins = [], signedIn = false) {
  const matching = signedIn && store && String(content?.profile?.id) === String(store.id);
  const profile = matching ? content.profile : null;
  const name = signedIn && store ? String(profile?.displayName || store.displayName || 'Магазин FunPay') : 'Ваш магазин FunPay';
  return {
    name, id: signedIn && store ? String(store.id) : '',
    avatar: signedIn && store ? safeStoreAvatar(profile?.avatarUrl || store.avatarUrl) : '',
    initials: name.trim().slice(0, 2).toUpperCase() || 'FP',
    connected: signedIn && store?.status === 'connected_read_only',
    proxy: signedIn && Boolean(store?.proxyConfigured),
    observedAt: matching && typeof content.observedAt === 'string' && Number.isFinite(Date.parse(content.observedAt)) ? content.observedAt : null,
    active: signedIn ? plugins.filter(p => p.installed && p.active && !p.planned).length : 0,
    installed: signedIn ? plugins.filter(p => p.installed && !p.planned).length : 0
  };
}
function storeIdentityAvatar(model) {
  const escape = overviewEscape;
  return `<span class="store-portrait${model.connected ? ' is-connected' : ''}" aria-label="${model.connected ? 'Магазин подключён' : 'Подключение не подтверждено'}"><span class="store-portrait__fallback">${escape(model.initials)}</span>${model.avatar ? `<img src="${escape(model.avatar)}" alt="Аватар магазина ${escape(model.name)}" referrerpolicy="no-referrer" data-store-portrait-image>` : ''}<i class="store-portrait__dot" aria-hidden="true"></i></span>`;
}
function renderStoreIdentity() {
  const model = storeIdentityModel(selectedStore(), state.storeContent, state.plugins, Boolean(authState.user));
  const escape = overviewEscape;
  const avatar = storeIdentityAvatar(model);
  document.querySelectorAll('[data-selected-store-avatar]').forEach(node => { node.innerHTML = avatar; });
  const sidebar = document.querySelector('.workspace-switcher--single');
  if (sidebar) {
    sidebar.classList.toggle('store-sidebar', true);
    let status = sidebar.querySelector('[data-store-sidebar-status]');
    if (!status) { status = document.createElement('span'); status.dataset.storeSidebarStatus = ''; sidebar.append(status); }
    status.textContent = model.connected ? 'Подключён' : 'Ожидает подключения';
    status.className = `store-sidebar__status${model.connected ? ' is-connected' : ''}`;
  }
  const grid = document.querySelector('[data-overview] .overview-grid');
  if (!grid) return;
  let panel = document.querySelector('[data-store-identity]');
  if (!panel) { panel = document.createElement('div'); panel.dataset.storeIdentity = ''; grid.before(panel); }
  const time = model.observedAt ? new Date(model.observedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Ещё не загружены';
  const symbol = id => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
  panel.innerHTML = `<article class="store-banner"><div class="store-banner__identity">${avatar}<div><span class="store-kicker">ВАШ МАГАЗИН / FUNPAY</span><h2>${escape(model.name)}</h2><p>${model.id ? `ID ${escape(model.id)} · Один аккаунт` : 'Подключите аккаунт, чтобы увидеть данные магазина'}</p></div></div><span class="store-state${model.connected ? ' is-connected' : ''}">${symbol('shield')}${model.connected ? 'Подключение подтверждено' : 'Нет подтверждённого подключения'}</span></article>
  <div class="store-pulse-grid"><article class="store-pulse"><span class="store-pulse__icon">${symbol('shield')}</span><div><h3>Соединение</h3><strong>${model.connected ? 'FunPay подключён' : 'Ожидает подключения'}</strong><p>${model.proxy ? 'Прокси закреплён за магазином' : 'Прокси ещё не настроен'}</p></div></article><article class="store-pulse"><span class="store-pulse__icon store-pulse__icon--violet">${symbol('zap')}</span><div><h3>Автоматизация</h3><strong>${model.active} включено · ${model.installed} установлено</strong><button type="button" data-view-target="plugins">Настроить плагины ${symbol('chevron-right')}</button></div></article><article class="store-pulse"><span class="store-pulse__icon store-pulse__icon--blue">${symbol('clock')}</span><div><h3>Последние данные</h3><strong>${escape(time)}</strong><p>Снимок магазина · обновление вручную</p></div></article></div>`;
}
document.addEventListener('error', event => {
  if (event.target?.matches?.('[data-store-portrait-image]')) event.target.remove();
}, true);
