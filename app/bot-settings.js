/* Existing working-bot settings. Password values stay in the form, never in UI state. */
const botSettingsUi={scope:'',epoch:0,node:null,opener:null,data:null,loading:false,busy:false,error:'',saved:false};
const botSettingsScope=()=>authState.user?.id&&authState.token?`${authState.user.id}:${authState.token}:${sessionGeneration}`:'';
const botSettingsSafe=value=>escapeHtml(String(value??''));
function botSettingsPasswordError(password,confirmPassword){
 if(password.length<12||password.length>256)return 'Используйте от 12 до 256 символов.';
 if(!/[a-zа-я]/i.test(password)||!/[0-9]/.test(password))return 'Добавьте буквы и цифры.';
 if(password!==confirmPassword)return 'Пароли не совпадают.';
 return '';
}
function botSettingsValidData(data){return data&&typeof data.configured==='boolean'&&typeof data.botConfigured==='boolean';}
function botSettingsCurrent(scope,epoch){return scope===botSettingsScope()&&epoch===botSettingsUi.epoch;}
function botSettingsClose(restore=true){
 const ui=botSettingsUi,node=ui.node,opener=ui.opener;ui.epoch++;ui.node=null;ui.opener=null;ui.data=null;ui.scope='';ui.loading=false;ui.busy=false;ui.error='';ui.saved=false;
 if(node){for(const input of node.querySelectorAll('input'))input.value='';if(node.open)node.close();node.remove();}
 if(restore&&botSettingsScope()&&opener?.isConnected)opener.focus({preventScroll:true});
}
function botSettingsBody(data){
 const ui=botSettingsUi,tg=state.onboarding?.telegram,username=/^[A-Za-z0-9_]{5,32}$/.test(tg?.bot?.username||'')?tg.bot.username:'';
 const active=data?.authenticatedUntil&&Date.parse(data.authenticatedUntil)>Date.now();
 const until=active?new Date(data.authenticatedUntil).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
 return `<div class="bs-bot-card"><span class="bs-telegram" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m21.7 4.3-3.3 15.4c-.2 1.1-.9 1.4-1.9.9l-5-3.7-2.4 2.3c-.3.3-.5.5-.9.5l.4-5.1L18 6.1c.4-.4-.1-.6-.6-.3L6 13l-4.9-1.5c-1.1-.3-1.1-1.1.2-1.6l19-7.3c.9-.3 1.7.2 1.4 1.7Z"/></svg></span><div><span>ВАШ РАБОЧИЙ БОТ</span><strong>${username?'@'+botSettingsSafe(username):data?.botConfigured?'Telegram-бот':'Бот не подключён'}</strong></div><span class="bs-chip">${tg?.linked?'Привязан':data?.botConfigured?'Настроен':'Нет подключения'}</span></div>
 ${ui.loading?'<div class="bs-loading" role="status"><i aria-hidden="true"></i> Проверяем настройки доступа…</div>':!data?'<p class="bs-copy">Не удалось загрузить настройки рабочего бота.</p><button type="button" class="button button--ghost" data-bot-settings-retry>Повторить</button>':!data.botConfigured?'<div class="bs-empty"><h3>Сначала подключите рабочего бота</h3><p>Пароль можно задать после сохранения Bot Token. Подключение откроется только по кнопке ниже.</p><button type="button" class="button button--primary" data-bot-settings-connect>Подключить бота</button></div>':`<div class="bs-access"><div><span>Пароль доступа</span><strong>${data.configured?'Установлен':'Ещё не установлен'}</strong></div><div><span>Вход в Telegram</span><strong>${active?'Действует до '+botSettingsSafe(until):'Потребуется /login'}</strong></div></div><div class="bs-section-heading"><h3>${data.configured?'Сменить пароль':'Установить пароль'}</h3><p>Отдельный пароль для управления ботом. Повторно вводить Bot Token не нужно.</p></div><form data-bot-settings-form><label for="bs-password">${data.configured?'Новый пароль':'Пароль'}<span class="bs-input"><input id="bs-password" type="password" name="password" minlength="12" maxlength="256" autocomplete="new-password" spellcheck="false" aria-describedby="bs-password-rules" required><button type="button" data-bot-settings-reveal aria-label="Показать пароль" aria-pressed="false">Показать</button></span></label><div class="bs-rules" id="bs-password-rules"><span data-bs-rule="length">От 12 символов</span><span data-bs-rule="letters">Буквы</span><span data-bs-rule="digits">Цифры</span></div><label for="bs-confirm-password">Повторите пароль<input id="bs-confirm-password" type="password" name="confirmPassword" minlength="12" maxlength="256" autocomplete="new-password" spellcheck="false" required></label><p class="bs-match" data-bs-match role="status" aria-live="polite"></p><p class="bs-rotation-note">Смена пароля завершает текущий вход в бота. Привязка и настройки магазина сохраняются.</p><button class="button button--primary" type="submit">${data.configured?'Сохранить новый пароль':'Установить пароль'}</button></form>`}
 <p class="bs-error" data-bs-error role="alert" ${ui.error?'':'hidden'}>${botSettingsSafe(ui.error)}</p><section class="bs-saved" data-bs-saved role="status" aria-live="polite" hidden><span aria-hidden="true">✓</span><h3>Пароль сохранён</h3><p>Откройте своего бота, отправьте <code>/login</code>, затем введите заданный пароль. После входа используйте <code>/menu</code>.</p>${username?`<a class="button button--primary" href="https://t.me/${username}" target="_blank" rel="noopener noreferrer">Открыть @${username} ↗</a>`:''}<button type="button" class="button button--ghost" data-bot-settings-close>Готово</button></section><footer class="bs-footer">Пароль рабочего бота и пароль аккаунта ZetSlay — отдельные настройки.</footer>`;
}
function botSettingsError(message){const ui=botSettingsUi;ui.error=message;const node=ui.node?.querySelector('[data-bs-error]');if(node){node.textContent=message;node.hidden=!message;}}
async function botSettingsLoad(){
 const ui=botSettingsUi,scope=botSettingsScope(),epoch=ui.epoch;if(!scope||!ui.node?.open||ui.busy)return;ui.loading=true;ui.data=null;ui.error='';ui.node.querySelector('[data-bs-body]').innerHTML=botSettingsBody(null);
 try{const data=await apiRequest('/api/v1/bot-access',{authenticated:true,signal:AbortSignal.timeout(15000)});if(!botSettingsCurrent(scope,epoch))return;if(!botSettingsValidData(data))throw Error('INVALID_BOT_STATE');ui.data=data;}
 catch(error){if(botSettingsCurrent(scope,epoch))ui.error=['HTTP_404','NOT_FOUND'].includes(error.code)?'Модуль настроек бота недоступен на сервере. Обновите API.':'Не удалось загрузить настройки. Повторите проверку.';}
 finally{if(botSettingsCurrent(scope,epoch)&&ui.node?.open){ui.loading=false;ui.node.querySelector('[data-bs-body]').innerHTML=botSettingsBody(ui.data);}}
}
async function botSettingsSave(form){
 const ui=botSettingsUi,scope=botSettingsScope(),epoch=ui.epoch;if(!scope||ui.scope!==scope||ui.busy||!ui.data?.botConfigured||!ui.node?.contains(form))return;
 const password=form.elements.password.value,confirmPassword=form.elements.confirmPassword.value,error=botSettingsPasswordError(password,confirmPassword);if(error){botSettingsError(error);return;}
 ui.busy=true;botSettingsError('');for(const node of form.querySelectorAll('input,button'))node.disabled=true;const submit=form.querySelector('[type=submit]'),label=submit.textContent;submit.textContent='Сохраняем пароль…';form.setAttribute('aria-busy','true');
 try{
  const result=await apiRequest('/api/v1/bot-access/password',{method:'POST',authenticated:true,body:{password,confirmPassword},signal:AbortSignal.timeout(20000)});
  if(!botSettingsCurrent(scope,epoch))return;if(!botSettingsValidData(result)||!result.configured)throw Error('INVALID_BOT_STATE');
  ui.data=result;ui.saved=true;for(const input of form.querySelectorAll('input'))input.value='';form.hidden=true;ui.node.querySelector('.bs-section-heading').hidden=true;ui.node.querySelector('.bs-access').hidden=true;ui.node.querySelector('[data-bs-saved]').hidden=false;
  ui.node.querySelector('[data-bot-settings-close]')?.focus({preventScroll:true});
 }catch(error){if(botSettingsCurrent(scope,epoch)){botSettingsError(error.code==='BOT_CHANGED'?'Рабочий бот изменился. Закройте окно и откройте настройки заново.':error.code==='BOT_BUSY'?'Предыдущая операция ещё выполняется. Повторите через несколько секунд.':'Сохранение не подтверждено. Повторите попытку или откройте настройки заново, чтобы проверить состояние.');}}
 finally{if(botSettingsCurrent(scope,epoch)){ui.busy=false;form.setAttribute('aria-busy','false');for(const node of form.querySelectorAll('input,button'))node.disabled=false;submit.textContent=label;}}
}
async function botSettingsOpen(opener){
 if(!botSettingsScope()){if(typeof setAuthModal==='function')setAuthModal(true);return;}if(botSettingsUi.node?.open)return;
 const ui=botSettingsUi;ui.epoch++;ui.scope=botSettingsScope();ui.opener=opener||document.activeElement;ui.data=null;ui.saved=false;ui.error='';ui.loading=true;
 const node=document.createElement('dialog');node.className='bot-settings-dialog';node.setAttribute('aria-labelledby','bs-title');node.innerHTML='<div class="bs-shell"><header class="bs-heading"><div><span>ПРОФИЛЬ / TELEGRAM</span><h2 id="bs-title">Настройки рабочего бота</h2><p>Доступ к вашему Telegram-боту</p></div><button type="button" class="bs-close" data-bot-settings-close aria-label="Закрыть настройки бота">×</button></header><div class="bs-body" data-bs-body></div></div>';
 ui.node=node;document.body.append(node);node.addEventListener('close',()=>{if(ui.node===node)botSettingsClose();});node.addEventListener('click',event=>{if(event.target===node)botSettingsClose();});node.showModal();await botSettingsLoad();
}
(function installBotSettings(){
 if(typeof document==='undefined')return;
 let requested=new URLSearchParams(location.search).get('settings')==='bot';
 const resume=()=>{if(requested&&botSettingsScope()){requested=false;setView('profile');void botSettingsOpen();}};
 if(typeof renderAuthState==='function'){const render=renderAuthState;renderAuthState=function(...args){if(botSettingsUi.node&&botSettingsUi.scope!==botSettingsScope())botSettingsClose(false);const result=render.apply(this,args);resume();return result;};}
 const reset=resetAccountData;resetAccountData=function(...args){botSettingsClose(false);return reset.apply(this,args);};
 document.addEventListener('click',event=>{
  const open=event.target.closest?.('[data-bot-settings-open]');if(open){event.preventDefault();void botSettingsOpen(open);return;}
  if(event.target.closest?.('[data-bot-settings-close]')){botSettingsClose();return;}
  if(event.target.closest?.('[data-bot-settings-retry]')){void botSettingsLoad();return;}
  if(event.target.closest?.('[data-bot-settings-connect]')){botSettingsClose(false);setModal(true);return;}
  const reveal=event.target.closest?.('[data-bot-settings-reveal]');if(reveal){const input=botSettingsUi.node?.querySelector('[name=password]');if(!input)return;const visible=input.type==='password';input.type=visible?'text':'password';reveal.textContent=visible?'Скрыть':'Показать';reveal.setAttribute('aria-pressed',String(visible));reveal.setAttribute('aria-label',visible?'Скрыть пароль':'Показать пароль');}
 });
 document.addEventListener('submit',event=>{if(event.target.matches?.('[data-bot-settings-form]')){event.preventDefault();void botSettingsSave(event.target);}});
 resume();
 document.addEventListener('input',event=>{const form=event.target.closest?.('[data-bot-settings-form]');if(!form)return;botSettingsError('');const password=form.elements.password.value,confirm=form.elements.confirmPassword.value;for(const [key,passed]of [['length',password.length>=12&&password.length<=256],['letters',/[a-zа-я]/i.test(password)],['digits',/[0-9]/.test(password)]])form.querySelector(`[data-bs-rule="${key}"]`).classList.toggle('is-valid',passed);const match=form.querySelector('[data-bs-match]');match.textContent=confirm?(password===confirm?'Пароли совпадают':'Пароли не совпадают'):'';match.classList.toggle('is-valid',!!confirm&&password===confirm);});
})();
