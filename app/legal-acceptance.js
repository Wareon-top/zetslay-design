/* Contract acceptance is separate from privacy consents and plugin operations. */
const legalAcceptanceUi={token:null,sequence:0,loading:false,busy:false,data:null,error:''};
function resetLegalAcceptance(){Object.assign(legalAcceptanceUi,{token:authState.token,sequence:legalAcceptanceUi.sequence+1,loading:false,busy:false,data:null,error:''});}
function renderLegalAcceptance(){
  const node=document.querySelector('[data-legal-acceptance]');if(!node||!authState.token)return;
  if(legalAcceptanceUi.token!==authState.token)resetLegalAcceptance();
  const s=legalAcceptanceUi.data;
  if(!s){node.innerHTML=`<p role="status">${escapeHtml(legalAcceptanceUi.error||'Проверяем редакцию документов…')}</p>${legalAcceptanceUi.error?'<button type="button" class="button button--ghost" data-legal-acceptance-refresh>Повторить проверку</button>':''}`;if(!legalAcceptanceUi.loading&&!legalAcceptanceUi.error)queueMicrotask(()=>loadLegalAcceptance());return;}
  const p=s.publication,a=s.acceptance;
  if(a){node.innerHTML=`<div class="legal-request"><strong>Оферта принята</strong><p>Редакция ${escapeHtml(a.version)} · ${escapeHtml(legalDate(a.acceptedAt))}</p><small>Это подтверждение договора. Согласия на необязательные функции и разрешения операций оформляются отдельно.</small></div>`;return;}
  node.innerHTML=`<form data-legal-acceptance-form><h3>Принятие условий ZetSlay</h3><p>${escapeHtml(p.effectiveRule)} · редакция ${escapeHtml(p.version)}.</p><nav class="legal-links"><a href="/legal/offer.html" target="_blank" rel="noopener">Оферта и пользовательское соглашение</a><a href="/legal/acceptable-use.html" target="_blank" rel="noopener">Правила использования</a><a href="/legal/automation-rules.html" target="_blank" rel="noopener">Автоматизация</a><a href="/legal/refunds.html" target="_blank" rel="noopener">Оплата и возвраты</a><a href="/legal/data-processing.html" target="_blank" rel="noopener">Условия обработки магазина</a></nav><label style="display:flex;align-items:flex-start;gap:10px"><input type="checkbox" name="confirmed" required>Прочитал и принимаю оферту и её договорные приложения.</label><p>Подтверждение не оплачивает тариф, не включает плагины и не является общим согласием на обработку или публикацию персональных данных.</p><button type="submit" class="button button--primary" ${legalAcceptanceUi.busy?'disabled':''}>${legalAcceptanceUi.busy?'Сохраняем…':'Принять условия'}</button><p role="status">${escapeHtml(legalAcceptanceUi.error)}</p></form><button type="button" class="button button--ghost" data-legal-acceptance-refresh>Обновить редакцию</button>`;
}
async function loadLegalAcceptance(){
  if(!authState.token)return;if(legalAcceptanceUi.token!==authState.token)resetLegalAcceptance();if(legalAcceptanceUi.loading||legalAcceptanceUi.busy)return;
  const token=authState.token,sequence=legalAcceptanceUi.sequence;legalAcceptanceUi.loading=true;
  try{const s=await apiRequest('/api/v1/legal/acceptance',{authenticated:true});if(token!==authState.token||sequence!==legalAcceptanceUi.sequence)return;
    const response=await fetch('/legal/publication.json',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Не удалось загрузить опубликованные документы');const shown=await response.json();
    if(token!==authState.token||sequence!==legalAcceptanceUi.sequence)return;
    if(shown.hash!==s.publication?.hash||shown.version!==s.publication?.version||shown.status!=='active')throw Error('Сайт и API показывают разные редакции. Дождитесь завершения обновления.');
    if(s.publication?.status!=='active'||!/^\d{4}-\d{2}-\d{2}-v\d+$/.test(s.publication.version)||!/^[a-f0-9]{64}$/.test(s.publication.hash))throw Error('Не удалось подтвердить действующую редакцию');
    if(s.acceptance&&(s.acceptance.version!==s.publication.version||s.acceptance.publicationHash!==s.publication.hash))throw Error('Подтверждение относится к другой редакции');
    legalAcceptanceUi.data=s;legalAcceptanceUi.error='';
  }catch(e){if(token===authState.token&&sequence===legalAcceptanceUi.sequence)legalAcceptanceUi.error=humanError(e);}
  finally{if(token===authState.token&&sequence===legalAcceptanceUi.sequence){legalAcceptanceUi.loading=false;renderLegalAcceptance();}}
}
async function submitLegalAcceptance(form){
  if(legalAcceptanceUi.busy||!legalAcceptanceUi.data||!form.reportValidity())return;
  const confirmed=form.querySelector('[name="confirmed"]');if(!confirmed?.checked)return;
  const token=authState.token,sequence=legalAcceptanceUi.sequence,p=legalAcceptanceUi.data.publication;legalAcceptanceUi.busy=true;
  form.querySelector('button[type="submit"]').disabled=true;
  try{const r=await apiRequest('/api/v1/legal/acceptance',{method:'POST',authenticated:true,body:{version:p.version,publicationHash:p.hash,confirmed:true}});if(token!==authState.token||sequence!==legalAcceptanceUi.sequence)return;
    if(r.acceptance?.version!==p.version||r.acceptance?.publicationHash!==p.hash)throw Error('Сервер не подтвердил принятие этой редакции');
    legalAcceptanceUi.data.acceptance=r.acceptance;legalAcceptanceUi.error='';
  }catch(e){if(token===authState.token&&sequence===legalAcceptanceUi.sequence)legalAcceptanceUi.error=humanError(e);}
  finally{if(token===authState.token&&sequence===legalAcceptanceUi.sequence){legalAcceptanceUi.busy=false;renderLegalAcceptance();}}
}
document.addEventListener('submit',event=>{if(event.target.matches?.('[data-legal-acceptance-form]')){event.preventDefault();void submitLegalAcceptance(event.target);}});
document.addEventListener('click',event=>{if(event.target.closest?.('[data-legal-acceptance-refresh]'))void loadLegalAcceptance();});
const legalAcceptancePreviousMount=mountLegalCabinet;
mountLegalCabinet=function(){const r=legalAcceptancePreviousMount.apply(this,arguments);renderLegalAcceptance();return r;};
const legalAcceptancePreviousReset=resetLegalUi;
resetLegalUi=function(){resetLegalAcceptance();return legalAcceptancePreviousReset.apply(this,arguments);};
queueMicrotask(()=>renderLegalAcceptance());
