"""Stage a design overlay, optionally composing the two pinned prerequisite releases in memory."""
import importlib.util,json,re,tempfile
from pathlib import Path
HERE=Path(__file__).parent
def load(path):
 spec=importlib.util.spec_from_file_location('stage_'+path.stem.replace('-','_'),path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
helpers=load(HERE/'stage-competitive-release.py')
def manifest(source,name):return json.loads((Path(source)/'deploy'/name).read_text(encoding='utf8'))
def inputs(source,first=None,second=None):
 m=manifest(source,'workspace-design.json');names=set(m['assets'])|set(m['patches'])|set(m['heads'])|{'app/index.html'}
 if first:
  m=manifest(first,'competitive-release.json');names|=set(m['assets'])|set(m['patches'])|{'index.html','robots.txt','sitemap.xml'}
 if second:
  m=manifest(second,'diagnostics-release.json');names|=set(m['assets'])|set(m['patches'])
 return names
def write(root,result):
 for name,data in result.items():p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
def design(local,source):
 m=manifest(source,'workspace-design.json');result={}
 for name,target in m['assets'].items():
  if Path(name).is_absolute() or '..' in Path(name).parts:raise ValueError('Недопустимый путь')
  data=(source/name).read_bytes().replace(b'\r\n',b'\n')
  if helpers.digest(data)!=target:raise ValueError('Повреждён файл '+name)
  current=local/name
  if current.exists() and helpers.digest(current.read_bytes().replace(b'\r\n',b'\n')) not in [target,*m['accepted'].get(name,[])]:raise ValueError('Независимые изменения '+name+'. Автоматическая замена остановлена.')
  if name in m['accepted'] and not current.exists():raise ValueError('Сначала требуется предыдущий пакет: '+name)
  result[name]=data
 for name,ops in m['patches'].items():
  html=helpers.patch(helpers.read(local/name),ops,name)
  if name=='index.html':
   for css in ['assets/ui-foundation.css','site-design.css']:html=helpers.asset(html,css,m['version'],'link')
  result[name]=html.encode('utf8')
 app=helpers.read(local/'app/index.html')
 if len(re.findall(r'\bsrc=["\'](?:\./)?diagnostics-center\.js(?:\?[^"\']*)?["\']',app))!=1:raise ValueError('Сначала требуется пакет диагностики')
 for name in ['../assets/ui-foundation.css','workspace-design.css']:app=helpers.asset(app,name,m['version'],'link')
 app=helpers.asset(app,'../assets/workspace-navigation.js',m['version'],'script');result['app/index.html']=app.encode('utf8')
 for name in m['heads']:
  if not (local/name).exists():continue
  html=helpers.read(local/name)
  for css in ['/assets/ui-foundation.css','/site-design.css']:html=helpers.asset(html,css,m['version'],'link')
  if name=='security/index.html':
   def body(match):
    tag=match[0]
    if 'security-page' in tag:return tag
    if 'class="' in tag:return tag.replace('class="','class="security-page ',1)
    return tag.replace('<body','<body class="security-page"',1)
   html,count=re.subn(r'<body\b[^>]*>',body,html,count=1)
   if count!=1:raise ValueError('Не подтверждён body страницы защиты')
  result[name]=html.encode('utf8')
 return result
def stage(local,source,out,first=None,second=None):
 local,source,out=map(Path,(local,source,out));result={}
 with tempfile.TemporaryDirectory(prefix='zetslay-design-compose-') as temp:
  virtual=Path(temp)/'site';virtual.mkdir()
  for name in inputs(source,first,second):
   if (local/name).exists():write(virtual,{name:(local/name).read_bytes()})
  app=helpers.read(virtual/'app/index.html')
  if 'diagnostics-center.js' not in app:
   if 'automation-preview.js' not in app:
    if not first:raise ValueError('Не установлен первый пакет')
    changes=load(Path(first)/'deploy/stage-competitive-release.py').stage(virtual,first,Path(temp)/'first');write(virtual,changes);result.update(changes)
   if not second:raise ValueError('Не установлен пакет диагностики')
   changes=load(Path(second)/'deploy/stage-diagnostics.py').stage(virtual,second,Path(temp)/'second');write(virtual,changes);result.update(changes)
  result.update(design(virtual,source))
  write(out,result)
 return result
