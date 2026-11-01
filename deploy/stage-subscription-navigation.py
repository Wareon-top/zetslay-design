"""Rename the existing billing view without changing routes or payment logic."""
from pathlib import Path
import re,sys

VERSION='20261015-subscription-navigation'
MODULES=['app.js','billing-section.html','learning.js','knowledge-base.js','plugin-purchase-options.js','profile.js']
FINANCE_VIEW='''          <section class="view finance-page" data-view="finance" aria-labelledby="finance-title" hidden>
            <header class="billing-heading"><div><h1 id="finance-title">Финансы</h1></div></header>
          </section>

'''
FINANCE_NAV='''          <button class="nav-item" type="button" data-view-target="finance"><svg><use href="#i-chart"/></svg><span>Финансы</span></button>'''

def require(value,message):
 if not value:raise ValueError(message+' Файлы не изменены.')

def rename(name,text):
 if name=='app.js':
  old="billing: 'Финансы', security:"
  new="billing: 'Подписка', finance: 'Финансы', security:"
  require((old in text)!=(new in text),'Не подтверждены названия разделов.')
  text=text.replace(old,new,1)
 if name in ['index.html','billing-section.html']:
  text=text.replace('<h1 id="billing-title">Финансы</h1>','<h1 id="billing-title">Подписка</h1>')
  text=text.replace('Баланс магазина, доступ к сервису и тарифы — в одном месте.','Ваш тариф, доступ к сервису и способы оплаты.')
  text=text.replace('aria-label="Финансы подключённого магазина"','aria-label="Баланс подключённого магазина"')
 text=text.replace('«Финансах»','«Подписке»').replace('раздел «Финансы»','раздел «Подписка»')
 if name=='learning.js':text=text.replace('ваш доступ отображается в финансах.','ваш доступ отображается в разделе «Подписка».')
 if name=='profile.js':text=text.replace("${icon('card')} Финансы</button>","${icon('card')} Подписка</button>")
 if name=='index.html':
  old='<button class="nav-item" type="button" data-view-target="billing"><svg><use href="#i-card"/></svg><span>Финансы</span></button>'
  new=old.replace('<span>Финансы</span>','<span>Подписка</span>')
  require(text.count(old)+text.count(new)==1,'Не найден раздел подписки в меню.')
  text=text.replace(old,new,1)
  if 'data-view-target="finance"' not in text:text=text.replace(new,new+'\n'+FINANCE_NAV,1)
  require(text.count('data-view-target="finance"')==1,'Дублируется раздел Финансы в меню.')
  text=text.replace('<strong>Финансы</strong><small>Баланс и операции</small>','<strong>Подписка</strong><small>Тарифы и промокоды</small>')
  text=text.replace('data-view-link="billing">Финансы <svg>','data-view-link="billing">Подробнее <svg>')
  if 'data-view="finance"' not in text:
   text,count=re.subn(r'(?m)^([ \t]*<section\b[^>\n]*data-view="billing"[^>\n]*>)',lambda m:FINANCE_VIEW+m[1],text)
   require(count==1,'Не найден раздел подписки.')
  require(text.count('data-view="finance"')==1 and text.count('id="finance-title"')==1,'Не подтверждён пустой раздел Финансы.')
  for asset in [n for n in MODULES if n.endswith('.js')]:
   text,count=re.subn(r'(src=["\'])'+re.escape(asset)+r'(?:\?[^"\']*)?(["\'])',lambda m:m[1]+asset+'?v='+VERSION+m[2],text)
   require(count==1,'Не найден ресурс '+asset+'.')
 return text

def stage(local,out):
 local,out=Path(local),Path(out);files={}
 for name in ['index.html',*MODULES]:
  source=(local/name).read_text()
  require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)',source,re.M),'Обнаружен конфликт файлов.')
  files[name]=rename(name,source)
 for name,text in files.items():
  p=out/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)

if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (OSError,ValueError) as error:raise SystemExit(str(error))
