/* A read-only inbox over the existing FunPay content snapshot. */
const messagesPageState = { generation: null, snapshot: null, selectedId: null, query: '', actor: 'all', mobileOpen: false, findOpen: false, findQuery: '', matchIndex: 0, busy: false, request: null, error: '', bodyKey: null, detailId: null };
const messagesPolling = { timer: null, observer: null, lastAttempt: 0, failures: 0 };
const messagesEscape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const messagesIcon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
function messageDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) return null;
  const day = value.slice(0, 10);
  if (new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) return null;
  return Date.parse(value);
}

function messagesContent() {
  const content = state.storeContent;
  const merged = new Map();
  for (const raw of [...(messagesPageState.history || []), ...(content?.messages || [])]) {
    if (raw && typeof raw.threadId === 'string' && typeof raw.id === 'string') merged.set(JSON.stringify([raw.threadId, raw.id]), raw);
  }
  return { ...content, observedAt: content?.observedAt || messagesPageState.archiveObservedAt || null,
    messages: messagesPageState.history?.length ? [...merged.values()] : content?.messages || [] };
}

function stopMessagesPolling() {
  if (messagesPolling.timer != null) window.clearTimeout(messagesPolling.timer);
  messagesPolling.timer = null;
}

function messagesCanPoll() {
  const root = document.querySelector('[data-messages-workspace]');
  return Boolean(root && !root.hidden && document.visibilityState !== 'hidden' && authState.user && selectedStore()?.status === 'connected_read_only');
}

function updateMessagesPolling() {
  if (typeof window?.setTimeout !== 'function') return;
  if (!messagesCanPoll()) { stopMessagesPolling(); return; }
  if (messagesPolling.timer != null || messagesPageState.busy) return;
  const generation = sessionGeneration;
  const interval = Math.min(120_000, 30_000 * 2 ** messagesPolling.failures);
  messagesPolling.timer = window.setTimeout(async () => {
    messagesPolling.timer = null;
    if (generation !== sessionGeneration || !messagesCanPoll()) return;
    await refreshMessagesWorkspace();
  }, Math.max(1000, interval - (Date.now() - messagesPolling.lastAttempt)));
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
    const sender = raw.fromSeller === true ? 'seller' : ['system', 'unknown'].includes(raw.sender) ? raw.sender : raw.sender === 'seller' ? 'seller' : raw.sender === 'buyer' || raw.fromSeller === false ? 'buyer' : 'unknown';
    const date = messageDate(raw.createdAt);
    group.messages.push({ id: messageId, text: typeof raw.text === 'string' ? raw.text : '', sender, date: date != null && date <= observedAt ? date : null,
      sourceDateLabel: typeof raw.sourceDateLabel === 'string' ? raw.sourceDateLabel.slice(0, 160) : '', textTruncated: raw.textTruncated === true });
    groups.set(id, group);
  });
  const threads = [...groups.values()].map(group => {
    if (group.messages.every(message => message.date != null)) group.messages.sort((a, b) => a.date - b.date);
    else if (group.messages.every(message => /^\d{1,20}$/.test(message.id))) group.messages.sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0);
    const last = group.messages.at(-1);
    return { ...group, preview: last.text || 'Текст сообщения не передан', lastSender: last.sender, date: last.date, sourceDateLabel: last.sourceDateLabel };
  });
  if (threads.every(thread => /^\d{1,20}$/.test(thread.messages.at(-1).id))) threads.sort((a, b) => BigInt(a.messages.at(-1).id) > BigInt(b.messages.at(-1).id) ? -1 : BigInt(a.messages.at(-1).id) < BigInt(b.messages.at(-1).id) ? 1 : 0);
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
    const timestamp = message.date == null ? message.sourceDateLabel ? `<span class="messages-page-source-date" title="Дата в исходном виде FunPay">${messagesEscape(message.sourceDateLabel)}</span>` : '' : `<time datetime="${new Date(message.date).toISOString()}">${messagesEscape(new Date(message.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))}</time>`;
    return `${divider}<article class="messages-page-message messages-page-message--${message.sender}">${['buyer', 'seller'].includes(message.sender) ? avatar : ''}<div class="messages-page-bubble"><div class="messages-page-message-meta"><strong>${messagesEscape(label)}</strong>${timestamp}</div><p>${text.html}</p>${message.textTruncated ? '<small>Показаны первые 10 000 символов сообщения.</small>' : ''}</div></article>`;
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
  if (body) body.innerHTML = `<div class="messages-page-info-buyer">${messagesAvatar(thread.name)}<div><strong>${messagesEscape(thread.name)}</strong><span>Диалог FunPay</span></div></div><dl><div><dt>ID диалога</dt><dd>${messagesEscape(thread.id)}</dd></div><div><dt>Загружено сообщений</dt><dd>${thread.messages.length}</dd></div><div><dt>От покупателя / магазина</dt><dd>${thread.messages.filter(message => message.sender === 'buyer').length} / ${thread.messages.filter(message => message.sender === 'seller').length}</dd></div><div><dt>Последнее сообщение</dt><dd>${thread.date == null ? messagesEscape(thread.sourceDateLabel || 'Дата не передана FunPay') : messagesEscape(new Date(thread.date).toLocaleString('ru-RU'))}</dd></div><div><dt>Снимок получен</dt><dd>${messagesEscape(new Date(model.observedAt).toLocaleString('ru-RU'))}</dd></div></dl><p>Статусы прочтения и присутствия покупателя не передаются коннектором.</p>`;
}

