from pathlib import Path
import importlib.util
import re
import sys
VERSION='20261013-audit-reliability'
def require(ok,message):
    if not ok:raise ValueError(message+'. Сайт не изменён.')
def stage(local,incoming,out):
    local,incoming,out=map(Path,(local,incoming,out))
    require(not out.exists(),'Каталог результата уже существует')
    for name in ['app.js','kosell-rent.js','overview.js','admin-panel.js','index.html']:
        require((local/name).is_file() and (incoming/name).is_file(),'Не найден '+name)
        require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)',(local/name).read_text(),re.M),'Конфликт в '+name)
    # Include the earlier Kosell recovery patch even if that deployment failed.
    spec=importlib.util.spec_from_file_location('offer_recovery',incoming.parent/'deploy/stage-kosell-offer-recovery.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    module.stage(local,incoming,out)
    app=(local/'app.js').read_text();desired=(incoming/'app.js').read_text()
    begin='async function apiRequest(';end='\nfunction accountInitials('
    require(app.count(begin)==desired.count(begin)==app.count(end)==desired.count(end)==1,'Не подтверждена функция API')
    app=app[:app.index(begin)]+desired[desired.index(begin):desired.index(end)]+app[app.index(end):]
    line="  FULFILLMENT_CONFLICT: 'Лот или заказ назначен нескольким плагинам выдачи. Удалите лишние привязки и проверьте заказ; повторная покупка заблокирована.',\n"
    if '  FULFILLMENT_CONFLICT:' not in app:
        require(app.count('  RATE_LIMITED:')==1,'Не найден словарь ошибок')
        app=app.replace('  RATE_LIMITED:',line+'  RATE_LIMITED:',1)
    (out/'app.js').write_text(app)
    kosell=(out/'kosell-rent.js').read_text();wanted=(incoming/'kosell-rent.js').read_text()
    old="${t.code?`<p>${escapeHtml(t.code)}</p>`:''}"
    target=re.search(r"\$\{t\.code\?`<p>\$\{escapeHtml\(t\.code==='FULFILLMENT_CONFLICT'.*?</p>`:''\}",wanted)
    require(target is not None,'Нет объяснения ошибок Kosell')
    if old in kosell:require(kosell.count(old)==1,'Неоднозначный список заказов');kosell=kosell.replace(old,target[0],1)
    require(target[0] in kosell,'Не подтверждён список заказов')
    (out/'kosell-rent.js').write_text(kosell)
    overview=(local/'overview.js').read_text();desired=(incoming/'overview.js').read_text()
    pattern=r'^  if \(coverage\) coverage\.textContent = .*;$'
    replacement=re.findall(pattern,desired,re.M);require(len(replacement)==len(re.findall(pattern,overview,re.M))==1,'Не найдено пояснение статистики')
    (out/'overview.js').write_text(re.sub(pattern,lambda m:replacement[0],overview,flags=re.M))
    admin=(local/'admin-panel.js').read_text();desired=(incoming/'admin-panel.js').read_text()
    start='<div><span>Открытые обращения пользователей</span><strong>${d.openRequests}</strong></div>'
    end='<p class="admin-note">Обращения доступны'
    require(admin.count(start)==desired.count(start)==admin.count(end)==desired.count(end)==1,'Не подтверждён контроль сервиса')
    a=admin.index(start)+len(start);b=admin.index(end,a);x=desired.index(start)+len(start);y=desired.index(end,x)
    (out/'admin-panel.js').write_text(admin[:a]+desired[x:y]+admin[b:])
    html=(out/'index.html').read_text()
    for name in ['app.js','kosell-rent.js','overview.js','admin-panel.js']:
        pattern=r'(<script\b[^>]*\bsrc=["\'])'+re.escape(name)+r'(?:\?[^"\']*)?(["\'][^>]*>)'
        require(len(re.findall(pattern,html))==1,'Не подтверждён модуль '+name)
        html=re.sub(pattern,lambda m:m[1]+name+'?v='+VERSION+m[2],html)
    (out/'index.html').write_text(html)
if __name__=='__main__':
    try:stage(*sys.argv[1:])
    except (OSError,ValueError) as e:print(e,file=sys.stderr);sys.exit(1)
