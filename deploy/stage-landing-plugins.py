"""Replace one landing section; publish only names and existing raster covers."""
from pathlib import Path
import base64
import hashlib
import html
from html.parser import HTMLParser
import json
import re
import sys

VERSION = '20261006-public-catalog'
IDS = ['zetslay.' + name for name in ('confirm-reminder', 'review-reminder', 'auto-review-bonus', 'lot-cloner', 'mass-price-editor', 'sales-pause', 'kosell-rent')]


def require(value, message):
    if not value:
        raise ValueError(message + '. Сайт не изменён.')


def section(text, ident):
    found = list(re.finditer(r'<section\b(?=[^>]*\bid=["\']' + re.escape(ident) + r'["\'])[^>]*>.*?</section>', text, re.S))
    require(len(found) == 1, 'Не найден единственный блок ' + ident)
    require(found[0].group().count('<section') == 1, 'Неизвестная вложенная секция ' + ident)
    return found[0]


class ShowcaseValidator(HTMLParser):
    def handle_starttag(self, tag, attrs):
        require(tag not in ('a', 'button', 'form', 'input', 'select', 'textarea', 'script', 'iframe', 'object', 'embed'), 'Витрина содержит действие ' + tag)
        for name, _ in attrs:
            require(not name.startswith('on') and name not in ('data-plugin-id', 'data-plugin-edit', 'data-cover-plugin'), 'Витрина содержит обработчик действия')


def decode_cover(value):
    require(isinstance(value, str) and len(value) <= 3 * 1024 * 1024, 'Недопустимый размер обложки')
    match = re.fullmatch(r'data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})', value)
    require(match, 'Недопустимый формат обложки')
    data = base64.b64decode(match[2], validate=True)
    require(0 < len(data) <= 2 * 1024 * 1024, 'Обложка превышает 2 МБ')
    kind = match[1]
    require((kind == 'png' and data.startswith(b'\x89PNG\r\n\x1a\n')) or (kind == 'jpeg' and data.startswith(b'\xff\xd8\xff')) or (kind == 'webp' and data.startswith(b'RIFF') and data[8:12] == b'WEBP'), 'Содержимое обложки не соответствует формату')
    return kind, data


def stage(local, incoming, output, export_file=None):
    local, incoming, output = map(Path, (local, incoming, output))
    text = (local / 'index.html').read_text()
    desired = (incoming / 'index.html').read_text()
    require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)', text, re.M), 'Найдены маркеры конфликта')
    old, new = section(text, 'comparison'), section(desired, 'comparison')
    require('Простые условия.' in old.group() or 'data-landing-plugin-showcase' in old.group(), 'Неизвестный заменяемый блок')
    require('data-landing-plugin-showcase' in new.group(), 'В обновлении отсутствует витрина')
    cards = list(re.finditer(r'<article\b[^>]*data-public-plugin="([^"]+)"[^>]*>.*?</article>', new.group(), re.S))
    require([card[1] for card in cards] == IDS, 'Неизвестный состав витрины')
    overrides = {}
    if export_file is not None:
        path = Path(export_file)
        require(path.stat().st_size <= 24 * 1024 * 1024, 'Слишком большой экспорт каталога')
        payload = json.loads(path.read_text())
        require(isinstance(payload, dict), 'Неизвестный экспорт каталога')
        entries = payload.get('entries')
        require(isinstance(entries, list) and len(entries) <= len(IDS), 'Неизвестный экспорт каталога')
        for entry in entries:
            require(isinstance(entry, dict) and entry.get('id') in IDS and entry['id'] not in overrides and isinstance(entry.get('published'), bool), 'Неизвестная карточка каталога')
            overrides[entry['id']] = entry
    assets = {'landing-plugins.css': (incoming / 'landing-plugins.css').read_bytes()}
    visible = []
    for card in cards:
        ident, content = card[1], card.group()
        saved = overrides.get(ident)
        if saved is not None:
            if not saved['published']:
                continue
            name = saved.get('name', '')
            require(isinstance(name, str) and len(name) <= 100, 'Недопустимое название плагина')
            if name.strip():
                content = re.sub(r'(<h3\b[^>]*>).*?(</h3>)', lambda m: m[1] + html.escape(name.strip()) + m[2], content, count=1, flags=re.S)
            cover = saved.get('cover', '')
            if cover:
                kind, data = decode_cover(cover)
                filename = f'assets/landing-plugin-covers/{ident.replace(".", "-")}-{hashlib.sha256(data).hexdigest()[:16]}.{kind}'
                assets[filename] = data
                image = f'<figure class="landing-plugin-card__image"><img src="{filename}" alt="" loading="lazy" decoding="async"></figure>'
                content = re.sub(r'<figure\b[^>]*>.*?</figure>', lambda _: image, content, count=1, flags=re.S)
        visible.append(content)
    replacement = new.group()
    for card in cards:
        replacement = replacement.replace(card.group(), '', 1)
    contents = '\n'.join('          ' + card for card in visible)
    if not contents:
        contents = '<p class="landing-plugins__empty">Каталог обновляется. Новые модули появятся здесь после публикации.</p>'
    replacement = re.sub(r'(<div class="landing-plugins__grid"[^>]*>).*?(\n        </div>)', lambda m: m[1] + '\n' + contents + m[2], replacement, count=1, flags=re.S)
    replacement = re.sub(r'(<strong data-public-plugin-count>)\d+(</strong>)', lambda m: m[1] + str(len(visible)) + m[2], replacement, count=1)
    ShowcaseValidator().feed(replacement)
    text = text[:old.start()] + replacement + text[old.end():]
    # Remove the old technical placeholder section so the nav opens the actual showcase.
    legacy = list(re.finditer(r'<section\b(?=[^>]*\bid=["\']plugins["\'])[^>]*>.*?</section>', text, re.S))
    require(len(legacy) <= 1, 'Дублируются старые секции плагинов')
    if legacy:
        require(all(marker in legacy[0].group() for marker in ('plugin-track', 'messages:read', 'telegram:send')), 'Неизвестный прежний блок плагинов')
        text = text[:legacy[0].start()] + text[legacy[0].end():]
    require(len(re.findall(r'\bid=["\']plugins["\']', text)) == 1, 'Неоднозначный адрес витрины')
    text, count = re.subn(r'^[ \t]*<link\b[^\n]*href="landing-plugins\.css(?:\?[^"\n]*)?"[^\n]*>\n?', '', text, flags=re.M)
    require(count <= 1 and text.count('</head>') == 1, 'Неизвестная загрузка стилей')
    text = text.replace('</head>', f'  <link rel="stylesheet" href="landing-plugins.css?v={VERSION}">\n</head>', 1)
    output.mkdir(parents=True, exist_ok=True)
    (output / 'index.html').write_text(text)
    for filename, data in assets.items():
        target = output / filename
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)


if __name__ == '__main__':
    try:
        require(len(sys.argv) in (4, 5), 'Нужны local, incoming, output и необязательный экспорт')
        stage(*sys.argv[1:])
    except (ValueError, OSError, TypeError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
