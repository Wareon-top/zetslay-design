const assert = require('node:assert/strict');
const http = require('node:http');
const { existsSync, readFileSync, mkdirSync } = require('node:fs');
const { extname, join, resolve, sep } = require('node:path');
const { chromium } = require(process.env.ZETSLAY_PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(__dirname, '..');
const output = process.env.ZETSLAY_BROWSER_OUTPUT;
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.woff':'font/woff', '.woff2':'font/woff2' };
const at = '2026-11-21T13:00:00Z';
const first = { id:'order-review',orderId:'TEST100',status:'review',panelId:'soxy',lotId:'123',quantity:200,quoted:'0.40',currency:'USD',
  events:[{ status:'waiting_link',at },{ status:'waiting_confirmation',at },{ status:'review',at }] };
const second = { id:'order-unknown',orderId:'TEST101',status:'uncertain',panelId:'rocket',lotId:'432',quantity:500,quoted:'6.50',currency:'RUB',
  issue:'SMM_UNCERTAIN',events:[{ status:'sending',at },{ status:'uncertain',at }] };
function fixture() {
  return { mode:'review',baselineReady:true,workerEnabled:true,purchaseEnabled:true,runnable:true,storeId:'15',
    panels:[{ id:'soxy',name:'Soxy Liker',connected:true,balance:{amount:'20.00',currency:'USD'},serviceCount:42,checkedAt:at },
      { id:'rocket',name:'SOC-ROCKET',connected:true,balance:{amount:'1200.00',currency:'RUB'},serviceCount:52,checkedAt:at }],
    domains:['t.me','vk.com'],mappings:[{ lotId:'123',panelId:'soxy',serviceId:'57',serviceName:'Просмотры для видео',unitsPerItem:100,allowedDomain:'t.me',
      maxCost:'0.50',dailyLimit:'4.00',currency:'USD',enabled:true }],
    orders:[structuredClone(first),structuredClone(second)],attention:[structuredClone(first),structuredClone(second)] };
}
let scenario, posts;
const server = http.createServer(async (req,res) => {
  if (req.url.startsWith('/api/v1/plugins/auto-smm/')) {
    res.setHeader('content-type','application/json');
    if (req.method==='POST') {
      let input='';for await (const chunk of req) input+=chunk;
      const request=JSON.parse(input);posts.push(request);
      if (request.action==='services') return res.end(JSON.stringify({ services:[{id:'88',name:'Тест <сервис>',min:10,max:5000,rate:'1.20'}] }));
      if (request.action==='mode') scenario.mode=request.body.mode;
      if (request.action==='task' && request.body.action==='approve') {
        scenario.orders[0].status='queued';
        scenario.attention=scenario.attention.filter(t=>t.id!==request.body.id);
      }
    }
    return res.end(JSON.stringify(scenario));
  }
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const path = resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
  const type = mime[extname(path)];
  if (!path.startsWith(root + sep) || !type || !existsSync(path)) { res.writeHead(404);res.end();return; }
  res.setHeader('content-type', type);
  res.end(readFileSync(path));
});

(async () => {
  if (output) mkdirSync(output,{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({executablePath:process.env.ZETSLAY_TEST_BROWSER_PATH||undefined,headless:true});
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const [label,width] of [['desktop',1440],['phone',390],['compact',320]]) {
      scenario=fixture();posts=[];
      const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue()
        : route.fulfill({status:401,contentType:'application/json',body:'{"error":{"code":"UNAUTHORIZED"}}'}));
      await page.goto(origin + '/app/');
      await page.locator('[data-privacy-notice]').getByRole('button',{name:'Понятно'}).click();
      await page.evaluate(async () => {
        document.querySelector('.toast-region')?.replaceChildren();
        authState.user = { id:'autosmm-fixture-user', email:'seller@example.invalid' };
        authState.token = 'fixture';
        authState.workspace = { id:'autosmm-fixture-workspace', plan:{id:'growth',active:true,expiresAt:new Date(Date.now()+86400000).toISOString()}, pluginLicenses:[] };
        state.onboarding = {state:'connected_read_only',activePlan:true};
        const plugin = { id:'zetslay.auto-smm', name:'AutoSMM', category:'sales', published:true, priceRub:149, installation:null,
          description:'Отправляет оплаченные SMM-заказы в выбранную панель.\n\n## Заказы и расходы\n- Задайте лимит на один заказ и на сутки.',
          permissions:['orders:read','messages:read','replies:queue'], events:['order.paid'] };
        window.installCalls = [];
        apiRequest = async (path, options = {}) => {
          if (path.startsWith('/api/v1/plugins/auto-smm/')) {
            const response = await fetch(path, { method:options.method, headers:{'content-type':'application/json'},
              signal:options.signal, body:options.body && JSON.stringify(options.body) });
            return response.json();
          }
          if (path === '/api/v1/plugins') return {plugins:[plugin]};
          if (path === '/api/v1/plugin-catalog') return {entries:[structuredClone(plugin)]};
          if (path === '/api/v1/subscription/status') return {workspace:structuredClone(authState.workspace)};
          if (path === '/api/v1/plugins/zetslay.auto-smm/install') {
            installCalls.push(['install',options.body.permissions]);plugin.installation={enabled:false};return {};
          }
          if (path === '/api/v1/plugins/zetslay.auto-smm/enable') {
            installCalls.push(['enable']);plugin.installation.enabled=true;return {};
          }
          if (path === '/api/v1/learning') return {version:1,revision:0,welcomeSeen:true,status:'completed',step:5};
          return {};
        };
        renderAuthState();setAuthModal(false);
        await loadPluginCatalog();setView('plugins');
      });
      const card=page.locator('#plugin-grid .plugin-card', {hasText:'AutoSMM'});
      assert.equal(await card.locator('.plugin-card__body > p').innerText(),'Отправляет оплаченные SMM-заказы в выбранную панель.');
      await page.evaluate(() => setView('plugins/zetslay.auto-smm'));
      await page.locator('[data-plugin-page] .plugin-detail-content li', {hasText:'Задайте лимит на один заказ и на сутки.'}).waitFor();
      const install = page.locator('[data-plugin-page] [data-plugin-id="zetslay.auto-smm"]');
      await install.waitFor();
      assert.equal(await install.isDisabled(),true,'Growth without a license cannot install');
      await page.evaluate(() => {
        authState.workspace.pluginLicenses=['zetslay.auto-smm'];subscriptionApply();
      });
      assert.equal(await install.isEnabled(),true,'lifetime license unlocks a paid plan');
      await page.evaluate(() => {
        authState.workspace.pluginLicenses=[];authState.workspace.plan.id='pro';subscriptionApply();
      });
      assert.equal(await install.isEnabled(),true,'Pro includes AutoSMM');
      await install.click();
      const tabs = page.getByRole('tablist',{name:'Разделы плагина'});
      const autoSmm = page.locator('[data-autosmm]');
      await tabs.getByRole('tab',{name:'Очередь',exact:true}).waitFor();
      assert.deepEqual(await page.evaluate(() => installCalls), [['install',['orders:read','messages:read','replies:queue']],['enable']]);
      assert.deepEqual(await page.evaluate(() => {
        const plugin = state.plugins[0];
        const purchase = pluginPurchaseModel(plugin);
        return [pluginRarity(plugin).key, purchase.amount, purchase.plan.id];
      }), ['ultra',14900,'pro']);
      await page.waitForFunction(() => document.querySelector('.zs-product-art img[src$="/plg-autosmm.webp"]')?.naturalWidth > 0);
      await tabs.getByRole('tab',{name:'Очередь',exact:true}).click();
      assert.equal(await page.getByRole('heading',{name:'Поставщики',exact:true}).isVisible(),false);
      await page.getByText('#TEST100',{exact:true}).click();
      await page.getByRole('button',{name:'Разрешить отправку'}).click();
      await page.locator('.autosmm-confirm strong:focus').waitFor();
      assert.equal(posts.length,0);
      if(output) await autoSmm.screenshot({path:join(output,'autosmm-'+label+'-queue.png')});
      await page.getByRole('button',{name:'Подтвердить',exact:true}).click();
      await page.getByText('В очереди на отправку',{exact:true}).waitFor();
      assert.equal(posts.filter(p=>p.action==='task').length,1);
      await page.getByText('#TEST101',{exact:true}).click();
      await page.getByText('Я сверил заказ, получателя, время и сумму').waitFor();
      await tabs.getByRole('tab',{name:'Очередь',exact:true}).focus();
      await page.keyboard.press('ArrowLeft');
      assert.equal(await tabs.getByRole('tab',{name:'Настройки',exact:true}).getAttribute('aria-selected'),'true');
      assert.equal(await page.getByRole('heading',{name:'Заказы',exact:true}).isVisible(),false);
      assert.equal(await page.locator('.autosmm-fallback').isVisible(),false);
      await autoSmm.getByLabel('Лот FunPay').fill('321');
      await autoSmm.getByLabel('Поиск услуги').fill('тест');
      await page.getByRole('button',{name:'Найти',exact:true}).click();
      await page.getByText('Тест <сервис>',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Выбрать',exact:true}).click();
      assert.equal(await autoSmm.getByLabel('Номер услуги').inputValue(),'88');
      assert.equal(await autoSmm.getByLabel('Лот FunPay').inputValue(),'321');
      await page.getByRole('button',{name:'Автоматически',exact:true}).click();
      await page.getByText('Разрешить отправку новых заказов после подтверждения покупателем?').waitFor();
      assert.equal(posts.some(p=>p.action==='mode'),false);
      await page.getByRole('button',{name:'Отмена',exact:true}).click();
      if(output) await autoSmm.screenshot({path:join(output,'autosmm-'+label+'-settings.png')});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth + 1),true);
      assert.equal(await page.evaluate(()=>[...Object.keys(localStorage),...Object.keys(sessionStorage)].some(key=>/autosmm/i.test(key))),false);
      assert.deepEqual(errors,[]);
      await page.close();
    }
    console.log('AutoSMM in the cabinet: native tabs, keyboard, approvals, reconciliation, search, preserved draft and three viewport widths.');
  } finally { await browser?.close();server.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
