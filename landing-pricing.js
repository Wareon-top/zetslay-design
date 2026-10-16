/* Generated from subscription-plans.json. Quotes only; no payment or permission mutation. */
(() => {
  const catalog = {"version":"2026-10-16","currency":"RUB","paymentAvailable":false,"maxTransactionKopecks":1000000,"approvalMarker":"плаtega","periods":{"month":{"months":1,"discount":0,"label":"Месяц","days":30},"quarter":{"months":3,"discount":10,"label":"3 месяца","days":90},"year":{"months":12,"discount":20,"label":"12 месяцев","days":360}},"plans":[{"id":"start","name":"Старт","monthlyRub":149,"palette":"blue","description":"Рабочий кабинет, аналитика и обычные плагины.","includes":["common"],"features":["Заказы: история, поиск и фильтры по периоду","Сообщения и ответы покупателям из кабинета","Редактирование и удаление своих лотов","Статистика и финансовый отчёт","Автообновление данных подключённого магазина","Все опубликованные обычные плагины","Confirm Reminder и Review Reminder","«Приоритетные заказы» — крупные сделки"],"footer":"Вся основа для одного магазина","footerDescription":"Заказы, переписка, лоты и показатели — в одном кабинете."},{"id":"growth","name":"Рост","monthlyRub":299,"palette":"purple","description":"Массовая работа с лотами и автоматизация отзывов.","includes":["common","advanced"],"features":["Все возможности тарифа «Старт»","Все опубликованные продвинутые плагины","Lot Cloner — копирование своих лотов","Mass Price Editor — массовая переоценка","«Пауза продаж» — отключение и восстановление","Auto Review Bonus — бонус за отзыв","Сводка и подтверждение массовых изменений","Управление поддерживаемыми модулями из Telegram"],"footer":"Меньше ручных действий","footerDescription":"Копирование, переоценка, пауза продаж и бонусы покупателям."},{"id":"pro","name":"Профи","monthlyRub":499,"palette":"amber","featured":"Оптимальный выбор","description":"Ответы ИИ на отзывы и автоматизация заказов Robux.","includes":["common","advanced","ultra"],"features":["Все возможности тарифа «Рост»","Все опубликованные ультра-плагины","AI Reviews — ответы ИИ на отзывы","Robux Relay — обработка заказов на Robux","Лимиты и разрешения внешних операций","Очередь, журнал и проверка результата","Свои API-ключи для внешних интеграций","Обновления включённых модулей ZetSlay"],"footer":"ИИ и дополнительные интеграции","footerDescription":"Использование API нейросетей и расходы поставщиков оплачиваются отдельно."},{"id":"maximum","name":"Максимум","monthlyRub":799,"palette":"teal","description":"Аренда Steam и все опубликованные плагины ZetSlay.","includes":["common","advanced","ultra","legendary"],"features":["Все возможности тарифа «Профи»","Все опубликованные легендарные плагины","Steam Rent — аренда своих Steam-аккаунтов","Kosell Rent — аренда через поставщика","Roblox LZT Market — выдача по заказам","Stars Relay — обработка заказов на Stars","TikTok LZT Market — выдача по заказам","Управление арендами, выдачей и остатками"],"footer":"Все четыре редкости","footerDescription":"Для Steam Rent нужны свои аккаунты. Товары и аренды поставщиков в цену не входят."}],"conditions":["Подписка предоставляет доступ к ZetSlay для одного магазина FunPay с одним закреплённым прокси и опубликованным собственным плагинам указанных категорий.","Для подключения и синхронизации магазина FunPay, автовыдачи и работы любых плагинов нужен активный тариф или пробный период с учётом его ограничений. Бессрочная покупка плагина не заменяет подписку на сервис.","При окончании доступа синхронизация и новые операции плагинов приостанавливаются. Купленные бессрочные лицензии сохраняются: при возобновлении подписки повторно покупать их не нужно.","Стоимость за длительный период оплачивается целиком; полная сумма показана под ценой. Срок доступа отсчитывается с его активации.","Месяц доступа — 30 дней, 3 месяца — 90 дней, 12 месяцев — 360 дней. Точные даты начала и окончания показываются в кабинете.","Прокси, товары LZT Market, аренды Kosell, Robux, Stars, использование API нейросетей и комиссии внешних площадок оплачиваются отдельно. Для Steam Rent нужны ваши собственные аккаунты.","Покупки в будущем маркетплейсе сторонних разработчиков не входят в подписку.","Операции плагинов требуют настройки и отдельных разрешений владельца. Новые интеграции и функции в разработке не входят в обещанный состав."],"availability":"Пополните внутренний баланс через Platega, затем оплатите выбранный тариф с баланса в кабинете. Доступность пополнения проверяется перед операцией.","platformFeatures":[{"title":"Заказы и сообщения","description":"История заказов, поиск, фильтры и ответы покупателям прямо из кабинета. История накапливается по мере синхронизации."},{"title":"Лоты и товары","description":"Просмотр, редактирование и удаление своих обычных лотов FunPay с подтверждением изменений."},{"title":"Статистика и финансы","description":"Показатели по дням, неделям и месяцам. Доход, расходы и чистая прибыль — при наличии данных о расходах."},{"title":"Фоновое обновление","description":"Сервер синхронизирует магазин в фоне. Новые данные появляются в открытом кабинете автоматически."},{"title":"Личный Telegram-бот","description":"Уведомления и управление поддерживаемыми плагинами. Ключи и пароли вводятся только в кабинете."},{"title":"Подключение и защита","description":"Отдельная проверка прокси и авторизации магазина, шифрование ключей и двухфакторная защита аккаунта."}],"pluginGroups":[{"rarity":"common","label":"Обычные","plugins":[{"id":"zetslay.confirm-reminder","name":"Confirm Reminder","description":"Напоминание о подтверждении заказа"},{"id":"zetslay.review-reminder","name":"Review Reminder","description":"Напоминание об отзыве"},{"id":"zetslay.priority-orders","name":"Приоритетные заказы","description":"Уведомления о крупных сделках"}]},{"rarity":"advanced","label":"Продвинутые","plugins":[{"id":"zetslay.lot-cloner","name":"Lot Cloner","description":"Копирование своих лотов"},{"id":"zetslay.mass-price-editor","name":"Mass Price Editor","description":"Массовое изменение цен"},{"id":"zetslay.sales-pause","name":"Пауза продаж","description":"Отключение и восстановление лотов"},{"id":"zetslay.auto-review-bonus","name":"Auto Review Bonus","description":"Бонусы за подтверждённые отзывы"}]},{"rarity":"ultra","label":"Ультра","plugins":[{"id":"zetslay.robux-relay","name":"Robux Relay","description":"Обработка заказов на Robux"},{"id":"zetslay.ai-reviews","name":"AI Reviews","description":"Генерация и публикация ответов на отзывы"}]},{"rarity":"legendary","label":"Легендарные","plugins":[{"id":"zetslay.steam-rent","name":"Steam Rent","description":"Аренда своих Steam-аккаунтов"},{"id":"zetslay.kosell-rent","name":"Kosell Rent","description":"Аренда через Kosell"},{"id":"zetslay.roblox-lzt-market","name":"Roblox LZT Market","description":"Выдача по заказам Roblox"},{"id":"zetslay.stars-relay","name":"Stars Relay","description":"Обработка заказов на Stars"},{"id":"zetslay.tiktok-lzt-market","name":"TikTok LZT Market","description":"Выдача по заказам TikTok"}]}],"trial":{"days":3,"includes":["common","advanced","ultra"],"description":"Весь кабинет и опубликованные обычные, продвинутые и ультра-плагины. Легендарные плагины не включены. Без автоматического списания."}};
  const periods = Object.freeze(Object.fromEntries(Object.entries(catalog.periods).map(([key,value])=>[key,Object.freeze(value)])));
  const plans = Object.freeze(catalog.plans.map(plan => Object.freeze({ ...plan, features:Object.freeze(plan.features), includes:Object.freeze(plan.includes) })));
  function isPaymentAmountAllowed(kopecks) {
    return Number.isSafeInteger(kopecks) && kopecks > 0 && kopecks <= catalog.maxTransactionKopecks;
  }
  function pricingQuote(monthlyRub, periodId) {
    const period = Object.hasOwn(periods, periodId) ? periods[periodId] : null;
    if (!Number.isSafeInteger(monthlyRub) || monthlyRub <= 0 || monthlyRub > 100000 || !period) return null;
    const monthlyKopecks = monthlyRub * (100 - period.discount);
    const totalKopecks = monthlyKopecks * period.months;
    return isPaymentAmountAllowed(totalKopecks) ? { ...period, monthlyKopecks, totalKopecks } : null;
  }
  function rubles(kopecks) {
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits:kopecks % 100 ? 2 : 0, maximumFractionDigits:2 }).format(kopecks / 100) + ' ₽';
  }
  function quote(planId, periodId = 'month') {
    const plan = plans.find(plan => plan.id === planId);
    const value = plan && pricingQuote(plan.monthlyRub, periodId);
    return value ? { ...value, planId:plan.id, name:plan.name, features:plan.features, includes:plan.includes, currency:catalog.currency } : null;
  }
  const pluginGroups=Object.freeze(catalog.pluginGroups.map(g=>Object.freeze({...g,plugins:Object.freeze(g.plugins.map(p=>Object.freeze(p)))})));
  const trial=Object.freeze({...catalog.trial,includes:Object.freeze(catalog.trial.includes)});
  globalThis.ZetSlayPricing = Object.freeze({ version:catalog.version, pluginGroups, trial, plans, periods, quote, rubles, paymentAvailable:false, maxTransactionKopecks:catalog.maxTransactionKopecks, isPaymentAmountAllowed });
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
    if (!Object.hasOwn(periods,periodId)) return false;
    const values=cards.map(card=>quote(card.id,periodId));
    if(values.some(value=>!value))return false;
    root.dataset ||= {};
    root.dataset.pricingPeriod=periodId;
    cards.forEach((card,index) => {
      const value=values[index];
      card.price.textContent=rubles(value.monthlyKopecks);
      card.original.hidden=!value.discount;
      card.original.textContent=rubles(card.monthlyRub*100);
      card.note.textContent=value.months===1 ? `Итого ${rubles(value.totalKopecks)} за ${value.days} дней доступа` : `${rubles(value.totalKopecks)} за ${value.months===3?'3 месяца':'12 месяцев'} · ${value.days} дней · скидка ${value.discount}% · оплата целиком`;
    });
    buttons.forEach(button => button.setAttribute('aria-pressed',String(button.dataset.pricingPeriod===periodId)));
    if(announce && announcement) {
      const period=periods[periodId];
      announcement.textContent=`${period.label}. ${period.discount ? `Скидка ${period.discount}%. ` : ''}Показана стоимость в месяц; полная сумма указана под ценой.`;
    }
    return true;
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
  if(select('month',false))picker.hidden=false;
})();
