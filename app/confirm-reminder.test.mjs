import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('./confirm-reminder.js',import.meta.url),'utf8');
function harness(){const listeners={},error={textContent:'',hidden:true},calls=[],toasts=[];const context=vm.createContext({
  sessionGeneration:1,authState:{token:'session'},state:{plugins:[{id:'zetslay.confirm-reminder',config:{}}]},
  document:{addEventListener:(name,callback)=>listeners[name]=callback,querySelector:()=>error},
  escapeHtml:text=>String(text??'').replace(/[<>&"']/g,value=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[value])),
  icon:()=>'',showToast:(...args)=>toasts.push(args),humanError:error=>error.message,renderPluginPage:()=>{},
  apiRequest:async(path,options)=>{calls.push({path,options});return {workerEnabled:true,deliveryEnabled:true,tasks:[]};}
});vm.runInContext(code,context);return {context,error,calls,toasts,listeners,run:source=>vm.runInContext(source,context)};}
function form(overrides={}){const values={mode:'approval_required',firstDelayMinutes:'15',firstText:'Hello $username',secondDelayMinutes:'60',secondText:'Again #$order_id',...overrides};return {elements:{...Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{value,disabled:false}])),allowAutomatic:{checked:overrides.allowAutomatic===true},secondEnabled:{checked:overrides.secondEnabled===true}},querySelectorAll:()=>[]};}
test('page uses existing dark tokens, shows two stages, explicit consent and escaped source values',()=>{
  const app=harness();app.context.plugin={installed:true,config:{firstText:'<script>alert(1)</script>'}};const html=app.run('reminderSettingsMarkup(plugin)');assert.match(html,/firstDelayMinutes/);assert.match(html,/secondDelayMinutes/);assert.match(html,/Разрешаю этому плагину/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
  assert.match(readFileSync(new URL('./confirm-reminder.css',import.meta.url),'utf8'),/var\(--yellow\)/);
});
test('automatic mode requires permission checkbox and valid bounded delays before API writes',async()=>{
  const app=harness();app.context.form=form({mode:'automatic'});await app.run('reminderUiAction(form)');assert.equal(app.calls.length,0);assert.match(app.error.textContent,/Подтвердите/);
  app.context.form=form({firstDelayMinutes:'0'});await app.run('reminderUiAction(form)');assert.equal(app.calls.length,0);
  app.context.form=form({mode:'automatic',allowAutomatic:true,secondEnabled:true});await app.run('reminderUiAction(form)');assert.equal(app.calls[0].options.body.config.mode,'automatic');assert.equal(app.calls[0].options.body.config.secondEnabled,true);assert.equal(app.calls[1].path,'/api/v1/plugins/confirm-reminder/status');
});
test('status refresh is read-only and displays uncertain delivery without claiming a sent message',async()=>{
  const app=harness();await app.run('reminderUiAction()');assert.equal(app.calls.length,1);assert.equal(app.calls[0].options.method,undefined);
  app.run(`reminderUi.report={workerEnabled:false,deliveryEnabled:false,tasks:[{orderId:'<bad>',stage:1,status:'uncertain',dueAt:null}]}`);
  const html=app.run('reminderSettingsMarkup({installed:true,config:{}})');assert.match(html,/Результат неизвестен/);assert.match(html,/выключен на сервере/);assert.match(html,/&lt;bad&gt;/);
});
test('late settings response after logout cannot change the next account state',async()=>{
  const app=harness();let release;app.context.apiRequest=()=>new Promise(resolve=>release=resolve);app.context.form=form();const promise=app.run('reminderUiAction(form)');app.context.sessionGeneration=2;app.context.authState.token='other';release({});await promise;assert.equal(app.context.state.plugins[0].config.firstText,undefined);
});
test('installed reminder exposes a settings button and reaches the form without leaving the plugin page',()=>{
  const app=harness();const focus=[],scroll=[];
  app.context.canManagePluginCatalog=()=>false;
  app.context.formatPluginDescription=()=>'';
  app.context.location={hash:'#plugins/zetslay.confirm-reminder'};
  const panel={scrollIntoView:options=>scroll.push(options),querySelector:()=>({focus:options=>focus.push(options)})};
  app.context.document.querySelector=selector=>selector==='[data-reminder-panel]'?panel:null;
  vm.runInContext(readFileSync(new URL('./plugin-page.js',import.meta.url),'utf8'),app.context);
  const html=app.run("pluginPageMarkup({id:'zetslay.confirm-reminder',name:'Confirm Reminder',installed:true,active:true,config:{}})");
  assert.match(html,/data-reminder-open-settings>.*Настройки напоминаний/);
  assert.match(html,/data-reminder-panel/);
  app.listeners.click({target:{closest:selector=>selector==='[data-reminder-open-settings]'?{}:null}});
  assert.equal(app.context.location.hash,'#plugins/zetslay.confirm-reminder');
  assert.equal(scroll.length,1);assert.equal(focus.length,1);assert.equal(focus[0].preventScroll,true);
  assert.doesNotMatch(app.run("pluginPageMarkup({id:'zetslay.confirm-reminder',name:'Confirm Reminder',installed:false})"),/data-reminder-open-settings/);
});
