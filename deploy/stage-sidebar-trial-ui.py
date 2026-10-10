from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ASSETS=('sidebar-trial.js','sidebar-trial.css','sidebar-trial.test.mjs')
VERSION='20261010-sidebar-trial'

def card_span(html):
    class Parser(HTMLParser):
        def __init__(self):
            super().__init__();self.lines=[0]+[m.end() for m in re.finditer('\n',html)];self.depth=0;self.tag=None;self.start=0;self.spans=[]
        def position(self):
            line,col=self.getpos();return self.lines[line-1]+col
        def handle_starttag(self,tag,attrs):
            a=dict(attrs)
            if self.depth:
                if tag==self.tag:self.depth+=1
            elif tag in ('div','aside') and ('support-card' in a.get('class','').split() or 'data-sidebar-trial' in a):
                self.tag=tag;self.depth=1;self.start=self.position()
        def handle_endtag(self,tag):
            if self.depth and tag==self.tag:
                self.depth-=1
                if not self.depth:self.spans.append((self.start,self.position()+len('</'+tag+'>')))
    parser=Parser();parser.feed(html)
    if parser.depth or len(parser.spans)!=1:raise ValueError('Плашка боковой панели не распознана; кабинет не изменён.')
    return parser.spans[0]

def stage(local,incoming,out):
    local,incoming,out=map(Path,(local,incoming,out))
    html=(local/'index.html').read_text();fresh=(incoming/'index.html').read_text()
    if html.count('</head>')!=1 or html.count('</body>')!=1:raise ValueError('Разметка кабинета не подтверждена.')
    a,b=card_span(html);c,d=card_span(fresh);html=html[:a]+fresh[c:d]+html[b:]
    for asset,tag,attr in [('sidebar-trial.css','link','href'),('sidebar-trial.js','script','src')]:
        html=re.sub(r'^[ \t]*<'+tag+r'\b[^\n]*'+attr+r'="'+re.escape(asset)+r'(?:\?[^"\n]*)?"[^\n]*>(?:</script>)?\n?','',html,flags=re.M)
    html=re.sub(r'^[ \t]*</head>','  <link rel="stylesheet" href="sidebar-trial.css?v='+VERSION+'">\n  </head>',html,count=1,flags=re.M)
    html=html.replace('</body>','  <script src="sidebar-trial.js?v='+VERSION+'" defer></script>\n</body>',1)
    files={name:(incoming/name).read_bytes() for name in ASSETS}
    for filename,label in [('billing.js','Пробный доступ · 3 дня'),('admin-panel.js','Пробный · 3 дня')]:
        text=(local/filename).read_text()
        if not re.search(r"trial_3d\s*:",text):
            text,count=re.subn(r"(pro_demo\s*:\s*'[^']*')",lambda m:m[0]+",trial_3d:'"+label+"'",text,count=1)
            if count!=1:raise ValueError('Названия тарифов не распознаны: '+filename)
        if filename=='admin-panel.js' and "['trial_3d'" not in text:
            text,count=re.subn(r"(\['pro_demo',\s*'[^']*'\])",lambda m:m[0]+",['trial_3d','Пробный · 3 дня']",text,count=1)
            if count!=1:raise ValueError('Фильтр тарифов администратора не распознан.')
        if filename=='admin-panel.js':
            text=text.replace("field('Окончание подписки','Срок пока не учитывается')", "field('Окончание подписки',u.workspace.plan.expiresAt ? adminDate(u.workspace.plan.expiresAt) : 'Срок пока не учитывается')")
        files[filename]=text.encode()
        html=re.sub(r'('+re.escape(filename)+r')\?[^"\s]+',r'\1?v='+VERSION,html)
    files['index.html']=html.encode();out.mkdir(parents=True,exist_ok=True)
    for filename,data in files.items():(out/filename).write_bytes(data)

if __name__=='__main__':
    try:stage(*sys.argv[1:])
    except (OSError,ValueError) as error:raise SystemExit(str(error))
