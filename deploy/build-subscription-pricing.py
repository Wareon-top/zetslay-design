"""Generate both tariff presentations from one commercial catalogue."""
import argparse
import html
import json
from pathlib import Path
import re

VERSION = '20261016-current-catalog'
CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>'
esc = lambda value: html.escape(str(value), quote=True)

def section(text, identifier):
    matches = list(re.finditer(r'<section\b(?=[^>]*\bid=["\']'+re.escape(identifier)+r'["\'])[^>]*>.*?</section>',text,re.S))
    if len(matches)!=1 or matches[0].group().count('<section')!=1:
        raise ValueError('Не найден единственный блок '+identifier)
    return matches[0]

def replace_section(text, identifier, markup):
    match=section(text,identifier)
    return text[:match.start()]+markup+text[match.end():]

def validate(data):
    assert data['currency']=='RUB' and data['paymentAvailable'] is False
    assert type(data['maxTransactionKopecks']) is int and data['maxTransactionKopecks']==1000000
    assert data['approvalMarker'] in ('', 'плаtega')
    assert [p['id'] for p in data['plans']]==['start','growth','pro','maximum']
    amounts=[p['monthlyRub'] for p in data['plans']]
    assert all(type(price) is int and 149<=price<=100000 for price in amounts)
    assert amounts==sorted(set(amounts))
    levels=['common','advanced','ultra','legendary']
    for index,plan in enumerate(data['plans']):
        assert plan['includes']==levels[:index+1]
        assert plan['features'] and len(plan['features'])<=10
    assert [(p['months'],p['discount']) for p in data['periods'].values()]==[(1,0),(3,10),(12,20)]
    assert [p['days'] for p in data['periods'].values()]==[30,90,360]
    assert data['trial']['days']==3 and data['trial']['includes']==levels[:3]
    assert [g['rarity'] for g in data['pluginGroups']]==levels
    ids=[p['id'] for g in data['pluginGroups'] for p in g['plugins']]
    assert len(ids)==len(set(ids)) and all(re.fullmatch(r'zetslay\.[a-z0-9-]+',pid) for pid in ids)
    assert all(g['plugins'] and g['label'] and all(p['name'] and p['description'] for p in g['plugins']) for g in data['pluginGroups'])
    assert len(data['platformFeatures'])==6 and all(p['title'] and p['description'] for p in data['platformFeatures'])
    for price in amounts:
        for period in data['periods'].values():
            assert price*(100-period['discount'])*period['months']<=data['maxTransactionKopecks'], 'Стоимость периода превышает лимит одной транзакции'

def platform_markup(data):
    features=''.join(f'<li>{CHECK}<div><strong>{esc(f["title"])}</strong><p>{esc(f["description"])}</p></div></li>' for f in data['platformFeatures'])
    return f'<div class="pricing-platform" data-pricing-platform><div class="pricing-platform__heading"><span>Основа каждого тарифа</span><h3>Полный кабинет — уже в «Старте»</h3><p>Разница между тарифами — в доступных редкостях плагинов. Эти возможности есть во всех четырёх тарифах.</p></div><ul>{features}</ul></div>'

def comparison_markup(data):
    headers=''.join(f'<th scope="col">{esc(p["name"])}</th>' for p in data['plans'])
    rows=[]
    for group in data['pluginGroups']:
        rarity=group['rarity']
        rows.append(f'<tr class="pricing-comparison__group"><th scope="rowgroup" colspan="5"><span class="pricing-level pricing-level--{rarity}">{esc(group["label"])}</span></th></tr>')
        for plugin in group['plugins']:
            cells=''.join(f'<td data-plan-id="{p["id"]}" data-included="{str(rarity in p["includes"]).lower()}"><span class="pricing-inclusion">{CHECK if rarity in p["includes"] else "—"}<span class="pricing-sr-only">{"Входит" if rarity in p["includes"] else "Не входит"}</span></span></td>' for p in data['plans'])
            rows.append(f'<tr data-pricing-plugin="{plugin["id"]}"><th scope="row"><strong>{esc(plugin["name"])}</strong><small>{esc(plugin["description"])}</small></th>{cells}</tr>')
    count=sum(len(g['plugins']) for g in data['pluginGroups'])
    return f'<details class="pricing-comparison" data-pricing-comparison><summary><span>Сравнить плагины по тарифам<small>Состав каталога: {count} модулей · четыре редкости</small></span><span class="pricing-comparison__toggle" aria-hidden="true">+</span></summary><div class="pricing-comparison__scroll" tabindex="0" role="region" aria-label="Сравнение плагинов; на узком экране прокрутите таблицу вправо"><table><caption>Опубликованные собственные плагины ZetSlay по тарифам</caption><thead><tr><th scope="col">Плагин</th>{headers}</tr></thead><tbody>{"".join(rows)}</tbody></table></div><p>Доступ к включённым плагинам действует в течение подписки. В таблице показаны плагины, включённые в подписку. Отдельно купленные бессрочные лицензии работают с любым активным платным тарифом. Пробный период сохраняет ограничения по редкостям; легендарные плагины в нём недоступны. Настройка и разрешения для операций включаются отдельно.</p></details>'

