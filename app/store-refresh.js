// Keep visible cabinet views current. Existing syncStoreContent shares the request
// across views, retains the last snapshot on failure and guards account changes.
let storeRefreshLastAttempt = Date.now();
let storeRefreshPending = false;
async function refreshVisibleStore() {
  if (document.hidden || storeRefreshPending || Date.now() - storeRefreshLastAttempt < 60_000) return;
  if (typeof syncStoreContent !== 'function' || typeof authState === 'undefined' || !authState.user) return;
  if (selectedStore()?.status !== 'connected_read_only') return;
  if (typeof storeContentSyncFlight !== 'undefined' && storeContentSyncFlight) return;
  storeRefreshLastAttempt = Date.now();
  storeRefreshPending = true;
  try {
    if (typeof refreshOverview === 'function') await refreshOverview();
    else await syncStoreContent({ silent: true });
  } catch { /* Sync leaves the previous snapshot intact. */ }
  finally { storeRefreshPending = false; }
}
window.setInterval(() => { refreshVisibleStore(); }, 60_000);
document.addEventListener('visibilitychange', () => { refreshVisibleStore(); });
