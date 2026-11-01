from pathlib import Path
import re
import sys
VERSION='20261013-lot-management'
def require(ok,message):
    if not ok:raise ValueError(message+'. Сайт не изменён.')
def swap(text,incoming,start,end):
    require(text.count(start)==incoming.count(start)==text.count(end)==incoming.count(end)==1,'Не подтверждён участок '+start)
    a=text.index(start);b=text.index(end,a);c=incoming.index(start);d=incoming.index(end,c)
    return text[:a]+incoming[c:d]+text[b:]
def stage(local,incoming,out):
    local,incoming,out=map(Path,(local,incoming,out))
    html=(local/'app/index.html').read_text();lots=(local/'app/lots.js').read_text();desired=(incoming/'app/lots.js').read_text()
    for text in (html,lots):require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)',text,re.M),'Конфликт')
    lots=swap(lots,desired,'function lotRowsMarkup(','\nfunction lotsEmptyMarkup(')
    lots=swap(lots,desired,'function renderLotDetail(','\nfunction renderLotWorkspace(')
    lots=lots.replace('/* Inventory uses its own authenticated GET route and never writes to FunPay. */','/* Inventory reads are separate from explicit owner-confirmed lot actions. */')
    if 'data-lot-operations' not in html:
        marker='<div class="inventory-tools">';require(html.count(marker)==1,'Не найден раздел товаров')
        html=html.replace(marker,'<section class="lot-operations" data-lot-operations hidden aria-label="Последние изменения лотов"></section>\n            '+marker,1)
    require(html.count('data-lot-operations')==1,'Дубли списка операций')
    html,count=re.subn(r'\s*<script\b[^>]*src="lot-management.js(?:\?[^"]*)?"[^>]*>\s*</script>','',html);require(count<=1,'Дубли управления лотами')
    html,count=re.subn(r'(<script\b[^>]*src="lots.js)(?:\?[^"]*)?("[^>]*>\s*</script>)',r'\1?v='+VERSION+r'\2\n    <script src="lot-management.js?v='+VERSION+r'" defer></script>',html);require(count==1,'Не найден модуль списка лотов')
    html,count=re.subn(r'\s*<link\b[^>]*href="lot-management.css(?:\?[^"]*)?"[^>]*>','',html);require(count<=1,'Дубли стилей')
    require(html.count('</head>')==html.count('</body>')==1,'Не подтверждена структура HTML')
    html=html.replace('</head>','    <link rel="stylesheet" href="lot-management.css?v='+VERSION+'">\n</head>',1)
    files={'app/index.html':html,'app/lots.js':lots}
    for name in ['lot-management.js','lot-management.css']:files['app/'+name]=(incoming/'app'/name).read_text()
    out.mkdir(parents=True,exist_ok=False)
    for name,content in files.items():
        path=out/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(content)
if __name__=='__main__':
    try:stage(*sys.argv[1:])
    except (ValueError,OSError) as e:print(e,file=sys.stderr);sys.exit(1)
