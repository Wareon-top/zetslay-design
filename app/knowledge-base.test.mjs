import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./knowledge-base.js',import.meta.url),'utf8');
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
function harness({href='https://zetslay.pro/app/#guide',clipboard=async()=>{},missing=false}={}) {
 const nodes=new Map(),listeners=new Map(),calls=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:'',hidden:false,attributes:{},dataset:{},setAttribute(k,v){this.attributes[k]=v},focus(){calls.push(['focus',id])},select(){calls.push(['select',id])},scrollIntoView(options){calls.push(['scroll',id,options])},querySelector:node});return nodes.get(id)};
 const categories=['all','connection','store','plugins','kosell','account','diagnostics'].map(id=>{const n=node('category-'+id);n.dataset.kbCategory=id;return n});
 const root={querySelector:node,querySelectorAll:()=>categories,addEventListener:(type,callback)=>listeners.set(type,callback)};
 let address=new URL(href);
 const context=vm.createContext({document:{querySelector:()=>missing?null:root},URL,history:{replaceState(_a,_b,url){address=new URL(url,address);calls.push(['history',address.href])}},location:{get href(){return address.href},get origin(){return address.origin},get pathname(){return address.pathname}},navigator:{clipboard:{writeText:clipboard}},window:{matchMedia:()=>({matches:true})},setView:(...args)=>calls.push(['route',...args]),fetch:()=>{throw Error('Guides must not fetch private data')}});
 const run=code=>vm.runInContext(code,context);
 run(source);
 const search=(query,category='all')=>{context.query=query;context.category=category;return JSON.parse(JSON.stringify(run('kbSearch(query,category)')))};
 const click=(selector,data={})=>listeners.get('click')({target:{closest:s=>s.split(',').map(x=>x.trim()).includes(selector)?{dataset:data}:null}});
 return {run,node,search,context,calls,click,listeners,categories,get href(){return address.href}};
}
test('the essential library contains five guides with valid related links',()=>{
 const app=harness(),articles=app.search('');assert.equal(app.node('[data-kb-count]').textContent,'5');assert.equal(app.node('[data-kb-total]').textContent,'5');
 assert.deepEqual(articles.map(a=>a.id),['connect','golden-key','golden-key-android','golden-key-iphone','connection-errors']);
 for(const article of articles){assert.ok(article.sections.length);for(const id of article.related)assert.ok(articles.some(a=>a.id===id));}
 assert.doesNotMatch(app.node('[data-kb-categories]').innerHTML,/Kosell Rent/);
 assert.equal(app.categories[0].attributes['aria-pressed'],'true');
});
test('search finds device guides and connection errors without the removed advanced catalogue',()=>{
 const app=harness();assert.equal(app.search('proxy_timeout')[0].id,'connection-errors');assert.equal(app.search('Golden Key')[0].id,'golden-key');
 assert.equal(app.search('Android')[0].id,'golden-key-android');assert.equal(app.search('Orion')[0].id,'golden-key-iphone');
 assert.equal(app.search('','keys').length,3);assert.equal(app.search('KOSELL_UNAVAILABLE').length,0);assert.equal(app.run("kbNormalize('ЗАВЕРШЁН')"),'завершен');
 assert.equal(app.search('[.*<script>not-in-articles</script>]').length,0);
});
test('search and reset preserve focus and reject unknown categories',()=>{
 const app=harness();app.click('[data-kb-category]',{kbCategory:'keys'});assert.equal(app.node('[data-kb-count]').textContent,'3');
 app.listeners.get('input')({target:{matches:()=>true,value:'нету такого материала'}});assert.match(app.node('[data-kb-results]').innerHTML,/Ничего не найдено/);
 app.click('[data-kb-reset]');assert.equal(app.node('[data-kb-count]').textContent,'5');assert.equal(app.run('kbState.query'),'');assert.equal(app.run('kbState.category'),'all');
 assert.deepEqual(app.calls.at(-1),['focus','[data-kb-search]']);app.click('[data-kb-category]',{kbCategory:'made-up'});assert.equal(app.run('kbState.category'),'all');
});
test('reader and Escape preserve search state without requesting credentials or automation',()=>{
 const app=harness();app.click('[data-kb-category]',{kbCategory:'keys'});app.click('[data-kb-open]',{kbOpen:'golden-key-android'});
 assert.equal(app.run('kbState.article'),'golden-key-android');assert.equal(app.node('[data-kb-library]').hidden,true);
 assert.match(app.node('[data-kb-reader]').innerHTML,/Firefox/);assert.match(app.node('[data-kb-reader]').innerHTML,/data-open-connect/);
 assert.equal(new URL(app.href).searchParams.get('kb'),'golden-key-android');let prevented=false;app.listeners.get('keydown')({key:'Escape',preventDefault(){prevented=true}});
 assert.ok(prevented);assert.equal(app.node('[data-kb-library]').hidden,false);assert.equal(app.node('[data-kb-count]').textContent,'3');assert.equal(new URL(app.href).searchParams.has('kb'),false);
 assert.equal(app.run("kbOpen('<script>')"),false);
});
test('old proxy and Telegram links open the concise connection guide; malformed links cannot inject HTML',()=>{
 const app=harness({href:'https://zetslay.pro/app/?kb=proxy#guide'});assert.equal(app.run('kbState.article'),'connect');assert.ok(app.calls.some(c=>c[0]==='route'&&c[1]==='guide'));
 assert.equal(app.run("kbOpen('telegram')"),true);assert.equal(app.run('kbState.article'),'connect');
 const unknown=harness({href:'https://zetslay.pro/app/?kb=%3Cscript%3E#guide'});assert.equal(unknown.run('kbState.article'),null);assert.equal(unknown.node('[data-kb-count]').textContent,'5');
 assert.equal(app.run("kbEscape('<img onerror=1>')"),'&lt;img onerror=1&gt;');
});
test('copy shares only the guide URL, with a selectable fallback and stale-result isolation',async()=>{
 let copied='';const app=harness({href:'https://zetslay.pro/app/?auth_token=SECRET&other=PRIVATE#guide',clipboard:async text=>{copied=text}});
 app.run("kbOpen('golden-key')");await app.run('kbCopy()');assert.equal(copied,'https://zetslay.pro/app/?kb=golden-key#guide');assert.doesNotMatch(copied,/SECRET|PRIVATE/);
 const fallback=harness({clipboard:async()=>{throw Error('denied')}});fallback.run("kbOpen('connect')");await fallback.run('kbCopy()');assert.equal(fallback.node('[data-kb-share-link]').hidden,false);
 let finish;const late=harness({clipboard:()=>new Promise(resolve=>{finish=resolve})});late.run("kbOpen('connect')");const pending=late.run('kbCopy()');late.run("kbOpen('golden-key')");finish();await pending;assert.equal(late.node('[data-kb-copy-status]').textContent,'');
});
test('device guidance sends keys to the web field, includes the iOS limitation and uses verified extension sources',()=>{
 const app=harness();for(const id of ['golden-key','golden-key-android','golden-key-iphone']){
  const a=app.search('').find(a=>a.id===id);assert.match(JSON.stringify(a),/не отправляйте боту или поддержке/);assert.match(JSON.stringify(a),/поле Golden Key/);
 }
 assert.match(JSON.stringify(app.search('').find(a=>a.id==='golden-key-iphone')),/экспериментальная/);
 assert.doesNotMatch(JSON.stringify(app.search('')),/Kiwi|самое популярное|Add to Chrome/);
 assert.match(source,/https:\/\/cookie-editor\.com\//);assert.match(source,/https:\/\/addons\.mozilla\.org\/en-US\/firefox\/addon\/cookie-editor\//);
});
test('article actions and icons resolve, banners remain outside the reader, and reduced motion works',()=>{
 const app=harness();for(const article of app.search('')){app.context.article=article;const markup=app.run('kbAction(article)');assert.doesNotMatch(markup,/data-kosell-buy|data-toggle|data-plugin-id/);}
 for(const name of ['shield','user','help','search','chevron','external'])assert.ok(html.includes(`id="i-${name}"`));
 assert.match(html,/data-video-guide="guide"/);assert.match(html,/data-proxy-invite="guide"/);assert.match(html,/for="kb-search"/);
 app.run("kbOpen('golden-key')");app.click('[data-kb-section]',{kbSection:'1'});assert.equal(app.calls.find(c=>c[0]==='scroll')[2].behavior,'auto');assert.doesNotThrow(()=>harness({missing:true}));
});