def markup(data, cabinet=False):
    identifier='billing-tariffs' if cabinet else 'tariffs'
    heading='Тарифы ZetSlay' if cabinet else 'Ваш магазин. Ваш масштаб.'
    cards=[]
    for plan in data['plans']:
        pid=plan['id']; name=esc(plan['name']); title=('billing-pricing-' if cabinet else 'pricing-')+pid+'-title'
        badge=f'<span class="pricing-card__featured">{esc(plan["featured"])}</span>' if plan.get('featured') else ''
        if cabinet:badge+=f'<span class="billing-current-plan" data-billing-current="{pid}" hidden>Ваш тариф</span>'
        action=(f'<button class="pricing-card__cta" type="button" data-billing-plan="{pid}" aria-label="Посмотреть условия тарифа {name}">Условия тарифа</button>' if cabinet else f'<a class="pricing-card__cta" href="app/?auth=register" aria-label="Создать кабинет — тариф {name}">Создать кабинет</a>')
        features=''.join(f'<li>{CHECK}<span>{esc(feature)}</span></li>' for feature in plan['features'])
        cards.append(f'''<article class="pricing-card pricing-card--{plan['palette']}{' pricing-card--featured' if plan.get('featured') else ''}" data-pricing-plan="{pid}" data-monthly-rub="{plan['monthlyRub']}" aria-labelledby="{title}">
  <div class="pricing-card__hero"><div class="pricing-card__avatar-row"><span class="pricing-avatar" aria-hidden="true"><i></i><i></i></span>{badge}</div>
    <h3 id="{title}">{name}</h3><p class="pricing-card__description">{esc(plan['description'])}</p>
    <div class="pricing-card__price"><strong data-pricing-price>{plan['monthlyRub']} ₽</strong><del data-pricing-original hidden>{plan['monthlyRub']} ₽</del><span>/ месяц</span></div>
    <p class="pricing-card__price-note" data-pricing-note>Итого {plan['monthlyRub']} ₽ за 30 дней доступа</p>{action}</div>
  <ul class="pricing-card__features" aria-label="Возможности тарифа {name}">{features}</ul>
  <div class="pricing-card__footer"><strong>{esc(plan['footer'])}</strong><p>{esc(plan['footerDescription'])}</p></div>
</article>''')
    picker=''.join(f'<button type="button" data-pricing-period="{key}" aria-pressed="{str(key=="month").lower()}">{esc(period["label"])}'+(f' <span>−{period["discount"]}%</span>' if period['discount'] else '')+'</button>' for key,period in data['periods'].items())
    conditions=''.join(f'<p>{esc(text)}</p>' for text in data['conditions'])
    legal='../legal/' if cabinet else 'legal/'
    review=f'<p data-payment-review-marker>Код согласования: <strong>{esc(data["approvalMarker"])}</strong></p>' if data['approvalMarker'] else ''
    return f'''<section class="section landing-pricing" id="{identifier}" {'data-billing-pricing' if cabinet else 'data-section="access"'} data-landing-pricing="plans-v1" aria-labelledby="{identifier}-title">
  <div class="landing-pricing__shell"><div class="landing-pricing__heading"><div><h2 id="{identifier}-title">{heading}</h2><p>Выберите доступ к нужным категориям плагинов. Каждый следующий тариф включает предыдущий.</p></div><div class="pricing-period" role="group" aria-label="Период доступа" data-pricing-periods hidden>{picker}</div></div>
    <div class="landing-pricing__grid">{''.join(cards)}</div>
    {platform_markup(data)}
    <div class="pricing-trial" data-pricing-trial><span><strong>{data['trial']['days']} дня на знакомство</strong><span>Пробный доступ</span></span><p>{esc(data['trial']['description'])}</p></div>
    {comparison_markup(data)}
    <div class="landing-pricing__notes"><p><strong>Что входит в стоимость</strong></p>{conditions}<p><strong>Оплата и запуск.</strong> {esc(data['availability'])} Автоматическое продление и регулярные списания не подключены.</p><p data-payment-limit><strong>Лимит одного платежа — 10 000 ₽.</strong> Пополнение счёта ZetSlay и стоимость одной оплачиваемой покупки не должны превышать эту сумму. Лимит относится к оплате нашего сервиса, а не к балансу вашего магазина или покупкам на внешних площадках.</p><nav aria-label="Документы проекта"><a href="{legal}offer.html">Пользовательское соглашение / публичная оферта</a> · <a href="{legal}privacy.html">Политика конфиденциальности</a> · <a href="{legal}refunds.html">Оплата и возвраты</a> · <a href="{legal}">Реквизиты и все документы</a></nav>{review}</div>
    <p class="pricing-announcement" role="status" aria-live="polite" aria-atomic="true" data-pricing-announcement></p>
  </div>
</section>'''

