import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./account-security.js',import.meta.url),'utf8');
test('partial sync distinguishes plugin attention from a failed shop read',()=>{
 const a=harness();const html=a.run("accountSecurityMarkup({enabled:false,sessions:[]},{status:'partial'})");
 assert.match(html,/Магазин обновлён; одному из плагинов нужна проверка/);
 assert.doesNotMatch(html,/Фоновый опрос ещё не зафиксирован/);
});
function harness(){const context=vm.createContext({console,URL,Blob,setTimeout,clearTimeout,AbortSignal,AbortController,Uint8Array,atob,btoa,document:{querySelector:()=>null,addEventListener(){}},window:{confirm:()=>true},escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),icon:()=>'',humanError:error=>error.message||error.code,authState:{token:'a',user:{id:'alice'}},apiRequest:async()=>({}),showToast(){}});vm.runInContext('function acceptSession(s){accepted.push(s);return s;} const accepted=[];function renderProfile(){};function resetAccountData(){};async function loadProfile(){};'+source,context);return {context,run:s=>vm.runInContext(s,context)};}
test('profile uses server session state and escapes device names without claiming live health',()=>{const a=harness();const html=a.run(`accountSecurityMarkup({enabled:true,recoveryRemaining:8,sessions:[{id:'hash',device:'<img onerror=x>',current:true,createdAt:'2026-10-06T12:00:00Z'}]},{status:'retrying',code:'PROXY_TIMEOUT'})`);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img onerror/);assert.match(html,/Повтор после ошибки/);assert.match(html,/Резервных кодов: 8/);assert.match(html,/data-security-proof/);assert.doesNotMatch(html,/data-security-session="hash"/);});
test('MFA challenge must finish before accepting a session',async()=>{const a=harness();let finish;a.context.proof=()=>new Promise(r=>finish=r);a.run('challengeMfa=proof');const pending=a.run("acceptSession({mfaRequired:true,challengeToken:'opaque'})");assert.equal(a.run('accepted.length'),0);finish({token:'real',user:{id:'alice'}});await pending;assert.equal(a.run('accepted[0].token'),'real');});
test('cancelled proof cannot accept an authenticated session',async()=>{const a=harness();a.run("challengeMfa=async()=>{throw Error('cancelled')}");await assert.rejects(a.run('acceptSession({mfaRequired:true})'),/cancelled/);assert.equal(a.run('accepted.length'),0);});
test('an MFA response arriving after an account change cannot replace the newer login',async()=>{
 const a=harness();let finish;const revocations=[];a.context.API_BASE_URL='https://api.zetslay.test';a.context.AbortSignal=AbortSignal;a.context.fetch=async(url,opts)=>revocations.push([url,opts.headers.authorization]);a.context.sessionGeneration=1;
 a.context.proof=()=>new Promise(r=>finish=r);a.run('challengeMfa=proof');const pending=a.run('acceptSession({mfaRequired:true})');
 a.run("authState.token='new-account';sessionGeneration=2");finish({token:'old-mfa-session',user:{id:'previous'}});await assert.rejects(pending,/Вход отменён/);
 assert.equal(a.run('accepted.length'),0);assert.equal(a.run('authState.token'),'new-account');assert.deepEqual(revocations,[['https://api.zetslay.test/api/v1/auth/logout','Bearer old-mfa-session']]);
});
test('a late security response cannot expose the previous account sessions',async()=>{const a=harness();const resolves=[];a.context.request=()=>new Promise(r=>resolves.push(r));a.run('apiRequest=request');const pending=a.run('loadAccountSecurity()');a.run("authState.token='b';resetAccountData()");for(const resolve of resolves)resolve({enabled:true,sessions:[{device:'PRIVATE'}]});await pending;assert.equal(a.run('accountSecurityUi.data'),null);assert.equal(a.run('accountSecurityUi.loading'),false);});
test('logout clears one-time enrollment secrets and recovery codes',()=>{const a=harness();a.run("accountSecurityUi.setup={secret:'PRIVATE'};accountSecurityUi.codes=['RECOVERY'];resetAccountData()");assert.equal(a.run('accountSecurityUi.setup'),null);assert.equal(a.run('accountSecurityUi.codes.length'),0);});
test('security actions send the selected operation and only the current input to authenticated API',async()=>{const a=harness(),calls=[];a.context.request=async(path,opts)=>{calls.push({path,opts});return path.includes('sync-health')?{status:'not_observed'}:{enabled:false,sessions:[]};};a.run('apiRequest=request');await a.run("changeAccountSecurity('revoke',{sessionId:'session-hash',code:'one-time'})");assert.equal(calls[0].path,'/api/v1/account/security');assert.equal(calls[0].opts.authenticated,true);assert.equal(calls[0].opts.body.operation,'revoke');assert.equal(calls[0].opts.body.sessionId,'session-hash');assert.equal(calls[0].opts.body.code,'one-time');});

