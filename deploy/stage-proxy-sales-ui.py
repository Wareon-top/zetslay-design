"""Install reseller UI while preserving local cabinet and payment behaviour."""
from pathlib import Path
import re, sys
VERSION='20261022-steelproxy-sales'
ASSETS=['proxy-shop.js','proxy-shop.css','proxy-shop.test.mjs','managed-proxy-ui.js','managed-proxy-ui.css','managed-proxy-ui.test.mjs']

def stage(local,incoming,out):
 local,incoming,out=Path(local),Path(incoming),Path(out)
 html=(local/'index.html').read_text();payments=(local/'payments.js').read_text()
 if html.count('</head>')!=1 or html.count('</body>')!=1 or 'connection-wizard-ui.js' not in html or 'profile.js' not in html or 'payments.js' not in html:
  raise ValueError('Не подтверждена структура кабинета и оплаты. Файлы не изменены.')
 outputs={name:(incoming/name).read_text() for name in ASSETS}
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
 outputs['payments.js']=payments;outputs['index.html']=html
 for name,text in outputs.items():
  path=out/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text)
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (ValueError,OSError) as e:raise SystemExit(str(e))
