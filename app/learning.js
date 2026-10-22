/* A guided introduction only. Business actions remain explicit, outside the tour. */
const LEARNING_TOUR_STEPS = Object.freeze([
  {id:'dashboard',view:'dashboard',target:'[data-view-target="dashboard"]',title:'Главная',text:'На главной — состояние подключения и статистика за день, неделю или месяц. Ваши данные появятся после подключения FunPay и активации доступа.',hint:'Начните со статуса магазина, затем выберите период статистики.',nav:true},
  {id:'connection',view:'dashboard',target:'[data-overview-connect]',fallback:'[data-open-connect]',title:'Подключение FunPay',text:'Мастер поможет подключить рабочего Telegram-бота, магазин FunPay и прокси. Каждый этап покажет, что уже готово. Для запуска мастера сначала нужен активный доступ.',hint:'Кнопка подключения всегда рядом со статусом магазина.'},
  {id:'trial',view:'dashboard',target:'[data-sidebar-trial]',fallback:'[data-view-target="billing"]',title:'Пробный период',text:'В пробном периоде доступны статистика, автовыдача и плагины всех редкостей, кроме легендарных. Период начинается, когда вы сами нажмёте «Начать бесплатно».',hint:'Если у вас уже есть тариф, ваш доступ отображается в разделе «Подписка».',nav:true},
  {id:'orders',view:'orders',target:'[data-view-target="orders"]',title:'Заказы и сообщения',text:'В «Заказах» следите за продажами, а в «Сообщениях» отвечайте покупателям. Рабочий Telegram-бот поможет получать уведомления и отвечать вне сайта.',hint:'Номер заказа и собеседник помогут найти нужный диалог.',nav:true},
  {id:'plugins',view:'plugins',target:'[data-view-target="plugins"]',title:'Первая автоматизация',text:'Выберите плагин и откройте «Подробнее»: там описание, условия доступа и настройки. Для знакомства удобно начать с напоминания покупателю.',hint:'Изучите настройки перед включением. Легендарные модули не входят в пробный период.',nav:true},
  {id:'billing',view:'billing',target:'[data-view-target="billing"]',title:'Подписка',text:'Активный тариф или пробный период нужен для связи с FunPay, синхронизации и работы плагинов — в том числе купленных навсегда. Бессрочная лицензия сохраняется после окончания подписки. В «Подписке» видны срок доступа и тарифы; баланс FunPay учитывается отдельно.',hint:'Выберите подписку по нужным возможностям и редкостям плагинов.',nav:true}
]);
const learningUi = {scope:'',epoch:0,navigation:0,data:null,loading:false,busy:false,error:'',mode:'',index:0,root:null,previousFocus:null,previousRoute:'',previousSidebar:false,previousInert:false,suspended:false,frame:0,autoTimer:0,layoutTimer:0,resize:null};
const learningEscape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function learningScope() {return authState.user?.id && authState.token ? `${authState.user.id}:${authState.token}` : '';}
function learningData(value) {
  if(!value || value.version!==1 || !Number.isSafeInteger(value.revision) || value.revision<0 || typeof value.welcomeSeen!=='boolean' ||
     !['new','in_progress','paused','completed'].includes(value.status) || !Number.isInteger(value.step) || value.step<0 || value.step>=6) throw Error('Не удалось прочитать прогресс обучения');
  return value;
}
function learningFacts() {
  const plan=authState.workspace?.plan;
  const expiry=plan?.expiresAt;
  const access=Boolean(plan?.active && (!expiry || Number.isFinite(Date.parse(expiry)) && Date.parse(expiry)>Date.now()));
  const o=state.onboarding;
  const connected=Boolean(o?.state==='connected_read_only' && o.funPay?.store?.id);
  const plugin=Array.isArray(state.plugins) && state.plugins.some(p=>p.installed && p.active && !p.planned && p.published!==false);
  return {access,connected,plugin,complete:access&&connected&&plugin};
}
function learningProgressMount() {
  let mount=document.querySelector('[data-learning-checklist]');
  if(!mount) {
    const before=document.querySelector('[data-view="dashboard"] .overview-context');
    if(!before)return null;
    mount=document.createElement('section');mount.className='learning-checklist';mount.dataset.learningChecklist='';
    mount.setAttribute('aria-label','Первые шаги в ZetSlay');before.before(mount);
    mount.addEventListener('click',learningChecklistClick);
  }
  return mount;
}
function renderLearningChecklist() {
  const mount=learningProgressMount();if(!mount)return;
  const facts=learningFacts();mount.hidden=!learningScope()||facts.complete;
  if(mount.hidden)return;
  const trial=typeof sidebarTrialUi==='object'?sidebarTrialUi.data:null;
  const accessAction=trial?.state==='available'?'Начать 3 дня бесплатно':facts.access?'Доступ активен':'Выбрать доступ';
  const tasks=[
    {key:'access',done:facts.access,title:'Активируйте доступ',text:'Пробный период на 3 дня или подходящая подписка.',action:accessAction},
    {key:'connection',done:facts.connected,title:'Подключите FunPay',text:'Telegram-бот, магазин и прокси — по шагам.',action:facts.connected?'Магазин подключён':facts.access?'Подключить магазин':'Сначала активируйте доступ'},
    {key:'plugin',done:facts.plugin,title:'Включите первый плагин',text:'Начните с простой задачи и проверьте настройки.',action:facts.plugin?'Плагин включён':'Открыть каталог'}
  ];
  const count=tasks.filter(t=>t.done).length;const next=tasks.find(t=>!t.done)?.key;
  mount.innerHTML=`<header><div><span class="learning-eyebrow">Начало работы</span><h2>Подключите свой магазин</h2></div><span class="learning-count">${count} из 3</span></header><ol class="learning-tasks">${tasks.map((t,i)=>`<li class="learning-task ${t.done?'is-done':t.key===next?'is-current':''}"><span class="learning-task-number" aria-hidden="true">${t.done?'✓':String(i+1).padStart(2,'0')}</span><div><h3>${t.title}</h3><p>${t.text}</p><button type="button" data-learning-task="${t.key}" ${t.done?'disabled':''}>${t.action}${t.done?'':' <span aria-hidden="true">→</span>'}</button></div></li>`).join('')}</ol><footer><button type="button" data-learning-replay>${learningUi.data?.startedAt&&(learningUi.data.status==='in_progress'||learningUi.data.status==='paused')?'Продолжить обучение':'Пройти обучение'} <span aria-hidden="true">→</span></button><button type="button" data-learning-help>База знаний</button></footer>`;
}
function learningChecklistClick(event) {
  if(event.target.closest('[data-learning-replay]')){void learningStart();return;}
  if(event.target.closest('[data-learning-help]')){setView('guide');return;}
  const key=event.target.closest('[data-learning-task]')?.dataset.learningTask;
  if(!key || !learningScope())return;
  if(key==='access') {
    const trial=typeof sidebarTrialUi==='object'?sidebarTrialUi.data:null;
    if(trial?.state==='available') document.querySelector('[data-trial-action]')?.click();
    else setView('billing');
  } else if(key==='connection') {
    if(!learningFacts().access){setView('billing');return;}
    document.querySelector('[data-overview-connect]')?.click();
  } else if(key==='plugin') setView('plugins');
}
function learningKnowledgeMount() {
  const library=document.querySelector('[data-kb-library]');if(!library || library.querySelector('[data-learning-replay]'))return;
  const button=document.createElement('button');button.type='button';button.className='learning-replay';button.dataset.learningReplay='';
  button.innerHTML='<span aria-hidden="true">↗</span><span><strong>Знакомство с кабинетом</strong><small>Шесть коротких шагов. Можно пройти ещё раз.</small></span><span aria-hidden="true">→</span>';
  button.addEventListener('click',()=>void learningStart(true));library.prepend(button);
}
async function loadLearning({automatic=true}={}) {
  const scope=learningScope();if(!scope||learningUi.loading)return;
  const epoch=learningUi.epoch;learningUi.loading=true;learningUi.error='';
  try {
    const data=learningData(await apiRequest('/api/v1/learning',{authenticated:true}));
    if(scope!==learningScope()||epoch!==learningUi.epoch)return;
    learningUi.data=data;
    if(automatic && !data.welcomeSeen) learningScheduleWelcome();
  } catch {
    if(scope===learningScope()&&epoch===learningUi.epoch)learningUi.error='Не удалось загрузить обучение. Попробуйте ещё раз.';
  } finally {
    if(scope===learningScope()&&epoch===learningUi.epoch){learningUi.loading=false;renderLearningChecklist();}
  }
}
async function learningAction(action,step) {
  if(!learningUi.data||learningUi.busy||!learningScope())return false;
  const scope=learningScope(),epoch=learningUi.epoch,revision=learningUi.data.revision;learningUi.busy=true;learningUi.error='';learningControls();
  try {
    const data=learningData(await apiRequest('/api/v1/learning',{authenticated:true,method:'POST',body:{action,revision,...(action==='step'?{step}:{})}}));
    if(scope!==learningScope()||epoch!==learningUi.epoch)return false;
    learningUi.data=data;return true;
  } catch(error) {
    if(scope!==learningScope()||epoch!==learningUi.epoch)return false;
    // A lost response may still have saved the step. Read before offering a retry.
    try {
      const fresh=learningData(await apiRequest('/api/v1/learning',{authenticated:true}));
      if(scope!==learningScope()||epoch!==learningUi.epoch)return false;
      learningUi.data=fresh;
      const applied=action==='welcome_seen'?fresh.welcomeSeen:action==='step'?fresh.status==='in_progress'&&fresh.step===step:action==='complete'?fresh.status==='completed':action==='pause'?['paused','completed'].includes(fresh.status):fresh.status==='in_progress'&&(action!=='restart'||fresh.step===0);
      if(fresh.revision>revision&&applied){learningUi.error='';return true;}
    }catch{}
    if(scope!==learningScope()||epoch!==learningUi.epoch)return false;
    learningUi.error=error?.code==='INVALID_STATE'?'Прогресс изменён в другой вкладке. Повторите действие после обновления.':'Не удалось сохранить прогресс. Можно закрыть обучение и попробовать позже.';
    return false;
  } finally {
    if(scope===learningScope()&&epoch===learningUi.epoch){learningUi.busy=false;learningControls();renderLearningChecklist();}
  }
}
function learningScheduleWelcome() {
  clearTimeout(learningUi.autoTimer);
  const scope=learningScope(),epoch=learningUi.epoch;
  const show=()=>{
    if(scope!==learningScope()||epoch!==learningUi.epoch||learningUi.data?.welcomeSeen||learningUi.mode)return;
    if(document.hidden||document.querySelector('.auth-modal.is-open, .connect-modal.is-open, dialog[open]')){learningUi.autoTimer=setTimeout(show,500);return;}
    learningOpen('welcome');void learningAction('welcome_seen');
  };
  learningUi.autoTimer=setTimeout(show,450);
}
function learningIcon(name) {return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${name==='back'?'<path d="m14 6-6 6 6 6"/>':name==='close'?'<path d="m6 6 12 12M18 6 6 18"/>':'<path d="m10 6 6 6-6 6"/>'}</svg>`;}
function learningOpen(mode) {
  if(!learningScope())return;
  if(!learningUi.root) {
    learningUi.previousFocus=document.activeElement;learningUi.previousRoute=location.hash.slice(1)||'dashboard';
    learningUi.previousSidebar=Boolean(document.querySelector('.sidebar')?.classList.contains('is-open'));
    const shell=document.querySelector('.app-shell');learningUi.previousInert=Boolean(shell?.inert);if(shell)shell.inert=true;
    const root=document.createElement('div');root.className='learning-overlay';root.dataset.learningOverlay='';document.body.append(root);learningUi.root=root;
    root.addEventListener('click',learningClick);document.addEventListener('keydown',learningKey,true);
    window.addEventListener('resize',learningResize);window.addEventListener('scroll',learningLayout,true);
    window.visualViewport?.addEventListener('resize',learningResize);window.visualViewport?.addEventListener('scroll',learningLayout);
    learningUi.resize=typeof ResizeObserver==='function'?new ResizeObserver(learningLayout):null;
    document.body.classList.add('learning-open');
  }
  learningUi.mode=mode;learningRender();
}
function learningRender() {
  const root=learningUi.root;if(!root)return;
  learningUi.resize?.disconnect();
  if(learningUi.mode==='tour') {
    const step=LEARNING_TOUR_STEPS[learningUi.index];
    root.className='learning-overlay learning-overlay--tour';
    root.innerHTML=`<div class="learning-shade learning-shade--top" aria-hidden="true"></div><div class="learning-shade learning-shade--right" aria-hidden="true"></div><div class="learning-shade learning-shade--bottom" aria-hidden="true"></div><div class="learning-shade learning-shade--left" aria-hidden="true"></div><div class="learning-spot" aria-hidden="true"></div><section class="learning-coach" role="dialog" aria-modal="true" aria-labelledby="learning-title" aria-describedby="learning-description" tabindex="-1"><header><span class="learning-step">Шаг ${learningUi.index+1} из 6</span><button type="button" data-learning-close aria-label="Закрыть обучение">${learningIcon('close')}</button></header><h2 id="learning-title">${step.title}</h2><p id="learning-description">${step.text}</p><p class="learning-tip">${step.hint}</p><p class="learning-error" role="status" data-learning-error hidden></p><footer><button type="button" class="learning-arrow" data-learning-back aria-label="Предыдущий шаг" ${learningUi.index===0?'disabled':''}>${learningIcon('back')}</button><button type="button" class="learning-later" data-learning-close>Продолжить позже</button><button type="button" class="learning-primary" data-learning-next>${learningUi.index===5?'Завершить':'Далее'}${learningIcon('next')}</button></footer></section>`;
    learningNavigate(step);learningLayout();
    learningUi.resize?.observe(root.querySelector('.learning-coach'));
  } else {
    const finished=learningUi.mode==='finish';const facts=learningFacts();
    root.className='learning-overlay';
    root.innerHTML=`<div class="learning-backdrop" aria-hidden="true"></div><section class="learning-welcome" role="dialog" aria-modal="true" aria-labelledby="learning-title" aria-describedby="learning-description" tabindex="-1"><header><span class="learning-product">ZetSlay <span>/ ${finished?'Обучение завершено':'Начало работы'}</span></span><button class="learning-dismiss" type="button" data-learning-close aria-label="Закрыть обучение">${learningIcon('close')}</button></header><div class="learning-welcome-copy"><span class="learning-eyebrow">${finished?'Следующий шаг':'Знакомство с кабинетом'}</span><h2 id="learning-title">${finished?'Всё по своим местам':'Добро пожаловать в ZetSlay'}</h2><p id="learning-description">${finished?facts.complete?'Магазин и первый плагин подключены. Инструкции всегда доступны в базе знаний.':!facts.access?'Попробуйте сервис на своём магазине: активируйте пробный период или выберите подписку.':facts.connected?'Магазин подключён. Выберите плагин под свою задачу и проверьте его настройки.':'Подключите Telegram-бота и FunPay. Затем настройте первую автоматизацию.':'Покажем, где следить за заказами, отвечать покупателям и настраивать автоматизацию.'}</p>${finished?'':`<ol class="learning-agenda"><li><span>01</span><div><strong>Осмотритесь в кабинете</strong><small>Статистика, заказы и переписка</small></div></li><li><span>02</span><div><strong>Подготовьте подключение</strong><small>Telegram-бот, FunPay и прокси</small></div></li><li><span>03</span><div><strong>Выберите первую задачу</strong><small>Настройки плагинов и подписка</small></div></li></ol>`}<p class="learning-error" role="status" data-learning-error hidden></p></div><footer><span class="learning-duration">${finished?'Прогресс сохранён':'6 шагов · около минуты'}</span><button type="button" class="learning-primary" ${finished?'data-learning-launch':'data-learning-start'}>${finished?facts.complete?'Открыть кабинет':facts.access?'Подготовить магазин':'Выбрать доступ':'Пройти обучение'}${learningIcon('next')}</button></footer><button type="button" class="learning-welcome-skip learning-later" data-learning-close>${finished?'Закрыть':'Пропустить и разобраться самостоятельно'}</button></section>`;
  }
  learningControls();root.querySelector('[role="dialog"]')?.focus({preventScroll:true});
}
function learningControls() {
  const root=learningUi.root;if(!root)return;
  root.querySelectorAll('[data-learning-start],[data-learning-next],[data-learning-back]').forEach(b=>{b.disabled=learningUi.busy||(b.hasAttribute('data-learning-back')&&learningUi.index===0);b.setAttribute('aria-busy',String(learningUi.busy));});
  const error=root.querySelector('[data-learning-error]');if(error){error.textContent=learningUi.error;error.hidden=!learningUi.error;}
}
function learningNavigate(step) {
  setView(step.view);window.scrollTo?.({top:0,behavior:'instant'});if(typeof setSidebar==='function')setSidebar(Boolean(step.nav && window.innerWidth<1100));
  const target=learningTarget(step);target?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
  if(target)learningUi.resize?.observe(target);
  clearTimeout(learningUi.layoutTimer);learningUi.layoutTimer=setTimeout(learningLayout,350);
}
function learningResize() {
  if(learningUi.mode!=='tour')return;
  const step=LEARNING_TOUR_STEPS[learningUi.index];
  if(typeof setSidebar==='function')setSidebar(Boolean(step.nav&&window.innerWidth<1100));
  learningTarget()?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
  learningLayout();clearTimeout(learningUi.layoutTimer);learningUi.layoutTimer=setTimeout(learningLayout,350);
}
function learningTarget(step=LEARNING_TOUR_STEPS[learningUi.index]) {
  const visible=node=>node&&!node.closest('[hidden]')&&node.getBoundingClientRect().width>0&&node.getBoundingClientRect().height>0;
  for(const selector of [step.target,step.fallback,`[data-view-target="${step.view}"]`].filter(Boolean)){const node=document.querySelector(selector);if(visible(node))return node;}
  return null;
}
function learningLayout() {
  if(learningUi.mode!=='tour'||!learningUi.root)return;
  cancelAnimationFrame(learningUi.frame);learningUi.frame=requestAnimationFrame(()=>{
    if(learningUi.mode!=='tour'||!learningUi.root)return;
    const root=learningUi.root,card=root.querySelector('.learning-coach'),spot=root.querySelector('.learning-spot');if(!card)return;
    const viewport=window.visualViewport,w=viewport?.width||window.innerWidth,h=viewport?.height||window.innerHeight,ox=viewport?.offsetLeft||0,oy=viewport?.offsetTop||0;
    const r=learningTarget()?.getBoundingClientRect();
    let box=r?{x:Math.max(ox,r.left-6),y:Math.max(oy,r.top-6),right:Math.min(ox+w,r.right+6),bottom:Math.min(oy+h,r.bottom+6)}:{x:ox+w/2,y:oy+h/3,right:ox+w/2,bottom:oy+h/3};
    const cw=Math.min(380,w-24),ch=Math.min(card.scrollHeight,h-24);
    card.style.width=`${cw}px`;card.style.maxHeight=`${h-24}px`;
    let x=box.right+18,y=Math.max(oy+12,Math.min(box.y,oy+h-ch-12));
    if(x+cw>ox+w-12) {x=Math.max(ox+12,Math.min(box.x,ox+w-cw-12));y=box.bottom+18;if(y+ch>oy+h-12)y=box.y-ch-18;}
    if(w<600||y<oy+12) {x=ox+(w-cw)/2;y=oy+h-ch-12;}
    // If a tall target would be covered on a small screen, focus the nav fallback.
    if(r && box.bottom>y && box.y<y+ch && box.right>x && box.x<x+cw && w<600) {
      const step=LEARNING_TOUR_STEPS[learningUi.index],fallback=document.querySelector(step.fallback||`[data-view-target="${step.view}"]`);
      const f=fallback?.getBoundingClientRect();if(f && f.height && f.bottom<y)box={x:Math.max(ox,f.left-6),y:Math.max(oy,f.top-6),right:Math.min(ox+w,f.right+6),bottom:Math.min(oy+h,f.bottom+6)};
    }
    card.style.left=`${x}px`;card.style.top=`${Math.max(oy+12,y)}px`;
    const bw=Math.max(0,box.right-box.x),bh=Math.max(0,box.bottom-box.y);
    spot.hidden=!r||bw===0||bh===0;Object.assign(spot.style,{left:`${box.x}px`,top:`${box.y}px`,width:`${bw}px`,height:`${bh}px`});
    const rects={top:[ox,oy,w,Math.max(0,box.y-oy)],bottom:[ox,box.bottom,w,Math.max(0,oy+h-box.bottom)],left:[ox,box.y,Math.max(0,box.x-ox),bh],right:[box.right,box.y,Math.max(0,ox+w-box.right),bh]};
    for(const [side,[left,top,width,height]] of Object.entries(rects))Object.assign(root.querySelector(`.learning-shade--${side}`).style,{left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`});
  });
}
async function learningStart(restart=false) {
  if(!learningScope())return;
  const navigation=learningUi.navigation,scope=learningScope();
  if(learningUi.loading)return;
  if(!learningUi.data)await loadLearning({automatic:false});
  if(navigation!==learningUi.navigation||scope!==learningScope())return;
  if(!learningUi.data){showToast?.(learningUi.error||'Обучение пока недоступно','error');return;}
  if(!await learningAction(restart||learningUi.data.status==='completed'?'restart':'start')||navigation!==learningUi.navigation)return;
  learningUi.index=learningUi.data.step;learningOpen('tour');
}
async function learningMove(delta) {
  if(learningUi.busy||learningUi.mode!=='tour')return;
  const index=learningUi.index+delta;
  const navigation=learningUi.navigation;
  if(index<0)return;
  if(index===6){if(await learningAction('complete')&&navigation===learningUi.navigation)learningOpen('finish');return;}
  if(await learningAction('step',index)&&navigation===learningUi.navigation){learningUi.index=index;learningRender();}
}
function learningClose({restore=true}={}) {
  learningUi.navigation++;
  clearTimeout(learningUi.autoTimer);clearTimeout(learningUi.layoutTimer);cancelAnimationFrame(learningUi.frame);
  learningUi.resize?.disconnect();learningUi.resize=null;
  const wasOpen=Boolean(learningUi.root);learningUi.root?.remove();learningUi.root=null;learningUi.mode='';
  document.removeEventListener('keydown',learningKey,true);window.removeEventListener('resize',learningResize);window.removeEventListener('scroll',learningLayout,true);
  window.visualViewport?.removeEventListener('resize',learningResize);window.visualViewport?.removeEventListener('scroll',learningLayout);
  document.body.classList.remove('learning-open');
  const shell=document.querySelector('.app-shell');if(shell && wasOpen)shell.inert=learningUi.previousInert;
  if(wasOpen && restore && learningScope())setView(learningUi.previousRoute);
  if(wasOpen && typeof setSidebar==='function')setSidebar(restore&&learningUi.previousSidebar);
  if(wasOpen && restore && learningUi.previousFocus?.isConnected)learningUi.previousFocus.focus({preventScroll:true});
  learningUi.previousFocus=null;
}
function learningClick(event) {
  const target=event.target;
  if(target.closest('[data-learning-start]')){void learningStart();return;}
  if(target.closest('[data-learning-next]')){void learningMove(1);return;}
  if(target.closest('[data-learning-back]')){void learningMove(-1);return;}
  if(target.closest('[data-learning-close]')) {const pause=learningUi.mode==='tour';learningClose();if(pause&&!learningUi.busy)void learningAction('pause');return;}
  if(target.closest('[data-learning-launch]')) {
    const facts=learningFacts();learningClose({restore:false});setView('dashboard');
    if(!facts.access){setView('billing');return;}
    if(!facts.connected)document.querySelector('[data-overview-connect]')?.click();
    else if(!facts.plugin)setView('plugins');
  }
}
function learningKey(event) {
  if(!learningUi.root)return;
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();const pause=learningUi.mode==='tour';learningClose();if(pause&&!learningUi.busy)void learningAction('pause');return;}
  const buttons=[...learningUi.root.querySelectorAll('button:not(:disabled)')];
  if(event.key==='Tab') {
    const index=buttons.indexOf(document.activeElement),next=event.shiftKey?(index<=0?buttons.length-1:index-1):(index<0||index===buttons.length-1?0:index+1);
    event.preventDefault();buttons[next]?.focus();
  } else if(learningUi.mode==='tour'&&['ArrowRight','ArrowLeft'].includes(event.key)) {event.preventDefault();void learningMove(event.key==='ArrowRight'?1:-1);}
}
function learningRefresh() {
  if(learningUi.suspended)return;
  const scope=learningScope();
  if(scope!==learningUi.scope){learningReset();learningUi.scope=scope;if(scope)void loadLearning();}
  renderLearningChecklist();learningKnowledgeMount();
}
function learningReset() {
  learningClose({restore:false});learningUi.epoch++;learningUi.scope='';learningUi.data=null;learningUi.loading=false;learningUi.busy=false;learningUi.error='';
  const mount=document.querySelector('[data-learning-checklist]');if(mount){mount.hidden=true;mount.replaceChildren();}
}
function bootstrapLearning() {
  for(const name of ['renderDashboard','renderPlugins','renderStoreFleet','renderTelegramOnboarding']) {
    // Assign through the actual lexical function binding used by the cabinet.
    if(name==='renderDashboard'&&typeof renderDashboard==='function'){const previous=renderDashboard;renderDashboard=function(...args){const result=previous.apply(this,args);learningRefresh();return result;};}
    if(name==='renderPlugins'&&typeof renderPlugins==='function'){const previous=renderPlugins;renderPlugins=function(...args){const result=previous.apply(this,args);learningRefresh();return result;};}
    if(name==='renderStoreFleet'&&typeof renderStoreFleet==='function'){const previous=renderStoreFleet;renderStoreFleet=function(...args){const result=previous.apply(this,args);learningRefresh();return result;};}
    if(name==='renderTelegramOnboarding'&&typeof renderTelegramOnboarding==='function'){const previous=renderTelegramOnboarding;renderTelegramOnboarding=function(...args){const result=previous.apply(this,args);learningRefresh();return result;};}
  }
  if(typeof resetAccountData==='function'){const previous=resetAccountData;resetAccountData=function(...args){learningReset();learningUi.suspended=true;try{return previous.apply(this,args);}finally{learningUi.suspended=false;}};}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)learningRefresh();});
  learningRefresh();
}
bootstrapLearning();
