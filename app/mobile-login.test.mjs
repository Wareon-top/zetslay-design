import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./account-security.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness({request,credential}={}){
 const nodes=new Map(),dialogs=[],calls=[],revoked=[];let now=100000;
 class Node{
  constructor(name){this.name=name;this.handlers={};this.value='';this.disabled=false;this.focuses=0;}
  addEventListener(kind,handler){(this.handlers[kind]||=[]).push(handler);}
  hasAttribute(name){return name==='data-mfa-cancel'&&this.name==='cancel';}
  focus(){this.focuses++;}
  click(){return Promise.all((this.handlers.click||[]).map(fn=>fn({preventDefault(){}})));}
  submit(){return Promise.all((this.handlers.submit||[]).map(fn=>fn({preventDefault(){}})));}
  close(){this.closed=true;}remove(){this.removed=true;}showModal(){this.open=true;}
 }
 for(const name of ['field','button','status','error','cancel','submit','form','code'])nodes.set(name,new Node(name));
 const selectors={'[name="code"]':'field','[data-mfa-passkey]':'button','[data-mfa-status]':'status','[data-mfa-error]':'error','[data-mfa-cancel]':'cancel','[data-mfa-code]':'code',form:'form'};
 const doc={createElement(){const dialog=new Node('dialog');dialog.querySelector=selector=>{
   if(selector==='[data-mfa-passkey]'&&!dialog.innerHTML.includes('data-mfa-passkey'))return null;
   return nodes.get(selectors[selector]);
  };dialog.querySelectorAll=()=>[nodes.get('button'),nodes.get('submit'),nodes.get('cancel')];dialogs.push(dialog);return dialog;},body:{append(){}},addEventListener(){}};
 const credentialValue=()=>({id:'AQID',rawId:Uint8Array.of(1,2,3).buffer,type:'public-key',response:{clientDataJSON:Uint8Array.of(4).buffer,authenticatorData:Uint8Array.of(5).buffer,signature:Uint8Array.of(6).buffer,userHandle:null}});
 const context=vm.createContext({document:doc,window:{isSecureContext:true},PublicKeyCredential:function(){},navigator:{credentials:{get:options=>{calls.push({kind:'credential',options});return credential?credential(options):Promise.resolve(credentialValue());}}},Date:class extends Date{static now(){return now;}},Uint8Array,AbortController,AbortSignal,atob,btoa,setTimeout,clearTimeout,console,humanError:e=>e.message||e.code,API_BASE_URL:'https://api.example.test',fetch:async(url,options)=>revoked.push({url,options}),apiRequest:async(path,options)=>{
  calls.push({kind:'request',path,options});
  if(request)return request(path,options);
  return path.endsWith('/options')?{challenge:'AQID',rpId:'zetslay.pro',userVerification:'required',allowCredentials:[{id:'AQID',type:'public-key',transports:['internal']}]}:{token:'verified-session'};
 }});
 vm.runInContext(source,context);
 const pending=vm.runInContext("challengeMfa({passkeyAvailable:true,totpAvailable:false,challengeToken:'opaque-login-challenge'})",context);pending.catch(()=>{});
 return {context,nodes,dialogs,calls,revoked,pending,advance:ms=>now+=ms,cancel:()=>nodes.get('cancel').click(),run:text=>vm.runInContext(text,context)};
}
test('iPhone without userActivation starts WebAuthn directly in the tap after options were prepared',async()=>{
 const h=harness();await flush();assert.equal(h.calls.filter(c=>c.kind==='credential').length,0);
 const clicked=h.nodes.get('button').click();
 assert.equal(h.calls.filter(c=>c.kind==='credential').length,1,'get() must run before the click returns a promise');
 assert.equal(h.calls.filter(c=>c.path?.endsWith('/options')).length,1);
 await clicked;assert.equal((await h.pending).token,'verified-session');assert.equal(h.dialogs.length,1);assert.equal(h.nodes.get('field').focuses,0);
 const call=h.calls.find(c=>c.kind==='credential');assert.equal(call.options.publicKey.userVerification,'required');assert.equal(call.options.publicKey.rpId,'zetslay.pro');assert.equal(call.options.publicKey.allowCredentials[0].transports,undefined);assert.deepEqual([...call.options.publicKey.allowCredentials[0].id],[1,2,3]);
 const verification=h.calls.find(c=>c.path==='/api/v1/auth/mfa');assert.equal(verification.options.body.challengeToken,'opaque-login-challenge');assert.equal(verification.options.body.passkeyResponse.id,'AQID');assert.equal(verification.options.body.code,undefined);
});
test('failed option preparation recovers on a tap without opening the authenticator after async work',async()=>{
 let count=0;const h=harness({request:async path=>{if(path.endsWith('/options')){if(++count===1)throw Error('offline');return {challenge:'AQID'};}return {token:'verified'};}});
 await flush();assert.match(h.nodes.get('error').textContent,/offline/);
 await h.nodes.get('button').click();assert.equal(h.calls.filter(c=>c.kind==='credential').length,0);
 await h.nodes.get('button').click();assert.equal((await h.pending).token,'verified');
});
test('expired prepared options are refreshed, with a new tap required before WebAuthn',async()=>{
 const h=harness();await flush();h.advance(91000);
 await h.nodes.get('button').click();assert.equal(h.calls.filter(c=>c.kind==='credential').length,0);assert.equal(h.calls.filter(c=>c.path?.endsWith('/options')).length,2);
 await h.nodes.get('button').click();await h.pending;
});
test('cancelled device confirmation does not post a proof, autofocus the keyboard or reuse old options',async()=>{
 const h=harness({credential:async()=>{const e=Error('cancelled');e.name='NotAllowedError';throw e;}});await flush();
 await h.nodes.get('button').click();await flush();
 assert.equal(h.calls.filter(c=>c.path==='/api/v1/auth/mfa').length,0);assert.equal(h.calls.filter(c=>c.path?.endsWith('/options')).length,2);assert.equal(h.nodes.get('field').focuses,0);assert.match(h.nodes.get('error').textContent,/Safari/);
 await h.cancel();await assert.rejects(h.pending,/Вход отменён/);
});
test('closing the dialog aborts a pending option request and cannot launch authentication later',async()=>{
 let finish,signal;const h=harness({request:async(path,options)=>{signal=options.signal;return new Promise(resolve=>finish=resolve);}});
 await h.cancel();assert.equal(signal.aborted,true);finish({challenge:'AQID'});await flush();assert.equal(h.calls.filter(c=>c.kind==='credential').length,0);assert.equal(h.dialogs[0].removed,true);await assert.rejects(h.pending);
});
test('closing an open authenticator aborts it and cannot send a late credential to the server',async()=>{
 let finish,signal;const h=harness({credential:options=>{signal=options.signal;return new Promise(resolve=>finish=resolve);}});await flush();const clicked=h.nodes.get('button').click();
 await h.cancel();assert.equal(signal.aborted,true);finish({id:'AQID',rawId:Uint8Array.of(1,2,3).buffer,type:'public-key',response:{clientDataJSON:Uint8Array.of(4).buffer,authenticatorData:Uint8Array.of(5).buffer,signature:Uint8Array.of(6).buffer}});
 await clicked;assert.equal(h.calls.filter(c=>c.path==='/api/v1/auth/mfa').length,0);await assert.rejects(h.pending);
});
test('recovery-code path still requires server verification and never calls the authenticator',async()=>{
 const h=harness();await flush();h.nodes.get('field').value='saved-recovery-code';await h.nodes.get('form').submit();await flush();
 assert.equal((await h.pending).token,'verified-session');assert.equal(h.calls.filter(c=>c.kind==='credential').length,0);assert.equal(h.calls.find(c=>c.path==='/api/v1/auth/mfa').options.body.code,'saved-recovery-code');assert.equal(h.nodes.get('field').value,'');
 assert.doesNotMatch(h.dialogs[0].innerHTML,/autofocus/);assert.match(h.dialogs[0].innerHTML,/Одноразовый резервный код/);
});
test('a late verified session after cancellation is revoked and never accepted',async()=>{
 let finish;const h=harness({request:async path=>path.endsWith('/options')?{challenge:'AQID'}:new Promise(resolve=>finish=resolve)});await flush();
 const clicked=h.nodes.get('button').click();await flush();await h.cancel();finish({token:'late-session'});await clicked;
 await assert.rejects(h.pending,/Вход отменён/);assert.equal(h.revoked.length,1);assert.equal(h.revoked[0].options.headers.authorization,'Bearer late-session');assert.equal(h.revoked[0].options.credentials,'include');
});
test('incorrect recovery codes keep the login pending and show the server error',async()=>{
 const h=harness({request:async path=>{if(path.endsWith('/options'))return {challenge:'AQID'};throw Object.assign(Error('Код неверен'),{code:'MFA_INVALID'});}});await flush();
 h.nodes.get('field').value='wrong';await h.nodes.get('form').submit();await flush();assert.match(h.nodes.get('error').textContent,/Код неверен/);assert.equal(h.nodes.get('code').open,true);assert.equal(h.dialogs[0].removed,undefined);
 await h.cancel();await assert.rejects(h.pending);
});
test('transport hints change only authentication discovery; registration and source options stay intact',async()=>{
 const h=harness();await flush();h.context.raw={challenge:'AQID',user:{id:'AQID',name:'one'},allowCredentials:[{id:'AQID',type:'public-key',transports:['internal']}]};
 h.run('const authentication=passkeyOptions(raw,false);const registration=passkeyOptions(raw,true)');
 assert.equal(h.run('authentication.allowCredentials[0].transports'),undefined);assert.equal(h.run('registration.allowCredentials[0].transports[0]'),'internal');assert.equal(h.run('raw.allowCredentials[0].transports[0]'),'internal');
 await h.cancel();await assert.rejects(h.pending);
});
