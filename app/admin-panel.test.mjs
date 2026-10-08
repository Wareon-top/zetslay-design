import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./admin-panel.js',import.meta.url),'utf8');
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('./admin-panel.css',import.meta.url),'utf8');
function harness() {
 const root={innerHTML:''},nav={hidden:true},listeners={},calls=[];
 const c=vm.createContext({authState:{token:'owner-token',user:{telegramUserId:'5062414502'}},sessionGeneration:1,state:{plugins:[]},location:{hash:'#admin'},URLSearchParams,Intl,Date,
  escapeHtml:v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]),humanError:e=>e.message,setView:v=>calls.push(v),
  document:{querySelector:()=>root,querySelectorAll:()=>[nav],addEventListener:(e,fn)=>listeners[e]=fn},apiRequest:async()=>({users:[],total:0,offset:0,nextOffset:null,registrations:[],plugins:[],plans:[]})});
 vm.runInContext(source,c);return {c,root,nav,listeners,calls,run:s=>vm.runInContext(s,c)};
}
test('nav starts hidden; only the existing owner identity can request the admin API',async()=>{
 assert.match(html,/data-admin-nav[^>]*hidden/);assert.match(css,/\[data-admin-nav\]\[hidden\]/);
 const h=harness();h.run('adminAccess()');assert.equal(h.nav.hidden,false);
 for(const id of ['other',5062414502]){h.c.authState.user={telegramUserId:id,role:'admin'};assert.equal(h.run('adminAllowed()'),false);h.run('adminAccess()');assert.equal(h.nav.hidden,true);}
 assert.equal(h.calls.at(-1),'dashboard');
});
test('stale owner requests cannot display private account data after logout or account switch',async()=>{
 const h=harness();let resolve;h.c.apiRequest=()=>new Promise(r=>resolve=r);const p=h.run("adminUi.tab='users';adminLoad()");
 h.run("authState.token='other';authState.user={telegramUserId:'123'};sessionGeneration++;adminReset()");resolve({users:[{id:'PRIVATE_USER'}],total:1});await p;
 assert.equal(h.run('adminUi.list'),null);assert.doesNotMatch(h.root.innerHTML,/PRIVATE_USER/);assert.equal(h.nav.hidden,true);
});
test('new request supersedes old pagination result and preserves newest filters',async()=>{
 const h=harness(),resolvers=[];h.c.apiRequest=()=>new Promise(r=>resolvers.push(r));
 const a=h.run("adminUi.tab='users';adminLoad()"),b=h.run("adminUi.filters.query='latest';adminLoad()");
 resolvers[1]({users:[],total:2,offset:0,nextOffset:null});await b;resolvers[0]({users:[],total:1,offset:0,nextOffset:null});await a;
 assert.equal(h.run('adminUi.list.total'),2);assert.equal(h.run('adminUi.filters.query'),'latest');
});
test('provider/account text is escaped and subscriptions do not fabricate expiry or payments',()=>{
 const h=harness();h.c.row={id:'usr_test',email:'<img src=x onerror=alert(1)>',createdAt:null,workspace:{id:'w',plan:{id:'pro_demo',active:true}},store:null,connectionStatus:'not_connected',sync:{status:'retrying',code:'PROXY_TIMEOUT'},enabledPlugins:1,installedPlugins:2};
 const table=h.run('adminTableMarkup({users:[row],total:1,offset:0,nextOffset:null})');assert.match(table,/&lt;img/);assert.doesNotMatch(table,/<img/);
 const detail=h.run('adminDetailMarkup({user:row,plugins:[],events:[]})');assert.match(detail,/Срок пока не учитывается/);assert.match(detail,/Демо/);assert.match(detail,/PROXY_TIMEOUT/);
});
test('problem tab requests combined connection and sync failures, and denies secret persistence',async()=>{
 const h=harness(),paths=[];h.c.apiRequest=async path=>{paths.push(path);return {users:[],total:0,offset:0,nextOffset:null};};
 await h.run("adminUi.tab='attention';adminLoad()");assert.match(paths[0],/attention=needed/);assert.doesNotMatch(source,/localStorage|sessionStorage/);
});
test('integration resets admin data, binds route and loads module before app',()=>{
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');assert.match(app,/admin: 'Админ-панель'/);assert.match(app,/typeof adminReset/);assert.match(app,/adminRoute\(resolvedView\)/);assert.ok(html.indexOf('src="admin-panel.js')<html.indexOf('src="app.js'));
});
