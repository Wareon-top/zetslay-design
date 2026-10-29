import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync,readdirSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
const base=new URL('./',import.meta.url).pathname;
function run(failure=''){
 const tmp=mkdtempSync(join(tmpdir(),'zs-kosell-offer-ui-'));
 try{
  const site=join(tmp,'site'),bin=join(tmp,'bin'),backups=join(tmp,'backups');for(const dir of [join(site,'app'),bin,backups])mkdirSync(dir,{recursive:true});
  const original={};for(const name of ['app/index.html','app/app.js','app/kosell-rent.js','app/overview.js','app/admin-panel.js'])original[name]=readFileSync(join(base,name),'utf8');
  original['app/index.html']+='\n<!-- OWNED_LOCAL_CONTENT -->\n';original['app/kosell-rent.js']+='\nfunction customKosellSetting(){return "OWNED";}\n';
  // Reproduce the live VPS module whose old enabled-only card failed test #36.
  original['app/kosell-rent.js']=original['app/kosell-rent.js'].replace(/<article><span>Автоматическая выдача<\/span>[\s\S]*?<\/article>/,"<article><span>Автоматическая выдача</span><strong>${c.automatic?'Включена':'Выключена'}</strong><small>Автопокупка включается отдельно</small></article>");

  original['app/app.js']=original['app/app.js'].replace('init();','// OWNED_APP_SETTINGS\ninit();');
  // Older cabinets lack both the partial-error label and its warning colour.
  original['app/admin-panel.js']=original['app/admin-panel.js'].replace("partial:'Ошибка отдельного плагина',",'').replace("['blocked','retrying','partial']","['blocked','retrying']");
  if(failure==='shape')original['app/kosell-rent.js']=original['app/kosell-rent.js'].replace('function kosellAutomationFields(','function unknownSettings(');
  for(const [name,content]of Object.entries(original))writeFileSync(join(site,name),content);
  const header=`#!${process.execPath}\nimport {readFileSync,renameSync} from 'node:fs';\nconst a=process.argv.slice(2);\n`;
  writeFileSync(join(bin,'git'),header+`if(a[0]==='rev-parse')console.log('pinned');else if(a[0]==='show')process.stdout.write(readFileSync(process.env.SOURCE_ROOT+'/'+a[1].split(':').slice(1).join(':'),'utf8'));`,{mode:0o755});
  writeFileSync(join(bin,'mv'),header+`if(process.env.FAIL_STEP==='install'&&a.at(-1)==='app/index.html')process.exit(1);renameSync(a.at(-2),a.at(-1));`,{mode:0o755});
  if(failure==='tests')writeFileSync(join(bin,'node'),header+`import {spawnSync} from 'node:child_process';if(a[0]==='--test'){console.log('not ok 1 - staged behavior failed');process.exit(1);}const r=spawnSync(${JSON.stringify(process.execPath)},a,{stdio:'inherit'});process.exit(r.status??1);`,{mode:0o755});
  const childEnv={...process.env,PATH:bin+':'+process.env.PATH,SOURCE_ROOT:base,ZETSLAY_SITE_DIR:site,ZETSLAY_BACKUP_DIR:backups,ZETSLAY_RELIABILITY_DESIGN_REVISION:'pinned',FAIL_STEP:failure};
  // The updater starts an independent suite; inheriting the parent test marker
  // makes Node skip that suite as a recursive runner instead of executing it.
  delete childEnv.NODE_TEST_CONTEXT;
  const result=spawnSync('bash',[join(base,'deploy/update-reliability-ui.sh')],{encoding:'utf8',env:childEnv});
  const files=Object.fromEntries(Object.keys(original).map(name=>[name,readFileSync(join(site,name),'utf8')]));const artifacts=readdirSync(backups);return {...result,files,original,backups:artifacts.filter(name=>name.endsWith('.tar.gz')),logs:Object.fromEntries(artifacts.filter(name=>name.endsWith('.tap')).map(name=>[name,readFileSync(join(backups,name),'utf8')])),locked:existsSync(join(site,'.zetslay-reliability-ui-update.lock'))};
 }finally{rmSync(tmp,{recursive:true,force:true});}
}
test('Reliability UI updater stages and tests diagnostics, preserving local settings and other cabinet modules',()=>{const r=run();assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(r.backups.length,1);assert.equal(Object.keys(r.logs).length,1);assert.match(Object.values(r.logs)[0],/# fail 0/);assert.ok(Number(/# pass (\d+)/.exec(Object.values(r.logs)[0])?.[1])>=75);assert.match(r.files['app/index.html'],/OWNED_LOCAL_CONTENT/);assert.match(r.files['app/kosell-rent.js'],/customKosellSetting/);assert.doesNotMatch(r.original['app/kosell-rent.js'],/Готова к новым заказам/);assert.match(r.files['app/kosell-rent.js'],/MAPPINGS_MISSING/);assert.match(r.files['app/kosell-rent.js'],/Готова к новым заказам/);assert.match(r.files['app/app.js'],/AbortSignal.timeout/);assert.match(r.files['app/overview.js'],/Накопленная история/);assert.match(r.files['app/admin-panel.js'],/Конфликты автовыдачи/);assert.match(r.files['app/admin-panel.js'],/partial:'Ошибка отдельного плагина'/);assert.equal(r.locked,false);});
test('unrecognized live module stops before installation and backup without altering the site',()=>{const r=run('shape');assert.equal(r.status,1);assert.deepEqual(r.files,r.original);assert.equal(r.backups.length,0);assert.equal(r.locked,false);});
test('partial install failure restores the previous Kosell module and HTML',()=>{const r=run('install');assert.equal(r.status,1);assert.deepEqual(r.files,r.original);assert.equal(r.locked,false);assert.match(r.stdout,/Файлы восстановлены/);});
test('failed staged browser checks retain the TAP reason, release the lock and never install files',()=>{const r=run('tests');assert.equal(r.status,1,r.stdout+r.stderr);assert.deepEqual(r.files,r.original);assert.equal(r.backups.length,0);assert.equal(Object.keys(r.logs).length,1);assert.match(Object.values(r.logs)[0],/not ok 1 - staged behavior failed/);assert.match(r.stdout,/Файлы сайта не изменены/);assert.equal(r.locked,false);});
