/* Only a successful server check changes guest links to the cabinet. */
(() => {
  const session = window.ZetSlaySession;
  if (!session) return;
  const base = document.querySelector('meta[name="zetslay-api-base-url"]')?.content;
  if (!base) return;
  let generation = 0, expiresAt = 0, pending = false, expiryTimer;
  function render(signedIn) {
    document.querySelectorAll('[data-session-guest]').forEach(node => { node.hidden = signedIn; });
    document.querySelectorAll('[data-session-cabinet]').forEach(node => { node.hidden = !signedIn; });
    document.querySelectorAll('[data-session-start]').forEach(node => {
      node.href = signedIn ? 'app/' : 'app/?auth=register';
      const label = node.querySelector('[data-session-start-label]');
      if (label) label.textContent = signedIn ? 'В кабинет' : 'Начать работу';
    });
    document.querySelectorAll('[data-session-login]').forEach(node => {
      node.href = signedIn ? 'app/' : 'app/?auth=login';
      const label = node.querySelector('[data-session-login-label]');
      if (label) label.textContent = signedIn ? 'В кабинет' : 'Войти в ZetSlay';
    });
  }
  async function check() {
    if (pending) return;
    pending = true; const request = ++generation;
    try {
      const data = await session.status(base);
      if (request !== generation) return;
      const expiry = Date.parse(data?.expiresAt);
      if (data?.authenticated !== true || !Number.isFinite(expiry) || expiry <= Date.now()) throw Object.assign(Error('Вход истёк'), {code:'INVALID_SESSION'});
      expiresAt = expiry; render(true); clearTimeout(expiryTimer);
      expiryTimer = setTimeout(() => { expiresAt = 0; render(false); }, Math.min(expiry - Date.now(), 2147483647));
    } catch (error) {
      if (request === generation && (error.code === 'INVALID_SESSION' || expiresAt <= Date.now())) { expiresAt = 0; render(false); }
    } finally { if (request === generation) pending = false; }
  }
  session.subscribe(type => {
    if (type === 'logout') { generation++; pending = false; expiresAt = 0; clearTimeout(expiryTimer); render(false); }
    else { generation++; pending = false; check(); }
  });
  window.addEventListener('pageshow', check);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  check();
})();
