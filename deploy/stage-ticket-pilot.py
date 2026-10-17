"""Add Ticket Pilot and the Ultra entitlement without replacing the cabinet."""
from pathlib import Path
import importlib.util,re,sys
VERSION='20261017-ticket-pilot'
ASSETS=['app/ticket-pilot.js','app/ticket-pilot.css','app/assets/plugin-covers/ticket-pilot.svg']
def once(text,old,new):
 if new in text:return text
 if text.count(old)!=1:raise ValueError('Не подтверждена интеграция Ticket Pilot: '+old[:70])
 return text.replace(old,new,1)
def stage(local,incoming,out):
 local,incoming,out=map(Path,(local,incoming,out))
 spec=importlib.util.spec_from_file_location('tariff_stage',incoming/'deploy/stage-tariff-catalog.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);module.stage(local,incoming,out)
 html=(out/'app/index.html').read_text();app=(local/'app/app.js').read_text();page=(local/'app/plugin-page.js').read_text();rarity=(local/'app/plugin-rarity.js').read_text();access=(local/'app/subscription-access.js').read_text()
 app=once(app,'function resetAccountData() {',"function resetAccountData() {\n  if(typeof resetTicketPilotUi==='function')resetTicketPilotUi();")
 page=once(page,"  'orders:read':", "  'support:write': ['Обращаться в поддержку FunPay', 'Создавать и дополнять обращения после проверки выполненных заказов и отдельного разрешения отправки.'],\n  'orders:read':")
 page=once(page,"  return plugin.id === 'zetslay.mass-price-editor'", "  if(plugin.id==='zetslay.ticket-pilot')return 'assets/plugin-covers/ticket-pilot.svg';\n  return plugin.id === 'zetslay.mass-price-editor'")
 page=once(page,'    <div class="plugin-page-layout"><div class="plugin-page-main">\n','    <div class="plugin-page-layout"><div class="plugin-page-main">\n      ${plugin.id === \'zetslay.ticket-pilot\' && typeof ticketPilotMarkup === \'function\' ? ticketPilotMarkup(plugin) : \'\'}\n')
 page=once(page," : plugin.id === 'zetslay.ai-reviews' ?"," : plugin.id === 'zetslay.ticket-pilot' ? 'Обращение отправляется только по выполненным заказам. Проверьте текст и список; при неизвестном результате новая отправка блокируется. Решение принимает поддержка FunPay.' : plugin.id === 'zetslay.ai-reviews' ?")
 rarity=once(rarity,"  'zetslay.ai-reviews':'ultra',", "  'zetslay.ai-reviews':'ultra',\n  'zetslay.ticket-pilot':'ultra',")
 access=once(access,'const subscriptionTier={ ',"const subscriptionTier={ 'zetslay.ticket-pilot':2, ")
 for asset in ['ticket-pilot.js','ticket-pilot.css']:
  pattern=(r'<script\b[^>]*src=["\']ticket-pilot\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>' if asset.endswith('.js') else r'<link\b[^>]*href=["\']ticket-pilot\.css(?:\?[^"\']*)?["\'][^>]*>')
  if len(re.findall(pattern,html))>1:raise ValueError('Дубли ресурсов Ticket Pilot')
  html=re.sub(pattern+r'[ \t]*\r?\n?','',html);anchor='</body>' if asset.endswith('.js') else '</head>'
  if html.count(anchor)!=1:raise ValueError('Не подтверждена структура кабинета')
  tag=f'<script src="{asset}?v={VERSION}" defer></script>' if asset.endswith('.js') else f'<link rel="stylesheet" href="{asset}?v={VERSION}">'
  html=html.replace(anchor,tag+'\n'+anchor)
 for asset in ['app.js','plugin-page.js','plugin-rarity.js','subscription-access.js']:
  html,n=re.subn(r'(src=["\'])'+re.escape(asset)+r'(?:\?[^"\']*)?(["\'])',lambda m:m[1]+asset+'?v='+VERSION+m[2],html)
  if n!=1:raise ValueError('Не найден единственный ресурс '+asset)
 for name,text in {'app/index.html':html,'app/app.js':app,'app/plugin-page.js':page,'app/plugin-rarity.js':rarity,'app/subscription-access.js':access}.items():(out/name).write_text(text)
 for name in ASSETS:
  target=out/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((incoming/name).read_bytes())
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (OSError,ValueError) as e:raise SystemExit(str(e))
