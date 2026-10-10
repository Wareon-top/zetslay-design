/* The server owns eligibility and the 72-hour deadline. This card never buys plugins or supplier goods. */
const sidebarTrialUi = { scope:'', request:0, pending:false, data:null, error:'', receivedAt:0, checkedAt:0 };
function sidebarTrialScope() { return `${authState.token || ''}:${typeof sessionGeneration === 'number' ? sessionGeneration : ''}`; }
function sidebarTrialData(value) {
  if (!value || !['available','active','used','plan_active'].includes(value.state) || value.durationHours !== 72 ||
      !Number.isFinite(Date.parse(value.serverNow)) || !Number.isSafeInteger(value.remainingSeconds) || value.remainingSeconds < 0 || value.remainingSeconds > 259200) throw new Error('Не удалось проверить пробный доступ');
  if (value.state === 'active' && (!Number.isFinite(Date.parse(value.startedAt)) || !Number.isFinite(Date.parse(value.expiresAt)) ||
      Date.parse(value.expiresAt)-Date.parse(value.startedAt)!==259200000 || Date.parse(value.serverNow)<Date.parse(value.startedAt) || Date.parse(value.serverNow)>=Date.parse(value.expiresAt) || value.remainingSeconds!==Math.ceil((Date.parse(value.expiresAt)-Date.parse(value.serverNow))/1000))) throw new Error('Не удалось проверить срок пробного доступа');
  return value;
}
function sidebarTrialModel(data, elapsed = 0) {
  const state = data?.state || 'loading';
  if (state === 'active') {
    const remaining = Math.max(0, data.remainingSeconds - Math.max(0, Math.floor(elapsed / 1000)));
    if (!remaining) return { title:'Пробный период завершён', description:'Настройки сохранены. Продолжите работу с подходящим тарифом.', metric:'0', label:'часов осталось', action:'Смотреть тарифы', destination:'finance' };
    const hours = Math.ceil(remaining / 3600);
    return { title:'Вы пробуете ZetSlay', description:'Бесплатный доступ активен. Исследуйте возможности своего кабинета.', metric:hours > 1 ? String(hours) : String(Math.ceil(remaining / 60)), label:hours > 1 ? 'часов осталось' : 'минут осталось', action:'Открыть кабинет', destination:'dashboard' };
  }
  if (state === 'used') return { title:'Пробный период завершён', description:'Настройки сохранены. Выберите тариф для продолжения работы.', metric:'3', label:'дня пробного доступа', action:'Смотреть тарифы', destination:'finance' };
  if (state === 'plan_active') return { title:'Ваш доступ активен', description:'У вас уже есть активный тариф. Всё готово для работы.', metric:'✓', label:'тариф подключён', action:'Мой тариф', destination:'finance' };
  return { title:'Попробуйте ZetSlay', description:'Познакомьтесь с сервисом бесплатно — без автосписаний.', metric:'3', label:'дня бесплатно', action:state === 'available' ? 'Начать бесплатно' : 'Проверяем…', destination:null };
}
function renderSidebarTrial() {
  const root = document.querySelector('[data-sidebar-trial]');
  if (!root) return;
  const scope = sidebarTrialScope();
  if (sidebarTrialUi.scope !== scope) {
    Object.assign(sidebarTrialUi, { scope, request:sidebarTrialUi.request+1, pending:false, data:null, error:'', receivedAt:0, checkedAt:0 });
  }
  const signedIn = Boolean(authState.user && authState.token);
  const model = sidebarTrialModel(sidebarTrialUi.data, Date.now()-sidebarTrialUi.receivedAt);
  for (const [key,value] of Object.entries(model)) root.querySelector(`[data-trial-${key}]`)?.replaceChildren(document.createTextNode(value ?? ''));
  const button = root.querySelector('[data-trial-action]');
  if (button) {
    button.textContent = !signedIn ? 'Войти и попробовать' : sidebarTrialUi.pending ? 'Проверяем…' : sidebarTrialUi.error ? 'Повторить проверку' : model.action;
    button.disabled = signedIn && (sidebarTrialUi.pending || (!sidebarTrialUi.data && !sidebarTrialUi.error));
    button.setAttribute('aria-busy', String(sidebarTrialUi.pending));
  }
  const status = root.querySelector('[data-trial-status]');
  if (status) { status.textContent = sidebarTrialUi.error; status.hidden = !sidebarTrialUi.error; }
  root.dataset.state = sidebarTrialUi.error ? 'error' : sidebarTrialUi.data?.state || 'loading';
  if (signedIn && !sidebarTrialUi.pending && !sidebarTrialUi.checkedAt) void loadSidebarTrial();
}
async function loadSidebarTrial(activate = false) {
  if (!authState.user || !authState.token || sidebarTrialUi.pending) return;
  const scope = sidebarTrialScope(), request = ++sidebarTrialUi.request;
  sidebarTrialUi.scope = scope; sidebarTrialUi.pending = true; sidebarTrialUi.error = ''; sidebarTrialUi.checkedAt = Date.now();
  renderSidebarTrial();
  try {
    const result = await apiRequest('/api/v1/subscription/trial', { authenticated:true, ...(activate ? { method:'POST', body:{} } : {}) });
    if (scope !== sidebarTrialScope() || request !== sidebarTrialUi.request) return;
    const data = sidebarTrialData(activate ? result.trial : result);
    sidebarTrialUi.data = data; sidebarTrialUi.receivedAt = Date.now();
    if (activate) {
      if (!result.workspace || result.workspace.id !== authState.workspace?.id || result.workspace.plan?.id !== 'trial_3d' || result.workspace.plan.active !== true || data.state !== 'active') throw new Error('Не удалось подтвердить активацию');
      authState.workspace = result.workspace;
      if (result.onboarding) { state.onboarding = result.onboarding; if (typeof onboardingRevision === 'number') onboardingRevision++; }
      if (typeof renderDashboard === 'function') renderDashboard();
      if (typeof renderTelegramOnboarding === 'function') renderTelegramOnboarding();
      if (typeof renderBilling === 'function') renderBilling();
      if (typeof showToast === 'function') showToast('Пробный доступ на 3 дня активирован', 'success');
    } else if (data.state === 'active' && authState.workspace && (!authState.workspace.plan?.active || authState.workspace.plan.id === 'trial_3d')) {
      authState.workspace.plan = { id:'trial_3d', active:true, activatedAt:data.startedAt, expiresAt:data.expiresAt };
      if (result.onboarding && (!state.onboarding || state.onboarding.state === 'plan_required')) state.onboarding = result.onboarding;
      if (typeof renderDashboard === 'function') renderDashboard();
      if (typeof renderTelegramOnboarding === 'function') renderTelegramOnboarding();
      if (typeof renderBilling === 'function') renderBilling();
    } else if (data.state === 'used' && authState.workspace?.plan?.id === 'trial_3d') {
      authState.workspace.plan.active = false;
      if (typeof renderDashboard === 'function') renderDashboard();
      if (typeof renderBilling === 'function') renderBilling();
    }
  } catch (error) {
    if (scope !== sidebarTrialScope() || request !== sidebarTrialUi.request) return;
    sidebarTrialUi.error = activate ? 'Не удалось подтвердить активацию. Проверьте состояние перед повтором.' : 'Пробный доступ не удалось проверить. Попробуйте ещё раз.';
    sidebarTrialUi.data = null;
  } finally {
    if (scope === sidebarTrialScope() && request === sidebarTrialUi.request) { sidebarTrialUi.pending = false; renderSidebarTrial(); }
  }
}
function sidebarTrialClick() {
  if (!authState.user || !authState.token) { if (typeof setAuthModal === 'function') setAuthModal(true); return; }
  if (sidebarTrialUi.pending) return;
  if (sidebarTrialUi.error || !sidebarTrialUi.data) { void loadSidebarTrial(); return; }
  const model = sidebarTrialModel(sidebarTrialUi.data, Date.now()-sidebarTrialUi.receivedAt);
  if (model.destination) { setView(model.destination); return; }
  if (sidebarTrialUi.data.state === 'available') void loadSidebarTrial(true);
}
function bootstrapSidebarTrial() {
  if (typeof renderDashboard === 'function') {
    const previous = renderDashboard;
    renderDashboard = function(...args) { const result = previous.apply(this,args); renderSidebarTrial(); return result; };
  }
  document.querySelector('[data-trial-action]')?.addEventListener('click', sidebarTrialClick);
  setInterval(() => {
    if (document.hidden || !authState.user || !authState.token) return;
    renderSidebarTrial();
    if (!sidebarTrialUi.pending && Date.now()-sidebarTrialUi.checkedAt >= 60000 && !sidebarTrialUi.error) void loadSidebarTrial();
  }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderSidebarTrial(); if (authState.user && !sidebarTrialUi.pending && Date.now()-sidebarTrialUi.checkedAt >= 60000) void loadSidebarTrial(); } });
  renderSidebarTrial();
}
bootstrapSidebarTrial();
