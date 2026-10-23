"""Install reseller UI while preserving local cabinet and payment behaviour."""
from pathlib import Path
import re, sys
VERSION='20261023-proxy-store-v1'
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
 if 'data-view-target="proxy-shop"' not in html:
  pattern=r'<button\b[^>]*data-view-target=["\']plugins["\'][^>]*>.*?</button>'
  anchors=list(re.finditer(pattern,html,re.S))
  if len(anchors)!=1:raise ValueError('Не подтверждена навигация кабинета. Файлы не изменены.')
  nav='<button class="nav-item proxy-nav-item" type="button" data-view-target="proxy-shop"><svg aria-hidden="true"><use href="#i-shield"/></svg><span>Прокси</span><small class="proxy-nav-badge">Купить</small></button>\n          '
  html=html[:anchors[0].start()]+nav+html[anchors[0].start():]
 if 'data-view="proxy-shop"' not in html:
  pattern=r'<section\b[^>]*data-view=["\']profile["\'][^>]*>'
  anchors=list(re.finditer(pattern,html))
  if len(anchors)!=1:raise ValueError('Не подтверждено место раздела прокси. Файлы не изменены.')
  page='<section class="view proxy-store-page" data-view="proxy-shop" data-proxy-store aria-labelledby="proxy-store-title" hidden></section>\n          '
  html=html[:anchors[0].start()]+page+html[anchors[0].start():]
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
