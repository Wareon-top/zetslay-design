"""Patch only the three connection functions; preserve other VPS changes."""
from pathlib import Path
import re,sys
VERSION='20261024-bot-password-step'
REGIONS=(('// Live wizard mirrors the backend onboarding journey:', '\nfunction renderConnectionWizard()'),('function renderConnectionWizard()', '\nasync function refreshConnectionWizard()'),('async function refreshConnectionWizard()', '\nfunction setModal('),('async function advanceConnectionWizard()', '\nfunction bindInteractions()'))
def section(text,start,end):
 if text.count(start)!=1 or text.count(end)!=1:raise ValueError('Не подтверждена версия мастера: '+start)
 a=text.index(start);b=text.index(end,a);return a,b

def stage(local,incoming,out):
 local,incoming,out=map(Path,(local,incoming,out));app=(local/'app.js').read_text();fresh=(incoming/'app.js').read_text();html=(local/'index.html').read_text()
 if not re.search(r'<script\b[^>]*src="app\.js(?:\?[^\"]*)?"',html):raise ValueError('Не найден основной скрипт кабинета.')
 for start,end in REGIONS:
  a,b=section(app,start,end);x,y=section(fresh,start,end);app=app[:a]+fresh[x:y]+app[b:]
 html=re.sub(r'(src="app\.js)(?:\?[^\"]*)?("[^>]*>)',lambda m:m[1]+'?v='+VERSION+m[2],html)
 for name in ('connection-wizard-ui.js','connection-wizard-ui.css'):
  attr='src' if name.endswith('.js') else 'href'
  pattern=attr+r'="'+re.escape(name)+r'(?:\?[^\"]*)?"'
  if re.search(pattern,html):html=re.sub(pattern,attr+'="'+name+'?v='+VERSION+'"',html)
  elif attr=='src':html=re.sub(r'(<script\b[^>]*src="app\.js[^\"]*"[^>]*></script>)',r'\1\n<script src="'+name+'?v='+VERSION+'" defer></script>',html)
  else:html=html.replace('</head>','<link rel="stylesheet" href="'+name+'?v='+VERSION+'">\n</head>',1)
 out.mkdir(parents=True,exist_ok=True)
 (out/'app.js').write_text(app);(out/'index.html').write_text(html)
 for name in ('connection-wizard-ui.js','connection-wizard-ui.css','connection-wizard-ui.test.mjs'):(out/name).write_bytes((incoming/name).read_bytes())
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (OSError,ValueError) as e:raise SystemExit(str(e))
