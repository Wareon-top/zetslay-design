from pathlib import Path
import re
import sys

VERSION='20261018-storefront-limit-wait'
def require(ok,message):
    if not ok: raise ValueError(message+'. Сайт не изменён.')

def stage(local,incoming,out):
    local,incoming,out=map(Path,(local,incoming,out))
    html=(local/'index.html').read_text()
    require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)',html,re.M),'Конфликт в HTML')
    require((local/'kosell-rent.js').is_file(),'Отсутствует основной модуль Kosell')
    require('function kosellCatalogMarkup(' in (local/'kosell-rent.js').read_text(),'Модуль Kosell требует обновления')
    original=r'<script\b[^>]*\bsrc=["\']kosell-rent\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>'
    app=r'<script\b[^>]*\bsrc=["\']app\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>'
    old=list(re.finditer(original,html));main=list(re.finditer(app,html))
    require(len(old)==len(main)==1 and old[0].start()<main[0].start() and 'defer' in old[0].group(),'Не подтверждён порядок модулей')
    addon=r'\s*<script\b[^>]*\bsrc=["\']kosell-storefront\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>'
    require(len(re.findall(addon,html))<=1,'Дубли модуля витрины')
    html=re.sub(addon,'',html)
    html=re.sub(original,lambda m:m.group()+'\n    <script src="kosell-storefront.js?v='+VERSION+'" defer></script>',html,count=1)
    css=r'<link\b[^>]*\bhref=["\']kosell-rent\.css(?:\?[^"\']*)?["\'][^>]*>'
    require(len(re.findall(css,html))==1,'Не найден стиль Kosell')
    addon_css=r'\s*<link\b[^>]*\bhref=["\']kosell-storefront\.css(?:\?[^"\']*)?["\'][^>]*>'
    require(len(re.findall(addon_css,html))<=1,'Дубли стилей витрины')
    html=re.sub(addon_css,'',html)
    html=re.sub(css,lambda m:m.group()+'\n    <link rel="stylesheet" href="kosell-storefront.css?v='+VERSION+'">',html,count=1)
    out.mkdir(parents=True,exist_ok=False)
    (out/'index.html').write_text(html)
    for name in ['kosell-storefront.js','kosell-storefront.css']:
        text=(incoming/name).read_text()
        require(bool(text.strip()) and not re.search(r'^(<<<<<<<|=======|>>>>>>>)',text,re.M),'Повреждён новый модуль')
        (out/name).write_text(text)

if __name__=='__main__':
    try: stage(*sys.argv[1:])
    except (OSError,ValueError) as error: print(error,file=sys.stderr);sys.exit(1)
