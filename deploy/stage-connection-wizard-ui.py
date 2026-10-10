from pathlib import Path
import re
import sys

VERSION = '20261006-guided-connect'
ASSETS = ('connection-wizard-ui.js', 'connection-wizard-ui.css', 'connection-wizard-ui.test.mjs')


def stage(local: Path, incoming: Path, out: Path):
    html = (local / 'index.html').read_text()
    source = (local / 'app.js').read_text()
    # Never replace app.js: VPS installations contain independent local fixes.
    for marker in ('function renderConnectionWizard(', 'function setModal(', 'function backConnectionWizard(',
                   'const wizardInitialStep', 'connectionResetTarget', 'connectionLoadFailed', 'liveConnectionMode'):
        if marker not in source:
            raise ValueError('Мастер подключения несовместим: ' + marker + '. Кабинет не изменён.')
    for marker in ('class="connect-modal"', 'class="connect-progress"', 'class="connect-modal__body"',
                   'data-connect-next', 'data-connect-back', 'data-connect-reset', 'data-close-connect'):
        if marker not in html:
            raise ValueError('Неизвестная разметка мастера: ' + marker + '. Кабинет не изменён.')
    for filename in ASSETS:
        if not (incoming / filename).is_file():
            raise ValueError('Отсутствует файл ' + filename)
    # Remove only our assets; retain all other modules, cover assets and API URL.
    html = re.sub(r'^[ \t]*<(?:script|link)\b[^\n]*["\']connection-wizard-ui\.(?:js|css)(?:\?[^"\']*)?["\'][^\n]*>\n?', '', html, flags=re.M)
    script_pattern = r'^([ \t]*)(<script\s+src="app\.js(?:\?[^"\n]*)?"\s+defer></script>)'
    html, count = re.subn(script_pattern, lambda m: m[0] + '\n' + m[1] + '<script src="connection-wizard-ui.js?v=' + VERSION + '" defer></script>', html, flags=re.M)
    if count != 1 or html.count('</head>') != 1:
        raise ValueError('Не найдена единственная точка подключения app.js. Кабинет не изменён.')
    html = html.replace('</head>', '  <link rel="stylesheet" href="connection-wizard-ui.css?v=' + VERSION + '">\n  </head>', 1)
    # Validate everything before writing staging output.
    texts = {filename: (incoming / filename).read_bytes() for filename in ASSETS}
    out.mkdir(parents=True, exist_ok=True)
    (out / 'index.html').write_text(html)
    (out / 'app.js').write_text(source)  # Read-only integration test input; not installed.
    for filename, contents in texts.items():
        (out / filename).write_bytes(contents)


if __name__ == '__main__':
    try:
        stage(*(Path(value) for value in sys.argv[1:]))
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
