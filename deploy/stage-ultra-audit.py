"""Update three existing Ultra assets while preserving all other installed HTML bytes."""
import hashlib,json,re,sys
from pathlib import Path
FILES=('ai-reviews.js','robux-relay.js','ticket-pilot.js')
def stage(local,incoming,out):
 local,incoming,out=map(Path,(local,incoming,out));manifest=json.loads((incoming/'ultra-ui-manifest.json').read_text())
 html=(local/'index.html').read_bytes().decode('utf-8');result=html
 for name in FILES:
  before=(local/name).read_bytes();after=(incoming/name).read_bytes()
  if hashlib.sha256(before).hexdigest() not in manifest[name].values():raise ValueError('Не распознана версия '+name+'. Интерфейс не изменён.')
  if hashlib.sha256(after).hexdigest()!=manifest[name]['after']:raise ValueError('Повреждён файл '+name)
  pattern=re.compile(r'''(<script\b[^>]*\bsrc\s*=\s*["'](?:\./)?)'''+re.escape(name)+r'''(?:\?[^"']*)?(["'])''',re.I)
  result,count=pattern.subn(lambda m:m[1]+name+'?v=20261026-ultra-audit'+m[2],result)
  if count!=1:raise ValueError('Не подтверждено единственное подключение '+name)
 out.mkdir(parents=True,exist_ok=True)
 (out/'index.html').write_bytes(result.encode('utf-8'))
 for name in FILES:(out/name).write_bytes((incoming/name).read_bytes())
if __name__=='__main__':stage(*sys.argv[1:])
