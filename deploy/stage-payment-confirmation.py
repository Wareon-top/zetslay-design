"""Install committed-operation tickets without touching unrelated cabinet modules or legal releases."""
from pathlib import Path
import re,sys
VERSION='20261016-confirmation-ticket'
ASSETS=['payment-confirmation.js','payment-confirmation.css','payment-confirmation.test.mjs','payments.js','payments.test.mjs']
def require(v,message):
 if not v:raise ValueError(message+' Файлы не изменены.')
def stage(local,incoming,out):
 local,incoming,out=map(Path,[local,incoming,out]);html=(local/'index.html').read_text();module=(local/'payments.js').read_text()
 for text in [html,module]:require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)',text,re.M),'Конфликт исходных файлов.')
 require('async function paymentsPurchaseApplied(' in module and "'/api/v1/payments/purchase'" in module,'Не установлен текущий модуль оплаты.')
 files={name:(incoming/name).read_text() for name in ASSETS}
 # This module must execute before payments.js so initial server reads are observed.
 pattern=r'<script\b[^>]*src=["\']payment-confirmation\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>'
 require(len(re.findall(pattern,html))<=1,'Дублируется модуль подтверждения.');html=re.sub(pattern+r'[ \t]*\r?\n?','',html)
 payment=r'<script\b[^>]*src=["\']payments\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>'
 require(len(re.findall(payment,html))==1,'Не найден единственный модуль оплаты.')
 html=re.sub(payment,f'<script src="payment-confirmation.js?v={VERSION}" defer></script>\n<script src="payments.js?v={VERSION}" defer></script>',html)
 css=r'<link\b[^>]*href=["\']payment-confirmation\.css(?:\?[^"\']*)?["\'][^>]*>'
 require(len(re.findall(css,html))<=1,'Дублируются стили подтверждения.')
 tag=f'<link rel="stylesheet" href="payment-confirmation.css?v={VERSION}">'
 if re.search(css,html):html=re.sub(css,tag,html)
 else:require(html.count('</head>')==1,'Не подтверждена разметка.');html=html.replace('</head>',tag+'\n</head>')
 files['index.html']=html
 for name,text in files.items():p=out/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (OSError,ValueError) as e:raise SystemExit(str(e))
