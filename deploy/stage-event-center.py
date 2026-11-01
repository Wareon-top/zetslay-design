"""Update the event interface while preserving the installed cabinet and unrelated modules."""
import hashlib,json,re,sys
from pathlib import Path

def digest(data):return hashlib.sha256(data).hexdigest()
def normalized(data):return data.removeprefix(b'\xef\xbb\xbf').replace(b'\r\n',b'\n').rstrip(b'\n')+b'\n'
def stage(local,incoming,out):
 local,incoming,out=map(Path,(local,incoming,out));manifest=json.loads((incoming/'event-center-manifest.json').read_text());html=(local/'index.html').read_bytes().decode('utf-8')
 for marker in ['view-stack','data-overview','overview-grid','app.js','proxy-shop.js']:
  if marker not in html:raise ValueError('Не подтверждена структура кабинета. Сайт не изменён.')
 script=local/'workspace-upgrade.js'
 if script.exists() and digest(normalized(script.read_bytes())) not in manifest['acceptedWorkspaceScripts']:
  raise ValueError('Не распознана версия рабочего центра. SHA256='+digest(script.read_bytes())+'. Сайт не изменён.')
 result={}
 for name,sha in manifest['assets'].items():
  data=(incoming/name).read_bytes()
  if digest(data)!=sha:raise ValueError('Повреждён файл '+name)
  result[name]=data
 if (local/'workspace-upgrade.css').is_file():result['workspace-upgrade.css']=(local/'workspace-upgrade.css').read_bytes()
 for name,tag in [('workspace-upgrade.css','link'),('event-center.css','link'),('workspace-upgrade.js','script')]:
  pattern=(r'''<link\b[^>]*\bhref\s*=\s*["'](?:\./)?'''+re.escape(name)+r'''(?:\?[^"']*)?["'][^>]*>''' if tag=='link' else r'''<script\b[^>]*\bsrc\s*=\s*["'](?:\./)?'''+re.escape(name)+r'''(?:\?[^"']*)?["'][^>]*>\s*</script>''')
  matches=list(re.finditer(pattern,html,re.I));end='</head>' if tag=='link' else '</body>';version=manifest['version']
  if len(matches)>1:raise ValueError('Повторное подключение '+name+'. Сайт не изменён.')
  replacement=f'<link rel="stylesheet" href="{name}?v={version}">' if tag=='link' else f'<script src="{name}?v={version}" defer></script>'
  if matches:html=html[:matches[0].start()]+replacement+html[matches[0].end():]
  elif html.count(end)==1:html=html.replace(end,replacement+'\n'+end,1)
  else:raise ValueError('Не подтверждены границы HTML.')
 if html.index('event-center.css')<html.index('workspace-upgrade.css'):raise ValueError('Не подтверждён порядок стилей центра событий.')
 if html.index('workspace-upgrade.js')<html.index('app.js'):raise ValueError('Не подтверждён порядок загрузки рабочего центра.')
 result['index.html']=html.encode('utf-8');out.mkdir(parents=True,exist_ok=True)
 for name,data in result.items():(out/name).write_bytes(data)
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (ValueError,OSError) as e:raise SystemExit(str(e))
