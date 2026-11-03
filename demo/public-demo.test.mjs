import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app/cabinet-demo.js',import.meta.url),'utf8');
test('public demo never reads an existing account and changes only isolated teaching state',()=>{
 const handlers={},renders=[],root={hasAttribute:key=>key==='data-public-demo'},context={Date,Intl,icon:()=>'',document:{querySelector:()=>root,addEventListener:(name,fn)=>handlers[name]=fn,dispatchEvent:event=>renders.push(event)},CustomEvent:class{constructor(type,options){Object.assign(this,{type,...options});}},setView:()=>{},fetch:()=>{throw Error('No network');}};
 Object.defineProperty(context,'authState',{get(){throw Error('Public demo must not read a private session');}});vm.createContext(context);vm.runInContext(source,context);
 const run=expression=>vm.runInContext(expression,context);assert.equal(run('demoScope()'),'public-demo');
 for(const view of ['dashboard','orders','messages','lots','finance'])assert.ok(run('cabinetDemoBody('+JSON.stringify(view)+')').length>100);
 const element={id:'lot',dataset:{demoLot:'0'},disabled:false,hasAttribute:key=>key==='data-demo-lot',closest:()=>root};handlers.click({target:{closest:()=>element}});assert.equal(run('cabinetDemoData().paused[0]'),0);assert.equal(renders[0].type,'zetslay:demo-render');
 run('cabinetDemoData().drafts[0]="<script>unsafe</script>"');handlers.submit({target:{closest:()=>({closest:()=>root})},preventDefault(){}});assert.match(run('cabinetDemoMessages()'),/&lt;script&gt;/);run('cabinetDemoReset()');assert.equal(run('cabinetDemoData().sent[0].length'),0);
});
test('public entry does not load sessions, analytics or authenticated application scripts',()=>{
 const html=readFileSync(new URL('./index.html',import.meta.url),'utf8'),js=readFileSync(new URL('./demo.js',import.meta.url),'utf8');
 assert.doesNotMatch(html,/session-client|app\/app\.js|api-base|data-auth-form/);assert.doesNotMatch(js,/fetch\(|apiRequest\(|localStorage|sessionStorage/);assert.match(html,/noindex,follow/);
});
