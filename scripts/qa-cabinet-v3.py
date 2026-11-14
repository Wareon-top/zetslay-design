"""Isolated production-page browser checks. API fixtures exist only in this test.
No request can reach the real API. Uses local installed Chrome via Playwright.
"""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from threading import Thread
from urllib.parse import urlparse
from datetime import datetime, timedelta, timezone
import json, os
from playwright.sync_api import sync_playwright

ROOT=Path(os.environ.get('ZETSLAY_QA_ROOT',Path(__file__).resolve().parents[1]))
OUT=Path(os.environ.get('ZETSLAY_QA_OUTPUT',ROOT/'artifacts/cabinet-v3-qa'))
OUT.mkdir(parents=True,exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
now=datetime.now(timezone.utc)
until=(now+timedelta(days=20)).isoformat()
workspace={'id':'qa-workspace','name':'QA магазин','plan':{'id':'maximum','active':True,'activatedAt':now.isoformat(),'expiresAt':until},'pluginLicenses':[]}
user={'id':'qa-user','email':'qa@example.invalid','role':'user','createdAt':'2026-10-01T00:00:00Z'}
session={'token':'isolated-qa-token','user':user,'workspace':workspace,'expiresAt':until}
profile={'profile':{'displayName':'QA продавец','bio':'Тест интерфейса','avatar':'','publicVisible':False,'authorId':'author_12345678-1234-1234-1234-123456789abc','version':1},'identity':{**user,'telegramUserId':'123456','telegramUsername':'qa_seller'},'plan':workspace['plan']}
entries=[{'id':'zetslay.stars-relay','name':'Stars Relay','category':'sales','priceRub':990,'description':'Автоматизация заказов на Telegram Stars.','published':True,'permissions':['orders:read'],'events':['order.paid'],'installation':None}, {'id':'zetslay.kosell-rent','name':'Kosell Rent','category':'sales','priceRub':1200,'description':'Аренда игр через Kosell.','published':True,'permissions':['orders:read'],'events':['order.paid'],'installation':{'enabled':False,'config':{}}}]
read_data={
 '/api/v1/auth/resume':session,
 '/api/v1/profile':profile,
 '/api/v1/plugin-catalog':{'entries':entries,'canManage':False},
 '/api/v1/plugin-audit':{'entries':[]},
 '/api/v1/subscription/status':{'workspace':workspace,'trial':{'state':'used'}},
 '/api/v1/funpay/connection':{'connected':False,'store':None},
 '/api/v1/onboard':{'state':'telegram_bot_required','activePlan':True,'telegram':{'linked':False,'botConfigured':False},'funPay':{'proxyConfigured':False}},
 '/api/v1/account/security':{'mfa':{'enabled':False},'sessions':[],'passkeys':[]},
 '/api/v1/account/sync-health':{'status':'ok','checks':[]},
 '/api/v1/legal/requests':{'requests':[],'admin':False},
 '/api/v1/events':{'events':[],'total':0,'unread':0,'counts':{}},
 '/api/v1/finance':{'stores':[],'withdrawalIntents':[],'liveWithdrawalEnabled':False},
 '/api/v1/funpay/content':{'orders':[],'messages':[],'lots':[],'observedAt':now.isoformat()},
 '/api/v1/funpay/inventory':{'lots':[],'categories':[]},
}
errors=[];requests=[];checks=[];failed_assets=[]
profile_save_failure=[True]
def check(name,condition):
    checks.append({'name':name,'passed':bool(condition)})
    if not condition: print('FAIL',name)
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
    def route_api(route):
        request=route.request;path=urlparse(request.url).path
        requests.append({'path':path,'method':request.method})
        if path=='/api/v1/profile' and request.method=='POST':
            if profile_save_failure[0]:
                route.fulfill(status=503,content_type='application/json',body=json.dumps({'error':{'code':'TEMPORARY','message':'Проверка отказа сохранения'}}))
            else:
                body=request.post_data_json
                profile['profile'].update({k:body[k] for k in ['displayName','bio','publicVisible','avatar']})
                profile['profile']['version']+=1
                route.fulfill(status=200,content_type='application/json',body=json.dumps({'data':profile}))
            return
        if path in read_data:
            route.fulfill(status=200,content_type='application/json',body=json.dumps({'data':read_data[path]},ensure_ascii=False))
        else:
            route.fulfill(status=404,content_type='application/json',body=json.dumps({'error':{'code':'NOT_FOUND','message':'Этот источник недоступен в изолированном тесте'}}))
    context.route('**/api/v1/**',route_api)
    context.route('https://**/*',lambda route:route.abort() if '/api/v1/' not in route.request.url else route_api(route))
    page=context.new_page()
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('response',lambda response:failed_assets.append(response.url) if response.status>=400 and '/api/v1/' not in response.url else None)
    page.goto(f'http://127.0.0.1:{server.server_port}/app/?role=admin#profile',wait_until='networkidle')
    page.wait_for_timeout(700)
    consent=page.get_by_role('button',name='Понятно',exact=True)
    if consent.count() and consent.is_visible():consent.click()
    check('production bridge loaded',page.evaluate('Boolean(window.ZetSlayCabinet)'))
    check('authenticated real shell visible',page.locator('.app-shell').is_visible())
    check('new profile rendered',page.locator('[data-zs-profile]').count()==1)
    check('profile refresh remains reachable',page.locator('[data-view="profile"] .zs-cover [data-profile-reload]').is_visible())
    check('no demo controls',page.locator('[data-review-bar],[data-review]').count()==0)
    check('new grouped menu',page.locator('.zs-nav-group').count()>=4)
    check('server role hides admin',not page.locator('[data-admin-nav]').is_visible())
    page.screenshot(path=str(OUT/'profile-desktop.png'),full_page=True)
    for view in ['dashboard','events','orders','messages','lots','store-tools','plugins','proxy-shop','analytics','finance','billing','profile','connection','telegram','security','support','guide','documents']:
        page.evaluate('(view)=>setView(view)',view);page.wait_for_timeout(120)
        visible=page.locator(f'[data-view="{view}"]').is_visible()
        if not visible: print('ROUTE DIAG',view,page.evaluate('(view)=>{const el=document.querySelector(`[data-view="${view}"]`);return el?{hidden:el.hidden,cls:el.className,display:getComputedStyle(el).display}:null}',view))
        check('route '+view,visible)
        check('active menu '+view,page.locator(f'.sidebar-nav [data-view-target="{view}"]').get_attribute('aria-current')=='page')
        if view in ['dashboard','orders','messages','lots','plugins','billing','security','documents','finance','store-tools']:
            page.screenshot(path=str(OUT/(view+'-desktop.png')),full_page=True)
    check('real catalogue cards',page.locator('.zs-plugin-tile').count()==2)
    page.evaluate("setView('billing')")
    check('topup action remains reachable',page.locator('.billing-heading [data-billing-open="topup"]').is_visible())
    check('promo action remains reachable',page.locator('.billing-heading [data-billing-open="promo"]').is_visible())
    check('orange catalogue tile',page.locator('.zs-plugin-tile').first.evaluate('(el)=>getComputedStyle(el).backgroundImage.includes("linear-gradient")'))
    page.evaluate("setView('security');renderAccountSecurity()")
    check('security can render after relocation',page.locator('[data-view="security"] [data-account-security-panel]').count()==1)
    check('one security panel',page.locator('[data-account-security-panel]').count()==1)
    page.evaluate("setView('documents');renderLegalRequests()")
    check('one documents panel',page.locator('[data-legal-cabinet]').count()==1)
    page.evaluate("setView('plugins/zetslay.kosell-rent')");page.wait_for_timeout(250)
    check('plugin product hero',page.locator('[data-zs-product]').count()==1)
    check('kosell settings retained',page.locator('[data-plugin-page]').inner_text().find('Kosell')>=0)
    page.screenshot(path=str(OUT/'kosell-desktop.png'),full_page=True)
    for width in [320,390,768,1024]:
        page.set_viewport_size({'width':width,'height':844})
        for view in ['profile','plugins','billing','messages','security']:
            page.evaluate('(view)=>setView(view)',view);page.wait_for_timeout(60)
            overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
            check(f'no overflow {view} {width}',not overflow)
        page.evaluate("setView('profile')");page.wait_for_timeout(80)
        page.screenshot(path=str(OUT/f'profile-{width}.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.locator('[data-sidebar-open]').click();page.wait_for_timeout(60)
    check('mobile drawer opens',page.locator('.sidebar').evaluate('(el)=>el.classList.contains("is-open")'))
    check('drawer makes background inert',page.locator('.workspace').evaluate('(el)=>el.inert'))
    page.keyboard.press('Escape')
    check('Escape closes drawer',not page.locator('.sidebar').evaluate('(el)=>el.classList.contains("is-open")'))
    check('background restored',not page.locator('.workspace').evaluate('(el)=>el.inert'))
    check('no accidental marketplace writes',not any(r['method']!='GET' and r['path']!='/api/v1/auth/resume' for r in requests))
    page.evaluate("setView('profile')")
    page.locator('[data-zs-editor]').click()
    form=page.locator('[data-profile-form]')
    form.locator('[name="displayName"]').fill('QA изменённое имя')
    form.locator('button[type="submit"]').click();page.wait_for_timeout(200)
    check('save failure keeps draft',form.locator('[name="displayName"]').input_value()=='QA изменённое имя')
    check('save failure releases button',form.locator('button[type="submit"]').is_enabled())
    check('save failure is visible',bool(form.locator('[data-profile-form-status]').inner_text()))
    profile_save_failure[0]=False
    form.locator('button[type="submit"]').click();page.wait_for_timeout(200)
    check('profile save uses real controller',page.locator('[data-view="profile"] .zs-cover h1').inner_text()=='QA изменённое имя')
    check('server confirms saved state',page.evaluate('profileState.data.profile.version')==2)
    # A connected account must still have an enabled management action.
    read_data['/api/v1/funpay/connection']={'externalStoreId':'12345','displayName':'QA connected store','status':'connected_read_only','proxyConfigured':True,'lastSeenAt':now.isoformat()}
    page.evaluate('loadStoreFleet()')
    page.evaluate("setView('connection');renderStoreFleet()")
    connect=page.locator('[data-view="connection"] [data-profile-connect]')
    check('connected account can be managed',connect.is_enabled())
    connect.click();page.wait_for_timeout(200)
    check('real FunPay wizard opens',page.locator('.connect-modal').is_visible())
    page.evaluate('setModal(false)');page.wait_for_timeout(250)
    page.evaluate("setView('telegram')")
    page.locator('[data-view="telegram"] [data-bot-settings-open]').click();page.wait_for_timeout(100)
    check('real bot settings open',page.locator('.bot-settings-dialog').is_visible())
    page.evaluate('botSettingsClose()')
    check('no JS runtime errors',not errors)
    check('all local assets exist',not failed_assets)
    # Failure is not converted into an apparent success or a fixture.
    read_data.pop('/api/v1/plugin-catalog')
    page.evaluate('loadPluginCatalog().catch(()=>{})');page.wait_for_timeout(200)
    check('catalogue failure recorded',page.evaluate('Boolean(pluginPageState.error)'))
    check('catalogue failure explained',page.locator('.zs-catalog-error').count()==1)
    check('stale purchase cards hidden',page.locator('.zs-plugin-tile').count()==0)
    page.evaluate('clearSession()')
    check('logout hides private shell',not page.locator('.app-shell').is_visible())
    check('logout clears separate private screens',page.locator('[data-zs-account-content] [data-account-security-panel],[data-zs-account-content] [data-legal-cabinet]').count()==0)
    context.close();browser.close()
server.shutdown()
report={'checks':checks,'passed':sum(c['passed'] for c in checks),'total':len(checks),'runtimeErrors':errors,'missingAssets':failed_assets,'apiRequests':requests,'note':'Isolated contract fixtures only. No production account or transaction used.'}
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:report[k] for k in ['passed','total','runtimeErrors','missingAssets']},ensure_ascii=True))
raise SystemExit(0 if all(c['passed'] for c in checks) else 1)
