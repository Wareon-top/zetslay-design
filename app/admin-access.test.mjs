import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('./app.js',import.meta.url),'utf8');
const helpers = ['isPluginCatalogOwner','canManagePluginCatalog','renderPluginAdminAccess'].map(name=>{
  const match = source.match(new RegExp(`^function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?^\\}`,'m'));
  assert.ok(match,`missing ${name}`);
  return match[0];
}).join('\n');
function harness() {
  const controls = {hidden:false,innerHTML:'old administrative controls'};
  const buttons = [{hidden:false},{hidden:false}];
  const body = {innerHTML:'old editor'};
  const upload = {value:'selected',dataset:{pluginId:'zetslay.test',coverFor:'zetslay.test'}};
  const root = {dataset:{}};
  const document = {documentElement:root,
    querySelectorAll:selector=>selector==='[data-plugin-admin-controls]'?[controls]:buttons,
    querySelector:selector=>selector==='[data-plugin-cover-input]'?upload:selector==='[data-plugin-dialog]'?{querySelector:selector=>selector==='[data-plugin-editor]'?{}:body}:null};
  const context = vm.createContext({document,authState:{token:'existing-session',user:{telegramUserId:'5062414502'}},state:{pluginCanManage:true,pluginCoverAdmin:true},closed:0,closePluginDialog:()=>context.closed++});
  vm.runInContext(helpers,context);
  return {context,controls,buttons,body,upload,root,run:code=>vm.runInContext(code,context)};
}

test('catalog editing needs an owner session and an explicit API grant together', () => {
  const app = harness();
  assert.equal(app.run('canManagePluginCatalog()'),true);
  for (const code of ["authState.token=''","authState.user=null","authState.user={telegramUserId:'123456789',role:'admin'}","authState.user={telegramUserId:5062414502}","state.pluginCanManage='true'","state.pluginCanManage=false"]) {
    app.run("authState.token='existing-session'; authState.user={telegramUserId:'5062414502'}; state.pluginCanManage=true");
    app.run(code);
    assert.equal(app.run('canManagePluginCatalog()'),false,code);
  }
});

test('revocation hides old controls and clears selected cover and editor contents', () => {
  const app = harness();
  app.run('renderPluginAdminAccess()');
  assert.equal(app.root.dataset.catalogAdmin,'true');
  app.run("authState.user.telegramUserId='123456789'; renderPluginAdminAccess()");
  assert.equal(app.root.dataset.catalogAdmin,'false');
  assert.equal(app.controls.hidden,true);
  assert.equal(app.controls.innerHTML,'');
  assert.ok(app.buttons.every(button=>button.hidden));
  assert.equal(app.body.innerHTML,'');
  assert.equal(app.upload.value,'');
  assert.equal(app.upload.dataset.pluginId,undefined);
  assert.equal(app.upload.dataset.coverFor,undefined);
  assert.equal(app.context.state.pluginCoverAdmin,false);
  assert.equal(app.context.closed,1);
});

test('default-deny CSS hides admin actions before scripts load without hiding plugin settings', () => {
  const css = readFileSync(new URL('./admin-access.css',import.meta.url),'utf8');
  assert.match(css,/html:not\(\[data-catalog-admin="true"\]\)/);
  assert.match(css,/display: none !important/);
  assert.doesNotMatch(css,/data-plugin-id|data-reminder-open-settings|data-plugin-open-settings/);
});
