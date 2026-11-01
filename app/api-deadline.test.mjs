import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./app.js',import.meta.url),'utf8');const code=source.slice(source.indexOf('async function apiRequest('),source.indexOf('\nfunction accountInitials'));
function fixture(){const requests=[],budgets=[],controllers=[],context=vm.createContext({API_BASE_URL:'https://api.zetslay.test',authState:{token:'current'},clearSession(){},AbortSignal:{timeout:ms=>{budgets.push(ms);const c=new AbortController();controllers.push(c);return c.signal;}},fetch:async(url,options)=>{requests.push({url,options});return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));}});vm.runInContext(code,context);return {context,requests,budgets,controllers,run:text=>vm.runInContext(text,context)};}
test('default read timeout releases the request and offers refresh without exposing payloads',async()=>{const f=fixture();const p=f.run("apiRequest('/api/v1/plugins/kosell-rent/status',{authenticated:true})");assert.deepEqual(f.budgets,[35000]);f.controllers[0].abort(new DOMException('Timeout','TimeoutError'));await assert.rejects(p,{code:'REQUEST_TIMEOUT'});assert.equal(f.requests.length,1);});
test('a timed-out mutation reports an uncertain result and is never automatically retried',async()=>{const f=fixture();const p=f.run("apiRequest('/api/v1/plugins/kosell-rent/confirm',{method:'POST',body:{token:'PRIVATE'}})");assert.deepEqual(f.budgets,[120000]);f.controllers[0].abort(new DOMException('Timeout','TimeoutError'));await assert.rejects(p,e=>e.code==='REQUEST_RESULT_UNKNOWN'&&!e.message.includes('PRIVATE'));assert.equal(f.requests.length,1);});
test('an explicit sync or logout budget is preserved, cancellation stays distinguishable',async()=>{const f=fixture(),controller=new AbortController();f.context.signal=controller.signal;const p=f.run("apiRequest('/api/v1/onboarding/content',{signal})");assert.deepEqual(f.budgets,[]);assert.equal(f.requests[0].options.signal,controller.signal);controller.abort(new DOMException('Cancelled','AbortError'));await assert.rejects(p,{name:'AbortError'});});
test('authentication has a shorter deadline and tells a registering user how to recover',async()=>{
 const f=fixture();const p=f.run("apiRequest('/api/v1/auth/register',{method:'POST',body:{email:'fake@example.invalid'}})");assert.deepEqual(f.budgets,[20000]);f.controllers[0].abort(new DOMException('Timeout','TimeoutError'));
 await assert.rejects(p,e=>e.code==='REQUEST_TIMEOUT'&&e.message.includes('попробуйте войти'));assert.equal(f.requests.length,1);
});
test('malformed success is rejected and a malformed write remains an unknown result without a retry',async()=>{
 const f=fixture();f.context.fetch=async()=>({ok:true,json:async()=>({})});await assert.rejects(f.run("apiRequest('/api/v1/onboarding')"),{code:'INVALID_API_RESPONSE'});
 await assert.rejects(f.run("apiRequest('/api/v1/payments/purchase',{method:'POST',body:{}})"),{code:'REQUEST_RESULT_UNKNOWN'});
 f.context.fetch=async()=>({ok:false,status:502,json:async()=>null});await assert.rejects(f.run("apiRequest('/api/v1/onboarding')"),{code:'HTTP_502'});
});
