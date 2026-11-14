import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context=vm.createContext({});
vm.runInContext(readFileSync(new URL('./model.js',import.meta.url),'utf8'),context);
const M=context.ZSCabinetModel;
test('reference URLs resolve to host routes, including old links',()=>{
  for(const [input,view,sub] of [['#/automation/templates','store-tools','templates'],['#proxy','proxy-shop',''],['#plugins/zetslay.kosell-rent','plugins/zetslay.kosell-rent',''],['#authors/author_123','authors/author_123',''],['/billing/plans','billing','plans'],['#security','security',''],['','dashboard','']]){
    const r=M.route(input);assert.equal(r.view,view);assert.equal(r.sub,sub);
  }
});
test('unknown plugins keep their backend ID and use generic tool artwork',()=>{
  assert.equal(M.category('new.vendor-plugin').id,'tools');
  assert.equal(M.art['new.vendor-plugin'],undefined);
});
test('presentation never infers successful delivery from enabled installation',()=>{
  assert.equal(M.stateOf({installed:true,active:true}).label,'Включён');
  assert.equal(M.stateOf({installed:true,active:false}).label,'На паузе');
  assert.equal(M.stateOf({installed:false,active:true}).label,'Не установлен');
  assert.equal(M.stateOf({published:false,installed:true,active:true}).label,'Черновик');
});
test('every seller section is represented once and cannot grant an admin role',()=>{
  const ids=M.groups.flatMap(g=>g.items.map(i=>i[0]));
  assert.equal(new Set(ids).size,18);assert.equal(ids.length,18);assert.ok(!ids.includes('admin'));
});
