from pathlib import Path
import re,sys
VERSION='20261014-managed-proxy'
ASSETS=['managed-proxy-ui.js','managed-proxy-ui.css']
def stage(local,incoming,out):
 local,incoming,out=Path(local),Path(incoming),Path(out)
 html=(local/'index.html').read_text()
 if html.count('</head>')!=1 or html.count('</body>')!=1 or 'connection-wizard-ui.js' not in html or 'admin-panel.js' not in html or 'profile.js' not in html:
  raise ValueError('Не подтверждена структура кабинета. Файлы не изменены.')
 for name in ASSETS:
  pattern=rf'<(?:script|link)\b[^>]*(?:src|href)=["\']{re.escape(name)}(?:\?[^"\']*)?["\'][^>]*(?:></script>|>)'
  matches=list(re.finditer(pattern,html))
  if len(matches)>1:raise ValueError('Дубли подключений. Файлы не изменены.')
  html=re.sub(pattern,'',html)
 html=html.replace('</head>',f'<link rel="stylesheet" href="managed-proxy-ui.css?v={VERSION}">\n</head>',1)
 html=html.replace('</body>',f'<script src="managed-proxy-ui.js?v={VERSION}" defer></script>\n</body>',1)
 if re.search(r'^(<<<<<<<|=======|>>>>>>>)',html,re.M):raise ValueError('Конфликт HTML. Файлы не изменены.')
 out.mkdir(parents=True,exist_ok=True)
 (out/'index.html').write_text(html)
 for name in ASSETS:(out/name).write_bytes((incoming/name).read_bytes())
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (ValueError,OSError) as e:raise SystemExit(str(e))
