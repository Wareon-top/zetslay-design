"""Prepare a public demo and reply preview while retaining the installed cabinet HTML and runtime edits."""
import hashlib,json,re,sys
from pathlib import Path
def digest(data):return hashlib.sha256(data).hexdigest()
def read(path):return path.read_bytes().decode('utf-8')
def patch(text,ops,name):
 for op in ops:
  before,after=op['before'],op['after']
  if '\r\n' in text:before,after=before.replace('\n','\r\n'),after.replace('\n','\r\n')
  if text.count(after)==1 and before not in text.replace(after,'',1):continue
  if text.count(before)!=1 or after in text:raise ValueError('Не распознан участок '+name+'. Исходные файлы не изменены.')
  text=text.replace(before,after,1)
 return text
def asset(html,name,version,kind,required=False):
 attribute='src' if kind=='script' else 'href';tag='script' if kind=='script' else 'link'
 pattern=r'<'+tag+r'\b[^>]*\b'+attribute+r'=["\'](?:\./)?'+re.escape(name)+r'(?:\?[^"\']*)?["\'][^>]*>'+(r'\s*</script>' if kind=='script' else '')
 matches=list(re.finditer(pattern,html,re.I))
 if len(matches)>1 or required and len(matches)!=1:raise ValueError('Не подтверждено подключение '+name)
 replacement='<script src="'+name+'?v='+version+'" defer></script>' if kind=='script' else '<link rel="stylesheet" href="'+name+'?v='+version+'">'
 if matches:return html[:matches[0].start()]+replacement+html[matches[0].end():]
 end='</body>' if kind=='script' else '</head>'
 if html.count(end)!=1:raise ValueError('Не подтверждены границы HTML')
 return html.replace(end,replacement+'\n'+end,1)
def stage(local,incoming,out):
 local,incoming,out=map(Path,(local,incoming,out));manifest=json.loads(read(incoming/'deploy/competitive-release.json'));version=manifest['version'];result={}
 for name,sha in manifest['assets'].items():
  if Path(name).is_absolute() or '..' in Path(name).parts:raise ValueError('Недопустимый путь')
  data=(incoming/name).read_bytes().replace(b'\r\n',b'\n')
  if digest(data)!=sha:raise ValueError('Повреждён файл '+name)
  if (local/name).exists() and (local/name).read_bytes().replace(b'\r\n',b'\n')!=data:raise ValueError('Найдены независимые изменения '+name+'. Автоматическая замена остановлена.')
  result[name]=data
 for name,ops in manifest['patches'].items():result[name]=patch(read(local/name),ops,name).encode('utf-8')
 app=read(local/'app/index.html')
 for name in ['app.js','store-tools.js','basic-automation.js','cabinet-demo.js','connection-wizard-ui.js']:
  if len(re.findall(r'\bsrc=["\'](?:\./)?'+re.escape(name)+r'(?:\?[^"\']*)?["\']',app))!=1:raise ValueError('Сначала требуется установленная базовая автоматизация: '+name)
 if app.index('basic-automation.js')<app.index('store-tools.js'):raise ValueError('Неверный порядок модулей автоматизации')
 for name in ['cabinet-demo.js','connection-wizard-ui.js']:app=asset(app,name,version,'script',True)
 app=asset(app,'automation-preview.css',version,'link');app=asset(app,'automation-preview.js',version,'script')
 if app.index('automation-preview.js')<app.index('basic-automation.js'):raise ValueError('Неверный порядок проверки правил')
 result['app/index.html']=app.encode('utf-8')
 landing=read(local/'index.html')
 for label in ['Основная навигация','Мобильная навигация']:
  pattern=r'(<nav\b[^>]*aria-label="'+label+r'"[^>]*>)([\s\S]*?)(</nav>)';matches=list(re.finditer(pattern,landing))
  if len(matches)!=1:raise ValueError('Не подтверждена навигация сайта')
  match=matches[0];body=match[2]
  for path,title in [('demo/','Демо'),('docs/','Инструкции'),('pricing/','Стоимость')]:
   if not re.search(r'href="/?'+re.escape(path)+'"',body):body+='<a href="'+path+'">'+title+'</a>'
  landing=landing[:match.start()]+match[1]+body+match[3]+landing[match.end():]
 landing,count=re.subn(r'(<a class="hero-guide" href=")[^"]*(">)[^<]*',r'\g<1>demo/\g<2>Посмотреть демо ',landing)
 if count!=1:raise ValueError('Не подтверждена кнопка демонстрации')
 landing=landing.replace('Заказы, сообщения и автоматизация магазина.<br class="hero-lead__break"> Всё под вашим контролем — в одном кабинете.','Заказы FunPay, сообщения, склад и автоматизация.<br class="hero-lead__break"> Попробуйте кабинет на учебном магазине до регистрации.')
 result['index.html']=landing.encode('utf-8')
 robots=read(local/'robots.txt')
 if not re.search(r'^Disallow:\s*/demo/\s*$',robots,re.M):robots+='\nDisallow: /demo/\n'
 result['robots.txt']=robots.encode('utf-8')
 sitemap=read(local/'sitemap.xml')
 if sitemap.count('</urlset>')!=1:raise ValueError('Не подтверждён sitemap')
 for path in ['pricing/','docs/','docs/funpay-connect/','docs/auto-delivery/','docs/troubleshooting/']:
  url='https://zetslay.pro/'+path
  if '<loc>'+url+'</loc>' not in sitemap:sitemap=sitemap.replace('</urlset>','  <url><loc>'+url+'</loc></url>\n</urlset>')
 result['sitemap.xml']=sitemap.encode('utf-8')
 # Write only after every source, anchor, dependency and hash has been checked.
 out.mkdir(parents=True,exist_ok=True)
 for name,data in result.items():target=out/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
 return result
if __name__=='__main__':
 try:stage(*sys.argv[1:])
 except (OSError,ValueError,KeyError) as error:raise SystemExit(str(error))
