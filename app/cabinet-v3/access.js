/* Demo mode: what the cabinet shows without a trial or a paid plan.
 * Presentation only. The server owns access: nothing here grants a plan, calls the API or
 * changes the shop. Buttons reuse the host contracts (data-access-trial / -billing / -promo /
 * -guide) handled by subscription-access.js; the sample shop stays cabinet-demo.js. */
(function(){
  'use strict';
  if(typeof subscriptionGateMarkup!=='function'||typeof subscriptionActive!=='function'||typeof authState==='undefined')return;
  const E=v=>escapeHtml(String(v??'')),I=n=>window.ZSIcons?.svg(n)||'';
  const art=(n,c='')=>`<img class="${c}" src="cabinet-v3/assets/quality-v2/${n}.webp" alt="" loading="lazy" decoding="async">`;
  const gated=['dashboard','orders','messages','lots','finance'];
  const stripViews=['plugins','plugin','store-tools','analytics'];
  const planNames={start:'Старт',growth:'Рост',pro:'Профи',maximum:'Максимум',trial_3d:'Пробный период'};
  const sections={
    dashboard:['Главная','Продажи, заказы и результат магазина за период.','Статистика вашего магазина'],
    orders:['Заказы','История продаж по датам. Новые заказы — первыми.','Список ваших заказов'],
    messages:['Сообщения','Переписка с покупателями без переключения вкладок.','Переписка с покупателями и ответы'],
    lots:['Лоты и товары','Цены, наличие и управление предложениями.','Ваши лоты, цены и наличие'],
    finance:['Финансы','Доход, расходы и прибыль по каждому заказу.','Доход и прибыль по заказам']
  };
  const hostGateMarkup=subscriptionGateMarkup;

  function trialInfo(){
    const trial=typeof subscriptionTrialState==='function'?subscriptionTrialState():null;
    const sidebar=typeof sidebarTrialUi!=='undefined'&&typeof sidebarTrialScope==='function'&&sidebarTrialUi.scope===sidebarTrialScope();
    const busy=Boolean(subscriptionUi.activating||(sidebar&&sidebarTrialUi.pending));
    const error=subscriptionUi.error||(sidebar?sidebarTrialUi.error:'')||'';
    return {trial,busy,error};
  }
  // Which story to tell. Only server-reported facts are used; nothing is guessed as "active".
  function situation(){
    const {trial,busy,error}=trialInfo(),p=authState.workspace?.plan||{};
    const lapsed=p.id&&Object.hasOwn(planNames,p.id)?p.id:null;
    if(trial==='available')return {kind:'trial',trial,busy,error,label:'Демо-режим',
      title:'Попробуйте ZetSlay 3 дня бесплатно',
      copy:'Тариф не активен, поэтому кабинет работает в демо-режиме: магазин не синхронизируется, плагины не выполняют действия. Пробный период включается один раз на 72 часа — без оплаты и автосписаний.'};
    if(lapsed==='trial_3d')return {kind:'paid',trial,busy,error,label:'Пробный период закончился',
      title:'Пробные 72 часа истекли',
      copy:'Операции магазина и плагины остановлены. Настройки и данные сохранены — выберите тариф, чтобы продолжить работу.'};
    if(lapsed)return {kind:'paid',trial,busy,error,label:'Срок тарифа истёк',
      title:`Тариф «${planNames[lapsed]}» закончился`,
      copy:'Операции магазина и плагины остановлены. Настройки и данные сохранены — продлите тариф или выберите другой, чтобы возобновить работу.'};
    if(trial==='used')return {kind:'paid',trial,busy,error,label:'Демо-режим',
      title:'Пробный период уже использован',
      copy:'Тариф не активен: магазин не синхронизируется, плагины не выполняют действия. Чтобы продолжить, выберите тариф — от 149 ₽ за 30 дней.'};
    return {kind:'unknown',trial,busy,error,label:'Демо-режим',
      title:'Тариф не активен',
      copy:'Магазин не синхронизируется, плагины не выполняют действия. Выберите тариф или проверьте, доступен ли вам пробный период.'};
  }
  function actions(s,compact=false){
    const sm=compact?' btn--sm':'';
    if(s.kind==='trial')return `<button type="button" class="btn btn--primary${sm}" data-access-trial ${s.busy?'disabled':''} aria-busy="${s.busy}">${s.busy?'Активируем…':(compact?'Попробовать 3 дня бесплатно':'Активировать пробный период')}</button>${compact?'':`<button type="button" class="btn btn--secondary" data-access-billing>Сравнить тарифы</button>`}`;
    return `<button type="button" class="btn btn--primary${sm}" data-access-billing>${s.kind==='paid'&&/закончил|истекл/.test(s.title)?'Продлить или выбрать тариф':'Выбрать тариф'}</button>${s.kind==='unknown'&&!compact?`<button type="button" class="btn btn--secondary" data-access-trial ${s.busy?'disabled':''} aria-busy="${s.busy}">${s.busy?'Проверяем…':'Проверить пробный период'}</button>`:''}`;
  }
  function saved(){
    const ob=typeof state!=='undefined'?state.onboarding:null,known=Boolean(ob);
    const store=typeof selectedStore==='function'?selectedStore():null;
    const plugins=typeof state!=='undefined'&&Array.isArray(state.plugins)?state.plugins.filter(p=>p.installed).length:0;
    const licenses=Array.isArray(authState.workspace?.pluginLicenses)?authState.workspace.pluginLicenses.length:0;
    const row=(image,title,value,ok,cls='')=>`<li class="zs-access-saved__row${ok?' is-ok':''}${cls}">${art(image,'zs-access-saved__art')}<span><strong>${title}</strong><small>${E(value)}</small></span>${ok?`<i class="zs-access-saved__mark" aria-label="Сохранено">${I('check')}</i>`:''}</li>`;
    const pluginText=plugins?`Установлено: ${plugins} · настройки сохранены`:'Пока не установлены';
    // «demo-start» on the FunPay row is the anchor the host learning tour (app/learning.js, step «Подключение FunPay»)
    // falls back to; the old demo offer it used to point at is no longer rendered here.
    return row('telegram-bot','Telegram-бот',!known?'Нет данных':ob.telegram?.linked?'Привязан':'Не привязан',known&&ob.telegram?.linked)
      +row('funpay-store','Магазин FunPay',store?.displayName?store.displayName+(store.storeId?' · ID '+store.storeId:''):(known&&ob.funPay?.storeId?'Привязан · ID '+ob.funPay.storeId:'Не подключён'),Boolean(store||ob?.funPay?.storeId),' demo-start')
      +row('proxy-router','Прокси',!known?'Нет данных':ob.funPay?.proxyConfigured?'Настроен':'Не настроен',known&&ob.funPay?.proxyConfigured)
      +row('cat-tools','Плагины',pluginText+(licenses?` · лицензий навсегда: ${licenses}`:''),plugins>0||licenses>0);
  }
  function stripDemo(html,view){
    return String(html||'')
      .replace(/<header class="demo-intro">[\s\S]*?<\/header>/,'')
      .replace(/<section class="demo-start"[\s\S]*?<\/section>/,'')
      .replace(/<footer class="demo-footer">[\s\S]*?<\/footer>/,'')
      .replaceAll(`id="access-${view}-title"`,'');
  }
  function gateMarkup(view){
    if(!gated.includes(view))return hostGateMarkup(view);
    const [title,lead,own]=sections[view],s=situation();
    const store=typeof selectedStore==='function'?selectedStore():null;
    const demo=typeof cabinetDemoExperience==='function'?stripDemo(cabinetDemoExperience(view,{trial:s.trial,busy:s.busy,error:''}),view):'';
    const steps=s.kind==='trial'
      ?['Активируйте пробный период — 72 часа, один раз на аккаунт.','Подключите Telegram-бота и магазин FunPay, если ещё не подключены.','Данные магазина появятся здесь после синхронизации.']
      :['Выберите тариф — от 149 ₽ за 30 дней. Автосписаний нет.','Оплата списывается с баланса ZetSlay; пополнение само тариф не включает.','После активации работа магазина и плагинов возобновится, данные загрузятся при синхронизации.'];
    return `<header class="cover cover--section zs-cover zs-access-cover"><img class="cover__sky" src="cabinet-v3/assets/img/cover-sunset.webp" alt=""><div class="cover__identity"><div class="cover__copy"><p>Личный кабинет ZetSlay · демо-режим</p><h1 id="access-${view}-title">${E(title)}</h1><span class="cover__lead">${E(lead)}</span><span class="cover__chips"><span class="cover-chip">${I('lock')}Тариф не активен</span><span class="cover-chip">${I(store?'check':'plug')}${store?'Магазин привязан':'Магазин не подключён'}</span></span></div></div><div class="cover__emblem" aria-hidden="true">${art('zetslay-z')}</div></header>
<section class="zs-access" aria-labelledby="zs-access-${view}-offer" data-zs-access="${s.kind}">
  <div class="zs-access__main">
    <span class="zs-access__label"><i aria-hidden="true"></i>${E(s.label)}</span>
    <h2 id="zs-access-${view}-offer">${E(s.title)}</h2>
    <p>${E(s.copy)}</p>
    ${s.kind==='trial'?'<ul class="zs-access__facts"><li><strong>72 часа</strong><span>один раз</span></li><li><strong>0 ₽</strong><span>без автосписаний</span></li><li><strong>до «Ультра»</strong><span>редкость плагинов</span></li></ul>':''}
    <div class="zs-access__actions">${actions(s)}</div>
    <button type="button" class="zs-access__promo" data-access-promo>${I('tag')}У меня есть промокод</button>
    ${s.error?`<p class="zs-access__error" role="alert">${E(s.error)}</p>`:''}
  </div>
  <div class="zs-access__art" aria-hidden="true">${art('subscription')}</div>
</section>
<div class="zs-access-grid">
  <section class="zs-access-card zs-access-card--off" aria-labelledby="zs-access-${view}-off"><h3 id="zs-access-${view}-off">${I('pause')}Не работает без тарифа</h3><ul>
    <li>${E(own)}</li><li>Подключение и синхронизация FunPay</li><li>Плагины и автоматизация</li><li>Действия через личного Telegram-бота</li></ul></section>
  <section class="zs-access-card zs-access-card--saved" aria-labelledby="zs-access-${view}-saved"><h3 id="zs-access-${view}-saved">${I('shield')}Сохранено</h3><ul class="zs-access-saved">${saved()}</ul><p class="zs-access-card__note">Ранее полученные заказы, переписка и отчёты не удаляются и станут доступны после активации.</p></section>
  <section class="zs-access-card zs-access-card--steps" aria-labelledby="zs-access-${view}-steps"><h3 id="zs-access-${view}-steps">${I('bolt')}Как включить</h3><ol>${steps.map(t=>`<li>${E(t)}</li>`).join('')}</ol><button type="button" class="zs-access-card__link" data-access-guide>Как работает сервис ${I('chevron')}</button></section>
</div>
${demo?`<section class="zs-access-demo" aria-labelledby="zs-access-${view}-demo"><header class="zs-access-demo__head"><div><span class="zs-access__label zs-access__label--muted"><i aria-hidden="true"></i>Учебный пример</span><h2 id="zs-access-${view}-demo">Как раздел выглядит в работе</h2><p>Вымышленный магазин. Действия в примере остаются на этой странице и не затрагивают ваш аккаунт FunPay.</p></div><button type="button" class="btn btn--quiet btn--sm" data-demo-reset id="demo-reset-${view}">${I('refresh')}Сбросить пример</button></header>${demo}</section>`:''}
<p class="zs-access-fine">Легендарные плагины входят только в тариф «Максимум» и не входят в пробный период. Плагины, купленные навсегда, тоже работают только при активном тарифе — их лицензии сохраняются. Прокси, товары поставщиков и внешние сервисы оплачиваются отдельно.</p>`;
  }
  // Global function declarations are looked up at call time, so the host gate renders this markup.
  window.subscriptionGateMarkup=gateMarkup;

  function strip(view){
    let node=view.querySelector(':scope > [data-zs-access-strip]');
    const show=authState.user&&!subscriptionActive();
    if(!show){node?.remove();return;}
    const s=situation(),markup=`${I('lock')}<p><strong>Тариф не активен.</strong> Операции магазина и плагины остановлены, настройки и данные сохранены.</p><span class="zs-access-strip__actions">${actions(s,true)}</span>`;
    if(!node){node=document.createElement('div');node.className='zs-access-strip';node.dataset.zsAccessStrip='';node.setAttribute('role','note');}
    const cover=view.querySelector(':scope > .zs-cover');
    if(cover?cover.nextElementSibling!==node:view.firstElementChild!==node)cover?cover.after(node):view.prepend(node);
    if(node.zsMarkup!==markup){node.innerHTML=markup;node.zsMarkup=markup;}
  }
  function sync(){
    if(!authState.user)return;
    const blocked=!subscriptionActive();
    if(blocked&&typeof subscriptionGate==='function')for(const view of gated){const root=document.querySelector(`[data-view="${view}"]`);if(root?.hasAttribute('data-access-blocked'))subscriptionGate(root,true,view);}
    for(const view of stripViews){const root=document.querySelector(`[data-view="${view}"]`);if(root)strip(root);}
  }
  const hostApply=window.subscriptionApply;
  if(typeof hostApply==='function')window.subscriptionApply=function(...args){const result=hostApply.apply(this,args);sync();return result;};
  const fidelity=window.ZSCabinetFidelity;
  if(fidelity&&typeof fidelity.refresh==='function'){const before=fidelity.refresh;fidelity.refresh=function(...args){const result=before.apply(this,args);sync();return result;};}
  window.ZSAccess=Object.freeze({sync,situation});
  if(typeof subscriptionApply==='function'&&authState.user)subscriptionApply();
})();
