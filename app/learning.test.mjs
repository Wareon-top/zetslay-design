import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./learning.js',import.meta.url),'utf8');
const fresh=()=>({version:1,revision:0,welcomeSeen:false,status:'new',step:0,startedAt:null,completedAt:null,updatedAt:null});
function harness({api,signedIn=true,width=1280,height=900,existing=false}={}) {
 const events=new Map(),timers=new Map(),calls=[],posts=[];let seq=0,data=fresh();if(existing){data.welcomeSeen=true;data.status='paused';}
 const document={hidden:false,activeElement:null,addEventListener:(k,f)=>events.set(k,f),removeEventListener:k=>events.delete(k)};
 const matches=(n,s)=>{
  if(s.includes(':not(:disabled)')){if(n.disabled)return false;s=s.replace(':not(:disabled)','');}
  const tag=s.match(/^[a-z][a-z0-9-]*/i)?.[0];if(tag&&n.tag!==tag)return false;
  for(const m of s.matchAll(/\.([\w-]+)/g))if(!n.classList.contains(m[1]))return false;
  const id=s.match(/#([\w-]+)/)?.[1];if(id&&n.attrs.id!==id)return false;
  for(const m of s.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g))if(!(m[1] in n.attrs)||(m[2]!==undefined&&n.attrs[m[1]]!==m[2]))return false;
  return true;
 };
 const selector=(n,s)=>s.split(',').some(part=>{
  const chunks=part.trim().split(/\s+/);if(!matches(n,chunks.pop()))return false;let parent=n.parent;
  while(chunks.length){const segment=chunks.pop();while(parent&&!matches(parent,segment))parent=parent.parent;if(!parent)return false;parent=parent.parent;}return true;
 });
 class Node {
  constructor(tag='div',attrs={}){this.tag=tag;this.attrs=attrs;this.children=[];this.parent=null;this.style={};this.inert=false;this.scrollHeight=330;this.events=new Map();
   this.classList={contains:c=>this.className.split(/\s+/).includes(c),add:c=>{if(!this.classList.contains(c))this.className=(this.className+' '+c).trim()},remove:c=>this.className=this.className.split(/\s+/).filter(x=>x!==c).join(' '),toggle:(c,on)=>{if(on??!this.classList.contains(c))this.classList.add(c);else this.classList.remove(c)}};
   this.dataset=new Proxy({}, {get:(_t,k)=>this.attrs['data-'+String(k).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())],set:(_t,k,v)=>{this.attrs['data-'+String(k).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())]=v;return true;}});
  }
  get className(){return this.attrs.class||''}set className(v){this.attrs.class=v}
  get hidden(){return 'hidden' in this.attrs}set hidden(v){if(v)this.attrs.hidden='';else delete this.attrs.hidden}
  get disabled(){return 'disabled' in this.attrs}set disabled(v){if(v)this.attrs.disabled='';else delete this.attrs.disabled}
  get isConnected(){let n=this;while(n.parent)n=n.parent;return n===document.body}
  setAttribute(k,v){this.attrs[k]=v}hasAttribute(k){return k in this.attrs}
  get innerHTML(){return this.children.map(n=>typeof n==='string'?n:`<${n.tag}${Object.entries(n.attrs).map(([k,v])=>` ${k}="${v}"`).join('')}>${n.innerHTML}</${n.tag}>`).join('')}
  set innerHTML(v){this.replaceChildren();const stack=[this];for(const token of v.match(/<[^>]+>|[^<]+/g)||[]){if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}if(!token.startsWith('<')){stack.at(-1).children.push(token);continue;}const tag=token.match(/^<([\w-]+)/)?.[1];if(!tag)continue;const attrs={};for(const m of token.replace(/^<[\w-]+/,'').matchAll(/([\w-]+)(?:="([^"]*)"|'([^']*)')?/g))attrs[m[1]]=m[2]??m[3]??'';const n=new Node(tag,attrs);stack.at(-1).append(n);if(!['img','input','br','hr','meta','link'].includes(tag)&&!token.endsWith('/>'))stack.push(n);}}
  get textContent(){return this.children.map(n=>typeof n==='string'?n:n.textContent).join('')}set textContent(v){this.replaceChildren();this.children.push(v)}
  querySelectorAll(s){const list=[];for(const n of this.children){if(typeof n==='string')continue;if(selector(n,s))list.push(n);list.push(...n.querySelectorAll(s));}return list}
  querySelector(s){return this.querySelectorAll(s)[0]||null}
  closest(s){let n=this;while(n){if(selector(n,s))return n;n=n.parent;}return null}
  append(n){n.remove();n.parent=this;this.children.push(n)}prepend(n){n.remove();n.parent=this;this.children.unshift(n)}
  before(n){n.remove();n.parent=this.parent;this.parent.children.splice(this.parent.children.indexOf(this),0,n)}
  replaceChildren(){for(const n of this.children)if(typeof n!=='string')n.parent=null;this.children=[]}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}}
  focus(){document.activeElement=this}scrollIntoView(){calls.push(['scroll'])}
  click(){calls.push(['business-click',this.hasAttribute('data-trial-action')?'trial':'connection'])}addEventListener(k,f){this.events.set(k,f)}
  getBoundingClientRect(){let x=16,y=110,w=208,h=36;if(this.hasAttribute('data-sidebar-trial')){y=420;h=160;}if(this.dataset.viewTarget==='billing')y=270;if(this.hasAttribute('data-overview-connect')){x=width-260;y=110;}if(this.className.includes('learning-coach')){w=Math.min(380,width-24);h=330;}return {left:x,top:y,right:x+w,bottom:y+h,width:w,height:h};}
 }
 document.body=new Node('body');document.body.innerHTML='<body><div class="app-shell"><aside class="sidebar"><button data-view-target="dashboard">Главная</button><button data-view-target="orders">Заказы</button><button data-view-target="plugins">Плагины</button><button data-view-target="billing">Финансы</button><aside data-sidebar-trial><button data-trial-action>Начать бесплатно</button></aside></aside><section data-view="dashboard"><button data-overview-connect>Подключить</button><div class="overview-context"></div></section><section data-view="orders" hidden></section><section data-view="plugins" hidden></section><section data-view="billing" hidden></section><section data-view="guide" hidden><div data-kb-library></div></section></div><button id="previous-focus">Фокус</button></body>';
 document.querySelector=s=>document.body.querySelector(s);document.querySelectorAll=s=>document.body.querySelectorAll(s);document.createElement=tag=>new Node(tag);
 const window={innerWidth:width,innerHeight:height,addEventListener:(k,f)=>events.set(k,f),removeEventListener:k=>events.delete(k)};
 const context=vm.createContext({document,window,location:{hash:'#dashboard'},Date,console,authState:{token:signedIn?'token-a':'',user:signedIn?{id:'a'}:null,workspace:{id:'w',plan:{active:false}}},state:{onboarding:null,plugins:[]},sidebarTrialUi:{data:{state:'available'}},requestAnimationFrame(fn){fn();return ++seq},cancelAnimationFrame(){},setTimeout(fn){const id=++seq;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id),showToast:(...v)=>calls.push(['toast',...v]),renderDashboard(){},renderPlugins(){},renderStoreFleet(){},renderTelegramOnboarding(){},resetAccountData(){},setSidebar(open){document.querySelector('.sidebar').classList.toggle('is-open',open)},setView(view){calls.push(['route',view]);context.location.hash='#'+view;document.querySelectorAll('[data-view]').forEach(n=>n.hidden=n.dataset.view!==view);},apiRequest:async(path,options)=>{
   calls.push([path,options]);if(options.method==='POST')posts.push(options.body);
   if(api)return api(path,options);
   if(options.method==='POST'){assert.equal(options.body.revision,data.revision);const a=options.body.action;data={...data,revision:data.revision+1,welcomeSeen:true};if(a==='start'||a==='restart'){data.status='in_progress';if(a==='restart')data.step=0;}if(a==='step')data.step=options.body.step;if(a==='pause')data.status='paused';if(a==='complete')data.status='completed';}
   return structuredClone(data);
 }});
 const run=code=>vm.runInContext(code,context);run(source);return {run,context,document,calls,posts,timers,events,node:document.querySelector,async ready(){for(let i=0;i<30;i++)await Promise.resolve();},async fireTimers(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}await this.ready();}};
}
test('new user receives one welcome; startup only reads eligibility and records welcome viewing',async()=>{
 const h=harness();await h.ready();assert.equal(h.posts.length,0);await h.fireTimers();assert.match(h.node('.learning-welcome').innerHTML,/Добро пожаловать/);assert.deepEqual(h.posts.map(x=>x.action),['welcome_seen']);
 assert.ok(h.node('.app-shell').inert);h.run('learningClose()');h.run('learningRefresh()');await h.fireTimers();assert.equal(h.node('[data-learning-overlay]'),null);
 assert.ok(h.calls.every(c=>!c[0].startsWith('/api/')||c[0]==='/api/v1/learning'));
});
test('existing users are not interrupted; knowledge base offers explicit replay',async()=>{
 const h=harness({existing:true});await h.ready();await h.fireTimers();assert.equal(h.node('[data-learning-overlay]'),null);assert.ok(h.node('[data-kb-library] [data-learning-replay]'));
 await h.run('learningStart(true)');assert.equal(h.run('learningUi.mode'),'tour');assert.equal(h.run('learningUi.index'),0);assert.equal(h.posts.at(-1).action,'restart');
});
test('six-step tour pauses and resumes at its saved step, then completes and can restart',async()=>{
 const h=harness({existing:true});await h.ready();await h.run('learningStart()');await h.run('learningMove(1)');await h.run('learningMove(1)');
 h.run("learningClick({target:{closest:s=>s==='[data-learning-close]'?{}:null}})");await h.ready();assert.equal(h.run('learningUi.data.status'),'paused');assert.equal(h.node('[data-learning-overlay]'),null);
 await h.run('learningStart()');assert.equal(h.run('learningUi.index'),2);
 for(let i=0;i<4;i++)await h.run('learningMove(1)');assert.equal(h.run('learningUi.mode'),'finish');assert.equal(h.run('learningUi.data.status'),'completed');
 h.run('learningClose()');await h.run('learningStart(true)');assert.equal(h.run('learningUi.index'),0);
});
test('keyboard navigation traps focus, Escape restores the original route and focus',async()=>{
 const h=harness({existing:true});await h.ready();h.node('#previous-focus').focus();await h.run('learningStart()');
 const event={key:'Tab',preventDefault(){},stopImmediatePropagation(){}};h.context.event=event;h.run('learningKey(event)');assert.ok(h.document.activeElement.hasAttribute('data-learning-close'));
 h.context.event={...event,key:'ArrowRight'};h.run('learningKey(event)');await h.ready();assert.equal(h.run('learningUi.index'),1);
 h.context.event={...event,key:'Escape'};h.run('learningKey(event)');await h.ready();assert.equal(h.document.activeElement,h.node('#previous-focus'));assert.equal(h.context.location.hash,'#dashboard');assert.equal(h.node('.app-shell').inert,false);
});
test('closing during a pending step cannot reopen the overlay after its response',async()=>{
 let release;const h=harness({api:async(_p,o)=>o.method==='POST'?o.body.action==='step'?new Promise(r=>release=()=>r({...fresh(),revision:2,welcomeSeen:true,status:'in_progress',step:1})):({...fresh(),revision:1,welcomeSeen:true,status:'in_progress'}):({...fresh(),welcomeSeen:true})});
 await h.ready();await h.run('learningStart()');const moving=h.run('learningMove(1)');await h.ready();h.run('learningClose()');release();await moving;assert.equal(h.node('[data-learning-overlay]'),null);assert.equal(h.run('learningUi.mode'),'');
});
test('logout or account switch rejects stale responses and clears visible learning state',async()=>{
 let release;const h=harness({api:()=>new Promise(r=>release=r)});await h.ready();h.run("authState.token='';authState.user=null;resetAccountData()");release(fresh());await h.ready();assert.equal(h.run('learningUi.data'),null);assert.equal(h.node('[data-learning-overlay]'),null);assert.equal(h.node('[data-learning-checklist]').hidden,true);
});
test('checklist uses live facts; enabled plugin alone cannot replace access or store connection',async()=>{
 const h=harness({existing:true});await h.ready();h.run("state.plugins=[{installed:true,active:true,published:true}];renderPlugins()");assert.match(h.node('[data-learning-checklist]').innerHTML,/1 из 3/);
 h.run("authState.workspace.plan={active:true};state.onboarding={state:'connected_read_only',funPay:{store:{id:'fp'}}};renderDashboard()");assert.equal(h.node('[data-learning-checklist]').hidden,true);
 h.run("authState.workspace.plan={active:true,expiresAt:'2020-01-01T00:00:00Z'};renderDashboard()");assert.equal(h.node('[data-learning-checklist]').hidden,false);
});
test('paid users have a visible trial-step fallback; mobile coach remains inside the viewport',async()=>{
 const h=harness({existing:true,width:390,height:844});await h.ready();h.node('[data-sidebar-trial]').hidden=true;
 await h.run('learningStart()');await h.run('learningMove(1)');await h.run('learningMove(1)');
 assert.equal(h.run('learningTarget().dataset.viewTarget'),'billing');const card=h.node('.learning-coach');assert.ok(parseFloat(card.style.left)>=0);assert.ok(parseFloat(card.style.top)>=0);assert.ok(parseFloat(card.style.top)+330<=844);
});
test('data failure does not manufacture a welcome or active access; manual replay reports retry',async()=>{
 const h=harness({api:async()=>{throw Error('network')}});await h.ready();await h.fireTimers();assert.equal(h.node('[data-learning-overlay]'),null);await h.run('learningStart()');assert.equal(h.run('learningUi.mode'),'');assert.ok(h.calls.some(c=>c[0]==='toast'));
});
test('orientation and width changes reopen the mobile sidebar only for navigation steps',async()=>{
 const h=harness({existing:true});await h.ready();await h.run('learningStart()');h.context.window.innerWidth=390;h.events.get('resize')();assert.equal(h.node('.sidebar').classList.contains('is-open'),true);
 await h.run('learningMove(1)');assert.equal(h.node('.sidebar').classList.contains('is-open'),false);h.context.window.innerWidth=1280;h.events.get('resize')();assert.equal(h.node('.sidebar').classList.contains('is-open'),false);
 h.run('learningClose()');assert.equal(h.events.has('resize'),false);assert.equal(h.timers.size,0);
});
test('a lost write response is verified by reading progress without repeating the write',async()=>{
 let data={...fresh(),welcomeSeen:true};const h=harness({api:async(_p,o)=>{if(o.method==='POST'){data={...data,revision:data.revision+1,status:'in_progress'};throw Error('response lost');}return structuredClone(data);}});
 await h.ready();await h.run('learningStart()');assert.equal(h.run('learningUi.mode'),'tour');assert.equal(h.run('learningUi.error'),'');assert.equal(h.posts.length,1);assert.equal(h.posts[0].action,'start');
});
test('signed-out startup makes no request; malformed progress cannot open a modal',async()=>{
 const out=harness({signedIn:false});await out.ready();assert.equal(out.calls.length,0);
 const bad=harness({api:async()=>({...fresh(),step:999})});await bad.ready();await bad.fireTimers();assert.equal(bad.node('[data-learning-overlay]'),null);
});
