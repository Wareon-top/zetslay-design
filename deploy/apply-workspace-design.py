"""Preflight, snapshot all inputs, apply atomically per file and roll back only our own writes."""
import argparse,hashlib,importlib.util,json,os,tempfile
from pathlib import Path
HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('workspace_stage',HERE/'stage-workspace-design.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
def apply(site,source,backup_root,first=None,second=None,*,install=False):
 site,source,backup_root=map(lambda x:Path(x).resolve(),(site,source,backup_root))
 with tempfile.TemporaryDirectory(prefix='zetslay-design-stage-') as temp:
  result=module.stage(site,source,Path(temp),first,second)
  if not install:print('Предварительная проверка дизайна пройдена. Файлов: '+str(len(result)));return
  if os.name!='posix':raise ValueError('Установка рассчитана на Linux VPS')
  import fcntl
  with (site/'.zetslay-workspace-design.lock').open('a') as lock:
   fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
   names=module.inputs(source,first,second);original={name:(site/name).read_bytes() if (site/name).exists() else None for name in names}
   result=module.stage(site,source,Path(temp),first,second)
   if not set(result)<=names or any(((site/name).read_bytes() if (site/name).exists() else None)!=data for name,data in original.items()):raise ValueError('Файлы изменились во время подготовки')
   backup=Path(tempfile.mkdtemp(prefix='zetslay-before-design-',dir=backup_root));backup.chmod(0o700)
   for name in result:
    if original[name] is not None:target=backup/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(original[name])
   (backup/'release-files.json').write_text(json.dumps({'site':str(site),'created':[name for name in result if original[name] is None],'sha256':{name:hashlib.sha256(data).hexdigest() for name,data in result.items()}},indent=2))
   changed=[]
   try:
    for name,data in result.items():
     target=site/name
     if (target.read_bytes() if target.exists() else None)!=original[name]:raise ValueError('Файл изменился во время установки: '+name)
     target.parent.mkdir(parents=True,exist_ok=True);fd,temporary=tempfile.mkstemp(prefix='.zetslay-design-',dir=target.parent)
     try:
      with os.fdopen(fd,'wb') as stream:stream.write(data)
      os.chmod(temporary,0o644);os.replace(temporary,target);changed.append(name)
     finally:
      if os.path.exists(temporary):os.unlink(temporary)
   except BaseException:
    for name in reversed(changed):
     target=site/name
     if target.read_bytes()!=result[name]:continue
     if original[name] is None:target.unlink(missing_ok=True)
     else:target.write_bytes(original[name])
    raise
   print('Готово: дизайн ZetSlay установлен. Backup: '+str(backup));return backup
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--site',required=True);p.add_argument('--source',required=True);p.add_argument('--backup-root',default='/root');p.add_argument('--first');p.add_argument('--second');p.add_argument('--apply',action='store_true');a=p.parse_args()
 try:apply(a.site,a.source,a.backup_root,a.first,a.second,install=a.apply)
 except (OSError,ValueError) as error:raise SystemExit('Дизайн не установлен: '+str(error))
