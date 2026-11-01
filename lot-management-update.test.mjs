import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync,readdirSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
const base=new URL('./',import.meta.url).pathname;
function run(failure=''){
 const tmp=mkdtempSync(join(tmpdir(),'zs-lot-management-ui-'));
 try{
  const site=join(tmp,'site'),bin=join(tmp,'bin'),backups=join(tmp,'backups');for(const dir of [join(site,'app'),bin,backups])mkdirSync(dir,{recursive:true});
  const original={};for(const name of ['app/index.html','app/app.js','app/lots.js']){original[name]=readFileSync(join(base,name),'utf8');writeFileSync(join(site,name),original[name]);}
  original['app/index.html']+='\n<!-- OWNED_LOCAL_CONTENT -->\n';writeFileSync(join(site,'app/index.html'),original['app/index.html']);
  const header=`#!${process.execPath}\nimport {readFileSync,renameSync} from 'node:fs';\nconst a=process.argv.slice(2);\n`;
  writeFileSync(join(bin,'git'),header+`if(a[0]==='rev-parse')console.log('pinned');else if(a[0]==='show')process.stdout.write(readFileSync(process.env.SOURCE_ROOT+'/'+a[1].split(':').slice(1).join(':'),'utf8'));`,{mode:0o755});
  writeFileSync(join(bin,'mv'),header+`if(process.env.FAIL_STEP==='install'&&a.at(-1)==='app/lot-management.js')process.exit(1);renameSync(a.at(-2),a.at(-1));`,{mode:0o755});
  if(failure==='shape')writeFileSync(join(site,'app/lots.js'),original['app/lots.js'].replace('function lotRowsMarkup(','function unknownRows('));
  const before=readFileSync(join(site,'app/lots.js'),'utf8');
  const result=spawnSync('bash',[join(base,'deploy/update-lot-management-ui.sh')],{encoding:'utf8',env:{...process.env,PATH:bin+':'+process.env.PATH,SOURCE_ROOT:base,ZETSLAY_SITE_DIR:site,ZETSLAY_BACKUP_DIR:backups,ZETSLAY_LOT_MANAGEMENT_DESIGN_REVISION:'pinned',FAIL_STEP:failure}});
  const files=Object.fromEntries(Object.keys(original).map(name=>[name,readFileSync(join(site,name),'utf8')]));
  return {...result,files,original,before,newHelper:existsSync(join(site,'app/lot-management.js')),newLanding:existsSync(join(site,'app/lot-management.css')),backups:readdirSync(backups),locked:existsSync(join(site,'.zetslay-lot-management-update.lock'))};
 }finally{rmSync(tmp,{recursive:true,force:true});}
}
test('frontend updater verifies staged behavior before atomically installing and preserving local UI',()=>{const r=run();assert.equal(r.status,0,r.stdout+r.stderr);assert.ok(r.newHelper&&r.newLanding);assert.ok(r.backups.length===1);assert.match(r.files['app/index.html'],/OWNED_LOCAL_CONTENT/);assert.equal(r.locked,false);});
test('unknown live authentication shape fails before installation without deleting site files',()=>{const r=run('shape');assert.equal(r.status,1);assert.equal(r.files['app/lots.js'],r.before);assert.equal(r.files['app/index.html'],r.original['app/index.html']);assert.equal(r.newHelper,false);assert.equal(r.backups.length,0);assert.equal(r.locked,false);});
test('partial file install failure restores existing files and removes newly introduced assets',()=>{const r=run('install');assert.equal(r.status,1);assert.deepEqual(r.files,r.original);assert.equal(r.newHelper,false);assert.equal(r.newLanding,false);assert.equal(r.locked,false);assert.match(r.stdout,/Файлы восстановлены/);});
