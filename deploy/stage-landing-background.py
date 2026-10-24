"""Stage only the ASCII effect/glow and their cache keys, preserving live markup."""
from pathlib import Path
import re,sys
VERSION='20261024-ascii'
ASSETS=('landing-hero.js','landing-orderflow.css')
def stage(local,incoming,out):
 local,incoming,out=map(Path,(local,incoming,out));html=(local/'index.html').read_text()
 if 'data-landing-hero="orderflow"' not in html or not re.search(r'<canvas\b[^>]*data-hero-(?:particles|ascii)',html):raise ValueError('Не найден текущий первый экран с монетами. Сайт не изменён.')
 for name,tag,attr in [('landing-hero.js','script','src'),('landing-orderflow.css','link','href')]:
  pattern=r'(<'+tag+r'\b[^>]*\b'+attr+r'=["\'])'+re.escape(name)+r'(?:\?[^"\']*)?(["\'])'
  html,count=re.subn(pattern,lambda m:m[1]+name+'?v='+VERSION+m[2],html)
  if count!=1:raise ValueError('Не найдена единственная ссылка '+name+'. Сайт не изменён.')
 def canvas(match):
  text=match.group()
  return text if re.search(r'\bdata-hero-ascii(?:\s|>)',text) else text[:-1]+' data-hero-ascii>'
 html,count=re.subn(r'<canvas\b[^>]*\bdata-hero-(?:particles|ascii)(?:\s[^>]*)?>',canvas,html)
 if count!=1:raise ValueError('Не найден единственный декоративный canvas. Сайт не изменён.')
 data={name:(incoming/name).read_bytes() for name in ASSETS}
 out.mkdir(parents=True,exist_ok=True);(out/'index.html').write_text(html)
 for name,content in data.items():(out/name).write_bytes(content)
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (OSError,ValueError) as e:raise SystemExit(str(e))
