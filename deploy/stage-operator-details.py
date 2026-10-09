"""Stage an explicitly requested operator identity update without touching the cabinet."""
from pathlib import Path
import hashlib
import importlib.util
import json
import shutil
import sys

BASE_DOCUMENTS='cddc582cee5f83f838c2554a2229f9c512848a68'
def git_sha(content):return hashlib.sha1(b'blob '+str(len(content)).encode()+b'\0'+content).hexdigest()
def stage(local,incoming,output):
    local,incoming,output=map(Path,(local,incoming,output))
    desired=json.loads((incoming/'legal/site-config.json').read_text())
    current_path=local/'legal/site-config.json'
    config=json.loads(current_path.read_text()) if current_path.is_file() else dict(desired)
    if config.get('status')!='draft' or desired.get('status')!='draft':raise ValueError('Документы уже утверждены: требуется отдельное обновление реквизитов')
    source=incoming/'legal/documents.json';current_docs=local/'legal/documents.json'
    if current_docs.is_file() and git_sha(current_docs.read_bytes())!=BASE_DOCUMENTS and current_docs.read_bytes()!=source.read_bytes():raise ValueError('Документы содержат неизвестные локальные изменения; сайт не изменён')
    for field in ('operatorName','operatorType','inn'):config[field]=desired[field]
    roots={}
    for name in ('index.html','landing-footer.html'):
        path=local/name
        if not path.is_file():
            if name=='index.html':raise ValueError('Не найдена главная страница')
            continue
        text=path.read_text()
        if any(line.startswith(('<<<<<<<','=======','>>>>>>>')) for line in text.splitlines()):raise ValueError('Маркеры конфликта в '+name)
        roots[name]=text
    spec=importlib.util.spec_from_file_location('operator_builder',incoming/'deploy/build-legal-pages.py');builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
    roots={name:builder.update_operator_footer(text,config) for name,text in roots.items()}
    output.mkdir(parents=True,exist_ok=True);(output/'legal').mkdir(exist_ok=True)
    (output/'legal/site-config.json').write_text(json.dumps(config,ensure_ascii=False,indent=2)+'\n')
    shutil.copy2(source,output/'legal/documents.json');builder.build(output/'legal')
    for name,text in roots.items():(output/name).write_text(text)
    for path in (output/'legal').glob('*.html'):
        text=path.read_text()
        if config['operatorName'] not in text or config['inn'] not in text or '{{operator' in text:raise ValueError('Не подтверждены реквизиты в '+path.name)
if __name__=='__main__':
    try:stage(*sys.argv[1:])
    except (OSError,ValueError,AssertionError) as e:print(e,file=sys.stderr);sys.exit(1)
