/* Persistent authentication lives in an HttpOnly API cookie, never localStorage. */
(() => {
  const eventKey = 'zetslay_auth_event';
  const listeners = new Set();
  let channel;
  try { channel = new BroadcastChannel('zetslay-auth'); } catch { /* storage fallback */ }
  const seen = new Set();
  const dispatch = event => {
    if (!['login','logout'].includes(event?.type) || typeof event.id !== 'string' || seen.has(event.id)) return;
    seen.add(event.id); if (seen.size > 64) seen.delete(seen.values().next().value);
    listeners.forEach(fn => fn(event.type));
  };
  if (channel) channel.onmessage = event => dispatch(event.data);
  window.addEventListener('storage', event => {
    if (event.key !== eventKey || !event.newValue) return;
    try { dispatch(JSON.parse(event.newValue)); } catch { /* invalid public event */ }
  });
  async function request(base, path, token = '') {
    const response = await fetch(base.replace(/\/$/, '') + path, {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: {accept:'application/json', 'content-type':'application/json', ...(token ? {authorization:`Bearer ${token}`} : {})},
      body: '{}', signal: AbortSignal.timeout(12000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(payload.error?.message || 'Не удалось проверить вход'); error.code = payload.error?.code || `HTTP_${response.status}`; throw error; }
    return payload.data;
  }
  window.ZetSlaySession = Object.freeze({
    legacyToken() { try { return sessionStorage.getItem('zetslay_session') || ''; } catch { return ''; } },
    clearLegacy() { try { sessionStorage.removeItem('zetslay_session'); } catch { /* storage blocked */ } },
    restore: base => request(base, '/api/v1/auth/resume'),
    migrate: (base, token) => request(base, '/api/v1/auth/resume', token),
    status: base => request(base, '/api/v1/auth/session'),
    notify(type) {
      const event = {type, id:`${Date.now()}-${Math.random()}`};
      try { channel?.postMessage(event); } catch { /* closed channel */ }
      try { localStorage.setItem(eventKey, JSON.stringify(event)); } catch { /* storage blocked */ }
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  });
})();
