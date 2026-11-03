"""Stage first; install with backup and rollback. No git reset and no replacement of app.js."""
import argparse,hashlib,importlib.util,json,os,tempfile
from pathlib import Path
HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('competitive_stage',HERE/'stage-competitive-release.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
def apply(site,source,backup_root,*,install=False):
 site,source,backup_root=Path(site).resolve(),Path(source).resolve(),Path(backup_root).resolve()
 with tempfile.TemporaryDirectory(prefix='zetslay-public-stage-') as temporary:
  result=module.stage(site,source,Path(temporary))
  if not install:print('Предварительная проверка пройдена. Файлов: '+str(len(result)));return None
  if os.name!='posix':raise ValueError('Установка рассчитана на Linux VPS')
  import fcntl
  with (site/'.zetslay-competitive-release.lock').open('a') as lock:
   fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
   # Rebuild under the lock: a concurrent installer may have changed inputs.
   result=module.stage(site,source,Path(temporary));original={name:(site/name).read_bytes() if (site/name).exists() else None for name in result}
   backup=Path(tempfile.mkdtemp(prefix='zetslay-before-public-upgrade-',dir=backup_root));backup.chmod(0o700)
   for name,data in original.items():
    if data is not None:target=backup/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
   (backup/'release-files.json').write_text(json.dumps({'site':str(site),'created':[name for name,data in original.items() if data is None],'sha256':{name:hashlib.sha256(data).hexdigest() for name,data in result.items()}},indent=2))
   changed=[]
   try:
    for name,data in result.items():
     target=site/name;current=target.read_bytes() if target.exists() else None
     if current!=original[name]:raise ValueError('Файл изменился во время установки: '+name)
     target.parent.mkdir(parents=True,exist_ok=True);fd,temp=tempfile.mkstemp(prefix='.zetslay-release-',dir=target.parent)
     try:
      with os.fdopen(fd,'wb') as stream:stream.write(data)
      os.chmod(temp,0o644);os.replace(temp,target);changed.append(name)
     finally:
      if os.path.exists(temp):os.unlink(temp)
   except BaseException:
    for name in reversed(changed):
     target=site/name
     if original[name] is None:target.unlink(missing_ok=True)
     else:target.write_bytes(original[name])
    raise
   print('Готово: публичное демо, инструкции и проверка правил установлены. Backup: '+str(backup));return backup
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--site',required=True);parser.add_argument('--source',required=True);parser.add_argument('--backup-root',default='/root');parser.add_argument('--apply',action='store_true');args=parser.parse_args()
 try:apply(args.site,args.source,args.backup_root,install=args.apply)
 except (OSError,ValueError) as error:raise SystemExit('Обновление не установлено: '+str(error))
