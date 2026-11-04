"""Restore the snapshot made immediately before the rejected workspace design."""
import argparse,hashlib,json,os,re,subprocess,tempfile
from pathlib import Path,PurePosixPath

def digest(data):return hashlib.sha256(data).hexdigest()
def checked(root,name):
 p=PurePosixPath(name)
 if not name or p.is_absolute() or '..' in p.parts or '\\' in name or p.as_posix()!=name:raise ValueError('Недопустимый путь в backup')
 target=root/name
 if not target.resolve().is_relative_to(root.resolve()) or any(part.is_symlink() for part in [target,*target.parents] if part!=root and part.is_relative_to(root)):raise ValueError('Символическая ссылка в backup/сайте')
 return target
def read(path):
 if path.exists() and not path.is_file():raise ValueError('Ожидался обычный файл: '+str(path))
 return path.read_bytes() if path.exists() else None
def plan(site,backup):
 if backup.is_symlink():raise ValueError('Backup не должен быть ссылкой')
 manifest=json.loads((backup/'release-files.json').read_text(encoding='utf8'))
 if Path(manifest['site']).resolve()!=site.resolve():raise ValueError('Backup относится к другому сайту')
 hashes=manifest['sha256'];created=set(manifest['created'])
 if not isinstance(hashes,dict) or not hashes or not created<=hashes.keys():raise ValueError('Повреждён манифест backup')
 original={};current={}
 for name,sha in hashes.items():
  if not isinstance(sha,str) or not re.fullmatch('[a-f0-9]{64}',sha):raise ValueError('Повреждён SHA256')
  target=checked(site,name);saved=checked(backup,name)
  original[name]=None if name in created else read(saved)
  if name not in created and original[name] is None:raise ValueError('В backup отсутствует '+name)
  current[name]=read(target)
  if current[name]!=original[name] and (current[name] is None or digest(current[name])!=sha):raise ValueError('После установки изменён файл: '+name+'. Откат остановлен до записи.')
 meaningful=any(data is None or digest(data)!=hashes[name] for name,data in original.items())
 return original,current,meaningful
def choose(site,root):
 candidates=sorted((p for p in root.glob('zetslay-before-design-*') if p.is_dir() and not p.is_symlink() and (p/'release-files.json').is_file()),key=lambda p:p.stat().st_mtime_ns,reverse=True)
 for backup in candidates:
  # Do not skip a conflicting newer snapshot and silently restore an older one.
  original,current,meaningful=plan(site,backup)
  if meaningful:return backup,original,current
 raise ValueError('Не найдена резервная копия до изменения дизайна')
def replace(path,data):
 if data is None:path.unlink(missing_ok=True);return
 path.parent.mkdir(parents=True,exist_ok=True)
 fd,name=tempfile.mkstemp(prefix='.zetslay-restore-',dir=path.parent)
 try:
  with os.fdopen(fd,'wb') as stream:stream.write(data)
  os.chmod(name,0o644);os.replace(name,path)
 finally:
  if os.path.exists(name):os.unlink(name)
def restore(site,root,*,install=False,backup=None):
 site=Path(site).resolve();root=Path(root).resolve()
 if backup is None:backup,original,current=choose(site,root)
 else:backup=Path(backup);original,current,_=plan(site,backup)
 changed=[name for name in original if original[name]!=current[name]]
 print('Резервная копия: '+str(backup));print('Файлов к восстановлению: '+str(len(changed)))
 if not install or not changed:return
 snapshot=Path(tempfile.mkdtemp(prefix='zetslay-design-rollback-safety-',dir=root));snapshot.chmod(0o700)
 for name,data in current.items():
  if data is not None:p=snapshot/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
 (snapshot/'snapshot.json').write_text(json.dumps({'site':str(site),'sourceBackup':str(backup),'absent':[n for n,d in current.items() if d is None]},indent=2))
 # Verify every input again before writing any file.
 if any(read(checked(site,n))!=data for n,data in current.items()):raise ValueError('Сайт изменился во время подготовки отката')
 applied=[]
 try:
  # Remove stylesheet/script references before deleting the new assets.
  for name in sorted(changed,key=lambda n:(original[n] is None,not n.endswith('.html'),n)):
   path=checked(site,name)
   if read(path)!=current[name]:raise ValueError('Файл изменился во время отката: '+name)
   replace(path,original[name]);applied.append(name)
  if any(read(checked(site,n))!=data for n,data in original.items()):raise ValueError('Не подтверждено восстановление всех файлов')
 except BaseException:
  for name in reversed(applied):
   path=checked(site,name)
   if read(path)==original[name]:replace(path,current[name])
  raise
 print('Готово: прежний дизайн восстановлен. Обновите страницы через Ctrl+F5.')
 print('Копия перед откатом: '+str(snapshot))
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--site',default='/opt/zetslay-site');p.add_argument('--backup-root',default='/root');p.add_argument('--backup');p.add_argument('--apply',action='store_true');a=p.parse_args()
 state=subprocess.run(['systemctl','show','zetslay-design-upgrade.service','-p','ActiveState','--value'],capture_output=True,text=True).stdout.strip()
 if state in ['active','activating','deactivating']:raise ValueError('Установка ещё выполняется. Дождитесь её завершения и повторите откат.')
 import fcntl
 with (Path(a.site)/'.zetslay-workspace-design.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  restore(a.site,a.backup_root,install=a.apply,backup=a.backup)
if __name__=='__main__':
 try:main()
 except (OSError,ValueError,KeyError,TypeError) as e:raise SystemExit('Откат остановлен: '+str(e))
