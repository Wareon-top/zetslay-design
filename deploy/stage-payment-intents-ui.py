"""Update wallet assets and their resource versions, retaining all live cabinet sections."""
from pathlib import Path
import re
import sys

VERSION = '20261024-payment-intents'
ASSETS = ('payments.js', 'payments.css')


def stage(local, incoming, out):
    local, incoming, out = map(Path, (local, incoming, out))
    html = (local / 'index.html').read_text()
    if html.count('data-service-wallet') != 1 or html.count('</body>') != 1 or html.count('</head>') != 1:
        raise ValueError('Не подтверждена структура кабинета с балансом. Файлы не изменены.')
    for name, attribute in [('payments.js', 'src'), ('payments.css', 'href')]:
        pattern = r'(' + attribute + r'=["\'])' + re.escape(name) + r'(?:\?[^"\']*)?(["\'])'
        html, count = re.subn(pattern, lambda m: m[1] + name + '?v=' + VERSION + m[2], html)
        if count != 1:
            raise ValueError('Не найден единственный ресурс ' + name + '. Файлы не изменены.')
    data = {name: (incoming / name).read_bytes() for name in ASSETS}
    out.mkdir(parents=True, exist_ok=True)
    for name, content in data.items():
        (out / name).write_bytes(content)
    (out / 'index.html').write_text(html)


if __name__ == '__main__':
    try:
        stage(*sys.argv[1:])
    except (OSError, ValueError) as error:
        raise SystemExit(str(error))
