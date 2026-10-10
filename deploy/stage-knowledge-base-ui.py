from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ASSETS = ('knowledge-base.js', 'knowledge-base.css', 'knowledge-base.test.mjs')
VERSION = '20261010-knowledge-base'


def view_span(html):
    class ViewParser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.lines = [0]
            for match in re.finditer('\n',html): self.lines.append(match.end())
            self.depth=0; self.start=None; self.spans=[]
        def char_offset(self):
            line,col=self.getpos(); return self.lines[line-1]+col
        def handle_starttag(self,tag,attrs):
            if tag!='section': return
            attrs=dict(attrs)
            if self.depth: self.depth+=1
            elif attrs.get('data-view')=='guide':
                self.start=self.char_offset(); self.depth=1
        def handle_endtag(self,tag):
            if tag!='section' or not self.depth: return
            self.depth-=1
            if not self.depth:
                self.spans.append((self.start,self.char_offset()+len('</section>')))
    parser=ViewParser();parser.feed(html)
    if parser.depth or len(parser.spans)!=1:
        raise ValueError('Раздел базы знаний не распознан; кабинет не изменён.')
    return parser.spans[0]


def stage(local,incoming,out):
    local,incoming,out=map(Path,(local,incoming,out))
    html=(local/'index.html').read_text()
    if html.count('</head>')!=1 or html.count('</body>')!=1 or re.search(r'^(<<<<<<<|=======|>>>>>>>)',html,re.M):
        raise ValueError('Разметка кабинета не подтверждена.')
    controller=(local/'app.js').read_text()
    if 'function setView(' not in controller or '[data-view-link]' not in controller or 'data-open-connect' not in controller:
        raise ValueError('Навигация кабинета не подтверждена.')
    fresh=(incoming/'index.html').read_text()
    start,end=view_span(html);a,b=view_span(fresh)
    html=html[:start]+fresh[a:b]+html[end:]
    for asset,tag,attr in [('knowledge-base.css','link','href'),('knowledge-base.js','script','src')]:
        pattern=r'^[ \t]*<'+tag+r'\b[^\n]*'+attr+r'="'+re.escape(asset)+r'(?:\?[^"\n]*)?"[^\n]*>(?:</script>)?\n?'
        html=re.sub(pattern,'',html,flags=re.M)
    html=re.sub(r'^[ \t]*</head>', '  <link rel="stylesheet" href="knowledge-base.css?v='+VERSION+'">\n  </head>',html,count=1,flags=re.M)
    html=html.replace('</body>','  <script src="knowledge-base.js?v='+VERSION+'" defer></script>\n</body>',1)
    files={name:(incoming/name).read_bytes() for name in ASSETS}
    files.update({'index.html':html.encode(),'plugin-rarity.js':(local/'plugin-rarity.js').read_bytes()})
    out.mkdir(parents=True,exist_ok=True)
    for name,data in files.items(): (out/name).write_bytes(data)


if __name__=='__main__':
    try: stage(*sys.argv[1:])
    except (OSError,ValueError) as error: raise SystemExit(str(error))
