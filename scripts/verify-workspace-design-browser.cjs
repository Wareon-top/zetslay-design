// Browser regression checks for the real public UI and local, disconnected cabinet markup.
const {chromium}=require(process.env.ZETSLAY_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const out=process.env.ZETSLAY_BROWSER_OUTPUT||path.join(__dirname,'../.cache/workspace-design');
(async()=>{
 const {reviewServer}=await import('./serve-design-review.mjs');await new Promise(r=>reviewServer.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+reviewServer.address().port;
 const browser=await chromium.launch({executablePath:process.env.ZETSLAY_TEST_BROWSER_PATH||undefined,headless:true,args:['--no-sandbox']});const errors=[],checks=[];await fs.mkdir(out,{recursive:true});
 try{
  const page=await browser.newPage({reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
  const widths=[320,390,768,1024,1440],views=['dashboard','orders','messages','lots','finance','automation','connection','diagnostics'];
  for(const width of widths){
   await page.setViewportSize({width,height:1000});
   for(const view of views){
    await page.goto(origin+'/demo/#'+view);await page.locator('#preview-content').waitFor();await page.evaluate(()=>document.fonts.ready);
    if(view==='diagnostics')await page.locator('[data-dc-select]').first().waitFor();
    const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(geometry.scroll<=geometry.width+1,JSON.stringify({view,width,geometry}));
    if(view==='dashboard'){
     const clipped=await page.locator('.demo-metrics strong').evaluateAll(nodes=>nodes.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.textContent));assert.deepEqual(clipped,[],'Clipped metric at '+width);
    }
    if(width===390&&view==='dashboard'){
     const menu=page.getByRole('button',{name:'Открыть меню',exact:true});await menu.click();assert.equal(await menu.getAttribute('aria-expanded'),'true');assert.equal(await page.locator('.preview-main').evaluate(n=>n.inert),true);
     await page.keyboard.press('Escape');assert.equal(await menu.getAttribute('aria-expanded'),'false');assert.equal(await menu.evaluate(n=>document.activeElement===n),true);
     await menu.click();await page.locator('.preview-sidebar [data-preview-view=messages]').click();await page.waitForURL('**/#messages');assert.equal(await page.locator('.preview-main').evaluate(n=>n.inert),false);
     await page.goto(origin+'/demo/#dashboard');
    }
    checks.push({width,view,noOverflow:true});
    if([390,1440].includes(width)&&['dashboard','messages','diagnostics','orders'].includes(view))await page.screenshot({path:path.join(out,view+'-'+width+'.png'),fullPage:view==='dashboard'});
   }
   for(const route of ['/','/docs/','/docs/funpay-connect/','/pricing/','/legal/','/security/']){
    await page.goto(origin+route);await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow '+route+' at '+width);checks.push({width,route,noOverflow:true});if([390,1440].includes(width)&&route==='/')await page.screenshot({path:path.join(out,'landing-'+width+'.png'),fullPage:false});
   }
  }
  for(const width of [390,1024,1440]){
   await page.setViewportSize({width,height:1000});await page.goto(origin+'/review/cabinet');
   for(const view of ['dashboard','orders','lots','billing','finance','profile','guide','support']){
    const target=page.locator('.sidebar-nav [data-view-target="'+view+'"]');if(width===390)await page.locator('[data-sidebar-open]').click();await target.click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,wrapper:[...document.querySelectorAll('.fin-table-wrap')].map(n=>({inShell:!!n.closest('.app-shell'),style:getComputedStyle(n).overflowX,position:getComputedStyle(n).position,flow:getComputedStyle(n).overflowY,scrollX,parents:[n.parentElement,n.parentElement.parentElement,document.body,document.documentElement].map(p=>({class:p.className,overflow:getComputedStyle(p).overflowX,width:p.clientWidth,scroll:p.scrollWidth})),contain:getComputedStyle(n).contain,width:n.clientWidth,parent:n.parentElement.className})),overflow:[...document.querySelectorAll('body *')].filter(n=>!n.closest('.fin-table-wrap')&&n.getBoundingClientRect().right>innerWidth+1&&n.getBoundingClientRect().width>0).slice(0,8).map(n=>({class:n.className,width:n.getBoundingClientRect().width,right:n.getBoundingClientRect().right}))}));if(bounds.scroll>bounds.width+1)await page.screenshot({path:path.join(out,'overflow.png'),fullPage:true});assert.ok(bounds.scroll<=bounds.width+1,'Cabinet overflow '+view+' at '+width+': '+JSON.stringify(bounds));checks.push({width,cabinet:view,noOverflow:true});
    if(width===1440&&['dashboard','billing','profile'].includes(view))await page.screenshot({path:path.join(out,'cabinet-'+view+'.png'),fullPage:false});
   }
  }
  await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/app/?auth=login');await page.locator('.auth-modal.is-open').waitFor();await page.screenshot({path:path.join(out,'login-1440.png')});
  assert.deepEqual(errors,[]);const report={passed:true,checks:checks.length,browserErrors:errors,widths,details:checks};await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,checks:checks.length,browserErrors:errors}));
 }finally{await browser.close();await new Promise(r=>reviewServer.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
