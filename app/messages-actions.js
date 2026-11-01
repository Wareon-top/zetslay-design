/* Explicit owner replies. A receipt, not an HTTP 200, confirms delivery. */
const messagesActions={scope:'',draftPrefix:'',initialLoaded:false,epoch:0,metaRevision:0,metaLoading:false,metaAt:0,capabilities:null,operations:new Map(),drafts:new Map(),pins:new Set(),pages:new Map(),sort:'recent',paused:false,error:'',reading:false,sending:new Set()};
const messageCanContainSecret=text=>/(?:\b\d{6,12}:[A-Za-z0-9_-]{25,}\b|\b[a-f0-9]{32,64}\b|(?:https?|socks5):\/\/[^\s]+:[^\s]+@)/i.test(text);
const messageTextValid=text=>typeof text==='string'&&text.trim().length>0&&text.length<=1000&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)&&!messageCanContainSecret(text);
const messageUnresolved=row=>['preparing','sending','unknown','waiting_response'].includes(row.status);
function messagesActionScope(){return JSON.stringify([authState.user?.id||'',selectedStore()?.id||'',sessionGeneration]);}
function messagesDraftPrefix(){return 'zetslay:messages:v2:'+encodeURIComponent(authState.user?.id||'')+':'+encodeURIComponent(selectedStore()?.id||'')+':';}
function messageActionContext(){return {scope:messagesActionScope(),epoch:messagesActions.epoch,token:authState.token,storeId:selectedStore()?.id};}
function messageActionCurrent(c){return Boolean(authState.user&&authState.token===c.token&&messagesActionScope()===c.scope&&messagesActions.epoch===c.epoch);}
function resetMessagesActions(){messagesActions.epoch++;messagesActions.metaRevision++;Object.assign(messagesActions,{scope:'',draftPrefix:'',initialLoaded:false,metaLoading:false,metaAt:0,capabilities:null,operations:new Map(),drafts:new Map(),pins:new Set(),pages:new Map(),sort:'recent',paused:false,error:'',reading:false,sending:new Set()});}
function messageStored(key,fallback){try{return JSON.parse(sessionStorage.getItem(messagesDraftPrefix()+key)||'null')??fallback;}catch{return fallback;}}
function messageSave(key,value){try{if(value==null)sessionStorage.removeItem?.(messagesDraftPrefix()+key);else sessionStorage.setItem?.(messagesDraftPrefix()+key,JSON.stringify(value));}catch{}}
function messagesDraft(threadId){if(!messagesActions.drafts.has(threadId)){const stored=messageStored('draft:'+threadId,'');messagesActions.drafts.set(threadId,typeof stored==='string'&&!messageCanContainSecret(stored)?stored.slice(0,4000):'');}return messagesActions.drafts.get(threadId)||'';}
function setMessagesDraft(threadId,text){messagesActions.drafts.set(threadId,text);messageSave('draft:'+threadId,!text||messageCanContainSecret(text)?null:text.slice(0,4000));}
function mergeMessagesHistory(rows,{live=false,observedAt=null}={}){
 const map=new Map((messagesPageState[live?'liveMessages':'history']||[]).filter(m=>m?.id&&m?.threadId).map(m=>[JSON.stringify([m.threadId,m.id]),m]));
 for(const m of rows||[])if(typeof m?.id==='string'&&typeof m.threadId==='string')map.set(JSON.stringify([m.threadId,m.id]),m);
 messagesPageState[live?'liveMessages':'history']=[...map.values()];
 if(messageDate(observedAt)!=null&&(!messagesPageState.archiveObservedAt||messageDate(observedAt)>messageDate(messagesPageState.archiveObservedAt)))messagesPageState.archiveObservedAt=observedAt;
 messagesPageState.bodyKey=null;
}
let messagesSyncList=async()=>{};
function messagesOutboxMarkup(threadId){
 const rows=[...messagesActions.operations.values()].filter(r=>r.threadId===threadId);
 const unresolved=rows.filter(messageUnresolved),last=rows.filter(r=>!messageUnresolved(r)).sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt)))[0];
 return [...unresolved,...(last?[last]:[])].map(r=>{
  const status={preparing:'Проверяем магазин и получателя…',sending:'Отправляем на FunPay…',unknown:'Результат не подтверждён. Сообщение могло быть отправлено.',waiting_response:'Ответ сервера не получен. Получите состояние этой отправки.',failed:'Сообщение не отправлено. Черновик сохранён.',sent:'Отправлено на FunPay',reviewed:'Вы проверили результат. Автоматическая повторная отправка не выполнялась.'}[r.status]||'Проверяем результат';
  const uncertain=['unknown','waiting_response'].includes(r.status);
  return `<div class="messages-outbox messages-outbox--${r.status==='sent'?'sent':uncertain?'unknown':r.status==='failed'?'failed':'pending'}" data-message-operation="${messagesEscape(r.id)}"><span>${r.status==='sent'?'✓':uncertain?'!':'○'}</span><div><strong>${messagesEscape(status)}</strong>${messageUnresolved(r)?`<p>${messagesEscape(r.text)}</p>`:''}${r.code&&r.status!=='sent'?`<small>${messagesEscape(r.code)}</small>`:''}${uncertain?`<div class="messages-outbox-actions"><button type="button" data-message-check="${messagesEscape(r.id)}">${r.status==='waiting_response'?'Получить результат':'Сверить с FunPay'}</button>${r.status==='unknown'?`<button type="button" data-message-ack="${messagesEscape(r.id)}">Я проверил переписку</button>`:''}</div>`:''}</div></div>`;
 }).join('');
}
function renderMessageActions(){
 const root=document.querySelector('[data-messages-workspace]');if(!root||!authState.user)return;
 if(messagesActions.scope!==messagesActionScope()){resetMessagesActions();messagesActions.scope=messagesActionScope();messagesActions.draftPrefix=messagesDraftPrefix();const pins=messageStored('pins',[]);messagesActions.pins=new Set(Array.isArray(pins)?pins.filter(x=>typeof x==='string'&&/^[1-9]\d{0,19}$/.test(x)):[]);}
 const node=name=>root.querySelector('[data-messages-'+name+']'),model=buildMessagesWorkspace(messagesContent(),messagesPageState),thread=model.threads.find(t=>t.id===messagesPageState.selectedId);
 const connected=selectedStore()?.status==='connected_read_only',busy=thread&&messagesActions.sending.has(thread.id),blocked=thread&&[...messagesActions.operations.values()].some(r=>r.threadId===thread.id&&messageUnresolved(r));
 const enabled=Boolean(thread&&/^[1-9]\d{0,19}$/.test(thread.id)&&connected&&messagesActions.capabilities?.sendEnabled);
 const draft=thread?messagesDraft(thread.id):'',input=node('text');
 if(input){if(input.value!==draft)input.value=draft;input.disabled=!enabled||busy;input.style&&(input.style.height='auto');if(input.style)input.style.height=Math.min(160,Math.max(64,input.scrollHeight))+'px';}
 if(node('send')){node('send').disabled=!enabled||busy||blocked||!messageTextValid(draft);node('send').innerHTML=`<span>${busy?'Отправляем…':'Отправить'}</span>${messagesIcon('send')}`;}
 if(node('recipient'))node('recipient').textContent=thread?'Ответ для '+thread.name:'Выберите покупателя';
 if(node('draft-state'))node('draft-state').textContent=draft?(messageCanContainSecret(draft)?'Секреты не сохраняются':'Черновик в этой вкладке'):'';
 if(node('text-count')){node('text-count').textContent=draft.length+' / 1000';node('text-count').classList.toggle('is-over-limit',draft.length>1000);}
 root.querySelectorAll('[data-messages-quick]').forEach(b=>b.disabled=!enabled||busy||blocked);
 if(node('compose-hint'))node('compose-hint').textContent=!thread?'Выберите диалог для ответа.':!connected?'Отправка доступна после проверки подключения магазина.':messagesActions.metaLoading&&!messagesActions.capabilities?'Проверяем доступ к отправке…':!enabled?messagesActions.capabilities?.reason==='PROXY_EXPIRED'?'Срок управляемого прокси истёк. Продлите его в профиле.':messagesActions.capabilities?.reason==='PROXY_REVOKED'?'Прокси отозван. Запросите замену в профиле.':'Отправка недоступна: нужен активный тариф и установленный серверный модуль.':blocked?'Дождитесь результата предыдущей отправки или проверьте неопределённый результат.':'Enter — отправить · Shift+Enter — новая строка';
 const error=messageCanContainSecret(draft)?'Не отправляйте Golden Key, токены ботов и адреса прокси покупателям.':draft.length>1000?'Текст длиннее лимита. Сократите его до 1000 символов.':messagesActions.error;
 if(node('compose-error')){node('compose-error').hidden=!error;node('compose-error').textContent=error;}
 if(node('outbox'))node('outbox').innerHTML=thread?messagesOutboxMarkup(thread.id):'';
 if(node('pin')){node('pin').disabled=!thread;node('pin').setAttribute('aria-pressed',String(Boolean(thread&&messagesActions.pins.has(thread.id))));}
 if(node('external')){node('external').hidden=!thread||!/^\d+$/.test(thread.id);if(thread&&/^\d+$/.test(thread.id))node('external').href='https://funpay.com/chat/?node='+encodeURIComponent(thread.id);}
 if(node('thread-history')){node('thread-history').disabled=!thread||messagesActions.reading;node('thread-history').textContent=messagesActions.reading?'Загружаем…':'История этого диалога';}
 if(node('thread-history-note')){const page=thread&&messagesActions.pages.get(thread.id);node('thread-history-note').textContent=page?`${thread.messages.length} сообщений загружено · сохранено ${page.total}`:'';}
 if(node('sort'))node('sort').value=messagesActions.sort;
 if(node('poll-toggle')){node('poll-toggle').setAttribute('aria-pressed',String(messagesActions.paused));node('poll-toggle').setAttribute('aria-label',messagesActions.paused?'Включить автообновление':'Приостановить автообновление');}
 if(node('source'))node('source').textContent=connected?'FunPay · '+(messagesActions.capabilities?.sendEnabled?'ответы включены':'переписка'):'Магазин не подключён';
 if(node('auto'))node('auto').textContent=messagesActions.paused?'Автообновление на паузе':connected?'Автообновление · каждые 30 с, пока раздел открыт':'Автообновление приостановлено';
 const list=node('list');if(list&&typeof list.append==='function'){
  const rows=model.filtered.map((t,i)=>({...t,index:i}));rows.sort((a,b)=>Number(messagesActions.pins.has(b.id))-Number(messagesActions.pins.has(a.id))||(messagesActions.sort==='name'?a.name.localeCompare(b.name,'ru'):messagesActions.sort==='oldest'?b.index-a.index:messagesActions.sort==='waiting'?Number(b.lastSender==='buyer')-Number(a.lastSender==='buyer')||a.index-b.index:a.index-b.index));
  const buttons=new Map(Array.from(list.querySelectorAll('[data-messages-thread]')).map(b=>[b.dataset.messagesThread,b]));for(const row of rows){const b=buttons.get(row.id);if(b){b.classList.toggle('is-pinned',messagesActions.pins.has(row.id));list.append(b);}}
 }
}
async function loadMessageCapabilities({force=false}={}){
 if(!authState.user||!authState.token||!selectedStore()?.id||messagesActions.metaLoading||!force&&Date.now()-messagesActions.metaAt<15000)return;
 const c=messageActionContext(),revision=++messagesActions.metaRevision;messagesActions.metaLoading=true;messagesActions.metaAt=Date.now();
 try{const result=await apiRequest('/api/v1/funpay/message-operations?storeId='+encodeURIComponent(c.storeId),{authenticated:true});if(!messageActionCurrent(c)||revision!==messagesActions.metaRevision)return;messagesActions.capabilities=result;for(const row of result.operations||[])messagesActions.operations.set(row.id,row);if(!messagesActions.initialLoaded&&result.sendEnabled&&!buildMessagesWorkspace(messagesContent()).loaded){messagesActions.initialLoaded=true;await messagesSyncList();}}
 catch(e){if(messageActionCurrent(c)&&revision===messagesActions.metaRevision){messagesActions.capabilities=null;messagesActions.error=e.code==='HTTP_404'?'Сначала установите серверное обновление сообщений.':e.message||'Не удалось проверить отправку';}}
 finally{if(messageActionCurrent(c)&&revision===messagesActions.metaRevision){messagesActions.metaLoading=false;renderMessageActions();}}
}
async function sendMessagesText({retry=null}={}){
 const model=buildMessagesWorkspace(messagesContent()),thread=model.threads.find(t=>t.id===messagesPageState.selectedId);
 if(!authState.user||!authState.token||!thread||messagesActions.sending.has(thread.id)||!messagesActions.capabilities?.sendEnabled)return;
 const text=retry?.text??messagesDraft(thread.id);if(!messageTextValid(text))return;
 if(!retry&&[...messagesActions.operations.values()].some(r=>r.threadId===thread.id&&messageUnresolved(r)))return;
 const c=messageActionContext(),threadId=retry?.threadId||thread.id,operationId=retry?.id||'wmsg_'+crypto.randomUUID();
 if(threadId!==thread.id)return;
 const body={operationId,storeId:c.storeId,threadId,text};messagesActions.sending.add(threadId);messagesActions.error='';messagesActions.metaRevision++;messagesActions.metaLoading=false;
 messagesActions.operations.set(operationId,{id:operationId,storeId:c.storeId,threadId,text,status:'preparing',createdAt:new Date().toISOString()});renderMessageActions();
 try{
  const result=await apiRequest('/api/v1/funpay/messages/send',{method:'POST',authenticated:true,body,signal:AbortSignal.timeout(140000)});
  if(!messageActionCurrent(c))return;
  if(result.operation){messagesActions.operations.delete(operationId);messagesActions.operations.set(result.operation.id,result.operation);}
  if(result.operation?.status==='sent'&&!result.blocked){if(messagesDraft(threadId)===text)setMessagesDraft(threadId,'');const receiptMessage=result.message||(result.operation.messageId?{id:result.operation.messageId,threadId,buyer:thread.name,text:result.operation.text,sender:'seller',fromSeller:true}:null);if(receiptMessage)mergeMessagesHistory([receiptMessage],{live:true,observedAt:result.observedAt});}
  if(result.blocked)messagesActions.error='Предыдущая отправка ещё не завершена. Сначала проверьте её результат.';
 }catch(e){if(messageActionCurrent(c)){messagesActions.operations.set(operationId,{...messagesActions.operations.get(operationId),status:['INVALID_SESSION','PLAN_REQUIRED','INVALID_INPUT','MESSAGE_STORE_CHANGED','MESSAGE_CONNECTION_REQUIRED','MESSAGE_SEND_DISABLED','RATE_LIMITED'].includes(e.code)?'failed':'waiting_response',code:e.code||'MESSAGE_RESPONSE_LOST',updatedAt:new Date().toISOString()});messagesActions.error=e.message||'Ответ сервера не получен';}}
 finally{if(messageActionCurrent(c)){messagesActions.sending.delete(threadId);messagesActions.metaRevision++;messagesActions.metaLoading=false;await loadMessageCapabilities({force:true});renderMessagesWorkspace();}}
}
async function refreshMessagesThread(){
 const threadId=messagesPageState.selectedId;if(!threadId||messagesActions.reading||!authState.user||selectedStore()?.status!=='connected_read_only')return;
 const c=messageActionContext();messagesActions.reading=true;
 try{const result=await apiRequest('/api/v1/funpay/threads/'+encodeURIComponent(threadId)+'?storeId='+encodeURIComponent(c.storeId),{authenticated:true,signal:AbortSignal.timeout(110000)});if(!messageActionCurrent(c))return false;mergeMessagesHistory(result.messages,{live:true,observedAt:result.observedAt});messagesActions.error='';return true;}
 catch(e){if(messageActionCurrent(c))messagesActions.error=e.message||'Не удалось обновить диалог';return false;}
 finally{if(messageActionCurrent(c)){messagesActions.reading=false;renderMessagesWorkspace();if(messagesPageState.selectedId!==threadId)setTimeout(()=>{if(messageActionCurrent(c))refreshMessagesThread();},0);}}
}
async function loadEarlierMessagesThread(){
 const threadId=messagesPageState.selectedId;if(!threadId||messagesActions.reading||!authState.user)return;
 const c=messageActionContext(),cursor=messagesActions.pages.get(threadId)?.nextCursor;messagesActions.reading=true;
 try{const page=await apiRequest('/api/v1/funpay/messages?threadId='+encodeURIComponent(threadId)+'&limit=100'+(cursor?'&before='+encodeURIComponent(cursor):''),{authenticated:true});if(!messageActionCurrent(c))return;mergeMessagesHistory(page.messages,{observedAt:page.observedAt});messagesActions.pages.set(threadId,page.messageArchive);}
 catch(e){if(messageActionCurrent(c))messagesActions.error=e.message||'Не удалось загрузить историю';}
 finally{if(messageActionCurrent(c)){messagesActions.reading=false;renderMessagesWorkspace();}}
}
async function checkMessagesOperation(id,{acknowledge=false}={}){
 const row=messagesActions.operations.get(id);if(!row||messagesActions.sending.has(row.threadId))return;
 if(row.status==='waiting_response'){await sendMessagesText({retry:row});return;}
 if(acknowledge&&!window.confirm('Проверьте переписку на FunPay. Разблокировать ввод после вашей проверки? Сообщение не будет отправлено повторно автоматически.'))return;
 const c=messageActionContext();messagesActions.sending.add(row.threadId);renderMessageActions();
 try{const result=await apiRequest('/api/v1/funpay/message-operations/'+encodeURIComponent(id)+(acknowledge?'/acknowledge':'/check'),{method:'POST',authenticated:true,...(acknowledge?{body:{confirmed:true}}:{}),signal:AbortSignal.timeout(110000)});if(!messageActionCurrent(c))return;messagesActions.operations.set(id,result.operation);if(result.messages)mergeMessagesHistory(result.messages,{live:true,observedAt:result.observedAt});if(result.operation?.status==='sent'&&messagesDraft(row.threadId).replace(/\r\n?/g,'\n').trim()===row.text)setMessagesDraft(row.threadId,'');}
 catch(e){if(messageActionCurrent(c))messagesActions.error=e.message||'Проверка не завершена';}
 finally{if(messageActionCurrent(c)){messagesActions.sending.delete(row.threadId);renderMessagesWorkspace();}}
}
(function installMessagesActions(){
 if(typeof document==='undefined'||typeof renderMessagesWorkspace!=='function')return;
 const render=renderMessagesWorkspace;
 renderMessagesWorkspace=function(...args){const result=render(...args);renderMessageActions();const root=document.querySelector('[data-messages-workspace]');if(root&&!root.hidden&&authState.user)loadMessageCapabilities();return result;};
 const canPoll=messagesCanPoll;messagesCanPoll=function(){return !messagesActions.paused&&canPoll();};
 const originalRefresh=refreshMessagesWorkspace;
 messagesSyncList=async()=>{if(messagesPageState.busy||messagesActions.sending.size)return;await originalRefresh();};
 refreshMessagesWorkspace=async function(){
  if(!authState.user||!authState.token||selectedStore()?.status!=='connected_read_only')return originalRefresh();
  renderMessagesWorkspace();if(messagesPageState.busy)return;
  const c=messageActionContext();messagesPageState.busy=true;messagesPageState.error='';stopMessagesPolling();messagesPolling.lastAttempt=Date.now();renderMessagesWorkspace();
  try{const page=await apiRequest('/api/v1/funpay/messages?limit=1000',{authenticated:true});if(!messageActionCurrent(c))return;mergeMessagesHistory(page.messages,{observedAt:page.observedAt});messagesPageState.archive=page.messageArchive;renderMessagesWorkspace();const refreshed=await refreshMessagesThread();if(messageActionCurrent(c)){await loadMessageCapabilities({force:true});messagesPolling.failures=refreshed===false?Math.min(2,messagesPolling.failures+1):0;if(refreshed===false)messagesPageState.error=messagesActions.error;}}
  catch(e){if(messageActionCurrent(c)){messagesPageState.error=e.message||'Не удалось обновить переписку';messagesPolling.failures=Math.min(2,messagesPolling.failures+1);}}
  finally{if(messageActionCurrent(c)){messagesPageState.busy=false;renderMessagesWorkspace();}}
 };
 if(typeof resetAccountData==='function'){const reset=resetAccountData;resetAccountData=function(...args){const prefix=messagesActions.draftPrefix||messagesDraftPrefix();try{for(let i=(sessionStorage.length||0)-1;i>=0;i--){const key=sessionStorage.key(i);if(key?.startsWith(prefix))sessionStorage.removeItem(key);}}catch{}resetMessagesActions();return reset(...args);};}
 document.addEventListener('input',event=>{const input=event.target;if(!input.matches?.('[data-messages-text]'))return;const id=messagesPageState.selectedId;if(!id)return;setMessagesDraft(id,input.value.slice(0,4000));messagesActions.error='';renderMessageActions();});
 document.addEventListener('change',event=>{if(event.target.matches?.('[data-messages-sort]')){messagesActions.sort=['recent','oldest','name','waiting'].includes(event.target.value)?event.target.value:'recent';renderMessageActions();}});
 document.addEventListener('submit',event=>{if(event.target.matches?.('[data-messages-compose]')){event.preventDefault();sendMessagesText();}});
 document.addEventListener('click',event=>{
  const root=event.target.closest?.('[data-messages-workspace]');if(!root)return;const b=event.target.closest('button');if(!b||b.disabled)return;
  if(b.hasAttribute('data-messages-pin')){const id=messagesPageState.selectedId;if(id){messagesActions.pins.has(id)?messagesActions.pins.delete(id):messagesActions.pins.add(id);messageSave('pins',[...messagesActions.pins]);renderMessageActions();}}
  if(b.hasAttribute('data-messages-poll-toggle')){messagesActions.paused=!messagesActions.paused;updateMessagesPolling();renderMessageActions();}
  if(b.hasAttribute('data-messages-latest')){const body=root.querySelector('[data-messages-body]');if(body)body.scrollTop=body.scrollHeight;b.hidden=true;}
  if(b.hasAttribute('data-messages-thread-history'))loadEarlierMessagesThread();
  if(b.hasAttribute('data-messages-sync-list'))messagesSyncList();
  if(b.hasAttribute('data-message-check'))checkMessagesOperation(b.dataset.messageCheck);
  if(b.hasAttribute('data-message-ack'))checkMessagesOperation(b.dataset.messageAck,{acknowledge:true});
  if(b.hasAttribute('data-messages-quick')){const thread=buildMessagesWorkspace(messagesContent()).threads.find(t=>t.id===messagesPageState.selectedId);if(!thread)return;const phrases={hello:`Здравствуйте, ${thread.name}! Чем могу помочь?`,checking:'Здравствуйте! Проверяю ваш заказ. Напишу, как только будут новости.',thanks:'Спасибо за покупку! Если появятся вопросы, напишите — помогу.'},text=phrases[b.dataset.messagesQuick];if(text){const previous=messagesDraft(thread.id);setMessagesDraft(thread.id,previous?previous+'\n'+text:text);renderMessageActions();root.querySelector('[data-messages-text]')?.focus();}}
  if(b.hasAttribute('data-messages-thread')){messagesActions.error='';renderMessageActions();refreshMessagesThread();}
 });
 document.addEventListener('scroll',event=>{if(!event.target.matches?.('[data-messages-body]'))return;const body=event.target,b=document.querySelector('[data-messages-latest]');if(b)b.hidden=body.scrollHeight-body.scrollTop-body.clientHeight<100;},true);
 document.addEventListener('keydown',event=>{
  if(event.target.matches?.('[data-messages-text]')&&event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229){event.preventDefault();sendMessagesText();}
  const root=document.querySelector('[data-messages-workspace]');if(root?.hidden!==false)return;
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();root.querySelector('[data-messages-search]')?.focus();}
 });
 renderMessagesWorkspace();
})();
