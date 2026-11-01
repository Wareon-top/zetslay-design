import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../landing-faq.js',import.meta.url),'utf8');
function node(extra={}) {
  return {hidden:true,events:{},attrs:{},focused:false,value:'',
    addEventListener(type,fn){this.events[type]=fn;},
    setAttribute(name,value){this.attrs[name]=value;},
    focus(){this.focused=true;},...extra};
}
function page({present=true}={}) {
  const controls=Object.fromEntries(['tools','search','clear','reset','empty','count'].map(name=>[name,node()]));
  const buttons=['all','connection','plugins','tariffs','security'].map(category=>node({dataset:{faqFilter:category}}));
  const items=[
    node({dataset:{faqCategory:'connection'},textContent:'Как подключить магазин? Нужен прокси и Golden Key.',open:true}),
    node({dataset:{faqCategory:'plugins'},textContent:'Плагины отправляют сообщения покупателю.',open:false}),
    node({dataset:{faqCategory:'tariffs'},textContent:'Тариф: платёж за месяц или год.',open:false}),
    node({dataset:{faqCategory:'security'},textContent:'Ключи доступа хранятся зашифрованно.',open:false})
  ];
  const root={
    querySelector:s=>controls[s.replace('[data-faq-','').replace(']','')],
    querySelectorAll:s=>s==='[data-faq-filter]'?buttons:items
  };
  vm.runInNewContext(source,{document:{querySelector:()=>present?root:null}});
  return {controls,buttons,items,search(query){controls.search.value=query;controls.search.events.input();},choose(category){buttons.find(b=>b.dataset.faqFilter===category).events.click();}};
}

test('enhancement exposes controls and initial count without hiding any FAQ',()=>{
  const p=page();
  assert.equal(p.controls.tools.hidden,false);
  assert.equal(p.controls.count.textContent,'Найдено: 4 из 4');
  assert.ok(p.items.every(i=>!i.hidden));
  assert.equal(p.buttons[0].attrs['aria-pressed'],'true');
});

test('search matches answer text, normalizes Cyrillic case and ё, and combines with category',()=>{
  const p=page();
  p.search('  ПЛАТЕЖ   ГОД  ');
  assert.deepEqual(p.items.map(i=>i.hidden),[true,true,false,true]);
  p.choose('security');
  assert.equal(p.controls.empty.hidden,false);
  p.search('ключи зашифрованно');
  assert.deepEqual(p.items.map(i=>i.hidden),[true,true,true,false]);
  assert.equal(p.controls.count.textContent,'Найдено: 1 из 4');
  assert.equal(p.buttons.filter(b=>b.attrs['aria-pressed']==='true').length,1);
});

test('clear, Escape and reset recover from empty searches and reset restores all categories',()=>{
  const p=page();
  p.choose('plugins');
  p.search('<img src=x onerror=alert(1)>');
  assert.equal(p.controls.empty.hidden,false);
  p.controls.clear.events.click();
  assert.equal(p.controls.search.value,'');
  assert.equal(p.controls.search.focused,true);
  assert.equal(p.controls.count.textContent,'Найдено: 1 из 4');
  p.search('nothing');
  let prevented=false;
  p.controls.search.events.keydown({key:'Escape',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(p.controls.search.value,'');
  p.controls.reset.events.click();
  assert.ok(p.items.every(i=>!i.hidden));
  assert.equal(p.controls.empty.hidden,true);
  assert.equal(p.buttons[0].attrs['aria-pressed'],'true');
});

test('native accordion fallback closes other answers and enhancer ignores unrelated pages',()=>{
  const p=page();
  p.items[1].open=true;
  p.items[1].events.toggle();
  assert.equal(p.items[0].open,false);
  assert.equal(p.items[1].open,true);
  p.items[1].open=false;
  assert.doesNotThrow(()=>p.items[1].events.toggle());
  assert.doesNotThrow(()=>page({present:false}));
});
