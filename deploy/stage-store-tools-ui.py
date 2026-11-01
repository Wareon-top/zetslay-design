from pathlib import Path
import re, shutil, sys, json

def stage(local, incoming, output):
    local, incoming, output = map(Path, (local, incoming, output))
    html=(local/'index.html').read_text()
    assert html.count('data-lots-workspace')>=1, 'Не найден раздел лотов'
    assert len(re.findall(r'<script\b[^>]*src="app\.js\?',html))==1, 'Не подтверждён основной кабинет'
    app=(local/'app.js').read_text()
    for old,new in json.loads((incoming/'store-tools-app-patches.json').read_text()):
        if old.startswith('const viewTitles = {') and re.search(r"['\"]store-tools['\"]\s*:",app): continue
        # A later automation update must not restore the obsolete combined form.
        if 'function connectionNeedsBotPassword()' in app and 'botPassword' in new: continue
        if new in app: continue
        assert app.count(old)==1, 'Не подтверждена версия мастера подключения. Исходные файлы сохранены.'
        app=app.replace(old,new,1)
    html=re.sub(r'\s*<script\b[^>]*src="store-tools\.js[^\"]*"[^>]*></script>','',html)
    html=re.sub(r'\s*<link\b[^>]*href="store-tools\.css[^\"]*"[^>]*>','',html)
    html=re.sub(r'\s*</head>','\n<link rel="stylesheet" href="store-tools.css?v=20261020-store-tools">\n</head>',html)
    html=re.sub(r'\s*</body>','\n<script src="store-tools.js?v=20261020-store-tools" defer></script>\n</body>',html)
    version='20261024-bot-password-step' if 'function connectionNeedsBotPassword()' in app else '20261020-store-tools'
    html=re.sub(r'(src="app\.js\?v=)[^\"]*',lambda m:m[1]+version,html)
    output.mkdir(parents=True,exist_ok=True)
    for name in ['index.html','app.js']:(output/name).write_text(html if name=='index.html' else app)
    for name in ['store-tools.js','store-tools.css','store-tools.test.mjs']:shutil.copy2(incoming/name,output/name)
if __name__=='__main__':stage(*sys.argv[1:])
