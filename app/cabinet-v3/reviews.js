/* ZetSlay reviews (service + plugins). Reads /api/v1/reviews, writes through the host apiRequest.
 * Mounts: plugin page tab «Отзывы» (ZSReviews.mountPlugin), profile «Отзыв о ZetSlay» (mountProfile),
 * owner moderation inside the admin view (mountAdmin). No data is invented: an empty list says so. */
(() => {
  'use strict';
  const SERVICE = 'service', PAGE = 12, MAX = 1000;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const E = v => (typeof escapeHtml === 'function' ? escapeHtml(String(v ?? '')) : String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const base = () => (typeof API_BASE_URL === 'string' ? API_BASE_URL : '');
  const signedIn = () => typeof authState !== 'undefined' && Boolean(authState.user && authState.token);
  const state = new Map(); // target -> {data, mine, loading, error, draft:{rating,text}, notice, busy, token}
  const plural = (n, one, few, many) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many; };
  const day = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) }); };
  const stars = (n, label = true) => `<span class="zsr-stars"${label ? ` role="img" aria-label="Оценка ${n} из 5"` : ' aria-hidden="true"'}>${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'is-on' : ''}"></i>`).join('')}</span>`;

  function avatar(author) {
    const url = author?.avatarUrl ? base() + author.avatarUrl : '';
    return url
      ? `<span class="zsr-avatar"><img src="${E(url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>`
      : `<span class="zsr-avatar zsr-avatar--initials" aria-hidden="true">${E(author?.initials || 'ZS')}</span>`;
  }
  // The card from the user's sample: avatar, nickname, five stars + date, then the text.
  function card(review, { mine = false } = {}) {
    const edited = review.updatedAt && review.createdAt && review.updatedAt !== review.createdAt;
    return `<article class="zsr-card${mine ? ' zsr-card--mine' : ''}${review.hidden ? ' zsr-card--hidden' : ''}">
      <header>${avatar(review.author)}<div class="zsr-head"><strong>${E(review.author?.displayName || 'Участник ZetSlay')}</strong>
        <span class="zsr-meta">${stars(review.rating)}<time datetime="${E(review.createdAt)}">${E(day(review.createdAt))}</time>${edited ? '<em>изменён</em>' : ''}</span></div></header>
      <p>${E(review.text)}</p>${review.hidden ? '<small class="zsr-flag">Скрыт администратором — виден только вам</small>' : ''}</article>`;
  }
  function summary(data) {
    if (!data?.summary?.count) return '';
    const { count, average } = data.summary;
    return `<div class="zsr-summary"><b>${String(average).replace('.', ',')}</b>${stars(Math.round(average))}<span>${count} ${plural(count, 'отзыв', 'отзыва', 'отзывов')}</span></div>`;
  }
  function form(target, s) {
    if (!signedIn()) return '<p class="zsr-note">Войдите в кабинет, чтобы оставить отзыв.</p>';
    if (!s.mine) return s.loading ? '' : '<p class="zsr-note">Не удалось проверить, можно ли оставить отзыв.</p>';
    if (!s.mine.canReview && !s.mine.review) return `<p class="zsr-note">${E(s.mine.reason || 'Отзыв пока недоступен')}</p>`;
    const own = s.mine.review, d = s.draft || { rating: own?.rating || 0, text: own?.text || '' };
    const editing = s.editing || !own;
    if (!editing) return `<div class="zsr-own"><div class="zsr-own__head"><span>Ваш отзыв</span><div><button type="button" class="zsr-btn" data-zsr-edit>Изменить</button><button type="button" class="zsr-btn zsr-btn--quiet" data-zsr-delete ${s.busy ? 'disabled' : ''}>Удалить</button></div></div>${card(own, { mine: true })}</div>`;
    return `<form class="zsr-form" data-zsr-form novalidate>
      <div class="zsr-form__head"><span>${own ? 'Изменить отзыв' : target === SERVICE ? 'Ваш отзыв о ZetSlay' : 'Ваш отзыв о плагине'}</span>
        <div class="zsr-rate" role="radiogroup" aria-label="Оценка">${[1, 2, 3, 4, 5].map(i => `<button type="button" role="radio" aria-checked="${d.rating === i}" aria-label="${i} ${plural(i, 'звезда', 'звезды', 'звёзд')}" class="${i <= d.rating ? 'is-on' : ''}" data-zsr-star="${i}" tabindex="${(d.rating || 1) === i ? 0 : -1}"></button>`).join('')}</div></div>
      <label class="zsr-sr" for="zsr-text-${E(target)}">Текст отзыва</label>
      <textarea id="zsr-text-${E(target)}" name="text" rows="4" maxlength="${MAX}" placeholder="Что понравилось, что стоит улучшить?" data-zsr-text>${E(d.text)}</textarea>
      <div class="zsr-form__foot"><small>Отзыв опубликуют с вашим именем и аватаркой из профиля. <span data-zsr-count>${d.text.length}/${MAX}</span></small>
        <div>${own ? '<button type="button" class="zsr-btn zsr-btn--quiet" data-zsr-cancel>Отмена</button>' : ''}<button type="submit" class="zsr-btn zsr-btn--primary" ${s.busy ? 'disabled' : ''}>${s.busy ? 'Сохраняем…' : own ? 'Сохранить' : 'Опубликовать'}</button></div></div>
      <p class="zsr-error" role="alert">${E(s.error || '')}</p></form>`;
  }
  function render(root) {
    const target = root.dataset.zsrTarget, s = state.get(target) || {};
    const data = s.data, list = data?.reviews || [];
    const title = root.dataset.zsrTitle || 'Отзывы';
    root.innerHTML = `<header class="zsr-top"><div><h2>${E(title)}</h2>${summary(data)}</div></header>
      ${form(target, s)}${s.notice ? `<p class="zsr-notice" role="status">${E(s.notice)}</p>` : ''}
      ${s.loadError ? `<p class="zsr-error" role="alert">${E(s.loadError)} <button type="button" class="zsr-btn zsr-btn--quiet" data-zsr-retry>Повторить</button></p>` : ''}
      ${!s.loading && data && !list.length ? `<div class="zsr-empty">${target === SERVICE ? 'Отзывов о ZetSlay пока нет — будьте первым.' : 'У этого плагина пока нет отзывов.'}</div>` : ''}
      ${s.loading && !data ? '<div class="zsr-empty" role="status">Загружаем отзывы…</div>' : ''}
      <div class="zsr-wall">${list.filter(r => r.id !== s.mine?.review?.id).map(r => card(r)).join('')}</div>
      ${data?.nextOffset != null ? `<button type="button" class="zsr-btn zsr-more" data-zsr-more ${s.loading ? 'disabled' : ''}>Показать ещё</button>` : ''}`;
  }
  const roots = target => $$(`[data-zsr-target="${CSS.escape(target)}"]`);
  const paint = target => roots(target).forEach(render);

  async function load(target, { more = false } = {}) {
    const s = state.get(target) || {}; state.set(target, s);
    const token = signedIn() ? authState.token : '';
    if (s.loading) return; s.loading = true; s.loadError = ''; if (!more) s.token = token; paint(target);
    try {
      const offset = more ? s.data?.nextOffset || 0 : 0;
      const [list, mine] = await Promise.all([
        apiRequest(`/api/v1/reviews?target=${encodeURIComponent(target)}&limit=${PAGE}&offset=${offset}`),
        !more && token ? apiRequest(`/api/v1/reviews/mine?target=${encodeURIComponent(target)}`, { authenticated: true }).catch(() => null) : Promise.resolve(more ? s.mine : null),
      ]);
      if ((signedIn() ? authState.token : '') !== token) return;
      s.data = more && s.data ? { ...list, reviews: [...s.data.reviews, ...list.reviews] } : list;
      s.mine = mine;
    } catch (error) { s.loadError = error?.code === 'NOT_FOUND' || error?.code === 'HTTP_404' ? 'Отзывы появятся после обновления сервера.' : (error?.message || 'Не удалось загрузить отзывы'); }
    finally { s.loading = false; paint(target); }
  }
  async function save(target) {
    const s = state.get(target); const d = s.draft || { rating: s.mine?.review?.rating || 0, text: s.mine?.review?.text || '' };
    if (!(d.rating >= 1)) { s.error = 'Поставьте оценку от 1 до 5 звёзд'; paint(target); return; }
    if (d.text.trim().length < 3) { s.error = 'Напишите хотя бы пару слов'; paint(target); return; }
    s.busy = true; s.error = ''; paint(target);
    try {
      const { review } = await apiRequest('/api/v1/reviews', { method: 'POST', authenticated: true, body: { target, rating: d.rating, text: d.text } });
      s.mine = { ...(s.mine || {}), canReview: true, review }; s.draft = null; s.editing = false; s.notice = 'Отзыв опубликован. Спасибо!';
      s.busy = false; await load(target);
    } catch (error) { s.error = error?.message || 'Не удалось сохранить отзыв'; s.busy = false; paint(target); }
  }
  async function remove(target) {
    const s = state.get(target);
    if (!confirm('Удалить ваш отзыв? Его нельзя будет восстановить.')) return;
    s.busy = true; paint(target);
    try { await apiRequest('/api/v1/reviews/delete', { method: 'POST', authenticated: true, body: { target } }); s.mine = { ...(s.mine || {}), review: null }; s.notice = 'Отзыв удалён.'; s.busy = false; await load(target); }
    catch (error) { s.error = error?.message || 'Не удалось удалить отзыв'; s.busy = false; paint(target); }
  }

  function mount(root, target, title) {
    if (!root) return;
    // Called on every host re-render (a MutationObserver drives the plugin tabs): touch the DOM only when something changed.
    const fresh = root.dataset.zsrTarget !== target || !root.childElementCount;
    if (fresh) { root.dataset.zsrTarget = target; root.dataset.zsrTitle = title; root.classList.add('zsr'); }
    const s = state.get(target), token = signedIn() ? authState.token : '';
    if (!s || (!s.loading && s.token !== token) || (!s.loading && !s.data && !s.loadError)) load(target);
    else if (fresh) render(root);
  }

  document.addEventListener('click', event => {
    const root = event.target.closest?.('[data-zsr-target]'); if (!root) return;
    const target = root.dataset.zsrTarget, s = state.get(target) || {}; state.set(target, s);
    const star = event.target.closest('[data-zsr-star]');
    if (star) { s.draft = { rating: Number(star.dataset.zsrStar), text: $('[data-zsr-text]', root)?.value ?? s.draft?.text ?? s.mine?.review?.text ?? '' }; s.error = ''; paint(target); $(`[data-zsr-target="${CSS.escape(target)}"] [data-zsr-star="${star.dataset.zsrStar}"]`)?.focus(); return; }
    if (event.target.closest('[data-zsr-edit]')) { s.editing = true; s.draft = { rating: s.mine.review.rating, text: s.mine.review.text }; s.notice = ''; paint(target); $('[data-zsr-text]', root)?.focus(); return; }
    if (event.target.closest('[data-zsr-cancel]')) { s.editing = false; s.draft = null; s.error = ''; paint(target); return; }
    if (event.target.closest('[data-zsr-delete]')) { remove(target); return; }
    if (event.target.closest('[data-zsr-more]')) { load(target, { more: true }); return; }
    if (event.target.closest('[data-zsr-retry]')) { load(target); }
  });
  document.addEventListener('keydown', event => {
    const star = event.target.closest?.('[data-zsr-star]'); if (!star || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); const next = Math.min(5, Math.max(1, Number(star.dataset.zsrStar) + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : -1)));
    $(`[data-zsr-star="${next}"]`, star.parentElement)?.click();
  });
  document.addEventListener('input', event => {
    const text = event.target.closest?.('[data-zsr-text]'); if (!text) return;
    const target = text.closest('[data-zsr-target]').dataset.zsrTarget, s = state.get(target);
    s.draft = { rating: s.draft?.rating ?? s.mine?.review?.rating ?? 0, text: text.value };
    const count = $('[data-zsr-count]', text.closest('form')); if (count) count.textContent = `${text.value.length}/${MAX}`;
  });
  document.addEventListener('submit', event => {
    const f = event.target.closest?.('[data-zsr-form]'); if (!f) return;
    event.preventDefault(); save(f.closest('[data-zsr-target]').dataset.zsrTarget);
  });

  // ---- owner moderation (admin view, only for the service owner)
  const admin = { data: null, busy: false, error: '', filter: 'all' };
  function renderAdmin(root) {
    const list = admin.data?.reviews || [];
    root.innerHTML = `<header class="zsr-top"><div><h2>Отзывы</h2><p class="zsr-note">Скрытый отзыв пропадает из публичного списка и средней оценки; автор видит его с пометкой.</p></div>
      <div class="zsr-filter">${[['all', 'Все'], ['false', 'Видимые'], ['true', 'Скрытые']].map(([k, l]) => `<button type="button" class="zsr-chip${admin.filter === k ? ' is-on' : ''}" data-zsr-admin-filter="${k}">${l}</button>`).join('')}</div></header>
      ${admin.error ? `<p class="zsr-error" role="alert">${E(admin.error)}</p>` : ''}
      ${admin.busy && !admin.data ? '<div class="zsr-empty" role="status">Загружаем…</div>' : ''}${admin.data && !list.length ? '<div class="zsr-empty">Отзывов нет.</div>' : ''}
      <div class="zsr-admin">${list.map(r => `<div class="zsr-admin__row">${card(r, { mine: true })}<div class="zsr-admin__side"><small>${E(r.target === SERVICE ? 'О сервисе' : r.target)}</small>
        <button type="button" class="zsr-btn${r.hidden ? ' zsr-btn--primary' : ''}" data-zsr-visibility="${E(r.id)}" data-hidden="${r.hidden ? 'false' : 'true'}" ${admin.busy ? 'disabled' : ''}>${r.hidden ? 'Показать' : 'Скрыть'}</button></div></div>`).join('')}</div>`;
  }
  async function loadAdmin(root) {
    admin.busy = true; admin.error = ''; renderAdmin(root);
    try { admin.data = await apiRequest('/api/v1/admin/reviews?limit=50' + (admin.filter === 'all' ? '' : '&hidden=' + admin.filter), { authenticated: true }); }
    catch (error) { admin.error = error?.message || 'Не удалось загрузить отзывы'; }
    finally { admin.busy = false; renderAdmin(root); }
  }
  document.addEventListener('click', async event => {
    const root = event.target.closest?.('[data-zsr-admin]'); if (!root) return;
    const filter = event.target.closest('[data-zsr-admin-filter]');
    if (filter) { admin.filter = filter.dataset.zsrAdminFilter; loadAdmin(root); return; }
    const toggle = event.target.closest('[data-zsr-visibility]'); if (!toggle) return;
    let reason = '';
    if (toggle.dataset.hidden === 'true') { reason = prompt('Причина скрытия (видна только администратору):', '') ?? null; if (reason === null) return; }
    admin.busy = true; renderAdmin(root);
    try { await apiRequest(`/api/v1/admin/reviews/${encodeURIComponent(toggle.dataset.zsrVisibility)}/visibility`, { method: 'POST', authenticated: true, body: { hidden: toggle.dataset.hidden === 'true', reason } }); state.clear(); }
    catch (error) { admin.error = error?.message || 'Не удалось изменить отзыв'; }
    admin.busy = false; loadAdmin(root);
  });

  window.ZSReviews = Object.freeze({
    mountPlugin(section, pluginId, name) { mount(section, pluginId, name ? `Отзывы о ${name}` : 'Отзывы'); },
    mountProfile() {
      const main = $('[data-view="profile"] .zs-profile-main'); if (!main || !signedIn()) return;
      let section = $(':scope > [data-zsr-profile]', main);
      if (!section) { section = document.createElement('section'); section.className = 'zsr-profile'; section.dataset.zsrProfile = ''; main.insertBefore(section, $(':scope > [data-zs-profile-editor]', main) || null); }
      mount(section, SERVICE, 'Отзыв о ZetSlay');
    },
    mountAdmin() {
      const view = $('[data-view="admin"]'), host = view && $('[data-admin-root]', view); if (!host) return;
      let section = $(':scope > [data-zsr-admin]', view);
      const allowed = typeof adminAllowed === 'function' && adminAllowed();
      if (!allowed) { if (section) { section.hidden = true; section.replaceChildren(); } admin.data = null; return; }
      if (!section) { section = document.createElement('section'); section.className = 'zsr zsr-admin-panel'; section.dataset.zsrAdmin = ''; host.after(section); }
      section.hidden = false; if (!admin.data && !admin.busy) loadAdmin(section);
    },
    reset() {
      state.clear(); admin.data = null;
      $$('[data-zsr-target],[data-zsr-admin]').forEach(n => { n.replaceChildren(); delete n.dataset.zsrTarget; });
    },
  });
})();
