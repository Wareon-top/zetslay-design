/* Read-only catalogue summary. Payment quotes and access are still confirmed by the server. */
(() => {
 if(typeof paymentsOpen!=='function')return;
 const previous=paymentsOpen;
 paymentsOpen=function(kind,opener,pluginId=null){
  const account=paymentsScope(),period=document.querySelector('[data-billing-pricing]')?.dataset.pricingPeriod||'month';
  const work=previous.apply(this,arguments),dialog=paymentsUi.dialog;
  return Promise.resolve(work).then(result=>{
   if(pluginId||!['start','growth','pro','maximum'].includes(kind)||account!==paymentsScope()||!dialog?.isConnected||paymentsUi.dialog!==dialog)return result;
   const quote=typeof ZetSlayPricing==='object'?ZetSlayPricing.quote(kind,period):null,host=dialog.querySelector('[data-payments-body]'),form=host?.querySelector('[data-payment-form]');
   if(!quote||!form||host.querySelector('[data-tariff-summary]'))return result;
   const details=document.createElement('details');details.className='payments-plan-summary';details.dataset.tariffSummary=kind;
   details.innerHTML=`<summary>Что входит в «${paymentsSafe(quote.name)}»<span>${quote.days} дней доступа</span></summary><ul>${quote.features.map(f=>`<li>${paymentsSafe(f)}</li>`).join('')}</ul><p>Один магазин FunPay. Прокси, товары поставщиков и API нейросетей оплачиваются отдельно. Подписка действует до указанной в кабинете даты; автоматических списаний нет.</p>`;
   host.insertBefore(details,form);return result;
  });
 };
})();
