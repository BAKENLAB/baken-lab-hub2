"""Offline browser check. API traffic is fulfilled by explicit synthetic fixtures."""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
DATE = '2026-10-12'

def row(circuit, track):
    identity = dict(race_date=DATE, circuit=circuit, track=track, race_no=7)
    runners = [dict(horse_no=i, horse_name='検証馬'+str(i), rank=i, grade='B' if i<3 else 'C', comment='保存済み検証コメント') for i in range(1,8)]
    return dict(**identity, settled_at='2026-10-12T04:20:00Z', prediction=dict(**identity, status='FROZEN', payload=dict(runners=runners, top5=[dict(**r, mark='◎' if r['rank']==1 else '△') for r in runners[:5]], eye=None)), result=dict(finishers=[dict(horse_no=i,horse_name='検証馬'+str(i),finish=i) for i in [1,2,3]]))

async def main():
    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, timeout=15000, args=['--no-sandbox','--disable-dev-shm-usage'])
        except Exception as e:
            print('SKIP real browser: launch failed; '+str(e)[:1800])
            return
        for width in [320,375,390]:
            page = await browser.new_page(viewport=dict(width=width,height=844))
            async def handle(route):
                if '/functions/v1/hub2-api' in route.request.url:
                    from urllib.parse import urlparse,parse_qs
                    date = parse_qs(urlparse(route.request.url).query).get('date',[''])[0]
                    data = dict(ok=True,date=date,results=[row('JRA','東京'),row('LOCAL','盛岡')] if date==DATE else [])
                    await route.fulfill(status=200,content_type='application/json',body=json.dumps(data,ensure_ascii=False),headers={'Access-Control-Allow-Origin':'*'})
                elif route.request.url.startswith('file:'):
                    await route.continue_()
                else:
                    await route.abort()
            await page.route('**/*',handle)
            await page.goto((ROOT/'result.html').as_uri())
            await page.locator('#resultDateInput').fill(DATE)
            await page.locator('#resultDateInput').dispatch_event('change')
            await page.wait_for_function("document.querySelector('#dailySummary').textContent.includes('照合済み 2レース')")
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
            await page.locator('[data-result-circuit="LOCAL"]').click()
            assert '照合済み 1レース' in await page.locator('#dailySummary').inner_text()
            await page.locator('[data-result-row-index]').first.click()
            assert await page.locator('.result-detail').is_visible()
            await page.locator('[data-result-back]').click()
            assert await page.locator('#resultArea').is_visible()
            await page.locator('#resultDateInput').fill('2026-10-11')
            await page.locator('#resultDateInput').dispatch_event('change')
            await page.wait_for_function("document.querySelector('#dailySummary').textContent.includes('集計待ち')")
            await page.screenshot(path=str(ROOT/f'mobile-{width}.png'),full_page=True)
            print(f'PASS real browser {width}px: overflow, date, circuit, detail, EYE null')
            await page.close()
        await browser.close()

asyncio.run(main())
