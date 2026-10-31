import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1200,'height':630})
        await pg.goto('file:///workspace/war-risk-dashboard/scripts/og.html'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='public/og.png')
        if len(sys.argv) > 1:
            url = sys.argv[1]
            errs=[]
            for name,w,h in [('desktop',1366,900),('mobile',390,844)]:
                pg = await b.new_page(viewport={'width':w,'height':h}, device_scale_factor=1)
                pg.on('pageerror', lambda e: errs.append(str(e)))
                pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
                await pg.goto(url); await pg.wait_for_timeout(1800)
                await pg.screenshot(path=f'/tmp/wrd-{name}.png', full_page=True)
            print('errors:', errs)
        await b.close()
asyncio.run(main())
