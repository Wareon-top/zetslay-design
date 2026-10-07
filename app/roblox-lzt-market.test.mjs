import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./roblox-lzt-market.js',import.meta.url),'utf8');
const fixture=()=>({installation:{enabled:true},config:{automatic:false,autoRefund:false,notifyOwner:true,codesEnabled:true,codeWindowHours:24,codeCooldownSeconds:20,temporaryEmailConsent:false,maxSpendMinor:50000,dailyLimitMinor:300000,minMarginMinor:0,lowBalanceMinor:5000,searchPages:3,deliveryTemplate:'{login} {password}',waitTemplate:'',sellerBlacklist:[],buyerBlacklist:[]},account:null,analytics:{delivered:0,spentMinor:0,marginBeforeFeesMinor:0,uncertain:0},profiles:[],mappings:[],tasks:[],keyConfigured:false,proxyConfigured:false,workerEnabled:true,purchaseEnabled:true,deliveryEnabled:true});
function harness(){
  const listeners={},calls=[],feedback={textContent:'',setAttribute(){}},form={querySelector:s=>s==='fieldset'?{disabled:false}:s.includes('feedback')?feedback:null};
  const context=vm.createContext({authState:{token:'session'},sessionGeneration:1,escapeHtml:v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),queueMicrotask:()=>{},URL,console,window:{confirm:()=>true},document:{addEventListener:(k,f)=>listeners[k]=f,querySelector:()=>feedback},apiRequest:async(path,options)=>{calls.push([path,options]);return fixture();},humanError:e=>e.message,renderPluginPage:()=>calls.push(['render'])});
  vm.runInContext(source,context);context.sample=fixture();vm.runInContext('robloxUi.session=authState.token;robloxUi.generation=sessionGeneration;robloxUi.status=sample;',context);
  return {context,listeners,calls,form,feedback,run:s=>vm.runInContext(s,context)};
}
test('ultra plugin renders separate budgets, verified search, lot mappings and no secrets or detail banner',()=>{
  const h=harness(),html=h.run("robloxSettingsMarkup({id:'zetslay.roblox-lzt-market',installed:true})");
  assert.match(html,/Roblox LZT Market/);assert.match(html,/Дневной лимит/);assert.match(html,/Шаблон выдачи/);assert.match(html,/Проверить лот и сохранить/);assert.doesNotMatch(html,/<figure|data-plugin-cover/);assert.equal(h.run("robloxSettingsMarkup({id:'other',installed:true})"),'');
});
test('provider failures retain the live form and show an error instead of replacing typed secrets',async()=>{
  const h=harness();h.context.form=h.form;h.context.apiRequest=async()=>{throw Error('Токен отклонён');};await h.run("robloxAction('settings',{apiKey:'PRIVATE'},form)");assert.equal(h.feedback.textContent,'Токен отклонён');assert.equal(h.calls.filter(c=>c[0]==='render').length,0);assert.equal(h.run('robloxUi.busy'),false);assert.ok(!h.run('JSON.stringify(robloxUi)').includes('PRIVATE'));
});
test('an acknowledged action followed by a refresh failure tells the seller to refresh rather than repeat',async()=>{
  const h=harness();let calls=0;h.context.apiRequest=async()=>{if(calls++===0)return {};throw Error('Network');};
  await h.run("robloxAction('task',{orderId:'A',action:'redeliver',confirm:true})");
  assert.match(h.feedback.textContent,/Действие подтверждено/);assert.match(h.feedback.textContent,/Обновить/);
});
test('late response after logout cannot overwrite the next account settings',async()=>{
  const h=harness();let resolve;h.context.apiRequest=()=>new Promise(r=>resolve=r);const pending=h.run("robloxAction('settings',{config:{}})");h.run("authState.token='other';sessionGeneration++;resetRobloxUi()");resolve(fixture());await pending;assert.equal(h.run('robloxUi.status'),null);assert.equal(h.run('robloxUi.busy'),false);assert.equal(h.calls.length,0);
});
test('search results escape provider metadata and explicitly distinguish a partial sample from exhausted stock',()=>{
  const h=harness();h.context.report={candidates:[{itemId:'11',costMinor:10000,robux:1000,friends:10,followers:20,premium:'<img src=x onerror=alert(1)>'}],exhausted:false};const html=h.run('robloxSearchMarkup(report)');assert.match(html,/это не весь рынок/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);
});
test('displayed balance uses validated server values while redelivery and retry demand explicit confirmation',async()=>{
  const h=harness();h.context.sample.account={username:'owner',checkedAt:'2026-10-07T12:00:00Z',balances:[{title:'Основной',minor:0}]};h.context.sample.tasks=[{orderId:'A',status:'delivery_unknown'},{orderId:'B',status:'manual'}];
  const html=h.run("robloxSettingsMarkup({id:'zetslay.roblox-lzt-market',installed:true})");assert.match(html,/0.00 ₽/);assert.match(html,/Повторно выдать купленный аккаунт/);assert.match(html,/Повторить поиск/);
  h.context.window.confirm=()=>false;await h.listeners.click({target:{closest:()=>({hasAttribute:k=>k==='data-roblox-task',dataset:{action:'redeliver',robloxTask:'A'}})}});assert.equal(h.calls.length,0);
});

test('Roblox controls include consent for temporary mail and editable code window without exposing TOTP secrets',()=>{
  const h=harness(),html=h.run("robloxSettingsMarkup({id:'zetslay.roblox-lzt-market',installed:true})");
  assert.match(html,/name="temporaryEmailConsent"/);assert.match(html,/отменой гарантии LZT/);assert.match(html,/name="codeWindowHours"/);assert.match(html,/name="codeCooldownSeconds"/);assert.match(html,/roblox:ТЕГ/);assert.match(html,/!2faroblox/);assert.doesNotMatch(html,/name="totpSecret"/);
});
test('TikTok and Roblox UI modules coexist with distinct states, listeners and endpoint paths',()=>{
  const h=harness();vm.runInContext(readFileSync(new URL('./tiktok-lzt-market.js',import.meta.url),'utf8'),h.context);
  h.run("tiktokUi.status={test:'separate'}");assert.equal(h.run('robloxUi.status.analytics.delivered'),0);assert.equal(h.run('tiktokUi.status.test'),'separate');
});
