"""Pre-render legal projects. Config deliberately cannot turn them into an offer."""
import html
import json
from pathlib import Path
import sys

def build(root):
    root=Path(root);data=json.loads((root/'documents.json').read_text());config=json.loads((root/'site-config.json').read_text())
    assert data['status']=='draft' and config['status']=='draft', 'Final approval requires a new reviewed release'
    esc=lambda s:html.escape(str(s),quote=True)
    docs=data['documents'];ids=[d['id'] for d in docs]
    assert len(ids)==len(set(ids)) and all(i.replace('-','').isalnum() for i in ids)
    notice='<aside class="legal-notice"><strong>Проекты документов · ещё не вступили в силу</strong>Не заполнены реквизиты оператора и юридический контакт. Страны и провайдеры зарубежного размещения, локализация и сроки хранения требуют проверки. Эти тексты не являются действующей офертой и не фиксируют согласие пользователя.</aside>'
    links='<nav class="legal-links" aria-label="Юридические документы"><a href="/legal/">Все документы</a><a href="/legal/offer.html">Оферта · проект</a><a href="/legal/privacy.html">Конфиденциальность · проект</a><a href="/legal/refunds.html">Оплата и возвраты · проект</a><button type="button" data-privacy-settings>Настройки cookies</button></nav>'
    def page(title,body):
        return f'''<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><meta name="description" content="{esc(title)} — проект юридического документа ZetSlay."><title>{esc(title)} · ZetSlay</title><link rel="stylesheet" href="/assets/fonts/fonts.css?v=20261007-local"><link rel="stylesheet" href="/legal/legal.css?v=20261007-legal"><script src="/legal/privacy-controls.js?v=20261007-legal" defer></script><script src="/legal/legal-page.js?v=20261007-legal" defer></script></head><body class="legal-body"><header class="legal-header"><a class="legal-brand" href="/"><span>Z</span> ZetSlay</a><nav aria-label="Навигация"><a href="/legal/">Документы</a><a href="/app/#profile">Личный кабинет</a></nav></header><main class="legal-main">{body}</main><footer class="legal-footer"><span>© 2026 ZetSlay · независимый сервис для продавцов</span>{links}</footer></body></html>
'''
    operator=[('Статус',config['operatorType']),('ФИО',config['operatorName'] or 'Пока не указано'),('ИНН',config['inn'] or 'Пока не указан'),('Адрес для обращений',config['postalAddress'] or 'Пока не указан'),('Юридический email',config['legalEmail'] or 'Пока не указан'),('Размещение данных',config['hostingLocation']),('Сроки хранения',config['retentionSchedule'])]
    facts=''.join(f'<dt>{esc(k)}</dt><dd>{esc(v)}</dd>' for k,v in operator)
    cards=''.join(f'<a class="legal-card" href="{d["id"]}.html"><span class="legal-card-number">0{n+1} / ДОКУМЕНТ</span><h2>{esc(d["title"])}</h2><p>{esc(d["summary"])}</p><small>Проект · {esc(data["date"])} →</small></a>' for n,d in enumerate(docs))
    home=f'<div class="legal-hero"><span class="legal-eyebrow">ZetSlay / Документы</span><h1>Правила, данные<br>и ваши права.</h1><p>Юридическая информация в одном месте: условия доступа, обработка данных, оплата и обращения.</p><div class="legal-meta"><span>Редакция {esc(data["version"])}</span><span>{esc(data["date"])}</span></div></div>{notice}<div class="legal-grid">{cards}</div><section class="legal-operator"><h2>Оператор проекта</h2><dl>{facts}</dl></section><section class="legal-operator"><h2>Обращения и запросы</h2><p>Пользователь может направить запрос о данных, удалении аккаунта, отзыве согласия, инциденте, оплате или претензии через профиль. Ответ сохраняется в кабинете.</p><p>Отправка обращения не запускает автоматическое удаление или возврат. Для обращений лиц без аккаунта внешний контакт ещё нужно указать.</p><div class="legal-actions"><a class="legal-button legal-button--primary" href="/app/#profile">Перейти к обращениям</a><button class="legal-button" data-privacy-settings type="button">Настройки cookies</button></div></section>'
    (root/'index.html').write_text(page('Юридическая информация',home))
    for d in docs:
        toc='<nav class="legal-toc" aria-label="Содержание"><strong>В этом документе</strong>'+''.join(f'<a href="#section-{n+1}">{esc(s["title"])}</a>' for n,s in enumerate(d['sections']))+'<a href="/legal/">← Все документы</a></nav>'
        article=''.join(f'<section id="section-{n+1}"><h2>{esc(s["title"])}</h2>'+''.join('<p>'+esc(p)+'</p>' for p in s['paragraphs'])+'</section>' for n,s in enumerate(d['sections']))
        body=f'<div class="legal-hero"><span class="legal-eyebrow">ZetSlay / Документы</span><h1>{esc(d["title"])}</h1><p>{esc(d["summary"])}</p><div class="legal-meta"><span>Редакция {esc(data["version"])}</span><span>{esc(data["date"])}</span></div></div>{notice}<div class="legal-actions"><button class="legal-button" type="button" data-legal-print>Печать / PDF</button><a class="legal-button" href="/app/#profile">Направить обращение</a></div><div class="legal-layout">{toc}<article class="legal-article">{article}</article></div>'
        (root/f'{d["id"]}.html').write_text(page(d['title'],body))

if __name__=='__main__':build(sys.argv[1])
