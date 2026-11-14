"""QA for the redesigned ZetSlay landing. Runs against the local preview (serve.mjs).
usage: LAND_BASE=http://127.0.0.1:8130 python -I -X utf8 tools/qa_landing.py [shots_dir]
Session states use isolated Playwright route fixtures for the API stub URL only; product code is not changed."""
import os, sys, json, asyncio, re
from pathlib import Path
from datetime import datetime, timedelta, timezone
from playwright.async_api import async_playwright

BASE = os.environ.get('LAND_BASE', 'http://127.0.0.1:8140')
SHOTS = sys.argv[1] if len(sys.argv) > 1 else None
results = []
def ok(name, cond, info=''):
    results.append((name, bool(cond), info))
    print(('PASS' if cond else 'FAIL') + ' | ' + name + (' | ' + str(info) if not cond and info != '' else ''))

CATALOG = json.loads((Path(__file__).resolve().parents[1]/'subscription-plans.json').read_text(encoding='utf-8'))
PLANS = [(p['id'],p['monthlyRub']) for p in CATALOG['plans']]
PERIODS = {k:(v['months'],v['discount'],v['days']) for k,v in CATALOG['periods'].items()}

def rub(k):
    v = k / 100
    s = ('{:,.2f}'.format(v) if k % 100 else '{:,.0f}'.format(v)).replace(',', ' ').replace('.', ',')
    return s + ' ₽'
def expected(mr, per):
    months, disc, days = PERIODS[per]; mk = mr * (100 - disc); tk = mk * months
    note = 'Итого ' + rub(tk) + ' за ' + str(days) + ' дней доступа' if months == 1 else rub(tk) + ' за ' + ('3 месяца' if months == 3 else '12 месяцев') + ' · ' + str(days) + ' дней · скидка ' + str(disc) + '% · оплата целиком'
    return rub(mk), note
N = lambda s: re.sub(r'[  ]', ' ', s or '').strip()

