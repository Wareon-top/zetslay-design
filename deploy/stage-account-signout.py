"""Expose the cabinet's existing server-backed logout action beside the profile."""
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

VERSION = '20261023-visible-signout'
BUTTON = '''<button class="account-signout" type="button" data-auth-logout data-account-signout>
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 4H5v16h4M13 7l5 5-5 5M8 12h10"/></svg>
            <span>Выйти из аккаунта</span>
          </button>'''


def profile_end(html):
    class Parser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.lines = [0] + [m.end() for m in re.finditer('\n', html)]
            self.depth = 0
            self.ends = []

        def handle_starttag(self, tag, attrs):
            if tag != 'div':
                return
            if self.depth:
                self.depth += 1
            elif 'user-card' in dict(attrs).get('class', '').split():
                self.depth = 1

        def handle_endtag(self, tag):
            if tag == 'div' and self.depth:
                self.depth -= 1
                if not self.depth:
                    line, col = self.getpos()
                    self.ends.append(self.lines[line - 1] + col + len('</div>'))

    parser = Parser()
    parser.feed(html)
    if parser.depth or len(parser.ends) != 1:
        raise ValueError('Не найдена единственная карточка профиля. Кабинет не изменён.')
    end = parser.ends[0]
    # Require this card to be inside the existing navigation footer.
    if html.rfind('class="sidebar__bottom"', 0, end) < html.rfind('<nav', 0, end):
        raise ValueError('Не подтверждён профиль в боковом меню.')
    return end


def stage(local, incoming, out):
    local, incoming, out = map(Path, (local, incoming, out))
    html = (local / 'index.html').read_text()
    app = (local / 'app.js').read_text()
    if html.count('</head>') != 1 or 'async function logoutSession(' not in app or \
            "'/api/v1/auth/logout'" not in app or "closest('[data-auth-logout]')" not in app:
        raise ValueError('Не подтверждён обработчик выхода из аккаунта. Кабинет не изменён.')
    if re.search(r'^(<<<<<<<|=======|>>>>>>>)', html, re.M):
        raise ValueError('Обнаружен конфликт разметки кабинета.')
    end = profile_end(html)
    existing = list(re.finditer(r'<button\b[^>]*\bdata-account-signout\b[^>]*>.*?</button>', html, re.S))
    if len(existing) > 1 or html.count('data-account-signout') != len(existing):
        raise ValueError('Неоднозначная кнопка выхода. Кабинет не изменён.')
    if existing:
        if html[end:existing[0].start()].strip():
            raise ValueError('Неизвестное расположение кнопки выхода.')
        html = html[:existing[0].start()] + BUTTON + html[existing[0].end():]
    else:
        html = html[:end] + '\n          ' + BUTTON + html[end:]
    pattern = r'<link\b[^>]*href=["\']account-signout\.css(?:\?[^"\']*)?["\'][^>]*>[ \t]*\r?\n?'
    if len(re.findall(pattern, html)) > 1:
        raise ValueError('Дублируются стили кнопки выхода.')
    html = re.sub(pattern, '', html)
    html = html.replace('</head>', f'<link rel="stylesheet" href="account-signout.css?v={VERSION}">\n</head>')
    css = (incoming / 'account-signout.css').read_bytes()
    out.mkdir(parents=True, exist_ok=True)
    (out / 'index.html').write_text(html)
    (out / 'account-signout.css').write_bytes(css)


if __name__ == '__main__':
    try:
        stage(*sys.argv[1:])
    except (ValueError, OSError) as error:
        raise SystemExit(str(error))
