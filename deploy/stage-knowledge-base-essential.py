"""Replace only guide content, preserving the installed video and proxy banners."""
from html.parser import HTMLParser
from pathlib import Path
import re,sys
VERSION='20261025-kb-essential'
ASSETS=('knowledge-base.js','knowledge-base.css')

def sections(html):
 class Parser(HTMLParser):
  def __init__(self):
   super().__init__();self.lines=[0]+[m.end() for m in re.finditer('\n',html)];self.stack=[];self.spans=[]
  def char_offset(self):line,col=self.getpos();return self.lines[line-1]+col
  def handle_starttag(self,tag,attrs):
   if tag=='section':self.stack.append((self.char_offset(),dict(attrs)))
  def handle_endtag(self,tag):
   if tag=='section' and self.stack:
    start,attrs=self.stack.pop();self.spans.append((start,self.char_offset()+len('</section>'),attrs))
 p=Parser();p.feed(html)
 if p.stack:raise ValueError('Не подтверждены границы разделов. Файлы не изменены.')
 return p.spans

def inject(html,template):
 if html.count('</head>')!=1 or html.count('</body>')!=1:raise ValueError('Не подтверждена структура кабинета')
 spans=sections(html);guide=[s for s in spans if s[2].get('data-view')=='guide']
 if len(guide)!=1:raise ValueError('Не найдена единственная база знаний')
 start,end,_=guide[0]
 for marker,attribute in [('ZETSLAY_KEEP_VIDEO','data-video-guide'),('ZETSLAY_KEEP_PROXY','data-proxy-invite')]:
  found=[s for s in spans if start<s[0]<s[1]<end and s[2].get(attribute)=='guide']
  if len(found)!=1:raise ValueError('Не подтверждён баннер '+attribute+'. Он не будет удалён.')
  if template.count('<!-- '+marker+' -->')!=1:raise ValueError('Не подтверждён шаблон базы знаний')
  a,b,_=found[0];template=template.replace('<!-- '+marker+' -->',html[a:b])
 html=html[:start]+template.strip()+html[end:]
 for asset,tag,attr in [('knowledge-base.css','link','href'),('knowledge-base.js','script','src')]:
  pattern=r'(<'+tag+r'\b[^>]*\b'+attr+r'=["\'])'+re.escape(asset)+r'(?:\?[^"\']*)?(["\'])'
  if len(re.findall(pattern,html))!=1:raise ValueError('Не подтверждено подключение '+asset)
  html=re.sub(pattern,lambda m:m[1]+asset+'?v='+VERSION+m[2],html)
 return html

def stage(local,incoming,out):
 local,incoming,out=map(Path,(local,incoming,out))
 html=inject((local/'index.html').read_text(),(incoming/'knowledge-base-essential.html').read_text())
 data={name:(incoming/name).read_bytes() for name in ASSETS};data['index.html']=html.encode()
 out.mkdir(parents=True,exist_ok=True)
 for name,content in data.items():(out/name).write_bytes(content)

if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (OSError,ValueError) as error:raise SystemExit(str(error))
