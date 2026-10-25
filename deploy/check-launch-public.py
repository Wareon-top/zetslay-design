"""Read-only post-install check; never prints publication contents or account data."""
import concurrent.futures,json,urllib.request
URLS={'landing':'https://zetslay.pro/','cabinet':'https://zetslay.pro/app/','robots':'https://zetslay.pro/robots.txt','sitemap':'https://zetslay.pro/sitemap.xml','terms':'https://zetslay.pro/legal/terms.html','css':'https://zetslay.pro/app/launch-readiness.css','health':'https://api.zetslay.pro/health','siteLegal':'https://zetslay.pro/legal/publication.json','apiLegal':'https://api.zetslay.pro/api/v1/legal/status'}
def load(item):
 name,url=item
 with urllib.request.urlopen(urllib.request.Request(url,headers={'Cache-Control':'no-cache'}),timeout=12) as r:
  if r.status!=200:raise ValueError(name)
  data=r.read(524289)
  if len(data)>524288:raise ValueError(name)
 return name,data.decode('utf-8')
def main():
 try:
  with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:pages=dict(pool.map(load,URLS.items()))
  assert 'property="og:title"' in pages['landing'] and 'rel="canonical"' in pages['landing']
  assert 'data-auth-confirm-row' in pages['cabinet'] and '20261025-launch-readiness' in pages['cabinet']
  assert 'Sitemap: https://zetslay.pro/sitemap.xml' in pages['robots']
  assert '<urlset' in pages['sitemap'] and '/legal/offer.html' in pages['terms']
  assert json.loads(pages['health'])['data']['status']=='ok'
  a=json.loads(pages['apiLegal'])['data'];b=json.loads(pages['siteLegal'])
  assert a.get('version') and a.get('hash') and a['version']==b.get('version') and a['hash']==b.get('hash')
  print(json.dumps({'publicChecks':True,'legalVersionsMatch':True,'operatorReviewPending':[key for key in ['processorNamesVerified','localizationReviewed'] if not a.get(key)]},ensure_ascii=False))
 except Exception as error:
  print('Публичная проверка не подтверждена: '+type(error).__name__+'. Файлы уже установлены; проверьте журнал задания.')
  return 1
 return 0
if __name__=='__main__':raise SystemExit(main())
