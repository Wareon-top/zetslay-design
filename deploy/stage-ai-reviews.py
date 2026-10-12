"""Add AI Reviews without replacing the live cabinet or its uploaded assets."""
from pathlib import Path
import re
import sys
VERSION = '20261012-ai-reviews-ultra'

def stage(original, incoming, output):
    output.mkdir(parents=True, exist_ok=True)
    page = (original / 'plugin-page.js').read_text()
    if "aiReviewsMarkup(plugin)" not in page:
        anchor = "      ${plugin.id === 'zetslay.steam-rent'"
        if page.count(anchor) != 1:
            raise ValueError('Не найден однозначный блок Steam Rent. Обновление остановлено.')
        page = page.replace(anchor, "      ${plugin.id === 'zetslay.ai-reviews' && typeof aiReviewsMarkup === 'function' ? aiReviewsMarkup(plugin) : ''}\n" + anchor, 1)
    (output / 'plugin-page.js').write_text(page)
    for filename, anchor, entry in [
        ('plugin-rarity.js', 'const PLUGIN_RARITY_BY_ID = Object.freeze({', "\n  'zetslay.ai-reviews':'ultra',"),
        ('subscription-access.js', 'const subscriptionTier={', " 'zetslay.ai-reviews':2,")
    ]:
        source = (original / filename).read_text()
        if "'zetslay.ai-reviews'" not in source:
            if source.count(anchor) != 1:
                raise ValueError('Не найден каталог редкостей или доступов: ' + filename)
            source = source.replace(anchor, anchor + entry, 1)
        else:
            pattern = r"'zetslay\.ai-reviews'\s*:\s*(?:'[^']+'|\d+)"
            target = "'zetslay.ai-reviews':'ultra'" if filename == 'plugin-rarity.js' else "'zetslay.ai-reviews':2"
            source, count = re.subn(pattern, target, source)
            if count != 1:
                raise ValueError('Неоднозначная редкость AI Reviews: ' + filename)
        (output / filename).write_text(source)
    html = (original / 'index.html').read_text()
    if '</head>' not in html or '</body>' not in html:
        raise ValueError('Не найдены границы HTML')
    for filename in ['plugin-page.js', 'plugin-rarity.js', 'subscription-access.js']:
        html, count = re.subn(r'(?P<prefix>src=["\'])' + re.escape(filename) + r'(?:\?[^"\']*)?(?P<suffix>["\'])', r'\g<prefix>' + filename + '?v=' + VERSION + r'\g<suffix>', html)
        if count != 1:
            raise ValueError('Не найден однозначный script: ' + filename)
    if not re.search(r'href=["\']ai-reviews\.css(?:\?|["\'])', html):
        html = html.replace('</head>', '<link rel="stylesheet" href="ai-reviews.css?v=' + VERSION + '">\n</head>')
    if not re.search(r'src=["\']ai-reviews\.js(?:\?|["\'])', html):
        html = html.replace('</body>', '<script src="ai-reviews.js?v=' + VERSION + '" defer></script>\n</body>')
    for attr, filename in [('src', 'ai-reviews.js'), ('href', 'ai-reviews.css')]:
        html, count = re.subn(r'(?P<prefix>' + attr + r'=["\'])' + re.escape(filename) + r'(?:\?[^"\']*)?(?P<suffix>["\'])', r'\g<prefix>' + filename + '?v=' + VERSION + r'\g<suffix>', html)
        if count != 1:
            raise ValueError('Неоднозначное подключение: ' + filename)
    (output / 'index.html').write_text(html)
    for filename in ['ai-reviews.js', 'ai-reviews.css']:
        (output / filename).write_bytes((incoming / filename).read_bytes())

if __name__ == '__main__':
    stage(*(Path(p) for p in sys.argv[1:]))