async def newpage(b, w, h, **kw):
    mobile = w < 760
    ctx = await b.new_context(viewport={'width': w, 'height': h}, is_mobile=mobile, has_touch=mobile, **kw)
    pg = await ctx.new_page(); errs = []; hosts = set()
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and '401' not in m.text else None)
    pg.on('request', lambda r: hosts.add(re.sub(r'^https?://([^/]+).*', r'\1', r.url)))
    return ctx, pg, errs, hosts

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='chrome')

        # 1. layout at all widths + short height
        for w, h in [(320, 640), (390, 844), (768, 1024), (1024, 768), (1440, 900), (1920, 1080), (1280, 600)]:
            ctx, pg, errs, hosts = await newpage(b, w, h)
            await pg.goto(BASE + '/', wait_until='networkidle')
            await pg.evaluate('(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=600){scrollTo(0,y);await new Promise(r=>setTimeout(r,25));}scrollTo(0,0);})()')
            await pg.evaluate('Promise.all([...document.images].map(i=>i.decode().catch(()=>0)))')
            m = await pg.evaluate('''() => { const cw = document.documentElement.clientWidth, st = document.querySelector('.zsh-stage').getBoundingClientRect(), z = document.querySelector('.zsh-object img').getBoundingClientRect();
              const t = document.querySelector('.zsh-title').getBoundingClientRect(), a = document.querySelector('.zsh-actions').getBoundingClientRect();
              return { sw: document.documentElement.scrollWidth, cw, iw: innerWidth, wide: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > cw + 1 && !e.closest('.zl-cnav,.pricing-comparison__scroll,.faq-categories')).slice(0, 3).map(e => e.className.baseVal ?? e.className), zIn: z.left >= st.left - 1 && z.right <= st.right + 1 && z.top >= st.top - 1 && z.bottom <= st.bottom + 1 && z.right <= cw,
                titleIn: t.left >= st.left && t.right <= st.right, overlap: a.bottom > z.top + z.height * .12,
                broken: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src),
                fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family) } }''')
            tag = str(w) + 'x' + str(h)
            ok(tag + ': no horizontal overflow, no element wider than the viewport, no mobile zoom-out', m['sw'] <= m['cw'] and m['iw'] == w and not m['wide'], (m['sw'], m['cw'], m['iw'], m['wide']))
            ok(tag + ': 3D Z fully inside the hero stage, title inside', m['zIn'] and m['titleIn'], m)
            ok(tag + ': hero buttons do not cover the Z', not m['overlap'], m)
            ok(tag + ': all images load', not m['broken'], m['broken'])
            ok(tag + ': local fonts loaded (Inter, hero font)', any('Inter' in f for f in m['fonts']), m['fonts'])
            ok(tag + ': no JS/console errors', not errs, errs[:3])
            ok(tag + ': only same-origin requests', hosts <= {'127.0.0.1:' + BASE.rsplit(':', 1)[1]}, hosts)
            await ctx.close()

        # 2. structure, anchors, CTAs, SEO
        ctx, pg, errs, hosts = await newpage(b, 1440, 900)
        await pg.goto(BASE + '/', wait_until='networkidle')
        s = await pg.evaluate('''() => ({ h1: document.querySelectorAll('h1').length, h1t: document.querySelector('h1').textContent,
          ids: ['main','top','features','plugins','tariffs','steps','faq','security','comparison','faq-connection','faq-errors','faq-secrets'].filter(i => !document.getElementById(i)),
          deadHash: [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => h.length > 1 && !document.getElementById(h.slice(1))),
          heroCta: [...document.querySelectorAll('.zsh-actions a')].map(a => a.getAttribute('href')),
          login: [...document.querySelectorAll('a[href="app/?auth=login"]')].length, reg: [...document.querySelectorAll('a[href="app/?auth=register"]')].length,
          legal: ['/legal/','/legal/offer.html','/legal/privacy.html','/legal/refunds.html','/legal/#operator','/security/','/security/#data'].filter(h => !document.querySelector('a[href="' + h + '"]')),
          support: document.querySelector('[data-support-contact]')?.getAttribute('href'),
          canonical: document.querySelector('link[rel=canonical]').href, og: document.querySelector('meta[property="og:image"]').content, lang: document.documentElement.lang,
          title: document.title, desc: document.querySelector('meta[name=description]').content,
          plugins: [...document.querySelectorAll('[data-public-plugin]')].map(n => n.dataset.publicPlugin), count: document.querySelector('[data-public-plugin-count]').textContent,
          hooks: ['data-platform-ribbon','data-landing-features','data-landing-plugin-showcase','data-landing-steps','data-landing-pricing','data-landing-faq','data-landing-footer','data-legal-links','data-privacy-settings','data-operator-requisites','data-support-contact','data-footer-year','data-pricing-trial','data-pricing-platform','data-pricing-comparison','data-session-guest','data-session-cabinet'].filter(h => !document.querySelector('[' + h + ']')),
          skipped: (() => { let prev = 1, bad = []; document.querySelectorAll('main h1, main h2, main h3, main h4, footer h2').forEach(h => { const l = +h.tagName[1]; if (l > prev + 1) bad.push(h.tagName + ':' + h.textContent.slice(0, 30)); prev = l; }); return bad; })(),
          words: document.body.innerText.length })''')
        ok('exactly one h1 = approved hero title', s['h1'] == 1 and 'Автоматизация' in s['h1t'] and 'FunPay' in s['h1t'], s['h1t'])
        ok('all required anchors exist', not s['ids'], s['ids'])
        ok('no dead in-page links', not s['deadHash'], s['deadHash'])
        ok('hero CTAs: app/ and #plugins', s['heroCta'] == ['app/', '#plugins'], s['heroCta'])
        ok('login and register links present', s['login'] >= 2 and s['reg'] >= 5, (s['login'], s['reg']))
        ok('legal + security links present', not s['legal'], s['legal'])
        ok('support link', s['support'] == 'https://t.me/zetslaysupport')
        ok('SEO: lang ru, production canonical/OG, title, description', s['lang'] == 'ru' and s['canonical'] == 'https://zetslay.pro/' and s['og'].startswith('https://zetslay.pro/') and s['title'] and s['desc'], s)
        ok('15 public plugins, ids unique', len(s['plugins']) == 15 and len(set(s['plugins'])) == 15 and s['count'] == '15', s['plugins'])
        ok('all functional data-hook groups present', not s['hooks'], s['hooks'])
        ok('heading levels never skip', not s['skipped'], s['skipped'])
        ok('pricing notes block removed (user request 14.11)', not await pg.evaluate('() => !!document.querySelector(".landing-pricing__notes, [data-payment-limit], [data-payment-review-marker]")'))
        ok('catalog: 4 cabinet-style groups, 15 orange cards, category nav links resolve', await pg.evaluate('() => document.querySelectorAll(".zl-cgroup").length === 4 && document.querySelectorAll(".zl-pcard").length === 15 && [...document.querySelectorAll(".zl-cnav a")].every(a => document.querySelector(a.getAttribute("href")))'))
        ok('features: masonry — sunset tile + 9 cards, each with a 3D icon slot, no orange links, no interface demos', await pg.evaluate('() => !!document.querySelector(".zl-mhero") && document.querySelectorAll(".zl-mcard").length === 9 && document.querySelectorAll(".zl-mcard [data-icon-slot]").length === 9 && !document.querySelector("#features a, #features .zl-eyebrow, .zl-window, .zl-prices")'))
        ok('tariffs: 4 grey cards with 3D plan art on a background scene; plugin counts 3/7/10/15 and next-plan increments; only the featured CTA is orange', await pg.evaluate('() => { const c = [...document.querySelectorAll(".zl-pcard2")]; const n = c.map(x => parseInt(x.querySelector(".zl-pcard2__plugins strong").textContent)); const orange = c.filter(x => getComputedStyle(x.querySelector(".zl-pcard2__cta")).backgroundColor === "rgb(255, 139, 69)").map(x => x.dataset.pricingPlan); return c.length === 4 && n.join() === "3,7,10,15" && /ещё 4/.test(c[0].textContent) && /ещё 3/.test(c[1].textContent) && /ещё 5/.test(c[2].textContent) && orange.join() === "pro" && !!document.querySelector(".zl-pstage__sky") && !!document.querySelector(".zl-pstage [data-pricing-trial]"); }'))
        ok('no invented ratings/reviews in structured data', not await pg.evaluate("() => /aggregateRating|\"review\"/i.test([...document.querySelectorAll('script[type=\"application/ld+json\"]')].map(s => s.textContent).join(''))"))
        await ctx.close()

        # 3. pricing: 3 periods x 4 plans, keyboard, announcement
        ctx, pg, errs, hosts = await newpage(b, 1440, 900)
        await pg.goto(BASE + '/#tariffs', wait_until='networkidle')
        ok('period picker revealed by JS', await pg.is_visible('[data-pricing-periods]'))
        for per in ['quarter', 'year', 'month']:
            await pg.click('[data-pricing-period="' + per + '"]')
            got = await pg.evaluate('() => [...document.querySelectorAll("[data-pricing-plan]")].map(c => [c.dataset.pricingPlan, c.querySelector("[data-pricing-price]").textContent, c.querySelector("[data-pricing-note]").textContent, c.querySelector("[data-pricing-original]").hidden, c.querySelector("[data-pricing-original]").textContent])')
            good = all(N(g[1]) == expected(mr, per)[0] and N(g[2]) == expected(mr, per)[1] and g[3] == (per == 'month') and (per == 'month' or N(g[4]) == str(mr) + ' ₽') for g, (pid, mr) in zip(got, PLANS))
            ok('pricing ' + per + ': all 4 plans match kopeck formula, note, strike-through', good, [(N(g[1]), N(g[2])) for g in got])
        await pg.focus('[data-pricing-period="month"]'); await pg.keyboard.press('End')
        k = await pg.evaluate('() => [document.activeElement.dataset.pricingPeriod, document.querySelector("button[data-pricing-period=year]").getAttribute("aria-pressed"), document.querySelector("[data-pricing-announcement]").textContent]')
        ok('keyboard End → year, aria-pressed, live announcement', k[0] == 'year' and k[1] == 'true' and 'Скидка 20%' in k[2], k)
        await pg.keyboard.press('ArrowRight')
        ok('keyboard ArrowRight wraps to month', await pg.evaluate('() => document.activeElement.dataset.pricingPeriod') == 'month')
        ok('ZetSlayPricing export intact, paymentAvailable stays false', await pg.evaluate('() => window.ZetSlayPricing && ZetSlayPricing.paymentAvailable === false && ZetSlayPricing.plans.length === 4'))
        await ctx.close()

        # 4. FAQ
        ctx, pg, errs, hosts = await newpage(b, 1440, 900)
        await pg.goto(BASE + '/#faq', wait_until='networkidle')
        if await pg.locator('[data-privacy-notice-close]').count(): await pg.click('[data-privacy-notice-close]')
        total = await pg.evaluate('() => document.querySelectorAll("[data-faq-item]").length')
        await pg.fill('[data-faq-search]', 'прокси')
        c1 = await pg.evaluate('() => [document.querySelectorAll("[data-faq-item]:not([hidden])").length, document.querySelector("[data-faq-count]").textContent]')
        ok('FAQ search "прокси" filters and counts', 0 < c1[0] < total and ('из ' + str(total)) in c1[1], c1)
        await pg.fill('[data-faq-search]', 'включенным')
        ok('FAQ normalises ё/е ("включенным" finds "включённым")', await pg.evaluate('() => document.querySelectorAll("[data-faq-item]:not([hidden])").length') >= 1)
        await pg.click('[data-faq-clear]')
        await pg.click('[data-faq-filter="tariffs"]')
        cat = await pg.evaluate('() => [...document.querySelectorAll("[data-faq-item]:not([hidden])")].every(n => n.dataset.faqCategory === "tariffs")')
        ok('FAQ category filter', cat)
        await pg.click('[data-faq-filter="all"]')
        await pg.fill('[data-faq-search]', 'zzzqqq')
        ok('FAQ empty state', await pg.is_visible('[data-faq-empty]'))
        if SHOTS: await pg.locator('#faq').screenshot(path=os.path.join(SHOTS, 'faq-empty-1440.png'))
        await pg.click('[data-faq-reset]')
        ok('FAQ reset restores all', await pg.evaluate('() => document.querySelectorAll("[data-faq-item]:not([hidden])").length') == total)
        await pg.fill('[data-faq-search]', 'тариф')
        if SHOTS: await pg.locator('#faq').screenshot(path=os.path.join(SHOTS, 'faq-search-1440.png'))
        # footer link to a hidden answer resets filter and opens it
        await pg.click('.zl-footer a[href="#faq-secrets"]')
        await pg.wait_for_timeout(600)
        st = await pg.evaluate('() => { const d = document.getElementById("faq-secrets"); return [d.hidden, d.open, location.hash]; }')
        ok('footer → #faq-secrets: filter reset, answer open', st == [False, True, '#faq-secrets'], st)
        opened = await pg.evaluate('() => document.querySelectorAll("[data-faq-item][open]").length')
        ok('only one FAQ answer open', opened == 1, opened)
        await ctx.close()
        ctx, pg, errs, hosts = await newpage(b, 390, 844)
        await pg.goto(BASE + '/#faq-errors', wait_until='networkidle')
        ok('direct URL #faq-errors opens the answer', await pg.evaluate('() => document.getElementById("faq-errors").open'))
        await ctx.close()

        # 5. mobile menu
        ctx, pg, errs, hosts = await newpage(b, 390, 844)
        await pg.goto(BASE + '/', wait_until='networkidle')
        await pg.click('.mobile-menu summary')
        ok('mobile menu opens', await pg.is_visible('.mobile-menu nav'))
        if SHOTS: await pg.screenshot(path=os.path.join(SHOTS, 'mobile-menu-390.png'))
        await pg.keyboard.press('Escape')
        ok('Escape closes menu, focus on toggle', await pg.evaluate('() => !document.querySelector(".mobile-menu").open && document.activeElement.tagName === "SUMMARY"'))
        await pg.click('.mobile-menu summary'); await pg.click('.mobile-menu nav a[href="#tariffs"]'); await pg.wait_for_timeout(500)
        ok('menu link navigates and closes menu', await pg.evaluate('() => location.hash === "#tariffs" && !document.querySelector(".mobile-menu").open'))
        await ctx.close()

        # 6. session states via isolated API fixtures
        future = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(); past = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        for label, status, body in [('guest', 401, {'error': {'code': 'INVALID_SESSION', 'message': 'no session'}}), ('signed-in', 200, {'data': {'authenticated': True, 'expiresAt': future}}), ('expired', 200, {'data': {'authenticated': True, 'expiresAt': past}})]:
            ctx, pg, errs, hosts = await newpage(b, 1440, 900)
            async def handler(route, request=None, s=status, bd=body): await route.fulfill(status=s, content_type='application/json', body=json.dumps(bd))
            await pg.route('**/__preview_api/api/v1/auth/session', handler)
            await pg.goto(BASE + '/', wait_until='networkidle'); await pg.wait_for_timeout(400)
            v = await pg.evaluate('() => [[...document.querySelectorAll("[data-session-guest]")].every(n => n.hidden), [...document.querySelectorAll("[data-session-cabinet]")].every(n => !n.hidden)]')
            want = [True, True] if label == 'signed-in' else [False, False]
            ok('session ' + label + ': guest/cabinet links', v == want, v)
            if SHOTS and label == 'signed-in': await pg.screenshot(path=os.path.join(SHOTS, 'session-signed-in-hero-1440.png'))
            await ctx.close()

        # 7. no-JS: content visible, defaults correct
        ctx, pg, errs, hosts = await newpage(b, 1440, 900, java_script_enabled=False)
        await pg.goto(BASE + '/', wait_until='load')
        nj = await pg.evaluate('''() => ({ hidden: [...document.querySelectorAll('[data-reveal]')].filter(n => getComputedStyle(n).opacity !== '1').length,
          h2: [...document.querySelectorAll('h2')].filter(h => h.offsetParent !== null).length, price: document.querySelector('[data-pricing-plan="pro"] [data-pricing-price]').textContent,
          faqOpen: document.getElementById('faq-registration').open, picker: document.querySelector('[data-pricing-periods]').hidden })''')
        ok('no-JS: nothing hidden by reveal, headings visible, month prices, FAQ native, picker hidden', nj['hidden'] == 0 and nj['h2'] >= 9 and nj['price'] == '499 ₽' and nj['faqOpen'] and nj['picker'], nj)
        await ctx.close()

        # 8. reduced motion, focus, privacy controls
        ctx, pg, errs, hosts = await newpage(b, 1440, 900, reduced_motion='reduce')
        await pg.goto(BASE + '/', wait_until='networkidle')
        ok('reduced motion: reveal disabled', await pg.evaluate('() => !document.documentElement.classList.contains("zl-reveal") && [...document.querySelectorAll("[data-reveal]")].every(n => getComputedStyle(n).opacity === "1")'))
        await pg.keyboard.press('Tab')
        f = await pg.evaluate('() => { const a = document.activeElement, r = a.getBoundingClientRect(); return [a.className, r.top >= 0, getComputedStyle(a).transform]; }')
        ok('first Tab shows skip link', 'skip-link' in f[0] and f[1], f)
        await pg.keyboard.press('Tab')
        oc = await pg.evaluate('() => getComputedStyle(document.activeElement).outlineStyle')
        ok('next focus has visible outline', oc != 'none', oc)
        await pg.click('.zl-footer [data-privacy-settings]')
        ok('cookie settings open the existing privacy dialog', await pg.evaluate('() => !!document.querySelector("dialog[data-privacy-dialog][open]")'))
        if SHOTS: await pg.screenshot(path=os.path.join(SHOTS, 'privacy-settings-1440.png'))
        await ctx.close()

        await b.close()
    passed = sum(1 for r in results if r[1])
    print(str(passed) + '/' + str(len(results)) + ' checks passed')
    report_path=Path(os.environ.get('ZETSLAY_LANDING_QA_REPORT',Path(__file__).resolve().parents[1]/'artifacts/landing-v2-qa/report.json'))
    report_path.parent.mkdir(parents=True,exist_ok=True)
    report_path.write_text(json.dumps({'passed':passed,'total':len(results),'checks':[{'name':n,'passed':v,'detail':str(d)} for n,v,d in results],'note':'Actual project root served locally. API session fixtures isolated; no real account/transaction.'},ensure_ascii=False,indent=2),encoding='utf-8')
    sys.exit(0 if passed == len(results) else 1)

asyncio.run(main())
