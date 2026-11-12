"""Update two reviewed Kosell assets and their cache keys, retaining other site changes."""
import argparse,hashlib,json,os,re,subprocess,tarfile,tempfile
from pathlib import Path

FILES={'app/kosell-storefront.js','app/kosell-workspace.css'}
VERSION=b'20261112-kosell-control'
def digest(data):return hashlib.sha256(data).hexdigest()
def git(root,rev,path):return subprocess.run(['git','show',rev+':'+path],cwd=root,check=True,capture_output=True).stdout
def prepare(root,rev):
 manifest=json.loads(git(root,rev,'deploy/kosell-control-ui-manifest.json'))
 if set(manifest)!=FILES:raise ValueError('Не подтверждён состав обновления.')
 changes={}
 for path,row in manifest.items():
  target=root/path
  if target.is_symlink() or not target.is_file():raise ValueError('Не подтверждён файл '+path)
  before=target.read_bytes();after=git(root,rev,path)
  if digest(after)!=row['after']:raise ValueError('Повреждён пакет '+path)
  if digest(before) not in {row['before'],row['after']}:raise ValueError('Файл '+path+' отличается от проверенной версии. Сайт не изменён.')
  if before!=after:changes[path]=(before,after)
 index=root/'app/index.html'
 if index.is_symlink() or not index.is_file():raise ValueError('Не подтверждён app/index.html')
 before=index.read_bytes();after=before
 for name in [b'kosell-storefront.js',b'kosell-workspace.css']:
  pattern=rb'('+re.escape(name)+rb')(?:\?[^"\s<>]*)?(?=["\s<>])'
  after,count=re.subn(pattern,lambda m:m[1]+b'?v='+VERSION,after)
  if count!=1:raise ValueError('Не распознано единственное подключение '+name.decode())
 if before!=after:changes['app/index.html']=(before,after)
 return changes
def write(root,path,data):
 target=root/path;mode=target.stat().st_mode&0o777
 fd,temp=tempfile.mkstemp(prefix='.kosell-control-',dir=target.parent)
 try:
  with os.fdopen(fd,'wb') as out:out.write(data)
  os.chmod(temp,mode);os.replace(temp,target)
 finally:
  if os.path.exists(temp):os.unlink(temp)
def apply(root,changes,check,backup_dir=Path('/root')):
 if not changes:return None
 fd,backup=tempfile.mkstemp(prefix='zetslay-before-kosell-control.',suffix='.tar.gz',dir=backup_dir);os.close(fd)
 with tarfile.open(backup,'w:gz') as archive:
  for path in changes:archive.add(root/path,arcname=path,recursive=False)
 written=[]
 try:
  for path,(before,after) in changes.items():
   if (root/path).read_bytes()!=before:raise ValueError('Файлы изменились во время установки.')
   write(root,path,after);written.append(path)
  check()
 except BaseException:
  for path in reversed(written):
   if (root/path).read_bytes()==changes[path][1]:write(root,path,changes[path][0])
  print('Публикация не подтверждена; прежние файлы возвращены. Backup: '+str(backup),flush=True)
  raise
 return backup
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('revision');parser.add_argument('--preflight',action='store_true');args=parser.parse_args();root=Path.cwd()
 if not re.fullmatch('[a-f0-9]{40}',args.revision):raise ValueError('Нужна полная ревизия.')
 changes=prepare(root,args.revision)
 if args.preflight:print('Совместимость Kosell подтверждена. Файлов к обновлению: '+str(len(changes)));return
 def check():
  for path in FILES:
   result=subprocess.run(['curl','-q','-fsS','--max-time','12','https://zetslay.pro/'+path+'?v='+VERSION.decode()],capture_output=True,timeout=15)
   if result.returncode or digest(result.stdout)!=digest((root/path).read_bytes()):raise ValueError('Публичный файл '+path+' не подтвердил обновление.')
  result=subprocess.run(['curl','-q','-fsS','--max-time','12','https://zetslay.pro/app/'],capture_output=True,timeout=15)
  if result.returncode or any(name+b'?v='+VERSION not in result.stdout for name in [b'kosell-storefront.js',b'kosell-workspace.css']):raise ValueError('Публичная страница не подтвердила новые ссылки Kosell.')
 backup=apply(root,changes,check)
 print('Интерфейс Kosell обновлён. Backup: '+str(backup) if backup else 'Интерфейс Kosell уже обновлён.')
if __name__=='__main__':
 try:main()
 except (ValueError,OSError,subprocess.SubprocessError) as error:print(str(error));raise SystemExit(1)
