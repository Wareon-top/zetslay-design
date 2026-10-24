"""Add the common ASCII layer without replacing app logic or live sections."""
from pathlib import Path
import re,sys
VERSION='20261024-ascii'
ASSETS=('cabinet-background.js','cabinet-background.css')
def stage(local,incoming,out):
 local,incoming,out=map(Path,(local,incoming,out));html=(local/'index.html').read_text()
 for pattern in (r'<div\b[^>]*class=["\'][^"\']*\bapp-shell\b',r'<main\b[^>]*class=["\'][^"\']*\bworkspace\b'):
  if len(re.findall(pattern,html))!=1:raise ValueError('Не подтверждена структура кабинета. Файлы не изменены.')
 if html.count('</head>')!=1 or html.count('</body>')!=1:raise ValueError('Не подтверждена страница кабинета.')
 data={name:(incoming/name).read_bytes() for name in ASSETS}
 html=re.sub(r'[ \t]*<link\b[^>]*href=["\']cabinet-background\.css(?:\?[^"\']*)?["\'][^>]*>\n?','',html)
 html=re.sub(r'[ \t]*<script\b[^>]*src=["\']cabinet-background\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>\n?','',html)
 html=html.replace('</head>','  <link rel="stylesheet" href="cabinet-background.css?v='+VERSION+'">\n</head>',1)
 html=html.replace('</body>','<script src="cabinet-background.js?v='+VERSION+'" defer></script>\n</body>',1)
 out.mkdir(parents=True,exist_ok=True);(out/'index.html').write_text(html)
 for name,content in data.items():(out/name).write_bytes(content)
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (OSError,ValueError) as e:raise SystemExit(str(e))
