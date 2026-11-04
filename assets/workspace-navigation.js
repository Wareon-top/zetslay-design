/* Presentation only: a mobile teaching navigation and a quieter cabinet overview. No account or API access. */
(()=>{
 const demo=document.querySelector('[data-public-demo]');
 const paths={dashboard:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',orders:'M5 7h14l1 14H4L5 7ZM9 7V5a3 3 0 0 1 6 0v2',diagnostics:'m12 3 10 18H2L12 3ZM12 9v5M12 17h.01',messages:'M4 4h16v13H9l-5 4V4ZM8 9h8M8 13h5',lots:'m3 7 9-4 9 4-9 5-9-5ZM3 7v10l9 4 9-4V7M12 12v9',finance:'M4 21V10M10 21V4M16 21v-7M2 21h20',automation:'m13 2-9 12h7l-1 8 10-12h-7l1-8',connection:'M8 3v4M16 3v4M6 7h12v5a6 6 0 0 1-12 0V7ZM12 18v4'};
 const glyph=name=>'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="'+paths[name]+'"/></svg>';
 if(demo){
  const rail=demo.querySelector('.preview-sidebar'),main=demo.querySelector('.preview-main'),top=demo.querySelector('.preview-topbar'),nav=rail.querySelector('nav');
  for(const button of nav.querySelectorAll('[data-preview-view]')){const key=button.dataset.previewView;if(paths[key])button.insertAdjacentHTML('afterbegin',glyph(key));}
  for(const [key,label] of [['dashboard','Рабочее пространство'],['lots','Управление'],['connection','Начало работы']]){const anchor=nav.querySelector('[data-preview-view="'+key+'"]');if(anchor){const tag=document.createElement('span');tag.className='preview-nav-label';tag.textContent=label;anchor.before(tag);}}
  rail.id='preview-navigation';
  const opener=document.createElement('button');opener.type='button';opener.className='preview-menu-toggle';opener.setAttribute('aria-label','Открыть меню');opener.setAttribute('aria-controls',rail.id);opener.setAttribute('aria-expanded','false');opener.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';top.prepend(opener);
  const closer=document.createElement('button');closer.type='button';closer.className='preview-menu-close';closer.setAttribute('aria-label','Закрыть меню');closer.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m6 6 12 12M18 6 6 18"/></svg>';rail.prepend(closer);
  const backdrop=document.createElement('button');backdrop.type='button';backdrop.className='preview-menu-backdrop';backdrop.tabIndex=-1;backdrop.setAttribute('aria-label','Закрыть меню');demo.prepend(backdrop);
  const label=top.querySelector('.preview-label');if(label){label.className='preview-topbar-context';label.innerHTML=glyph('connection')+'<span>Магазин FunPay<small>Знакомство с ZetSlay</small></span>';}
  const notice=demo.querySelector('.preview-disclosure');if(notice){notice.classList.add('preview-demo-notice');top.after(notice);}
  const media=matchMedia('(max-width:900px)');let open=false;
  function setOpen(value,restore=true){open=Boolean(value&&media.matches);document.body.classList.toggle('preview-menu-is-open',open);opener.setAttribute('aria-expanded',String(open));rail.inert=media.matches&&!open;main.inert=open;if(open)closer.focus();else if(restore&&media.matches)opener.focus();}
  opener.addEventListener('click',()=>setOpen(!open));closer.addEventListener('click',()=>setOpen(false));backdrop.addEventListener('click',()=>setOpen(false));
  nav.addEventListener('click',event=>{if(event.target.closest('[data-preview-view],a'))setOpen(false);});
  document.addEventListener('keydown',event=>{if(!open)return;if(event.key==='Escape'){event.preventDefault();setOpen(false);return;}if(event.key==='Tab'){const items=[...rail.querySelectorAll('button,a[href],summary')].filter(n=>!n.disabled&&n.getClientRects().length),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
  media.addEventListener('change',()=>setOpen(false,false));setOpen(false,false);
 }
 // Promotions remain available after the working overview, in DOM and keyboard order.
 const overview=document.querySelector('[data-overview]');
 if(overview){for(const node of overview.querySelectorAll(':scope > .video-guide-banner,:scope > .ps-invite'))overview.append(node);}
 for(const wrap of document.querySelectorAll('.app-shell .fin-table-wrap')){if(!wrap.hasAttribute('tabindex'))wrap.tabIndex=0;if(!wrap.hasAttribute('aria-label'))wrap.setAttribute('aria-label','Таблица финансового отчёта. Прокрутите для просмотра всех столбцов.');wrap.setAttribute('role','region');}
})();
