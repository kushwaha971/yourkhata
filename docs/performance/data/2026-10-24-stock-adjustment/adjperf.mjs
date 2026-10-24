import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const base='http://localhost:3000'; const out=process.argv[2];
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const res={};
for (const [w,h,label] of [[390,780,'phone'],[1280,900,'desktop']]) {
  const ctx=await b.newContext({viewport:{width:w,height:h}}); const page=await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]','scale@digikhaato.test'); await page.fill('input[type=password]','Scale-Run-2026!');
  await page.click('button[type=submit]'); await page.waitForURL(u=>!u.pathname.startsWith('/login'));
  const it=(await (await ctx.request.get(`${base}/api/v1/items?page_size=5&q=QA84`)).json()).data[0];
  const cdp=await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  const times=[];
  for (let i=0;i<6;i++){
    await page.goto(`${base}/items/${it.id}`); await page.getByTestId('item-detail-screen').waitFor();
    await page.waitForLoadState('networkidle');
    const btn=page.getByRole('button',{name:/Adjust stock/}).locator('visible=true').first();
    const t0=Date.now(); await btn.click();
    await page.locator('[role=dialog] button[type=submit]').waitFor({state:'visible'});
    times.push(Date.now()-t0);
  }
  res[label]=times; await ctx.close();
}
await b.close(); writeFileSync(out, JSON.stringify(res)); console.log(out, JSON.stringify(res));
