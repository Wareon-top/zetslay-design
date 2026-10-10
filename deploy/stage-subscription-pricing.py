"""Stage tariff sections and the tariff-only dialog branch, preserving live edits."""
import importlib.util
import json
from pathlib import Path
import re
import sys

spec=importlib.util.spec_from_file_location('pricing_build',Path(__file__).with_name('build-subscription-pricing.py'))
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
ASSETS=('landing-pricing.js','app/billing-pricing.js')

def no_conflict(text):
    if re.search(r'^(<<<<<<<|=======|>>>>>>>)',text,re.M):raise ValueError('Есть конфликт; сайт не изменён.')

def branch(text):
    start="    const card = [...root.querySelectorAll('[data-pricing-plan]')].find"
    end='\n  }\n  closeBillingDialog();'
    if text.count(start)!=1 or text.count(end)!=1:raise ValueError('Неизвестное окно тарифа; кабинет не изменён.')
    a=text.index(start);b=text.index(end,a)
    return a,b

def faq(text, incoming):
    for identifier in ('faq-plans','faq-external-costs','faq-plugins'):
        pattern=r'<details\b(?=[^>]*\bid="'+identifier+r'")[^>]*>.*?</details>'
        old=list(re.finditer(pattern,text,re.S));new=list(re.finditer(pattern,incoming,re.S))
        if len(old)!=1 or len(new)!=1:raise ValueError('Не подтверждён вопрос '+identifier+'; сайт не изменён.')
        a=old[0];text=text[:a.start()]+new[0].group()+text[a.end():]
    return text

def stage(local,incoming,out):
    local,incoming,out=map(Path,(local,incoming,out))
    files={name:(local/name).read_text() for name in ('index.html','app/index.html','app/billing.js')}
    for text in files.values():no_conflict(text)
    desired={name:(incoming/name).read_text() for name in files}
    catalog=json.loads((incoming/'subscription-plans.json').read_text());builder.validate(catalog)
    amounts=[str(plan['monthlyRub']) for plan in catalog['plans']]
    for name,identifier in (('index.html','tariffs'),('app/index.html','billing-tariffs')):
        new=builder.section(desired[name],identifier).group()
        if re.findall(r'data-monthly-rub="(\d+)"',new)!=amounts:raise ValueError('Неверные цены; сайт не изменён.')
        files[name]=builder.replace_section(files[name],identifier,new)
    files['index.html']=builder.cache(faq(files['index.html'],desired['index.html']),['landing-pricing.js'])
    files['app/index.html']=builder.cache(files['app/index.html'],['billing-pricing.js','billing.js'])
    a,b=branch(files['app/billing.js']);x,y=branch(desired['app/billing.js'])
    files['app/billing.js']=files['app/billing.js'][:a]+desired['app/billing.js'][x:y]+files['app/billing.js'][b:]
    for asset in ASSETS:
        files[asset]=(incoming/asset).read_text()
        if not files[asset].strip():raise ValueError('Пустой модуль; сайт не изменён.')
    if files[ASSETS[0]]!=files[ASSETS[1]]:raise ValueError('Источники цен расходятся; сайт не изменён.')
    out.mkdir(parents=True,exist_ok=False)
    for name,text in files.items():
        path=out/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text)

if __name__=='__main__':
    try:stage(*sys.argv[1:])
    except (ValueError,OSError) as error:print(str(error),file=sys.stderr);sys.exit(1)
