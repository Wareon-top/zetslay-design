"""Stage the public security page without touching the landing or account UI."""
import hashlib,json,sys
from pathlib import Path
FILES=('security/index.html','security/security.css','security/security.js')
def normalized(value):return value.removeprefix(b'\xef\xbb\xbf').replace(b'\r\n',b'\n').rstrip(b'\n')+b'\n'
def stage(local,incoming,out):
 local,incoming,out=map(Path,(local,incoming,out))
 manifest=json.loads((incoming/'security-page-manifest.json').read_text())
 result={}
 for name in FILES:
  value=(incoming/name).read_bytes()
  if hashlib.sha256(value).hexdigest()!=manifest['assets'][name]:raise ValueError('Повреждён файл '+name+'. Сайт не изменён.')
  result[name]=value
 old=(local/'security/index.html').read_bytes()
 if hashlib.sha256(normalized(old)).hexdigest() not in manifest['sourceHtmlAccepted']:raise ValueError('Страница безопасности изменена вручную или имеет неизвестную версию. Установка остановлена до записи; главная и кабинет не изменены.')
 out.mkdir(parents=True,exist_ok=True)
 (out/'security').mkdir(exist_ok=True)
 for name,value in result.items():(out/name).write_bytes(value)
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except ValueError as error:raise SystemExit(str(error))
