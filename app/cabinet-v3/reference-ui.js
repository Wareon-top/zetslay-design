/* Claude handoff structure bound to the real host DOM. No mock adapter, permissions or writes.
 * Nodes with data-* controller contracts are moved, never replaced by inert copies. */
(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)],E=v=>escapeHtml(v??''),I=n=>ZSIcons.svg(n);
  const specs=window.ZSCabinetDesign, F=window.ZSCabinetFidelity={refresh};
  const A=n=>'cabinet-v3/assets/quality-v2/'+n+'.webp', image=(n,c='')=>`<img class="${c}" src="${A(n)}" alt="" loading="lazy" decoding="async">`;
  const planNames={start:'Старт',growth:'Рост',pro:'Профи',maximum:'Максимум',trial_3d:'Пробный период'};
  const alias={ 'store-tools':'automation','proxy-shop':'proxy' },openGroups=new Set(),tabsByPlugin=new Map();
  let modal=null,rendering=false;const painted=new WeakMap();
  function html(node,value){if(node&&painted.get(node)!==value){painted.set(node,value);node.innerHTML=value;}}
  const R=()=>window.ZetSlayCabinet,plan=()=>typeof profileState!=='undefined'&&profileState.data?.plan||authState.workspace?.plan||{};
  const date=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}):'';
  function put(parent,node,before=null){if(node&&node.parentNode!==parent)parent.insertBefore(node,before);}
  function make(tag,cls,html=''){const n=document.createElement(tag);n.className=cls;n.innerHTML=html;return n;}
  function show(node,yes){if(node&&node.hidden===yes)node.hidden=!yes;}
  function label(node,text){if(node&&node.textContent!==text)node.textContent=text;}
  function decorateCover(view){
    const key=view.dataset.view,cover=$(':scope > .zs-cover',view);if(!cover)return;
    const d=specs[alias[key]||key]||{},copy=$('.cover__copy',cover),isProfile=key==='profile';
    const title=isProfile?($('.cover__copy h1',cover)?.textContent||'Профиль'):(d.title||$('.cover__copy h1',cover)?.textContent||'');
    label($('h1',copy),title);label($('p',copy),isProfile?'Профиль продавца':d.eyebrow||'ZetSlay · '+(d.group||'Аккаунт'));
    let lead=$('.cover__lead',copy);
    if(d.lead&&!lead){lead=make('span','cover__lead');copy.append(lead);}if(lead&&!isProfile)label(lead,d.lead||'');
    let meta=$('.cover__chips',copy);if(!meta){meta=make('span','cover__chips');copy.append(meta);}
    const current=typeof selectedStore==='function'?selectedStore():null,p=plan();let chips=[];
    if(['dashboard','orders','messages','lots','analytics','finance','store-tools','connection'].includes(key))chips.push([current?.status==='connected_read_only'?'Магазин подключён':'Магазин не подключён',current?.status==='connected_read_only'?'check':'plug']);
    if(p.active===true)chips.push([(planNames[p.id]||'Активный доступ')+(date(p.expiresAt)?' · до '+date(p.expiresAt):''),'card']);
    const next=chips.map(([t,i])=>`<span class="cover-chip">${I(i)}${E(t)}</span>`).join('');html(meta,next);
    let actions=$('.cover__actions',copy);if(!actions){actions=make('span','cover__actions');copy.append(actions);}
    const actionSelectors={dashboard:'[data-overview-refresh],[data-overview-connect]',orders:'[data-orders-refresh],[data-orders-connect]',messages:'[data-messages-refresh],[data-messages-connect]',lots:'[data-lots-refresh]',billing:'[data-billing-open="topup"],[data-billing-open="promo"]',finance:'[data-finance-refresh]'};
    if(actionSelectors[key])for(const b of $$(actionSelectors[key],view)){b.classList.add('btn','btn--glass','btn--sm');put(actions,b);}
    /* Old per-view headings repeat the banner title. Their live controls move into the banner; the rest is hidden. */
    for(const old of $$(':scope > header:not(.zs-cover)',view)){
      if(!/-heading\b/.test(old.className))continue;
      for(const ctl of $$('button,a',old)){if([...ctl.attributes].some(x=>x.name.startsWith('data-'))){ctl.classList.add('btn','btn--glass','btn--sm');put(actions,ctl);}}
      old.classList.add('zsf-old-heading');
    }
    const art=$('.cover__emblem img',cover);
    if(art&&d.emblem){const name=d.emblem.split('/').pop().replace('.webp','');const src=A(name);if(art.getAttribute('src')!==src)art.setAttribute('src',src);}
  }
  function navigation(){
    const sidebar=$('.sidebar'),nav=$('.sidebar-nav');if(!sidebar||!nav)return;
    sidebar.classList.add('nav');$('.sidebar__top')?.classList.add('nav__head');
    const switcher=$('.workspace-switcher');if(switcher){switcher.classList.add('store-switch');$('.workspace-switcher__avatar',switcher)?.classList.add('store-switch__mark');}
    if(!nav.dataset.reference){
      nav.dataset.reference='true';
      const items=new Map($$('[data-view-target]',nav).map(n=>[n.dataset.viewTarget,n]));
      const groups=[['Магазин',['dashboard','events','orders','messages','lots']],['Автоматизация',['store-tools','plugins','proxy-shop']],['Отчёты',['analytics','finance']],['Аккаунт',['billing','profile','guide','support']]];
      const oldAdmin=$('[data-zs-admin-group]',nav);nav.replaceChildren();
      for(const [title,ids]of groups){
        const group=make('div','zs-nav-group nav__group',`<span class="nav__group-label">${title}</span>`);
        for(const id of ids){
          const item=items.get(id);if(!item)continue;const row=make('div','nav__row');row.append(item);group.append(row);
          let children=[];
          if(id==='store-tools')children=[['automation/scenarios','Сценарии'],['automation/warehouse','Склад и выдача'],['automation/templates','Шаблоны ответов'],['automation/commands','Команды покупателей'],['automation/notifications','Уведомления'],['automation/bot','Доступ к боту']];
          if(id==='billing')children=[['billing/plans','Тарифы'],['billing/balance','Баланс и платежи'],['billing/licenses','Лицензии']];
          if(id==='profile')children=[['profile','Мой профиль'],['connection','Аккаунт FunPay'],['telegram','Telegram-бот'],['security','Безопасность'],['documents','Документы']];
          if(children.length){
            const expand=make('button','nav__expand',I('chevron'));expand.type='button';expand.dataset.zsfExpand=id;expand.setAttribute('aria-controls','zs-sub-'+id);expand.setAttribute('aria-label','Подразделы: '+item.textContent.trim());row.append(expand);
            const sub=make('div','nav__sub');sub.id='zs-sub-'+id;sub.dataset.zsfSub=id;
            for(const [route,name]of children){const retained=items.get(route);if(retained&&route!==id){retained.classList.add('nav__subitem');sub.append(retained);}else{const a=make('a','nav__subitem',E(name));a.href='#'+route;a.dataset.zsfRoute=route;sub.append(a);}}
            group.append(sub);
          }
        }nav.append(group);
      }
      if(oldAdmin)nav.append(oldAdmin);
      const foot=$('.sidebar__bottom');if(foot){
        const access=make('button','nav__access',I('card')+'<span class="nav__label"><b data-zsf-plan-name></b><small data-zsf-plan-until></small></span>');access.type='button';access.dataset.zsfRoute='billing/plans';foot.prepend(access);
        const blog=$('[data-blog-link]');if(blog){blog.classList.add('nav__blog');put(foot,blog);}
      }
    }
    const view=R()?.route||state.view,sub=R()?.sub||'',parent=['connection','telegram','security','documents'].includes(view)?'profile':view;
    for(const n of $$('[data-zsf-sub]')){const id=n.dataset.zsfSub,on=id===parent||openGroups.has(id);show(n,on);$(`[data-zsf-expand="${id}"]`)?.setAttribute('aria-expanded',String(on));}
    for(const n of $$('[data-zsf-route]',nav))n.setAttribute('aria-current',n.dataset.zsfRoute===(view==='store-tools'?'automation/'+(sub||'scenarios'):view+(sub?'/'+sub:''))?'page':'false');
    const p=plan();document.body.dataset.zsfPaid=String(p.active===true&&p.id!=='trial_3d');
    label($('[data-zsf-plan-name]'),planNames[p.id]||'Доступ к сервису');label($('[data-zsf-plan-until]'),p.active?date(p.expiresAt)?'Доступ до '+date(p.expiresAt):'Доступ активен':'Выбрать тариф');
    const d=specs[alias[view]||view],tab=d?.tabs?.find(t=>t[0]===sub);
    const pluginId=String(view).startsWith('plugins/')?view.slice(8):'',pluginName=pluginId&&typeof state!=='undefined'?(state.plugins||[]).find(x=>x.id===pluginId)?.name:'';
    const crumb=pluginId?'Автоматизация / Плагины'+(pluginName?' / '+pluginName:''):view==='plugins'?'Автоматизация / Плагины':(d?d.group+' / '+d.title:view==='profile'?'Аккаунт / Профиль':'Аккаунт / '+(viewTitles[view]||view))+(tab?' / '+tab[1]:'');
    label($('#current-view-label'),crumb);
    const avatar=$('.topbar [data-auth-open]');if(avatar&&authState.user){avatar.removeAttribute('data-auth-open');avatar.dataset.zsfRoute='profile';}
  }
  function dashboard(){
    const root=$('[data-view="dashboard"]'),grid=$('.overview-grid',root);if(!root||!grid)return;
    if(!grid.dataset.reference){
      grid.dataset.reference='true';const stats=make('div','cab-stats zsf-overview-stats');grid.before(stats);
      for(const card of $$('.overview-stat',grid)){card.classList.add('cab-stat');$('.overview-stat__label',card)?.classList.add('cab-stat__head');$('.overview-icon',card)?.classList.add('cab-stat__icon');stats.append(card);}
      grid.classList.add('cab-grid','cab-grid--dash');
      for(const name of ['revenue','structure','orders','finance']){const card=$('.overview-'+name,grid);if(card){card.classList.add('cab-panel');if(['revenue','orders'].includes(name))card.classList.add('span-2');grid.append(card);}}
      const additional=make('details','zsf-additional cab-panel','<summary>Дополнительные показатели и инструменты</summary>');grid.after(additional);
      for(const selector of ['.overview-refunds','.overview-actions','.video-guide-banner','.ps-invite']){const node=$(selector,root);if(node)additional.append(node);}
      const scope=$('.overview-scope',root);if(scope)scope.classList.add('caption');
    }
    $('.overview-period-toolbar',root)?.classList.add('cab-toolbar');$('.overview-periods',root)?.classList.add('chips');
    for(const b of $$('[data-overview-period]',root))b.classList.add('chip');
    for(const head of $$('.overview-card__heading',root))head.classList.add('cab-panel__head');
    const extra=$('.zsf-additional',root);if(extra)for(const sel of ['.learning-checklist','.ws-resources'])put(extra,$(sel,root));
    const tasks=$('[data-ws-next-actions],.ws-next-actions',root);if(tasks)tasks.classList.add('cab-tasks');
    for(const task of $$('.ws-task',root))task.classList.add('cab-task');
  }
  function rarity(includes){return '<ul class="rar-row" aria-label="Редкости в тарифе">'+[['common','◇'],['advanced','◆'],['ultra','✦'],['legendary','✧']].map(([r,s])=>`<li class="rar rar--${r}${includes.includes(r)?' is-on':''}"><span aria-hidden="true">${s}</span></li>`).join('')+'</ul>';}
  function billing(){
    const root=$('[data-view="billing"]'),pricing=$('[data-billing-pricing]',root),P=window.ZetSlayPricing;if(!root||!pricing||!P)return;
    if(!root.dataset.referenceBilling){
      root.dataset.referenceBilling='true';const tabs=make('nav','sec-tabs','<div class="tabs">'+[['plans','Тарифы'],['balance','Баланс и платежи'],['licenses','Лицензии']].map(([id,t])=>`<a class="tab" href="#billing/${id}" data-zsf-route="billing/${id}">${t}</a>`).join('')+'</div>');tabs.setAttribute('aria-label','Подписка и баланс');$('.zs-cover',root).after(tabs);
      const access=make('section','acc-card',`<img class="acc-card__sky" src="cabinet-v3/assets/img/cover-sunset.webp" alt=""><div class="acc-card__copy"><span class="acc-card__eyebrow">Ваш доступ</span><h2 data-zsf-access-name></h2><div data-zsf-rarities></div><p data-zsf-access-until></p><div data-zsf-access-meter></div></div>${image('plan-'+(['start','growth','pro','maximum'].includes(plan().id)?plan().id:'start'),'acc-card__art')}`);access.dataset.zsfBillPart='plans';tabs.after(access);
      pricing.dataset.zsfBillPart='plans';
      for(const n of $$('.billing-summary,.billing-store,[data-payments-history]',root))n.dataset.zsfBillPart='balance';
      const licenses=make('section','cab-panel zsf-licenses','<header class="cab-panel__head"><div><h2>Лицензии плагинов</h2><p>Отдельно купленные бессрочные лицензии сохраняются в аккаунте</p></div></header><div data-zsf-license-list></div>');licenses.dataset.zsfBillPart='licenses';pricing.after(licenses);
    }
    let tab=R()?.sub||'plans';if(!['plans','balance','licenses'].includes(tab))tab='plans';
    for(const n of $$('[data-zsf-bill-part]',root))show(n,n.dataset.zsfBillPart===tab);
    for(const n of $$('.sec-tabs a',root))n.setAttribute('aria-current',n.dataset.zsfRoute==='billing/'+tab?'page':'false');
    const current=plan();label($('[data-zsf-access-name]',root),planNames[current.id]||'Выберите тариф');label($('[data-zsf-access-until]',root),current.active?date(current.expiresAt)?'Действует до '+date(current.expiresAt):'Доступ активен':'Синхронизация и операции доступны при активном доступе');
    const includes=P.plans.find(p=>p.id===current.id)?.includes||[],rar=$('[data-zsf-rarities]',root),markup=rarity(includes);html(rar,markup);
    const meter=$('[data-zsf-access-meter]',root),end=Date.parse(current.expiresAt),start=Date.parse(current.activatedAt);
    const days=Number.isFinite(end)?Math.max(0,Math.ceil((end-Date.now())/86400000)):null,total=Number.isFinite(start)&&end>start?Math.ceil((end-start)/86400000):null;
    const meterText=total!==null?`<div class="acc-meter" role="meter" aria-label="Осталось дней доступа" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${Math.min(days,total)}"><i style="width:${Math.min(100,days/total*100)}%"></i></div><div class="acc-meter__legend"><b>Осталось ${days} дней</b><span>из ${total}</span></div>`:'';html(meter,meterText);
    const plans=$$('[data-pricing-plan]',pricing),grid=plans[0]?.parentElement;
    const groupSize={};let totalPlugins=0;for(const g of P.pluginGroups){groupSize[g.rarity]=g.plugins.length;totalPlugins+=g.plugins.length;}
    const countOf=pl=>pl.includes.reduce((a,k)=>a+(groupSize[k]||0),0),plu=n=>n%10===1&&n%100!==11?'плагин':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'плагина':'плагинов';
    const kinds={1:'Обычные',2:'Обычные и продвинутые',3:'Все, кроме легендарных',4:'Все четыре редкости'};
    if(grid&&!grid.closest('.pstage')){
      grid.classList.remove('tar-grid');grid.classList.add('pc2-grid');
      const head=$('.landing-pricing__heading',pricing),trial=$('[data-pricing-trial]',pricing),stage=make('section','pstage',`<img class="pstage__sky" src="cabinet-v3/assets/img/cover-sunset.webp" alt="" loading="lazy" decoding="async">`);
      grid.before(stage);if(head){head.classList.add('pstage__head');stage.append(head);}stage.append(grid);if(trial)stage.append(trial);
    }
    for(const [n,card] of plans.entries()){
      const p=P.plans.find(p=>p.id===card.dataset.pricingPlan);if(!p)continue;
      if(!card.dataset.reference){
        card.dataset.reference='true';const price=$('[data-pricing-price]',card),original=$('[data-pricing-original]',card),note=$('[data-pricing-note]',card),button=$('[data-billing-plan]',card),badge=$('[data-billing-current]',card);
        const cnt=countOf(p),next=P.plans[P.plans.indexOf(p)+1];
        const more=next?`В «${E(next.name)}» — ещё ${countOf(next)-cnt} ${plu(countOf(next)-cnt)}`:`Все ${totalPlugins} плагинов каталога ZetSlay`;
        card.className='pricing-card pc2'+(p.featured?' pc2--featured':'');
        card.innerHTML=`${image('plan-'+p.id,'pc2__art')}<h3 id="billing-pricing-${p.id}-title">${E(p.name)}${p.featured?` <span class="pc2__badge">${E(p.featured)}</span>`:''}</h3><div class="pc2__price" data-zsf-price><span>в месяц</span></div><div data-zsf-plan-note></div><div class="pc2__plugins"><p><strong>${cnt} ${plu(cnt)}</strong> в подписке</p><small>${kinds[p.includes.length]||''}</small><p class="pc2__more">${more}</p></div><p class="pc2__label">Что входит:</p><ul class="pc2__feat">${p.features.map(t=>`<li>${I('check')}<span>${E(t)}</span></li>`).join('')}</ul><div data-zsf-plan-button></div>`;
        const value=$('[data-zsf-price]',card);if(price){price.classList.add('num');value.prepend(price);}if(original){original.classList.add('num');price?price.after(original):value.prepend(original);}
        if(note){note.className='pc2__note num';$('[data-zsf-plan-note]',card).replaceWith(note);}else $('[data-zsf-plan-note]',card).remove();
        if(button){button.className='pricing-card__cta pc2__cta';$('[data-zsf-plan-button]',card).replaceWith(button);}else $('[data-zsf-plan-button]',card).remove();
        if(badge){badge.classList.add('zsf-current-plan');$('h3',card).append(badge);}
      }
      card.classList.toggle('is-current',p.id===current.id);
    }
    const picker=$('[data-pricing-periods]',pricing);if(picker){picker.classList.add('zs-periods');}
    const platform=$('[data-pricing-platform]',pricing);if(platform){platform.classList.add('cab-panel');label($('h3',platform),'Во всех тарифах');$('ul',platform)?.classList.add('pf-grid');for(const li of $$('li',platform))li.classList.add('pf');}
    const shell=$('.landing-pricing__shell',pricing),notes=$('.landing-pricing__notes',pricing);if(notes&&!notes.closest('details')){const detail=make('details','cab-panel zsf-terms','<summary><strong>Условия подписки</strong><span>Срок доступа, оплата, ограничения и возвраты</span></summary>');notes.before(detail);detail.append(notes);}
    const comparisonSource=$('[data-pricing-comparison]',pricing);if(comparisonSource&&!$('[data-zsf-rarity-matrix]',pricing)){
      const panel=make('section','cab-panel','<header class="cab-panel__head"><div><h2>Плагины по редкостям</h2><p>Какие опубликованные плагины ZetSlay входят в подписку</p></div></header><div class="cab-table-wrap" data-zsf-rarity-matrix></div>');comparisonSource.before(panel);
      html($('[data-zsf-rarity-matrix]',panel),'<table class="rar-matrix"><thead><tr><th>Редкость и плагины</th>'+P.plans.map(p=>'<th>'+E(p.name)+'</th>').join('')+'</tr></thead><tbody>'+P.pluginGroups.map(g=>'<tr><th><strong>'+E(g.label||g.title||g.name||g.rarity)+'</strong><small>'+g.plugins.map(p=>E(p.name)).join(' · ')+'</small></th>'+P.plans.map(p=>'<td>'+ (p.includes.includes(g.id||g.rarity)?I('check'):'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table>');
    }
    if(shell){const matrix=$('[data-zsf-rarity-matrix]',pricing)?.closest('section');if(matrix&&platform&&matrix.nextElementSibling!==platform)matrix.after(platform);}

    const comparison=$('[data-pricing-comparison]',pricing);if(comparison)comparison.classList.add('cab-panel');
    const owned=authState.workspace?.pluginLicenses,list=$('[data-zsf-license-list]',root);const licenseHtml=Array.isArray(owned)?owned.length?'<div class="cab-list">'+owned.map(id=>`<a class="cab-row" href="#plugins/${E(id)}">${image(ZSCabinetModel.art[id]||'cat-tools','row__art')}<span>${E(state.plugins.find(p=>p.id===id)?.name||id)}</span>${I('chevron')}</a>`).join('')+'</div>':'<p class="caption">Отдельно купленных лицензий нет. Плагины подписки доступны в каталоге.</p>':'<p class="caption">Лицензии будут показаны после получения данных аккаунта.</p>';html(list,licenseHtml);
  }
  function panels(){
    const selectors=['.orders-page-panel','.inventory-panel','.fin-panel','.sup-panel','.ws-panel','.tools-panel','.mp-panel','.profile-panel','.plugin-page-panel','.as-panel','.kb-panel','.fin-chart','.fin-stat','.orders-page-stat'];
    for(const node of $$(selectors.join(','))){node.classList.add(/(?:fin-stat|orders-page-stat)/.test(node.className)?'cab-stat':'cab-panel');}
    for(const node of $$('.orders-page-stats,.fin-stats,.ws-stats'))node.classList.add('cab-stats');
    for(const node of $$('.orders-page-toolbar,.orders-page-period-panel,.inventory-tools,.fin-period-panel,.tools-toolbar,.ws-toolbar'))node.classList.add('cab-toolbar');
    for(const node of $$('.orders-page-table-wrap,.inventory-table-wrap,.fin-table-wrap,.tools-table-wrap'))node.classList.add('cab-table-wrap');
    for(const h of $$('.orders-page-panel__heading,.fin-panel-head,.ws-panel-head,.tools-panel-heading'))h.classList.add('cab-panel__head');
  }
  function refresh(){
    if(rendering)return;rendering=true;
    try{document.body.classList.add('zs-reference');auth();if(!authState.user)return;navigation();for(const view of $$('[data-view]'))decorateCover(view);dashboard();billing();panels();profile();catalogue();product();syncModal();}
    finally{rendering=false;}
  }
  function profile(){
    const body=$('[data-zs-profile]');if(!body)return;
    body.classList.add('profile');const aside=$('.zs-profile-aside',body),main=$('.zs-profile-main',body);aside.classList.add('profile__aside');
    if(!aside.dataset.reference){
      aside.dataset.reference='true';const rows=$$('.zs-account-row',aside),get=t=>rows.find(n=>n.textContent.includes(t));
      const groups=[['Данные аккаунта','Telegram-бот'],['Магазин FunPay','Подписка и баланс'],['Прокси','Безопасность','Поддержка']];aside.replaceChildren();
      const kinds={'Данные аккаунта':'account','Telegram-бот':'telegram','Магазин FunPay':'connection','Подписка и баланс':'subscription','Прокси':'proxy-shop','Безопасность':'security','Поддержка':'support'};
      for(const items of groups){const group=make('div','group zs-account-group');for(const title of items){const row=get(title);if(!row)continue;row.classList.add('row');row.dataset.zsfOpen=kinds[title];$('img',row)?.classList.add('row__art');$('span',row)?.classList.add('row__copy');$('svg:last-child',row)?.classList.add('row__chev');group.append(row);}aside.append(group);}
      const account=$('[data-zsf-open="account"] small',aside);label(account,'Имя и подпись в кабинете');
    }
    const store=$('.zs-store-card',main);
    if(store&&!store.dataset.reference){
      store.dataset.reference='true';const button=$('[data-profile-connect]',store),name=$('.profile-store strong',store)?.textContent||'Магазин FunPay',status=$('.profile-status',store)?.textContent||'Не подключён',facts=$('.profile-facts',store);
      store.classList.add('card','store-card');store.innerHTML=`<div class="store-card__head">${image('funpay-store','store-card__art')}<div class="store-card__titles"><h2>Магазин FunPay</h2><p>${E(name)}</p></div><span class="status">${E(status)}</span></div><p class="store-card__lead">${typeof selectedStore==='function'&&selectedStore()?'Управляйте подключением и проверяйте состояние магазина.':'Подключите магазин, чтобы заказы, сообщения и плагины работали вместе.'}</p><div data-zsf-store-facts></div><div class="store-card__foot"><span class="meta">${I('shield')}Доступы вводятся в защищённом мастере</span></div>`;
      if(facts){facts.classList.add('facts');$('[data-zsf-store-facts]',store).replaceWith(facts);}if(button){button.className='btn btn--primary';button.dataset.zsfOpen='connection';$('.store-card__foot',store).append(button);}
    }
    const plugins=$('[data-zs-profile-plugins]',body);if(plugins){plugins.classList.add('profile__plugins');$('.zs-section-heading',plugins)?.classList.add('section-head');label($('.zs-section-heading h2',plugins),'Мои плагины');}
    const oldPlan=$$('.profile-panel',main).find(n=>$('h2',n)?.textContent==='Доступ и тариф');
    if(oldPlan){
      const signout=$('[data-auth-logout]',oldPlan);if(signout){signout.classList.add('zsf-profile-signout');put(aside,signout);}
      const p=plan();oldPlan.className='card plan-card zsf-profile-plan';oldPlan.innerHTML=image('subscription')+`<div class="plan-card__copy"><h2>${E(planNames[p.id]?'Подписка '+planNames[p.id]:'Подписка ZetSlay')}</h2><p>${E(p.active?date(p.expiresAt)?'Активна до '+date(p.expiresAt):'Доступ активен':'Выберите подходящий тариф')}</p></div><button class="btn btn--secondary" type="button" data-zsf-open="subscription">Подробнее</button>`;
    }
  }
  function catalogue(){
    const root=$('[data-view="plugins"]');if(!root)return;
    for(const group of $$('.zs-catalog-group',root)){
      group.classList.add('cgroup');$('.zs-catalog-group-head',group)?.classList.add('cgroup__head');$('.zs-catalog-tiles',group)?.classList.add('cgroup__grid');
    }
    for(const card of $$('.zs-plugin-tile',root)){
      if(card.dataset.reference)continue;card.dataset.reference='true';card.classList.add('pcard');
      const bg=make('span','pcard__bg');bg.setAttribute('aria-hidden','true');card.prepend(bg);
      const cover=$('.plugin-card__cover',card),img=$('img',cover||card);if(img){img.classList.add('pcard__icon');card.prepend(img);}
      const body=$('.plugin-card__body',card);body?.classList.add('pcard__body');$('h3,h2',card)?.classList.add('pcard__name');$('.plugin-card__body>p',card)?.classList.add('pcard__desc');
      const footer=$('.plugin-card__bottom',card);footer?.classList.add('pcard__foot');$('.plugin-card__price',card)?.classList.add('pcard__price');
    }
  }
  function product(){
    const root=$('[data-plugin-page]'),hero=$('[data-zs-product]',root||document);if(!root||!hero)return;
    if(!hero.dataset.reference){
      hero.dataset.reference='true';hero.classList.add('pp-stage');const card=make('div','pp-card');
      const art=$('.zs-product-art',hero),summary=$('.zs-product-summary',hero);if(art){art.classList.add('pp-media');art.innerHTML='<div class="pp-gal slide">'+art.innerHTML+'</div>';$('.slide img',art)?.classList.add('slide__obj');card.append(art);}if(summary){summary.classList.add('pp-info');card.append(summary);}hero.append(card);
    }
    const sections=$$('.plugin-page-main > section',root),nav=$('.zs-product-tabs',root);if(!nav)return;
    nav.classList.add('tabs');nav.setAttribute('role','tablist');const id=R()?.route||'';let selected=tabsByPlugin.get(id)||sections[0]?.id;if(!sections.some(n=>n.id===selected))selected=sections[0]?.id;
    for(const button of $$('button',nav)){const on=button.dataset.zsScroll===selected;button.classList.add('tab');button.dataset.zsfProductTab=button.dataset.zsScroll;button.setAttribute('role','tab');button.setAttribute('aria-selected',String(on));button.tabIndex=on?0:-1;}
    for(const section of sections){section.setAttribute('role','tabpanel');show(section,section.id===selected);}
  }
  function auth(){
    const box=$('.auth-modal');if(!box||box.dataset.reference)return;box.dataset.reference='true';box.classList.add('lg-card');
    $('.auth-content',box)?.classList.add('lg-main');$('.auth-intro',box)?.classList.add('lg-sub');
    const art=make('div','lg-art',image('zetslay-z'));art.setAttribute('aria-hidden','true');box.prepend(art);
    $('.auth-form',box)?.classList.add('lg-panel');
  }
  const detailKinds={account:['Данные аккаунта','Имя, аватарка и карточка автора','account'],telegram:['Telegram-бот','Уведомления и управление магазином','telegram-bot'],connection:['Аккаунт FunPay','Подключение и проверка магазина','funpay-store'],subscription:['Подписка','Ваш доступ к ZetSlay','subscription'],'proxy-shop':['Прокси','Маршрут подключения магазина','proxy-router'],security:['Безопасность','Вход, сессии и защита аккаунта','account'],support:['Поддержка','Обращения и ответы','funpay-link']};
  function moveToModal(node){if(!node)return;const marker=document.createComment('ZetSlay detail source');node.before(marker);modal.moved.push({node,marker});modal.body.append(node);node.classList.add('zsf-modal-source');if(node.matches('[data-view]')){node.hidden=false;node.classList.add('is-active');}}
  function openModal(kind,opener){
    if(!authState.user)return;const def=detailKinds[kind];if(!def)return;
    if(modal&&!closeModal())return;
    const dialog=make('dialog','sheet zsf-detail');dialog.setAttribute('aria-labelledby','zs-detail-title');dialog.dataset.art=kind==='telegram'?'large':'default';
    dialog.innerHTML=`<div class="sheet__art" aria-hidden="true"><div class="art" style='--art-src:url("${new URL(A(def[2]),document.baseURI).href}")'>${image(def[2])}<span class="art__glint"></span></div><span class="art__shadow"></span></div><button class="sheet__close icon-btn" type="button" data-zsf-close aria-label="Закрыть">${I('close')}</button><header class="sheet__head"><h2 id="zs-detail-title">${def[0]}</h2><p>${def[1]}</p></header><div class="sheet__body" data-zsf-body></div><footer class="sheet__foot"><span data-zsf-draft-note></span><button class="btn btn--quiet" type="button" data-zsf-close>Закрыть</button>${kind==='account'?'<button class="btn btn--primary" type="button" data-zsf-save>Сохранить изменения</button>':''}</footer>`;
    document.body.append(dialog);modal={kind,dialog,opener,body:$('[data-zsf-body]',dialog),moved:[],version:typeof profileState!=='undefined'?profileState.data?.profile?.version:null};
    if(kind==='account'){const source=$('[data-zs-profile-editor]');if(source)for(const node of [...source.children].filter(n=>n.tagName!=='SUMMARY'))moveToModal(node);}
    else if(kind==='subscription'){
      const p=plan();modal.body.innerHTML=`<dl class="kv"><div><dt>Тариф</dt><dd>${E(planNames[p.id]||'Не выбран')}</dd></div><div><dt>Доступ</dt><dd>${E(p.active?'Активен':'Не активен')}</dd></div>${date(p.expiresAt)?`<div><dt>Окончание</dt><dd>${E(date(p.expiresAt))}</dd></div>`:''}</dl><p class="caption">Бессрочные лицензии сохраняются в аккаунте. Для работы магазина нужен активный доступ к сервису.</p><button class="btn btn--primary" type="button" data-zsf-route="billing/plans">Тарифы и баланс ${I('arrow')}</button>`;
    }else if(['connection','telegram','security','proxy-shop'].includes(kind))moveToModal($(`[data-view="${kind}"]`));
    else if(kind==='support')modal.body.innerHTML='<p class="caption">Список обращений и создание нового доступны в разделе поддержки.</p><button class="btn btn--primary" type="button" data-zsf-route="support">Открыть поддержку</button>';
    dialog.addEventListener('cancel',event=>{event.preventDefault();closeModal();});dialog.addEventListener('click',event=>{if(event.target===dialog)closeModal();});
    dialog.showModal();document.body.classList.add('zsf-detail-open');syncModal();
  }
  function syncModal(){
    if(!modal)return;
    if(modal.kind==='account'){
      const fresh=$('[data-profile] .profile-editor');
      if(fresh&&!modal.body.contains(fresh)){for(const old of $$('.profile-editor',modal.body))old.remove();moveToModal(fresh);}
      mirrorSave();
    }
    for(const panel of $$('.zsf-modal-source .profile-panel',modal.dialog))panel.classList.add('block');
  }
  /* The host form owns the save lifecycle (busy, failure, retry). Mirror its submit button so a failed
     save that only resets the button in profile.js `finally` also releases the dialog button. */
  function mirrorSave(){
    if(!modal||modal.kind!=='account')return;
    const button=$('[data-zsf-save]',modal.dialog),host=$('[data-profile-form] [type="submit"]',modal.body);if(!button)return;
    const apply=()=>{const busy=host?host.disabled&&profileState.saving===true:profileState.saving===true;button.disabled=busy||!host;button.textContent=busy?'Сохраняем…':'Сохранить изменения';button.setAttribute('aria-busy',String(busy));};
    if(modal.saveObserver&&modal.saveHost!==host){modal.saveObserver.disconnect();modal.saveObserver=null;}
    if(host&&!modal.saveObserver){modal.saveHost=host;modal.saveObserver=new MutationObserver(apply);modal.saveObserver.observe(host,{attributes:true,attributeFilter:['disabled'],childList:true,characterData:true,subtree:true});}
    apply();
  }
  function closeModal(discard=false,force=false){
    if(!modal)return true;if(!force&&modal.kind==='account'&&profileState.saving)return false;
    if(!force&&modal.kind==='account'&&profileState.dirty&&!discard){html($('[data-zsf-draft-note]',modal.dialog),'Есть несохранённые изменения <button type="button" class="btn btn--quiet" data-zsf-discard>Закрыть без сохранения</button>');return false;}
    const current=modal;modal=null;current.saveObserver?.disconnect();
    if(discard&&typeof profileState!=='undefined'){profileState.dirty=false;profileState.avatarDraft=null;}
    for(const {node,marker}of current.moved){node.classList.remove('zsf-modal-source');if(marker.isConnected){marker.replaceWith(node);}else if(node.isConnected&&node.matches('.profile-editor'))$('[data-zs-profile-editor]')?.append(node);if(node.matches('[data-view]')){node.hidden=true;node.classList.remove('is-active');}}
    current.dialog.close();current.dialog.remove();document.body.classList.remove('zsf-detail-open');if(current.opener?.isConnected)current.opener.focus();
    if(discard&&typeof renderProfile==='function')renderProfile(true);return true;
  }
  F.closeModal=closeModal;F.reset=()=>closeModal(false,true);
  document.addEventListener('click',event=>{
    const target=event.target.closest('button,a');if(!target)return;
    const open=target.dataset.zsfOpen;if(open){event.preventDefault();event.stopImmediatePropagation();openModal(open,target);return;}
    if(target.hasAttribute('data-zsf-close')||target.hasAttribute('data-zsf-discard')){event.preventDefault();event.stopImmediatePropagation();closeModal(target.hasAttribute('data-zsf-discard'));return;}
    if(target.hasAttribute('data-zsf-save')){event.preventDefault();event.stopImmediatePropagation();$('[data-profile-form]',modal?.body||document)?.requestSubmit();syncModal();return;}
    const expand=target.closest('[data-zsf-expand]');if(expand){event.preventDefault();event.stopImmediatePropagation();const id=expand.dataset.zsfExpand;openGroups.has(id)?openGroups.delete(id):openGroups.add(id);navigation();return;}
    const tab=target.dataset.zsfProductTab;if(tab){event.preventDefault();event.stopImmediatePropagation();tabsByPlugin.set(R()?.route||'',tab);product();return;}
    const route=target.dataset.zsfRoute;if(route){event.preventDefault();event.stopImmediatePropagation();if(!closeModal())return;setView(route);return;}
    if(target.hasAttribute('data-zs-editor')){event.preventDefault();event.stopImmediatePropagation();openModal('account',target);}
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);else refresh();
})();
