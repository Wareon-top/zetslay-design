"""Replace only the marked public landing section; retain installed page bytes."""
import hashlib,json,re,sys
from pathlib import Path
VERSION='20261028'
CSS='landing-security.'+VERSION+'.css'
START='<!-- zetslay-security:start -->'
END='<!-- zetslay-security:end -->'

def stage(local,incoming,out):
 local,incoming,out=map(Path,(local,incoming,out))
 manifest=json.loads((incoming/'landing-security-manifest.json').read_text())
 assets={}
 for name in ['landing-security.html','landing-security.css']:
  data=(incoming/name).read_bytes()
  if hashlib.sha256(data).hexdigest()!=manifest['assets'][name]:raise ValueError('Повреждён файл '+name+'. Сайт не изменён.')
  assets[name]=data
 text=(local/'index.html').read_bytes().decode('utf-8')
 fragment=assets['landing-security.html'].decode('utf-8').rstrip()
 block=START+'\n'+fragment+'\n'+END
 if START in text or END in text:
  if text.count(START)!=1 or text.count(END)!=1 or text.index(START)>text.index(END):raise ValueError('Не подтверждены границы блока безопасности.')
  before,tail=text.split(START);old,after=tail.split(END)
  if len(re.findall(r'''\bid\s*=\s*["']security["']''',old,re.I))!=1 or re.search(r'''\bid\s*=\s*["']security["']''',before+after,re.I):raise ValueError('Не подтверждён единственный блок безопасности.')
  text=before+block+after
 else:
  if re.search(r'''\bid\s*=\s*["']security["']''',text,re.I):raise ValueError('Раздел security уже существует с другим содержимым.')
  anchors=list(re.finditer(r'''<section\b[^>]*\bid\s*=\s*["']faq["'][^>]*>''',text,re.I))
  if len(anchors)==1:position=anchors[0].start()
  elif not anchors and text.count('</main>')==1:position=text.index('</main>')
  else:raise ValueError('Не подтверждено место блока на главной странице.')
  text=text[:position]+block+'\n'+text[position:]
 link='<link rel="stylesheet" href="'+CSS+'" data-zetslay-security-style>'
 pattern=r'<link\b[^>]*\bdata-zetslay-security-style\b[^>]*>'
 matches=list(re.finditer(pattern,text,re.I))
 if len(matches)>1:raise ValueError('Повторяется подключение стилей безопасности.')
 unmarked=re.findall(r'''<link\b(?![^>]*\bdata-zetslay-security-style\b)[^>]*\bhref\s*=\s*["'](?:\./)?landing-security(?:\.[0-9]+)?\.css(?:\?[^"']*)?["'][^>]*>''',text,re.I)
 if unmarked:raise ValueError('Найдено неподтверждённое подключение стилей безопасности.')
 if matches:text=text[:matches[0].start()]+link+text[matches[0].end():]
 elif text.count('</head>')==1:text=text.replace('</head>',link+'\n</head>',1)
 else:raise ValueError('Не подтверждён заголовок главной страницы.')
 out.mkdir(parents=True,exist_ok=True)
 (out/CSS).write_bytes(assets['landing-security.css'])
 (out/'index.html').write_bytes(text.encode('utf-8'))

if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except ValueError as error:raise SystemExit(str(error))
