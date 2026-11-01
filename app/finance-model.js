const financeTimestamp=v=>{if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(v)||financeCalendarDate(v.slice(0,10))===null||Number(v.slice(11,13))>23||Number(v.slice(14,16))>59||Number(v.slice(17,19))>59)return null;const ms=Date.parse(v);return Number.isFinite(ms)?ms:null;};
const FINANCE_PERIODS = Object.freeze({all:'Вся история',today:'Сегодня',yesterday:'Вчера',last7:'7 дней',last30:'30 дней',week:'Эта неделя',month:'Этот месяц',custom:'Свои даты',undated:'Без точной даты'});
const FINANCE_MOSCOW_OFFSET=3*60*60*1000;
const financeDayKey=ms=>new Date(ms+FINANCE_MOSCOW_OFFSET).toISOString().slice(0,10);
function financeCalendarDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\d$/.test(value))return null;
 const [y,m,d]=value.split('-').map(Number),day=Date.UTC(y,m-1,d);
 if(y<2000||y>2100||new Date(day).toISOString().slice(0,10)!==value)return null;
 return day-FINANCE_MOSCOW_OFFSET;
}
function financePeriodRange(filters={},now=Date.now()){
 const key=Object.hasOwn(FINANCE_PERIODS,filters.period)?filters.period:'all',label=FINANCE_PERIODS[key];
 if(key==='all'||key==='undated')return {key,label,start:null,end:null,error:''};
 const day=financeCalendarDate(financeDayKey(now)),shifted=new Date(day+FINANCE_MOSCOW_OFFSET);
 let start=day,end=day+86400000,error='';
 if(key==='yesterday'){start=day-86400000;end=day;}
 if(key==='last7')start=day-6*86400000;
 if(key==='last30')start=day-29*86400000;
 if(key==='week')start=day-((shifted.getUTCDay()+6)%7)*86400000;
 if(key==='month')start=Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),1)-FINANCE_MOSCOW_OFFSET;
 if(key==='custom'){
  start=financeCalendarDate(filters.from);const last=financeCalendarDate(filters.to);end=last===null?null:last+86400000;
  if(start===null||end===null)error='Выберите начальную и конечную дату.';
  else if(start>=end)error='Начальная дата должна быть не позже конечной.';
 }
 return {key,label,start,end,error};
}
/* Monetary values are integer minor units. No currency conversion or invented costs. */
const FINANCE_CURRENCIES=['RUB','USD','EUR'];
const financeAmount=v=>Number.isSafeInteger(v)&&v>=0;
const financeSigned=v=>Number.isSafeInteger(v);
const financeSum=values=>{if(values.some(v=>!financeSigned(v)))return null;const n=values.reduce((a,b)=>a+b,0);return financeSigned(n)?n:null;};
const financeComplete=(rows,key)=>financeSum(rows.map(r=>r[key]));
const financeEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const financeMoney=(n,c)=>financeSigned(n)?new Intl.NumberFormat('ru-RU',{style:'currency',currency:c,maximumFractionDigits:2}).format(n/100):'—';
const financeDate=ms=>new Date(ms).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short'});
const FINANCE_STATUS={paid:'Оплачен',processing:'В работе',delivered:'Выдан',completed:'Завершён',refunded:'Возврат',partially_refunded:'Частичный возврат',cancelled:'Отменён',unknown:'Неизвестен'};
const FINANCE_REASONS={AMOUNT_MISSING:'Нет суммы заказа',REFUND_MISSING:'Уточните частичный возврат',COST_MISSING:'Нет себестоимости',FEE_MISSING:'Не учтена комиссия',OTHER_MISSING:'Не уточнены прочие расходы',TAX_MISSING:'Не уточнён налог',SUPPLIER_UNCERTAIN:'Неопределённая операция Kosell',CURRENCY_CHANGED:'Изменилась валюта заказа',STATUS_UNKNOWN:'Не подтверждён статус заказа',AMOUNT_OVERFLOW:'Слишком большая сумма'};
function financeParseMoney(value){
 const text=String(value??'').trim().replace(',','.');if(!/^\d{1,11}(?:\.\d{1,2})?$/.test(text))return null;
 const [whole,fraction='']=text.split('.'),minor=Number(whole)*100+Number(fraction.padEnd(2,'0'));return financeAmount(minor)&&minor<=1_000_000_000_000?minor:null;
}
function financeStats(rows){
 const included=rows.filter(r=>r.included),known=included.filter(r=>financeSigned(r.profitMinor));
 const income=financeComplete(included,'revenueMinor');
 return {orders:rows.length,accounted:included.length,awaiting:rows.filter(r=>['paid','processing','delivered'].includes(r.status)).length,completed:rows.filter(r=>r.status==='completed').length,refunds:rows.filter(r=>['refunded','partially_refunded'].includes(r.status)).length,gross:financeComplete(included,'grossMinor'),income,refundAmount:financeComplete(included,'refundMinor'),expenses:financeComplete(included,'expensesMinor'),knownExpenses:financeComplete(included,'knownExpensesMinor'),profit:financeComplete(included,'profitMinor'),knownProfit:financeSum(known.map(r=>r.profitMinor)),profitKnownCount:known.length,missing:included.length-known.length,average:income!==null&&included.length?Math.round(income/included.length):null};
}
function financeBucket(ms,group){
 const date=new Date(ms+10800000);
 if(group==='month')return date.toISOString().slice(0,7)+'-01';
 if(group==='week')date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));
 return date.toISOString().slice(0,10);
}
function buildFinanceModel(report,filters={}){
 const loaded=report?.schema===1&&Array.isArray(report.orders)&&Number.isFinite(Date.parse(report.generatedAt));
 const now=loaded?Date.parse(report.generatedAt):Date.now(),seen=new Set();
 const orders=loaded?report.orders.filter(r=>r&&typeof r.id==='string'&&!seen.has(r.id)&&seen.add(r.id)).map(r=>{const date=financeTimestamp(r.createdAt);return {...r,date:date!==null&&date<=now?date:null};}):[];
 const currencies=FINANCE_CURRENCIES.filter(c=>orders.some(o=>o.currency===c)),currency=currencies.includes(filters.currency)?filters.currency:currencies.includes('RUB')?'RUB':currencies[0]||'RUB';
 const range=financePeriodRange({...filters,period:filters.period||'last30'},now);
 const matching=range.error?[]:orders.filter(o=>o.currency===currency&&(range.key==='all'||(range.key==='undated'?o.date===null:o.date!==null&&o.date>=range.start&&o.date<range.end)));
 const stats=financeStats(matching),query=String(filters.query||'').trim().toLocaleLowerCase('ru-RU'),status=['all','active','completed','refunded','missing'].includes(filters.status)?filters.status:'all';
 const filtered=matching.filter(o=>(!query||(o.id+' '+o.product+' '+o.buyer).toLocaleLowerCase('ru-RU').includes(query))&&(status==='all'||status==='active'&&['paid','processing','delivered'].includes(o.status)||status==='completed'&&o.status==='completed'||status==='refunded'&&['refunded','partially_refunded'].includes(o.status)||status==='missing'&&o.included&&o.profitMinor===null));
 filtered.sort((a,b)=>a.date===null&&b.date!==null?1:b.date===null&&a.date!==null?-1:(b.date??0)-(a.date??0)||(a.id<b.id?-1:a.id>b.id?1:0));
 const size=[10,25,50].includes(Number(filters.size))?Number(filters.size):10,pages=Math.max(1,Math.ceil(filtered.length/size)),page=Math.max(1,Math.min(pages,Number.isSafeInteger(Number(filters.page))?Number(filters.page):1)),group=['day','week','month'].includes(filters.group)?filters.group:'day',buckets=new Map();
 const dated=matching.filter(r=>r.date!==null),dates=dated.map(r=>r.date);
 if(!range.error&&range.key!=='undated'){
  const start=range.start??(dates.length?Math.min(...dates):null),end=range.end??(financeCalendarDate(financeDayKey(now))+86400000);
  if(start!==null)for(let d=start;d<end&&d<start+36600*86400000;d+=86400000){const key=financeBucket(d,group);if(!buckets.has(key))buckets.set(key,[]);}
  for(const r of dated){const key=financeBucket(r.date,group);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(r);}
 }
 const series=[...buckets].sort(([a],[b])=>a.localeCompare(b)).map(([date,rows])=>({date,...financeStats(rows)}));
 return {loaded,orders,range,currencies,currency,matching,stats,query,status,filtered,rows:filtered.slice((page-1)*size,page*size),page,pages,size,group,series:series.slice(-120),chartTruncated:series.length>120,undated:orders.filter(r=>r.currency===currency&&r.date===null).length,unknownCurrency:orders.filter(r=>!FINANCE_CURRENCIES.includes(r.currency)).length,archive:report?.archive||null};
}
function financeCsv(rows,currency){
 const text=v=>'"'+(/^[\s]*[=+@-]/.test(String(v??''))?"'":'')+String(v??'').replace(/[\r\n\t]/g,' ').replace(/"/g,'""')+'"';
 const money=v=>financeSigned(v)?(v/100).toFixed(2).replace('.',','):'';
 const head=['Заказ','Создан (МСК)','Товар','Покупатель','Статус','Валюта','Сумма заказа','Возврат','Доход','Себестоимость','Комиссия','Прочие расходы','Налог','Чистая прибыль'];
 return '\ufeff'+head.map(text).join(';')+'\r\n'+rows.map(r=>[text(r.id),text(r.date===null?'':new Date(r.date).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})),text(r.product),text(r.buyer),text(FINANCE_STATUS[r.status]||'Неизвестен'),text(currency),...[r.amountMinor,r.refundMinor,r.revenueMinor,r.costMinor,r.feeMinor,r.otherMinor,r.taxMinor,r.profitMinor].map(money)].join(';')).join('\r\n');
}
