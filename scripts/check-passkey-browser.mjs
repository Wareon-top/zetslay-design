// Browser wiring/UX check with a Chromium virtual authenticator and synthetic API.
// Real signatures, origin/RP/UV/counter verification are separately tested in core.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const script=await readFile(new URL('../app/account-security.js',import.meta.url),'utf8');
const css=await readFile(new URL('../app/passkeys.css',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true,...(process.env.PASSKEY_CHROME?{executablePath:process.env.PASSKEY_CHROME}:{})});
try{
 const context=await browser.newContext({viewport:{width:1100,height:1000}}),page=await context.newPage(),cdp=await context.newCDPSession(page);
 page.setDefaultTimeout(15000);
 await cdp.send('WebAuthn.enable');
 await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
 let enabled=false,credentialId='',verified=false,loginResponse=false;
 const options=()=>({challenge:Buffer.alloc(32,7).toString('base64url'),timeout:120000,rpId:'zetslay.pro',userVerification:'required',allowCredentials:[{id:credentialId,type:'public-key',transports:['internal']}]});
 const markup=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{background:#0c0d0f;color:#eee;font:16px system-ui;margin:24px}.profile-grid{max-width:780px;margin:auto}.button{padding:12px 17px;border:1px solid #444;border-radius:10px;background:#25282d;color:white;cursor:pointer}.button--primary{background:#b94b18}.profile-actions{display:flex;gap:10px;flex-wrap:wrap}.account-security-label{display:block;margin:14px 0}input{display:block;max-width:100%;padding:10px}dialog{background:#16181b;color:white;border:1px solid #444;border-radius:16px;padding:24px}dialog::backdrop{background:#0009}${css}</style></head><body><main data-profile><div class="profile-grid"></div></main><script>
 const authState={token:'synthetic-primary',user:{id:'synthetic-user'}};
 const API_BASE_URL='https://api.zetslay.pro';const accepted=[];
 const escapeHtml=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 const icon=()=>'';const humanError=e=>e.message;function showToast(){}function renderProfile(){}function resetAccountData(){}async function loadProfile(){}function acceptSession(s){accepted.push(s);return s;}
 async function apiRequest(path,opts={}){const response=await fetch(API_BASE_URL+path,{method:opts.method||'GET',headers:{'content-type':'application/json',...(opts.authenticated?{authorization:'Bearer '+authState.token}:{})},credentials:path==='/api/v1/auth/mfa'?'include':'omit',body:opts.body?JSON.stringify(opts.body):undefined,signal:opts.signal});const body=await response.json();if(!response.ok)throw Error(body.error?.message||'API');return body.data;}
 </script><script src="/account-security.js"></script></body></html>`;
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.href==='https://zetslay.pro/app/')return route.fulfill({contentType:'text/html; charset=utf-8',body:markup});
  if(url.href==='https://zetslay.pro/account-security.js')return route.fulfill({contentType:'text/javascript; charset=utf-8',body:script});
  if(url.origin!=='https://api.zetslay.pro')return route.abort();
  const headers={'access-control-allow-origin':'https://zetslay.pro','access-control-allow-credentials':'true','access-control-allow-headers':'content-type,authorization','access-control-allow-methods':'GET,POST,OPTIONS'};
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
  const input=request.postDataJSON()||{};let data;
  if(url.pathname==='/api/v1/account/sync-health')data={status:'not_observed'};
  else if(url.pathname==='/api/v1/account/security'&&request.method()==='GET')data={enabled,totpEnabled:false,passkeySupported:true,passkeys:credentialId?[{id:credentialId}]:[],adminMfaRequired:true,recoveryRemaining:1,sessions:[]};
  else if(input.operation==='passkey-register-options')data={rp:{id:'zetslay.pro',name:'ZetSlay'},user:{id:Buffer.alloc(32,5).toString('base64url'),name:'synthetic-user',displayName:'Test'},challenge:Buffer.alloc(32,6).toString('base64url'),pubKeyCredParams:[{type:'public-key',alg:-7}],authenticatorSelection:{residentKey:'required',userVerification:'required'},attestation:'none',timeout:120000};
  else if(input.operation==='passkey-register'){assert.equal(input.response.type,'public-key');assert.ok(input.response.response.attestationObject);credentialId=input.response.id;enabled=true;data={enabled:true,recoveryCodes:['SYNTHETIC-RECOVERY-DO-NOT-USE']};}
  else if(input.operation==='passkey-step-up-options'||url.pathname==='/api/v1/auth/passkey/options')data=options();
  else if(input.operation==='passkey-step-up'){assert.equal(input.response.id,credentialId);assert.ok(input.response.response.signature);verified=true;data={verified:true};}
  else if(url.pathname==='/api/v1/auth/mfa'){assert.equal(input.passkeyResponse.id,credentialId);loginResponse=true;data={token:'synthetic-mfa-session',user:{id:'synthetic-user'},workspace:{id:'synthetic-workspace'}};}
  else throw Error('Unexpected synthetic request: '+url.pathname);
  return route.fulfill({headers,contentType:'application/json',body:JSON.stringify({data})});
 });
 await page.goto('https://zetslay.pro/app/');await page.evaluate(()=>loadAccountSecurity());
 const state=await page.evaluate(()=>({data:accountSecurityUi.data,error:accountSecurityUi.error}));assert.ok(state.data,state.error||'security state not loaded');
 await page.getByRole('button',{name:'Подключить отпечаток / Face ID',exact:true}).click();
 await page.getByText('Сохраните резервные коды',{exact:true}).waitFor();assert.ok(enabled);
 await page.getByRole('button',{name:'Я сохранил',exact:true}).click();
 await page.getByRole('button',{name:'Подтвердить отпечатком / Face ID',exact:true}).click();
 await page.waitForFunction(()=>!accountSecurityUi.busy);assert.ok(verified);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.evaluate(()=>{window.syntheticLogin=acceptSession({mfaRequired:true,passkeyAvailable:true,totpAvailable:false,challengeToken:'synthetic-challenge'});});
 await page.getByRole('button',{name:'Войти с отпечатком / Face ID',exact:true}).click();
 await page.waitForFunction(()=>accepted.length===1);assert.ok(loginResponse);assert.equal(await page.evaluate(()=>accepted[0].token),'synthetic-mfa-session');
 console.log(JSON.stringify({browser:'Chromium virtual authenticator',enrollment:true,stepUp:true,login:true,mobileNoOverflow:true,realAccountsUsed:false}));
 await context.close();
}finally{await browser.close();}
