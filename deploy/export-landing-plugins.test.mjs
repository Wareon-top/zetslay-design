import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./export-landing-plugins.mjs',import.meta.url),'utf8').replace(/^import pg from 'pg';\n/m,'');
async function run(rows,{fail=false}={}){
  const statements=[];let output='',error='',released=false,ended=false;
  const client={async query(sql,params){statements.push({sql,params});if(sql.startsWith('SELECT')){if(fail)throw new Error('secret database address and password');return {rows};}return {rows:[]};},release(){released=true;}};
  const context={pg:{Pool:class{async connect(){return client;}async end(){ended=true;}}},process:{env:{DATABASE_URL:'private connection string'},stdout:{write(value){output+=value;}},exitCode:0},console:{error(value){error+=value;}}};
  await vm.runInNewContext('(async()=>{'+source+'})()',context);
  return {statements,output,error,released,ended,exitCode:context.process.exitCode};
}
test('export is a read-only transaction and projects only public names, covers and visibility',async()=>{
  const result=await run([{id:'zetslay.kosell-rent',metadata:{name:'Kosell Rent',cover:'data:image/png;base64,public',published:true,apiKey:'TOP_SECRET',installation:{enabled:true},config:{secret:'TOP_SECRET'}}},{id:'foreign.plugin',metadata:{name:'Foreign',published:true}}]);
  assert.equal(result.statements[0].sql,'BEGIN READ ONLY');
  assert.equal(result.statements.at(-1).sql,'COMMIT');
  assert.ok(result.statements.every(({sql})=>!/UPDATE|INSERT|DELETE|CREATE/.test(sql)));
  assert.equal(JSON.parse(result.output).entries.length,1);
  assert.deepEqual(Object.keys(JSON.parse(result.output).entries[0]).sort(),['cover','id','name','published']);
  assert.doesNotMatch(result.output,/TOP_SECRET|installation|config|connection string/);
  assert.ok(result.released && result.ended);
});
test('unpublished cards remain explicitly hidden in the exported metadata',async()=>{
  const result=await run([{id:'zetslay.review-reminder',metadata:{name:'Draft',published:false}}]);
  assert.equal(JSON.parse(result.output).entries[0].published,false);
  const empty=await run([]);assert.deepEqual(JSON.parse(empty.output),{entries:[]});
});
test('database failure produces no partial public catalog and redacts connection errors',async()=>{
  const result=await run([],{fail:true});
  assert.equal(result.output,'');assert.equal(result.exitCode,1);
  assert.equal(result.statements.at(-1).sql,'ROLLBACK');
  assert.doesNotMatch(result.error,/secret|password|address/);
  assert.ok(result.released && result.ended);
});
