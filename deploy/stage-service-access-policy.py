from pathlib import Path
import re,sys,importlib.util,json
VERSION='20261015-service-access'
MODULES=['plugin-purchase-options.js','plugin-purchase-options.css','subscription-access.js','knowledge-base.js','learning.js','billing.js']
APP_EDITS=[("PLAN_REQUIRED: 'Для этого действия нужен активный тариф.'", "PLAN_REQUIRED: 'Нужен активный тариф или пробный период, даже для плагинов, купленных навсегда.'"), ("  if (body) body.innerHTML = pages[connectionStep] || pages.at(-1);", "  if (body) body.innerHTML = (pages[connectionStep] || pages.at(-1)) + '<p class=\"connect-helper\" data-connection-subscription-note>Для подключения, синхронизации и работы плагинов нужен активный тариф или пробный период. Бессрочная покупка плагина не заменяет подписку.</p>';")]
def require(value,message):
 if not value:raise ValueError(message+' Файлы не изменены.')
def load(path,name):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def stage(local,incoming,out):
 local,incoming,out=map(Path,[local,incoming,out]);pricing=load(incoming/'deploy/build-subscription-pricing.py','pricing');legal=load(incoming/'deploy/build-legal-pages.py','legal')
 data=json.loads((incoming/'subscription-plans.json').read_text());pricing.validate(data)
 docs=json.loads((incoming/'legal/documents.json').read_text());config=json.loads((incoming/'legal/site-config.json').read_text());publication=json.loads((incoming/'legal/publication.json').read_text());require(legal.publication(docs,config)==publication,'Не совпадает юридическая редакция.')
 files={}
 source=(local/'app/app.js').read_text();html=(local/'app/index.html').read_text();landing=(local/'index.html').read_text()
 for text in [source,html,landing]:require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)',text,re.M),'Конфликт исходных файлов.')
 for old,new in APP_EDITS:
  if new not in source:require(source.count(old)==1,'Не подтверждён мастер подключения.');source=source.replace(old,new,1)
  require(source.count(new)==1,'Неоднозначная интеграция мастера.')
 files['app/app.js']=source
 landing=pricing.cache(pricing.faq(pricing.replace_section(landing,'tariffs',pricing.markup(data)),data),['landing-pricing.js'])
 html=pricing.cache(pricing.replace_section(html,'billing-tariffs',pricing.markup(data,True)),['billing-pricing.js','billing.js'])
 for asset in ['app.js',*MODULES]:
  tag='link' if asset.endswith('.css') else 'script';attr='href' if tag=='link' else 'src'
  pattern=rf'({attr}=["\']){re.escape(asset)}(?:\?[^"\']*)?(["\'])'
  html,count=re.subn(pattern,lambda m:m[1]+asset+'?v='+VERSION+m[2],html);require(count==1,'Не найден ресурс '+asset+'.')
 files['index.html']=landing;files['app/index.html']=html
 fixture=local/'app/billing-section.html';fixture=fixture if fixture.is_file() else incoming/'app/billing-section.html';files['app/billing-section.html']=pricing.replace_section(fixture.read_text(),'billing-tariffs',pricing.markup(data,True))
 for path in ['subscription-plans.json','landing-pricing.js','app/billing-pricing.js',*['app/'+m for m in MODULES]]:files[path]=(incoming/path).read_text()
 for p in sorted((incoming/'legal').rglob('*')):
  if p.is_file() and p.suffix in ['.json','.html']:files[str(p.relative_to(incoming))]=p.read_text()
 # Generate and validate every output before creating the output directory.
 for path,text in files.items():
  p=out/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (OSError,ValueError,AssertionError) as e:raise SystemExit(str(e))
