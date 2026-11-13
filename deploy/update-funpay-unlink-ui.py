"""Publish the explicit FunPay unlink dialog without replacing existing cabinet scripts."""
import argparse,hashlib,json,os,re,subprocess,tarfile,tempfile
from pathlib import Path

FILES={'app/funpay-disconnect-ui.js','app/funpay-disconnect-ui.css'}
VERSION=b'20261113-funpay-unlink'
def digest(data):return hashlib.sha256(data).hexdigest()
def git(root,rev,path):return subprocess.run(['git','show',rev+':'+path],cwd=root,check=True,capture_output=True).stdout
def prepare(root,rev):
 manifest=json.loads(git(root,rev,'deploy/funpay-unlink-ui-manifest.json'))
 if set(manifest)!=FILES:raise ValueError('Не подтверждён состав обновления.')
 changes={}
 for path,row in manifest.items():
  target=root/path
  if target.is_symlink() or target.exists() and not target.is_file():raise ValueError('Не подтверждён файл '+path)
  before=target.read_bytes() if target.exists() else None;after=git(root,rev,path)
  if digest(after)!=row['after']:raise ValueError('Повреждён пакет '+path)
  if (digest(before) if before is not None else None) not in {row['before'],row['after']}:raise ValueError('Файл '+path+' отличается от проверенной версии. Сайт не изменён.')
  if before!=after:changes[path]=(before,after)
 index=root/'app/index.html'
 if index.is_symlink() or not index.is_file():raise ValueError('Не подтверждён app/index.html')
 before=index.read_bytes();after=before
 for name in [b'funpay-disconnect-ui.js',b'funpay-disconnect-ui.css']:
  pattern=rb'('+re.escape(name)+rb')(?:\?[^"\s<>]*)?(?=["\s<>])'
  count=len(re.findall(pattern,after))
  if count==1:after=re.sub(pattern,lambda m:m[1]+b'?v='+VERSION,after)
  elif count==0:
   css=name.endswith(b'.css');end=b'</head>' if css else b'</body>'
   if after.count(end)!=1:raise ValueError('Не распознан HTML кабинета.')
   tag=(b'<link rel="stylesheet" href="'+name+b'?v='+VERSION+b'">' if css else b'<script src="'+name+b'?v='+VERSION+b'" defer></script>')
   after=after.replace(end,tag+b'\n'+end,1)
  else:raise ValueError('Найдено несколько подключений '+name.decode())
 if before!=after:changes['app/index.html']=(before,after)
 return changes
def write(root,path,data):
 target=root/path;mode=target.stat().st_mode&0o777 if target.exists() else 0o644
 fd,temp=tempfile.mkstemp(prefix='.funpay-unlink-',dir=target.parent)
 try:
  with os.fdopen(fd,'wb') as out:out.write(data)
  os.chmod(temp,mode);os.replace(temp,target)
 finally:
  if os.path.exists(temp):os.unlink(temp)
def apply(root,changes,check,backup_dir=Path('/root')):
 if not changes:return None
 fd,backup=tempfile.mkstemp(prefix='zetslay-before-funpay-unlink.',suffix='.tar.gz',dir=backup_dir);os.close(fd)
 with tarfile.open(backup,'w:gz') as archive:
  for path in changes:
   if (root/path).exists():archive.add(root/path,arcname=path,recursive=False)
 written=[]
 try:
  for path,(before,after) in changes.items():
   if ((root/path).read_bytes() if (root/path).exists() else None)!=before:raise ValueError('Файлы изменились во время установки.')
   write(root,path,after);written.append(path)
  check()
 except BaseException:
  for path in reversed(written):
   if (root/path).read_bytes()==changes[path][1]:
    if changes[path][0] is None:(root/path).unlink()
    else:write(root,path,changes[path][0])
  print('Публикация не подтверждена; прежние файлы возвращены. Backup: '+str(backup),flush=True)
  raise
 return backup
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('revision');parser.add_argument('--preflight',action='store_true');args=parser.parse_args();root=Path.cwd()
 if not re.fullmatch('[a-f0-9]{40}',args.revision):raise ValueError('Нужна полная ревизия.')
 changes=prepare(root,args.revision)
 if args.preflight:print('Совместимость интерфейса отвязки подтверждена. Файлов к обновлению: '+str(len(changes)));return
 def check():
  for path in FILES:
   result=subprocess.run(['curl','-q','-fsS','--max-time','12','https://zetslay.pro/'+path+'?v='+VERSION.decode()],capture_output=True,timeout=15)
   if result.returncode or digest(result.stdout)!=digest((root/path).read_bytes()):raise ValueError('Публичный файл '+path+' не подтвердил обновление.')
  result=subprocess.run(['curl','-q','-fsS','--max-time','12','https://zetslay.pro/app/'],capture_output=True,timeout=15)
  if result.returncode or any(name+b'?v='+VERSION not in result.stdout for name in [b'funpay-disconnect-ui.js',b'funpay-disconnect-ui.css']):raise ValueError('Публичная страница не подтвердила новые ссылки подключения.')
 if not changes:check()
 backup=apply(root,changes,check)
 print('Возможность отвязки FunPay обновлён. Backup: '+str(backup) if backup else 'Возможность отвязки FunPay уже обновлён.')
if __name__=='__main__':
 try:main()
 except (ValueError,OSError,subprocess.SubprocessError) as error:print(str(error));raise SystemExit(1)
