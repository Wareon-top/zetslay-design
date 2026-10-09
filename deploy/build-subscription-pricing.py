"""Generate both tariff presentations from one commercial catalogue."""
import argparse
import html
import json
from pathlib import Path
import re

VERSION = '20261009-subscriptions'
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
    assert [p['id'] for p in data['plans']]==['start','growth','pro','maximum']
    amounts=[p['monthlyRub'] for p in data['plans']]
    assert all(type(price) is int and 149<=price<=100000 for price in amounts)
    assert amounts==sorted(set(amounts))
    levels=['common','advanced','ultra','legendary']
    for index,plan in enumerate(data['plans']):
        assert plan['includes']==levels[:index+1]
        assert plan['features'] and len(plan['features'])<=10
    assert [(p['months'],p['discount']) for p in data['periods'].values()]==[(1,0),(3,10),(12,20)]

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
    <p class="pricing-card__price-note" data-pricing-note>Итого {plan['monthlyRub']} ₽ за 1 месяц доступа</p>{action}</div>
  <ul class="pricing-card__features" aria-label="Возможности тарифа {name}">{features}</ul>
  <div class="pricing-card__footer"><strong>{esc(plan['footer'])}</strong><p>{esc(plan['footerDescription'])}</p></div>
</article>''')
    picker=''.join(f'<button type="button" data-pricing-period="{key}" aria-pressed="{str(key=="month").lower()}">{esc(period["label"])}'+(f' <span>−{period["discount"]}%</span>' if period['discount'] else '')+'</button>' for key,period in data['periods'].items())
    conditions=''.join(f'<p>{esc(text)}</p>' for text in data['conditions'])
    legal='../legal/' if cabinet else 'legal/'
    return f'''<section class="section landing-pricing" id="{identifier}" {'data-billing-pricing' if cabinet else 'data-section="access"'} data-landing-pricing="plans-v1" aria-labelledby="{identifier}-title">
  <div class="landing-pricing__shell"><div class="landing-pricing__heading"><div><h2 id="{identifier}-title">{heading}</h2><p>Выберите доступ к нужным категориям плагинов. Каждый следующий тариф включает предыдущий.</p></div><div class="pricing-period" role="group" aria-label="Период доступа" data-pricing-periods hidden>{picker}</div></div>
    <div class="landing-pricing__grid">{''.join(cards)}</div>
    <div class="landing-pricing__notes"><p><strong>Что входит в стоимость</strong></p>{conditions}<p><strong>Оплата и запуск.</strong> {esc(data['availability'])} Автоматическое продление и регулярные списания не подключены.</p><p><a href="{legal}offer.html">Условия использования</a> · <a href="{legal}refunds.html">Оплата и возвраты</a> · <a href="{legal}privacy.html">Конфиденциальность</a></p></div>
    <p class="pricing-announcement" role="status" aria-live="polite" aria-atomic="true" data-pricing-announcement></p>
  </div>
</section>'''

def faq(text,data):
    content={
      'faq-plans':'<p>«Старт» — 149 ₽/месяц: обычные плагины. «Рост» — 299 ₽/месяц: обычные и продвинутые. «Профи» — 499 ₽/месяц: дополнительно ультра. «Максимум» — 799 ₽/месяц: все четыре категории, включая легендарные.</p><p>На 3 месяца действует скидка 10%, на 12 месяцев — 20%. Под ценой показана полная сумма выбранного периода. Приём платежей подключается; кнопка открывает регистрацию и не списывает деньги.</p><a href="#tariffs">Сравнить тарифы →</a>',
      'faq-external-costs':'<p>Подписка включает доступ к ZetSlay и опубликованным собственным плагинам выбранных категорий. Прокси, аренды Kosell, товары LZT Market, Robux, Stars и комиссии внешних площадок оплачиваются отдельно. Их покупка требует ваших настроек и разрешений.</p>',
      'faq-plugins':'<p>Обычные: Confirm Reminder и Review Reminder. Продвинутые: Lot Cloner, Mass Price Editor, «Пауза продаж» и Auto Review Bonus. Ультра: Kosell Rent, TikTok LZT Market, Roblox LZT Market и Stars Relay. Легендарный: Robux Relay.</p><p>Включение и настройка доступны в кабинете и персональном Telegram-боте. Возможности конкретного модуля и его ограничения описаны на странице «Подробнее».</p><a href="#plugins">Открыть каталог плагинов →</a>'}
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
    landing=cache(faq(replace_section((root/'index.html').read_text(),'tariffs',markup(data)),data),['landing-pricing.js'])
    cabinet=cache(replace_section((root/'app/index.html').read_text(),'billing-tariffs',markup(data,True)),['billing-pricing.js','billing.js'])
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
