"""Change landing identity repetition while preserving the legal release and cabinet."""
from pathlib import Path
import importlib.util
import json
import re
import sys


def stage(local, incoming, output):
    local, incoming, output = map(Path, (local, incoming, output))
    config = json.loads((local / 'legal/site-config.json').read_text())
    if not config.get('operatorName') or not re.fullmatch(r'\d{12}', config.get('inn', '')):
        raise ValueError('Не подтверждены действующие реквизиты; сайт не изменён')
    spec = importlib.util.spec_from_file_location('compact_footer_builder', incoming / 'deploy/build-legal-pages.py')
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    compact = builder.operator_requisites(config, compact=True)
    pattern = r'<p\b[^>]*\bdata-operator-requisites\b[^>]*>.*?</p>'
    files = {}
    for name in ('index.html', 'landing-footer.html'):
        path = local / name
        if not path.is_file() and name == 'landing-footer.html':
            continue
        text = path.read_text()
        if len(re.findall(pattern, text, re.S)) != 1 or re.search(r'^(<<<<<<<|=======|>>>>>>>)', text, re.M):
            raise ValueError('Не подтверждён подвал ' + name + '; сайт не изменён')
        text = re.sub(pattern, lambda _: compact, text, flags=re.S)
        if config['operatorName'] in text:
            raise ValueError('ФИО найдено за пределами реквизитов ' + name + '; нужна отдельная проверка')
        files[name] = text
    path = local / 'legal/index.html'
    text = path.read_text()
    old = '<section class="legal-operator"><h2>Оператор проекта</h2>'
    anchor = '<section class="legal-operator" id="operator"><h2>Оператор проекта</h2>'
    if text.count(old) == 1 and not re.search(r'id=[\"\']operator[\"\']', text):
        text = text.replace(old, anchor)
    elif text.count(anchor) != 1:
        raise ValueError('Не найден раздел полных реквизитов; сайт не изменён')
    if config['operatorName'] not in text or config['inn'] not in text:
        raise ValueError('В юридическом разделе отсутствуют полные реквизиты; сайт не изменён')
    files['legal/index.html'] = text
    # The JSON documents, publication hash, operator identity and archives are immutable here.
    output.mkdir(parents=True, exist_ok=False)
    for name, text in files.items():
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)


if __name__ == '__main__':
    try:
        stage(*sys.argv[1:])
    except (OSError, ValueError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
