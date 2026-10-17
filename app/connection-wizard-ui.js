/* Presentation layer only. Account state and all requests remain in app.js. */
function connectionWizardPresentationModel({ live, snapshot, step, frontier, loading, failed, busy, resetting, error }) {
  const definitions = live
    ? [['Бот', 'Telegram-бот', 'send'], ['Привязка', 'Подтверждение Telegram', 'user'], ['Ключ', 'Golden Key', 'lock'], ['Прокси', 'Маршрут соединения', 'shield'], ['Проверка', 'Доступ к магазину', 'check']]
    : [['Аккаунт', 'Один аккаунт FunPay', 'user'], ['Ключ', 'Golden Key', 'lock'], ['Прокси', 'Маршрут соединения', 'shield'], ['Проверка', 'Доступ к магазину', 'check']];
  const current = Math.max(0, Math.min(Number.isInteger(step) ? step : 0, definitions.length - 1));
  const unavailable = Boolean(loading || failed || busy || resetting);
  const gated = live && (!snapshot || snapshot.state === 'plan_required');
  const known = live && !loading && !failed && !gated;
  const saved = known ? [snapshot.telegram?.botConfigured === true, snapshot.telegram?.linked === true,
    snapshot.funPay?.credentialConfigured === true, snapshot.funPay?.proxyConfigured === true,
    snapshot.state === 'connected_read_only' && Boolean(snapshot.funPay?.store)] : [];
  const limit = live ? (gated ? 0 : Math.max(0, Math.min(Number.isInteger(frontier) ? frontier : 0, definitions.length - 1))) : definitions.length - 1;
  return {
    live, current, unavailable, completed: saved.filter(Boolean).length,
    status: loading ? 'Загружаем состояние' : failed ? 'Повторите загрузку' : resetting ? 'Подтверждение изменения'
      : busy ? 'Выполняем проверку' : error ? 'Требуется внимание' : gated ? 'Сначала активируйте тариф'
        : saved[4] ? 'Магазин подключён' : live ? 'Настройка подключения' : 'Демонстрация · без подключения',
    steps: definitions.map(([label, title, symbol], index) => ({ label, title, symbol,
      current: index === current, complete: live ? saved[index] === true : index < current,
      enabled: !unavailable && index <= limit }))
  };
}

