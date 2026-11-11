#!/usr/bin/env python3
"""Patch only the landing hero; preserve unknown live additions as opaque bytes."""
import re
import sys
from pathlib import Path

STYLE = b"landing-sunset-20261111.css?v=sunset-v4-fit1"
MARKER = b'data-landing-hero="sunset-v4"'
HEADER = re.compile(rb'<header\b(?=[^>]*\bclass=["\'][^"\']*\bsite-header\b)[^>]*>.*?</header\s*>', re.S | re.I)
HERO = re.compile(rb'<section\b(?=[^>]*\bid=["\']landing["\'])(?=[^>]*\bdata-landing-hero=["\'](?:orderflow|sunset-v4)["\'])[^>]*>.*?</section\s*>', re.S | re.I)
HEAD_BLOCK = re.compile(rb'[ \t]*<!-- zetslay-sunset:start -->.*?<!-- zetslay-sunset:end -->\r?\n', re.S)


def patch(original: bytes, template: bytes) -> bytes:
    headers = list(HEADER.finditer(original))
    heroes = list(HERO.finditer(original))
    if len(headers) != 1 or len(heroes) != 1:
        raise ValueError("Ожидались одна шапка site-header и один известный hero. Страница не изменена.")
    if len(re.findall(rb'<section\b', heroes[0].group(), re.I)) != 1:
        raise ValueError("В hero появились вложенные section. Нужна проверка новой версии страницы.")
    if original.count(b'</head>') != 1 or original.count(b'id="main"') != 1:
        raise ValueError("Не распознаны head/main текущей страницы.")
    if template.count(b'<!-- ZETSLAY_EXISTING_HEADER -->') != 1 or template.count(MARKER) != 1:
        raise ValueError("Повреждён шаблон hero.")
    header = headers[0].group()
    header = re.sub(rb'\s+zsh-header\b', b'', header, count=1)
    header = re.sub(rb'(<header\b[^>]*\bclass=(["\']))([^"\']+)(\2)',
                    lambda m: m[1] + m[3] + b' zsh-header' + m[4], header, count=1, flags=re.I)
    start = headers[0].start()
    while start and original[start - 1:start] in (b' ', b'\t'):
        start -= 1
    html = original[:start] + original[headers[0].end():]
    candidate = template.replace(b'<!-- ZETSLAY_EXISTING_HEADER -->', header)
    html, count = HERO.subn(lambda _: candidate.rstrip(), html)
    if count != 1:
        raise ValueError("Не удалось заменить только hero.")
    # Drop only the obsolete hero preload; leave scripts and all other head tags intact.
    html = re.sub(rb'[ \t]*<link\b(?=[^>]*\brel=["\']preload["\'])(?=[^>]*\bhref=["\']assets/zetslay-orderflow\.webp(?:\?[^"\']*)?["\'])[^>]*>\r?\n?', b'', html, flags=re.I)
    html, blocks = HEAD_BLOCK.subn(b'', html)
    if blocks > 1:
        raise ValueError("Повторяющиеся метки установки в head.")
    block = (b'  <!-- zetslay-sunset:start -->\n'
             b'  <link rel="stylesheet" href="' + STYLE + b'">\n'
             b'  <link rel="preload" as="image" href="assets/hero-sunset-20261111/sky.webp" fetchpriority="high">\n'
             b'  <link rel="preload" as="image" href="assets/hero-sunset-20261111/main-z.webp" fetchpriority="high">\n'
             b'  <!-- zetslay-sunset:end -->\n')
    html = html.replace(b'</head>', block + b'</head>')
    if html.count(MARKER) != 1 or len(HEADER.findall(html)) != 1:
        raise ValueError("Нарушена структура результата.")
    return html


def main():
    site, incoming, staged = map(Path, sys.argv[1:])
    target = site / 'index.html'
    if target.is_symlink() or not target.is_file():
        raise ValueError("index.html должен быть обычным файлом.")
    result = patch(target.read_bytes(), (incoming / 'deploy/sunset-hero-section.html').read_bytes())
    staged.mkdir(parents=True, exist_ok=True)
    (staged / 'index.html').write_bytes(result)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError) as error:
        raise SystemExit(str(error))
