// Only loaded by the local review server; not linked by any published page.
(()=>{
 const modal=document.querySelector('.auth-modal');if(modal)modal.hidden=true;
 const stack=document.querySelector('.view-stack');
 const notice=document.createElement('p');notice.textContent='Предпросмотр дизайна · данные магазина не подключены';notice.style.cssText='margin:0;padding:10px 24px;border-bottom:1px solid #30363b;background:#25221e;color:#f5c49d;font:11px Inter,sans-serif';document.querySelector('.topbar')?.after(notice);
 function view(name){document.querySelectorAll('[data-view]').forEach(n=>{n.hidden=n.dataset.view!==name;n.classList.toggle('is-active',!n.hidden);});document.querySelectorAll('[data-view-target]').forEach(n=>n.classList.toggle('is-active',n.dataset.viewTarget===name));const label=document.getElementById('current-view-label');if(label)label.textContent=document.querySelector('[data-view-target="'+name+'"]')?.textContent.trim()||name;}
 function sidebar(open){document.body.classList.toggle('sidebar-open',open);document.querySelector('.sidebar')?.classList.toggle('is-open',open);document.querySelector('.sidebar-backdrop')?.classList.toggle('is-open',open);}
 document.addEventListener('click',event=>{const b=event.target.closest('[data-view-target]');if(b){event.preventDefault();view(b.dataset.viewTarget);sidebar(false);}if(event.target.closest('[data-sidebar-open]'))sidebar(true);if(event.target.closest('[data-sidebar-close]'))sidebar(false);});
 view('dashboard');
})();
