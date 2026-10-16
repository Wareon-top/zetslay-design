const {chromium} = require(process.env.ZETSLAY_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs'), http = require('http'), path = require('path'), assert = require('assert');
const site = path.resolve(__dirname, '..');
const out = process.env.ZETSLAY_BROWSER_OUTPUT || path.join(require('os').tmpdir(), 'zetslay-launch-previews');
fs.mkdirSync(out, {recursive: true});
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://local');
  let file = path.join(site, decodeURIComponent(url.pathname));
  if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
  if (!file.startsWith(site + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {res.statusCode = 404; return res.end();}
  const types = {'.html':'text/html', '.css':'text/css', '.js':'application/javascript', '.svg':'image/svg+xml', '.woff2':'font/woff2'};
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/json');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({executablePath:process.env.ZETSLAY_TEST_BROWSER_PATH || undefined, headless:true, args:['--no-sandbox']});
  const context = await browser.newContext({viewport:{width:1440, height:1000}}), errors=[];
  try {
    await context.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.fulfill({status:401, contentType:'application/json', body:'{"error":{"code":"UNAUTHORIZED"}}'}));
    async function prepare(page, user='launch-user') {
      page.on('pageerror', e => errors.push(e.message));
      await page.clock.install();
      await page.goto(base + '/app/');
      await page.waitForFunction(() => !!window.ZetSlayLaunchAnnouncement);
      await page.evaluate(user => {
        window.launchFixture = {requests:[]};
        apiRequest = async (p,o={}) => {
          launchFixture.requests.push({path:p,method:o.method || 'GET'});
          if (p === '/api/v1/learning') return {version:1,revision:1,welcomeSeen:true,status:'completed',step:5};
          if (p === '/api/v1/subscription/status') return {workspace:authState.workspace,trial:{state:'used'},discounts:[]};
          return {};
        };
        authState.user={id:user,email:'launch-test@example.invalid'};
        authState.token='local-browser-fixture';
        authState.workspace={id:'launch-workspace',plan:{active:false},pluginLicenses:[]};
        state.storeFleet={selectedStoreId:null,stores:[],capacity:{used:0,limit:1}};
        renderAuthState();setAuthModal(false);setView('dashboard');
        document.activeElement?.blur();
      }, user);
      await page.clock.fastForward(600);
    }
    async function show(page) {
      await page.clock.fastForward(4000);
      await page.locator('.launch-notice').waitFor();
      await page.waitForTimeout(550);
    }
    const page = await context.newPage();
    await prepare(page);
    await page.evaluate(() => {const d=document.createElement('dialog');d.id='launch-test-blocker';d.innerHTML='<button>Продолжить</button>';document.body.append(d);d.showModal();});
    await page.clock.fastForward(5000);
    assert.equal(await page.locator('.launch-notice').count(), 0);
    assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(k=>k.startsWith('zetslay.announcement.')).length), 0);
    await page.evaluate(() => {document.querySelector('#launch-test-blocker').remove();document.activeElement?.blur();});
    await show(page);
    assert.equal(await page.locator('.launch-notice').getAttribute('aria-labelledby'), 'launch-notice-title');
    assert.equal(await page.evaluate(() => document.activeElement.closest('.launch-notice') === null), true);
    assert.equal(await page.locator('.launch-notice__cover img').evaluate(n=>n.complete && n.naturalWidth>0), true);
    await page.screenshot({path:path.join(out,'launch-desktop.png')});
    if (process.env.ZETSLAY_LAUNCH_INLINE_PREVIEW === '1') {
      const preview = await page.locator('.launch-notice').screenshot();
      console.log('LAUNCH_PREVIEW=' + preview.toString('base64'));
    }
    await page.locator('.launch-notice__more').click();
    await page.locator('.launch-article[open]').waitFor();
    assert.match(await page.locator('.launch-access').textContent(), /кроме легендарных/);
    assert.equal(await page.evaluate(()=>document.querySelector('.launch-article').contains(document.activeElement)), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=>document.querySelector('.launch-article').contains(document.activeElement)), true);
    await page.screenshot({path:path.join(out,'launch-article-desktop.png')});
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.launch-article').count(), 0);
    await page.clock.fastForward(5000);
    assert.equal(await page.locator('.launch-notice').count(), 0);
    // Re-open the real cabinet in the same browser: the stored preference survives.
    const second = await context.newPage();await prepare(second);await second.clock.fastForward(5000);
    assert.equal(await second.locator('.launch-notice').count(), 0);
    await second.close();await page.bringToFront();
    // Move the clock past the interval without firing seven days of unrelated timers.
    await page.clock.setSystemTime(Date.now()+7*86400000+60000);
    await page.evaluate(()=>ZetSlayLaunchAnnouncement.refresh());await show(page);
    await page.setViewportSize({width:390,height:844});
    await page.emulateMedia({reducedMotion:'reduce'});
    const rect = await page.locator('.launch-notice').boundingBox();
    assert.ok(rect.x>=15 && rect.x+rect.width<=375 && rect.y>=15 && rect.y+rect.height<=829);
    assert.equal(await page.locator('.launch-notice').evaluate(n=>getComputedStyle(n).animationName), 'none');
    await page.screenshot({path:path.join(out,'launch-mobile.png')});
    await page.locator('.launch-notice__more').click();
    await page.locator('.launch-article[open]').waitFor();
    assert.equal(await page.locator('.launch-article').evaluate(n=>n.scrollWidth<=n.clientWidth), true);
    await page.screenshot({path:path.join(out,'launch-article-mobile.png')});
    await page.locator('[data-launch-route="billing"]').click();
    assert.equal(await page.locator('[data-view].is-active').getAttribute('data-view'), 'billing');
    assert.equal(await page.locator('.launch-article').count(),0);
    // Switching account must not inherit the previous user's dismissal.
    await page.evaluate(()=>{resetAccountData();authState.user.id='launch-second-user';authState.token='rotated-fixture';sessionGeneration++;renderAuthState();setView('dashboard');document.activeElement?.blur();});
    await show(page);
    await page.setViewportSize({width:390,height:480});
    assert.equal(await page.locator('.launch-notice').evaluate(n=>n.scrollWidth<=n.clientWidth && n.getBoundingClientRect().top>=15),true);
    await page.locator('.launch-close').click();assert.equal(await page.locator('.launch-notice').count(),0);
    await page.evaluate(()=>{setView('orders');setView('dashboard');});await page.clock.fastForward(5000);assert.equal(await page.locator('.launch-notice').count(),0);
    const requests=await page.evaluate(()=>launchFixture.requests);
    assert.deepEqual(requests.filter(r=>r.method!=='GET'),[]);
    assert.equal(requests.some(r=>/payments\/(topup|purchase)/.test(r.path)),false);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,realCabinet:true,weeklyCadence:true,overlayPriority:true,accountIsolation:true,mobile:true,reducedMotion:true,financialWrites:0,browserErrors:errors}));
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
