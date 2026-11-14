/* Presentation only. All access decisions and writes stay in the authenticated host. */
(function (root) {
  'use strict';
  const groups = [
    {title:'Магазин',items:[['dashboard','Главная','home'],['events','Центр событий','bell'],['orders','Заказы','orders'],['messages','Сообщения','message'],['lots','Лоты и товары','grid']]},
    {title:'Автоматизация',items:[['store-tools','Автоматизация','sliders'],['plugins','Плагины','plug'],['proxy-shop','Прокси','route']]},
    {title:'Отчёты',items:[['analytics','Аналитика','chart'],['finance','Финансы','wallet']]},
    {title:'Аккаунт',items:[['billing','Подписка и баланс','card'],['profile','Профиль','user'],['connection','Подключение FunPay','link'],['telegram','Telegram-бот','send'],['security','Безопасность','shield'],['guide','База знаний','help'],['support','Поддержка','chat'],['documents','Документы','doc']]}
  ];
  const art = Object.freeze({"zetslay.stars-relay":"plg-stars","zetslay.robux-relay":"plg-robux","zetslay.kosell-rent":"plg-rent","zetslay.steam-rent":"plg-steam","zetslay.mass-price-editor":"plg-prices","zetslay.lot-cloner":"plg-cloner","zetslay.sales-pause":"plg-pause","zetslay.priority-orders":"plg-priority","zetslay.ai-reviews":"plg-ai","zetslay.review-reminder":"plg-remind","zetslay.roblox-lzt-market":"plg-roblox-lzt","zetslay.tiktok-lzt-market":"plg-tiktok-lzt","zetslay.ticket-pilot":"plg-ticket-pilot","zetslay.confirm-reminder":"plg-confirm-reminder","zetslay.auto-review-bonus":"plg-review-bonus"});
  const categories = [
    {id:'currency',title:'Валюта и подарки',art:'cat-currency',ids:['zetslay.stars-relay','zetslay.robux-relay']},
    {id:'rent',title:'Аренда и аккаунты',art:'cat-rent',ids:['zetslay.kosell-rent','zetslay.steam-rent','zetslay.roblox-lzt-market','zetslay.tiktok-lzt-market']},
    {id:'reviews',title:'Отзывы и сообщения',art:'cat-reviews',ids:['zetslay.ai-reviews','zetslay.review-reminder','zetslay.confirm-reminder','zetslay.auto-review-bonus','zetslay.ticket-pilot']},
    {id:'tools',title:'Инструменты магазина',art:'cat-tools',ids:[]}
  ];
  function category(id) { return categories.find(c=>c.ids.includes(id)) || categories[3]; }
  function route(value) {
    const raw=String(value||'').replace(/^#?\/?/,'');
    const [path,search='']=raw.split('?'), parts=path.split('/'), first=parts[0];
    if(first==='automation')return {view:'store-tools',sub:parts[1]||'warehouse',search};
    if(first==='proxy')return {view:'proxy-shop',sub:parts[1]||'',search};
    if((first==='plugins'||first==='authors')&&parts[1])return {view:path,sub:'',search};
    return {view:first||'dashboard',sub:parts[1]||'',search};
  }
  function stateOf(p) {
    if(p.published===false)return {label:'Черновик',tone:'muted'};
    if(p.planned)return {label:'Скоро',tone:'muted'};
    if(!p.installed)return {label:'Не установлен',tone:'muted'};
    return p.active?{label:'Включён',tone:'success'}:{label:'На паузе',tone:'muted'};
  }
  root.ZSCabinetModel=Object.freeze({groups,art,categories,category,route,stateOf});
})(globalThis);
