/* Explicit owner actions; uncertainty is reconciled through reads, never resubmitted. */
const lotManagementUi={sequence:0,busy:false,mode:'edit',lot:null,editor:null,operationId:null,error:'',operations:[],operationScope:null,listing:false,reloadOperations:false,uncertain:false};
const lotEditTextKeys={title:'Название',description:'Описание',instructions:'Сообщение после оплаты',titleEn:'Название на английском',descriptionEn:'Описание на английском',instructionsEn:'Сообщение после оплаты на английском'};
function lotManagementScope(){return authState.user&&selectedStore()?.status==='connected_read_only'?`${authState.token}:${sessionGeneration}:${selectedStore().id}`:null;}
function resetLotManagement(){lotManagementUi.sequence++;Object.assign(lotManagementUi,{busy:false,lot:null,editor:null,operationId:null,error:'',operations:[],operationScope:null,listing:false,reloadOperations:false,uncertain:false});const dialog=document.querySelector('[data-lot-editor]');if(dialog?.open)dialog.close();if(dialog)dialog.remove();}
function closeLotEditor(){lotManagementUi.sequence++;lotManagementUi.lot=null;lotManagementUi.editor=null;lotManagementUi.operationId=null;lotManagementUi.busy=false;const dialog=document.querySelector('[data-lot-editor]');if(dialog?.open)dialog.close();dialog?.remove();}
function lotEditorFields(values,locale){return Object.entries(lotEditTextKeys).filter(([key])=>key.endsWith('En')===(locale==='en')&&Object.hasOwn(values,key)).map(([key,label])=>`<label class="lot-editor-field"><span>${label}</span>${key.startsWith('title')?`<input name="${key}" value="${lotEscape(values[key])}" maxlength="200">`:`<textarea name="${key}" rows="${key.startsWith('description')?4:3}" maxlength="10000">${lotEscape(values[key])}</textarea>`}</label>`).join('');}
function renderLotEditor(){
 const dialog=document.querySelector('[data-lot-editor]');if(!dialog||!lotManagementUi.lot)return;
 const ui=lotManagementUi,lot=ui.lot,editor=ui.editor,values=editor?.values;
 dialog.innerHTML=`<header class="lot-editor-heading"><div><span>Лот #${lotEscape(lot.id)}</span><h2 id="lot-editor-title">${ui.mode==='delete'?'Удалить лот':'Редактирование лота'}</h2></div><button type="button" class="icon-button" data-lot-editor-close aria-label="Закрыть редактор">${icon('close')}</button></header>${ui.error?`<p class="lot-editor-error" role="alert">${lotEscape(ui.error)}</p>`:''}${!editor?`<div class="lot-editor-loading" role="status"><strong>${ui.busy?'Загружаем актуальный редактор…':'Редактор не загружен'}</strong><p>Проверяем товар в подключённом магазине FunPay.</p>${!ui.busy?(ui.uncertain&&ui.operationId?`<button class="button button--primary" type="button" data-lot-operation-check="${lotEscape(ui.operationId)}">Проверить результат</button>`:'<button class="button button--ghost" type="button" data-lot-editor-reload>Обновить редактор</button>'):''}</div>`:ui.mode==='delete'?`<form data-lot-delete-form><div class="lot-delete-product"><span>${icon('box')}</span><div><strong>${lotEscape(values.title||values.titleEn||lot.title)}</strong><small>Лот #${lotEscape(lot.id)} · ${lotEscape(values.price)} ${lotEscape(editor.currency)}</small></div></div><p class="lot-editor-copy">Лот будет удалён из магазина FunPay. Вернуть его через ZetSlay нельзя. Заказы и история продаж сохранятся.</p><label class="lot-editor-confirm"><input name="confirmed" type="checkbox" required><span>Подтверждаю удаление этого лота</span></label><footer class="lot-editor-footer"><button type="button" class="button button--ghost" data-lot-editor-close>Отмена</button><button type="submit" class="button lot-editor-danger" ${ui.busy?'disabled':''}>${ui.busy?'Удаляем…':'Удалить лот'}</button></footer></form>`:`<form data-lot-editor-form><div class="lot-editor-meta"><span>FunPay · #${lotEscape(lot.id)}</span><span>${lotEscape(editor.currency)}</span></div><fieldset class="lot-editor-language"><legend>Русская версия</legend>${lotEditorFields(values,'ru')}</fieldset>${Object.keys(values).some(k=>k.endsWith('En'))?`<details class="lot-editor-english"><summary>Английская версия</summary><fieldset class="lot-editor-language"><legend class="sr-only">Английская версия</legend>${lotEditorFields(values,'en')}</fieldset></details>`:''}<div class="lot-editor-numbers"><label class="lot-editor-field"><span>Цена, ${lotEscape(editor.currency)}</span><input name="price" inputmode="decimal" required pattern="[0-9]{1,10}([.,][0-9]{1,2})?" value="${lotEscape(values.price)}"></label>${editor.stockEditable?`<label class="lot-editor-field"><span>Остаток</span><input name="stock" type="number" min="0" max="999999999" step="1" value="${values.stock}" required></label>`:`<p class="lot-editor-copy">${editor.autoDelivery?'Автовыдача: остаток определяется товаром на FunPay.':'Для этой формы остаток меняется на FunPay.'}</p>`}</div><label class="lot-editor-confirm"><input name="active" type="checkbox" ${values.active?'checked':''}><span>Лот активен</span></label><p class="lot-editor-note">Изображения, параметры категории и товар для автовыдачи сохраняются. Доступность лота в каталоге зависит от FunPay.</p><footer class="lot-editor-footer"><button type="button" class="button button--ghost" data-lot-editor-close>Отмена</button><button type="submit" class="button button--primary" ${ui.busy?'disabled':''}>${ui.busy?'Сохраняем…':'Сохранить изменения'}</button></footer></form>`}`;
 if(ui.busy)dialog.querySelectorAll('input,textarea,button[type="submit"]').forEach(node=>node.disabled=true);
}
async function openLotEditor(id,mode='edit'){
 if(!lotManagementScope()||!['edit','delete'].includes(mode))return;
 const lot=currentLotsModel().lots.find(row=>row.id===id);if(!lot?.nodeId||!/^[1-9][0-9]{0,19}$/.test(lot.id)){showToast('Обновите список лотов, чтобы получить категорию товара.','error');return;}
 closeLotDetail();closeLotEditor();
 Object.assign(lotManagementUi,{lot,mode,busy:true,error:'',editor:null,uncertain:false});
 const scope=lotManagementScope(),sequence=++lotManagementUi.sequence,storeId=String(selectedStore().id);
 const current=()=>scope===lotManagementScope()&&sequence===lotManagementUi.sequence;
 let dialog=document.querySelector('[data-lot-editor]');if(!dialog){dialog=document.createElement('dialog');dialog.className='lot-editor';dialog.dataset.lotEditor='';dialog.setAttribute('aria-labelledby','lot-editor-title');dialog.addEventListener('cancel',()=>closeLotEditor());document.body.append(dialog);}
 renderLotEditor();if(!dialog.open)dialog.showModal();
 try{
  const result=await apiRequest(`/api/v1/funpay/lots/${encodeURIComponent(id)}?storeId=${encodeURIComponent(storeId)}&nodeId=${encodeURIComponent(lot.nodeId)}`,{authenticated:true,signal:AbortSignal.timeout(95000)});
  if(!current())return;
  if(result.storeId!==storeId||result.editor?.lotId!==id||result.editor.nodeId!==lot.nodeId||!/^lop_[a-f0-9-]{36}$/.test(result.operationId)||!result.editor.values||!['RUB','USD','EUR'].includes(result.editor.currency))throw Error('Редактор вернул данные другого лота.');
  lotManagementUi.editor=result.editor;lotManagementUi.operationId=result.operationId;
 }catch(error){if(current())lotManagementUi.error=lotManagementError(error);}
 finally{if(current()){lotManagementUi.busy=false;renderLotEditor();}}
}
function lotManagementError(error){
 const messages={NOT_FOUND:'Обновите API сервиса: управление лотами ещё не установлено.',LOT_STALE:'Лот изменился. Откройте его заново, чтобы сохранить актуальные данные.',LOT_RESULT_UNKNOWN:'Результат ещё не подтверждён. Проверьте операцию в списке ниже.',MFA_STEP_UP:'Подтвердите изменения в «Профиль → Защита аккаунта», затем откройте лот заново.',LOT_REJECTED:'FunPay отклонил изменение. Проверьте поля и откройте лот заново.'};
 return messages[error?.code]||(error?.name==='TimeoutError'?'Не получен ответ. Проверьте результат операции ниже перед повторным изменением.':humanError(error));
}
function applyLotOperationResult(data){
 const op=data.operation;
 if(!op||op.storeId!==String(selectedStore()?.id)||op.status!=='done')return;
 const modify=content=>{
  if(!content||content.storeId!==op.storeId||!Array.isArray(content.lots))return;
  if(op.action==='delete')content.lots=content.lots.filter(lot=>String(lot.id)!==op.lotId);
  else if(data.lot?.id===op.lotId&&data.lot.nodeId===op.nodeId){const i=content.lots.findIndex(lot=>String(lot.id)===op.lotId);if(i>=0)content.lots[i]=data.lot;}
  content.observedAt=op.updatedAt;
 };
 modify(lotsPageState.inventory);modify(state.storeContent);renderLotWorkspace();
}
async function submitLotEditor(form,action){
 const ui=lotManagementUi;if(ui.busy||!ui.editor||!ui.lot||!lotManagementScope()||!form.reportValidity())return;
 const values=new FormData(form),changes={},original=ui.editor.values;
 if(action==='delete'&&values.get('confirmed')!=='on')return;
 if(action==='edit'){
  for(const key of Object.keys(lotEditTextKeys))if(Object.hasOwn(original,key)&&values.has(key)&&values.get(key)!==original[key])changes[key]=values.get(key);
  if(values.has('price')&&values.get('price')!==original.price)changes.price=values.get('price');
  if(ui.editor.stockEditable&&values.has('stock')&&Number(values.get('stock'))!==original.stock)changes.stock=Number(values.get('stock'));
  if(values.has('active')!==original.active)changes.active=values.has('active');
  if(!Object.keys(changes).length){showToast('Изменений нет.');return;}
  if(Object.hasOwn(changes,'price')&&Number(String(changes.price).replace(',','.'))<=0){showToast('Цена должна быть больше нуля.','error');return;}
  const proposed={...original,...changes};if(!String(proposed.title||proposed.titleEn||'').trim()){showToast('Укажите название хотя бы на одном языке.','error');return;}
 }
 const scope=lotManagementScope(),sequence=++ui.sequence,storeId=String(selectedStore().id),lot=ui.lot,id=ui.operationId;
 const current=()=>scope===lotManagementScope()&&sequence===ui.sequence;
 ui.busy=true;ui.error='';form.querySelectorAll('input,textarea,button[type="submit"]').forEach(node=>node.disabled=true);
 const submit=form.querySelector('[type="submit"]');if(submit)submit.textContent=action==='delete'?'Удаляем…':'Сохраняем…';
 try{
  const data=await apiRequest(`/api/v1/funpay/lots/${encodeURIComponent(lot.id)}/${action}`,{method:'POST',authenticated:true,signal:AbortSignal.timeout(95000),body:{operationId:id,storeId,nodeId:lot.nodeId,...(action==='delete'?{confirmed:true}:{changes})}});
  if(scope!==lotManagementScope())return;
  if(data.operation?.id!==id||data.operation.lotId!==lot.id||data.operation.storeId!==storeId)throw Error('Результат операции не подтверждён.');
  applyLotOperationResult(data);
  if(!current())return;
  if(data.operation.status==='done'){showToast(action==='delete'?'Лот удалён с FunPay.':'Изменения сохранены на FunPay.','success');closeLotEditor();}
  else{ui.uncertain=true;ui.error='Результат пока не подтверждён. Нажмите «Проверить результат» в списке операций.';ui.editor=null;}
 }catch(error){if(current()){ui.error=lotManagementError(error);ui.editor=null;}}
 finally{if(current()){ui.busy=false;renderLotEditor();}if(scope===lotManagementScope())await loadLotOperations(true);}
}
function renderLotOperations(){
 const host=document.querySelector('[data-lot-operations]');if(!host)return;
 const rows=lotManagementUi.operations;host.hidden=!rows.length;
 const labels={running:'Подготавливается',sending:'Проверяется',unknown:'Нужна проверка',done:'Подтверждено',failed:'Не выполнено'};
 host.innerHTML=`<header><h3>Последние изменения</h3><button type="button" class="text-action" data-lot-operations-refresh>Обновить</button></header><div class="lot-operation-list">${rows.map(row=>`<article><div><strong>${row.action==='delete'?'Удаление':'Редактирование'} · #${lotEscape(row.lotId)}</strong><span class="lot-operation-status is-${lotEscape(row.status)}">${labels[row.status]||'Проверяется'}</span></div>${['unknown','sending','running'].includes(row.status)?`<button class="button button--ghost" type="button" data-lot-operation-check="${lotEscape(row.id)}">Проверить результат</button>`:''}</article>`).join('')}</div>`;
}
async function loadLotOperations(force=false){
 const scope=lotManagementScope();if(!scope)return;if(lotManagementUi.listing){if(force)lotManagementUi.reloadOperations=true;return;}if(!force&&lotManagementUi.operationScope===scope)return;
 lotManagementUi.listing=true;const storeId=String(selectedStore().id);lotManagementUi.operationScope=scope;
 try{const data=await apiRequest('/api/v1/funpay/lot-operations?storeId='+encodeURIComponent(storeId),{authenticated:true,signal:AbortSignal.timeout(12000)});if(scope!==lotManagementScope())return;if(data.storeId!==storeId||!Array.isArray(data.operations)||data.operations.length>20)throw Error('Операции не подтверждены');lotManagementUi.operations=data.operations.filter(row=>row.storeId===storeId&&/^lop_[a-f0-9-]{36}$/.test(row.id)&&/^[1-9][0-9]{0,19}$/.test(row.lotId));renderLotOperations();}
 catch{if(scope===lotManagementScope())lotManagementUi.operationScope=null;}
 finally{if(scope===lotManagementScope()){lotManagementUi.listing=false;if(lotManagementUi.reloadOperations){lotManagementUi.reloadOperations=false;loadLotOperations(true);}}}
}
async function checkLotOperation(id,button){
 if(!lotManagementScope()||button?.disabled)return;const scope=lotManagementScope();if(button)button.disabled=true;
 try{const data=await apiRequest(`/api/v1/funpay/lot-operations/${encodeURIComponent(id)}/check`,{method:'POST',authenticated:true,body:{},signal:AbortSignal.timeout(95000)});if(scope!==lotManagementScope())return;if(data.operation?.id!==id||data.operation.storeId!==String(selectedStore().id))throw Error('Операция не подтверждена');applyLotOperationResult(data);if(data.operation.status==='done'&&lotManagementUi.operationId===id)closeLotEditor();showToast(data.operation.status==='done'?'Результат подтверждён на FunPay.':data.operation.status==='failed'?'Изменение не было отправлено. Можно открыть редактор заново.':'Результат ещё не подтверждён. Проверьте состояние лота на FunPay.',data.operation.status==='done'?'success':'error');}
 catch(error){if(scope===lotManagementScope())showToast(lotManagementError(error),'error');}
 finally{if(button)button.disabled=false;if(scope===lotManagementScope())loadLotOperations(true);}
}
(function installLotManagement(){
 const originalReset=resetLotsWorkspace;resetLotsWorkspace=function(...args){resetLotManagement();return originalReset.apply(this,args);};
 const originalRender=renderLotWorkspace;renderLotWorkspace=function(...args){const result=originalRender.apply(this,args);if(document.querySelector('[data-lots-workspace]')?.hidden===false)loadLotOperations();renderLotOperations();return result;};
 document.addEventListener('click',event=>{
  if(event.target.closest?.('[data-lot-editor-close]')){closeLotEditor();return;}
  if(event.target.closest?.('[data-lot-editor-reload]')){const lot=lotManagementUi.lot;if(lot)openLotEditor(lot.id,lotManagementUi.mode);return;}
  const edit=event.target.closest?.('[data-lot-edit]');if(edit){openLotEditor(edit.dataset.lotEdit);return;}
  const remove=event.target.closest?.('[data-lot-delete]');if(remove){openLotEditor(remove.dataset.lotDelete,'delete');return;}
  const check=event.target.closest?.('[data-lot-operation-check]');if(check){checkLotOperation(check.dataset.lotOperationCheck,check);return;}
  if(event.target.closest?.('[data-lot-operations-refresh]'))loadLotOperations(true);
 });
 document.addEventListener('submit',event=>{if(event.target.matches?.('[data-lot-editor-form],[data-lot-delete-form]')){event.preventDefault();submitLotEditor(event.target,event.target.matches('[data-lot-delete-form]')?'delete':'edit');}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadLotOperations(true);});
})();
