// Local UI fixture. All accounts, games, prices and queues here are synthetic.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const products=[{id:1,name:'Undisputed',nodeId:'2866',availableAccounts:8},{id:2,name:'HITMAN World of Assassination',nodeId:'451',availableAccounts:12},{id:3,name:'Manor Lords',nodeId:'2341',availableAccounts:6},{id:4,name:'Subnautica',nodeId:'3554',availableAccounts:14}];
const categories=products.map(p=>({nodeId:p.nodeId,game:p.nodeId==='451'?'Прочие игры':p.name,name:'Аккаунты'}));
const form=nodeId=>({nodeId,categoryTitle:categories.find(c=>c.nodeId===nodeId)?.game+' · Аккаунты',currency:'RUB',fingerprint:'a'.repeat(64),fields:{'fields[platform]':'steam','fields[type]':'rent'},missing:[],controls:[{name:'fields[platform]',label:'Платформа',kind:'select',required:true,options:[{value:'',label:'Выберите платформу'},{value:'steam',label:'Steam'},{value:'ps',label:'PlayStation'}]},{name:'fields[type]',label:'Тип товара',kind:'select',required:true,options:[{value:'',label:'Выберите тип'},{value:'rent',label:'Аренда'},{value:'sale',label:'Продажа'}]}]});
const status={storeId:'preview-store',keyConfigured:true,baselineReady:true,workerEnabled:true,purchaseEnabled:true,deliveryEnabled:true,
 installation:{enabled:true},config:{currency:'RUB',markupPercent:25,maxSpendMinor:30000,manageOffers:true,automatic:false,guardEnabled:true,deliveryTemplate:'$login $password'},
 mappings:[],tasks:[],active:[],offerJobs:[],analytics:{currencies:{}},offerCreationQueue:{pending:0,holds:[]},providerAccount:{username:'Демонстрационный магазин',balanceRubMinor:125000,balanceUsdMinor:0}};
const html=`<!doctype html><html data-theme="dark" lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kosell · макет ZetSlay</title>
${['styles.css','kosell-rent.css','kosell-storefront.css','kosell-workspace.css'].map(n=>`<link rel="stylesheet" href="/app/${n}">`).join('')}
<style>body{margin:0;background:#0b0b0b;color:#f5f5f5;font-family:Inter,Arial,sans-serif}main{width:min(1240px,calc(100% - 32px));margin:32px auto}.preview-label{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;font-size:12px;color:#888}.preview-label a{color:#ccc;text-decoration:none}@media(max-width:600px){main{width:calc(100% - 16px);margin:16px auto}.preview-label{padding:0 8px}}</style>
<body><main><div class="preview-label"><span>ZetSlay / Kosell Rent</span><span>Локальный макет · демонстрационные данные</span></div><div id="preview"></div></main>
<script>const authState={token:'preview-only'},sessionGeneration=1;
const demoStatus=${JSON.stringify(status)},demoProducts=${JSON.stringify(products)},demoCategories=${JSON.stringify(categories)},demoForms=${JSON.stringify(Object.fromEntries(categories.map(c=>[c.nodeId,form(c.nodeId)])))};
function escapeHtml(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
function humanError(e){return e.message||'Ошибка проверки'}
function showToast(){}
async function apiRequest(path,options={}){if(path.endsWith('/status'))return structuredClone(demoStatus);if(path.endsWith('/storefront'))return {products:demoProducts,categories:demoCategories};if(path.endsWith('/category'))return structuredClone(demoForms[options.body.nodeId]);throw Error('В макете внешние действия отключены')}
function renderPluginPage(){document.getElementById('preview').innerHTML=kosellRentMarkup({installed:true})}
</script><script src="/app/kosell-rent.js"></script><script src="/app/kosell-storefront.js"></script><script>
Object.assign(kosellUi,{session:authState.token,status:demoStatus,section:'storefront'});
const scenario=new URL(location).searchParams.get('scenario');
if(scenario==='review'){const u=sfState();u.sources={products:demoProducts,categories:demoCategories};u.stage='2';u.entries=demoProducts.map(p=>({productId:p.id,productName:p.name,nodeId:p.nodeId,form:demoForms[p.nodeId],fieldNode:p.nodeId,fields:{...demoForms[p.nodeId].fields},expanded:false,error:'',errorCode:''}));u.entries[0].fields['fields[type]']='';u.entries[0].expanded=true;u.entries[1].form=null;u.entries[1].error='Не удалось подтвердить форму категории FunPay. Выбранная игра сохранена — повторите загрузку параметров.';u.entries[1].errorCode='KOSELL_CATEGORY_FORM';}
renderPluginPage();
</script></body></html>`;
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){res.setHeader('content-type','text/html; charset=utf-8');return res.end(html);}
 const file=resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+'\\')&&!file.startsWith(root+'/'))throw Error();
 const data=await readFile(file);res.setHeader('content-type',({'.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp'})[extname(file)]||'application/octet-stream');res.end(data);
}catch{res.statusCode=404;res.end();}});
server.listen(8101,'127.0.0.1',()=>console.log('Kosell preview: http://127.0.0.1:8101/?scenario=review'));
