#!/usr/bin/env python3
"""Apply the period UI without replacing unrelated cabinet markup or CSS."""
from pathlib import Path
import re
import shutil
import sys


def stage(current, incoming, output):
    html = (current / 'index.html').read_text()
    code = (current / 'overview.js').read_text()
    app = (current / 'app.js').read_text()
    if 'function renderOverview()' not in code or 'function buildOverview(' not in code or 'renderOverview' not in app:
        raise ValueError('Модуль статистики не распознан; кабинет не изменён.')
    if html.count('<div class="overview-grid">') != 1:
        raise ValueError('Разметка статистики не распознана; кабинет не изменён.')
    fresh_html = (incoming / 'index.html').read_text()
    pattern = r'            <div class="overview-period-toolbar".*?data-overview-period-note.*?</p>\n'
    fresh = re.search(pattern, fresh_html, re.S)
    if not fresh or len(re.findall(pattern, html, re.S)) > 1:
        raise ValueError('Разметка выбора периода не распознана.')
    if 'data-overview-period-note' in html:
        if not re.search(pattern, html, re.S):
            raise ValueError('Обнаружена неизвестная разметка выбора периода.')
        html = re.sub(pattern, lambda _: fresh.group(), html, count=1, flags=re.S)
    else:
        html = html.replace('            <div class="overview-grid">', fresh.group() + '            <div class="overview-grid">', 1)
    html = html.replace('<p>В синхронизированных сообщениях</p>', '<p data-overview-dialogs-note>Диалоги с сообщениями за период</p>')
    html = html.replace('<p>Доля заказов в текущем снимке</p>', '<p>По заказам выбранного периода</p>').replace('Заказы из снимка</h2>', 'Заказы за период</h2>')
    for asset in ('overview.js', 'overview.css'):
        html, count = re.subn(r'(' + re.escape(asset) + r'\?v=)[\w-]+', r'\g<1>20261010-overview-periods', html)
        if count != 1:
            raise ValueError('Подключение модуля статистики не распознано.')
    css = (current / 'overview.css').read_text()
    css_pattern = r'/\* OVERVIEW_PERIODS_START \*/.*?/\* OVERVIEW_PERIODS_END \*/'
    block = re.search(css_pattern, (incoming / 'overview.css').read_text(), re.S)
    if not block or len(re.findall(css_pattern, css, re.S)) > 1:
        raise ValueError('Стили периода не распознаны.')
    css = re.sub(css_pattern, lambda _: block.group(), css, flags=re.S) if re.search(css_pattern, css, re.S) else css + '\n' + block.group() + '\n'
    output.mkdir(parents=True, exist_ok=True)
    (output / 'index.html').write_text(html)
    (output / 'overview.css').write_text(css)
    for name in ('overview.js', 'overview.test.mjs'):
        shutil.copyfile(incoming / name, output / name)
    # Fixture only: the update never replaces the live cabinet controller.
    shutil.copyfile(current / 'app.js', output / 'app.js')


if __name__ == '__main__':
    try:
        stage(*(Path(arg) for arg in sys.argv[1:]))
    except (OSError, ValueError) as error:
        raise SystemExit(str(error))
