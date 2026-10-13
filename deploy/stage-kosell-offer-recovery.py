from pathlib import Path
import re
import sys
VERSION='20261013-offer-recovery'
def require(ok,message):
    if not ok:raise ValueError(message+'. Сайт не изменён.')
def stage(local,incoming,out):
    local,incoming,out=map(Path,(local,incoming,out))
    current=(local/'kosell-rent.js').read_text();desired=(incoming/'kosell-rent.js').read_text();html=(local/'index.html').read_text()
    for text in (current,html):require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)',text,re.M),'Конфликт')
    begin='function kosellOfferDiagnosticsMarkup(';end='function kosellAutomationFields('
    require(desired.count(begin)==desired.count(end)==current.count(end)==1,'Не подтверждён модуль Kosell')
    helper=desired[desired.index(begin):desired.index(end)]
    if begin in current:
        require(current.count(begin)==1,'Дубли диагностики')
        current=current[:current.index(begin)]+helper+current[current.index(end):]
    else:current=current.replace(end,helper+end,1)
    old="${j.code?`<p>${escapeHtml(j.code)}</p>`:''}";new='${kosellOfferDiagnosticsMarkup(j)}'
    if old in current:
        require(current.count(old)==1 and current.count(new)==0,'Не подтверждён список заданий')
        current=current.replace(old,new,1)
    require(current.count(new)==1,'Не найден список заданий')
    pattern=r'(<script\b[^>]*\bsrc=["\'])kosell-rent\.js(?:\?[^"\']*)?(["\'][^>]*>)'
    matches=list(re.finditer(pattern,html));app=re.search(r'<script\b[^>]*\bsrc=["\']app\.js(?:\?[^"\']*)?["\'][^>]*>',html)
    require(len(matches)==1 and app is not None and matches[0].start()<app.start() and re.search(r'\bdefer\b',matches[0].group()),'Не подтверждён порядок модулей')
    html=re.sub(pattern,lambda m:m[1]+'kosell-rent.js?v='+VERSION+m[2],html)
    out.mkdir(parents=True,exist_ok=False);(out/'kosell-rent.js').write_text(current);(out/'index.html').write_text(html)
if __name__=='__main__':
    try:stage(*sys.argv[1:])
    except (OSError,ValueError) as e:print(e,file=sys.stderr);sys.exit(1)
