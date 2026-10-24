import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const appSource=readFileSync(new URL('./app.js',import.meta.url),'utf8').replace(/\ninit\(\);\s*$/,'');
const profileSource=readFileSync(new URL('./profile.js',import.meta.url),'utf8');
const dto={profile:{authorId:'author_12345678-1234-1234-1234-123456789abc',displayName:'Автор',bio:'Описание',avatar:'',publicVisible:false,version:0},identity:{email:null,telegramUserId:'123456',telegramUsername:'seller_test',role:'user',createdAt:'2026-10-01T00:00:00Z'},plan:{id:'pro_demo',active:true}};
function harness(){
  const listeners={},root={innerHTML:''},author={innerHTML:''},location={hash:'#profile',hostname:'zetslay.pro',search:'',href:'https://zetslay.pro/app/#profile'};
  const views=['dashboard','plugins','profile','author'].map(view=>({dataset:{view},hidden:false,classList:{toggle(){}}}));
  const document={querySelector(s){return s==='[data-profile]'?root:s==='[data-author-page]'?author:s==='meta[name="zetslay-api-base-url"]'?{content:'https://api.zetslay.pro'}:null;},querySelectorAll(s){return s==='[data-view]'?views:[];},getElementById(){return null;},addEventListener(type,fn){(listeners[type]??=[]).push(fn);},body:{classList:{toggle(){}}}};
  const context=vm.createContext({document,location,URL,URLSearchParams,Intl,Date,sessionStorage:{getItem:()=>'',removeItem(){},setItem(){}},localStorage:{getItem:()=>null,removeItem(){}},window:{scrollTo(){},setTimeout(){},confirm:()=>true},history:{replaceState(_,__,hash){location.hash=hash;}},FormData:class{constructor(form){this.values=new Map(form.values);}get(k){return this.values.get(k)??null;}}});
  vm.runInContext(profileSource+'\n'+appSource,context);
  context.dto=structuredClone(dto);
  const run=s=>vm.runInContext(s,context);
  run("authState.token='session';authState.user={id:'alice',telegramUserId:'123456'};authState.workspace={name:'@seller_test',plan:{active:false}};profileState.token='session';profileState.data=dto;showToast=()=>{};");
  return {context,run,root,author,location,views,listeners};
}
test('profile consolidates account, store, bot and plan using real data and server role',()=>{
  const a=harness();a.run("state.onboarding={activePlan:true,telegram:{linked:true,botConfigured:true,bot:{username:'myshopbot'}},funPay:{proxyConfigured:true}};renderProfile()");
  assert.match(a.root.innerHTML,/Данные аккаунта/);assert.match(a.root.innerHTML,/Telegram ID/);assert.match(a.root.innerHTML,/Демо-тариф/);assert.match(a.root.innerHTML,/https:\/\/t.me\/myshopbot/);assert.match(a.root.innerHTML,/data-profile-connect/);assert.match(a.root.innerHTML,/data-auth-logout/);assert.doesNotMatch(a.root.innerHTML,/name="email"|type="password"|Администратор/);
  a.run("authState.user.telegramUserId='5062414502';renderProfile()");assert.doesNotMatch(a.root.innerHTML,/Администратор/);
  a.run("profileState.data.identity.role='admin';renderProfile()");assert.match(a.root.innerHTML,/Администратор/);
});
test('old routes and topbar account open Profile; author routes keep separate views and plugin navigation',()=>{
  const a=harness();for(const view of ['telegram','security','profile']){a.run(`setView('${view}')`);assert.equal(a.location.hash,'#profile');assert.equal(a.views.find(x=>x.dataset.view==='profile').hidden,false);}
  a.run('showAuthor=()=>{}');a.run(`setView('authors/${dto.profile.authorId}')`);assert.equal(a.location.hash,'#authors/'+dto.profile.authorId);assert.equal(a.views.find(x=>x.dataset.view==='author').hidden,false);
  a.run("setView('plugins')");assert.equal(a.views.find(x=>x.dataset.view==='plugins').hidden,false);
  assert.ok(appSource.includes("if (authState.user) setView('profile'); else setAuthModal(true)"));
});
test('public author presentation escapes content and ignores all private identity fields',()=>{
  const a=harness();a.context.card={...dto.profile,displayName:'<script>name</script>',bio:'<img onerror=x>\nОписание',avatar:'https://tracker.test/x',email:'SECRET_EMAIL',telegramUserId:'SECRET_TG',goldenKey:'SECRET_KEY',balance:'SECRET_BALANCE'};
  const html=a.run('publicAuthorMarkup(card)');assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img onerror=x&gt;/);assert.doesNotMatch(html,/<script>|onerror="|SECRET_|tracker\.test|Отзывы|5\.0/);
});
test('background renders preserve unsaved edits and logout clears private and public profile state',()=>{
  const a=harness();a.run('renderProfile()');a.root.innerHTML='UNSAVED_DRAFT';a.run('profileState.dirty=true;renderProfile()');assert.equal(a.root.innerHTML,'UNSAVED_DRAFT');
  a.author.innerHTML='PRIVATE_OLD_AUTHOR';a.run('resetProfileState();authState.user=null;renderProfile()');assert.equal(a.root.innerHTML,'');assert.equal(a.author.innerHTML,'');assert.equal(a.run('profileState.data'),null);
});
test('late profile load cannot populate another account and loading errors remain retryable',async()=>{
  const a=harness();let resolve;a.context.fetchProfile=()=>new Promise(r=>resolve=r);a.run('apiRequest=fetchProfile;profileState.data=null');
  const pending=a.run('loadProfile()');a.run("sessionGeneration++;authState.token='new-session';resetProfileState()");resolve(dto);await pending;assert.equal(a.run('profileState.data'),null);
  a.run("apiRequest=async()=>{throw {code:'HTTP_404'}};loadProfile()");await new Promise(r=>setImmediate(r));assert.match(a.root.innerHTML,/Редактирование профиля временно недоступно/);assert.match(a.root.innerHTML,/data-profile-reload/);assert.equal(a.run('profileState.loading'),false);
});
test('saving uses version and safe fields, rejects duplicate submissions and blocks refresh while pending',async()=>{
  const a=harness();let resolve,calls=[];a.context.request=(path,options)=>{calls.push({path,options});return new Promise(r=>resolve=r);};a.run('apiRequest=request');
  const button={disabled:false,textContent:''},status={textContent:''},field={disabled:false};a.context.form={values:[['displayName','Новое имя'],['bio','Новая биография'],['publicVisible','on']],querySelector:s=>s==='[type="submit"]'?button:status,querySelectorAll:()=>[button,field]};
  const pending=a.run('saveProfile(form)');await a.run('saveProfile(form)');await a.run('loadProfile()');assert.equal(calls.length,1);assert.equal(field.disabled,true);assert.equal(calls[0].path,'/api/v1/profile');assert.deepEqual(Object.keys(calls[0].options.body).sort(),['displayName','bio','avatar','version','publicVisible'].sort());assert.equal(calls[0].options.body.version,0);
  resolve({...dto,profile:{...dto.profile,displayName:'Новое имя',version:1,publicVisible:true}});await pending;assert.equal(field.disabled,false);assert.match(a.root.innerHTML,/Новое имя/);assert.match(a.root.innerHTML,/data-author-link/);
});
test('author lookup failures and stale responses never render a misleading profile',async()=>{
  const a=harness();let resolve;a.context.request=()=>new Promise(r=>resolve=r);a.run('apiRequest=request');a.location.hash='#authors/'+dto.profile.authorId;
  const pending=a.run(`showAuthor('${dto.profile.authorId}')`);a.run("setView('profile')");resolve(dto.profile);await pending;assert.doesNotMatch(a.author.innerHTML,/profile-author-card/);
  a.run("apiRequest=async()=>{throw {code:'NOT_FOUND'}}");await a.run(`showAuthor('${dto.profile.authorId}')`);assert.match(a.author.innerHTML,/скрыл карточку/);
});
test('deployment preserves VPS edits, removes only retired views and runs idempotently',()=>{
  const root=mkdtempSync(new URL('./profile-stage-',import.meta.url).pathname);
  try{
    const local=join(root,'local'),out=join(root,'out');mkdirSync(local);
    const original=appSource.replace(/^[ \t]*if \(typeof (?:resetProfileState|renderProfile|loadProfile|renderProfileRoute) === 'function'\)[^\n]*\n/gm,'').replace(/^[ \t]*viewName = typeof normalizeProfileRoute[^\n]*\n/gm,'').replace(/^[ \t]*const authorId = typeof parseAuthorRoute[^\n]*\n/gm,'').replace(", profile: 'Профиль', author: 'Карточка автора'",'').replace("authorId ? 'author' : route ? 'plugin'","route ? 'plugin'").replace('route || authorId ? viewName','route ? viewName').replace("if (authState.user) setView('profile'); else setAuthModal(true)",'setAuthModal(true)')+'\n// VPS_CUSTOM_PROXY_AND_CATALOG\n';
    let html=readFileSync(new URL('./index.html',import.meta.url),'utf8').replace(/^[ \t]*<section class="view" data-view="(?:profile|author)"[^\n]*\n/gm,'');
    html=html.replace('<button class="nav-item" type="button" data-view-target="profile"><svg><use href="#i-user"/></svg><span>Профиль</span></button>','<button class="nav-item" type="button" data-view-target="telegram"><span>Telegram</span></button>\n<button class="nav-item" type="button" data-view-target="security"><span>Безопасность</span></button>');
    html=html.replace('<section class="view" data-view="guide"','<section class="view" data-view="telegram"><section><p>BOT_SETTINGS</p></section></section>\n<section class="view" data-view="security"><section><p>SESSION_SETTINGS</p></section></section>\n<section class="view" data-view="guide"');
    writeFileSync(join(local,'app.js'),original);writeFileSync(join(local,'index.html'),html);
    const script=new URL('../deploy/stage-profile-ui.py',import.meta.url).pathname,incoming=new URL('./',import.meta.url).pathname;
    let r=spawnSync('python3',[script,local,incoming,out],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
    const app=readFileSync(join(out,'app.js'),'utf8'),page=readFileSync(join(out,'index.html'),'utf8');assert.match(app,/VPS_CUSTOM_PROXY_AND_CATALOG/);assert.ok(app.includes('function confirmConnectionReset'));assert.match(page,/https:\/\/api.zetslay.pro/);assert.doesNotMatch(page,/data-view="(?:telegram|security)"|data-view-target="(?:telegram|security)"/);assert.match(page,/data-view="profile"/);assert.match(page,/data-view="author"/);
    const unchanged=name=>new RegExp('^(?:async )?function '+name+'\\([^\\n]*\\) \\{.*?^\\}\\n','ms');for(const name of ['renderPlugins','renderConnectionWizard','advanceConnectionWizard','confirmConnectionReset'])assert.equal(app.match(unchanged(name))[0],original.match(unchanged(name))[0]);
    r=spawnSync('python3',[script,out,incoming,out],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(readFileSync(join(out,'app.js'),'utf8'),app);assert.equal(readFileSync(join(out,'index.html'),'utf8'),page);
    assert.equal(spawnSync(process.execPath,['--check',join(out,'app.js')]).status,0);
    assert.equal(readFileSync(join(local,'app.js'),'utf8'),original);
  }finally{rmSync(root,{recursive:true,force:true});}
});
