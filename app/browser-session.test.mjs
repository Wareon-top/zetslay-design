import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const pick=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const authCode=pick('async function apiRequest(', '\nfunction accountInitials(')+pick('async function acceptSession(', '\nasync function submitAuth(')+pick('async function restoreSession()', '\nasync function initializeAuthFlow(');
const session=()=>({token:'restored',user:{id:'alice'},workspace:{id:'shop'},expiresAt:new Date(Date.now()+604800000).toISOString()});
function fixture({legacy='',restore=async()=>session()}={}){
 const calls=[],events=new Map(),sessionClient={restore,migrate:async(base,token)=>{calls.push(['migrate',token]);return restore();},clearLegacy:()=>calls.push(['clearLegacy']),notify:type=>calls.push(['notify',type]),subscribe:fn=>events.set('auth',fn)};
 const c=vm.createContext({console,Date,AbortSignal,fetch:async()=>({ok:true,json:async()=>({data:{loggedOut:true}})}),API_BASE_URL:'https://api.zetslay.pro',authState:{token:legacy,user:null,workspace:null},sessionGeneration:0,window:{ZetSlaySession:sessionClient},resetAccountData:()=>calls.push(['reset']),renderAuthState:()=>calls.push(['render']),setAuthModal:value=>calls.push(['modal',value]),loadAccountData:async()=>calls.push(['load']),showToast:(...values)=>calls.push(['toast',...values]),setView:view=>calls.push(['view',view]),clearSession(){c.sessionGeneration++;Object.assign(c.authState,{token:'',user:null,workspace:null});calls.push(['clear']);}});
 vm.runInContext(authCode,c);return {c,calls,events,run:s=>vm.runInContext(s,c)};
}
test('a new tab with no stored token restores the cookie and never asks for a password',async()=>{
 const f=fixture();await f.run('restoreSession()');assert.equal(f.c.authState.user.id,'alice');assert.equal(f.c.authState.token,'restored');assert.ok(f.calls.some(x=>x[0]==='load'));assert.ok(!f.calls.some(x=>x[0]==='modal'&&x[1]));
});
test('legacy tab migrates existing token; invalid legacy falls back to a newer valid cookie',async()=>{
 const f=fixture({legacy:'old'});await f.run('restoreSession()');assert.ok(f.calls.some(x=>x[0]==='migrate'&&x[1]==='old'));
 const g=fixture({legacy:'revoked'});g.c.window.ZetSlaySession.migrate=async()=>{throw {code:'INVALID_SESSION'};};await g.run('restoreSession()');assert.equal(g.c.authState.user.id,'alice');assert.ok(!g.calls.some(x=>x[0]==='clear'));
});
test('temporary network errors do not erase the existing session or declare it expired',async()=>{
 const f=fixture({legacy:'old',restore:async()=>{throw Error('network');}});await f.run('restoreSession()');assert.equal(f.c.authState.token,'old');assert.ok(!f.calls.some(x=>x[0]==='clearLegacy'||x[0]==='clear'));assert.ok(f.calls.some(x=>x[0]==='toast'&&x[1].includes('повторно вводить пароль пока не нужно')));
});
test('expired, malformed and revoked sessions cannot mount account data; late restore cannot overwrite another login',async()=>{
 for(const expiresAt of ['bad',new Date(Date.now()-1000).toISOString()]) {const f=fixture({restore:async()=>({...session(),expiresAt})});await f.run('restoreSession()');assert.equal(f.c.authState.user,null);assert.ok(f.calls.some(x=>x[0]==='clear'));}
 const f=fixture({restore:async()=>{throw {code:'INVALID_SESSION'};}});await f.run('restoreSession()');assert.ok(f.calls.some(x=>x[0]==='clear'));
 let resolve;const g=fixture({restore:()=>new Promise(r=>resolve=r)});const pending=g.run('restoreSession()');g.c.sessionGeneration++;g.c.authState={token:'bob',user:{id:'bob'}};resolve(session());await pending;assert.equal(g.c.authState.user.id,'bob');
});
test('acceptance keeps new token in memory, clears old storage and broadcasts only a public event',async()=>{
 const f=fixture();f.c.session=session();await f.run('acceptSession(session)');assert.equal(f.c.authState.token,'restored');assert.ok(f.calls.some(x=>x[0]==='notify'&&x[1]==='login'));assert.ok(!source.includes("sessionStorage.setItem('zetslay_session'"));
});
test('logout is bounded, duplicate guarded and clears tabs only after server confirmation; failed logout is retryable',async()=>{
 const f=fixture();f.c.authState={token:'alice',user:{id:'alice'}};let resolve,calls=0;f.c.fetch=()=>{calls++;return new Promise(r=>resolve=r);};f.c.button={disabled:false};const pending=f.run('logoutSession(button)');await f.run('logoutSession(button)');assert.equal(calls,1);assert.equal(f.c.button.disabled,true);assert.equal(f.c.authState.token,'alice');resolve({ok:true,json:async()=>({data:{loggedOut:true}})});await pending;assert.equal(f.c.authState.token,'');assert.ok(f.calls.some(x=>x[0]==='notify'&&x[1]==='logout'));assert.equal(f.c.button.disabled,false);
 const g=fixture();g.c.authState={token:'alice',user:{id:'alice'}};g.c.fetch=async()=>{throw Error('offline')};await g.run('logoutSession()');assert.equal(g.c.authState.token,'alice');assert.ok(!g.calls.some(x=>x[0]==='notify'));assert.equal(g.run('logoutBusy'),false);
});
test('cookies are included only on authentication calls; old 401 cannot clear a newer account',async()=>{
 const f=fixture(),requests=[];f.c.authState.token='alice';f.c.fetch=async(url,opts)=>{requests.push(opts);return {ok:true,json:async()=>({data:{}})}};await f.run("apiRequest('/api/v1/auth/login',{method:'POST',body:{}})");await f.run("apiRequest('/api/v1/me',{authenticated:true})");assert.equal(requests[0].credentials,'include');assert.equal(requests[1].credentials,'omit');
 let resolve;f.c.fetch=()=>new Promise(r=>resolve=r);const pending=f.run("apiRequest('/api/v1/me',{authenticated:true})");f.c.authState.token='bob';resolve({ok:false,status:401,json:async()=>({error:{code:'INVALID_SESSION'}})});await assert.rejects(pending);assert.equal(f.c.authState.token,'bob');
});
