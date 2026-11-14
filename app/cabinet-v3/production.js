/* Production presentation bridge for the 2026-11-13 handoff.
 * Never loads a prototype adapter, grants access, synthesizes business data or sends a write.
 * Existing host controllers own forms, authentication, async lifetimes and operations.
 */
(function () {
  'use strict';
  if(typeof state==='undefined'||typeof authState==='undefined'||typeof setView!=='function')return;
  const M=window.ZSCabinetModel, E=escapeHtml, $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const base='cabinet-v3/assets/img/', hq={"account":"account.webp","telegram-bot":"telegram-bot.webp","funpay-store":"funpay-store.webp","subscription":"subscription.webp","proxy-router":"proxy-router.webp","cat-currency":"cat-currency.webp","cat-rent":"cat-rent.webp","cat-tools":"cat-tools.webp","cat-reviews":"cat-reviews.webp","plg-stars":"plg-stars.webp","plg-robux":"plg-robux.webp","plg-rent":"plg-rent.webp","plg-steam":"plg-steam.webp","plg-prices":"plg-prices.webp","plg-cloner":"plg-cloner.webp","plg-pause":"plg-pause.webp","plg-priority":"plg-priority.webp","plg-ai":"plg-ai.webp","plg-remind":"plg-remind.webp","funpay-link":"funpay-link.webp","zetslay-z":"zetslay-z.webp","plan-growth":"plan-growth.webp","plan-maximum":"plan-maximum.webp","plan-pro":"plan-pro.webp","plan-start":"plan-start.webp","plugin-stars":"plg-stars.webp","plugin-rent":"plg-rent.webp","plg-roblox-lzt":"plg-roblox-lzt.webp","plg-tiktok-lzt":"plg-tiktok-lzt.webp","plg-ticket-pilot":"plg-ticket-pilot.webp","plg-confirm-reminder":"plg-confirm-reminder.webp","plg-review-bonus":"plg-review-bonus.webp"};
  const artSource=name=>Object.hasOwn(hq,name)?'cabinet-v3/assets/quality-v2/'+hq[name]:base+name+'.webp';
  const svg=n=>window.ZSIcons.svg(n), art=(name,cls='')=>`<img class="${cls}" src="${artSource(name)}" alt="" loading="lazy" decoding="async">`;
  const virtual=new Set(['connection','telegram','security','documents','proxy-shop']);
  const R=window.ZetSlayCabinet={release:'20261114-hq2',route:'dashboard',sub:'',pending:false};
  let activeRoute='dashboard', menuOpener=null, scheduled=false;
  const session=()=>`${authState.user?.id||''}:${sessionGeneration}`;
  const titleOf=v=>M.groups.flatMap(g=>g.items).find(it=>it[0]===v)?.[1]||viewTitles[v]||'Кабинет';
  const button=(label,attr,kind='ghost')=>`<button type="button" class="button button--${kind}" ${attr}>${label}</button>`;
  function hook(name,after) {
    const before=window[name]; if(typeof before!=='function')return;
    window[name]=function(...args){const result=before.apply(this,args);after(...args);return result;};
  }
  function cover(title,lead='',identity='') {
    return `<header class="cover cover--section zs-cover"><img class="cover__sky" src="${base}cover-sunset.webp" alt="" fetchpriority="high"><div class="cover__identity">${identity}<div class="cover__copy"><p>Личный кабинет ZetSlay</p><h1>${E(title)}</h1>${lead?`<span class="cover__lead">${E(lead)}</span>`:''}</div></div><div class="cover__emblem" aria-hidden="true">${art('zetslay-z')}</div></header>`;
  }
  function ensureViews() {
    const stack=$('.view-stack');
    for(const id of virtual)if(!$(`[data-view="${id}"]`)){
      const el=document.createElement('section');el.className='view zs-account-view';el.dataset.view=id;el.hidden=true;
      el.setAttribute('aria-label',titleOf(id));el.innerHTML=cover(titleOf(id))+'<div data-zs-account-content></div>';stack.append(el);
    }
  }
  function nav() {
    const node=$('.sidebar-nav');if(!node||node.dataset.zsReady)return;
    const retained=new Map($$('[data-view-target]',node).map(n=>[n.dataset.viewTarget,n]));
    const admin=$('[data-admin-nav]',node), blog=$('[data-blog-link]',node);
    node.replaceChildren();node.classList.add('nav__list');node.dataset.zsReady='true';
    for(const g of M.groups){
      const section=document.createElement('div');section.className='zs-nav-group';
      const heading=document.createElement('span');heading.className='nav__group-label';heading.textContent=g.title;section.append(heading);
      for(const [id,label,symbol] of g.items){
        let item=retained.get(id);
        if(!item){item=document.createElement('button');item.type='button';item.dataset.viewTarget=id;}
        // Preserve live unread counters maintained by existing controllers.
        const counters=$$('b,[data-ws-unread]',item);
        item.className='nav-item nav__item';item.title=label;item.innerHTML=svg(symbol)+`<span class="nav__label">${label}</span>`;
        for(const c of counters)item.append(c);section.append(item);
      }
      node.append(section);
    }
    if(admin){const group=document.createElement('div');group.className='zs-nav-group';group.dataset.zsAdminGroup='';group.append(admin);node.append(group);}
    if(blog)node.append(blog);
    $('.workspace-switcher')?.setAttribute('data-zs-route','connection');
    $('.workspace-switcher')?.setAttribute('role','button');$('.workspace-switcher')?.setAttribute('tabindex','0');
    const collapse=document.createElement('button');collapse.type='button';collapse.className='zs-nav-collapse';collapse.dataset.zsCollapse='';
    collapse.innerHTML=svg('chevron')+'<span>Свернуть меню</span>';$('.sidebar__bottom').append(collapse);
    try{document.body.classList.toggle('zs-nav-collapsed',localStorage.getItem('zs-cabinet-nav-collapsed')==='1');}catch{}
    syncNav();
  }
  function syncNav() {
    const selected=activeRoute.startsWith('plugins/')?'plugins':activeRoute;
    $$('[data-view-target]', $('.sidebar')).forEach(n=>{
      const on=n.dataset.viewTarget===selected;n.classList.toggle('is-active',on);
      if(on)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');
    });
    const c=$('[data-zs-collapse]');if(c){const collapsed=document.body.classList.contains('zs-nav-collapsed');c.setAttribute('aria-pressed',String(collapsed));c.setAttribute('aria-label',collapsed?'Развернуть меню':'Свернуть меню');}
    const admin=$('[data-admin-nav]'), group=$('[data-zs-admin-group]');if(group)group.hidden=!admin||admin.hidden;
    const label=$('#current-view-label');if(label)label.textContent=titleOf(selected);
    $$('[data-nav-orders],[data-nav-messages],.sidebar-nav b').forEach(n=>{if(n.textContent.trim()==='0')n.hidden=true;});
    $('.mobile-menu')?.setAttribute('aria-expanded',String($('.sidebar').classList.contains('is-open')));
  }
  function banners() {
    for(const el of $$('[data-view]')){
      if(['profile','plugin','author',...virtual].includes(el.dataset.view))continue;
      if(!$(':scope > .zs-cover',el))el.insertAdjacentHTML('afterbegin',cover(titleOf(el.dataset.view)));
    }
  }
  function row(image,title,sub,attrs) {
    return `<button type="button" class="zs-account-row" ${attrs}>${art(image)}<span><strong>${E(title)}</strong><small>${E(sub||'')}</small></span>${svg('chevron')}</button>`;
  }
  function profile() {
    const root=$('[data-profile]');if(!root||!authState.user||!$('.profile-grid',root))return;
    if($('[data-zs-profile]',root)) { distribute();return; }
    const grid=$('.profile-grid',root), sections=$$(':scope > section',grid);
    const account=sections[0], store=sections[1], bot=sections[2], plan=sections[3], editor=$('.profile-editor',root);
    const card=typeof profileState!=='undefined'?profileState.data?.profile:null;
    const identity=typeof profileState!=='undefined'?profileState.data?.identity:null;
    const name=card?.displayName||authState.user.email||'Мой профиль';
    const reload=$('[data-profile-reload]',root);
    $('.profile-hero',root)?.remove();$('.profile-heading',root)?.remove();
    root.insertAdjacentHTML('afterbegin',cover(name,identity?.createdAt?'В ZetSlay с '+new Date(identity.createdAt).toLocaleDateString('ru-RU'):'Ваш аккаунт и подключения',profilePortrait(card||{displayName:name},true)));
    if(reload){reload.classList.add('zs-cover-refresh');$('.zs-cover',root).append(reload);}
    const body=document.createElement('div');body.className='profile-grid zs-profile';body.dataset.zsProfile='';
    const aside=document.createElement('aside');aside.className='zs-profile-aside';aside.setAttribute('aria-label','Аккаунт и настройки');
    aside.innerHTML=`<div class="zs-account-group">${row('account','Данные аккаунта',identity?.email||'Вход через Telegram','data-zs-editor')}${row('telegram-bot','Telegram-бот',state.onboarding?.telegram?.linked?'Привязан':'Настроить подключение','data-zs-route="telegram"')}${row('funpay-store','Магазин FunPay',typeof selectedStore==='function'?selectedStore()?.displayName||'Подключить магазин':'Подключить магазин','data-zs-route="connection"')}</div><div class="zs-account-group">${row('subscription','Подписка и баланс','Тариф и история платежей','data-zs-route="billing"')}${row('proxy-router','Прокси','Подключение и продление','data-zs-route="proxy-shop"')}</div><div class="zs-account-group">${row('account','Безопасность','Сессии, 2FA и ключи доступа','data-zs-route="security"')}${row('funpay-link','Поддержка','Обращения и ответы','data-zs-route="support"')}</div>`;
    const main=document.createElement('div');main.className='zs-profile-main';
    if(store){store.classList.add('zs-store-card');main.append(store);}
    const plugs=document.createElement('section');plugs.className='zs-profile-plugins';plugs.dataset.zsProfilePlugins='';main.append(plugs);
    if(plan){
      const names={start:'Старт',growth:'Рост',pro:'Профи',maximum:'Максимум',trial_3d:'Пробный период'};
      for(const value of $$('dd',plan))if(names[value.textContent])value.textContent=names[value.textContent];
      main.append(plan);
    }
    const editing=document.createElement('details');editing.className='zs-profile-edit';editing.dataset.zsProfileEditor='';editing.innerHTML='<summary>Данные аккаунта и карточка автора</summary>';
    if(account)editing.append(account);if(editor)editing.append(editor);main.append(editing);
    if(bot){bot.dataset.zsBotPanel='';main.append(bot);}
    body.append(aside,main);grid.replaceWith(body);drawProfilePlugins();distribute();
  }
  function drawProfilePlugins() {
    const host=$('[data-zs-profile-plugins]');if(!host)return;
    const installed=state.plugins.filter(p=>p.installed&&p.published!==false);
    host.innerHTML='<div class="zs-section-heading"><h2>Плагины</h2><a href="#plugins">Все плагины '+svg('chevron')+'</a></div>'+(installed.length?'<div class="zs-account-group">'+installed.map(p=>`<a class="zs-account-row" href="#plugins/${E(p.id)}">${art(M.art[p.id]||'cat-tools')}<span><strong>${E(p.name)}</strong><small>${E(M.stateOf(p).label)}</small></span>${svg('chevron')}</a>`).join('')+'</div>':`<div class="zs-plugin-empty">${art('plg-stars')}<h3>Плагинов пока нет</h3><p>Выберите инструменты для вашего магазина</p><a class="button button--primary" href="#plugins">Выбрать плагин</a></div>`);
  }
  function distribute() {
    const security=$('[data-account-security-panel]'), legal=$('[data-legal-cabinet]'), bot=$('[data-zs-bot-panel]');
    for(const [name,node] of [['security',security],['documents',legal],['telegram',bot]]){
      const target=$(`[data-view="${name}"] [data-zs-account-content]`);
      if(node&&target&&node.parentNode!==target)target.replaceChildren(node);
    }
    const proxyView=$('[data-view="proxy-shop"]');
    if(proxyView){
      if(!$('[data-zs-proxy-buy]',proxyView)){
        const actions=document.createElement('div');actions.className='zs-proxy-actions';
        actions.innerHTML=button('Выбрать и купить прокси','data-zs-proxy-buy','primary');
        $('[data-zs-account-content]',proxyView)?.prepend(actions);
      }
      let destination=$('[data-zs-proxy-account]',proxyView);
      if(!destination){destination=document.createElement('div');destination.dataset.zsProxyAccount='';proxyView.append(destination);}
      const fresh=$('[data-profile] [data-managed-proxy]');
      if(fresh)destination.replaceChildren(fresh);
      $$('[data-profile] .mp-profile-link').forEach(n=>n.remove());
    }
    const connection=$('[data-view="connection"] [data-zs-account-content]');
    if(connection){
      const current=typeof selectedStore==='function'?selectedStore():null;
      const status=current?.status==='connected_read_only'?'Подключение подтверждено':current?'Подключение требует проверки':'Магазин не подключён';
      const signature=JSON.stringify([current?.id,current?.displayName,current?.status,state.onboarding?.state]);
      if(connection.dataset.signature!==signature){connection.dataset.signature=signature;connection.innerHTML=`<section class="zs-account-group zs-connection-card"><div class="zs-connection-art">${art('funpay-link')}</div><h2>${E(current?.displayName||'Подключите аккаунт FunPay')}</h2><p>${E(status)}</p><p class="zs-muted">Ключ магазина, прокси и проверка связи доступны в мастере подключения. Результат проверки приходит с сервера.</p>${button(current?'Управлять подключением':'Подключить FunPay','data-profile-connect','primary')}${current?button('Прокси','data-zs-route="proxy-shop"'):''}</section>`;}
    }
    for(const name of ['security','documents','telegram']){
      const target=$(`[data-view="${name}"] [data-zs-account-content]`);
      if(target&&!target.children.length)target.innerHTML=`<div class="zs-loading" role="status">${E(authState.user?'Загружаем данные аккаунта…':'Войдите в аккаунт')}</div>`;
    }
  }
  function catalogue() {
    const target=$('#plugin-grid');if(!target||!authState.user)return;
    $('.zs-catalog-error')?.remove();
    if(typeof pluginPageState!=='undefined'&&pluginPageState.error){
      const notice=document.createElement('div');notice.className='zs-catalog-error';notice.setAttribute('role','alert');
      notice.innerHTML='<strong>Не удалось обновить каталог</strong><p>'+E(pluginPageState.error)+'</p>'+button('Повторить загрузку','data-plugin-page-retry');target.before(notice);
      // A stale catalogue may contain obsolete prices or permissions. Hide it until reloaded.
      target.replaceChildren();return;
    }
    // Existing renderer owns loading, access, action locks and purchase/install controls.
    const cards=$$('.plugin-card',target);if(!cards.length)return;
    const grouped=new Map(M.categories.map(c=>[c.id,[]]));
    for(const c of cards){
      const id=$('[data-plugin-id]',c)?.dataset.pluginId||$('[data-plugin-page-link]',c)?.getAttribute('href')?.split('/').pop();
      const p=state.plugins.find(p=>p.id===id);if(!p)continue;
      c.classList.add('zs-plugin-tile');c.dataset.zsPlugin=id;
      const img=$('.plugin-card__cover img',c);
      if(M.art[id]&&img){img.src=artSource(M.art[id]);img.removeAttribute('data-plugin-cover');}
      // Read-only card has one clear destination; transactional controls remain on the product page.
      const action=$('.plugin-card__navigation button',c);if(action)action.hidden=true;
      $('.plugin-permissions',c)?.remove();
      c.querySelector('[data-cover-plugin]')?.setAttribute('aria-label','Изменить обложку плагина '+p.name);
      const price=$('.plugin-card__price',c);if(price){$('small',price)?.remove();}
      const status=$('.plugin-card__status',c);if(status)status.textContent=M.stateOf(p).label;
      grouped.get(M.category(id).id).push(c);
    }
    if(![...grouped.values()].some(a=>a.length))return;
    const fragment=document.createDocumentFragment();
    for(const cat of M.categories){
      const items=grouped.get(cat.id);if(!items.length)continue;
      const section=document.createElement('section');section.className='zs-catalog-group';
      section.innerHTML=`<header class="zs-catalog-group-head"><div><h2>${cat.title}</h2><p>${items.length} ${items.length===1?'плагин':'в каталоге'}</p></div>${art(cat.art)}</header><div class="zs-catalog-tiles"></div>`;
      const tiles=$('.zs-catalog-tiles',section);for(const c of items)tiles.append(c);fragment.append(section);
    }
    target.replaceChildren(fragment);drawProfilePlugins();
  }
  function pluginPage() {
    const root=$('[data-plugin-page]');if(!root||$('[data-zs-product]',root))return;
    const route=typeof parsePluginPageRoute==='function'?parsePluginPageRoute(location.hash.slice(1)):null;
    const p=state.plugins.find(p=>p.id===route?.id), heading=$('.plugin-page-heading',root), layout=$('.plugin-page-layout',root);
    if(!p||!heading||!layout)return;
    const action=$('.plugin-page-action',root);if(!action)return;
    const hero=document.createElement('section');hero.className='zs-product';hero.dataset.zsProduct='';
    const picture=document.createElement('div');picture.className='zs-product-art';
    picture.innerHTML=M.art[p.id]?art(M.art[p.id]):`<img src="${E(pluginCoverSource(p))}" alt="${E(p.name)}">`;
    const summary=document.createElement('div');summary.className='zs-product-summary';summary.append(heading,action);hero.append(picture,summary);
    root.insertBefore(hero,layout);
    // Settings/queue panels and all original data-* controls retain their DOM and listeners.
    const panels=$$('.plugin-page-main > section',root);
    if(panels.length){
      const links=document.createElement('nav');links.className='zs-product-tabs';links.setAttribute('aria-label','Разделы плагина');
      for(const [i,panel] of panels.entries()){
        if(!panel.id)panel.id='zs-plugin-panel-'+i;
        const a=document.createElement('button');a.type='button';a.dataset.zsScroll=panel.id;
        a.textContent=$('h2,h3',panel)?.textContent||'Настройки';links.append(a);
      }hero.after(links);
    }
  }
  function billing() {
    $$('[data-plan],[data-pricing-plan],.plan-card,.tariff-card,.pricing-card').forEach(node=>{
      const id=node.dataset.plan||node.dataset.planId||node.dataset.pricingPlan;
      if(!['start','growth','pro','maximum'].includes(id)||$('[data-zs-plan-art]',node))return;
      const img=document.createElement('img');img.src=`cabinet-v3/assets/plans/plan-${id}.png`;img.alt='';img.loading='lazy';img.dataset.zsPlanArt='';node.prepend(img);
    });
  }
  function refresh() {
    scheduled=false;if(!authState.user)return;
    banners();profile();distribute();pluginPage();billing();syncNav();
  }
  function schedule() {if(!scheduled){scheduled=true;requestAnimationFrame(refresh);}}
  function installRouting() {
    const host=setView;
    setView=function(value,updateHash=true){
      const r=M.route(value), oldScope=session();activeRoute=r.view;R.route=r.view;R.sub=r.sub;
      let result;
      if(virtual.has(r.view)){
        // Load private profile through the original controller, then show the dedicated surface.
        result=host('profile',false);
        $$('[data-view]').forEach(el=>{const on=el.dataset.view===r.view;el.hidden=!on;el.classList.toggle('is-active',on);});
        if(updateHash)history.replaceState(null,'','#'+r.view);
        document.title=titleOf(r.view)+' — ZetSlay';
        distribute();
      }else{
        result=host(r.view,updateHash);
        if(r.view==='store-tools'&&r.sub){
          if(r.sub==='scenarios')$('[data-basic-automation]')?.scrollIntoView({block:'start'});
          else $(`[data-tools-tab="${CSS.escape(r.sub)}"]`)?.click();
        }
      }
      if(session()===oldScope){syncNav();schedule();}return result;
    };
  }
  function mobile(open) {
    const side=$('.sidebar'),workspace=$('.workspace');if(!side||!workspace)return;
    if(open){menuOpener=document.activeElement;workspace.inert=true;side.setAttribute('role','dialog');side.setAttribute('aria-modal','true');setTimeout(()=>$('.sidebar__close',side)?.focus(),0);}
    else {workspace.inert=false;side.removeAttribute('role');side.removeAttribute('aria-modal');if(menuOpener?.isConnected)menuOpener.focus();menuOpener=null;}
    $('.mobile-menu')?.setAttribute('aria-expanded',String(open));
  }
  function boot() {
    document.body.classList.add('zs','zs-production');document.body.classList.remove('no-review');
    document.documentElement.dataset.zsRelease=R.release;
    ensureViews();nav();installRouting();
    const hostSidebar=setSidebar;setSidebar=function(open){const result=hostSidebar(open);mobile(open);return result;};
    hook('renderProfile',()=>{profile();schedule();});
    hook('renderPlugins',()=>{catalogue();schedule();});
    hook('renderPluginPage',()=>{pluginPage();schedule();});
    hook('renderBilling',billing);hook('renderAuthState',schedule);hook('renderAccountSecurity',distribute);hook('renderLegalRequests',distribute);
    hook('pluginCatalogFailed',catalogue);
    const hostReset=resetAccountData;resetAccountData=function(...args){
      for(const id of virtual){const target=$(`[data-view="${id}"] [data-zs-account-content]`);if(target)target.replaceChildren();}
      $$('[data-zs-profile-plugins]').forEach(n=>n.replaceChildren());return hostReset.apply(this,args);
    };
    // Decorate asynchronous host renders without repainting inputs or replacing live forms.
    const stack=$('.view-stack');const observer=new MutationObserver(records=>{if(records.some(r=>r.type==='childList'&&r.addedNodes.length))schedule();});
    observer.observe(stack,{childList:true,subtree:true});
    renderPlugins();renderProfile();setView(location.hash.slice(1)||'dashboard',false);
    document.addEventListener('click',e=>{
      if(e.target.closest('[data-zs-proxy-buy]')){if(typeof proxyShopOpen==='function')void proxyShopOpen();return;}
      const route=e.target.closest('[data-zs-route]');if(route){e.preventDefault();setView(route.dataset.zsRoute);return;}
      const collapse=e.target.closest('[data-zs-collapse]');if(collapse){document.body.classList.toggle('zs-nav-collapsed');try{localStorage.setItem('zs-cabinet-nav-collapsed',document.body.classList.contains('zs-nav-collapsed')?'1':'0');}catch{}syncNav();return;}
      if(e.target.closest('[data-zs-editor]')){const d=$('[data-zs-profile-editor]');if(d){d.open=true;d.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});$('input',d)?.focus({preventScroll:true});}}
      const scroll=e.target.closest('[data-zs-scroll]');if(scroll)document.getElementById(scroll.dataset.zsScroll)?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    });
    document.addEventListener('keydown',e=>{
      if(e.target.matches('.workspace-switcher')&&['Enter',' '].includes(e.key)){e.preventDefault();setView('connection');}
      if(!$('.sidebar.is-open'))return;
      if(e.key==='Escape'){e.preventDefault();setSidebar(false);}
      if(e.key==='Tab'){
        const focusable=$$('button:not([disabled]),a[href],[tabindex="0"]',$('.sidebar')).filter(n=>!n.hidden&&n.getClientRects().length);
        const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    });
    window.addEventListener('beforeunload',e=>{
      if(typeof profileState!=='undefined'&&profileState.dirty){e.preventDefault();e.returnValue='';}
    });
    matchMedia('(min-width: 1200px)').addEventListener('change',e=>{if(e.matches)setSidebar(false);});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
