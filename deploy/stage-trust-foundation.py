"""Preserve installed private HTML and JS; add only reviewed trust links, copy and assets."""
import hashlib,json,re,sys
from pathlib import Path

def sha(value):return hashlib.sha256(value).hexdigest()
def normalized_script(value):
 # Transport differences only; arbitrary edits still fail the reviewed-content check.
 return value.removeprefix(b'\xef\xbb\xbf').replace(b'\r\n',b'\n').rstrip(b'\n')+b'\n'
def validate_security_script(value,manifest):
 if sha(value) in manifest['accountSecurityAccepted']:return 'reviewed'
 if sha(normalized_script(value)) in manifest.get('accountSecurityNormalizedAccepted',[]):return 'reviewed'
 # This exact deployed file was observed in the owner's failed preflight. Its
 # contents are not claimed to be reviewed. Replace the whole UI component only,
 # after checking the host contract; the shell verifies a complete backup before writing.
 replacement=manifest.get('accountSecurityReplacement',{})
 if (replacement.get('sourceSha256')==sha(value) and replacement.get('sourceBytes')==len(value)
     and replacement.get('targetSha256')==manifest['assets']['app/account-security.js']):return 'replace-observed'
 raise ValueError('Не распознана версия настроек защиты. SHA256='+sha(value)+'; bytes='+str(len(value))+'. Сайт не изменён.')
def validate_host_contract(local,app,html):
 profile=(local/'app/profile.js').read_text()
 for name in ['apiRequest','acceptSession','resetAccountData','showToast']:
  if not re.search(r'\bfunction\s+'+name+r'\s*\(',app):raise ValueError('Не подтверждена функция кабинета '+name+'. Сайт не изменён.')
 for name in ['authState','API_BASE_URL','humanError','icon','escapeHtml']:
  if not re.search(r'\b(?:const|let|var)\s+'+name+r'\s*=',app):raise ValueError('Не подтверждён интерфейс кабинета '+name+'. Сайт не изменён.')
 for name in ['renderProfile','loadProfile']:
  if not re.search(r'\bfunction\s+'+name+r'\s*\(',profile):raise ValueError('Не подтверждена функция профиля '+name+'. Сайт не изменён.')
 if 'profile-grid' not in profile or not re.search(r'\bdata-profile(?:\s|=|>)',html):raise ValueError('Не подтверждено место настроек защиты в профиле.')
 positions={}
 for name in ['profile.js','app.js','account-security.js']:
  pattern=r'''<script\b[^>]*\bsrc\s*=\s*["'](?:\./)?'''+re.escape(name)+r'''(?:\?[^"']*)?["']'''
  matches=list(re.finditer(pattern,html,re.I))
  if len(matches)!=1:raise ValueError('Не подтверждено единственное подключение '+name)
  positions[name]=matches[0].start()
 if any(positions[name]>positions['account-security.js'] for name in ['profile.js','app.js']):raise ValueError('Не подтверждён порядок загрузки настроек защиты.')
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
 mode=validate_security_script(old,manifest)
 app=(local/'app/app.js').read_bytes().decode('utf-8')
 html=(local/'app/index.html').read_bytes().decode('utf-8')
 if mode=='replace-observed':validate_host_contract(local,app,html)
 for patch in manifest['appPatches']:app=replace_once(app,patch['before'],patch['after'],'app.js')
 result['app/app.js']=app.encode('utf-8')
 for name in ['app.js','account-security.js']:html=include(html,name,'20261026-trust-foundation')
 for path in ['index.html','app/index.html']:
  text=html if path.startswith('app/') else (local/path).read_bytes().decode('utf-8')
  before='<a href="/legal/">';after='<a href="/security/">Данные и безопасность</a> '+before
  text=replace_once(text,before,after,path)
  result[path]=text.encode('utf-8')
 out.mkdir(parents=True,exist_ok=True)
 for name,data in result.items():
  p=out/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except ValueError as error:raise SystemExit(str(error))
