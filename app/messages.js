/* A read-only inbox over the existing FunPay content snapshot. */
const messagesPageState = { generation: null, snapshot: null, selectedId: null, query: '', actor: 'all', mobileOpen: false, findOpen: false, findQuery: '', matchIndex: 0, busy: false, request: null, error: '', bodyKey: null, detailId: null };
const messagesEscape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const messagesIcon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
function messageDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) return null;
  const day = value.slice(0, 10);
  if (new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) return null;
  return Date.parse(value);
}

function buildMessagesWorkspace(content, filters = {}) {
  const observedAt = messageDate(content?.observedAt);
  const groups = new Map();
  const seen = new Map();
  if (observedAt != null && Array.isArray(content?.messages)) content.messages.forEach(raw => {
    if (!raw || typeof raw !== 'object' || typeof raw.threadId !== 'string' || !raw.threadId.trim()) return;
    const id = raw.threadId.trim();
    if (!seen.has(id)) seen.set(id, new Set());
    const messageId = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : null;
    if (messageId && seen.get(id).has(messageId)) return;
    if (messageId) seen.get(id).add(messageId);
    const name = typeof raw.buyer === 'string' && raw.buyer.trim() ? raw.buyer.trim() : '';
    const group = groups.get(id) || { id, name: name || `Диалог ${id}`, named: Boolean(name), messages: [] };
    if (name && !group.named) { group.name = name; group.named = true; }
    const sender = raw.fromSeller === true ? 'seller' : raw.sender === 'system' ? 'system' : raw.sender === 'seller' ? 'seller' : raw.sender === 'buyer' || raw.fromSeller === false ? 'buyer' : 'unknown';
    const date = messageDate(raw.createdAt);
    group.messages.push({ id: messageId, text: typeof raw.text === 'string' ? raw.text : '', sender, date: date != null && date <= observedAt ? date : null });
    groups.set(id, group);
  });
  const threads = [...groups.values()].map(group => {
    if (group.messages.every(message => message.date != null)) group.messages.sort((a, b) => a.date - b.date);
    const last = group.messages.at(-1);
    return { ...group, preview: last.text || 'Текст сообщения не передан', lastSender: last.sender, date: last.date };
  });
  const query = String(filters.query || '').trim().toLocaleLowerCase('ru-RU');
  const actor = ['all', 'buyer', 'seller'].includes(filters.actor) ? filters.actor : 'all';
  const searched = threads.filter(thread => !query || [thread.id, thread.name, ...thread.messages.map(message => message.text)].some(value => value.toLocaleLowerCase('ru-RU').includes(query)));
  const filtered = searched.filter(thread => actor === 'all' || thread.lastSender === actor);
  const counts = { all: searched.length, buyer: searched.filter(thread => thread.lastSender === 'buyer').length, seller: searched.filter(thread => thread.lastSender === 'seller').length };
  return { observedAt, loaded: observedAt != null, threads, filtered, counts, totalMessages: threads.reduce((total, thread) => total + thread.messages.length, 0), query, actor };
}

function messagesAvatar(name, small = false) {
  const tones = ['amber', 'blue', 'violet', 'green', 'red'];
  let hash = 0;
  for (const character of name) hash = (hash + character.codePointAt(0)) % tones.length;
  const initials = Array.from(name).slice(0, 2).join('').toLocaleUpperCase('ru-RU');
  return `<span class="messages-page-avatar messages-page-avatar--${tones[hash]}${small ? ' messages-page-avatar--small' : ''}" aria-hidden="true">${messagesEscape(initials)}</span>`;
}

