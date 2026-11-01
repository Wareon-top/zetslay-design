"""Install working-bot password settings without replacing local cabinet logic."""
from pathlib import Path
import re,sys
VERSION='20261023-bot-settings-v1'
ASSETS=['bot-settings.js','bot-settings.css','bot-settings.test.mjs']
def stage(local,incoming,out):
 local,incoming,out=map(Path,(local,incoming,out));html=(local/'index.html').read_text();profile=(local/'profile.js').read_text()
 if html.count('</head>')!=1 or html.count('</body>')!=1 or 'data-profile' not in html:raise ValueError('Не подтверждён раздел профиля. Файлы не изменены.')
 old='<button class="button button--ghost" type="button" data-profile-connect>${icon(\'gear\')} Настроить</button>'
 new=old.replace('data-profile-connect','data-bot-settings-open')
 if new not in profile:
  if profile.count(old)!=1:raise ValueError('Не подтверждена кнопка настройки бота. Файлы не изменены.')
  profile=profile.replace(old,new,1)
 profile=profile.replace('Привязка подтверждена. Настройки модулей доступны в вашем боте.','Привязка подтверждена. Нажмите «Настроить», чтобы установить или сменить пароль рабочего бота.')
 for name in ['bot-settings.js','bot-settings.css']:
  pattern=rf'<(?:script|link)\b[^>]*(?:src|href)=["\']{re.escape(name)}(?:\?[^"\']*)?["\'][^>]*(?:></script>|>)'
  if len(re.findall(pattern,html))>1:raise ValueError('Дубли подключения настроек бота.')
  html=re.sub(pattern+r'[ \t]*\r?\n?','',html)
 pattern=r'(<script\b[^>]*src=["\'])profile\.js(?:\?[^"\']*)?(["\'])'
 if len(re.findall(pattern,html))!=1:raise ValueError('Не подтверждено подключение профиля.')
 html=re.sub(pattern,lambda m:m[1]+'profile.js?v='+VERSION+m[2],html)
 html=html.replace('</head>',f'<link rel="stylesheet" href="bot-settings.css?v={VERSION}">\n</head>').replace('</body>',f'<script src="bot-settings.js?v={VERSION}" defer></script>\n</body>')
 outputs={name:(incoming/name).read_text() for name in ASSETS};outputs.update({'index.html':html,'profile.js':profile})
 if re.search(r'^(<<<<<<<|=======|>>>>>>>)',html+'\n'+profile,re.M):raise ValueError('Обнаружен конфликт исходных файлов.')
 for name,content in outputs.items():out.mkdir(parents=True,exist_ok=True);(out/name).write_text(content)
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (ValueError,OSError) as error:raise SystemExit(str(error))
