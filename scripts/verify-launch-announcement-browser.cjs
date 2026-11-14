// The launch announcement was retired at the owner's request (13.11.2026, commit b8d1510).
// This browser check keeps it retired: an authenticated dashboard on desktop and mobile waits well past
// the old quiet delay and must show no launch card, write no announcement storage and raise no errors.
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
  const types = {'.html':'text/html', '.css':'text/css', '.js':'application/javascript', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.webp':'image/webp', '.png':'image/png', '.woff2':'font/woff2', '.woff':'font/woff'};
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/json');
  res.end(fs.readFileSync(file));
});
(async () => {
  const html = fs.readFileSync(path.join(site, 'app/index.html'), 'utf8');
  assert.doesNotMatch(html, /launch-announcement\.(?:js|css)/, 'The cabinet must not load the retired launch announcement');
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({executablePath:process.env.ZETSLAY_TEST_BROWSER_PATH || undefined, headless:true, args:['--no-sandbox']});
  const errors = [];
  try {
    for (const [name, viewport, mobile] of [['desktop', {width:1440, height:1000}, false], ['mobile', {width:390, height:844}, true]]) {
      const context = await browser.newContext({viewport, isMobile:mobile, hasTouch:mobile});
      await context.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.fulfill({status:401, contentType:'application/json', body:'{"error":{"code":"UNAUTHORIZED"}}'}));
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(name + ': ' + e.message));
      await page.clock.install();
      await page.goto(base + '/app/');
      await page.waitForFunction(() => typeof renderAuthState === 'function' && typeof setView === 'function');
      await page.evaluate(() => {
        apiRequest = async p => {
          if (p === '/api/v1/learning') return {version:1, revision:1, welcomeSeen:true, status:'completed', step:5};
          if (p === '/api/v1/subscription/status') return {workspace:authState.workspace, trial:{state:'used'}, discounts:[]};
          return {};
        };
        authState.user = {id:'launch-user', email:'launch-test@example.invalid'};
        authState.token = 'local-browser-fixture';
        authState.workspace = {id:'launch-workspace', plan:{active:false}, pluginLicenses:[]};
        state.storeFleet = {selectedStoreId:null, stores:[], capacity:{used:0, limit:1}};
        renderAuthState(); setAuthModal(false); setView('dashboard'); document.activeElement?.blur();
      });
      // The retired card used a 3 s quiet delay; wait far beyond it, then across a week of cadence.
      await page.clock.fastForward(15000);
      await page.waitForTimeout(300);
      assert.equal(await page.locator('.launch-notice, [class*="launch-notice"]').count(), 0, name + ': launch card is shown');
      assert.equal(await page.evaluate(() => typeof window.ZetSlayLaunchAnnouncement), 'undefined', name + ': launch controller is active');
      assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('zetslay.announcement.')).length), 0, name + ': announcement storage written');
      await page.evaluate(() => setView('orders')); await page.evaluate(() => setView('dashboard'));
      await page.clock.fastForward(8 * 86400000);
      assert.equal(await page.locator('.launch-notice').count(), 0, name + ': launch card returns after a week');
      await page.screenshot({path:path.join(out, `launch-retired-${name}.png`)});
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('Launch announcement stays retired on desktop and mobile.');
  } finally {
    await browser.close(); server.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
