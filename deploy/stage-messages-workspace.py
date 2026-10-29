from pathlib import Path
import re,sys
VERSION='20261014-messages-workspace'
ASSETS=['messages.js','messages.css','messages-actions.js']
def region(html):
 starts=list(re.finditer(r'^\s*<section\b[^>\n]*\bdata-view="messages"[^>\n]*>',html,re.M));ends=list(re.finditer(r'^\s*<section\b[^>\n]*\bdata-view="lots"[^>\n]*>',html,re.M))
 if len(starts)!=1 or len(ends)!=1 or starts[0].start()>=ends[0].start():raise ValueError('Не подтверждены границы раздела сообщений.')
 return starts[0].start(),ends[0].start()
def stage(local,incoming,out):
 local,incoming,out=Path(local),Path(incoming),Path(out)
 html=(local/'index.html').read_text();source=(local/'app.js').read_text();new=(incoming/'index.html').read_text()
 for name in ['renderConversations','renderActiveConversation']:
  if f"function {name}() {{\n  if (typeof renderMessagesWorkspace === 'function' && renderMessagesWorkspace()) return;" not in source:raise ValueError('Сначала требуется установка базового раздела сообщений. Файлы не изменены.')
 a,b=region(html);c,d=region(new);html=html[:a]+new[c:d]+html[b:]
 for name in ASSETS:
  tag='link' if name.endswith('.css') else 'script';attribute='href' if tag=='link' else 'src'
  pattern=rf'<{tag}\b[^>]*{attribute}=["\']{re.escape(name)}(?:\?[^"\']*)?["\'][^>]*(?:></script>|>)'
  matches=list(re.finditer(pattern,html))
  if len(matches)>1:raise ValueError('Дубли подключений. Файлы не изменены.')
  html=re.sub(pattern,'',html)
 if html.count('</head>')!=1:raise ValueError('Не подтверждён head.')
 html=html.replace('</head>',f'<link rel="stylesheet" href="messages.css?v={VERSION}">\n</head>',1)
 pattern=r'<script\b[^>]*src=["\']app\.js(?:\?[^"\']*)?["\'][^>]*></script>'
 matches=list(re.finditer(pattern,html))
 if len(matches)!=1:raise ValueError('Не подтверждено подключение app.js.')
 tag=matches[0].group();replacement=f'<script src="messages.js?v={VERSION}" defer></script>\n'+tag+f'\n<script src="messages-actions.js?v={VERSION}" defer></script>'
 html=re.sub(pattern,lambda _:replacement,html)
 if re.search(r'^(<<<<<<<|=======|>>>>>>>)',html,re.M):raise ValueError('Конфликт HTML. Файлы не изменены.')
 out.mkdir(parents=True,exist_ok=True);(out/'index.html').write_text(html)
 for name in ASSETS:(out/name).write_bytes((incoming/name).read_bytes())
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (OSError,ValueError) as e:raise SystemExit(str(e))
