import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=['lots.js','app.js'].map(name=>readFileSync(new URL('./'+name,import.meta.url),'utf8').replace(/\ninit\(\);\s*$/,'')).join('\n');
const lot=(id,patch={})=>({id:String(id),title:`Товар ${id}`,status:'active',priceMinor:10000,currency:'RUB',stock:2,...patch});
const snapshot=lots=>({storeId:'123',observedAt:'2026-10-05T08:00:00Z',lots,availableResources:{lots:true}});
function harness(){
  const nodes=new Map(),listeners={};
  const node=name=>{if(!nodes.has(name))nodes.set(name,{textContent:'',innerHTML:'',value:'',hidden:false,disabled:false,dataset:{},classList:{toggle(){}},setAttribute(){},removeAttribute(){},querySelector:s=>node(s),querySelectorAll:()=>[]});return nodes.get(name);};
  const buttons=['all','active','paused','empty','unknown'].map(value=>{const n=node('tab-'+value);n.dataset.lotsStatus=value;n.querySelector=()=>node('count-'+value);return n;});
  const pages=['prev','next'].map(value=>{const n=node('page-'+value);n.dataset.lotsPage=value;return n;});
  const options=['source','name','price-asc','price-desc','stock-asc'].map(value=>({value,disabled:false}));node('[data-lots-sort]').querySelectorAll=()=>options;
  const root={querySelector:node,querySelectorAll:s=>s==='[data-lots-status]'?buttons:s==='[data-lots-page]'?pages:[]};
  const dialog={open:false,querySelector:node,showModal(){this.open=true;},close(){this.open=false;}};
  const document={querySelector(s){return s==='[data-lots-workspace]'?root:s==='[data-lot-dialog]'?dialog:s==='meta[name="zetslay-api-base-url"]'?{content:'https://api.zetslay.pro'}:null;},querySelectorAll:()=>[],getElementById:()=>null,addEventListener(type,fn){(listeners[type]??=[]).push(fn);},body:{classList:{toggle(){}}}};
  const context=vm.createContext({document,URL,URLSearchParams,Intl,location:{hash:'#lots',hostname:'zetslay.pro',search:''},sessionStorage:{getItem:()=>null},localStorage:{getItem:()=>null,removeItem(){}},window:{scrollTo(){},setTimeout(){}},history:{replaceState(){}},setInterval(){},clearInterval(){}});
  vm.runInContext(source,context);const run=code=>vm.runInContext(code,context);
  run("authState.user={id:'owner'};authState.token='token';state.storeFleet={selectedStoreId:'123',stores:[{id:'123',status:'connected_read_only'}]};showToast=()=>{};");
  const model=(content,filters={})=>{context.content=content;context.filters=filters;return JSON.parse(JSON.stringify(run("buildLotsWorkspace(content,filters,'123')")));};
  const render=content=>{context.content=content;run('state.storeContent=content;renderLots()');};
  const event=(type,selector,{value='',dataset={},disabled=false}={})=>{const target={value,dataset,disabled,matches:s=>s===selector,closest:s=>s===selector?target:s==='[data-lots-workspace]'?root:null};for(const listener of listeners[type]||[])listener({target,preventDefault(){}});};
  return {run,context,node,root,dialog,model,render,event,options,pages};
}
test('inventory distinguishes missing, unavailable and genuinely empty lists without invented zeroes',()=>{
  const a=harness();a.render({observedAt:null,lots:[]});assert.equal(a.node('[data-lots-all]').textContent,'—');assert.match(a.node('[data-lots-rows]').innerHTML,/ещё не загружены/);
  a.render({...snapshot(null),availableResources:{lots:false}});assert.equal(a.node('[data-lots-all]').textContent,'—');assert.match(a.node('[data-lots-rows]').innerHTML,/пока недоступен/);
  a.render(snapshot([]));assert.equal(a.node('[data-lots-all]').textContent,'0');assert.match(a.node('[data-lots-rows]').innerHTML,/В снимке нет лотов/);
  a.render({...snapshot([lot(1)]),storeId:'another-account'});assert.equal(a.node('[data-lots-all]').textContent,'—');assert.doesNotMatch(a.node('[data-lots-rows]').innerHTML,/Товар 1/);
});
test('summary counts only explicit statuses and known zero stock; invalid and duplicate records are bounded',()=>{
  const a=harness(),data=snapshot([lot(1),lot(2,{status:'paused',stock:0}),lot(3,{status:undefined,stock:undefined}),lot(4,{status:'surprise',stock:-1}),lot(1),null,{}]);
  const model=a.model(data);assert.deepEqual(model.totals,{all:4,active:1,paused:1,empty:1});assert.equal(model.counts.unknown,2);assert.equal(model.lots[2].stock,null);
  a.render(data);assert.match(a.node('[data-lots-rows]').innerHTML,/Статус не передан/);assert.match(a.node('[data-lots-rows]').innerHTML,/Не передан/);
});
test('search, category, status and currency filters work together and keep snapshot totals stable',()=>{
  const a=harness(),data=snapshot([lot(12,{title:'Золотой аккаунт',category:'Аккаунты'}),lot(13,{status:'paused',category:'Услуги',currency:'USD'}),lot(14,{category:'Аккаунты',stock:0})]);
  assert.equal(a.model(data,{query:'#12'}).rows[0].id,'12');assert.equal(a.model(data,{query:'  ЗОЛОТОЙ  ',category:'Аккаунты'}).filtered.length,1);
  assert.equal(a.model(data,{category:'Аккаунты',status:'empty'}).rows[0].id,'14');
  a.render(data);a.event('input','[data-lots-search]',{value:'Золотой'});assert.equal(a.node('[data-lots-all]').textContent,'3');assert.match(a.node('[data-lots-rows]').innerHTML,/Золотой аккаунт/);assert.doesNotMatch(a.node('[data-lots-rows]').innerHTML,/Товар 13/);
  a.event('click','[data-lots-reset]');assert.equal(a.run('lotsPageState.query'),'');a.event('change','[data-lots-currency]',{value:'USD'});assert.equal(a.node('count-all').textContent,'1');assert.match(a.node('[data-lots-rows]').innerHTML,/Товар 13/);
});
test('price sorting never mixes currencies, leaves missing prices last and does not mutate source',()=>{
  const a=harness(),data=snapshot([lot(1,{priceMinor:999}),lot(2,{currency:'USD',priceMinor:50}),lot(3,{priceMinor:null}),lot(4,{priceMinor:250})]),before=JSON.stringify(data);
  assert.equal(a.model(data,{sort:'price-asc'}).sort,'source');
  const sorted=a.model(data,{currency:'RUB',sort:'price-asc'});assert.deepEqual(sorted.rows.map(x=>x.id),['4','1','3']);assert.equal(sorted.rows[2].price,null);assert.equal(JSON.stringify(data),before);
  assert.equal(a.model(snapshot([lot(1,{currency:'BOGUS',priceMinor:100})])).lots[0].price,null);
});
test('pagination clamps after filtering and event controls reset page without losing filters',()=>{
  const a=harness(),data=snapshot(Array.from({length:24},(_,i)=>lot(i+1)));
  a.render(data);a.event('click','[data-lots-page]',{dataset:{lotsPage:'next'}});assert.equal(a.run('lotsPageState.page'),2);assert.match(a.node('[data-lots-range]').textContent,/11–20/);
  a.event('input','[data-lots-search]',{value:'#24'});assert.equal(a.run('lotsPageState.page'),1);assert.match(a.node('[data-lots-range]').textContent,/1–1 из 1/);assert.equal(a.pages[1].disabled,true);
  assert.equal(a.model(data,{page:999,size:20}).page,2);assert.equal(a.model(data,{size:17}).size,10);
});
test('details and outbound links escape fields and permit only generated numeric FunPay offer URLs',()=>{
  const a=harness(),data=snapshot([lot('22',{title:'<img src=x onerror=x>',category:'"><script>x</script>',url:'javascript:alert(1)'}),lot('javascript:x'),lot('demo-lot-001')]);
  a.render(data);const html=a.node('[data-lots-rows]').innerHTML;assert.match(html,/&lt;img/);assert.doesNotMatch(html,/href="javascript|<script>|<img src=x/);assert.match(html,/https:\/\/funpay.com\/lots\/offer\?id=22/);
  a.event('click','[data-lot-open]',{dataset:{lotOpen:'22'}});assert.equal(a.dialog.open,true);assert.match(a.node('[data-lot-detail-body]').innerHTML,/Не переданы/);assert.doesNotMatch(a.node('[data-lot-detail-body]').innerHTML,/onerror="|javascript:/);
  a.render(snapshot([]));assert.equal(a.dialog.open,false);assert.equal(a.node('[data-lot-detail-body]').innerHTML,'');
});
test('refresh deduplicates clicks, retains prior snapshot on error and cannot update another session',async()=>{
  const a=harness();a.render(snapshot([lot(1)]));let calls=0,reject;a.context.request=()=>{calls++;return new Promise((_,r)=>reject=r);};a.run('apiRequest=request');
  const pending=a.run('refreshLotsWorkspace()');await a.run('refreshLotsWorkspace()');assert.equal(calls,1);assert.equal(a.node('[data-lots-refresh]').disabled,true);
  reject({message:'Сеть недоступна'});await pending;assert.match(a.node('[data-lots-alert-copy]').textContent,/предыдущий список/);assert.match(a.node('[data-lots-rows]').innerHTML,/Товар 1/);
  const next=a.run('refreshLotsWorkspace()');a.run('sessionGeneration++;resetLotsWorkspace();authState.user=null;renderLots()');reject({message:'OLD_PRIVATE_ERROR'});await next;assert.doesNotMatch(a.node('[data-lots-alert-copy]').textContent,/OLD_PRIVATE_ERROR/);assert.doesNotMatch(a.node('[data-lots-rows]').innerHTML,/Товар 1/);
});
test('plugin actions navigate to existing plugin pages and never call writes',()=>{
  const a=harness();let route;a.context.openRoute=r=>{route=r;};a.run('setView=openRoute');a.event('click','[data-lots-plugin]',{dataset:{lotsPlugin:'zetslay.mass-price-editor'}});assert.equal(route,'plugins/zetslay.mass-price-editor');
  assert.equal(a.model({...snapshot([lot(1)]),availableResources:{lots:false}}).loaded,false);
});

test('live inventory loads categories sequentially and survives the unrelated chat snapshot refresh',async()=>{
 const a=harness();a.render({...snapshot(null),availableResources:{lots:false}});const calls=[];
 a.context.inventoryRequest=async(path,options)=>{calls.push(path);assert.equal(options.authenticated,true);assert.equal(options.method,undefined);const url=new URL(path,'https://api.zetslay.pro');assert.equal(url.searchParams.get('storeId'),'123');const nodeId=url.searchParams.get('nodeId');return nodeId?{storeId:'123',nodeId,observedAt:'2026-10-09T17:00:00Z',lots:[lot(nodeId,{nodeId,category:'Игра · Аккаунты',status:nodeId==='4'?'hidden':'active'})]}:{storeId:'123',observedAt:'2026-10-09T16:59:00Z',categories:[{nodeId:'3'},{nodeId:'4'}]};};
 a.run('apiRequest=inventoryRequest');await a.run('refreshLotsWorkspace()');
 assert.equal(calls.length,3);assert.equal(a.node('[data-lots-all]').textContent,'2');assert.equal(a.node('[data-lots-paused]').textContent,'1');assert.match(a.node('[data-lots-rows]').innerHTML,/Скрыт на FunPay/);
 a.render({...snapshot(null),availableResources:{lots:false}});assert.equal(a.node('[data-lots-all]').textContent,'2');assert.equal(a.run('lotsPageState.progress'),2);
 a.event('click','[data-lot-open]',{dataset:{lotOpen:'3'}});assert.match(a.node('[data-lot-detail-body]').innerHTML,/offerEdit\?offer=3/);
});
test('partial, foreign or duplicate responses keep the prior complete inventory rather than publishing a misleading total',async()=>{
 for(const mode of ['partial','foreign','duplicate']){
  const a=harness();a.render(snapshot([lot(1)]));let calls=0;
  a.context.inventoryRequest=async()=>{calls++;if(calls===1)return {storeId:'123',observedAt:'2026-10-09T17:00:00Z',categories:[{nodeId:'3'},{nodeId:'4'}]};if(mode==='partial'&&calls===3)throw Error('Не получена категория');if(mode==='foreign')return {storeId:'999',nodeId:'3',lots:[]};return {storeId:'123',nodeId:calls===2?'3':'4',observedAt:'2026-10-09T17:00:00Z',lots:[lot('12',{nodeId:calls===2?'3':'4'})]};};
  a.run('apiRequest=inventoryRequest');await a.run('refreshLotsWorkspace()');assert.equal(a.node('[data-lots-all]').textContent,'1');assert.match(a.node('[data-lots-alert-copy]').textContent,/предыдущий список/);assert.equal(a.run('lotsPageState.inventory'),null);
 }
});
test('first visit starts one inventory request and unknown shop identity never exposes snapshot rows',()=>{
 const a=harness();let scheduled=0;a.context.window.setTimeout=()=>scheduled++;a.root.hidden=false;
 a.render(snapshot([]));a.run('renderLots()');assert.equal(scheduled,1);
 const data=snapshot([lot(1)]);delete data.storeId;assert.equal(a.model(data).loaded,false);
});
