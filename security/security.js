/* Public policy check: no credentials, account data, local storage or third-party analytics. */
(() => {
 const output=document.querySelector('[data-policy-status]'),button=document.querySelector('[data-policy-refresh]');
 let revision=0;
 async function check(){
  const current=++revision;button.disabled=true;output.textContent='Проверяем ответ API…';
  try{
   const response=await fetch('https://api.zetslay.pro/api/v1/security/policy',{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(8000)});
   const payload=await response.json();
   if(current!==revision)return;
   const policy=payload?.data,known=policy?.revision==='2026-10-26.1'&&policy.adminProofMaxAgeSeconds===300||policy?.revision==='2026-10-27.1'&&policy.adminProofMaxAgeSeconds===3600&&policy.sensitiveProofMaxAgeSeconds===300;
   if(!response.ok||policy?.component!=='admin-access'||policy.adminMfaRequired!==true||!known)throw Error('unconfirmed');
   output.textContent='API сообщает: политика '+policy.revision+' — для административного доступа обязательна 2FA; подтверждение действует '+(policy.adminProofMaxAgeSeconds===3600?'1 час. Изменение защиты аккаунта требует подтверждения не старше 5 минут.':'5 минут.');
  }catch{
   if(current===revision)output.textContent='Версия политики API сейчас не подтверждена. Это может означать, что обновление ещё не установлено или API недоступен для этой проверки.';
  }finally{if(current===revision)button.disabled=false;}
 }
 button.addEventListener('click',check);check();
})();
