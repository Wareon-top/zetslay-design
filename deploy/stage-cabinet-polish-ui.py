"""Stage the cabinet introduction and preview without replacing local app/configuration."""
from pathlib import Path
import re
import sys

ASSETS = [
    'learning.js', 'learning.css', 'learning.test.mjs',
    'cabinet-demo.js', 'cabinet-demo.css', 'cabinet-demo.test.mjs',
    'subscription-access.js', 'subscription-access.css', 'subscription-access.test.mjs',
    'sidebar-trial.css', 'sidebar-trial.test.mjs',
]
VERSION = '20261022-cabinet-polish'


def pattern(name):
    quoted = re.escape(name)
    if name.endswith('.js'):
        return rf'<script\b[^>]*\bsrc=["\']{quoted}(?:\?[^"\']*)?["\'][^>]*>\s*</script>'
    return rf'<link\b[^>]*\bhref=["\']{quoted}(?:\?[^"\']*)?["\'][^>]*>'


def stage(local, incoming, out):
    local, incoming, out = Path(local), Path(incoming), Path(out)
    html = (local / 'index.html').read_text()
    for marker in ['data-overview', 'overview-context', 'data-kb-library', 'data-sidebar-trial']:
        if marker not in html:
            raise ValueError('Не подтверждена разметка кабинета. Файлы не изменены.')
    if any(html.lower().count(tag) != 1 for tag in ['</head>', '</body>']):
        raise ValueError('Не подтверждена структура HTML. Файлы не изменены.')
    if len(re.findall(pattern('app.js'), html, re.I)) != 1:
        raise ValueError('Не подтверждено подключение кабинета. Файлы не изменены.')
    # Read and validate the complete bundle before writing any staged output.
    outputs = {name: (incoming / name).read_text() for name in ASSETS}
    for name in ['learning.js', 'cabinet-demo.js', 'subscription-access.js',
                 'learning.css', 'cabinet-demo.css', 'subscription-access.css', 'sidebar-trial.css']:
        if len(re.findall(pattern(name), html, re.I)) > 1:
            raise ValueError(f'{name} подключён несколько раз. Файлы не изменены.')
    for name in ['learning.css', 'subscription-access.css', 'cabinet-demo.css', 'sidebar-trial.css']:
        version = '20261023-trial-restored' if name == 'sidebar-trial.css' else VERSION
        fresh = f'<link rel="stylesheet" href="{name}?v={version}">'
        if re.search(pattern(name), html, re.I):
            html = re.sub(pattern(name), lambda _: fresh, html, count=1, flags=re.I)
        else:
            html = re.sub(r'</head>', lambda _: fresh + '\n</head>', html, count=1, flags=re.I)
    access = f'<script src="subscription-access.js?v={VERSION}" defer></script>'
    if re.search(pattern('subscription-access.js'), html, re.I):
        html = re.sub(pattern('subscription-access.js'), lambda _: access, html, count=1, flags=re.I)
    else:
        anchor = re.search(pattern('payments.js'), html, re.I) or re.search(r'</body>', html, re.I)
        html = html[:anchor.start()] + access + '\n' + html[anchor.start():]
    for name in ['learning.js', 'cabinet-demo.js']:
        html = re.sub(pattern(name) + r'[ \t]*\r?\n?', '', html, count=1, flags=re.I)
    anchor = re.search(pattern('subscription-access.js'), html, re.I)
    block = ''.join(f'<script src="{name}?v={VERSION}" defer></script>\n'
                    for name in ['learning.js', 'cabinet-demo.js'])
    html = html[:anchor.start()] + block + html[anchor.start():]
    ordered = ['app.js', 'learning.js', 'cabinet-demo.js', 'subscription-access.js']
    if re.search(pattern('payments.js'), html, re.I):
        ordered.append('payments.js')
    positions = [re.search(pattern(name), html, re.I).start() for name in ordered]
    if positions != sorted(positions):
        raise ValueError('Не подтверждён порядок модулей кабинета. Файлы не изменены.')
    outputs['index.html'] = html
    for name, text in outputs.items():
        path = out / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)


if __name__ == '__main__':
    try:
        stage(*sys.argv[1:])
    except (OSError, ValueError) as error:
        raise SystemExit(str(error))