test('owner sees mandatory MFA and cannot select disable; ordinary user retains the control',()=>{
 const a=harness();const owner=a.run('accountSecurityMarkup({enabled:true,adminMfaRequired:true,sessions:[]},null)');
 assert.match(owner,/Для административного доступа нужна 2FA/);assert.doesNotMatch(owner,/data-security-action="disable"/);
 assert.match(a.run('accountSecurityMarkup({enabled:true,adminMfaRequired:false,sessions:[]},null)'),/data-security-action="disable"/);
});
test('an old read cannot overwrite enrollment result and reads cannot start during a write',async()=>{
 const a=harness();let resolveRead,reads=0;a.context.request=async(path,opts)=>{if(opts?.method==='POST')return {enabled:true,recoveryCodes:['ONE_TIME']};if(path.includes('sync-health'))return {};reads++;if(reads===1)return new Promise(r=>resolveRead=r);return {enabled:true,sessions:[]};};a.run('apiRequest=request');
 const old=a.run('loadAccountSecurity()');await a.run("changeAccountSecurity('enable',{code:'123456'})");resolveRead({enabled:false,sessions:[]});await old;
 assert.equal(a.run('accountSecurityUi.data.enabled'),true);assert.equal(a.run('accountSecurityUi.codes[0]'),'ONE_TIME');
 a.run('accountSecurityUi.busy=true');await a.run('loadAccountSecurity()');assert.equal(reads,2);
});
test('accepted action with failed refresh retains recovery codes and warns before repeating',async()=>{
 const a=harness();a.context.request=async(path,opts)=>{if(opts.method==='POST')return {recoveryCodes:['KEEP_ME']};throw Error('offline');};a.run('apiRequest=request');
 await a.run("changeAccountSecurity('recovery',{code:'code'})");assert.equal(a.run('accountSecurityUi.codes[0]'),'KEEP_ME');assert.match(a.run('accountSecurityUi.error'),/Действие принято/);
});
test('late proof from a previous session cannot change messages, loading state or one-time codes',async()=>{
 const a=harness();let resolve;a.context.request=()=>new Promise(r=>resolve=r);a.run('apiRequest=request');const old=a.run("changeAccountSecurity('enable',{code:'123456'})");
 a.run("authState.token='b';resetAccountData();accountSecurityUi.error='current'");resolve({recoveryCodes:['OLD_PRIVATE']});await old;
 assert.equal(a.run('accountSecurityUi.codes.length'),0);assert.equal(a.run('accountSecurityUi.error'),'current');assert.equal(a.run('accountSecurityUi.busy'),false);
});
test('passkey enrollment obtains server options before browser verification and posts only the resulting credential',async()=>{
 const a=harness(),calls=[];let usedOptions;
 a.context.ceremony=async(options,create,signal)=>{usedOptions={options,create,signal};return {id:'credential'};};a.run('passkeyCeremony=ceremony');
 a.context.request=async(path,opts)=>{calls.push(opts);if(opts.body?.operation==='passkey-register-options')return {challenge:'server-challenge'};if(opts.body?.operation==='passkey-register')return {recoveryCodes:['SAVE_ME']};return {enabled:true,passkeySupported:true,passkeys:[],sessions:[]};};a.run('apiRequest=request');
 await a.run("changeAccountSecurity('passkey-register')");
 assert.equal(calls[0].body.operation,'passkey-register-options');assert.equal(usedOptions.create,true);assert.equal(usedOptions.options.challenge,'server-challenge');assert.equal(calls[1].body.response.id,'credential');assert.equal(a.run('accountSecurityUi.codes[0]'),'SAVE_ME');
});
test('logout during a device ceremony aborts it and cannot register a key on a different account',async()=>{
 const a=harness(),calls=[];let finish,signal;
 a.context.request=async(path,opts)=>{calls.push(opts.body.operation);return {challenge:'server-challenge'};};a.run('apiRequest=request');
 a.context.ceremony=async(o,c,s)=>{signal=s;return new Promise(r=>finish=r);};a.run('passkeyCeremony=ceremony');
 const pending=a.run("changeAccountSecurity('passkey-register')");await new Promise(r=>setImmediate(r));
 a.run("authState.token='b';resetAccountData()");assert.equal(signal.aborted,true);finish({id:'old-key'});await pending;
 assert.deepEqual(calls,['passkey-register-options']);assert.equal(a.run('accountSecurityUi.codes.length'),0);
});
test('cancelling the system prompt restores controls and does not post an enrollment',async()=>{
 const a=harness(),calls=[];a.context.request=async(path,opts)=>{calls.push(opts.body.operation);return {};};a.run('apiRequest=request');
 a.context.ceremony=async()=>{const e=Error('cancel');e.name='NotAllowedError';throw e;};a.run('passkeyCeremony=ceremony');await a.run("changeAccountSecurity('passkey-register')");
 assert.deepEqual(calls,['passkey-register-options']);assert.equal(a.run('accountSecurityUi.busy'),false);assert.match(a.run('accountSecurityUi.error'),/Устройство не завершило подключение/);
});
test('credential binary conversion preserves bytes and requests browser user verification',async()=>{
 const a=harness();let call;a.context.PublicKeyCredential=function(){};a.context.window.isSecureContext=true;
 a.context.navigator={userActivation:{isActive:true},credentials:{create:async options=>{call=options;return {id:'AQID',rawId:Uint8Array.of(1,2,3).buffer,type:'public-key',response:{clientDataJSON:Uint8Array.of(4).buffer,attestationObject:Uint8Array.of(5).buffer,getTransports:()=>['internal']}};}}};
 const result=await a.run("passkeyCeremony({challenge:'AQID',user:{id:'BAU'},authenticatorSelection:{userVerification:'required'},excludeCredentials:[{id:'Bgc'}]},true)");
 assert.deepEqual([...call.publicKey.challenge],[1,2,3]);assert.deepEqual([...call.publicKey.user.id],[4,5]);assert.equal(call.publicKey.authenticatorSelection.userVerification,'required');assert.equal(result.response.attestationObject,'BQ');assert.equal(result.rawId,'AQID');
});
test('passkey controls are only advertised when the API supports them and key IDs are escaped',()=>{
 const a=harness();assert.equal(a.run('passkeyMarkup({})'),'');
 const html=a.run(`passkeyMarkup({passkeySupported:true,passkeys:[{id:'<img onerror="x">'}]})`);assert.match(html,/Подтвердить отпечатком/);assert.doesNotMatch(html,/<img/);
});
test('registration fills an empty display name without changing the server user handle or other options',()=>{
 const a=harness();a.run("const raw={challenge:'AQID',user:{id:'BAU',name:'account-name',displayName:''},authenticatorSelection:{userVerification:'required'}};const converted=passkeyOptions(raw,true)");
 assert.equal(a.run('converted.user.displayName'),'account-name');assert.equal(a.run('raw.user.displayName'),'');assert.deepEqual([...a.run('converted.user.id')],[4,5]);assert.equal(a.run('converted.authenticatorSelection.userVerification'),'required');
 assert.equal(a.run("passkeyOptions({...raw,user:{...raw.user,displayName:'Existing name'}},true).user.displayName"),'Existing name');
});
test('a lost or unavailable activation defers WebAuthn until the fresh-click callback',async()=>{
 const a=harness();let invoke,release,calls=0;a.context.PublicKeyCredential=function(){};a.context.window.isSecureContext=true;
 a.context.navigator={userActivation:{isActive:false},credentials:{create:async()=>{calls++;return {id:'AQID',rawId:Uint8Array.of(1,2,3).buffer,type:'public-key',response:{clientDataJSON:Uint8Array.of(4).buffer,attestationObject:Uint8Array.of(5).buffer}};}}};
 a.context.defer=(start)=>{invoke=start;return new Promise(r=>release=r);};a.run('passkeyFromFreshClick=defer');
 const pending=a.run("passkeyCeremony({challenge:'AQID',user:{id:'BAU',name:'test'}},true)");assert.equal(calls,0);release(invoke());const result=await pending;assert.equal(calls,1);assert.equal(result.id,'AQID');
});
test('initial registration errors do not tell a user to use recovery codes that do not exist yet',()=>{
 const a=harness();const first=a.run("passkeyError({name:'NotAllowedError'},true)");assert.match(first,/Резервные коды появятся после/);assert.doesNotMatch(first,/используйте резервный код/);
 assert.match(a.run("passkeyError({name:'NotAllowedError'},false)"),/используйте резервный код/);
});

test('owner sees the server-reported hour while legacy API and ordinary accounts keep five-minute wording',()=>{const a=harness();const html=a.run('accountSecurityMarkup({enabled:true,adminMfaRequired:true,adminProofMaxAgeSeconds:3600,passkeySupported:true,passkeys:[{id:"key"}],sessions:[]},null)');assert.match(html,/админке подтверждается на 1 час/);assert.match(html,/изменения защиты аккаунта подтверждение действует 5 минут/);assert.doesNotMatch(html,/каждые 5 минут/);assert.doesNotMatch(a.run('accountSecurityMarkup({enabled:true,adminMfaRequired:true,sessions:[]},null)'),/1 час/);assert.doesNotMatch(a.run('accountSecurityMarkup({enabled:true,adminMfaRequired:false,adminProofMaxAgeSeconds:3600,sessions:[]},null)'),/1 час/);});
