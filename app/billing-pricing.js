/* Generated from subscription-plans.json. Quotes only; no payment or permission mutation. */
(() => {
  const catalog = {"version":"2026-10-09","currency":"RUB","paymentAvailable":false,"periods":{"month":{"months":1,"discount":0,"label":"Месяц"},"quarter":{"months":3,"discount":10,"label":"3 месяца"},"year":{"months":12,"discount":20,"label":"12 месяцев"}},"plans":[{"id":"start","name":"Старт","monthlyRub":149,"palette":"blue","description":"Ежедневная работа магазина и напоминания покупателям.","includes":["common"],"features":["Один подключённый магазин FunPay","Заказы, диалоги и ответы покупателям","Каталог лотов и статистика магазина","Персональный Telegram-бот","Все опубликованные обычные плагины","Confirm Reminder — подтверждение заказа","Review Reminder — напоминание об отзыве","Шифрование доступов и 2FA в профиле"],"footer":"Начните с ежедневных задач","footerDescription":"Кабинет продавца и два вида напоминаний."},{"id":"growth","name":"Рост","monthlyRub":299,"palette":"purple","description":"Меньше ручной работы с ассортиментом и отзывами.","includes":["common","advanced"],"features":["Все возможности тарифа «Старт»","Все опубликованные продвинутые плагины","Lot Cloner — копирование своих лотов","Mass Price Editor — массовая переоценка","«Пауза продаж» — отключение и восстановление","Auto Review Bonus — подарки за отзыв","Настройки и управление плагинами в боте","Обновления включённых модулей ZetSlay"],"footer":"Управляйте ассортиментом","footerDescription":"Цены, доступность, копии лотов и благодарности за отзывы."},{"id":"pro","name":"Профи","monthlyRub":499,"palette":"amber","featured":"Оптимальный выбор","description":"Аренды и выдача товаров через внешние сервисы.","includes":["common","advanced","ultra"],"features":["Все возможности тарифа «Рост»","Все опубликованные ультра-плагины","Kosell Rent — автоматизация аренды","TikTok LZT Market — выдача по заказам","Roblox LZT Market — выдача по заказам","Stars Relay — обработка заказов на Stars","Лимиты и разрешения внешних операций","Обновления включённых модулей ZetSlay"],"footer":"Подключите нужные интеграции","footerDescription":"Расходы поставщиков оплачиваются отдельно от подписки."},{"id":"maximum","name":"Максимум","monthlyRub":799,"palette":"teal","description":"Полный набор опубликованных собственных плагинов.","includes":["common","advanced","ultra","legendary"],"features":["Все возможности тарифа «Профи»","Все опубликованные легендарные плагины","Robux Relay — покупка Game Pass по заказу","Обычные, продвинутые и ультра-плагины","Ручные операции и автоматизация модулей","Очереди, статусы и отчёты внутри плагинов","Управление через кабинет и Telegram","Обновления включённых модулей ZetSlay"],"footer":"Полный каталог ZetSlay","footerDescription":"Включены собственные модули всех четырёх категорий."}],"conditions":["Подписка предоставляет доступ к ZetSlay для одного магазина FunPay и опубликованным собственным плагинам указанных категорий.","Стоимость за длительный период оплачивается целиком; полная сумма показана под ценой. Срок доступа отсчитывается с его активации.","Прокси, товары LZT Market, аренды Kosell, Robux, Stars и комиссии внешних площадок оплачиваются отдельно.","Покупки в будущем маркетплейсе сторонних разработчиков не входят в подписку.","Операции плагинов требуют настройки и отдельных разрешений владельца. Новые интеграции и функции в разработке не входят в обещанный состав."],"availability":"Приём платежей подключается. Сейчас можно создать кабинет и ознакомиться с условиями; оформить платную подписку пока нельзя."};
  const periods = Object.freeze(Object.fromEntries(Object.entries(catalog.periods).map(([key,value])=>[key,Object.freeze(value)])));
  const plans = Object.freeze(catalog.plans.map(plan => Object.freeze({ ...plan, features:Object.freeze(plan.features), includes:Object.freeze(plan.includes) })));
  function pricingQuote(monthlyRub, periodId) {
    const period = Object.hasOwn(periods, periodId) ? periods[periodId] : null;
    if (!Number.isSafeInteger(monthlyRub) || monthlyRub <= 0 || monthlyRub > 100000 || !period) return null;
    const monthlyKopecks = monthlyRub * (100 - period.discount);
    return { ...period, monthlyKopecks, totalKopecks:monthlyKopecks * period.months };
  }
  function rubles(kopecks) {
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits:kopecks % 100 ? 2 : 0, maximumFractionDigits:2 }).format(kopecks / 100) + ' ₽';
  }
  function quote(planId, periodId = 'month') {
    const plan = plans.find(plan => plan.id === planId);
    const value = plan && pricingQuote(plan.monthlyRub, periodId);
    return value ? { ...value, planId:plan.id, name:plan.name, features:plan.features, includes:plan.includes, currency:catalog.currency } : null;
  }
  globalThis.ZetSlayPricing = Object.freeze({ plans, periods, quote, rubles, paymentAvailable:false });
  const root = document.querySelector('[data-landing-pricing="plans-v1"]');
  if (!root) return;
  const picker=root.querySelector('[data-pricing-periods]'),buttons=Array.from(root.querySelectorAll('[data-pricing-period]'));
  const announcement=root.querySelector('[data-pricing-announcement]');
  const cards=Array.from(root.querySelectorAll('[data-pricing-plan]')).map(card => ({
    id:card.dataset.pricingPlan,monthlyRub:Number(card.dataset.monthlyRub),
    price:card.querySelector('[data-pricing-price]'),original:card.querySelector('[data-pricing-original]'),note:card.querySelector('[data-pricing-note]')
  }));
  if (!picker || buttons.length!==3 || cards.length!==4 || cards.some((card,index) => card.id !== plans[index].id || card.monthlyRub !== plans[index].monthlyRub || !card.price || !card.original || !card.note)) return;
  function select(periodId, announce=true) {
    if (!Object.hasOwn(periods,periodId)) return;
    root.dataset ||= {};
    root.dataset.pricingPeriod=periodId;
    cards.forEach(card => {
      const value=quote(card.id,periodId);
      card.price.textContent=rubles(value.monthlyKopecks);
      card.original.hidden=!value.discount;
      card.original.textContent=rubles(card.monthlyRub*100);
      card.note.textContent=value.months===1 ? `Итого ${rubles(value.totalKopecks)} за 1 месяц доступа` : `${rubles(value.totalKopecks)} за ${value.months===3?'3 месяца':'12 месяцев'} · скидка ${value.discount}% · оплата целиком`;
    });
    buttons.forEach(button => button.setAttribute('aria-pressed',String(button.dataset.pricingPeriod===periodId)));
    if(announce && announcement) {
      const period=periods[periodId];
      announcement.textContent=`${period.label}. ${period.discount ? `Скидка ${period.discount}%. ` : ''}Показана стоимость в месяц; полная сумма указана под ценой.`;
    }
  }
  buttons.forEach((button,index) => {
    button.addEventListener('click',()=>select(button.dataset.pricingPeriod));
    button.addEventListener('keydown',event => {
      const last=buttons.length-1;
      const next=event.key==='ArrowRight' ? (index+1)%buttons.length : event.key==='ArrowLeft' ? (index+last)%buttons.length : event.key==='Home' ? 0 : event.key==='End' ? last : null;
      if(next===null)return;
      event.preventDefault();buttons[next].focus();select(buttons[next].dataset.pricingPeriod);
    });
  });
  select('month',false);picker.hidden=false;
})();
