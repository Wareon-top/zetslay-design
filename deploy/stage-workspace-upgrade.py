"""Append the workspace presentation and event client to the current cabinet."""
from pathlib import Path
import re,sys
ASSETS=('workspace-upgrade.css','workspace-upgrade.js')
VERSION='20261025-workspace'
def stage(local,incoming,out):
 local,incoming,out=map(Path,(local,incoming,out));html=(local/'index.html').read_text()
 if any(marker not in html for marker in ['class="view-stack"','data-overview','overview-grid','app.js','proxy-shop.js']):raise ValueError('Не подтверждена структура кабинета. Файлы не изменены.')
 for name,tag,end in [('workspace-upgrade.css','link','</head>'),('workspace-upgrade.js','script','</body>')]:
  pattern=(r'<link\b[^>]*href=["\']workspace-upgrade\.css(?:\?[^"\']*)?["\'][^>]*>' if tag=='link' else r'<script\b[^>]*src=["\']workspace-upgrade\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>')
  matches=list(re.finditer(pattern,html));replacement=(f'<link rel="stylesheet" href="{name}?v={VERSION}">' if tag=='link' else f'<script src="{name}?v={VERSION}" defer></script>')
  if len(matches)>1:raise ValueError('Повторное подключение модуля. Файлы не изменены.')
  if matches:html=re.sub(pattern,lambda _:replacement,html)
  elif html.count(end)==1:html=html.replace(end,replacement+'\n'+end,1)
  else:raise ValueError('Не подтверждён HTML кабинета.')
 out.mkdir(parents=True,exist_ok=True);(out/'index.html').write_text(html)
 for name in ASSETS:(out/name).write_bytes((incoming/name).read_bytes())
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (ValueError,OSError) as e:raise SystemExit(str(e))
