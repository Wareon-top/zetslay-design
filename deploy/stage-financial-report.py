"""Surgical installation of financial reporting, preserving local cabinet modules."""
from pathlib import Path
import re,sys,importlib.util
VERSION='20261015-financial-report'
ASSETS=['finance-model.js','finance-workspace.js','finance-workspace.css','finance-workspace.test.mjs','finance-section.html']
def require(value,message):
 if not value:raise ValueError(message+' Файлы не изменены.')
def stage(local,incoming,out):
 local,incoming,out=map(Path,[local,incoming,out])
 spec=importlib.util.spec_from_file_location('navigation',incoming/'stage-subscription-navigation.py');nav=importlib.util.module_from_spec(spec);spec.loader.exec_module(nav)
 files={}
 for name in ['index.html',*nav.MODULES]:
  source=(local/name).read_text();require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)',source,re.M),'Обнаружен конфликт файлов.');files[name]=nav.rename(name,source)
 html=files['index.html'];start=list(re.finditer(r'^[ \t]*<section\b[^>\n]*data-view="finance"[^>\n]*>',html,re.M));end=list(re.finditer(r'^[ \t]*<section\b[^>\n]*data-view="billing"[^>\n]*>',html,re.M))
 require(len(start)==len(end)==1 and start[0].start()<end[0].start(),'Не найдены границы раздела Финансы.')
 html=html[:start[0].start()]+(incoming/'finance-section.html').read_text()+'\n'+html[end[0].start():]
 source=(local/'subscription-access.js').read_text();fresh=(incoming/'subscription-access.js').read_text()
 config=next(line for line in fresh.splitlines() if line.startswith(' finance:{title:'))
 preview=next(line for line in fresh.splitlines() if line.startswith(" if(view==='finance')return"))
 if ' finance:{title:' not in source:
  require(source.count('const subscriptionViews={')==1,'Не подтверждены правила доступа.');source=source.replace('const subscriptionViews={','const subscriptionViews={\n'+config,1)
 if "if(view==='finance')return" not in source:
  require(source.count(" if(view==='dashboard')return")==1,'Не подтверждён предпросмотр.');source=source.replace(" if(view==='dashboard')return",preview+"\n if(view==='dashboard')return",1)
 old="['dashboard','orders','messages','lots']";new="['dashboard','orders','messages','lots','finance']"
 require(old in source or new in source,'Не подтверждён контроль доступа.');source=source.replace(old,new,1);files['subscription-access.js']=source
 for asset in ['finance-workspace.css','finance-model.js','finance-workspace.js']:
  attr='href' if asset.endswith('.css') else 'src';pattern=r'<link\b[^>]*href=["\']'+re.escape(asset)+r'(?:\?[^"\']*)?["\'][^>]*>' if attr=='href' else r'<script\b[^>]*src=["\']'+re.escape(asset)+r'(?:\?[^"\']*)?["\'][^>]*>\s*</script>'
  matches=re.findall(pattern,html);require(len(matches)<=1,'Дублируется ресурс '+asset+'.')
  tag=f'<link rel="stylesheet" href="{asset}?v={VERSION}">' if attr=='href' else f'<script src="{asset}?v={VERSION}" defer></script>'
  closing='</head>' if attr=='href' else '</body>';require(html.count(closing)==1,'Не подтверждена разметка.');html=re.sub(pattern,lambda _:tag,html) if matches else html.replace(closing,tag+'\n'+closing)
 html,count=re.subn(r'(src=["\'])subscription-access\.js(?:\?[^"\']*)?(["\'])',lambda m:m[1]+'subscription-access.js?v='+VERSION+m[2],html);require(count==1,'Не найден модуль доступа.')
 html=html.replace('data-view-link="billing">Подробнее <svg>','data-view-link="finance">Финансы <svg>');files['index.html']=html
 for name in ASSETS:files[name]=(incoming/name).read_text()
 for name,text in files.items():p=out/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (OSError,ValueError) as error:raise SystemExit(str(error))
