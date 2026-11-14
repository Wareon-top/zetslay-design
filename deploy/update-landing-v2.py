#!/usr/bin/env python3
"""Install a reviewed landing, keeping host controllers, cabinet and legal texts intact."""
from pathlib import Path, PurePosixPath
import argparse, hashlib, json, os, tempfile, urllib.request

RELEASE='20261114-landing-production2'
FIXED={'index.html','landing-v2.css','landing-v2.js','assets/landing-v2/PROVENANCE.json',
       'legal/legal-controls-20261109.css','legal/privacy-controls-20261109.js'}

def sha(data): return hashlib.sha256(data).hexdigest()

def host_sha(path):
    data=path.read_bytes()
    if path.suffix in {'.html','.css','.js','.json','.txt','.svg'}:data=data.replace(b'\r\n',b'\n')
    return sha(data)

def safe(root,rel):
    parts=PurePosixPath(rel)
    if parts.is_absolute() or '..' in parts.parts or '\\' in rel:raise ValueError('Неверный путь: '+rel)
    p=root.joinpath(*parts.parts)
    if any(q.is_symlink() for q in [p,*p.parents]):raise ValueError('Символьная ссылка в пути: '+rel)
    return p

def allowed(rel):
    return rel in FIXED or (rel.startswith('assets/landing-v2/hq-20261114/') and rel.endswith('.webp'))

def atomic(path,data,mode=0o644):
    fd,temp=tempfile.mkstemp(prefix='.zs-landing-',dir=path.parent)
    try:
        with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
        os.chmod(temp,mode);os.replace(temp,path)
    finally:
        if os.path.exists(temp):os.unlink(temp)

def directories(path,root):
    missing=[]
    while not path.exists():
        if path==root.parent:raise ValueError('Путь вышел за каталог сайта')
        missing.append(path);path=path.parent
    for p in reversed(missing):p.mkdir(mode=0o755);os.chmod(p,0o755)

def preflight(source,site):
    if source.is_symlink() or site.is_symlink():raise ValueError('Каталог не должен быть символьной ссылкой')
    m=json.loads((source/'deploy/landing-v2-manifest.json').read_text(encoding='utf-8'))
    if m['release']!=RELEASE:raise ValueError('Другая редакция пакета')
    entries=m['files'];paths=[x['path'] for x in entries]
    if len(paths)!=len(set(paths)) or not FIXED<=set(paths) or any(not allowed(p) for p in paths):raise ValueError('Непроверенный состав пакета')
    for dep in m['dependencies']:
        p=safe(site,dep['path'])
        if not p.is_file() or host_sha(p) not in dep['allowedSha256']:raise ValueError('Непроверенная зависимость: '+dep['path'])
    for entry in entries:
        rel=entry['path'];data=safe(source,rel).read_bytes();target=safe(site,rel)
        if sha(data)!=entry['sha256']:raise ValueError('Повреждён пакет: '+rel)
        if target.exists() and host_sha(target) not in [entry['sha256'],*entry.get('allowedBefore',[])]:raise ValueError('Неизвестные правки сохранены: '+rel)
        if rel=='index.html' and not target.is_file():raise ValueError('Нет исходной главной')
    return m

def publish(source,site,backups,verify_url=None,preflight_only=False):
    m=preflight(source,site)
    if preflight_only:return {'preflight':True,'files':len(m['files'])}
    backups.mkdir(parents=True,exist_ok=True)
    backup=Path(tempfile.mkdtemp(prefix='zetslay-before-landing-v2.',dir=backups));os.chmod(backup,0o700)
    index=site/'index.html';before=index.read_bytes();atomic(backup/'index.html',before,0o600)
    after=(source/'index.html').read_bytes();created=[]
    try:
        # Assets first, then the single page entry point.
        for entry in m['files']:
            rel=entry['path']
            if rel=='index.html':continue
            target=safe(site,rel);data=(source/rel).read_bytes()
            if target.exists():
                if host_sha(target)!=entry['sha256']:raise ValueError('Ассет изменён во время подготовки: '+rel)
                continue
            directories(target.parent,site);atomic(target,data);created.append(rel)
        if index.read_bytes()!=before:raise ValueError('Главная изменилась во время подготовки')
        atomic(index,after)
        if verify_url:
            for entry in m['files']:
                rel=entry['path'];url=verify_url.rstrip('/')+'/'+('' if rel=='index.html' else rel)+'?zs_release='+RELEASE
                req=urllib.request.Request(url,headers={'Accept-Encoding':'identity','Cache-Control':'no-cache'})
                with urllib.request.urlopen(req,timeout=15) as response:actual=response.read()
                if sha(actual)!=entry['sha256']:raise ValueError('HTTP-проверка не пройдена: '+rel)
        state={'release':RELEASE,'indexBefore':sha(before),'indexAfter':sha(after),'created':created}
        atomic(backup/'rollback.json',json.dumps(state,indent=2).encode(),0o600)
        return {'installed':True,'files':len(m['files']),'backup':str(backup),'publicChecked':bool(verify_url)}
    except BaseException:
        if index.read_bytes()==after:atomic(index,before)
        expected={e['path']:e['sha256'] for e in m['files']}
        for rel in reversed(created):
            p=site/rel
            if p.is_file() and sha(p.read_bytes())==expected[rel]:p.unlink()
        raise

def rollback(site,backup):
    state=json.loads((backup/'rollback.json').read_text(encoding='utf-8'));index=safe(site,'index.html')
    if sha(index.read_bytes())!=state['indexAfter']:raise ValueError('Главная изменена после установки; откат остановлен')
    before=(backup/'index.html').read_bytes()
    if sha(before)!=state['indexBefore']:raise ValueError('Повреждена резервная копия')
    atomic(index,before)
    return {'rolledBack':True,'assetsRetainedForOpenTabs':True}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,default=Path(__file__).resolve().parents[1]);parser.add_argument('--site',type=Path,required=True);parser.add_argument('--backup-root',type=Path,default=Path('/root'));parser.add_argument('--preflight',action='store_true');parser.add_argument('--verify-url');parser.add_argument('--rollback',type=Path)
    a=parser.parse_args();result=rollback(a.site,a.rollback) if a.rollback else publish(a.source,a.site,a.backup_root,a.verify_url,a.preflight)
    print(json.dumps(result,ensure_ascii=False))

if __name__=='__main__':
    try:main()
    except Exception as e:raise SystemExit('Главная не обновлена: '+str(e))
