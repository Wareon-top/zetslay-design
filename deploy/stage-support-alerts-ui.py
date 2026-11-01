"""Patch only the owner support link component and cache versions, preserving private site HTML."""
import json,re,sys
from pathlib import Path
VERSION='20261101-support-alerts-1'
def patch(text,ops,name):
 for op in ops:
  before,after=op['before'],op['after']
  if text.count(after)==1 and not text.replace(after,'',1).count(before):continue
  if text.count(before)!=1 or text.count(after):raise ValueError('Не распознана версия '+name+'. Сайт не изменён.')
  text=text.replace(before,after,1)
 return text
def cache_versions(html):
 for tag,attribute,name in [('script','src','admin-panel.js')]:
  pattern=r'(<'+tag+r'\b[^>]*\b'+attribute+r'''\s*=\s*["'](?:\./)?'''+re.escape(name)+r''')(?:\?[^"']*)?(["'])'''
  if len(re.findall(pattern,html,re.I))!=1:raise ValueError('Не подтверждено единственное подключение '+name+'. Сайт не изменён.')
  html=re.sub(pattern,lambda m:m[1]+'?v='+VERSION+m[2],html,flags=re.I)
 return html
def stage(local,manifest_path,out):
 manifest=json.loads(Path(manifest_path).read_text());out=Path(out);(out/'app').mkdir(parents=True,exist_ok=True)
 if set(manifest['patches'])!={'app/admin-panel.js'}:raise ValueError('Не подтверждён набор файлов обновления.')
 for name,ops in manifest['patches'].items():
  text=(Path(local)/name).read_bytes().decode('utf-8');(out/name).write_text(patch(text,ops,name))
 (out/'app/index.html').write_text(cache_versions((Path(local)/'app/index.html').read_bytes().decode('utf-8')))
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (ValueError,OSError,KeyError) as error:raise SystemExit(str(error))
