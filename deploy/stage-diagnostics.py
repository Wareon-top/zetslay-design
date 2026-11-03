"""Stage diagnostics over the installed first release, preserving local cabinet modules."""
import hashlib,importlib.util,json,re
from pathlib import Path
spec=importlib.util.spec_from_file_location('previous_stage',Path(__file__).with_name('stage-competitive-release.py'));previous=importlib.util.module_from_spec(spec);spec.loader.exec_module(previous)
def stage(local,incoming,out):
 local,incoming,out=map(Path,(local,incoming,out));m=json.loads((incoming/'deploy/diagnostics-release.json').read_text(encoding='utf8'));result={}
 for name,target in m['assets'].items():
  if Path(name).is_absolute() or '..' in Path(name).parts:raise ValueError('Недопустимый путь')
  data=(incoming/name).read_bytes().replace(b'\r\n',b'\n')
  if previous.digest(data)!=target:raise ValueError('Повреждён файл '+name)
  if (local/name).exists() and previous.digest((local/name).read_bytes().replace(b'\r\n',b'\n')) not in [target,*m['accepted'].get(name,[])]:raise ValueError('Независимые изменения '+name+'. Автоматическая замена остановлена.')
  if name in m['accepted'] and not (local/name).exists():raise ValueError('Сначала установите первый пакет: '+name)
  result[name]=data
 for name,ops in m['patches'].items():
  if (local/name).exists():result[name]=previous.patch(previous.read(local/name),ops,name).encode('utf8')
 app=previous.read(local/'app/index.html')
 for name in ['app.js','automation-preview.js']:
  if len(re.findall(r'\bsrc=["\'](?:\./)?'+re.escape(name)+r'(?:\?[^"\']*)?["\']',app))!=1:raise ValueError('Сначала установите первый пакет: '+name)
 app=previous.asset(app,'diagnostics-center.css',m['version'],'link')
 for name in ['diagnostics-model.js','diagnostics-ui.js','diagnostics-center.js']:app=previous.asset(app,name,m['version'],'script')
 if not app.index('automation-preview.js')<app.index('diagnostics-model.js')<app.index('diagnostics-ui.js')<app.index('diagnostics-center.js'):raise ValueError('Неверный порядок модулей диагностики')
 result['app/index.html']=app.encode('utf8')
 out.mkdir(parents=True,exist_ok=True)
 for name,data in result.items():p=out/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
 return result
