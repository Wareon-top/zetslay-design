"""Preserve installed private HTML and JS; add only reviewed trust links, copy and assets."""
import hashlib,json,re,sys
from pathlib import Path

def sha(value):return hashlib.sha256(value).hexdigest()
def replace_once(text,before,after,label):
 if text.count(after)==1:return text
 if text.count(before)!=1:raise ValueError('Не распознан участок '+label+'. Сайт не изменён.')
 return text.replace(before,after,1)
def include(text,name,version):
 pattern=re.compile(r'''(<script\b[^>]*\bsrc\s*=\s*["'](?:\./)?)'''+re.escape(name)+r'''(?:\?[^"']*)?(["'])''',re.I)
 result,count=pattern.subn(lambda m:m[1]+name+'?v='+version+m[2],text)
 if count!=1:raise ValueError('Не подтверждено единственное подключение '+name)
 return result
def stage(local,incoming,out):
 local,incoming,out=map(Path,(local,incoming,out));manifest=json.loads((incoming/'trust-ui-manifest.json').read_text());result={}
 for name,expected in manifest['assets'].items():
  data=(incoming/name).read_bytes()
  if sha(data)!=expected:raise ValueError('Повреждён файл '+name)
  result[name]=data
 old=(local/'app/account-security.js').read_bytes()
 if sha(old) not in manifest['accountSecurityAccepted']:raise ValueError('Не распознана версия настроек защиты.')
 app=(local/'app/app.js').read_bytes().decode('utf-8')
 for patch in manifest['appPatches']:app=replace_once(app,patch['before'],patch['after'],'app.js')
 result['app/app.js']=app.encode('utf-8')
 html=(local/'app/index.html').read_bytes().decode('utf-8')
 for name in ['app.js','account-security.js']:html=include(html,name,'20261026-trust-foundation')
 for path in ['index.html','app/index.html']:
  text=html if path.startswith('app/') else (local/path).read_bytes().decode('utf-8')
  before='<a href="/legal/">';after='<a href="/security/">Данные и безопасность</a> '+before
  text=replace_once(text,before,after,path)
  result[path]=text.encode('utf-8')
 out.mkdir(parents=True,exist_ok=True)
 for name,data in result.items():
  p=out/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
if __name__=='__main__':stage(*sys.argv[1:])
