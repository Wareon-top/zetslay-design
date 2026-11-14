#!/usr/bin/env python3
"""Publish only the cabinet's presentation bundle and append its includes.
Never replaces host app/controllers, auth, legal pages, config, API or databases.
"""
from pathlib import Path
import argparse,hashlib,json,os,re,shutil,tempfile,urllib.request

CSS=['tokens','zetslay-ui','profile','cabinet','catalog','plugin-page','production']
JS=['icons','model','production']
RELEASE='20261114-production'
MARKER='ZETSLAY_CABINET_V3'
def sha(data):return hashlib.sha256(data).hexdigest()
def asset_directory(path,app):
    missing=[];current=path
    while not current.exists():
        if current==app.parent or app not in [current,*current.parents]:raise ValueError('Путь ассета вышел за app/')
        missing.append(current);current=current.parent
    for directory in reversed(missing):directory.mkdir(mode=0o755);os.chmod(directory,0o755)
def atomic(path,data,mode=0o644):
    fd,tmp=tempfile.mkstemp(prefix='.zs-publish-',dir=path.parent)
    try:
        with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
        os.chmod(tmp,mode);os.replace(tmp,path)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)
def includes(html):
    if html.count('</head>')!=1 or html.count('</body>')!=1:raise ValueError('Не распознаны границы HTML кабинета')
    if MARKER in html:
        if html.count('<!-- '+MARKER+' CSS -->')!=1 or html.count('<!-- '+MARKER+' JS -->')!=1:raise ValueError('Неоднозначные подключения новой версии')
        # An installed version is immutable; unknown edits must be reviewed.
        for kind,names,tag in [('CSS',CSS,'css'),('JS',JS,'js')]:
            for name in names:
                expected=f'cabinet-v3/{name}.{tag}?v={RELEASE}'
                if expected not in html:raise ValueError('Уже установлена другая редакция кабинета')
        return html
    if 'cabinet-v3/' in html:raise ValueError('Найдены неуправляемые подключения cabinet-v3')
    css='<!-- '+MARKER+' CSS -->\n'+'\n'.join(f'<link rel="stylesheet" href="cabinet-v3/{n}.css?v={RELEASE}">' for n in CSS)
    js='<!-- '+MARKER+' JS -->\n'+'\n'.join(f'<script src="cabinet-v3/{n}.js?v={RELEASE}" defer></script>' for n in JS)
    # The reviewed older checkout omitted these already implemented host modules.
    # A production index that already loads them is left exactly intact.
    for name in ['workspace-upgrade','event-center','basic-automation']:
        if not re.search(r'href=["\x27]'+re.escape(name)+r'\.css(?:[?"\x27])',html):css=f'<link rel="stylesheet" href="{name}.css?v=20261114-host">\n'+css
    if not re.search(r'src=["\x27]workspace-upgrade\.js(?:[?"\x27])',html):js='<script src="workspace-upgrade.js?v=20261114-host" defer></script>\n'+js
    if not re.search(r'src=["\x27]basic-automation\.js(?:[?"\x27])',html):js='<script src="basic-automation.js?v=20261114-host" defer></script>\n'+js
    return html.replace('</head>',css+'\n</head>').replace('</body>',js+'\n</body>')
def preflight(source,target):
    manifest=json.loads((source/'deploy/cabinet-v3-manifest.json').read_text(encoding='utf-8'))
    if target.is_symlink() or (target/'app').is_symlink():raise ValueError('Каталог сайта не должен быть символьной ссылкой')
    index=target/'app/index.html'
    if index.is_symlink():raise ValueError('index.html не должен быть символьной ссылкой')
    before=index.read_bytes();updated=includes(before.decode('utf-8')).encode('utf-8')
    for rel,allowed in manifest['host'].items():
        p=target/rel
        if not p.is_file() or p.is_symlink():raise ValueError('Нет обязательного модуля: '+rel)
        data=p.read_bytes().replace(b'\r\n',b'\n')
        if sha(data) not in allowed:raise ValueError('Непроверенная версия '+rel+'; исходники не изменены')
    for entry in manifest['files']:
        rel=entry['path']
        if not rel.startswith('app/cabinet-v3/') or '..' in Path(rel).parts:raise ValueError('Неверный путь в manifest')
        data=(source/rel).read_bytes()
        if sha(data)!=entry['sha256']:raise ValueError('Нарушена целостность пакета: '+rel)
        p=target/rel
        if any(q.is_symlink() for q in [p,*p.parents] if q!=target.parent):raise ValueError('Символьная ссылка в целевом пути')
        if p.exists() and p.read_bytes()!=data:raise ValueError('Существующий файл отличается: '+rel)
    return manifest,before,updated
