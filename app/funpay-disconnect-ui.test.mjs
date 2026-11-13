import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./funpay-disconnect-ui.js',import.meta.url),'utf8');
function fixture(extra={}){
 let reloads=0;
 const context=vm.createContext({AbortSignal,authState:{user:{id:'owner'},token:'session'},sessionGeneration:1,connectionBusy:false,connectionLoading:false,connectionLoadFailed:false,connectionResetTarget:null,
  state:{onboarding:{funPay:{store:{id:'42',displayName:'<unsafe>'}}}},document:undefined,window:{location:{reload(){reloads++;}}},escapeHtml:v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),...extra});
 vm.runInContext(source,context);
 return {run:s=>vm.runInContext(s,context),reloads:()=>reloads,context};
}
test('unlink is absent for an unconnected shop and confirmation names the shop safely',()=>{
 const f=fixture();assert.match(f.run('funpayDisconnectMarkup()'),/Отвязать аккаунт FunPay/);
 f.run('funpayDisconnectUi.confirm=true');const html=f.run('funpayDisconnectMarkup()');
 assert.match(html,/&lt;unsafe>/);assert.doesNotMatch(html,/<unsafe>/);assert.match(html,/Баланс, подписка, купленные плагины, Telegram-бот/);
 assert.match(html,/data-funpay-disconnect="confirm" disabled/);assert.match(html,/склад не перенесутся/);
 f.run('state.onboarding.funPay.store=null');assert.equal(f.run('funpayDisconnectMarkup()'),'');
});
test('only checked explicit confirmation sends one bounded authenticated unlink and reloads all stale views',async()=>{
 const calls=[],f=fixture({apiRequest:async(path,options)=>{calls.push({path,options});return {funPay:{store:null,credentialConfigured:false,proxyConfigured:false}};}});
 await f.run('funpayDisconnectConfirm()');assert.equal(calls.length,0);
 f.run('funpayDisconnectMarkup();funpayDisconnectUi.confirm=true;funpayDisconnectUi.ack=true');
 await f.run('funpayDisconnectConfirm()');assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/v1/onboarding/disconnect-store');assert.equal(calls[0].options.authenticated,true);assert.equal(calls[0].options.body.storeId,'42');assert.equal(calls[0].options.body.confirmed,true);assert.ok(calls[0].options.signal);assert.equal(f.reloads(),1);
});
test('late unlink response cannot overwrite the new login or reload another account',async()=>{
 let finish;const f=fixture({apiRequest:()=>new Promise(r=>finish=r)});
 f.run('funpayDisconnectMarkup();funpayDisconnectUi.confirm=true;funpayDisconnectUi.ack=true');
 const pending=f.run('funpayDisconnectConfirm()');f.run("authState.token='other';sessionGeneration=2;state.onboarding={funPay:{store:{id:'99'}}}");
 finish({funPay:{store:null,credentialConfigured:false}});await pending;assert.equal(f.reloads(),0);assert.equal(f.run('state.onboarding.funPay.store.id'),'99');
});
test('uncertain response is never replayed automatically and does not claim a successful unlink',async()=>{
 let calls=0;const f=fixture({apiRequest:async()=>{calls++;throw Error('network');}});
 f.run('funpayDisconnectMarkup();funpayDisconnectUi.confirm=true;funpayDisconnectUi.ack=true');await f.run('funpayDisconnectConfirm()');
 assert.equal(calls,1);assert.equal(f.reloads(),0);assert.equal(f.run('state.onboarding.funPay.store.id'),'42');assert.match(f.run('funpayDisconnectUi.error'),/Обновите страницу/);assert.equal(f.run('connectionBusy'),false);
});
test('step-up and unresolved operations explain next steps rather than resetting data',async()=>{
 for(const [code,pattern] of [['MFA_STEP_UP',/2FA/],['STORE_DISCONNECT_UNRESOLVED',/активная аренда/],['STORE_DISCONNECT_BUSY',/Дождитесь/],['HTTP_404',/недоступна/]]){
  const f=fixture({apiRequest:async()=>{throw Object.assign(Error('TECHNICAL'),{code});}});
  f.run('funpayDisconnectMarkup();funpayDisconnectUi.confirm=true;funpayDisconnectUi.ack=true');await f.run('funpayDisconnectConfirm()');assert.match(f.run('funpayDisconnectUi.error'),pattern);assert.equal(f.reloads(),0);
 }
});
