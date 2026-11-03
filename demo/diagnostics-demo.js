/* Synthetic scenarios, entirely in memory. No real orders, sessions or requests. */
function mountPublicDiagnostics(root){
 const stamp=new Date().toISOString(),scope=()=>({storeId:'demo-store'});
 const scenarios=[
  ['critical','purchase','Результат закупки не подтверждён','Поставщик не подтвердил результат. Покупка могла состояться.','Повторная закупка может создать дубль и повторное списание.','Сверьте заказ и историю поставщика; продолжайте после подтверждения исхода.','EXAMPLE01','Проверить заказ'],
  ['warning','stock','Заказ ждёт пополнения склада','В связанной группе нет готовых позиций.','Автоматическая выдача для этого заказа ожидает товар.','Проверьте остатки, резерв и привязку лота перед пополнением.','EXAMPLE02','Открыть учебные лоты'],
  ['warning','connection','Данные магазина требуют проверки','Последняя успешная синхронизация устарела.','Статусы заказов и результат операций могут быть неполными.','Проверьте подключение. Отсутствующее обновление не означает, что выдача не состоялась.',null,'Проверить подключение'],
  ['info','orders','Оплаченный заказ ждёт проверки результата','В сохранённом состоянии нет подтверждения завершения.','Выдача могла быть выполнена вручную.','Проверьте заказ и переписку перед любым повторным действием.','EXAMPLE03','Проверить заказ']
 ];
 const all=scenarios.map(([severity,category,title,cause,consequence,solution,orderId,label],index)=>({id:String(index+1).repeat(64),severity,category,title,cause,consequence,solution,storeId:'demo-store',orderId,since:new Date(Date.now()-(index+1)*1200000).toISOString(),action:{view:category==='connection'?'connect':category==='stock'?'store-tools':'orders',label}}));
 let panel;const feed=createDiagnosticsFeed({scope,changed:()=>panel?.render(),request:async path=>{const p=new URL(path,location.origin).searchParams,q=p.get('query').toLocaleLowerCase('ru-RU'),severity=p.get('severity'),category=p.get('category');const issues=all.filter(i=>(severity==='all'||i.severity===severity)&&(category==='all'||i.category===category)&&(!q||[i.title,i.cause,i.orderId||''].join(' ').toLocaleLowerCase('ru-RU').includes(q)));return {schema:1,storeId:'demo-store',observedAt:stamp,lastSuccessAt:new Date(Date.now()-1200000).toISOString(),complete:true,coverage:[{source:'example',label:'Учебные состояния',status:'checked'}],counts:{total:4,critical:1,warning:2,info:1},total:issues.length,nextOffset:null,issues};}});
 panel=mountDiagnosticsCenter(root,{feed,demo:true,navigate:issue=>{setView(issue.category==='connection'?'connection':issue.category==='stock'?'lots':'orders');}});void feed.load();return {destroy(){feed.cancel();panel.destroy();}};
}
if(publicDemoView==='diagnostics')renderPublicDemo();
