"""Replace the reviewed Kosell preparation module and its single cache-versioned include."""
import hashlib,json,re,sys
from pathlib import Path

def sha(value):return hashlib.sha256(value).hexdigest()
def stage(local,incoming,out):
 local,incoming,out=map(Path,(local,incoming,out))
 manifest=json.loads((incoming/'manifest.json').read_text())
 old=(local/'kosell-storefront.js').read_bytes();target=(incoming/'kosell-storefront.js').read_bytes()
 normalized=old.removeprefix(b'\xef\xbb\xbf').replace(b'\r\n',b'\n').rstrip(b'\n')+b'\n'
 if sha(target)!=manifest['targetSha256']:raise ValueError('Повреждён модуль витрины.')
 blob=lambda value:hashlib.sha1(b'blob '+str(len(value)).encode()+b'\0'+value).hexdigest()
 if sha(old) not in manifest['acceptedSha256'] and sha(normalized) not in manifest['acceptedSha256'] and blob(old) not in manifest.get('acceptedGitBlobs',[]) and blob(normalized) not in manifest.get('acceptedGitBlobs',[]):
  raise ValueError('Не распознана версия модуля витрины. SHA256='+sha(old)+'; bytes='+str(len(old))+'. Сайт не изменён.')
 html=(local/'index.html').read_bytes().decode('utf-8')
 if not re.search(r'\bdata-plugin-page(?:\s|=|>)',html):raise ValueError('Не найден раздел плагинов в кабинете.')
 pattern=r'''(<script\b[^>]*\bsrc\s*=\s*["'](?:\./)?)kosell-storefront\.js(?:\?[^"']*)?(["'])'''
 matches=list(re.finditer(pattern,html,re.I))
 if len(matches)!=1:raise ValueError('Не подтверждено единственное подключение kosell-storefront.js.')
 app=list(re.finditer(r'''<script\b[^>]*\bsrc\s*=\s*["'](?:\./)?app\.js(?:\?[^"']*)?["']''',html,re.I))
 legacy=list(re.finditer(r'''<script\b[^>]*\bsrc\s*=\s*["'](?:\./)?kosell-rent\.js(?:\?[^"']*)?["']''',html,re.I))
 if len(app)!=1 or len(legacy)!=1 or not legacy[0].start()<matches[0].start()<app[0].start():raise ValueError('Не подтверждён порядок загрузки кабинета.')
 updated=re.sub(pattern,lambda m:m[1]+'kosell-storefront.js?v=20261026-kosell-bounded-preparation'+m[2],html,count=1,flags=re.I)
 out.mkdir(parents=True,exist_ok=True)
 (out/'kosell-storefront.js').write_bytes(target);(out/'index.html').write_bytes(updated.encode('utf-8'))
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except ValueError as error:raise SystemExit(str(error))
