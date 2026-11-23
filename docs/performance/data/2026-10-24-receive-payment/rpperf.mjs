// Receive payment drawer: from the tap on "Receive payment" on a Shop
// customer's page until the drawer lists that customer's unpaid bills (the
// moment a counter can check what the amount settles), 4x CPU throttle,
// 6 opens per viewport. The same customer on both sides: the first Shop
// customer who owes money and has an unpaid Shop bill. Usage: node rpperf.mjs <out.json>
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = 'http://localhost:3000';
const [out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const res = {};
for (const [w, h, label] of [[390, 780, 'phone'], [1280, 900, 'desktop']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  let customer = null;
  for (const p of (await (await ctx.request.get(`${base}/api/v1/parties?type=customer&page_size=40&book=shop&balance=owes_me`)).json()).data) {
    const open = (await (await ctx.request.get(`${base}/api/v1/payments/open-documents?party_id=${p.id}&direction=in&bucket=shop`)).json()).data;
    if (open.length) { customer = p; break; }
  }
  res.customer = customer.name;
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const times = [];
  for (let i = 0; i < 6; i++) {
    await page.goto(`${base}/customers`, { waitUntil: 'domcontentloaded' });
    await page.goto(`${base}/parties/${customer.id}`);
    await page.waitForLoadState('networkidle');
    const actions = w < 1024 ? page.getByTestId('shop-person-dock') : page.locator('main header');
    const button = actions.getByRole('button', { name: 'Receive payment', exact: true });
    await button.waitFor();
    const t0 = Date.now();
    await button.click();
    await page.getByRole('dialog').getByTestId('alloc-picker').waitFor({ timeout: 30000 });
    times.push(Date.now() - t0);
    await page.keyboard.press('Escape');
  }
  res[label] = times;
  await ctx.close();
}
await b.close();
writeFileSync(out, JSON.stringify(res));
console.log(out, JSON.stringify(res));