(function installConnectionWizardPresentation() {
  if (typeof document === 'undefined' || typeof renderConnectionWizard !== 'function' || typeof setModal !== 'function') return;
  const modal = document.querySelector('.connect-modal');
  if (!modal || modal.dataset.connectionUi === 'v2') return;
  const progress = modal.querySelector('.connect-progress');
  const body = modal.querySelector('.connect-modal__body');
  const footer = modal.querySelector('footer');
  if (!progress || !body || !footer) return;
  modal.dataset.connectionUi = 'v2';
  modal.classList.add('connect-modal--guided');
  modal.setAttribute('aria-describedby', 'connection-wizard-status');
  progress.setAttribute('aria-label', 'Этапы подключения FunPay');
  progress.setAttribute('role', 'navigation');

  const svg = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const hero = document.createElement('div');
  hero.className = 'connection-visual';
  hero.setAttribute('aria-hidden', 'true');
  hero.innerHTML = `<div class="connection-visual__caption"><span>FUNPAY / CONNECTION</span><span data-connection-visual-count></span></div>
    <div class="connection-visual__route"><div class="connection-visual__endpoint"><span class="connection-visual__brand">Z</span><small>Ваш кабинет</small></div>
    <div class="connection-visual__link"><i></i><span data-connection-visual-icon>${svg('lock')}</span><i></i></div>
    <div class="connection-visual__endpoint"><span class="connection-visual__brand connection-visual__brand--fp">FP</span><small>Ваш магазин</small></div></div>
    <div class="connection-visual__bottom"><span>${svg('shield')} Защищённое подключение</span><span data-connection-visual-label></span></div>`;
  progress.before(hero);
  const summary = document.createElement('div');
  summary.className = 'connection-step-summary';
  summary.innerHTML = '<span id="connection-wizard-status" data-connection-summary role="status" aria-live="polite" aria-atomic="true"></span><span data-connection-saved></span>';
  body.before(summary);

  const controls = document.createElement('div');
  controls.className = 'connection-controls';
  const left = document.createElement('div');
  left.className = 'connection-controls__left';
  const right = document.createElement('div');
  right.className = 'connection-controls__right';
  const back = modal.querySelector('[data-connect-back]');
  const later = footer.querySelector('[data-close-connect]');
  const next = modal.querySelector('[data-connect-next]');
  if (back) left.append(back);
  if (later) { later.textContent = 'Позже'; right.append(later); }
  if (next) right.append(next);
  controls.append(left, right);
  footer.append(controls);
  const fineprint = document.createElement('div');
  fineprint.className = 'connection-fineprint';
  const safe = modal.querySelector('.connect-safe-note');
  if (safe) { safe.textContent = 'Данные доступа сохраняются зашифрованно'; fineprint.append(safe); }
  const reset = modal.querySelector('[data-connect-reset]');
  if (reset) fineprint.append(reset);
  footer.append(fineprint);
  const errorNode = modal.querySelector('[data-connect-error]');
  if (errorNode) errorNode.setAttribute('aria-live', 'assertive');
  let trigger = null;
  let previousStep = null;

  const getModel = () => connectionWizardPresentationModel({ live: liveConnectionMode(), snapshot: state.onboarding,
    step: connectionStep, frontier: wizardInitialStep(), loading: connectionLoading, failed: connectionLoadFailed,
    busy: connectionBusy, resetting: connectionResetTarget, error: connectionError });

  function present() {
    const model = getModel();
    const item = model.steps[model.current];
    modal.dataset.connectionPhase = connectionLoading ? 'loading' : connectionLoadFailed ? 'failed' : connectionResetTarget ? 'reset' : connectionBusy ? 'busy' : connectionError ? 'error' : 'ready';
    body.setAttribute('aria-busy', String(Boolean(connectionBusy || connectionLoading)));
    if (progress.children.length !== model.steps.length) {
      progress.innerHTML = model.steps.map((entry, index) => `<button type="button" class="connection-step" data-connection-step="${index}"><span class="connection-step__circle"></span><span class="connection-step__label">${entry.label}</span></button>`).join('');
    }
    progress.querySelectorAll('[data-connection-step]').forEach((button, index) => {
      const entry = model.steps[index];
      button.disabled = !entry.enabled;
      button.classList.toggle('is-current', entry.current);
      button.classList.toggle('is-saved', entry.complete);
      button.setAttribute('aria-label', `${index + 1}. ${entry.title}${entry.complete ? '. Выполнено' : entry.current ? '. Текущий этап' : entry.enabled ? '. Доступно' : '. Пока недоступно'}`);
      if (entry.current) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
      button.querySelector('.connection-step__circle').innerHTML = entry.complete ? svg('check') : String(index + 1);
    });
    hero.querySelector('[data-connection-visual-count]').textContent = `${String(model.current + 1).padStart(2, '0')} / ${String(model.steps.length).padStart(2, '0')}`;
    hero.querySelector('[data-connection-visual-icon]').innerHTML = svg(item.symbol);
    hero.querySelector('[data-connection-visual-label]').textContent = item.title;
    summary.querySelector('[data-connection-summary]').textContent = model.status;
    summary.querySelector('[data-connection-saved]').textContent = model.live ? `Сохранено ${model.completed} из ${model.steps.length}` : `${model.current + 1} из ${model.steps.length}`;
    const title = modal.querySelector('#connect-modal-title');
    if (title) title.textContent = 'Подключение FunPay';
    const mode = modal.querySelector('[data-connection-mode]');
    if (mode) mode.textContent = model.live ? 'Настройка магазина' : 'Знакомство с подключением';
    modal.querySelectorAll('[data-close-connect]').forEach(button => { button.disabled = Boolean(connectionBusy); });
    // The server-facing renderer owns action labels, errors and all secret fields.
    // This layer never reads, stores or copies a token, key or proxy value.
    body.querySelectorAll('input').forEach(field => { field.disabled = Boolean(connectionBusy || connectionLoading); });
    if (previousStep !== model.current) {
      body.scrollTop = 0;
      if (typeof body.animate === 'function' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        body.animate([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180, easing: 'ease-out' });
      }
      previousStep = model.current;
    }
  }

  const originalRender = renderConnectionWizard;
  renderConnectionWizard = function renderGuidedConnectionWizard(...args) {
    const result = originalRender.apply(this, args);
    present();
    return result;
  };
  const originalSetModal = setModal;
  setModal = function setGuidedConnectionModal(open, ...args) {
    if (open && modal.hidden) trigger = document.activeElement;
    const result = originalSetModal.call(this, open, ...args);
    if (!open) {
      // A closed dialog must not retain an unsubmitted secret in the DOM.
      body.querySelectorAll('input').forEach(field => { field.value = ''; });
      if (trigger?.isConnected && typeof trigger.focus === 'function') trigger.focus();
      trigger = null;
    }
    present();
    return result;
  };

  modal.addEventListener('click', event => {
    const button = event.target.closest('[data-connection-step]');
    if (!button) return;
    const index = Number(button.dataset.connectionStep);
    const model = getModel();
    if (!Number.isInteger(index) || !model.steps[index]?.enabled || index === model.current) return;
    connectionStep = index;
    connectionError = '';
    renderConnectionWizard();
    body.querySelector('input:not([disabled])')?.focus();
  });
  document.addEventListener('keydown', event => {
    if (modal.hidden || !modal.classList.contains('is-open')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!connectionBusy) setModal(false);
    } else if (event.key === 'Tab') {
      const candidates = Array.from(modal.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href]'))
        .filter(node => !node.hidden && !node.closest('[hidden]') && node.getClientRects().length);
      const first = candidates[0], last = candidates.at(-1);
      if (!first) { event.preventDefault(); return; }
      const outside = !modal.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || outside)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || outside)) { event.preventDefault(); first.focus(); }
    }
  });
  present();
})();
