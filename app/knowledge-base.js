/* Short onboarding guides. Reading never requests credentials or starts store actions. */
const KB_CATEGORIES = Object.freeze([
 {id:'connection',name:'Начало работы',icon:'shield',color:'amber'},
 {id:'keys',name:'Golden Key',icon:'user',color:'blue'},
 {id:'diagnostics',name:'Помощь',icon:'help',color:'rose'}
]);
const kbSection = (title,body,extra={}) => ({title,body:Array.isArray(body)?body:[body],...extra});
const KB_KEY_NOTICE = 'Golden Key даёт доступ к аккаунту FunPay. Вставляйте его только в поле Golden Key кабинета ZetSlay — не отправляйте боту или поддержке. После подключения не выходите из FunPay в этом браузере: ключ может перестать работать.';
const KB_ARTICLES = Object.freeze([
 {id:'connect',category:'connection',title:'Подключить магазин',summary:'Пять шагов: от Telegram-бота до проверки FunPay.',minutes:2,tags:['старт','подключение','прокси','бот','BotFather','пароль','тариф'],action:'connect',related:['golden-key','connection-errors'],sections:[
  kbSection('Перед началом','Активируйте пробный период или подписку в кабинете. Бессрочная покупка сохраняет лицензию на плагин, но не заменяет подписку. Подготовьте аккаунт FunPay и прокси.'),
  kbSection('Подключение по порядку',[],{steps:['Нажмите «Подключить FunPay» в кабинете ZetSlay.','Создайте своего Telegram-бота через @BotFather. Вставьте токен в поле мастера.','На следующем шаге создайте пароль доступа к рабочему боту и выполните подсказки мастера. Пароль кабинета и пароль бота — разные пароли.','Добавьте Golden Key своего аккаунта FunPay и реквизиты прокси. Прокси можно купить в ZetSlay.','Запустите проверку и дождитесь подтверждения подключения. Затем обновите данные магазина.']}),
  kbSection('Дальше','Выберите нужный плагин и настройте его в кабинете. Для подробного разбора посмотрите видео над инструкциями.',{notice:'Токен бота, Golden Key и реквизиты прокси вводите в поля кабинета. Поддержке эти данные не нужны.'})]},
 {id:'golden-key',category:'keys',title:'Golden Key на компьютере',summary:'Получите ключ через Cookie-Editor или встроенные инструменты браузера.',minutes:2,tags:['golden_key','cookie','Chrome','Edge','Opera','Яндекс','Windows','Mac','EditThisCookie','компьютер'],action:'connect',related:['golden-key-android','golden-key-iphone'],sections:[
  kbSection('Установите Cookie-Editor','Откройте сайт разработчика Cookie-Editor, выберите свой браузер и установите расширение из его магазина. Так проще найти нужное расширение среди похожих названий.',{link:{href:'https://cookie-editor.com/',label:'Выбрать браузер на сайте Cookie-Editor'}}),
  kbSection('Найдите и скопируйте ключ',[],{steps:['Откройте funpay.com и войдите в свой аккаунт.','Нажмите значок расширений в браузере и откройте Cookie-Editor на вкладке FunPay.','Найдите golden_key, разверните строку и скопируйте поле Value («Значение»).','Вставьте только значение в поле Golden Key мастера ZetSlay — без имени cookie и кавычек.']}),
  kbSection('Можно без расширения','В Chrome или Edge нажмите F12 либо Ctrl+Shift+I (на Mac — ⌘+⌥+I). Откройте Application → Storage → Cookies → https://funpay.com. Найдите golden_key и скопируйте Value.',{notice:KB_KEY_NOTICE})]},
 {id:'golden-key-android',category:'keys',title:'Golden Key на Android',summary:'Firefox и Cookie-Editor: получить ключ прямо на телефоне.',minutes:2,tags:['golden_key','cookie','телефон','Android','Firefox','расширение','мобильный'],action:'connect',related:['golden-key','connection-errors'],sections:[
  kbSection('Подготовьте браузер','Установите Firefox из Google Play. Откройте в нём Cookie-Editor от cgagnier в официальном каталоге дополнений Firefox и подтвердите установку.',{link:{href:'https://addons.mozilla.org/en-US/firefox/addon/cookie-editor/',label:'Cookie-Editor для Firefox и Android'}}),
  kbSection('Получите Golden Key',[],{steps:['В этом же Firefox откройте funpay.com и войдите в свой аккаунт.','Откройте меню Firefox → «Расширения» и выберите Cookie-Editor. Название пункта может отличаться в разных версиях.','Если расширение попросит доступ к FunPay, разрешите его для этого сайта.','Найдите golden_key, откройте строку и скопируйте Value («Значение»).','Вернитесь в кабинет ZetSlay и вставьте значение в поле Golden Key мастера.']}),
  kbSection('Если ключ не виден','Проверьте, что Cookie-Editor открыт на вкладке FunPay и вход выполнен именно в Firefox.',{notice:KB_KEY_NOTICE})]},
 {id:'golden-key-iphone',category:'keys',title:'Golden Key на iPhone',summary:'Вариант через Orion с поддержкой браузерных расширений.',minutes:2,tags:['golden_key','cookie','iPhone','iOS','iPad','Orion','телефон'],action:'connect',related:['golden-key','connection-errors'],sections:[
  kbSection('Подготовьте Orion',[],{steps:['Установите Orion Browser из App Store.','Откройте меню ••• → Settings («Настройки»). В группе Extensions включите установку расширений Firefox.','В Orion откройте сайт Cookie-Editor, выберите Firefox и подтвердите установку расширения.'],link:{href:'https://cookie-editor.com/',label:'Открыть сайт Cookie-Editor'}}),
  kbSection('Найдите ключ',[],{steps:['В Orion откройте funpay.com и войдите в свой аккаунт.','Нажмите ••• → Extensions («Расширения») → Cookie-Editor.','Найдите golden_key, разверните строку и скопируйте Value («Значение»).','Вставьте значение в поле Golden Key мастера ZetSlay.']}),
  kbSection('Если расширение не работает','Поддержка расширений в Orion экспериментальная: Cookie-Editor может работать не во всех версиях. Если куки не отображаются, получите ключ на компьютере.',{notice:KB_KEY_NOTICE})]},
 {id:'connection-errors',category:'diagnostics',title:'Если магазин не подключается',summary:'Что проверить при ошибке ключа, прокси или рабочего бота.',minutes:1,tags:['ошибка','PROXY_TIMEOUT','INVALID_SESSION','403','авторизация','прокси','бот','поддержка'],action:'support',related:['connect','golden-key'],sections:[
  kbSection('Ошибка авторизации','Заново войдите на FunPay, скопируйте актуальное значение golden_key и обновите его в мастере ZetSlay. Проверьте, что выбран нужный аккаунт.'),
  kbSection('Ошибка прокси','Проверьте срок действия, сервер, порт, логин и пароль. Для SOCKS5 укажите протокол и соответствующий порт. Таймаут соединения не означает, что Golden Key неверный.'),
  kbSection('Бот не отвечает','Убедитесь, что открыли именно своего рабочего бота. Проверьте завершение шага создания пароля в мастере и войдите в бота по его подсказке.'),
  kbSection('Нужна помощь?','Передайте поддержке текст ошибки, время попытки и название шага. На скриншоте скройте ключи, токены и реквизиты прокси.') ]}
]);
const KB_ALIASES = Object.freeze({proxy:'connect',telegram:'connect',support:'connection-errors'});
const kbState = {query:'',category:'all',article:null};
const kbEscape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kbIcon = name => name==='arrow-left' ? '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m14 6-6 6 6 6M8 12h12"/></svg>' : name==='link' ? '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m10 13 4-4M8 15l-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 9l2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0) scale(.9)"/></svg>' : `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const kbNormalize = value => String(value||'').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[^\p{L}\p{N}_]+/gu,' ').trim();
function kbSearch(query,category='all') {
 const terms=kbNormalize(query).split(/\s+/).filter(Boolean);
 return KB_ARTICLES.filter(a=>category==='all'||a.category===category).map(a=>{
  const title=kbNormalize(a.title+' '+a.summary+' '+a.tags.join(' '));
  const text=title+' '+kbNormalize(a.sections.map(s=>s.title+' '+s.body.join(' ')+' '+(s.steps||[]).join(' ')+' '+(s.code||'')+' '+(s.notice||'')).join(' '));
  return {article:a,match:terms.every(t=>text.includes(t)),score:terms.reduce((n,t)=>n+(kbNormalize(a.title).includes(t)?3:title.includes(t)?1:0),0)};
 }).filter(x=>x.match).sort((a,b)=>b.score-a.score).map(x=>x.article);
}
function kbCard(a) {
 const c=KB_CATEGORIES.find(c=>c.id===a.category);
 return `<button type="button" class="kb-card" data-kb-open="${a.id}"><span class="kb-card-top"><span class="kb-icon kb-icon--${c.color}">${kbIcon(c.icon)}</span><span>${a.minutes} мин</span></span><strong>${kbEscape(a.title)}</strong><span class="kb-card-desc">${kbEscape(a.summary)}</span><span class="kb-card-footer">${kbEscape(c.name)}${kbIcon('chevron')}</span></button>`;
}
function kbRenderList() {
 const root=document.querySelector('[data-knowledge-base]');if(!root)return;
 const list=kbSearch(kbState.query,kbState.category);
 root.querySelector('[data-kb-count]').textContent=String(list.length);
 root.querySelector('[data-kb-results-title]').textContent=kbState.query?'Результаты поиска':kbState.category==='all'?'Все инструкции':KB_CATEGORIES.find(c=>c.id===kbState.category)?.name||'Все инструкции';
 root.querySelector('[data-kb-results]').innerHTML=list.length?list.map(kbCard).join(''):'<div class="kb-empty"><span class="kb-icon">'+kbIcon('search')+'</span><h3>Ничего не найдено</h3><p>Попробуйте «Golden Key», «Android» или «прокси».</p><button class="button button--ghost" type="button" data-kb-reset>Сбросить поиск и фильтры</button></div>';
 root.querySelectorAll('[data-kb-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kbCategory===kbState.category)));
 root.querySelector('[data-kb-clear]').hidden=!kbState.query;
}
function kbLink(id) {const url=new URL(location.pathname,location.origin);url.searchParams.set('kb',id);url.hash='guide';return url.href;}
function kbSectionMarkup(s,index) {
 return `<section id="kb-section-${index}"><h3 tabindex="-1">${kbEscape(s.title)}</h3>${s.body.map(p=>`<p>${kbEscape(p)}</p>`).join('')}${s.steps?`<ol>${s.steps.map(p=>`<li>${kbEscape(p)}</li>`).join('')}</ol>`:''}${s.code?`<pre><code>${kbEscape(s.code)}</code></pre>`:''}${s.notice?`<aside class="kb-callout">${kbIcon('shield')}<p>${kbEscape(s.notice)}</p></aside>`:''}${s.link?`<a class="kb-text-link" href="${kbEscape(s.link.href)}" target="_blank" rel="noopener noreferrer">${kbEscape(s.link.label)} ${kbIcon('external')}</a>`:''}</section>`;
}
function kbAction(a) {
 if(a.action==='connect')return '<button class="button button--primary" type="button" data-open-connect>Открыть мастер подключения</button>';
 if(a.action==='support')return '<a class="button button--primary" href="https://t.me/zetslaysupport" target="_blank" rel="noopener noreferrer">Написать поддержке</a>';
 const target=a.action==='plugin'?`plugins/${a.plugin}`:a.action;
 return `<button class="button button--primary" type="button" data-view-link="${target}">${a.action==='plugin'?'Открыть плагин':'Перейти в раздел'} ${kbIcon('chevron')}</button>`;
}
function kbOpen(id,{updateUrl=true,focus=true}={}) {
 id=KB_ALIASES[id]||id;
 const article=KB_ARTICLES.find(a=>a.id===id);const root=document.querySelector('[data-knowledge-base]');if(!article||!root)return false;
 kbState.article=id;
 root.querySelector('[data-kb-library]').hidden=true;
 const reader=root.querySelector('[data-kb-reader]');reader.hidden=false;
 const c=KB_CATEGORIES.find(c=>c.id===article.category);
 reader.innerHTML=`<div class="kb-reader-bar"><button type="button" class="kb-back" data-kb-back>${kbIcon('arrow-left')} Все инструкции</button><button type="button" class="kb-back" data-kb-copy>Скопировать ссылку ${kbIcon('link')}</button></div><div class="kb-reader-layout"><article class="kb-article"><header><span class="kb-article-meta"><span class="kb-icon kb-icon--${c.color}">${kbIcon(c.icon)}</span>${kbEscape(c.name)}<span>· ${article.minutes} мин чтения</span></span><h2 tabindex="-1" data-kb-article-title>${kbEscape(article.title)}</h2><p class="kb-lead">${kbEscape(article.summary)}</p></header><div class="kb-article-body">${article.sections.map(kbSectionMarkup).join('')}</div><footer>${kbAction(article)}<span>Обновлено 25 октября 2026</span></footer></article><aside class="kb-toc"><h3>В этой инструкции</h3><nav aria-label="Содержание статьи">${article.sections.map((s,i)=>`<button type="button" data-kb-section="${i}">${kbEscape(s.title)}</button>`).join('')}</nav><div class="kb-reader-help"><strong>Нужна помощь?</strong><p>Опишите проблему и приложите код ошибки. Ключи и пароли не отправляйте.</p><a href="https://t.me/zetslaysupport" target="_blank" rel="noopener noreferrer">@zetslaysupport ${kbIcon('external')}</a></div></aside></div><section class="kb-related"><h3>Может пригодиться</h3><div class="kb-grid">${article.related.map(id=>KB_ARTICLES.find(a=>a.id===id)).filter(Boolean).map(kbCard).join('')}</div></section><p class="kb-copy-status" data-kb-copy-status role="status" aria-live="polite"></p><input class="kb-share-link" data-kb-share-link readonly aria-label="Ссылка на инструкцию" hidden>`;
 if(updateUrl)history.replaceState(null,'',kbLink(id));
 if(focus)reader.querySelector('[data-kb-article-title]')?.focus();
 return true;
}
function kbClose({focus=true}={}) {
 const root=document.querySelector('[data-knowledge-base]');if(!root)return;
 const previous=kbState.article;kbState.article=null;
 root.querySelector('[data-kb-reader]').hidden=true;root.querySelector('[data-kb-library]').hidden=false;
 const url=new URL(location.href);url.searchParams.delete('kb');history.replaceState(null,'',url.href);
 kbRenderList();
 if(focus)(root.querySelector(`[data-kb-open="${previous}"]`)||root.querySelector('[data-kb-search]'))?.focus();
}
async function kbCopy() {
 const id=kbState.article;if(!id)return;
 const root=document.querySelector('[data-knowledge-base]');const link=kbLink(id);
 try {await navigator.clipboard.writeText(link);if(kbState.article===id)root.querySelector('[data-kb-copy-status]').textContent='Ссылка на инструкцию скопирована.';}
 catch {if(kbState.article!==id)return;const input=root.querySelector('[data-kb-share-link]');input.hidden=false;input.value=link;input.focus();input.select();root.querySelector('[data-kb-copy-status]').textContent='Выделенная ссылка готова к копированию.';}
}
function kbInit() {
 const root=document.querySelector('[data-knowledge-base]');if(!root)return;
 root.querySelector('[data-kb-categories]').innerHTML=`<button type="button" data-kb-category="all" aria-pressed="true">Все темы <span>${KB_ARTICLES.length}</span></button>`+KB_CATEGORIES.map(c=>`<button type="button" data-kb-category="${c.id}" aria-pressed="false">${kbEscape(c.name)} <span>${KB_ARTICLES.filter(a=>a.category===c.id).length}</span></button>`).join('');
 root.querySelector('[data-kb-total]').textContent=String(KB_ARTICLES.length);
 kbRenderList();
 const initial=new URL(location.href).searchParams.get('kb');
 if(initial&&kbOpen(initial,{updateUrl:false,focus:false})&&typeof setView==='function')setView('guide',false);
 root.addEventListener('input',event=>{if(!event.target.matches('[data-kb-search]'))return;kbState.query=event.target.value.slice(0,160);if(kbState.article)kbClose({focus:false});kbRenderList();});
 root.addEventListener('click',event=>{
  const open=event.target.closest('[data-kb-open]');if(open){kbOpen(open.dataset.kbOpen);return;}
  if(event.target.closest('[data-kb-back]')){kbClose();return;}
  if(event.target.closest('[data-kb-copy]')){kbCopy();return;}
  const category=event.target.closest('[data-kb-category]');if(category){const value=category.dataset.kbCategory;if(value==='all'||KB_CATEGORIES.some(c=>c.id===value)){kbState.category=value;if(kbState.article)kbClose({focus:false});kbRenderList();}return;}
  if(event.target.closest('[data-kb-clear], [data-kb-reset]')){kbState.query='';if(event.target.closest('[data-kb-reset]'))kbState.category='all';root.querySelector('[data-kb-search]').value='';kbRenderList();root.querySelector('[data-kb-search]').focus();return;}
  const section=event.target.closest('[data-kb-section]');if(section){const target=root.querySelector(`#kb-section-${section.dataset.kbSection}`);target?.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});target?.querySelector('h3')?.focus();}
 });
 root.addEventListener('keydown',event=>{if(event.key==='Escape'&&kbState.article){event.preventDefault();kbClose();}});
}
kbInit();
