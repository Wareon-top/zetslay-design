import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../landing-footer.js',import.meta.url),'utf8');
function fixture({reduced=false,hash=''}={}) {
  const handlers={},history=[],year={textContent:''};let reset=0,focused=0,scroll=null;
  const question={open:false,hidden:true,matches:s=>s==='details[data-faq-item]',querySelector:()=>({focus:()=>focused++}),scrollIntoView:options=>scroll=options};
  const anchor={getAttribute:()=> '#faq-errors'};
  const footer={querySelector:()=>year,contains:a=>a===anchor,addEventListener:(type,fn)=>handlers[type]=fn};
  const document={querySelector:s=>s==='[data-faq-reset]'?{click:()=>{reset++;question.hidden=false;}}:footer,getElementById:id=>id==='faq-errors'?question:null};
  const context=vm.createContext({document,Date,location:{hash},history:{pushState:(_a,_b,url)=>history.push(url)},window:{matchMedia:()=>({matches:reduced}),addEventListener:(type,fn)=>handlers[type]=fn}});
  vm.runInContext(source,context);
  return {handlers,history,question,anchor,year,counts:()=>({reset,focused,scroll})};
}
test('footer opens a filtered FAQ answer, updates the address and focuses its summary',()=>{
  const f=fixture();let prevented=0;
  f.handlers.click({button:0,target:{closest:()=>f.anchor},preventDefault:()=>prevented++});
  assert.equal(prevented,1);assert.equal(f.question.open,true);assert.deepEqual(f.history,['#faq-errors']);
  assert.equal(f.counts().reset,1);assert.equal(f.counts().focused,1);assert.equal(f.counts().scroll.behavior,'smooth');
  assert.equal(f.year.textContent,String(new Date().getFullYear()));
});
test('modified clicks retain native navigation; reduced motion avoids smooth scrolling',()=>{
  const f=fixture({reduced:true});
  f.handlers.click({button:0,ctrlKey:true,target:{closest:()=>f.anchor},preventDefault:()=>assert.fail()});
  assert.equal(f.question.open,false);
  f.handlers.click({button:0,target:{closest:()=>f.anchor},preventDefault:()=>{}});
  assert.equal(f.counts().scroll.behavior,'auto');
});
test('a bookmarked FAQ answer opens on load and unrelated hashes remain untouched',()=>{
  assert.equal(fixture({hash:'#faq-errors'}).question.open,true);
  assert.equal(fixture({hash:'#plugins'}).question.open,false);
});
