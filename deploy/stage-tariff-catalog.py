"""Update only tariff sections, FAQ and quote assets on the installed site."""
from pathlib import Path
import importlib.util,json,re,sys
MARKER='/* Common workspace capabilities and the current plugin catalogue. */'
def require(value,message):
 if not value:raise ValueError(message+' Файлы не изменены.')
def stage(local,incoming,out):
 local,incoming,out=map(Path,[local,incoming,out]);spec=importlib.util.spec_from_file_location('pricing_build',incoming/'deploy/build-subscription-pricing.py');builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
 data=json.loads((incoming/'subscription-plans.json').read_text());builder.validate(data)
 landing=(local/'index.html').read_text();cabinet=(local/'app/index.html').read_text()
 for s in [landing,cabinet]:require(not re.search(r'^(<<<<<<<|=======|>>>>>>>)',s,re.M),'Конфликт исходных файлов.')
 landing=builder.cache(builder.faq(builder.replace_section(landing,'tariffs',builder.markup(data)),data),['landing-pricing.js','landing-pricing.css'])
 cabinet=builder.cache(builder.replace_section(cabinet,'billing-tariffs',builder.markup(data,True)),['billing-pricing.js','billing-pricing.css','billing.js'])
 pattern=r'<script\b[^>]*src=["\']tariff-summary\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>'
 require(len(re.findall(pattern,cabinet))<=1,'Дублируется сводка тарифа.');cabinet=re.sub(pattern+r'[ \t]*\r?\n?','',cabinet)
 require(cabinet.count('</body>')==1,'Не подтверждена разметка кабинета.');cabinet=cabinet.replace('</body>','<script src="tariff-summary.js?v=20261016-current-catalog" defer></script>\n</body>')
 runtime=(incoming/'deploy/subscription-pricing-runtime.js').read_text().replace('__CATALOG__',json.dumps(data,ensure_ascii=False,separators=(',',':')))
 files={'index.html':landing,'app/index.html':cabinet,'subscription-plans.json':(incoming/'subscription-plans.json').read_text(),'landing-pricing.js':runtime,'app/billing-pricing.js':runtime}
 for name in ['landing-pricing.css','app/billing-pricing.css']:
  current=(local/name).read_text();new=(incoming/name).read_text();require('.landing-pricing' in current and new.count(MARKER)==1,'Не подтверждены стили тарифов.');require(current.count(MARKER)<=1,'Дублируются стили сравнения.');files[name]=current.split(MARKER)[0].rstrip()+'\n'+MARKER+new.split(MARKER)[1]
 fixture=local/'app/billing-section.html' if (local/'app/billing-section.html').exists() else incoming/'app/billing-section.html'
 files['app/billing-section.html']=builder.replace_section(fixture.read_text(),'billing-tariffs',builder.markup(data,True))
 for name in ['app/tariff-catalog.test.mjs','app/tariff-summary.js','app/tariff-summary.test.mjs','app/billing.test.mjs','deploy/landing-pricing.test.mjs']:
  files[name]=(incoming/name).read_text()
 for name,text in files.items():p=out/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (OSError,ValueError,AssertionError) as e:raise SystemExit(str(e))
