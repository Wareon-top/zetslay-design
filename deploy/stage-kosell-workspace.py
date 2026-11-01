"""Install reviewed automation assets while preserving the private cabinet and all unrelated bytes."""
import hashlib,json,re,sys
from pathlib import Path
def digest(data):return hashlib.sha256(data).hexdigest()
def normalized(data):return data.removeprefix(b'\xef\xbb\xbf').replace(b'\r\n',b'\n').rstrip(b'\n')+b'\n'
def stage(local,incoming,out):
 local,incoming,out=map(Path,(local,incoming,out));m=json.loads((incoming/'kosell-workspace-manifest.json').read_text());html=(local/'index.html').read_bytes().decode('utf-8')
 for marker in ['view-stack','data-overview','overview-grid','app.js','proxy-shop.js']:
  if marker not in html:raise ValueError('Не подтверждена структура кабинета. Сайт не изменён.')
 result={}
 for name,sha in m['assets'].items():
  data=(incoming/name).read_bytes();current=local/name
  if digest(data)!=sha:raise ValueError('Повреждён файл '+name)
  if current.exists() and digest(normalized(current.read_bytes())) not in m['accepted'][name]:raise ValueError('Не распознана версия '+name+'. SHA256='+digest(current.read_bytes())+'. Сайт не изменён.')
  result[name]=data
 for name,tag in [('kosell-workspace.css','link'),('kosell-rent.js','script'),('kosell-storefront.js','script')]:
  pattern=(r'''<link\b[^>]*\bhref\s*=\s*["'](?:\./)?'''+re.escape(name)+r'''(?:\?[^"']*)?["'][^>]*>''' if tag=='link' else r'''<script\b[^>]*\bsrc\s*=\s*["'](?:\./)?'''+re.escape(name)+r'''(?:\?[^"']*)?["'][^>]*>\s*</script>''')
  matches=list(re.finditer(pattern,html,re.I));end='</head>' if tag=='link' else '</body>';version=m['version']
  if len(matches)>1:raise ValueError('Повторное подключение '+name+'. Сайт не изменён.')
  replacement=f'<link rel="stylesheet" href="{name}?v={version}">' if tag=='link' else f'<script src="{name}?v={version}" defer></script>'
  if matches:html=html[:matches[0].start()]+replacement+html[matches[0].end():]
  elif html.count(end)==1:html=html.replace(end,replacement+'\n'+end,1)
  else:raise ValueError('Не подтверждены границы HTML.')
 if html.index('kosell-storefront.js')<html.index('kosell-rent.js') or html.index('kosell-rent.js')>html.index('app.js'):raise ValueError('Нарушен порядок загрузки KOSELL.')
 result['index.html']=html.encode();out.mkdir(parents=True,exist_ok=True)
 for name,data in result.items():(out/name).write_bytes(data)
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (ValueError,OSError) as e:raise SystemExit(str(e))
