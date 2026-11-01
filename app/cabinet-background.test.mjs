import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync}from'node:fs';
const source=readFileSync(new URL('./cabinet-background.js',import.meta.url),'utf8');
function cabinet({hidden=false,reduced=false,saveData=false,width=1440,height=1000,left=256}={}){
 const frames=new Map(),events=new Map(),windowEvents=new Map(),timers=new Map(),paints=[];let id=0,observer,existing=null,motionChange;
 const context={setTransform(){},clearRect(){},fillText(g,x,y){paints.push({g,x,y,alpha:this.globalAlpha});}};
 const canvas={style:{},setAttribute(){},getContext:()=>context,getBoundingClientRect:()=>({left,top:0})};
 const shell={hidden,querySelector:()=>workspace};
 const workspace={querySelector:()=>existing,prepend(el){existing=el;},getClientRects:()=>shell.hidden?[]:[{}],getBoundingClientRect:()=>({left,right:width}),addEventListener(){}};
 const document={hidden:false,documentElement:{},querySelector:()=>shell,createElement:()=>canvas,addEventListener:(n,f)=>events.set(n,f)};
 const media={matches:reduced,addEventListener:(_,f)=>motionChange=f};
 const window={innerWidth:width,innerHeight:height,devicePixelRatio:3,navigator:{connection:{saveData}},matchMedia:()=>media,getComputedStyle:()=>({color:'#d6c4ba'}),requestAnimationFrame:f=>{frames.set(++id,f);return id;},cancelAnimationFrame:i=>frames.delete(i),setTimeout:f=>{timers.set(++id,f);return id;},clearTimeout:i=>timers.delete(i),addEventListener:(n,f)=>windowEvents.set(n,f),MutationObserver:class{constructor(f){this.f=f;}observe(target){if(target===shell)observer=this.f;}},ResizeObserver:class{observe(){}}};
 const contextVm=vm.createContext({window,document,Math});vm.runInContext(source,contextVm);
 return{frames,paints,canvas,shell,document,media,timers,window,rerun:()=>vm.runInContext(source,contextVm),show(v){shell.hidden=!v;observer();},hide(v){document.hidden=v;events.get('visibilitychange')();},tick(t){const [i,f]=frames.entries().next().value;frames.delete(i);f(t);},reduce(v){media.matches=v;motionChange();},page(n){windowEvents.get(n)();},resize(w){width=w;window.innerWidth=w;left=w<1100?0:256;windowEvents.get('resize')();},flush(){for(const[i,f]of timers){timers.delete(i);f();}}};
}
test('all routes share one bounded canvas below the content and outside the sidebar',()=>{
 const c=cabinet();assert.equal(c.canvas.style.left,'256px');assert.equal(c.canvas.width,1776);assert.equal(c.canvas.height,1500);assert.ok(c.paints.length>0&&c.paints.length<6800);assert.ok(c.paints.every(p=>' .:-=+*#%@'.includes(p.g)&&p.alpha>=0&&p.alpha<=1));
 c.rerun();assert.equal(c.frames.size,1);
});
test('login screen has no animation; showing/hiding the authenticated shell resumes/stops one loop',()=>{
 const c=cabinet({hidden:true});assert.equal(c.frames.size,0);assert.equal(c.paints.length,0);c.show(true);assert.equal(c.frames.size,1);c.show(false);assert.equal(c.frames.size,0);c.show(true);assert.equal(c.frames.size,1);
});
test('motion is capped at 25fps and pauses in hidden tabs and the page cache',()=>{
 const c=cabinet();c.tick(100);const count=c.paints.length;c.tick(110);assert.equal(c.paints.length,count);c.tick(145);assert.ok(c.paints.length>count);c.hide(true);assert.equal(c.frames.size,0);c.hide(false);assert.equal(c.frames.size,1);c.page('pagehide');assert.equal(c.frames.size,0);c.page('pageshow');assert.equal(c.frames.size,1);
});
test('reduced motion and data saving draw a static field; resize follows mobile sidebar layout',()=>{
 const c=cabinet({reduced:true});assert.equal(c.frames.size,0);assert.ok(c.paints.length>0);c.resize(390);c.resize(320);assert.equal(c.timers.size,1);c.flush();assert.equal(c.canvas.style.left,'0px');assert.equal(c.canvas.width,480);assert.equal(c.frames.size,0);c.reduce(false);assert.equal(c.frames.size,1);c.reduce(true);assert.equal(c.frames.size,0);
 const low=cabinet({saveData:true});assert.equal(low.frames.size,0);assert.ok(low.paints.length>0);
});
