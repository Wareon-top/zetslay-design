/* Private account settings and an allowlisted, reusable author card. */
const profileState = {token:'',data:null,loading:false,saving:false,error:'',dirty:false,avatarDraft:null,request:0,authorRequest:0};
function resetProfileState() {
  profileState.request++;profileState.authorRequest++;
  Object.assign(profileState,{token:'',data:null,loading:false,saving:false,error:'',dirty:false,avatarDraft:null});
  const author=document.querySelector('[data-author-page]');if(author)author.innerHTML='';
}
function normalizeProfileRoute(view) {return ['telegram','security'].includes(view)?'profile':view;}
function parseAuthorRoute(view) {const m=/^authors\/(author_[a-f0-9-]{36})$/.exec(view);return m?m[1]:null;}
const profileEscape = value => escapeHtml(value ?? '');
function safeProfileAvatar(value) {return typeof value==='string' && value.length<=350000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)?value:'';}
function profilePortrait(card,large=false) {
  const name=String(card?.displayName||'Мой профиль'),avatar=safeProfileAvatar(card?.avatar);
  return `<span class="profile-portrait${large?' profile-portrait--large':''}"><span>${profileEscape(name.slice(0,2).toUpperCase())}</span>${avatar?`<img src="${profileEscape(avatar)}" alt="Аватарка ${profileEscape(name)}" data-profile-avatar-image>`:''}</span>`;
}
function profileDate(value) {const date=new Date(value);return value&&Number.isFinite(date.getTime())?date.toLocaleString('ru-RU',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Нет данных';}
function publicAuthorMarkup(card) {
  // Future plugin listings and reviews should reference authorId, never a login ID.
  return `<article class="profile-author-card">${profilePortrait(card,true)}<span class="profile-caption">Участник ZetSlay</span><h1>${profileEscape(card.displayName)}</h1><p class="profile-author-bio">${profileEscape(card.bio||'Автор пока не добавил описание.')}</p><div class="profile-author-footer"><span>В ZetSlay с ${profileEscape(profileDate(card.memberSince))}</span></div></article>`;
}
function profileField(label,value) {return `<div class="profile-fact"><dt>${label}</dt><dd>${profileEscape(value)}</dd></div>`;}
function renderProfile(force=false) {
  const root=document.querySelector('[data-profile]');if(!root)return;
  if(!authState.user){root.innerHTML='';return;}
  if(profileState.token && profileState.token!==authState.token)resetProfileState();
  if(profileState.dirty&&!force)return;
  const data=profileState.data,card=data?.profile;
  const fallbackName=authState.workspace?.name?.startsWith('@')?authState.workspace.name:authState.user.email||'Мой профиль';
  const identity=data?.identity||{email:authState.user.email,telegramUserId:authState.user.telegramUserId};
  const plan=data?.plan||authState.workspace?.plan;
  const planActive=state.onboarding?.activePlan===true||plan?.active===true;
  const model=typeof storeIdentityModel==='function'?storeIdentityModel(selectedStore(),state.storeContent,state.plugins,true):{name:selectedStore()?.displayName||'Магазин FunPay',id:selectedStore()?.id,connected:selectedStore()?.status==='connected_read_only',observedAt:null};
  const tg=state.onboarding?.telegram;
  const botName=/^[A-Za-z0-9_]{5,32}$/.test(tg?.bot?.username||'')?tg.bot.username:'';
  const avatar=card||{displayName:fallbackName};
  const role=identity.role==='admin'?'Администратор':identity.role==='user'?'Пользователь':'Загружается';
  const error=profileState.error?`<div class="profile-feedback profile-feedback--error" role="alert">${profileEscape(profileState.error)} <button type="button" data-profile-reload>Обновить данные</button></div>`:'';
  const facts=profileField('Вход',identity.email?'Почта и пароль':'Telegram')+(identity.email?profileField('Почта',identity.email):'')+(identity.telegramUserId?profileField('Telegram ID',identity.telegramUserId):'')+(identity.telegramUsername?profileField('Telegram при создании аккаунта',`@${identity.telegramUsername}`):'')+profileField('Дата регистрации',profileDate(identity.createdAt||authState.user.createdAt));
  const connected=model.connected===true;
  root.innerHTML=`<div class="profile-heading"><div><h1>Профиль</h1><p>Ваш аккаунт, подключения и публичная карточка.</p></div><button type="button" class="button button--ghost" data-profile-reload ${profileState.loading?'disabled':''}>${icon('refresh-cw')} Обновить</button></div>${error}
  <section class="profile-hero"><div class="profile-hero__identity">${profilePortrait(avatar,true)}<div><span class="profile-caption">Личный кабинет ZetSlay</span><h2>${profileEscape(card?.displayName||fallbackName)}</h2><p>${profileEscape(identity.email||'Вход через Telegram')}</p></div></div><span class="profile-role">${icon(identity.role==='admin'?'shield':'user')}${role}</span></section>
  <div class="profile-grid"><section class="profile-panel profile-account"><div class="profile-panel-heading"><span class="profile-panel-icon">${icon('user')}</span><div><h2>Данные аккаунта</h2><p>Видны только вам</p></div></div><dl class="profile-facts">${facts}</dl></section>
  <section class="profile-panel"><div class="profile-panel-heading"><span class="profile-panel-icon profile-panel-icon--green">${icon('bag')}</span><div><h2>Магазин FunPay</h2><p>Ваше подключение к площадке</p></div></div><div class="profile-store">${typeof storeIdentityAvatar==='function'?storeIdentityAvatar(model):profilePortrait({displayName:model.name})}<div><strong>${profileEscape(model.name)}</strong><span>${model.id?`ID ${profileEscape(model.id)}`:'Магазин ещё не привязан'}</span></div><span class="profile-status${connected?' is-connected':''}"><i></i>${connected?'Подключён':selectedStore()?.status==='attention'?'Требует внимания':'Не подтверждён'}</span></div><dl class="profile-facts">${profileField('Последняя синхронизация',profileDate(model.observedAt))}${profileField('Прокси',state.onboarding?.funPay?.proxyConfigured?'Сохранён':'Не настроен')}</dl><button class="button button--ghost button--wide" type="button" data-profile-connect>Управлять подключением ${icon('chevron-right')}</button></section>
  <section class="profile-panel"><div class="profile-panel-heading"><span class="profile-panel-icon profile-panel-icon--blue">${icon('send')}</span><div><h2>Рабочий Telegram-бот</h2><p>Уведомления и управление магазином</p></div></div><div class="profile-bot"><strong>${botName?`@${profileEscape(botName)}`:'Бот ещё не настроен'}</strong><span class="profile-status${tg?.linked?' is-connected':''}"><i></i>${tg?.linked?'Привязан':tg?.botConfigured?'Ждёт подтверждения':'Не подключён'}</span></div><p class="profile-panel-copy">${tg?.linked?'Привязка подтверждена. Настройки модулей доступны в вашем боте.':'Подключите бота через мастер магазина и подтвердите привязку командой /start.'}</p><div class="profile-actions">${botName?`<a class="button button--ghost" href="https://t.me/${botName}" target="_blank" rel="noopener noreferrer">${icon('send')} Открыть бота</a>`:''}<button class="button button--ghost" type="button" data-profile-connect>${icon('gear')} Настроить</button></div></section>
  <section class="profile-panel"><div class="profile-panel-heading"><span class="profile-panel-icon">${icon('lock')}</span><div><h2>Доступ и тариф</h2><p>Текущий кабинет</p></div></div><dl class="profile-facts">${profileField('Сессия','Вход выполнен')}${profileField('Тариф',planActive?(plan?.id==='pro_demo'?'Демо-тариф':plan?.id||'Активен'):'Не активен')}</dl><div class="profile-actions"><button type="button" class="button button--ghost" data-view-target="billing">${icon('card')} Финансы</button><button type="button" class="button button--ghost profile-signout" data-auth-logout>Выйти ${icon('external')}</button></div></section>
  <section class="profile-panel profile-editor"><div class="profile-panel-heading"><span class="profile-panel-icon profile-panel-icon--violet">${icon('puzzle')}</span><div><h2>Карточка автора</h2><p>Профиль для будущего маркетплейса плагинов</p></div></div><p class="profile-panel-copy">Имя, аватарка и описание — всё, что увидят другие участники. Почта, Telegram ID и данные магазина остаются в личном кабинете.</p>${card?`<form data-profile-form><div class="profile-editor-grid"><div class="profile-avatar-editor">${profilePortrait(card,true)}<label class="button button--ghost profile-upload">Выбрать фото<input type="file" accept="image/png,image/jpeg,image/webp" data-profile-avatar-file></label><button type="button" class="text-action" data-profile-avatar-remove>Убрать фото</button><small>PNG, JPEG, WebP · до 256 КБ</small></div><div class="profile-editor-fields"><label>Имя в ZetSlay<input name="displayName" type="text" minlength="2" maxlength="60" required value="${profileEscape(card.displayName)}" autocomplete="nickname"></label><label>О себе<textarea name="bio" maxlength="1000" rows="4" placeholder="Чем вы занимаетесь и какие инструменты создаёте">${profileEscape(card.bio)}</textarea></label><label class="profile-visibility"><input name="publicVisible" type="checkbox" ${card.publicVisible?'checked':''}><span><strong>Публичная карточка</strong><small>Открыть имя, аватарку и описание другим участникам</small></span></label></div></div><div class="profile-editor-footer"><span class="profile-caption">${card.publicVisible?'Карточка доступна по ссылке':'Карточка скрыта от других участников'}</span><div class="profile-actions">${card.publicVisible?`<a class="button button--ghost" href="#authors/${profileEscape(card.authorId)}" data-author-link>Посмотреть карточку</a>`:''}<button class="button button--primary" type="submit" ${profileState.saving||profileState.loading?'disabled':''}>${profileState.saving?'Сохраняем…':'Сохранить профиль'}</button></div></div><div class="profile-form-status" role="status" data-profile-form-status></div></form>`:`<div class="profile-empty">${profileState.loading?'Загружаем профиль…':'Для редактирования загрузите профиль с сервера.'}</div>`}</section></div>`;
}
async function loadProfile() {
  if(!authState.token||!authState.user||profileState.loading||profileState.saving)return;
  const token=authState.token,generation=sessionGeneration,request=++profileState.request;
  profileState.token=token;profileState.loading=true;profileState.error='';renderProfile();
  try {
    const data=await apiRequest('/api/v1/profile',{authenticated:true});
    if(token!==authState.token||generation!==sessionGeneration||request!==profileState.request)return;
    profileState.data=data;
  } catch(error) {
    if(token===authState.token&&generation===sessionGeneration&&request===profileState.request)profileState.error=error.code==='HTTP_404'?'Редактирование профиля временно недоступно. Повторите загрузку.':humanError(error);
  } finally {
    if(token===authState.token&&generation===sessionGeneration&&request===profileState.request){profileState.loading=false;renderProfile();}
  }
}
async function saveProfile(form) {
  if(profileState.saving||profileState.loading||!profileState.data||!authState.user)return;
  const token=authState.token,generation=sessionGeneration,request=++profileState.request;
  const values=new FormData(form),button=form.querySelector('[type="submit"]'),status=form.querySelector('[data-profile-form-status]');
  profileState.saving=true;form.querySelectorAll('input,textarea,button').forEach(node=>{node.disabled=true;});if(button)button.textContent='Сохраняем…';if(status)status.textContent='';
  try {
    const result=await apiRequest('/api/v1/profile',{method:'POST',authenticated:true,body:{displayName:String(values.get('displayName')||''),bio:String(values.get('bio')||''),publicVisible:values.get('publicVisible')==='on',avatar:profileState.avatarDraft??profileState.data.profile.avatar,version:profileState.data.profile.version}});
    if(token!==authState.token||generation!==sessionGeneration||request!==profileState.request)return;
    profileState.data=result;profileState.dirty=false;profileState.avatarDraft=null;profileState.error='';profileState.saving=false;renderProfile(true);showToast('Профиль сохранён','success');
  } catch(error) {
    if(token===authState.token&&generation===sessionGeneration&&request===profileState.request &&status)status.textContent=humanError(error);
  } finally {if(token===authState.token&&generation===sessionGeneration&&request===profileState.request){profileState.saving=false;form.querySelectorAll('input,textarea,button').forEach(node=>{node.disabled=false;});if(button)button.textContent='Сохранить профиль';}}
}
async function showAuthor(id) {
  const root=document.querySelector('[data-author-page]');if(!root)return;
  const request=++profileState.authorRequest,token=authState.token,generation=sessionGeneration;
  const back='<a class="text-action" href="#profile" data-view-link="profile">← В мой профиль</a>';
  if(!authState.user){root.innerHTML='';return;}
  root.innerHTML=back+'<div class="profile-empty" role="status">Загружаем карточку автора…</div>';
  try {
    const card=await apiRequest(`/api/v1/authors/${id}`);
    if(request!==profileState.authorRequest||token!==authState.token||generation!==sessionGeneration||parseAuthorRoute(location.hash.slice(1))!==id)return;
    root.innerHTML=back+publicAuthorMarkup(card);
  } catch(error) {
    if(request===profileState.authorRequest&&token===authState.token&&generation===sessionGeneration)root.innerHTML=back+`<div class="profile-empty" role="status">${profileEscape(error.code==='NOT_FOUND'?'Автор скрыл карточку или она недоступна.':humanError(error))}</div>`;
  }
}
function renderProfileRoute(view) {
  const id=parseAuthorRoute(view);
  if(id){showAuthor(id);return;}
  profileState.authorRequest++;
  if(view==='profile'){renderProfile();if(!profileState.data&&!profileState.loading)loadProfile();}
}
async function readProfileAvatar(file) {
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>256*1024)throw Error('Выберите PNG, JPEG или WebP до 256 КБ.');
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Не удалось прочитать изображение.'));reader.readAsDataURL(file);});
}
document.addEventListener('submit',event=>{if(event.target.matches?.('[data-profile-form]')){event.preventDefault();saveProfile(event.target);}});
document.addEventListener('input',event=>{if(event.target.closest?.('[data-profile-form]'))profileState.dirty=true;});
document.addEventListener('change',async event=>{
  if(!event.target.matches?.('[data-profile-avatar-file]'))return;
  const token=authState.token,generation=sessionGeneration,request=profileState.request;
  try {const value=await readProfileAvatar(event.target.files?.[0]);if(token!==authState.token||generation!==sessionGeneration||request!==profileState.request||profileState.saving)return;profileState.avatarDraft=value;profileState.dirty=true;const portrait=event.target.closest('.profile-avatar-editor')?.querySelector('.profile-portrait');if(portrait)portrait.innerHTML=`<img src="${profileEscape(value)}" alt="Предпросмотр аватарки" data-profile-avatar-image>`;}catch(error){if(token===authState.token&&generation===sessionGeneration)showToast(error.message,'error');}
});
document.addEventListener('click',event=>{
  if(event.target.closest?.('[data-profile-reload]')){if(profileState.saving)return;if(profileState.dirty&&!window.confirm('Загрузить сохранённый профиль и отменить ваши несохранённые изменения?'))return;profileState.dirty=false;profileState.avatarDraft=null;loadProfile();}
  if(event.target.closest?.('[data-profile-connect]')){if(authState.user)setModal(true);else setAuthModal(true);}
  if(event.target.closest?.('[data-profile-avatar-remove]')){profileState.avatarDraft='';profileState.dirty=true;const portrait=event.target.closest('.profile-avatar-editor')?.querySelector('.profile-portrait');if(portrait)portrait.innerHTML='<span>Z</span>';}
  if(event.target.closest?.('[data-author-link]')){event.preventDefault();const href=event.target.closest('[data-author-link]').getAttribute('href');setView(href.slice(1));}
});
document.addEventListener('error',event=>{if(event.target?.matches?.('[data-profile-avatar-image]'))event.target.remove();},true);
document.addEventListener('keydown',event=>{if(event.target?.matches?.('.user-card[role="button"]')&&['Enter',' '].includes(event.key)){event.preventDefault();if(authState.user)setView('profile');else setAuthModal(true);}});
