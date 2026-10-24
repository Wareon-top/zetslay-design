/* A local announcement preference, scoped to an account, never to a session token. */
(() => {
  const CAMPAIGN = 'official-launch-2026-10', WEEK = 7 * 86400000, DELAY = 3000;
  const PREFIX = 'zetslay.announcement.' + CAMPAIGN + '.';
  const owner = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  const memory = new Map();
  const ui = {scope: '', epoch: 0, timer: null, pending: false, card: null, dialog: null, suspended: false, returnFocus: null};
  const scope = () => authState.user?.id && authState.workspace?.id && authState.token
    ? JSON.stringify([String(authState.user.id), String(authState.workspace.id)]) : '';
  const key = s => PREFIX + s;
  const route = () => document.querySelector('[data-view].is-active')?.dataset.view;
  const editing = () => document.activeElement?.matches?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
  function permitted() {
    if (ui.suspended || !scope() || document.hidden || route() !== 'dashboard') return false;
    const shell = document.querySelector('.app-shell');
    if (!shell || shell.hidden || shell.inert) return false;
    if (document.querySelector('dialog[open], .modal.is-open, .auth-modal.is-open, .connect-modal.is-open, .learning-overlay, .sidebar.is-open')) return false;
    if (typeof learningUi !== 'undefined' && (learningUi.loading || (!learningUi.data && !learningUi.error))) return false;
    return !editing();
  }
  function seen(s) {
    let value = memory.get(s);
    try {
      const raw = window.localStorage.getItem(key(s));
      const record = raw && raw.length < 1000 ? JSON.parse(raw) : null;
      if (record?.campaign === CAMPAIGN && Number.isSafeInteger(record.seenAt) && record.seenAt > 0 && record.seenAt <= Date.now() + 300000) {
        if (!value || record.seenAt >= value.seenAt) value = record;
      }
    } catch { /* Blocked storage still has a per-page fallback. */ }
    return value;
  }
  const due = s => { const record = seen(s); return !record || Date.now() - record.seenAt >= WEEK; };
  function stop() { if (ui.timer !== null) window.clearTimeout(ui.timer); ui.timer = null; }
  function restoreFocus(node) {
    if (node?.isConnected && !node.closest?.('[inert], [hidden]')) node.focus?.({preventScroll: true});
  }
  function removeCard(restore = false) {
    const hadFocus = ui.card?.contains(document.activeElement);
    ui.card?.remove(); ui.card = null;
    if (restore && hadFocus) restoreFocus(ui.returnFocus);
  }
  function closeArticle(restore = true) {
    const dialog = ui.dialog; ui.dialog = null;
    if (dialog) { dialog.close?.(); dialog.remove(); }
    if (restore) restoreFocus(ui.returnFocus);
  }
  function reset() {
    stop(); ui.epoch++; ui.scope = ''; ui.pending = false;
    removeCard(); closeArticle(false); ui.returnFocus = null;
  }
  const cross = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
  const clock = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg>';
  const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>';
  const book = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14"/></svg>';
  function openArticle() {
    if (!ui.card || !permitted() || ui.scope !== scope()) return;
    removeCard();
    const dialog = document.createElement('dialog');
    dialog.className = 'launch-article'; dialog.setAttribute('aria-labelledby', 'launch-article-title');
    dialog.innerHTML = `<button type="button" class="launch-close launch-article__close" aria-label="Закрыть рассказ о запуске">${cross}</button>
      <div class="launch-article__cover"><img src="assets/launch-cover.jpg" alt="" width="800" height="608"></div>
      <div class="launch-article__body"><div class="launch-article__byline"><img src="assets/launch-brand.webp" alt="" width="32" height="32"><span>Команда ZetSlay<time datetime="2026-10-16">16 октября 2026</time></span></div>
      <h2 id="launch-article-title">ZetSlay официально запущен</h2>
      <p class="launch-article__intro">Мы запустили ZetSlay, чтобы ежедневная работа продавца на FunPay стала понятнее: от первого подключения до обработки заказов и управления ассортиментом.</p>
      <div class="launch-benefits">
        <section><h3>Заказы, сообщения и товары</h3><p>Следите за продажами, отвечайте покупателям и управляйте лотами из кабинета. Смотрите показатели за день, неделю или месяц.</p></section>
        <section><h3>Плагины под задачи магазина</h3><p>Настраивайте выдачу, аренду, работу с ценами и отзывами. Выбирайте нужные модули и задавайте лимиты перед включением.</p></section>
        <section><h3>Telegram и база знаний</h3><p>Получайте события в рабочем боте. Инструкции по подключению и настройке сервиса доступны в базе знаний.</p></section>
      </div>
      <aside class="launch-access"><strong>Начните с трёх дней знакомства</strong><p>Пробный период доступен один раз и открывает все плагины, кроме легендарных. Для работы магазина нужна активная подписка или пробный период — в том числе при покупке плагина навсегда.</p></aside>
      <div class="launch-article__actions"><button type="button" class="launch-primary" data-launch-route="billing">Посмотреть подписки ${arrow}</button><button type="button" class="launch-secondary" data-launch-route="plugins">Каталог плагинов</button></div>
      <p class="launch-article__note">ZetSlay — самостоятельный сервис для продавцов, не официальное ПО FunPay. Подключение и работа зависят от доступности площадки и настроек магазина.</p></div>`;
    dialog.addEventListener('cancel', e => { e.preventDefault(); closeArticle(); });
    dialog.addEventListener('close', () => { if (ui.dialog === dialog) closeArticle(); });
    dialog.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const buttons = [...dialog.querySelectorAll('button:not([disabled])')];
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    });
    dialog.querySelector('.launch-close').addEventListener('click', () => closeArticle());
    dialog.querySelectorAll('[data-launch-route]').forEach(button => button.addEventListener('click', () => {
      if (ui.scope !== scope()) return;
      const target = button.dataset.launchRoute; closeArticle(false); setView(target);
      document.querySelector(`[data-view-target="${target}"]`)?.focus?.({preventScroll: true});
    }));
    document.body.append(dialog); ui.dialog = dialog;
    dialog.showModal();
  }
  function mount() {
    const card = document.createElement('aside');
    card.className = 'launch-notice'; card.setAttribute('aria-labelledby', 'launch-notice-title');
    // The reference's original cover is served locally, without a runtime CDN request.
    card.innerHTML = `<div class="launch-notice__cover"><img src="assets/launch-cover.jpg" alt="" width="800" height="608">
      <div class="launch-tags"><span>Запуск</span><span>FunPay</span></div>
      <button type="button" class="launch-notice__more" aria-label="Читать о запуске ZetSlay"><span>${book} Читать</span></button>
      <button type="button" class="launch-close" aria-label="Закрыть уведомление о запуске">${cross}</button></div>
      <div class="launch-notice__body">
      <h2 id="launch-notice-title" role="status" aria-live="polite">ZetSlay официально запущен</h2>
      <p class="launch-notice__excerpt">Кабинет для вашего магазина FunPay: заказы, сообщения и плагины в одном месте.</p>
      <div class="launch-notice__footer"><span class="launch-author"><img class="launch-author__avatar" src="assets/launch-brand.webp" alt="" width="32" height="32"><span><strong>Команда ZetSlay</strong><time datetime="2026-10-16">16 октября 2026</time></span></span><span class="launch-readtime">${clock} 1 мин</span></div></div>`;
    card.querySelector('.launch-close').addEventListener('click', () => { stop(); removeCard(true); });
    card.querySelector('.launch-notice__more').addEventListener('click', openArticle);
    ui.returnFocus = document.activeElement; ui.card = card; document.body.append(card);
  }
  async function attempt() {
    if (ui.pending || ui.card || !permitted() || !due(ui.scope)) return;
    const currentScope = ui.scope, epoch = ui.epoch;
    const generation = typeof sessionGeneration === 'undefined' ? null : sessionGeneration;
    ui.pending = true;
    const claim = () => {
      if (epoch !== ui.epoch || currentScope !== scope() || generation !== (typeof sessionGeneration === 'undefined' ? null : sessionGeneration) || !permitted() || !due(currentScope)) return;
      mount();
      // Count only a card actually added to a visible cabinet.
      const record = {campaign: CAMPAIGN, seenAt: Date.now(), owner}; memory.set(currentScope, record);
      try { window.localStorage.setItem(key(currentScope), JSON.stringify(record)); } catch { /* Session fallback. */ }
    };
    try {
      if (navigator.locks?.request) await navigator.locks.request(key(currentScope), {ifAvailable: true}, lock => { if (lock) claim(); });
      else claim();
    } finally { if (epoch === ui.epoch) { ui.pending = false; refresh(); } }
  }
  function refresh() {
    const next = scope();
    if (next !== ui.scope) { reset(); ui.scope = next; }
    if (!next) return;
    if (document.hidden || route() !== 'dashboard' || ui.suspended) { stop(); removeCard(); closeArticle(false); return; }
    if (ui.dialog) return;
    if (!permitted()) { removeCard(true); stop(); if (due(next)) ui.timer = window.setTimeout(() => { ui.timer = null; refresh(); }, DELAY); return; }
    if (ui.card || ui.pending || !due(next)) { stop(); return; }
    if (ui.timer === null) ui.timer = window.setTimeout(() => { ui.timer = null; void attempt().catch(() => {}); }, DELAY);
  }
  for (const name of ['renderAuthState', 'renderDashboard', 'setView']) {
    // These bindings belong to the existing classic-script cabinet.
    const original = name === 'renderAuthState' ? renderAuthState : name === 'renderDashboard' ? renderDashboard : setView;
    const wrapped = function(...args) { const result = original.apply(this, args); refresh(); return result; };
    if (name === 'renderAuthState') renderAuthState = wrapped;
    else if (name === 'renderDashboard') renderDashboard = wrapped;
    else setView = wrapped;
  }
  const oldReset = resetAccountData;
  resetAccountData = function(...args) { reset(); return oldReset.apply(this, args); };
  document.addEventListener('visibilitychange', refresh);
  document.addEventListener('focusout', () => { if (!ui.card && !ui.dialog) refresh(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.card && !editing() && !document.querySelector('dialog[open], .modal.is-open')) { removeCard(true); stop(); } });
  window.addEventListener('storage', e => { if (ui.scope && e.key === key(ui.scope)) { const record = seen(ui.scope); if (record && record.owner !== owner) { removeCard(true); stop(); } } });
  window.addEventListener('pagehide', () => { ui.suspended = true; reset(); });
  window.addEventListener('pageshow', () => { ui.suspended = false; refresh(); });
  // Observe overlay changes; app renders must not restart the quiet delay.
  if (typeof MutationObserver !== 'undefined') new MutationObserver(refresh).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'class', 'hidden', 'inert']});
  window.ZetSlayLaunchAnnouncement = {refresh, diagnostics: () => ({campaign: CAMPAIGN, intervalDays: 7, visible: !!ui.card, articleOpen: !!ui.dialog, pending: ui.timer !== null || ui.pending, due: !!scope() && due(scope())})};
  refresh();
})();
