"""Install wallet UI and legal release without replacing local auth, sync or order modules."""
from pathlib import Path
import re,sys,importlib.util,json
VERSION='20261016-platega-wallet'
ASSETS=['app/payments.js','app/payments-admin.js','app/payments.css','app/payments.test.mjs','app/plugin-purchase-options.js','app/plugin-purchase-options.test.mjs','app/service-access-policy.test.mjs','subscription-plans.json','deploy/build-subscription-pricing.py','deploy/build-legal-pages.py']
def require(value,message):
 if not value:raise ValueError(message+' Файлы не изменены.')
def load(path,name):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def stage(local,incoming,out):
 local,incoming,out=map(Path,[local,incoming,out]);files={}
 pricing=load(incoming/'deploy/build-subscription-pricing.py','payment_pricing');legal=load(incoming/'deploy/build-legal-pages.py','payment_legal');data=json.loads((incoming/'subscription-plans.json').read_text());pricing.validate(data)
 docs=json.loads((incoming/'legal/documents.json').read_text());config=json.loads((incoming/'legal/site-config.json').read_text());require(legal.publication(docs,config)==json.loads((incoming/'legal/publication.json').read_text()),'Не совпадает юридическая редакция.')
 for name in ['app/index.html','app/billing-section.html','index.html','app/subscription-access.js']:
  text=(local/name).read_text();require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)',text,re.M),'Конфликт исходных файлов.');files[name]=text
 fresh=(incoming/'app/subscription-access.js').read_text();definition=next(line for line in fresh.splitlines() if line.startswith('function subscriptionPluginAllowed('));source=files['app/subscription-access.js'];source,n=re.subn(r'^function subscriptionPluginAllowed\([^\n]+$',lambda _:definition,source,flags=re.M);require(n==1,'Не подтверждён контроль доступа к плагинам.');files['app/subscription-access.js']=source
 old='<strong>—</strong><p>Счёт для оплаты подписки сервиса.</p><span class="billing-tag"><i></i>Оплата готовится к запуску</span>'
 new='<strong data-service-wallet>—</strong><p>Для подписок и бессрочных лицензий плагинов.</p><span class="billing-tag"><i></i><span data-payments-state>Проверяем способы оплаты</span></span>'
 for name in ['app/index.html','app/billing-section.html']:
  text=files[name];require(text.count(old)+text.count(new)==1,'Не подтверждена карточка баланса.');text=text.replace(old,new,1);files[name]=pricing.replace_section(text,'billing-tariffs',pricing.markup(data,True))
 files['index.html']=pricing.faq(pricing.replace_section(files['index.html'],'tariffs',pricing.markup(data)),data)
 html=files['app/index.html']
 for asset in ['payments.css','payments.js','payments-admin.js']:
  css=asset.endswith('.css');pattern=r'<link\b[^>]*href=["\']'+re.escape(asset)+r'(?:\?[^"\']*)?["\'][^>]*>' if css else r'<script\b[^>]*src=["\']'+re.escape(asset)+r'(?:\?[^"\']*)?["\'][^>]*>\s*</script>'
  matches=re.findall(pattern,html);require(len(matches)<=1,'Дублируется ресурс '+asset+'.');tag=f'<link rel="stylesheet" href="{asset}?v={VERSION}">' if css else f'<script src="{asset}?v={VERSION}" defer></script>';closing='</head>' if css else '</body>'
  require(html.count(closing)==1,'Не подтверждена разметка.');html=re.sub(pattern,lambda _:tag,html) if matches else html.replace(closing,tag+'\n'+closing)
 for asset in ['subscription-access.js','plugin-purchase-options.js']:
  html,n=re.subn(r'(src=["\'])'+re.escape(asset)+r'(?:\?[^"\']*)?(["\'])',lambda m:m[1]+asset+'?v='+VERSION+m[2],html);require(n==1,'Не найден модуль '+asset+'.')
 files['app/index.html']=html
 for name in ASSETS:files[name]=(incoming/name).read_text()
 for p in sorted((incoming/'legal').rglob('*')):
  if p.is_file() and p.suffix in ['.html','.json']:
   name=str(p.relative_to(incoming));prior=local/name
   if '/archive/' in name and prior.exists():require(prior.read_bytes()==p.read_bytes(),'Нельзя перезаписать архив юридической редакции.')
   files[name]=p.read_text()
 for name,text in files.items():p=out/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (OSError,ValueError,AssertionError) as error:raise SystemExit(str(error))
