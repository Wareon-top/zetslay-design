"""Patch the installed pages and authentication without replacing private HTML."""
from pathlib import Path
import json,re,sys
VERSION='20261025-launch-readiness'
FILES=('app/app.js','app/account-security.js','index.html','app/index.html','robots.txt','sitemap.xml','legal/terms.html','app/launch-readiness.css')

def stage(local,incoming,out):
 local,incoming,out=map(Path,(local,incoming,out))
 files={name:(local/name).read_text() for name in FILES[:4]}
 for patch in json.loads((incoming/'launch-readiness-patches.json').read_text()):
  name,before,after=patch['file'],patch['before'],patch['after']
  if name not in FILES[:2]:raise ValueError('Неизвестный модуль')
  text=files[name]
  if text.count(after)==1 and text.replace(after,'',1).count(before)==0:continue
  candidates=[part for part in [before,*patch.get('alternatives',[])] if text.count(part)==1]
  if len(candidates)!=1:raise ValueError('Не распознан блок '+patch['name']+'. Файлы не изменены.')
  files[name]=text.replace(candidates[0],after,1)
 fragments=json.loads((incoming/'launch-readiness-fragments.json').read_text())
 js=files['app/app.js']
 for declaration in ("let registrationEmail = '';",'let authAttemptRevision = 0;'):
  if declaration not in js:js=js.replace('async function apiRequest(',declaration+'\n\nasync function apiRequest(',1)
 if 'async function resendVerification(' not in js:
  js=js.replace('let telegramLoginTimer = null;',fragments['resendFunction']+'let telegramLoginTimer = null;',1)
 files['app/app.js']=js
 html=files['app/index.html']
 if 'data-auth-confirm-row' not in html:
  anchor='<div class="auth-message" data-auth-message aria-live="polite"></div>'
  if html.count(anchor)!=1:raise ValueError('Не подтверждена форма входа')
  html=html.replace(anchor,fragments['passwordConfirmation']+anchor,1)
 if 'data-auth-resend' not in html:
  anchor='<button class="button button--primary button--wide" type="submit" data-auth-submit>'
  if html.count(anchor)!=1:raise ValueError('Не подтверждена кнопка входа')
  html=html.replace(anchor,fragments['resendButton']+anchor,1)
 html=html.replace('Открылся чат с ботом ZetSlay — нажмите «Начать».','Откройте чат с ботом ZetSlay и нажмите «Начать».')
 for name in ('app.js','account-security.js'):
  pattern=r'(<script\b[^>]*src=["\'])'+re.escape(name)+r'(?:\?[^"\']*)?(["\'])'
  if len(re.findall(pattern,html))!=1:raise ValueError('Не подтверждено подключение '+name)
  html=re.sub(pattern,lambda m:m[1]+name+'?v='+VERSION+m[2],html)
 if 'href="launch-readiness.css' not in html:
  if html.count('</head>')!=1:raise ValueError('Не подтверждён заголовок кабинета')
  html=html.replace('</head>','<link rel="stylesheet" href="launch-readiness.css?v='+VERSION+'">\n</head>',1)
 files['app/index.html']=html
 html=files['index.html']
 # Only these metadata keys are owned by this update. Preserve the full body.
 html=re.sub(r'<link\b[^>]*rel=["\']canonical["\'][^>]*>\s*','',html,flags=re.I)
 html=re.sub(r'<meta\b[^>]*(?:property=["\']og:[^"\']+["\']|name=["\']twitter:[^"\']+["\'])[^>]*>\s*','',html,flags=re.I)
 description='Заказы, сообщения, товары и плагины в одном кабинете. Подключите магазин на FunPay и попробуйте ZetSlay.'
 html=re.sub(r'(<meta\b[^>]*name=["\']description["\'][^>]*content=["\'])[^"\']*',lambda m:m[1]+description,html,count=1,flags=re.I)
 if html.count('</head>')!=1:raise ValueError('Не подтверждён заголовок главной страницы')
 files['index.html']=html.replace('</head>',fragments['landingHead']+'</head>',1)
 for name in FILES[4:]:files[name]=(incoming/name).read_text()
 if not (local/'assets/zetslay-orderflow.webp').is_file():raise ValueError('Не найдено изображение превью ссылки')
 out.mkdir(parents=True,exist_ok=True)
 for name,text in files.items():
  p=out/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)

if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (OSError,ValueError) as error:raise SystemExit(str(error))
