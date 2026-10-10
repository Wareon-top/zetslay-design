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
test('library initializes all published instructions with complete category counts',()=>{
 const app=harness();assert.equal(app.node('[data-kb-count]').textContent,'25');assert.equal(app.node('[data-kb-total]').textContent,'25');
 assert.equal(app.search('').length,25);assert.equal(new Set(app.search('').map(a=>a.id)).size,25);
 for(const article of app.search('')){assert.ok(article.sections.length);for(const id of article.related)assert.ok(app.search('').some(a=>a.id===id));}
 assert.match(app.node('[data-kb-categories]').innerHTML,/Kosell Rent/);
 assert.equal(app.categories[0].attributes['aria-pressed'],'true');
});
test('search matches Russian text, commands and error codes, ranks titles and combines categories',()=>{
 const app=harness();assert.equal(app.search('KOSELL_UNAVAILABLE')[0].id,'kosell-delivery');
 assert.equal(app.search('proxy_timeout')[0].id,'connection-errors');
 assert.equal(app.search('Golden Key')[0].id,'golden-key');
 assert.equal(app.search('повторно выдать')[0].id,'kosell-delivery');
 assert.equal(app.run("kbNormalize('ЗАВЕРШЁН')"),'завершен');
 assert.equal(app.search('  !steamcode  ')[0].id,'kosell-buyer');
 assert.equal(app.search('KOSELL_UNAVAILABLE','account').length,0);
 assert.equal(app.search('','kosell').length,4);
 assert.equal(app.search('[.*<script>not-in-articles</script>]').length,0);
});
test('input, categories and reset update results while preserving keyboard focus',()=>{
 const app=harness();app.click('[data-kb-category]',{kbCategory:'kosell'});assert.equal(app.node('[data-kb-count]').textContent,'4');
 app.listeners.get('input')({target:{matches:()=>true,value:'нету такого материала'}});
 assert.match(app.node('[data-kb-results]').innerHTML,/Ничего не найдено/);assert.equal(app.node('[data-kb-count]').textContent,'0');
 app.click('[data-kb-reset]');assert.equal(app.node('[data-kb-count]').textContent,'25');assert.equal(app.run('kbState.query'),'');assert.equal(app.run('kbState.category'),'all');
 assert.equal(app.node('[data-kb-search]').value,'');
 assert.deepEqual(app.calls.at(-1),['focus','[data-kb-search]']);
 app.click('[data-kb-category]',{kbCategory:'made-up'});assert.equal(app.run('kbState.category'),'all');
});
test('reader links and Escape restore search and category without any automation request',()=>{
 const app=harness();app.click('[data-kb-category]',{kbCategory:'kosell'});app.click('[data-kb-open]',{kbOpen:'kosell-delivery'});
 assert.equal(app.run('kbState.article'),'kosell-delivery');assert.equal(app.node('[data-kb-library]').hidden,true);
 assert.match(app.node('[data-kb-reader]').innerHTML,/Неизвестный результат покупки/);
 assert.match(app.node('[data-kb-reader]').innerHTML,/data-view-link="plugins\/zetslay.kosell-rent"/);
 assert.equal(new URL(app.href).searchParams.get('kb'),'kosell-delivery');
 let prevented=false;app.listeners.get('keydown')({key:'Escape',preventDefault(){prevented=true}});
 assert.ok(prevented);assert.equal(app.node('[data-kb-library]').hidden,false);assert.equal(app.node('[data-kb-count]').textContent,'4');assert.equal(new URL(app.href).searchParams.has('kb'),false);
 assert.equal(app.run("kbOpen('<script>')"),false);
});
test('deep links open the selected article and malformed links cannot inject markup',()=>{
 const app=harness({href:'https://zetslay.pro/app/?kb=proxy#guide'});assert.equal(app.run('kbState.article'),'proxy');assert.ok(app.calls.some(c=>c[0]==='route'&&c[1]==='guide'));
 const unknown=harness({href:'https://zetslay.pro/app/?kb=%3Cscript%3E#guide'});assert.equal(unknown.run('kbState.article'),null);assert.equal(unknown.node('[data-kb-count]').textContent,'25');
 assert.equal(app.run("kbEscape('<img onerror=1>')"),'&lt;img onerror=1&gt;');
});
test('copy shares only the article URL, with a selectable fallback and stale-result isolation',async()=>{
 let copied='';const app=harness({href:'https://zetslay.pro/app/?auth_token=SECRET&other=PRIVATE#guide',clipboard:async text=>{copied=text}});
 app.run("kbOpen('golden-key')");await app.run('kbCopy()');assert.equal(copied,'https://zetslay.pro/app/?kb=golden-key#guide');assert.doesNotMatch(copied,/SECRET|PRIVATE/);
 assert.match(app.node('[data-kb-copy-status]').textContent,/скопирована/);
 const fallback=harness({clipboard:async()=>{throw Error('denied')}});fallback.run("kbOpen('connect')");await fallback.run('kbCopy()');assert.equal(fallback.node('[data-kb-share-link]').hidden,false);assert.match(fallback.node('[data-kb-share-link]').value,/kb=connect/);
 let finish;const late=harness({clipboard:()=>new Promise(resolve=>{finish=resolve})});late.run("kbOpen('connect')");const pending=late.run('kbCopy()');late.run("kbOpen('proxy')");finish();await pending;assert.equal(late.node('[data-kb-copy-status]').textContent,'');
});
test('article actions target existing cabinet routes and plugin IDs; all icons resolve',()=>{
 const app=harness();
 for(const article of app.search('')){
  app.context.article=article;const markup=app.run('kbAction(article)');
  assert.doesNotMatch(markup,/data-kosell-buy|data-toggle|data-plugin-id/);
  if(article.action==='plugin')assert.ok(readFileSync(new URL('./plugin-rarity.js',import.meta.url),'utf8').includes(article.plugin));
  if(article.action==='support')assert.match(markup,/https:\/\/t.me\/zetslaysupport/);
 }
 for(const name of ['shield','bag','puzzle','bolt','user','help','search','chevron','external'])assert.ok(html.includes(`id="i-${name}"`));
 assert.match(html,/data-knowledge-base/);assert.match(html,/for="kb-search"/);assert.match(html,/knowledge-base.js\?v=20261010-knowledge-base/);
});
test('table of contents respects reduced motion and initialization tolerates missing mount',()=>{
 const app=harness();app.run("kbOpen('proxy')");app.click('[data-kb-section]',{kbSection:'1'});
 assert.equal(app.calls.find(c=>c[0]==='scroll')[2].behavior,'auto');assert.doesNotThrow(()=>harness({missing:true}));
});
