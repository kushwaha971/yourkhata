// Payment receipt page: from navigation until the printed receipt (the A5
// sheet with its number) is visible, 4x CPU throttle, 6 opens per viewport.
// The same receipt on both sides: the newest Shop receipt with a contact and a
// settled bill. Usage: node rcperf.mjs <out.json>
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
  const list = await (await ctx.request.get(`${base}/api/v1/payments?bucket=shop&direction=in&status=recorded&page_size=50`)).json();
  const row = list.data.find((r) => r.party && Number(r.allocated_amount) > 0);
  res.receipt = row.number;
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const times = [];
  for (let i = 0; i < 6; i++) {
    await page.goto(`${base}/items`);
    await page.waitForLoadState('networkidle');
    const t0 = Date.now();
    await page.goto(`${base}/payments/${row.id}`);
    await page.getByTestId('payment-receipt-print').getByText(row.number).first().waitFor({ timeout: 30000 });
    times.push(Date.now() - t0);
  }
  res[label] = times;
  await ctx.close();
}
await b.close();
writeFileSync(out, JSON.stringify(res));
console.log(out, JSON.stringify(res));
