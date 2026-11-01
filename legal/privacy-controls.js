/* No analytics/ad scripts. This manager never treats browsing as agreement. */
(()=>{
  'use strict';
  const key='zetslay_privacy_preferences',version='2026-10-07-1',ttl=180*86400000;
  const read=()=>{try{const p=JSON.parse(localStorage.getItem(key)||'null');return p?.version===version&&p.necessary===true&&p.optional===false&&Number.isFinite(p.at)&&Date.now()-p.at>=0&&Date.now()-p.at<ttl?p:null;}catch{return null;}};
  const save=()=>{const p={version,necessary:true,optional:false,at:Date.now()};try{localStorage.setItem(key,JSON.stringify(p));return true;}catch{return false;}};
  const reset=()=>{try{localStorage.removeItem(key);return true;}catch{return false;}};
  function open(trigger){
    document.querySelector('[data-privacy-dialog]')?.remove();
    const dialog=document.createElement('dialog');dialog.className='privacy-dialog';dialog.dataset.privacyDialog='';dialog.setAttribute('aria-labelledby','privacy-title');
    dialog.innerHTML=`<header><h2 id="privacy-title">Настройки cookies</h2><button type="button" data-privacy-close aria-label="Закрыть">×</button></header><p>Рабочая сессия и настройки помогают пользоваться кабинетом. Аналитические и рекламные счётчики не подключены.</p><label><input type="checkbox" checked disabled><span><strong>Необходимые ресурсы</strong><small>Вход, защита доступа и работа запрошенных функций.</small></span></label><label><input type="checkbox" disabled><span><strong>Дополнительные ресурсы</strong><small>Не подключены. Ничего не включается автоматически.</small></span></label><p><a href="/legal/cookies.html">Cookies и локальное хранилище</a> · <a href="/legal/privacy.html">Конфиденциальность</a></p><div role="status"></div><footer><button type="button" data-privacy-save>Только необходимые</button><button type="button" data-privacy-reset>Сбросить выбор</button></footer>`;
    document.body.append(dialog);
    dialog.addEventListener('click',e=>{if(e.target.closest('[data-privacy-close]'))dialog.close();if(e.target.closest('[data-privacy-save]')){const ok=save();dialog.querySelector('[role=status]').textContent=ok?'Сохранено: дополнительные ресурсы выключены.':'Браузер запретил хранилище. Дополнительные ресурсы остаются выключены.';}if(e.target.closest('[data-privacy-reset]')){const ok=reset();dialog.querySelector('[role=status]').textContent=ok?'Выбор сброшен. Дополнительные ресурсы выключены.':'Браузер запретил изменение хранилища.';}});
    dialog.addEventListener('close',()=>{dialog.remove();if(trigger?.isConnected)trigger.focus();},{once:true});
    if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
  }
  window.ZetSlayPrivacy=Object.freeze({open,read,saveNecessary:save,reset});
  document.addEventListener('click',e=>{const trigger=e.target.closest?.('[data-privacy-settings]');if(trigger){e.preventDefault();open(trigger);}});
})();
