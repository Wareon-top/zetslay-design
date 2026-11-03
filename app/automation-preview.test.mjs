import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./automation-preview.js',import.meta.url),'utf8');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
test('preview renders buyer content as text and distinguishes sample matching from real sending',()=>{
 const c=vm.createContext({storeToolsEsc:esc});vm.runInContext(source,c);
 const result={simulation:true,writePerformed:false,text:'<img src=x onerror=alert(1)>',kind:'reply',ruleId:'one',matchedRules:[{id:'one',index:0},{id:'two',index:1}],overlap:true,blockers:['AUTOMATION_PAUSED','BUYER_BLOCKED']};
 c.result=result;const html=vm.runInContext('automationPreviewResultMarkup(result)',c);
 assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);assert.match(html,/Совпало несколько/);assert.match(html,/Общий переключатель/);assert.match(html,/Сообщение не отправлено/);assert.match(html,/реальный чат/);
});
test('incompatible API responses and errors cannot present a confirmed simulation',()=>{
 const c=vm.createContext({storeToolsEsc:esc});vm.runInContext(source,c);
 for(const result of [{},{simulation:true,writePerformed:true,text:'sent',blockers:[],matchedRules:[]},{simulation:true,writePerformed:false,text:'x',matchedRules:[]}]){c.result=result;assert.match(vm.runInContext('automationPreviewResultMarkup(result)',c),/не подтвердил/);}
 assert.match(vm.runInContext('automationPreviewResultMarkup(null,"<failure>")',c),/&lt;failure&gt;/);
 assert.doesNotMatch(source,/localStorage|sessionStorage|\/automation['"]|basicConfigure\(|sendMessage\(/);
});
function interactive(){
 const listeners={},requests=[],output={innerHTML:''},button={setAttribute(){}};
 const context=vm.createContext({storeToolsEsc:esc,AbortController,AbortSignal,FormData:class{constructor(form){this.fields=form.fields;}get(key){return this.fields[key]??null;}has(key){return Object.hasOwn(this.fields,key);}},document:{addEventListener:(name,fn)=>listeners[name]=fn,querySelector:selector=>selector.includes('result')?output:selector.includes('run')?button:null},apiRequest:(path,options)=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject})),humanError:error=>error.message});
 vm.runInContext("let scope='one';const storeToolsScope=()=>scope;const storeToolsUi={busy:false,data:{automation:{revision:'r1'}}};const basicAutomationUi={busy:false,epoch:1};function basicAutomationMarkup(){return '';}function resetBasicAutomation(){}function basicAutomationConfig(){return {enabled:false,replyEnabled:true,rules:[]};}function renderStoreTools(){basicAutomationMarkup();}",context);vm.runInContext(source,context);
 const form={fields:{sampleText:'Цена?',sampleBuyer:'Пример',sampleCooldown:'0'},matches:()=>true,reportValidity:()=>true};
 return {context,listeners,requests,form,run:text=>vm.runInContext(text,context),submit:()=>listeners.submit({target:form,preventDefault(){}})};
}
test('late preview cannot replace an edited draft or cross an account boundary',async()=>{
 const f=interactive(),first=f.submit();assert.equal(f.requests[0].path,'/api/v1/store-tools/automation/preview');assert.equal(f.requests[0].options.body.config.enabled,false);
 f.form.fields.sampleText='Новый пример';f.listeners.input({target:{closest:selector=>selector==='[data-automation-preview]'?f.form:null}});f.requests[0].resolve({simulation:true,writePerformed:false,text:'OLD',blockers:[],matchedRules:[]});await first;assert.equal(f.run('automationPreviewState.result'),null);
 const second=f.submit();f.requests[1].resolve({simulation:true,writePerformed:false,text:'NEW',blockers:[],matchedRules:[]});await second;assert.equal(f.run('automationPreviewState.result.text'),'NEW');f.run("scope='two';renderStoreTools()");assert.equal(f.run('automationPreviewState.result'),null);assert.equal(f.run('automationPreviewState.sample.buyer'),'Покупатель');
});
test('an older API fails clearly without changing or enabling saved automation',async()=>{
 const f=interactive(),pending=f.submit();f.requests[0].reject(Object.assign(Error('not found'),{code:'NOT_FOUND'}));await pending;assert.match(f.run('automationPreviewState.error'),/Обновите API/);assert.equal(f.run('automationPreviewState.busy'),false);assert.equal(f.requests.length,1);
});
