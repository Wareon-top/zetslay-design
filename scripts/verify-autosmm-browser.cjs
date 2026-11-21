const assert = require('node:assert/strict');
const http = require('node:http');
const { readFileSync, mkdirSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { chromium } = require(process.env.ZETSLAY_PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(__dirname, '..');
const output = process.env.ZETSLAY_BROWSER_OUTPUT;
const pages = ['/app/styles.css', '/app/plugin-page.css', '/app/autosmm.css', '/app/autosmm.js'];
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
const fixtureHtml = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${pages.filter(p=>p.endsWith('.css')).map(p=>`<link rel="stylesheet" href="${p}">`).join('')}</head>
<body><main style="max-width:880px;margin:12px auto;padding:10px"><div id="fixture"></div></main><script>
const authState={token:'fixture'};
function escapeHtml(value){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");}
function humanError(error){return error.message;}
function renderPluginPage(){document.querySelector('#fixture').innerHTML=autoSmmMarkup({id:'zetslay.auto-smm',installed:true});}
async function apiRequest(path, options={}) {
  const response=await fetch(path,{method: options.method || 'GET',headers:{'content-type':'application/json'},signal:options.signal,body:options.body&&JSON.stringify(options.body)});
  const data=await response.json();if(!response.ok)throw Error(data.error);return data;
}
window.addEventListener('load',()=>renderPluginPage());
</script><script src="/app/autosmm.js"></script></body></html>`;
const server = http.createServer(async (req,res) => {
  if (req.url==='/') { res.setHeader('content-type','text/html; charset=utf-8');res.end(fixtureHtml);return; }
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
  if (!pages.includes(req.url)) { res.writeHead(404);res.end();return; }
  res.setHeader('content-type',req.url.endsWith('.css')?'text/css':'text/javascript');
  res.end(readFileSync(join(root,req.url.slice(1))));
});

(async () => {
  if (output) mkdirSync(output,{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({executablePath:process.env.ZETSLAY_TEST_BROWSER_PATH||undefined,headless:true});
    for (const [label,width] of [['desktop',1440],['phone',390]]) {
      scenario=fixture();posts=[];
      const page=await browser.newPage({viewport:{width,height:900}});
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/#plugins/zetslay.auto-smm`);
      await page.getByText('#TEST100',{exact:true}).click();
      await page.getByRole('button',{name:'Разрешить отправку'}).click();
      assert.equal(posts.length,0);
      if(output) await page.screenshot({path:join(output,'autosmm-'+label+'-queue.png'),fullPage:true});
      await page.getByRole('button',{name:'Подтвердить',exact:true}).click();
      await page.getByText('В очереди на отправку',{exact:true}).waitFor();
      assert.equal(posts.filter(p=>p.action==='task').length,1);
      await page.getByText('#TEST101',{exact:true}).click();
      await page.getByText('Я сверил заказ, получателя, время и сумму').waitFor();
      await page.getByRole('button',{name:'Настройки',exact:true}).click();
      await page.getByLabel('Лот FunPay').fill('321');
      await page.getByLabel('Поиск услуги').fill('тест');
      await page.getByRole('button',{name:'Найти',exact:true}).click();
      await page.getByText('Тест <сервис>',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Выбрать',exact:true}).click();
      assert.equal(await page.getByLabel('Номер услуги').inputValue(),'88');
      assert.equal(await page.getByLabel('Лот FunPay').inputValue(),'321');
      await page.getByRole('button',{name:'Автоматически',exact:true}).click();
      await page.getByText('Разрешить отправку новых заказов после подтверждения покупателем?').waitFor();
      assert.equal(posts.some(p=>p.action==='mode'),false);
      await page.getByRole('button',{name:'Отмена',exact:true}).click();
      if(output) await page.screenshot({path:join(output,'autosmm-'+label+'-settings.png'),fullPage:true});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth + 1),true);
      assert.deepEqual(await page.evaluate(()=>[localStorage.length,sessionStorage.length]),[0,0]);
      assert.deepEqual(errors,[]);
      await page.close();
    }
    console.log('AutoSMM browser: desktop/phone, approvals, uncertain orders, service search, preserved mapping, zero browser storage.');
  } finally { await browser?.close();server.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