def publish(source,target,backup_root,verify_url=None,preflight_only=False):
    manifest,before,updated=preflight(source,target)
    if preflight_only:return {'preflight':True,'files':len(manifest['files'])}
    backup_root.mkdir(parents=True,exist_ok=True)
    backup=Path(tempfile.mkdtemp(prefix='zetslay-before-cabinet-v3.',dir=backup_root));os.chmod(backup,0o700)
    (backup/'index.html').write_bytes(before);os.chmod(backup/'index.html',0o600)
    new=[];index=target/'app/index.html'
    try:
        for entry in manifest['files']:
            rel=entry['path'];p=target/rel
            if not p.exists():asset_directory(p.parent,target/'app');atomic(p,(source/rel).read_bytes());new.append(rel)
        if index.read_bytes()!=before:raise ValueError('index.html изменился во время установки')
        atomic(index,updated)
        if verify_url:
            checks={'app/index.html':updated,'app/cabinet-v3/production.js':(source/'app/cabinet-v3/production.js').read_bytes(),'app/cabinet-v3/production.css':(source/'app/cabinet-v3/production.css').read_bytes()}
            for rel,expected in checks.items():
                url=verify_url.rstrip('/')+'/'+rel+'?zs_release='+RELEASE
                req=urllib.request.Request(url,headers={'Accept-Encoding':'identity','Cache-Control':'no-cache'})
                actual=urllib.request.urlopen(req,timeout=15).read()
                if actual!=expected:raise ValueError('Не подтверждена публикация '+rel)
        state={'release':RELEASE,'created':new,'indexBefore':sha(before),'indexAfter':sha(updated),'files':manifest['files']}
        (backup/'rollback.json').write_text(json.dumps(state,indent=2),encoding='utf-8');os.chmod(backup/'rollback.json',0o600)
        return {'installed':True,'files':len(manifest['files']),'backup':str(backup),'publicChecked':bool(verify_url)}
    except BaseException:
        if index.read_bytes()==updated:atomic(index,before)
        expected={f['path']:f['sha256'] for f in manifest['files']}
        for rel in reversed(new):
            p=target/rel
            if p.is_file() and sha(p.read_bytes())==expected[rel]:p.unlink()
        raise
def rollback(target,backup):
    state=json.loads((backup/'rollback.json').read_text(encoding='utf-8'));p=target/'app/index.html'
    if p.is_symlink() or sha(p.read_bytes())!=state['indexAfter']:raise ValueError('index.html изменился после установки; автоматический откат остановлен')
    data=(backup/'index.html').read_bytes()
    if sha(data)!=state['indexBefore']:raise ValueError('Нарушена целостность резервной копии')
    atomic(p,data)
    # Assets may still be in use by already open tabs. Leave them until a later cleanup.
    return {'rolledBack':True,'assetsRetainedForOpenTabs':True}
def main():
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,default=Path(__file__).resolve().parents[1]);p.add_argument('--site',type=Path,default=Path('/opt/zetslay-site'));p.add_argument('--backup-root',type=Path,default=Path('/root'));p.add_argument('--preflight',action='store_true');p.add_argument('--verify-url',default=None);p.add_argument('--rollback',type=Path)
    a=p.parse_args()
    result=rollback(a.site,a.rollback) if a.rollback else publish(a.source,a.site,a.backup_root,a.verify_url,a.preflight)
    print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':
    try:main()
    except Exception as e:raise SystemExit('Кабинет не обновлён: '+str(e))
