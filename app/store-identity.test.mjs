import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('./store-identity.js',import.meta.url),'utf8');
function run(code){const context=vm.createContext({URL,document:{addEventListener(){}},overviewEscape:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))});vm.runInContext(source,context);return vm.runInContext(code,context);}
test('store avatar accepts only trusted HTTPS hosts without embedded credentials',()=>{
 for(const value of ['https://evil.test/a.jpg','https://funpay.com.evil.test/a','https://u:p@funpay.com/a','http://s.funpay.com/a','https://s.funpay.com:8443/a','javascript:alert(1)'])assert.equal(run(`safeStoreAvatar(${JSON.stringify(value)})`),'');
 assert.equal(run("safeStoreAvatar('https://s.funpay.com/s/avatar/a.jpg')"),'https://s.funpay.com/s/avatar/a.jpg');
});
test('matching snapshot supplies avatar; different account and signed-out state cannot leak it',()=>{
 const store="{id:'42',displayName:'Seller',status:'connected_read_only',proxyConfigured:true}";
 const content="{profile:{id:'42',avatarUrl:'https://s.funpay.com/s/avatar/a.jpg'},observedAt:'2026-10-04T12:00:00Z'}";
 assert.equal(run(`storeIdentityModel(${store},${content},[],true).avatar`),'https://s.funpay.com/s/avatar/a.jpg');
 assert.equal(run(`storeIdentityModel(${store},{profile:{id:'99',avatarUrl:'https://s.funpay.com/other'}},[],true).avatar`),'');
 assert.equal(run(`storeIdentityModel(${store},${content},[],false).avatar`),'');
 assert.equal(run(`storeIdentityModel(${store},${content},[],false).connected`),false);
});
test('green status requires verified connection, optional image preserves safe initials',()=>{
 assert.equal(run("storeIdentityModel({id:'42',status:'attention'},null,[],true).connected"),false);
 const html=run("storeIdentityAvatar({connected:false,initials:'<S',name:'Seller',avatar:''})");assert.ok(!html.includes('is-connected'));assert.match(html,/&lt;S/);assert.match(html,/store-portrait__fallback/);
 assert.equal(run("storeIdentityModel({id:'42'},null,[{installed:true,active:true},{installed:true,active:false},{planned:true,installed:true,active:true}],true).active"),1);
});
