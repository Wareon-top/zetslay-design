from pathlib import Path
import re
import sys

FILES = ('landing-footer.css', 'landing-footer.js')
VERSION = '20261007-wave-footer'

def require(condition, message):
    if not condition:
        raise ValueError(message + '. Сайт не изменён.')

def footer_section(text):
    found = list(re.finditer(r'<footer\b[^>]*>.*?</footer>', text, re.S))
    require(len(found) == 1, 'Не найден единственный footer')
    require(re.search(r'\bclass=["\'][^"\']*\bsite-footer\b', found[0].group()), 'Не подтверждён footer главной страницы')
    return found[0]

def stage(local, incoming, output):
    local, incoming, output = map(Path, (local, incoming, output))
    text = (local / 'index.html').read_text()
    desired = (incoming / 'landing-footer.html').read_text().strip()
    require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)', text, re.M), 'Найдены маркеры конфликта')
    old, new = footer_section(text), footer_section(desired)
    require(new.group() == desired and 'data-landing-footer="animated-wave"' in desired, 'Не подтверждён новый footer')
    require(text.count('</head>') == text.count('</body>') == 1, 'Не подтверждена структура страницы')
    assets = {name: (incoming / name).read_bytes() for name in FILES}
    require(all(data.strip() for data in assets.values()), 'Пустые ресурсы footer')
    # Resolve only fragment links. Keep all other landing sections and local edits.
    ids = set(re.findall(r'\bid=["\']([^"\']+)["\']', text))
    for target in re.findall(r'\bhref=["\']#([^"\']+)["\']', desired):
        if target not in ids and target.startswith('faq-') and 'faq' in ids:
            desired = desired.replace('href="#'+target+'"','href="#faq"')
            continue
        require(target in ids, 'На странице отсутствует раздел ' + target)
    text = text[:old.start()] + desired + text[old.end():]
    for name, attr, tag, end in [('landing-footer.css','href','link','</head>'), ('landing-footer.js','src','script','</body>')]:
        pattern = rf'(<{tag}\b[^>]*\b{attr}=["\']){re.escape(name)}(?:\?[^"\']*)?(["\'])'
        text, count = re.subn(pattern, lambda m: m[1]+name+'?v='+VERSION+m[2], text)
        require(count <= 1, 'Дубли ресурсов footer')
        if not count:
            markup = f'  <link rel="stylesheet" href="{name}?v={VERSION}">\n' if tag=='link' else f'  <script src="{name}?v={VERSION}" defer></script>\n'
            text = text.replace(end,markup+end,1)
    output.mkdir(parents=True,exist_ok=True)
    (output/'index.html').write_text(text)
    for name,data in assets.items():
        (output/name).write_bytes(data)

if __name__=='__main__':
    try:
        require(len(sys.argv)==4,'Нужны local, incoming, output')
        stage(*sys.argv[1:])
    except (OSError,ValueError) as error:
        print(error,file=sys.stderr)
        sys.exit(1)
