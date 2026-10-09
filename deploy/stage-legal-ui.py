from pathlib import Path
import re
import shutil
import sys
from importlib.util import spec_from_file_location,module_from_spec

VERSION='20261008-legal-2'
def require(ok,message):
    if not ok:raise ValueError(message+'. Сайт не изменён.')

def font_links(text,prefix):
    text=re.sub(r'\s*<link\b[^>]*\bhref=["\']https://fonts\.(?:googleapis|gstatic)\.com[^"\']*["\'][^>]*>', '', text)
    text=re.sub(r'\s*<link\b[^>]*\bhref=["\'](?:\.\./)?assets/fonts/fonts\.css(?:\?[^"\']*)?["\'][^>]*>', '',text)
    return re.sub(r'\s*</head>',f'\n  <link rel="stylesheet" href="{prefix}assets/fonts/fonts.css?v=20261007-local">\n</head>',text,count=1)

def asset(text,name,prefix,script=False):
    attr='src' if script else 'href';tag='script' if script else 'link';end='</body>' if script else '</head>'
    pattern=rf'\s*<{tag}\b[^>]*\b{attr}=["\']{re.escape(prefix+name)}(?:\?[^"\']*)?["\'][^>]*>'+(r'\s*</script>' if script else '')
    text,count=re.subn(pattern,'',text);require(count<=1,'Дубли ресурсов '+name)
    line=f'  <script src="{prefix+name}?v={VERSION}" defer></script>\n' if script else f'  <link rel="stylesheet" href="{prefix+name}?v={VERSION}">\n'
    return text.replace(end,line+end,1)

def legal_links():
    return '<nav class="legal-links" data-legal-links aria-label="Юридические документы"><a href="/legal/">Юридическая информация</a><a href="/legal/offer.html">Оферта · проект</a><a href="/legal/privacy.html">Конфиденциальность · проект</a><a href="/legal/refunds.html">Оплата и возвраты · проект</a><button type="button" data-privacy-settings>Настройки cookies</button></nav>'

def footer_links(text):
    text=re.sub(r'\s*<nav\b[^>]*\bdata-legal-links\b[^>]*>.*?</nav>','',text,flags=re.S)
    require(text.count('</footer>')==1,'Не найден единственный footer')
    marker='<div class="wave-footer__bottom">'
    return text.replace(marker,legal_links()+'\n      '+marker,1) if marker in text else text.replace('</footer>',legal_links()+'\n</footer>',1)

def stage(local,incoming,output):
    local,incoming,output=map(Path,(local,incoming,output))
    root=(local/'index.html').read_text();app=(local/'app/index.html').read_text()
    for text in (root,app):
        require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)',text,re.M),'Маркеры конфликта')
        require(text.count('</head>')==text.count('</body>')==1,'Не подтверждена структура HTML')
    require('data-profile' in app,'Обновите раздел Профиль перед юридическим модулем')
    root=asset(asset(font_links(footer_links(root),''),'legal/legal.css',''),'legal/privacy-controls.js','',True)
    app=font_links(app,'../');app=asset(asset(asset(app,'legal/legal.css','../'),'legal/privacy-controls.js','../',True),'legal-cabinet.js','',True)
    app=re.sub(r'\s*<nav\b[^>]*\bdata-auth-legal-links\b[^>]*>.*?</nav>','',app,flags=re.S)
    matches=list(re.finditer(r'<p\b[^>]*class="auth-legal"[^>]*>.*?</p>',app,re.S));require(len(matches)==1,'Не подтверждён блок информации формы входа')
    mark=matches[0];links='<nav class="legal-links" data-auth-legal-links aria-label="Документы аккаунта"><a href="/legal/offer.html">Оферта · проект</a><a href="/legal/privacy.html">Конфиденциальность · проект</a><a href="/legal/processing.html">Отдельное согласие · проект</a><a href="/legal/">Все документы</a></nav>'
    app=app[:mark.end()]+'\n        '+links+app[mark.end():]
    output.mkdir(parents=True,exist_ok=True);(output/'app').mkdir(exist_ok=True)
    shutil.copytree(incoming/'legal',output/'legal',dirs_exist_ok=True);shutil.copytree(incoming/'assets/fonts',output/'assets/fonts',dirs_exist_ok=True)
    if (local/'legal/site-config.json').is_file():shutil.copy2(local/'legal/site-config.json',output/'legal/site-config.json')
    spec=spec_from_file_location('legal_build',incoming/'deploy/build-legal-pages.py');builder=module_from_spec(spec);spec.loader.exec_module(builder);builder.build(output/'legal')
    import json
    operator_config=json.loads((output/'legal/site-config.json').read_text())
    root=builder.update_operator_footer(root,operator_config)
    shutil.copy2(incoming/'app/legal-cabinet.js',output/'app/legal-cabinet.js')
    (output/'index.html').write_text(root);(output/'app/index.html').write_text(app)
    if (local/'landing-footer.html').is_file():(output/'landing-footer.html').write_text(builder.update_operator_footer(footer_links((local/'landing-footer.html').read_text()),operator_config))

if __name__=='__main__':
    try:stage(*sys.argv[1:])
    except (ValueError,OSError,AssertionError) as e:print(e,file=sys.stderr);sys.exit(1)
