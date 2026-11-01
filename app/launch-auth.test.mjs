import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const pick=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const code=pick('function setAuthMode(', '\nfunction setAuthModal(')+pick('async function submitAuth(', '\nasync function resendVerification(')+pick('let telegramLoginTimer =', '\nasync function restoreSession(');
function fixture(){
 const timers=new Map(),calls=[],accepted=[],opened=[],message={className:'',textContent:'',classList:{add(){}}},status={hidden:true},link={},button={disabled:false},password={},confirmation={},row={hidden:true};let id=0;
 const c=vm.createContext({console,URL,AbortSignal,Date,authState:{user:null,token:'',mode:'login'},authAttemptRevision:0,sessionGeneration:1,registrationEmail:'',setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id),document:{querySelector:s=>({'[data-auth-message]':message,'[data-telegram-login-status]':status,'[data-telegram-login-link]':link,'[data-auth-confirm-row]':row,'[data-auth-form] input[name="password"]':password,'[data-auth-form] input[name="passwordConfirm"]':confirmation})[s]||null,querySelectorAll:()=>[]},window:{open:url=>opened.push(url)},humanError:e=>e.message,showToast(){},acceptSession:async session=>accepted.push(session),FormData:class{constructor(form){return new Map(Object.entries(form.values));}},apiRequest:async(path,opts)=>{calls.push([path,opts]);return path.endsWith('/start')?{url:'https://t.me/zetslay_bot?start=fixture',ticket:'fixture'}:{status:'pending'};}});
 vm.runInContext(code,c);
 c.byId=()=>null;
 const run=s=>vm.runInContext(s,c),fire=()=>{const [id,fn]=[...timers][0];timers.delete(id);return fn();};
 return {c,run,fire,timers,calls,accepted,opened,message,status,button,row,confirmation};
}
test('Telegram polls do not overlap while the previous response is pending',async()=>{
 const f=fixture();let finish;const request=f.c.apiRequest;f.c.apiRequest=(p,o)=>p.includes('/poll')?new Promise(r=>finish=r):request(p,o);f.c.button=f.button;
 await f.run('startTelegramLogin(button)');assert.equal(f.timers.size,1);const pending=f.fire();assert.equal(f.timers.size,0);
 finish({status:'pending'});await pending;assert.equal(f.timers.size,1);f.run('stopTelegramLoginPolling()');assert.equal(f.timers.size,0);
});
test('Telegram failure stops the waiting state, shows recovery, and the button can start again',async()=>{
 const f=fixture();const request=f.c.apiRequest;f.c.apiRequest=(p,o)=>p.includes('/poll')?Promise.reject(Error('network')):request(p,o);f.c.button=f.button;
 await f.run('startTelegramLogin(button)');await f.fire();assert.equal(f.status.hidden,true);assert.match(f.message.textContent,/Продолжить через Telegram/);assert.equal(f.timers.size,0);assert.equal(f.button.disabled,false);
 await f.run('startTelegramLogin(button)');assert.equal(f.status.hidden,false);assert.equal(f.timers.size,1);
});
test('cancelled or superseded Telegram responses cannot sign in or reopen a stale link',async()=>{
 const f=fixture();let finish;f.c.apiRequest=()=>new Promise(r=>finish=r);f.c.button=f.button;
 const start=f.run('startTelegramLogin(button)');f.run('setAuthMode("register")');finish({url:'https://t.me/zetslay_bot',ticket:'old'});await start;assert.equal(f.opened.length,0);
 f.c.apiRequest=async()=>({url:'https://t.me/zetslay_bot',ticket:'new'});await f.run('startTelegramLogin(button)');f.c.apiRequest=()=>new Promise(r=>finish=r);const poll=f.fire();f.run('sessionGeneration++;stopTelegramLoginPolling()');finish({status:'confirmed',token:'stale',user:{id:'previous'}});await poll;assert.equal(f.accepted.length,0);
});
test('registration asks for a matching confirmation, and never sends that extra field to the API',async()=>{
 const f=fixture(),submit={disabled:false},form={values:{email:'seller@example.invalid',password:'correct-password',passwordConfirm:'different'},querySelector:s=>s==='[data-auth-message]'?f.message:s==='[data-auth-submit]'?submit:{hidden:true},reportValidity:()=>true,reset(){}};f.c.form=form;
 f.run('setAuthMode("register")');assert.equal(f.row.hidden,false);assert.equal(f.confirmation.disabled,false);await f.run('submitAuth(form)');assert.match(f.message.textContent,/не совпадают/);assert.equal(f.calls.length,0);
 form.values.passwordConfirm=form.values.password;const calls=[];f.c.apiRequest=async(p,o)=>{calls.push([p,o.body]);return p.endsWith('/register')?{verificationRequired:false}:{token:'new',user:{id:'new'}};};await f.run('submitAuth(form)');assert.equal(calls.length,2);assert.ok(calls.every(([,body])=>!Object.hasOwn(body,'passwordConfirm')));
 f.run('setAuthMode("login")');assert.equal(f.row.hidden,true);assert.equal(f.confirmation.disabled,true);
});
test('a late email login cannot overwrite a different accepted session',async()=>{
 const f=fixture();let finish;f.c.form={values:{email:'seller@example.invalid',password:'correct-password'},querySelector:s=>s==='[data-auth-message]'?f.message:{disabled:false},reportValidity:()=>true,reset(){}};f.c.apiRequest=()=>new Promise(r=>finish=r);
 const pending=f.run('submitAuth(form)');f.run('sessionGeneration++;authState.user={id:"newer"}');finish({token:'old',user:{id:'old'}});await pending;assert.equal(f.accepted.length,0);
});
test('a created account with failed automatic login remains recoverable with its email',async()=>{
 const f=fixture(),email={value:''},submit={disabled:false},form={values:{email:'seller@example.invalid',password:'correct-password',passwordConfirm:'correct-password'},querySelector:s=>s==='[data-auth-message]'?f.message:s==='[data-auth-submit]'?submit:s==='input[name="email"]'?email:{hidden:true},reportValidity:()=>true,reset(){}};
 f.c.form=form;f.run('setAuthMode("register")');f.c.apiRequest=async p=>{if(p.endsWith('/register'))return {verificationRequired:false};throw Error('offline');};
 await f.run('submitAuth(form)');assert.equal(f.c.authState.mode,'login');assert.equal(email.value,'seller@example.invalid');assert.match(f.message.textContent,/Аккаунт создан, но автоматический вход/);assert.equal(submit.disabled,false);
});
test('cancelled Telegram MFA restores the visible retry path',async()=>{
 const f=fixture();f.c.button=f.button;const request=f.c.apiRequest;f.c.apiRequest=(p,o)=>p.includes('/poll')?Promise.resolve({status:'confirmed',mfaRequired:true}):request(p,o);f.c.acceptSession=async()=>{throw Error('cancelled MFA');};
 await f.run('startTelegramLogin(button)');await f.fire();assert.equal(f.status.hidden,true);assert.match(f.message.textContent,/Продолжить через Telegram/);assert.equal(f.timers.size,0);
});