function renderMessagesWorkspace() {
  if (typeof state === 'undefined') return false;
  const root = document.querySelector('[data-messages-workspace]');
  if (!root) return false;
  if (messagesPageState.generation !== sessionGeneration || messagesPageState.storeId !== selectedStore()?.id) {
    stopMessagesPolling();
    messagesPolling.lastAttempt = Date.now(); messagesPolling.failures = 0;
    Object.assign(messagesPageState, { generation: sessionGeneration, snapshot: null, selectedId: null, query: '', actor: 'all', mobileOpen: false, findOpen: false, findQuery: '', matchIndex: 0, busy: false, request: null, error: '', bodyKey: null });
    Object.assign(messagesPageState, { storeId: selectedStore()?.id, history: [], archiveObservedAt: null, archive: null, olderLoaded: false });
    closeMessagesInfo();
  }
  const snapshotChanged = messagesPageState.snapshot !== state.storeContent;
  if (snapshotChanged) {
    messagesPageState.snapshot = state.storeContent; messagesPageState.error = '';
    if (!messagesPageState.olderLoaded) messagesPageState.archive = state.storeContent?.messageArchive || null;
    else if (messagesPageState.archive && state.storeContent?.messageArchive) messagesPageState.archive.total = state.storeContent.messageArchive.total;
  }
  const model = buildMessagesWorkspace(messagesContent(), messagesPageState);
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
  setText('auto', connected ? 'Автообновление каждые 30 с · пока раздел открыт' : 'Автообновление приостановлено');
  const archive = node('archive');
  if (archive) {
    archive.hidden = model.loaded && !messagesPageState.archive?.hasMore;
    archive.disabled = messagesPageState.busy || !authState.user || !selectedStore()?.id;
    archive.textContent = messagesPageState.busy ? 'Загружаем…' : model.loaded ? 'Загрузить более ранние сообщения' : 'Открыть сохранённую переписку';
  }
  setText('archive-note', messagesPageState.archive ? `Загружено ${model.totalMessages} из ${messagesPageState.archive.total} сохранённых сообщений. Поиск работает по загруженной части.` : 'Поиск работает по загруженной переписке');
  const search = node('search');
  if (search && search.value !== messagesPageState.query) search.value = messagesPageState.query;
  const refresh = node('refresh');
  if (refresh) { refresh.disabled = messagesPageState.busy || !connected; refresh.innerHTML = `${messagesIcon('bolt')}${messagesPageState.busy ? 'Обновляем…' : 'Обновить переписку'}`; }
  const notice = node('notice');
  if (notice) { notice.hidden = !messagesPageState.error; notice.textContent = messagesPageState.error ? `${messagesPageState.error}${model.loaded ? ' Показан предыдущий снимок или сохранённая переписка.' : ''}` : ''; }
  root.querySelectorAll('[data-messages-filter]').forEach(button => {
    const active = button.dataset.messagesFilter === model.actor;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  root.querySelectorAll('[data-messages-filter-count]').forEach(count => { count.textContent = String(model.counts[count.dataset.messagesFilterCount] || 0); });
  const list = node('list');
  if (list) list.innerHTML = model.filtered.length ? model.filtered.map(item => `<button class="messages-page-thread${item.id === thread?.id ? ' is-active' : ''}" type="button" data-messages-thread="${messagesEscape(item.id)}" aria-pressed="${item.id === thread?.id}">${messagesAvatar(item.name)}<span class="messages-page-thread-content"><span><strong>${messagesEscape(item.name)}</strong><small>${item.date == null ? messagesEscape(item.sourceDateLabel) : messagesEscape(new Date(item.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }))}</small></span><span class="messages-page-preview">${item.lastSender === 'seller' ? '<b>Вы: </b>' : ''}${messagesEscape(item.preview)}</span><span class="messages-page-thread-foot">FunPay <span>${item.messages.length} сообщ.</span></span></span></button>`).join('') : messagesEmpty(!model.loaded ? connected ? 'Переписка ещё не загружена' : 'Подключите магазин' : model.threads.length ? 'Диалогов не найдено' : 'В снимке нет сообщений', !model.loaded ? connected ? 'Нажмите «Обновить переписку».' : 'Завершите подключение FunPay в кабинете.' : model.threads.length ? 'Измените запрос или фильтр.' : 'Обновите снимок после новых сообщений на FunPay.', !model.loaded && !connected ? '<button class="button button--primary" type="button" data-open-connect>Подключить FunPay</button>' : model.threads.length ? '<button type="button" data-messages-reset>Сбросить фильтры</button>' : '');
  setText('name', thread?.name || 'Ваши диалоги');
  setText('meta', thread ? `${thread.messages.length} загруженных сообщений · FunPay` : 'Выберите диалог из списка');
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
  setText('date-note', thread && thread.messages.some(message => message.date == null && !message.sourceDateLabel) ? 'FunPay не передал дату части сообщений. Они упорядочены по ID источника, если он доступен.' : thread?.messages.some(message => message.sourceDateLabel && message.date == null) ? 'Даты показаны как на FunPay. Год и часовой пояс не добавляются.' : 'Показана загруженная переписка.');
  renderMessagesInfo(model);
  if (!messagesPolling.observer && typeof MutationObserver === 'function') {
    messagesPolling.observer = new MutationObserver(updateMessagesPolling);
    messagesPolling.observer.observe(root, { attributes: true, attributeFilter: ['hidden'] });
  }
  updateMessagesPolling();
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
  stopMessagesPolling();
  messagesPageState.error = '';
  messagesPolling.lastAttempt = Date.now();
  renderMessagesWorkspace();
  try { await syncStoreContent({ silent: true }); if (generation === sessionGeneration && messagesPageState.request === request) messagesPolling.failures = 0; }
  catch (error) { if (generation === sessionGeneration && messagesPageState.request === request) { messagesPageState.error = humanError(error); messagesPolling.failures = Math.min(2, messagesPolling.failures + 1); } }
  finally {
    if (generation === sessionGeneration && messagesPageState.request === request) {
      messagesPageState.busy = false;
      messagesPageState.request = null;
      renderMessagesWorkspace();
    }
  }
}

async function loadMessagesArchive() {
  renderMessagesWorkspace();
  if (messagesPageState.busy || !authState.user || !selectedStore()?.id) return;
  const generation = sessionGeneration, storeId = selectedStore().id, request = {};
  const model = buildMessagesWorkspace(messagesContent());
  const cursor = model.loaded ? messagesPageState.archive?.nextCursor : null;
  if (model.loaded && !cursor) return;
  messagesPageState.busy = true; messagesPageState.request = request; messagesPageState.error = '';
  renderMessagesWorkspace();
  try {
    const page = await apiRequest(`/api/v1/funpay/messages?limit=${model.loaded ? 100 : 1000}${cursor ? `&before=${encodeURIComponent(cursor)}` : ''}`, { authenticated: true });
    if (generation !== sessionGeneration || storeId !== selectedStore()?.id || messagesPageState.request !== request) return;
    messagesPageState.history = [...(messagesPageState.history || []), ...(page.messages || [])];
    messagesPageState.archiveObservedAt = page.observedAt;
    messagesPageState.archive = page.messageArchive;
    messagesPageState.olderLoaded = true;
    messagesPageState.bodyKey = null;
  } catch (error) {
    if (generation === sessionGeneration && messagesPageState.request === request) messagesPageState.error = humanError(error);
  } finally {
    if (generation === sessionGeneration && messagesPageState.request === request) {
      messagesPageState.busy = false; messagesPageState.request = null; renderMessagesWorkspace();
    }
  }
}

function selectMessagesThread(id) {
  const model = buildMessagesWorkspace(messagesContent(), messagesPageState);
  if (!model.threads.some(thread => thread.id === id)) return;
  if (messagesPageState.selectedId !== id) { messagesPageState.findQuery = ''; messagesPageState.matchIndex = 0; messagesPageState.bodyKey = null; closeMessagesInfo(); }
  messagesPageState.selectedId = id;
  messagesPageState.mobileOpen = true;
  renderMessagesWorkspace();
  const root = document.querySelector('[data-messages-workspace]');
  root?.querySelector(typeof window !== 'undefined' && window.matchMedia?.('(max-width: 700px)').matches ? '[data-messages-back]' : '[data-messages-body]')?.focus({ preventScroll: true });
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', updateMessagesPolling);
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
    if (button.hasAttribute('data-messages-archive')) loadMessagesArchive();
    if (button.hasAttribute('data-messages-find-toggle') || button.hasAttribute('data-messages-find-close')) {
      messagesPageState.findOpen = button.hasAttribute('data-messages-find-toggle') ? !messagesPageState.findOpen : false;
      if (!messagesPageState.findOpen) { messagesPageState.findQuery = ''; messagesPageState.matchIndex = 0; }
      renderMessagesWorkspace();
      root.querySelector(messagesPageState.findOpen ? '[data-messages-find]' : '[data-messages-find-toggle]')?.focus({ preventScroll: true });
    }
    if (button.hasAttribute('data-messages-match')) {
      const model = buildMessagesWorkspace(messagesContent());
      const thread = model.threads.find(item => item.id === messagesPageState.selectedId);
      const count = thread ? messagesTranscript(thread, messagesPageState.findQuery).count : 0;
      if (count) { messagesPageState.matchIndex = (messagesPageState.matchIndex + (button.dataset.messagesMatch === 'prev' ? -1 : 1) + count) % count; renderMessagesWorkspace(); }
    }
    if (button.hasAttribute('data-messages-info')) {
      messagesPageState.detailId = messagesPageState.selectedId;
      const dialog = root.querySelector('[data-messages-dialog]');
      renderMessagesInfo(buildMessagesWorkspace(messagesContent()));
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
