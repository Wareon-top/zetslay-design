from pathlib import Path
import re
import sys

VERSION = '20261010-plugin-purchase'
ASSETS = ('plugin-purchase-options.js', 'plugin-purchase-options.css', 'plugin-purchase-options.test.mjs')
FIXTURES = ('app.js', 'plugin-cover.js', 'plugin-rarity.js', 'plugin-page.js', 'billing-pricing.js')

def stage(local, incoming, out):
    local, incoming, out = map(Path, (local, incoming, out))
    html = (local / 'index.html').read_text()
    if html.count('</head>') != 1 or 'data-plugin-page' not in html:
        raise ValueError('Не подтверждена страница плагина. Файлы не изменены.')
    if re.search(r'^(<<<<<<<|=======|>>>>>>>)', html, re.M):
        raise ValueError('Обнаружен конфликт. Файлы не изменены.')
    source = (local / 'plugin-page.js').read_text()
    pattern = r'<span class="plugin-page-eyebrow">В вашем кабинете</span><div class="plugin-page-price">.*?</div><p class="plugin-page-price-note">.*?</p>'
    if len(re.findall(pattern, source, re.S)) != 1:
        raise ValueError('Не подтверждена плашка цены. Файлы не изменены.')
    html = re.sub(r'^[ \t]*<link\b[^\n]*href="plugin-purchase-options\.css(?:\?[^"\n]*)?"[^\n]*>\n?', '', html, flags=re.M)
    html = re.sub(r'^[ \t]*<script\b[^\n]*src="plugin-purchase-options\.js(?:\?[^"\n]*)?"[^\n]*></script>\n?', '', html, flags=re.M)
    anchor = r'<script\b[^>]*src="billing\.js(?:\?[^"\n]*)?"[^>]*\bdefer[^>]*></script>'
    matches = list(re.finditer(anchor, html))
    if len(matches) != 1 or 'src="billing-pricing.js' not in html or 'src="plugin-detail-ui.js' not in html:
        raise ValueError('Не подтверждён порядок модулей. Файлы не изменены.')
    html = re.sub(anchor, lambda m:m[0]+'\n    <script src="plugin-purchase-options.js?v='+VERSION+'" defer></script>', html, count=1)
    html = html.replace('</head>', '  <link rel="stylesheet" href="plugin-purchase-options.css?v='+VERSION+'">\n  </head>', 1)
    files = {name:(local / name).read_bytes() for name in FIXTURES}
    files.update({name:(incoming / name).read_bytes() for name in ASSETS})
    files['index.html'] = html.encode()
    out.mkdir(parents=True, exist_ok=True)
    for name, data in files.items():
        (out / name).write_bytes(data)

if __name__ == '__main__':
    try:
        stage(*sys.argv[1:])
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