def faq(text,data):
    tiers=' '.join(f'«{p["name"]}» — {p["monthlyRub"]} ₽/месяц: '+('обычные плагины.' if p['id']=='start' else 'обычные и продвинутые.' if p['id']=='growth' else 'дополнительно ультра.' if p['id']=='pro' else 'все четыре категории, включая легендарные.') for p in data['plans'])
    plugins=' '.join(g['label']+': '+', '.join(p['name'] for p in g['plugins'])+'.' for g in data['pluginGroups'])
    external=next(x for x in data['conditions'] if x.startswith('Прокси,'))
    content={
      'faq-plans':'<p>'+esc(tiers)+'</p><p>Для подключения и синхронизации FunPay и работы плагинов нужен активный тариф или пробный период. Это условие действует и для плагинов, купленных навсегда. Лицензии сохраняются после окончания подписки.</p><p>На 3 месяца действует скидка 10%, на 12 месяцев — 20%. Под ценой показана полная сумма выбранного периода. Подписка оплачивается с внутреннего баланса, пополняемого через Platega. Кнопка на сайте открывает кабинет и сама не списывает деньги.</p><p>Месяц — 30 дней, 3 месяца — 90 дней, 12 месяцев — 360 дней. Пробный период: 3 дня, весь кабинет и обычные, продвинутые и ультра-плагины; легендарные не включены. Постоянного бесплатного тарифа нет.</p><a href="#tariffs">Сравнить тарифы →</a>',
      'faq-external-costs':'<p>'+esc(external)+'</p><p>Подписка даёт доступ к программным возможностям, а не оплачивает внешние товары или расход API. Эти операции требуют ваших настроек и разрешений.</p>',
      'faq-plugins':'<p>'+esc(plugins)+'</p><p>Бессрочная покупка закрепляет лицензию, но не даёт бесплатного доступа к сервису. Для работы нужен активный тариф или пробный период с учётом доступных в нём редкостей; после его окончания лицензия сохраняется.</p><p>Возможности конкретного модуля, способы управления и ограничения описаны на странице «Подробнее».</p><a href="#plugins">Открыть каталог плагинов →</a>'}
    for identifier,body in content.items():
        pattern=r'(<details\b(?=[^>]*\bid="'+identifier+r'")[^>]*>.*?<div class="faq-item__answer">).*?(</div>\s*</details>)'
        text,count=re.subn(pattern,lambda m:m[1]+body+m[2],text,flags=re.S)
        if count!=1:raise ValueError('Не найден вопрос '+identifier)
    return text

def cache(text, names):
    for name in names:
        pattern=r'(["\'])'+re.escape(name)+r'(?:\?[^"\']*)?(["\'])'
        text,count=re.subn(pattern,lambda m:m[1]+name+'?v='+VERSION+m[2],text)
        if count!=1:raise ValueError('Не найден единственный ресурс '+name)
    return text

def outputs(root):
    data=json.loads((root/'subscription-plans.json').read_text());validate(data)
    landing=cache(faq(replace_section((root/'index.html').read_text(),'tariffs',markup(data)),data),['landing-pricing.js','landing-pricing.css'])
    cabinet=cache(replace_section((root/'app/index.html').read_text(),'billing-tariffs',markup(data,True)),['billing-pricing.js','billing-pricing.css','billing.js'])
    # Finance updater fixture stays synchronized; no store/account panels are changed.
    fixture=(root/'app/billing-section.html').read_text()
    fixture=replace_section(fixture,'billing-tariffs',markup(data,True))
    script=(root/'deploy/subscription-pricing-runtime.js').read_text().replace('__CATALOG__',json.dumps(data,ensure_ascii=False,separators=(',',':')))
    return {'index.html':landing,'app/index.html':cabinet,'app/billing-section.html':fixture,'landing-pricing.js':script,'app/billing-pricing.js':script}

def build(root, check=False):
    generated=outputs(Path(root))
    if check:
        stale=[name for name,text in generated.items() if (Path(root)/name).read_text()!=text]
        if stale:raise ValueError('Тарифы требуют пересборки: '+', '.join(stale))
    else:
        for name,text in generated.items():(Path(root)/name).write_text(text)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('root');parser.add_argument('--check',action='store_true');args=parser.parse_args();build(args.root,args.check)
