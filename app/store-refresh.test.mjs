import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./store-refresh.js',import.meta.url),'utf8');
test('visible connected cabinet refreshes at most once per minute and skips hidden or signed-out sessions',async()=>{
 let time=0,calls=0,release;const handlers={};
 const context=vm.createContext({Date:{now:()=>time},document:{hidden:false,addEventListener:(name,fn)=>handlers[name]=fn},window:{setInterval:fn=>handlers.tick=fn},
 authState:{user:{}},selectedStore:()=>({status:'connected_read_only'}),syncStoreContent:async()=>{calls++;await new Promise(r=>release=r);}});
 vm.runInContext(source,context);time=60000;
 const pending=vm.runInContext('refreshVisibleStore()',context);await vm.runInContext('refreshVisibleStore()',context);assert.equal(calls,1);release();await pending;
 await handlers.visibilitychange();assert.equal(calls,1);
 time=120000;context.document.hidden=true;await handlers.tick();assert.equal(calls,1);
 context.document.hidden=false;context.authState.user=null;await handlers.tick();assert.equal(calls,1);
 context.authState.user={};const next=vm.runInContext('refreshVisibleStore()',context);assert.equal(calls,2);release();await next;
});
