/* Account-scoped read-only feed. Refreshing this feed never runs shop operations. */
const diagnosticCategories={all:'Все причины',connection:'Подключение',delivery:'Выдача',stock:'Склад',automation:'Автоматизация',purchase:'Закупки',orders:'Заказы',access:'Доступ'};
const diagnosticSeverities={critical:'Проверить исход',warning:'Требует внимания',info:'Информация'};
const diagnosticViews=new Set(['connect','billing','orders','store-tools','plugins','proxy-shop']);
const diagnosticPlugins=new Set(['zetslay.kosell-rent','zetslay.steam-rent','zetslay.stars-relay','zetslay.robux-relay','zetslay.roblox-lzt-market','zetslay.tiktok-lzt-market']);
function validDiagnostics(data){
 if(!data||data.schema!==1||typeof data.complete!=='boolean'||!Array.isArray(data.coverage)||data.coverage.length>30||!Array.isArray(data.issues)||data.issues.length>50||!Number.isInteger(data.total)||data.total<0||!data.counts||!['total','critical','warning','info'].every(k=>Number.isInteger(data.counts[k])&&data.counts[k]>=0)||typeof data.observedAt!=='string'||!Number.isFinite(Date.parse(data.observedAt)))return false;
 if(!data.coverage.every(c=>c&&typeof c.label==='string'&&c.label.length<=100&&['checked','not_applicable','unavailable','partial'].includes(c.status)))return false;
 return data.issues.every(i=>i&&/^[a-f0-9]{64}$/.test(i.id)&&Object.hasOwn(diagnosticSeverities,i.severity)&&Object.hasOwn(diagnosticCategories,i.category)&&['title','cause','consequence','solution'].every(k=>typeof i[k]==='string'&&i[k].length<=1000)&&i.action&&diagnosticViews.has(i.action.view)&&(!i.action.pluginId||diagnosticPlugins.has(i.action.pluginId))&&typeof i.action.label==='string'&&i.action.label.length<=100&&(!i.orderId||/^[A-Za-z0-9_-]{1,100}$/.test(i.orderId)));
}
function createDiagnosticsFeed({scope,request,changed=()=>{},timeoutMs=15000}){
 const state={data:null,dataKey:null,error:'',loading:false,query:'',severity:'all',category:'all',offset:0,selected:'',scope:null};let controller=null,epoch=0,pendingKey=null;
 const key=()=>JSON.stringify([scope(),state.query,state.severity,state.category,state.offset]);
 function reset(){controller?.abort();controller=null;epoch++;pendingKey=null;Object.assign(state,{data:null,dataKey:null,error:'',loading:false,query:'',severity:'all',category:'all',offset:0,selected:'',scope:scope()});}
 async function load(){
  const current=scope();if(!current){reset();changed();return;}
  if(JSON.stringify(state.scope)!==JSON.stringify(current))reset();const wanted=key();if(pendingKey===wanted)return;
  controller?.abort();controller=new AbortController();const abort=controller,version=++epoch;pendingKey=wanted;state.loading=true;state.error='';changed();
  const params=new URLSearchParams({category:state.category,severity:state.severity,query:state.query,offset:String(state.offset)});if(current.storeId)params.set('storeId',current.storeId);
  let timer;const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error('deadline'));},timeoutMs);});
  try{
   const data=await Promise.race([request('/api/v1/diagnostics?'+params,{authenticated:true,signal:abort.signal}),deadline]);
   if(version!==epoch||JSON.stringify(scope())!==JSON.stringify(current))return;
   if(!validDiagnostics(data)||current.storeId&&data.storeId!==current.storeId)throw Error('invalid');
   if(state.offset>0&&data.total<=state.offset){state.offset=Math.max(0,Math.floor(Math.max(0,data.total-1)/50)*50);pendingKey=null;return await load();}
   state.data=data;state.dataKey=wanted;if(!data.issues.some(i=>i.id===state.selected))state.selected='';
  }catch(error){if(version!==epoch||JSON.stringify(scope())!==JSON.stringify(current))return;state.error=error.code==='NOT_FOUND'?'Для диагностики требуется обновление API.':error.code==='DIAGNOSTICS_STALE'?'Подключение изменилось. Обновите состояние кабинета.':error.code==='INVALID_SESSION'?'Войдите в кабинет для проверки.':'Не удалось обновить диагностику. Результат последней успешной проверки может быть устаревшим.';}
  finally{clearTimeout(timer);if(version===epoch&&JSON.stringify(scope())===JSON.stringify(current)){state.loading=false;pendingKey=null;changed();}}
 }
 function filter(values){if(JSON.stringify(state.scope)!==JSON.stringify(scope()))reset();Object.assign(state,values,{offset:0,selected:''});return load();}
 return {state,key,load,filter,reset,cancel:reset};
}
