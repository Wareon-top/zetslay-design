from pathlib import Path
import re
import sys

VERSION = '20261010-plugin-sorting'


def sorting_block(source):
    start = source.find('function pluginCatalogPrice(')
    if start < 0:
        start = source.find('function filterPluginCatalog(')
    end = source.find('\nfunction formatPluginDescription(', start)
    if start < 0 or end < 0 or source.count('function filterPluginCatalog(') != 1:
        raise ValueError('Не найдена единственная функция фильтрации. Кабинет не изменён.')
    return start, end


def stage(local: Path, incoming: Path, out: Path):
    html = (local / 'index.html').read_text()
    source = (local / 'app.js').read_text()
    fresh = (incoming / 'app.js').read_text()
    rarity = (local / 'plugin-rarity.js').read_text()
    if 'function pluginRarity(' not in rarity or 'function renderPlugins()' not in source:
        raise ValueError('Не найден каталог с редкостями. Кабинет не изменён.')
    start, end = sorting_block(source)
    new_start, new_end = sorting_block(fresh)
    if 'function pluginCatalogPrice(' not in fresh[new_start:new_end] or 'pluginCatalogRarityRank(' not in fresh[new_start:new_end]:
        raise ValueError('В обновлении нет сортировки по редкости. Кабинет не изменён.')
    source = source[:start] + fresh[new_start:new_end] + source[end:]
    needle = '  if (categorySelect) categorySelect.value = state.pluginFilter.cat;'
    added = "\n  const sortSelect = document.querySelector('[data-plugin-sort]');\n  if (sortSelect) sortSelect.value = state.pluginFilter.sort;"
    if source.count(needle) != 1:
        raise ValueError('Не найден блок фильтров. Кабинет не изменён.')
    if '  if (sortSelect) sortSelect.value = state.pluginFilter.sort;' not in source:
        source = source.replace(needle, needle + added, 1)
    pattern = r'(<select\b(?=[^>]*\bdata-plugin-sort\b)[^>]*>)(.*?)(</select>)'
    selects = list(re.finditer(pattern, html, re.S))
    fresh_selects = list(re.finditer(pattern, (incoming / 'index.html').read_text(), re.S))
    if len(selects) != 1 or len(fresh_selects) != 1:
        raise ValueError('Не найдена единственная сортировка в разметке. Кабинет не изменён.')
    match = selects[0]
    html = html[:match.start(2)] + fresh_selects[0][2] + html[match.end(2):]
    html, count = re.subn(r'(src="app\.js)(?:\?[^"\n]*)?(")', lambda m: m[1] + '?v=' + VERSION + m[2], html)
    if count != 1:
        raise ValueError('Не найдено единственное подключение app.js. Кабинет не изменён.')
    # Only the sorting functions, filter synchronisation and option list change.
    out.mkdir(parents=True, exist_ok=True)
    (out / 'app.js').write_text(source)
    (out / 'index.html').write_text(html)
    (out / 'plugin-rarity.js').write_text(rarity)
    (out / 'plugin-sorting.test.mjs').write_bytes((incoming / 'plugin-sorting.test.mjs').read_bytes())


if __name__ == '__main__':
    try:
        if len(sys.argv) != 4:
            raise ValueError('Нужны каталоги local, incoming, out.')
        stage(*(Path(value) for value in sys.argv[1:]))
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
