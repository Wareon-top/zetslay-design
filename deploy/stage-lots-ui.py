"""Replace inventory UI only, retaining VPS auth/profile/catalog/connector edits."""
from pathlib import Path
import re,sys

def require(ok,message):
    if not ok:raise ValueError(message+'. Кабинет не изменён.')

def edit_function(source,name,edit):
    matches=list(re.finditer(r'^(?:async )?function '+name+r'\([^\n]*\) \{.*?^\}\n',source,re.M|re.S))
    require(len(matches)==1,'Не найдена функция '+name)
    match=matches[0];return source[:match.start()]+edit(match.group())+source[match.end():]

def hook(value,code,first=False):
    if code in value:return value
    return value.replace(' {\n',' {\n'+code+'\n',1) if first else value[:-2]+code+'\n}\n'

def stage(local,incoming,out):
    app=(local/'app.js').read_text();html=(local/'index.html').read_text();section=(incoming/'lots-section.html').read_text()
    require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)',app+'\n'+html,re.M),'Маркеры конфликта')
    require(section.count('data-view="lots"')==1 and 'data-lots-workspace' in section and '${' not in section,'Неизвестная новая разметка лотов')
    body="""function renderLots() {
  if (typeof renderLotWorkspace === 'function') { renderLotWorkspace(); return; }
  const target = byId('lot-grid');
  if (target) target.textContent = 'Обновите страницу, чтобы загрузить раздел лотов.';
}
"""
    app=edit_function(app,'renderLots',lambda s:body)
    app=edit_function(app,'resetAccountData',lambda s:hook(s,"  if (typeof resetLotsWorkspace === 'function') resetLotsWorkspace();",True))
    app=edit_function(app,'renderStoreFleet',lambda s:hook(s,"  if (typeof renderLotWorkspace === 'function') renderLotWorkspace();"))
    app=edit_function(app,'setView',lambda s:hook(s,"  if (resolvedView === 'lots' && typeof renderLotWorkspace === 'function') renderLotWorkspace();"))
    app=app.replace("lots: 'Лоты',","lots: 'Лоты и товары',")
    def region(value):
        starts=list(re.finditer(r'^[ \t]*<section\b[^\n]*\bdata-view="lots"[^\n]*>',value,re.M))
        ends=list(re.finditer(r'^[ \t]*<section\b[^\n]*\bdata-view="plugins"[^\n]*>',value,re.M))
        require(len(starts)==len(ends)==1 and starts[0].start()<ends[0].start(),'Не найдены границы раздела лотов')
        return starts[0].start(),ends[0].start()
    start,end=region(html);html=html[:start]+section+'\n'+html[end:]
    for asset,tag,attribute in [('lots.js','script','src'),('lots.css','link','href')]:
        matches=re.findall(r'<'+tag+r'[^>]*'+attribute+r'="'+re.escape(asset)+r'(?:\?[^\"]*)?"',html)
        require(len(matches)<=1,'Дублируется '+asset)
        html=re.sub(r'^[ \t]*<'+tag+r'[^\n]*'+attribute+r'="'+re.escape(asset)+r'(?:\?v=[A-Za-z0-9_-]+)?"[^\n]*>\n?','',html,flags=re.M)
    version='20261005-lots'
    html,n=re.subn(r'^[ \t]*<script src="app\.js(?:\?v=[A-Za-z0-9_-]+)?" defer></script>',lambda m:'    <script src="lots.js?v='+version+'" defer></script>\n    <script src="app.js?v='+version+'" defer></script>',html,flags=re.M)
    require(n==1 and html.count('</head>')==1,'Не найдены подключения ассетов')
    html=re.sub(r'^[ \t]*</head>',lambda m:'    <link rel="stylesheet" href="lots.css?v='+version+'">\n  </head>',html,flags=re.M)
    require(html.index('src="lots.js')<html.index('src="app.js'),'Неверный порядок скриптов')
    out.mkdir(parents=True,exist_ok=True);(out/'app.js').write_text(app);(out/'index.html').write_text(html)
    for name in ['lots.js','lots.css','lots.test.mjs']:(out/name).write_bytes((incoming/name).read_bytes())

if __name__=='__main__':
    try:stage(*(Path(value) for value in sys.argv[1:]))
    except (OSError,ValueError) as error:print(str(error),file=sys.stderr);sys.exit(1)
