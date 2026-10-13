import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync,readdirSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
const base=new URL('./',import.meta.url).pathname;
function run(failure=''){
 const tmp=mkdtempSync(join(tmpdir(),'zs-kosell-offer-ui-'));
 try{
  const site=join(tmp,'site'),bin=join(tmp,'bin'),backups=join(tmp,'backups');for(const dir of [join(site,'app'),bin,backups])mkdirSync(dir,{recursive:true});
  const original={};for(const name of ['app/index.html','app/app.js','app/kosell-rent.js'])original[name]=readFileSync(join(base,name),'utf8');
  original['app/index.html']+='\n<!-- OWNED_LOCAL_CONTENT -->\n';original['app/kosell-rent.js']+='\nfunction customKosellSetting(){return "OWNED";}\n';
  // Reproduce the live VPS module whose old enabled-only card failed test #36.
  original['app/kosell-rent.js']=original['app/kosell-rent.js'].replace(/<article><span>Автоматическая выдача<\/span>[\s\S]*?<\/article>/,"<article><span>Автоматическая выдача</span><strong>${c.automatic?'Включена':'Выключена'}</strong><small>Автопокупка включается отдельно</small></article>");

  if(failure==='shape')original['app/kosell-rent.js']=original['app/kosell-rent.js'].replace('function kosellAutomationFields(','function unknownSettings(');
  for(const [name,content]of Object.entries(original))writeFileSync(join(site,name),content);
  const header=`#!${process.execPath}\nimport {readFileSync,renameSync} from 'node:fs';\nconst a=process.argv.slice(2);\n`;
  writeFileSync(join(bin,'git'),header+`if(a[0]==='rev-parse')console.log('pinned');else if(a[0]==='show')process.stdout.write(readFileSync(process.env.SOURCE_ROOT+'/'+a[1].split(':').slice(1).join(':'),'utf8'));`,{mode:0o755});
  writeFileSync(join(bin,'mv'),header+`if(process.env.FAIL_STEP==='install'&&a.at(-1)==='app/index.html')process.exit(1);renameSync(a.at(-2),a.at(-1));`,{mode:0o755});
  const result=spawnSync('bash',[join(base,'deploy/update-kosell-offer-recovery-ui.sh')],{encoding:'utf8',env:{...process.env,PATH:bin+':'+process.env.PATH,SOURCE_ROOT:base,ZETSLAY_SITE_DIR:site,ZETSLAY_BACKUP_DIR:backups,ZETSLAY_KOSELL_OFFER_RECOVERY_DESIGN_REVISION:'pinned',FAIL_STEP:failure}});
  const files=Object.fromEntries(Object.keys(original).map(name=>[name,readFileSync(join(site,name),'utf8')]));return {...result,files,original,backups:readdirSync(backups),locked:existsSync(join(site,'.zetslay-kosell-offer-recovery-update.lock'))};
 }finally{rmSync(tmp,{recursive:true,force:true});}
}
test('Kosell UI updater stages and tests diagnostics, preserving local settings and other cabinet modules',()=>{const r=run();assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(r.backups.length,1);assert.match(r.files['app/index.html'],/OWNED_LOCAL_CONTENT/);assert.match(r.files['app/kosell-rent.js'],/customKosellSetting/);assert.doesNotMatch(r.original['app/kosell-rent.js'],/Готова к новым заказам/);assert.match(r.files['app/kosell-rent.js'],/MAPPINGS_MISSING/);assert.match(r.files['app/kosell-rent.js'],/Готова к новым заказам/);assert.equal(r.files['app/app.js'],r.original['app/app.js']);assert.equal(r.locked,false);});
test('unrecognized live module stops before installation and backup without altering the site',()=>{const r=run('shape');assert.equal(r.status,1);assert.deepEqual(r.files,r.original);assert.equal(r.backups.length,0);assert.equal(r.locked,false);});
test('partial install failure restores the previous Kosell module and HTML',()=>{const r=run('install');assert.equal(r.status,1);assert.deepEqual(r.files,r.original);assert.equal(r.locked,false);assert.match(r.stdout,/Файлы восстановлены/);});
