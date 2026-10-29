/* Local learning data only. This module never calls an API or mutates the shop. */
const cabinetDemoViews = ['dashboard', 'orders', 'messages', 'lots', 'finance'];
const cabinetDemoLabels = {dashboard:'Обзор', orders:'Заказы', messages:'Сообщения', lots:'Лоты и товары', finance:'Финансы'};
const cabinetDemoSteps = [['dashboard','Посмотрите продажи','period'], ['messages','Ответьте покупателю','reply'], ['lots','Измените учебный лот','lot']];
let cabinetDemoSession = null;
const demoEsc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const demoMoney = minor => new Intl.NumberFormat('ru-RU', {style:'currency',currency:'RUB',minimumFractionDigits:0,maximumFractionDigits:2}).format(minor / 100);
const demoScope = () => authState.user?.id && authState.token ? `${authState.user.id}:${authState.token}` : '';
function cabinetDemoReset(){ cabinetDemoSession = null; }
function cabinetDemoData(){
  const scope = demoScope();
  if(!cabinetDemoSession || cabinetDemoSession.scope !== scope){
    const today = new Date(); today.setHours(0,0,0,0);
    cabinetDemoSession = {scope, today:+today, period:'week', status:'all', query:'', thread:0, drafts:['','',''], sent:[[],[],[]], paused:[], completed:[], notice:''};
  }
  return cabinetDemoSession;
}
function cabinetDemoOrders(){
  const today = cabinetDemoData().today;
  // amounts/costs/fees are integer kopecks, deliberately unrelated to real sales.
  return [
    [0,16,'DEMO-012','GamePass · 1 месяц','Игрок_01','paid',89000,60000],
    [0,13,'DEMO-011','Игровой ключ','Игрок_02','closed',149000,90000],
    [0,10,'DEMO-010','Подписка · 30 дней','Игрок_03','closed',59000,35000],
    [1,18,'DEMO-009','Игровой ключ','Игрок_04','closed',199000,125000],
    [2,12,'DEMO-008','GamePass · 1 месяц','Игрок_05','refunded',89000,0],
    [3,15,'DEMO-007','Подписка · 30 дней','Игрок_06','closed',59000,35000],
    [4,11,'DEMO-006','Игровой ключ','Игрок_07','closed',149000,90000],
    [6,17,'DEMO-005','GamePass · 1 месяц','Игрок_08','closed',89000,60000],
    [9,14,'DEMO-004','Игровой ключ','Игрок_09','closed',199000,125000],
    [14,10,'DEMO-003','Подписка · 30 дней','Игрок_10','refunded',59000,0],
    [20,16,'DEMO-002','Игровой ключ','Игрок_11','closed',149000,90000],
    [27,12,'DEMO-001','GamePass · 1 месяц','Игрок_12','closed',89000,60000]
  ].map(([day,hour,id,item,buyer,status,amount,cost]) => {
    const date = new Date(today); date.setDate(date.getDate()-day); date.setHours(hour);
    return {day,hour,id,item,buyer,status,amount,cost,fee:status==='refunded'?0:Math.round(amount*.05),date:+date};
  });
}
const demoStatus = {paid:'Оплачен',closed:'Завершён',refunded:'Возврат'};
const demoPeriods = {day:1,week:7,month:30};
function cabinetDemoSelected(){ const d=cabinetDemoData(); return cabinetDemoOrders().filter(o=>o.day<demoPeriods[d.period]); }
function cabinetDemoTotals(){
  const orders=cabinetDemoSelected(), sales=orders.filter(o=>o.status!=='refunded');
  const sum=key=>sales.reduce((n,o)=>n+o[key],0), revenue=sum('amount'), cost=sum('cost'), fee=sum('fee');
  return {orders:orders.length,revenue,cost,fee,profit:revenue-cost-fee,average:sales.length?Math.round(revenue/sales.length):0};
}
function cabinetDemoPeriods(view){
  const d=cabinetDemoData();
  return `<div class="demo-periods" role="group" aria-label="Период учебных данных">${[['day','День'],['week','Неделя'],['month','Месяц']].map(([id,label])=>`<button id="demo-${view}-period-${id}" type="button" data-demo-period="${id}" aria-pressed="${d.period===id}">${label}</button>`).join('')}</div>`;
}
function cabinetDemoMetrics(finance=false){
  const t=cabinetDemoTotals();
  const rows=finance ? [['Доход',demoMoney(t.revenue),'Продажи без возвратов'],['Себестоимость',demoMoney(t.cost),'Задана в учебном примере'],['Комиссии',demoMoney(t.fee),'Условные 5% для примера'],['Прибыль до налогов',demoMoney(t.profit),'Доход − товары − комиссии']] : [['Продажи',demoMoney(t.revenue),'Сумма без возвратов'],['Заказы',t.orders,'Включая возвраты'],['Средний чек',demoMoney(t.average),'По продажам без возвратов'],['После расходов',demoMoney(t.profit),'В примере, до налогов']];
  return `<div class="demo-metrics">${rows.map(([name,value,caption],i)=>`<article${i===0?' class="demo-metric-primary"':''}><span>${name}</span><strong>${value}</strong><small>${caption}</small></article>`).join('')}</div>`;
}
function cabinetDemoChart(){
  const d=cabinetDemoData(), days=demoPeriods[d.period], count=d.period==='day'?6:d.period==='week'?7:6;
  const buckets=Array.from({length:count},()=>0);
  for(const o of cabinetDemoSelected()) if(o.status!=='refunded') buckets[d.period==='day'?Math.floor(o.hour/4):Math.min(count-1,Math.floor((days-1-o.day)*count/days))]+=o.amount;
  const max=Math.max(1,...buckets);
  const labels=d.period==='day'?['00–04','04–08','08–12','12–16','16–20','20–24']:Array.from({length:count},(_,i)=>{
    const date=new Date(d.today);date.setDate(date.getDate()-days+1+Math.floor(i*days/count));return date.toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
  });
  return `<section class="demo-chart"><header><div><h2>Динамика продаж</h2><p>Продажи без возвратов</p></div><span class="demo-chart-key"><i></i> Продажи, ₽</span></header><div class="demo-bars">${buckets.map((n,i)=>`<div class="demo-bar-column"><span>${demoMoney(n)}</span><div class="demo-bar-track"><i style="height:${n?Math.max(3,Math.round(n/max*100)):0}%"></i></div><small>${labels[i]}</small></div>`).join('')}</div></section>`;
}
function cabinetDemoOrderRows(finance=false, limit=20){
  const d=cabinetDemoData(),q=d.query.trim().toLocaleLowerCase('ru-RU');
  const rows=cabinetDemoSelected().filter(o=>(finance||limit!==20)||((d.status==='all'||o.status===d.status)&&(!q||`${o.id} ${o.item} ${o.buyer}`.toLocaleLowerCase('ru-RU').includes(q)))).slice(0,limit);
  return rows.map(o=>`<tr><td><strong>#${o.id}</strong><span>${demoEsc(o.item)}</span></td><td>${finance?demoMoney(o.status==='refunded'?0:o.cost+o.fee):demoEsc(o.buyer)}</td><td><span class="demo-status demo-status--${o.status}">${demoStatus[o.status]}</span></td><td class="demo-number">${demoMoney(finance?(o.status==='refunded'?0:o.amount-o.cost-o.fee):o.amount)}</td><td class="demo-date">${new Date(o.date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}<small>${new Date(o.date).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</small></td></tr>`).join('')||'<tr><td colspan="5" class="demo-empty">По этим условиям учебных заказов нет. Измените фильтр или период.</td></tr>';
}
function cabinetDemoTable(finance=false,limit=20){
  return `<div class="demo-table-scroll"><table class="demo-table"><caption class="demo-sr-only">Учебные заказы, сначала новые</caption><thead><tr><th>Заказ / товар</th><th>${finance?'Расходы':'Покупатель'}</th><th>Статус</th><th class="demo-number">${finance?'Прибыль до налогов':'Сумма'}</th><th>Дата</th></tr></thead><tbody data-demo-order-rows>${cabinetDemoOrderRows(finance,limit)}</tbody></table></div>`;
}
function cabinetDemoMessages(){
  const d=cabinetDemoData(),names=['Игрок_01','Игрок_02','Игрок_03'],questions=['Здравствуйте! Где найти инструкцию после покупки?','Спасибо, всё активировалось!','Подскажите, как продлить подписку?'];
  return `<div class="demo-messenger"><aside aria-label="Учебные диалоги"><h2>Диалоги <small>3</small></h2>${names.map((n,i)=>`<button id="demo-thread-${i}" type="button" data-demo-thread="${i}" aria-pressed="${d.thread===i}"><span class="demo-avatar">${i+1}</span><span><strong>${n}</strong><small>${questions[i]}</small></span>${i===0&&!d.sent[0].length?'<i class="demo-unread" aria-label="Новое сообщение"></i>':''}</button>`).join('')}</aside><section class="demo-conversation" aria-label="Учебная переписка"><header><span class="demo-avatar">${d.thread+1}</span><div><strong>${names[d.thread]}</strong><small>Учебный покупатель · #DEMO-${String(12-d.thread).padStart(3,'0')}</small></div></header><div class="demo-chat-log" role="log" aria-label="Сообщения учебного диалога"><p class="demo-chat-day">Сегодня · пример переписки</p><div class="demo-bubble"><p>${questions[d.thread]}</p><small>12:40</small></div>${d.sent[d.thread].map(text=>`<div class="demo-bubble demo-bubble--mine"><p>${demoEsc(text)}</p><small>В примере · ✓</small></div>`).join('')}</div><form data-demo-message><label for="demo-draft">Ответ покупателю</label><button id="demo-template" type="button" class="demo-template" data-demo-template>${icon('bolt')} Вставить быстрый ответ</button><div class="demo-composer"><textarea id="demo-draft" name="message" data-demo-draft rows="2" maxlength="500" placeholder="Напишите учебный ответ…">${demoEsc(d.drafts[d.thread])}</textarea><button id="demo-send" type="submit" aria-label="Добавить ответ в учебный чат">${icon('send')}</button></div><small>Ответ появится только здесь. Сообщения в FunPay не отправляются.</small></form></section></div>`;
}
function cabinetDemoLots(){
  const d=cabinetDemoData();
  return `<div class="demo-table-scroll"><table class="demo-table demo-lots-table"><caption class="demo-sr-only">Учебные лоты</caption><thead><tr><th>Товар</th><th>Наличие</th><th class="demo-number">Цена</th><th>Статус</th><th><span class="demo-sr-only">Действие</span></th></tr></thead><tbody>${[['GamePass','Подписка · 1 месяц',89000,12],['Игровой ключ','Моментальная выдача',149000,8],['Подписка','Доступ · 30 дней',59000,24]].map(([name,desc,price,stock],i)=>{
    const paused=d.paused.includes(i);
    return `<tr class="demo-lot"><td><strong>${name}</strong><span>${desc}</span></td><td>${stock} шт.</td><td class="demo-number">${demoMoney(price)}</td><td><span class="demo-status ${paused?'demo-status--paused':'demo-status--closed'}">${paused?'На паузе':'Активен'}</span></td><td class="demo-number"><button id="demo-lot-${i}" type="button" class="demo-row-action" data-demo-lot="${i}" aria-pressed="${paused}">${paused?'Включить':'Приостановить'}</button></td></tr>`;
  }).join('')}</tbody></table></div><p class="demo-footnote">Изменения действуют только в примере. Предложения вашего магазина не затрагиваются.</p>`;
}
function cabinetDemoBody(view){
  const d=cabinetDemoData();
  if(view==='messages')return cabinetDemoMessages();
  if(view==='lots')return cabinetDemoLots();
  if(view==='orders')return `<div class="demo-filters"><label><span class="demo-sr-only">Поиск учебных заказов</span>${icon('search')}<input id="demo-search" data-demo-search maxlength="80" value="${demoEsc(d.query)}" placeholder="Товар, покупатель или номер заказа"></label><label><span class="demo-sr-only">Статус учебных заказов</span><select id="demo-status" data-demo-status>${[['all','Все статусы'],...Object.entries(demoStatus)].map(([id,label])=>`<option value="${id}"${d.status===id?' selected':''}>${label}</option>`).join('')}</select></label></div>${cabinetDemoTable()}`;
  if(view==='finance')return `${cabinetDemoMetrics(true)}<section class="demo-table-panel"><header><h2>Результат по каждому заказу</h2><span>Учебный расчёт</span></header>${cabinetDemoTable(true)}<p class="demo-footnote">В примере указаны себестоимость и условная комиссия 5%. Это иллюстрация расчёта, а не тариф FunPay. Налоги и другие расходы не включены.</p></section>`;
  const counts=cabinetDemoSelected().reduce((out,o)=>(out[o.status]++,out),{paid:0,closed:0,refunded:0});
  return `${cabinetDemoMetrics()}<div class="demo-overview-grid">${cabinetDemoChart()}<aside class="demo-summary"><h2>Заказы за период</h2><dl>${Object.entries(demoStatus).map(([key,label])=>`<div><dt><span class="demo-status demo-status--${key}">${label}</span></dt><dd>${counts[key]}</dd></div>`).join('')}</dl><button type="button" data-demo-view="orders">Открыть заказы ${icon('chevron')}</button></aside></div><section class="demo-table-panel"><header><h2>Последние заказы</h2><button type="button" data-demo-view="orders">Все заказы ${icon('chevron')}</button></header>${cabinetDemoTable(false,3)}</section>`;
}
function cabinetDemoExperience(view,{trial,busy,error}){
  if(!cabinetDemoViews.includes(view))return '';
  const d=cabinetDemoData(),available=trial==='available',used=trial==='used';
  const descriptions={dashboard:'Продажи, заказы и результат магазина за выбранный период.',orders:'История продаж с поиском и фильтрами.',messages:'Диалоги с покупателями и быстрые ответы.',lots:'Ассортимент, наличие и управление предложениями.',finance:'Доход, расходы и результат по каждому заказу.'};
  return `<div class="demo-experience"><header class="demo-intro"><div><span class="demo-eyebrow">Демонстрация кабинета</span><h1 id="access-${view}-title">${view==='dashboard'?'Обзор магазина':cabinetDemoLabels[view]}</h1><p>${descriptions[view]}</p></div><button id="demo-reset-${view}" type="button" class="demo-reset" data-demo-reset>Сбросить пример</button></header>
  <section class="demo-start" aria-labelledby="demo-${view}-offer"><div><h2 id="demo-${view}-offer">${available?'Попробуйте со своим магазином':used?'Вернитесь к работе с магазином':'Подключите свой магазин'}</h2><p>${available?'3 дня бесплатно · без автосписаний · плагины до Ультра':used?'Пробный период завершён. Настройки и купленные лицензии сохраняются.':'Выберите подписку или проверьте доступность пробного периода.'}</p></div><div class="demo-start-actions">${available?`<button type="button" class="demo-primary" data-access-trial ${busy?'disabled':''} aria-busy="${Boolean(busy)}">${busy?'Активируем…':'Попробовать бесплатно'}</button><button class="demo-quiet" type="button" data-access-billing>Тарифы</button>`:`<button type="button" class="demo-primary" data-access-billing>Выбрать тариф</button>${!used?`<button type="button" class="demo-quiet" data-access-trial ${busy?'disabled':''}>${busy?'Проверяем…':'Проверить пробный доступ'}</button>`:''}`}</div>${error?`<p class="demo-access-error" role="alert">${demoEsc(error)}</p>`:''}</section>
  <nav class="demo-explore" aria-label="Действия для знакомства"><span>Попробуйте</span>${[['dashboard','Период статистики','period'],['messages','Ответ покупателю','reply'],['lots','Пауза лота','lot']].map(([route,label,key])=>`<button id="demo-step-${view}-${key}" type="button" data-demo-view="${route}" aria-current="${view===route?'page':'false'}">${d.completed.includes(key)?'<span class="demo-completed" aria-label="Выполнено">✓</span>':''}${label}</button>`).join('')}<button type="button" class="demo-help" data-access-guide>Инструкция ${icon('external')}</button></nav>
  <section class="demo-workspace" aria-label="Учебный магазин ZetSlay"><header class="demo-workspace-head"><span>Учебные данные</span><p>Данные вымышлены и не связаны с вашим аккаунтом</p></header><div class="demo-section-heading"><p>${({dashboard:'Статистика продаж',orders:'Сначала новые заказы',messages:'Учебный диалог',lots:'3 учебных предложения',finance:'Расчёт на данных примера'})[view]}</p>${['dashboard','orders','finance'].includes(view)?cabinetDemoPeriods(view):''}</div><div class="demo-content">${cabinetDemoBody(view)}</div><p class="demo-notice" role="status" aria-live="polite">${demoEsc(d.notice)}</p></section>
  ${view==='dashboard'?`<section class="demo-discover"><header><h2>Автоматизация магазина</h2><button type="button" data-demo-link="plugins">Каталог плагинов ${icon('chevron')}</button></header><div>${[['zetslay.confirm-reminder','Confirm Reminder','Обычный','Напоминания о подтверждении заказа','common'],['zetslay.ai-reviews','AI Reviews','Ультра','Персональные ответы на отзывы','ultra'],['zetslay.kosell-rent','Kosell Rent','Легендарный','Аренда аккаунтов через Kosell','legendary']].map(([id,name,rarity,copy,kind])=>`<button type="button" data-demo-link="plugins/${id}" class="demo-plugin"><strong>${name}</strong><span class="demo-plugin-copy">${copy}</span><span class="demo-rarity demo-rarity--${kind}">${rarity}</span>${icon('chevron')}</button>`).join('')}</div><p class="demo-footnote">Легендарные плагины не входят в пробный период.</p></section>`:''}
  <footer class="demo-footer"><details><summary>Что входит в доступ</summary><p>В пробном периоде: обычные, продвинутые и ультра плагины. Легендарные — в тарифе «Максимум». Для подключения, синхронизации и работы плагинов нужен активный тариф или пробный период. Бессрочная покупка плагина не заменяет подписку. Товары поставщиков и внешние API оплачиваются отдельно.</p></details><button type="button" data-access-promo>Есть промокод?</button></footer></div>`;
}
function cabinetDemoRender(gate,focusId){
  if(typeof subscriptionApply==='function') subscriptionApply();
  if(focusId) gate.querySelector(`[id="${focusId}"]`)?.focus({preventScroll:true});
}
function cabinetDemoComplete(key){const d=cabinetDemoData();if(!d.completed.includes(key))d.completed.push(key);}
function cabinetDemoEventGate(target){
  if(!demoScope()||typeof subscriptionActive!=='function'||subscriptionActive())return null;
  const gate=target.closest?.('[data-access-gate]');return gate?.querySelector('.demo-experience')?gate:null;
}
document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-demo-view],[data-demo-link],[data-demo-period],[data-demo-thread],[data-demo-template],[data-demo-lot],[data-demo-reset]');
  if(!button||button.disabled)return;const gate=cabinetDemoEventGate(button);if(!gate)return;
  const d=cabinetDemoData();
  if(button.hasAttribute('data-demo-view')){const view=button.dataset.demoView;if(cabinetDemoViews.includes(view))setView(view);return;}
  if(button.hasAttribute('data-demo-link')){const view=button.dataset.demoLink;if(['plugins','plugins/zetslay.confirm-reminder','plugins/zetslay.ai-reviews','plugins/zetslay.kosell-rent'].includes(view))setView(view);return;}
  if(button.hasAttribute('data-demo-period')){const p=button.dataset.demoPeriod;if(!Object.hasOwn(demoPeriods,p))return;d.period=p;cabinetDemoComplete('period');d.notice='';}
  else if(button.hasAttribute('data-demo-thread')){const n=Number(button.dataset.demoThread);if(!Number.isInteger(n)||n<0||n>2)return;d.thread=n;d.notice='';}
  else if(button.hasAttribute('data-demo-template')){d.drafts[d.thread]=`Здравствуйте, Игрок_0${d.thread+1}! Инструкция находится в сообщении с вашим заказом. Если потребуется помощь — напишите, я подскажу.`;d.notice='Шаблон вставлен. Измените текст перед учебной отправкой.';}
  else if(button.hasAttribute('data-demo-lot')){const n=Number(button.dataset.demoLot);if(!Number.isInteger(n)||n<0||n>2)return;d.paused=d.paused.includes(n)?d.paused.filter(id=>id!==n):[...d.paused,n];cabinetDemoComplete('lot');d.notice=d.paused.includes(n)?'Учебный лот приостановлен.':'Учебный лот снова активен.';}
  else if(button.hasAttribute('data-demo-reset')){cabinetDemoReset();cabinetDemoData().notice='Учебные данные восстановлены.';}
  cabinetDemoRender(gate,button.id);
});
document.addEventListener('input',event=>{
  const el=event.target,gate=cabinetDemoEventGate(el);if(!gate)return;const d=cabinetDemoData();
  if(el.hasAttribute('data-demo-draft'))d.drafts[d.thread]=el.value.slice(0,500);
  else if(el.hasAttribute('data-demo-search')){d.query=el.value.slice(0,80);const rows=gate.querySelector('[data-demo-order-rows]');if(rows)rows.innerHTML=cabinetDemoOrderRows();}
  else return;
  // Preserve the focused input and cursor through background subscription refreshes.
  if(typeof subscriptionGateMarkup==='function')gate.accessMarkup=subscriptionGateMarkup(gate.dataset.accessView);
});
document.addEventListener('change',event=>{
  const el=event.target,gate=cabinetDemoEventGate(el);if(!gate||!el.hasAttribute('data-demo-status'))return;
  if(!['all',...Object.keys(demoStatus)].includes(el.value))return;cabinetDemoData().status=el.value;cabinetDemoRender(gate,el.id);
});
document.addEventListener('submit',event=>{
  const form=event.target.closest?.('[data-demo-message]');if(!form)return;event.preventDefault();const gate=cabinetDemoEventGate(form);if(!gate)return;
  const d=cabinetDemoData(),text=d.drafts[d.thread].trim();if(!text)return;
  if(d.sent[d.thread].length>=10){d.notice='В учебном диалоге уже 10 ответов. Можно сбросить пример.';cabinetDemoRender(gate,'demo-draft');return;}
  d.sent[d.thread].push(text);d.drafts[d.thread]='';cabinetDemoComplete('reply');d.notice='Ответ добавлен в учебный диалог.';cabinetDemoRender(gate,'demo-draft');
});
