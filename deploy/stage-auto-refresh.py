"""Add cache polling to the installed cabinet; preserve auth, payments, editors and legal versions."""
from pathlib import Path
import re,sys
VERSION='20261016-background-snapshots'
ASSETS=['auto-refresh.js','auto-refresh.test.mjs']
def require(value,message):
 if not value:raise ValueError(message+' Файлы не изменены.')
def stage(local,incoming,out):
 local,incoming,out=map(Path,[local,incoming,out]);html=(local/'index.html').read_text();overview=(local/'overview.js').read_text()
 for source in [html,overview]:require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)',source,re.M),'Конфликт исходных файлов.')
 for name in ['app.js','messages.js','store-sync-deadline.js','subscription-access.js']:
  require((local/name).is_file() and re.search(r'<script\b[^>]*src=["\']'+re.escape(name)+r'(?:\?[^"\']*)?["\']',html),'Не установлен текущий кабинет: '+name)
 require('function refreshOverview(' in overview,'Не подтверждён модуль главной страницы.')
 files={name:(incoming/name).read_text() for name in ASSETS}
 # Remove the old live polling loop; all automatic requests now read the cache.
 for name in ['store-refresh.js','auto-refresh.js']:
  pattern=r'<script\b[^>]*src=["\']'+re.escape(name)+r'(?:\?[^"\']*)?["\'][^>]*>\s*</script>'
  require(len(re.findall(pattern,html))<=1,'Дублируется '+name);html=re.sub(pattern+r'[ \t]*\r?\n?','',html)
 require(html.count('</body>')==1,'Не подтверждена разметка кабинета.')
 html=html.replace('</body>',f'<script src="auto-refresh.js?v={VERSION}" defer></script>\n</body>')
 pattern=r'(<script\b[^>]*src=["\'])overview\.js(?:\?[^"\']*)?(["\'][^>]*>\s*</script>)'
 require(len(re.findall(pattern,html))==1,'Не найден модуль главной страницы.');html=re.sub(pattern,lambda m:m[1]+'overview.js?v='+VERSION+m[2],html)
 overview=overview.replace('Магазин подключён. Нажмите «Обновить данные», чтобы загрузить показатели.','Магазин подключён. Показатели загрузятся автоматически.')
 files.update({'index.html':html,'overview.js':overview})
 for name,text in files.items():p=out/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (OSError,ValueError) as e:raise SystemExit(str(e))