function highlightMessageText(text, query, startIndex = 0, activeIndex = -1) {
  if (!query.trim()) return { html: messagesEscape(text), count: 0 };
  const pattern = new RegExp(query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
  let html = '', cursor = 0, count = 0;
  for (const match of text.matchAll(pattern)) {
    const index = startIndex + count++;
    html += messagesEscape(text.slice(cursor, match.index)) + `<mark data-message-match="${index}"${index === activeIndex ? ' class="is-current"' : ''}>${messagesEscape(match[0])}</mark>`;
    cursor = match.index + match[0].length;
  }
  return { html: html + messagesEscape(text.slice(cursor)), count };
}

function messagesTranscript(thread, query = '', activeIndex = -1) {
  let count = 0, previousDay = null;
  const html = thread.messages.map(message => {
    const day = message.date == null ? null : new Date(message.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const divider = day && day !== previousDay ? `<div class="messages-page-day"><span>${messagesEscape(day)}</span></div>` : '';
    previousDay = day;
    const text = message.text ? highlightMessageText(message.text, query, count, activeIndex) : { html: 'Текст сообщения не передан', count: 0 };
    count += text.count;
    const label = message.sender === 'seller' ? 'Магазин' : message.sender === 'buyer' ? thread.name : message.sender === 'system' ? 'Системное сообщение' : 'Отправитель не указан';
    const avatar = message.sender === 'seller' ? '<span class="messages-page-avatar messages-page-avatar--seller messages-page-avatar--small" aria-hidden="true">Z</span>' : messagesAvatar(thread.name, true);
    return `${divider}<article class="messages-page-message messages-page-message--${message.sender}">${['buyer', 'seller'].includes(message.sender) ? avatar : ''}<div class="messages-page-bubble"><div class="messages-page-message-meta"><strong>${messagesEscape(label)}</strong>${message.date == null ? '' : `<time datetime="${new Date(message.date).toISOString()}">${messagesEscape(new Date(message.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))}</time>`}</div><p>${text.html}</p></div></article>`;
  }).join('');
  return { html, count };
}

function messagesEmpty(title, description, action = '') {
  return `<div class="messages-page-empty"><span>${messagesIcon('chat')}</span><strong>${title}</strong><p>${description}</p>${action}</div>`;
}

function closeMessagesInfo() {
  messagesPageState.detailId = null;
  const dialog = document.querySelector('[data-messages-dialog]');
  if (!dialog) return;
  if (dialog.open) dialog.close();
  const body = dialog.querySelector('[data-messages-info-body]');
  if (body) body.innerHTML = '';
}

function renderMessagesInfo(model) {
  const dialog = document.querySelector('[data-messages-dialog]');
  if (!dialog || messagesPageState.detailId == null) return;
  const thread = model.threads.find(item => item.id === messagesPageState.detailId);
  if (!thread) { closeMessagesInfo(); return; }
  const body = dialog.querySelector('[data-messages-info-body]');
  if (body) body.innerHTML = `<div class="messages-page-info-buyer">${messagesAvatar(thread.name)}<div><strong>${messagesEscape(thread.name)}</strong><span>Диалог FunPay</span></div></div><dl><div><dt>ID диалога</dt><dd>${messagesEscape(thread.id)}</dd></div><div><dt>Сообщений в снимке</dt><dd>${thread.messages.length}</dd></div><div><dt>От покупателя / магазина</dt><dd>${thread.messages.filter(message => message.sender === 'buyer').length} / ${thread.messages.filter(message => message.sender === 'seller').length}</dd></div><div><dt>Последнее сообщение</dt><dd>${thread.date == null ? 'Дата не передана FunPay' : messagesEscape(new Date(thread.date).toLocaleString('ru-RU'))}</dd></div><div><dt>Снимок получен</dt><dd>${messagesEscape(new Date(model.observedAt).toLocaleString('ru-RU'))}</dd></div></dl><p>Статусы прочтения и присутствия покупателя не передаются коннектором.</p>`;
}

function renderMessagesWorkspace() {
  if (typeof state === 'undefined') return false;
  const root = document.querySelector('[data-messages-workspace]');
  if (!root) return false;
  if (messagesPageState.generation !== sessionGeneration) {
    Object.assign(messagesPageState, { generation: sessionGeneration, snapshot: null, selectedId: null, query: '', actor: 'all', mobileOpen: false, findOpen: false, findQuery: '', matchIndex: 0, busy: false, request: null, error: '', bodyKey: null });
    closeMessagesInfo();
  }
  const snapshotChanged = messagesPageState.snapshot !== state.storeContent;
  if (snapshotChanged) { messagesPageState.snapshot = state.storeContent; messagesPageState.error = ''; }
  const model = buildMessagesWorkspace(state.storeContent, messagesPageState);
  const previousId = messagesPageState.selectedId;
  if (!model.threads.some(thread => thread.id === previousId)) messagesPageState.selectedId = model.filtered[0]?.id || null;
  const threadChanged = previousId !== messagesPageState.selectedId;
  if (threadChanged) { messagesPageState.findQuery = ''; messagesPageState.matchIndex = 0; messagesPageState.mobileOpen = false; closeMessagesInfo(); }
  const thread = model.threads.find(item => item.id === messagesPageState.selectedId);
  const connected = selectedStore()?.status === 'connected_read_only';
  const node = name => root.querySelector(`[data-messages-${name}]`);
  const setText = (name, value) => { if (node(name)) node(name).textContent = value; };
  root.setAttribute('data-chat-selected', String(Boolean(thread && messagesPageState.mobileOpen)));
  root.setAttribute('aria-busy', String(messagesPageState.busy));
  setText('total', model.loaded ? String(model.threads.length) : '—');
  setText('count', model.loaded ? String(model.totalMessages) : '—');
  setText('updated', model.loaded ? new Date(model.observedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : 'Ещё не загружен');
  setText('source', connected ? 'FunPay · только просмотр' : 'Магазин не подключён');
  const search = node('search');
  if (search && search.value !== messagesPageState.query) search.value = messagesPageState.query;
  const refresh = node('refresh');
  if (refresh) { refresh.disabled = messagesPageState.busy || !connected; refresh.innerHTML = `${messagesIcon('bolt')}${messagesPageState.busy ? 'Обновляем…' : 'Обновить переписку'}`; }
  const notice = node('notice');
  if (notice) { notice.hidden = !messagesPageState.error; notice.textContent = messagesPageState.error ? `${messagesPageState.error}${model.loaded ? ' Показан предыдущий снимок.' : ''}` : ''; }
  root.querySelectorAll('[data-messages-filter]').forEach(button => {
    const active = button.dataset.messagesFilter === model.actor;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  root.querySelectorAll('[data-messages-filter-count]').forEach(count => { count.textContent = String(model.counts[count.dataset.messagesFilterCount] || 0); });
  const list = node('list');
  if (list) list.innerHTML = model.filtered.length ? model.filtered.map(item => `<button class="messages-page-thread${item.id === thread?.id ? ' is-active' : ''}" type="button" data-messages-thread="${messagesEscape(item.id)}" aria-pressed="${item.id === thread?.id}">${messagesAvatar(item.name)}<span class="messages-page-thread-content"><span><strong>${messagesEscape(item.name)}</strong><small>${item.date == null ? '' : messagesEscape(new Date(item.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }))}</small></span><span class="messages-page-preview">${item.lastSender === 'seller' ? '<b>Вы: </b>' : ''}${messagesEscape(item.preview)}</span><span class="messages-page-thread-foot">FunPay <span>${item.messages.length} сообщ.</span></span></span></button>`).join('') : messagesEmpty(!model.loaded ? connected ? 'Переписка ещё не загружена' : 'Подключите магазин' : model.threads.length ? 'Диалогов не найдено' : 'В снимке нет сообщений', !model.loaded ? connected ? 'Нажмите «Обновить переписку».' : 'Завершите подключение FunPay в кабинете.' : model.threads.length ? 'Измените запрос или фильтр.' : 'Обновите снимок после новых сообщений на FunPay.', !model.loaded && !connected ? '<button class="button button--primary" type="button" data-open-connect>Подключить FunPay</button>' : model.threads.length ? '<button type="button" data-messages-reset>Сбросить фильтры</button>' : '');
  setText('name', thread?.name || 'Ваши диалоги');
  setText('meta', thread ? `${thread.messages.length} сообщений в снимке · FunPay` : 'Выберите диалог из списка');
  if (node('avatar')) node('avatar').innerHTML = thread ? messagesAvatar(thread.name) : `<span class="messages-page-avatar">${messagesIcon('chat')}</span>`;
  ['find-toggle', 'info'].forEach(name => { if (node(name)) node(name).disabled = !thread; });
  if (node('find-toggle')) { node('find-toggle').setAttribute('aria-expanded', String(Boolean(thread && messagesPageState.findOpen))); }
  if (node('findbar')) node('findbar').hidden = !thread || !messagesPageState.findOpen;
  if (node('find') && node('find').value !== messagesPageState.findQuery) node('find').value = messagesPageState.findQuery;
  const firstTranscript = thread ? messagesTranscript(thread, messagesPageState.findQuery) : { html: '', count: 0 };
  messagesPageState.matchIndex = firstTranscript.count ? Math.min(Math.max(0, messagesPageState.matchIndex), firstTranscript.count - 1) : 0;
  setText('matches', messagesPageState.findQuery.trim() ? firstTranscript.count ? `${messagesPageState.matchIndex + 1} / ${firstTranscript.count}` : 'Нет совпадений' : 'Поиск в снимке');
  root.querySelectorAll('[data-messages-match]').forEach(button => { button.disabled = !firstTranscript.count; });
  const body = node('body');
  const key = JSON.stringify([messagesPageState.generation, thread?.id, messagesPageState.findQuery, messagesPageState.matchIndex]);
  if (body && (snapshotChanged || messagesPageState.bodyKey !== key)) {
    const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
    const scrollTop = body.scrollTop;
    body.innerHTML = thread ? messagesTranscript(thread, messagesPageState.findQuery, messagesPageState.matchIndex).html : messagesEmpty('Выберите диалог', 'Здесь появится переписка вашего магазина.');
    if (messagesPageState.findQuery.trim() && firstTranscript.count) body.querySelector(`[data-message-match="${messagesPageState.matchIndex}"]`)?.scrollIntoView({ block: 'center' });
    else body.scrollTop = threadChanged || messagesPageState.bodyKey == null || nearBottom ? body.scrollHeight : scrollTop;
    messagesPageState.bodyKey = key;
  }
  setText('date-note', thread && thread.messages.some(message => message.date == null) ? 'FunPay не передал дату части сообщений. Сохранён порядок источника.' : 'Показана переписка из последнего снимка.');
  renderMessagesInfo(model);
  return true;
}

async function refreshMessagesWorkspace() {
  renderMessagesWorkspace();
  if (messagesPageState.busy) return;
  if (!authState.user || selectedStore()?.status !== 'connected_read_only') { renderMessagesWorkspace(); return; }
  const generation = sessionGeneration;
  const request = {};
  messagesPageState.request = request;
  messagesPageState.busy = true;
  messagesPageState.error = '';
  renderMessagesWorkspace();
  try { await syncStoreContent({ silent: true }); }
  catch (error) { if (generation === sessionGeneration && messagesPageState.request === request) messagesPageState.error = humanError(error); }
  finally {
    if (generation === sessionGeneration && messagesPageState.request === request) {
      messagesPageState.busy = false;
      messagesPageState.request = null;
      renderMessagesWorkspace();
    }
  }
}

function selectMessagesThread(id) {
  const model = buildMessagesWorkspace(state.storeContent, messagesPageState);
  if (!model.threads.some(thread => thread.id === id)) return;
  if (messagesPageState.selectedId !== id) { messagesPageState.findQuery = ''; messagesPageState.matchIndex = 0; messagesPageState.bodyKey = null; closeMessagesInfo(); }
  messagesPageState.selectedId = id;
  messagesPageState.mobileOpen = true;
  renderMessagesWorkspace();
  const root = document.querySelector('[data-messages-workspace]');
  root?.querySelector(typeof window !== 'undefined' && window.matchMedia?.('(max-width: 700px)').matches ? '[data-messages-back]' : '[data-messages-body]')?.focus({ preventScroll: true });
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('input', event => {
    if (!event.target.closest('[data-messages-workspace]')) return;
    if (event.target.matches('[data-messages-search]')) { messagesPageState.query = event.target.value.slice(0, 160); renderMessagesWorkspace(); }
    if (event.target.matches('[data-messages-find]')) { messagesPageState.findQuery = event.target.value.slice(0, 160); messagesPageState.matchIndex = 0; renderMessagesWorkspace(); }
  });
  document.addEventListener('click', event => {
    const root = event.target.closest('[data-messages-workspace]');
    if (!root) return;
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.hasAttribute('data-messages-thread')) selectMessagesThread(button.dataset.messagesThread);
    if (button.hasAttribute('data-messages-filter')) { messagesPageState.actor = button.dataset.messagesFilter; renderMessagesWorkspace(); }
    if (button.hasAttribute('data-messages-reset')) { messagesPageState.query = ''; messagesPageState.actor = 'all'; renderMessagesWorkspace(); }
    if (button.hasAttribute('data-messages-back')) { messagesPageState.mobileOpen = false; renderMessagesWorkspace(); Array.from(root.querySelectorAll('[data-messages-thread]')).find(item => item.dataset.messagesThread === messagesPageState.selectedId)?.focus({ preventScroll: true }); }
    if (button.hasAttribute('data-messages-refresh')) refreshMessagesWorkspace();
    if (button.hasAttribute('data-messages-find-toggle') || button.hasAttribute('data-messages-find-close')) {
      messagesPageState.findOpen = button.hasAttribute('data-messages-find-toggle') ? !messagesPageState.findOpen : false;
      if (!messagesPageState.findOpen) { messagesPageState.findQuery = ''; messagesPageState.matchIndex = 0; }
      renderMessagesWorkspace();
      root.querySelector(messagesPageState.findOpen ? '[data-messages-find]' : '[data-messages-find-toggle]')?.focus({ preventScroll: true });
    }
    if (button.hasAttribute('data-messages-match')) {
      const model = buildMessagesWorkspace(state.storeContent);
      const thread = model.threads.find(item => item.id === messagesPageState.selectedId);
      const count = thread ? messagesTranscript(thread, messagesPageState.findQuery).count : 0;
      if (count) { messagesPageState.matchIndex = (messagesPageState.matchIndex + (button.dataset.messagesMatch === 'prev' ? -1 : 1) + count) % count; renderMessagesWorkspace(); }
    }
    if (button.hasAttribute('data-messages-info')) {
      messagesPageState.detailId = messagesPageState.selectedId;
      const dialog = root.querySelector('[data-messages-dialog]');
      renderMessagesInfo(buildMessagesWorkspace(state.storeContent));
      if (messagesPageState.detailId != null && dialog && !dialog.open) dialog.showModal();
    }
    if (button.hasAttribute('data-messages-info-close')) closeMessagesInfo();
  });
  document.addEventListener('close', event => {
    if (event.target.matches('[data-messages-dialog]')) closeMessagesInfo();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && event.target.closest('[data-messages-findbar]')) {
      messagesPageState.findOpen = false; messagesPageState.findQuery = ''; messagesPageState.matchIndex = 0;
      renderMessagesWorkspace();
      document.querySelector('[data-messages-find-toggle]')?.focus({ preventScroll: true });
    }
  });
}
