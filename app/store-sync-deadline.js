/* Bound only the read-only snapshot request. Purchases, refunds and writes keep
 * their existing request/retry policies; this module never retries a request. */
const STORE_SYNC_TIMEOUT_MS = 125_000; // 30s lock wait + 90s read + cleanup headroom.
const storeSyncRequests = new Set();
const storeSyncOriginalApi = apiRequest;
function storeSyncError(code, message) { return Object.assign(new Error(message), {code}); }
async function storeSyncRequest({authenticated = false} = {}) {
  if (!API_BASE_URL) throw storeSyncError('API_URL_MISSING', 'Не настроен адрес API.');
  const token=authState.token, generation=sessionGeneration, workspaceId=authState.workspace?.id;
  const controller=new AbortController();let timer, ticker, rejectWaiting;
  const started=Date.now();
  const waiting=new Promise((_, reject)=>{
    rejectWaiting=reject;
    timer=setTimeout(()=>{
      const error=storeSyncError('SYNC_TIMEOUT','Обновление FunPay заняло слишком много времени. Последние данные сохранены. Повторите обновление.');
      reject(error);controller.abort(error);
    },STORE_SYNC_TIMEOUT_MS);
  });
  const request={cancel(){const error=storeSyncError('SYNC_CANCELLED','Обновление отменено при выходе из аккаунта.');rejectWaiting(error);controller.abort(error);}};storeSyncRequests.add(request);
  ticker=setInterval(()=>{
    if(generation!==sessionGeneration||token!==authState.token)return;
    const seconds=Math.floor((Date.now()-started)/1000);if(seconds<10)return;
    const elapsed=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
    for(const selector of ['[data-overview-refresh-label]','[data-orders-refresh-label]','[data-billing-refresh-label]']){
      const label=document.querySelector(selector),button=label?.closest('button');
      if(button?.getAttribute('aria-busy')==='true')label.textContent=`Обновляем… ${elapsed}`;
    }
  },1000);
  try {
    const read=async()=>{
      const headers={accept:'application/json'};
      if(authenticated&&token)headers.authorization=`Bearer ${token}`;
      const response=await fetch(`${API_BASE_URL}/api/v1/funpay/content`,{method:'GET',headers,signal:controller.signal});
      // The deadline includes the body, not just response headers.
      let payload;
      try{payload=await response.json();}catch{throw storeSyncError('SYNC_RESPONSE_INVALID','Не удалось прочитать ответ сервиса. Последние данные сохранены. Повторите обновление.');}
      if(!response.ok)throw storeSyncError(payload?.error?.code||`HTTP_${response.status}`,payload?.error?.message||'Сервис отклонил обновление FunPay.');
      const data=payload?.data;
      if(!data||!Array.isArray(data.orders)||!Array.isArray(data.messages)||(workspaceId&&data.workspaceId!==workspaceId))throw storeSyncError('SYNC_RESPONSE_INVALID','Сервис не подтвердил данные этого магазина. Последние данные сохранены.');
      if(generation!==sessionGeneration||token!==authState.token)throw storeSyncError('SYNC_CANCELLED','Обновление предыдущего аккаунта отменено.');
      return data;
    };
    return await Promise.race([read(),waiting]);
  } finally {clearTimeout(timer);clearInterval(ticker);controller.abort();storeSyncRequests.delete(request);}
}
apiRequest=function(path,options={}){
  if(path==='/api/v1/funpay/content'&&(!options.method||options.method==='GET'))return storeSyncRequest(options);
  return storeSyncOriginalApi(path,options);
};
const storeSyncOriginalReset=resetAccountData;
resetAccountData=function(...args){
  // Browser cancellation never cancels the shared server worker or its queue.
  for(const request of storeSyncRequests)request.cancel();
  return storeSyncOriginalReset.apply(this,args);
};
