from pathlib import Path
import re,sys
VERSION='20261012-proxy-replacement'
def stage(local,incoming,out):
 local,incoming,out=Path(local),Path(incoming),Path(out)
 html=(local/'index.html').read_text();app=(local/'app.js').read_text();new=(incoming/'app.js').read_text()
 if any(m not in html for m in ['data-overview','data-sidebar-trial','data-billing']) or html.count('</body>')!=1:
  raise ValueError('Не подтверждена структура кабинета. Файлы не изменены.')
 for start,end in [('function renderConnectionWizard()', 'async function refreshConnectionWizard()'),('function beginConnectionReset(', 'async function repairConnectionWebhook()')]:
  if any(text.count(marker)!=1 for text in [app,new] for marker in [start,end]):raise ValueError('Не подтверждены функции подключения. Файлы не изменены.')
  a,b=app.index(start),app.index(end);c,d=new.index(start),new.index(end)
  if b<a or d<c:raise ValueError('Не подтверждён порядок функций. Файлы не изменены.')
  app=app[:a]+new[c:d]+app[b:]
 pattern=r'(src=["\'])app\.js(?:\?[^"\']*)?(["\'])'
 if len(re.findall(pattern,html))!=1:raise ValueError('Не подтверждено подключение app.js. Файлы не изменены.')
 html=re.sub(pattern,lambda m:m[1]+'app.js?v='+VERSION+m[2],html)
 if any(re.search(r'^(<<<<<<<|=======|>>>>>>>)',s,re.M) for s in [html,app]):raise ValueError('Найден конфликт. Файлы не изменены.')
 out.mkdir(parents=True,exist_ok=True);(out/'index.html').write_text(html);(out/'app.js').write_text(app)
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (OSError,ValueError) as e:raise SystemExit(str(e))
