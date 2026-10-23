"""Install reseller UI while preserving local cabinet and payment behaviour."""
from pathlib import Path
import re, sys
VERSION='20261023-proxy-modal-v2'
ASSETS=['proxy-shop.js','proxy-shop.css','proxy-shop.test.mjs','managed-proxy-ui.js','managed-proxy-ui.css','managed-proxy-ui.test.mjs']

def stage(local,incoming,out):
 local,incoming,out=Path(local),Path(incoming),Path(out)
 html=(local/'index.html').read_text();payments=(local/'payments.js').read_text();app=(local/'app.js').read_text()
 if html.count('</head>')!=1 or html.count('</body>')!=1 or 'connection-wizard-ui.js' not in html or 'profile.js' not in html or 'payments.js' not in html:
  raise ValueError('Не подтверждена структура кабинета и оплаты. Файлы не изменены.')
 router=re.search(r'const viewTitles = \{.*?\n\};',app,re.S)
 if not router:raise ValueError('Не подтверждена навигация кабинета. Файлы не изменены.')
 if not re.search(r'[\"\']proxy-shop[\"\']\s*:',router[0]):
  app=app[:router.start()]+router[0].replace('const viewTitles = {',"const viewTitles = {\n  'proxy-shop': 'Прокси',",1)+app[router.end():]
 outputs={name:(incoming/name).read_text() for name in ASSETS}
 # Retire the previous sidebar destination; purchases now open from context.
 nav=r'[ \t]*<button\b[^>]*data-view-target=["\']proxy-shop["\'][^>]*>.*?</button>'
 if len(re.findall(nav,html,re.S))>1:raise ValueError('Дубли навигации прокси. Файлы не изменены.')
 html=re.sub(nav,'',html,flags=re.S)
 page=r'[ \t]*<section\b[^>]*data-view=["\']proxy-shop["\'][^>]*>\s*</section>'
 html=re.sub(page,'',html)
 if 'data-proxy-store' in html:raise ValueError('Не подтверждена старая страница прокси. Файлы не изменены.')
 for place,heading,title in [('dashboard','overview-heading','Прокси для вашего магазина'),('guide','kb-heading','Нужен прокси для подключения?')]:
  if f'data-proxy-invite="{place}"' in html:continue
  pattern=rf'<header\b[^>]*class=["\']{heading}["\'][^>]*>.*?</header>'
  anchors=list(re.finditer(pattern,html,re.S))
  if len(anchors)!=1:raise ValueError('Не подтверждено место кнопки покупки. Файлы не изменены.')
  invite=f'<section class="ps-invite" data-proxy-invite="{place}" aria-label="Прокси от ZetSlay"><span class="ps-invite-icon" aria-hidden="true"><svg><use href="#i-shield"/></svg></span><div><span class="ps-eyebrow">ПРОКСИ ОТ ZETSLAY</span><h2>{title}</h2><p>Купите в ZetSlay: оплата с баланса и проверка доступности FunPay перед выдачей.</p></div><button class="button button--primary" type="button" data-proxy-open>Купить прокси <span aria-hidden="true">↗</span></button></section>'
  html=html[:anchors[0].end()]+'\n            '+invite+html[anchors[0].end():]
 for name in ['proxy-shop.js','proxy-shop.css','managed-proxy-ui.js','managed-proxy-ui.css']:
  pattern=rf'<(?:script|link)\b[^>]*(?:src|href)=["\']{re.escape(name)}(?:\?[^"\']*)?["\'][^>]*(?:></script>|>)'
  found=list(re.finditer(pattern,html))
  if len(found)>1:raise ValueError('Дубли подключений. Файлы не изменены.')
  html=re.sub(pattern+r'[ \t]*\r?\n?','',html)
 html=html.replace('</head>',f'<link rel="stylesheet" href="managed-proxy-ui.css?v={VERSION}">\n<link rel="stylesheet" href="proxy-shop.css?v={VERSION}">\n</head>')
 html=html.replace('</body>',f'<script src="managed-proxy-ui.js?v={VERSION}" defer></script>\n<script src="proxy-shop.js?v={VERSION}" defer></script>\n</body>')
 if 'proxy_purchase:' not in payments:
  needle="chargeback:'Возврат / спор'"
  if payments.count(needle)!=1:raise ValueError('Не подтверждена история баланса. Файлы не изменены.')
  payments=payments.replace(needle,needle+",proxy_purchase:'Покупка прокси',proxy_refund:'Возврат за прокси'")
 pattern=r'(<script\b[^>]*src=["\'])payments\.js(?:\?[^"\']*)?(["\'])'
 if len(re.findall(pattern,html))!=1:raise ValueError('Не подтверждено подключение истории оплаты.')
 html=re.sub(pattern,lambda m:m[1]+f'payments.js?v={VERSION}'+m[2],html)
 if re.search(r'^(<<<<<<<|=======|>>>>>>>)',html,re.M):raise ValueError('Конфликт HTML. Файлы не изменены.')
 outputs['payments.js']=payments;outputs['index.html']=html;outputs['app.js']=app
 pattern=r'(<script\b[^>]*src=[\"\'])app\.js(?:\?[^\"\']*)?([\"\'])'
 if len(re.findall(pattern,html))!=1:raise ValueError('Не подтверждено подключение навигации.')
 outputs['index.html']=re.sub(pattern,lambda m:m[1]+f'app.js?v={VERSION}'+m[2],html)
 for name,text in outputs.items():
  path=out/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text)
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (ValueError,OSError) as e:raise SystemExit(str(e))
