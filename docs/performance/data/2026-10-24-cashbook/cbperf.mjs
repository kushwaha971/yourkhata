// Expenses register: from navigation until the first expense (card or row) is
// visible, 4x CPU throttle, 6 opens per viewport per side.
// Usage: node experf.mjs <out.json>
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
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const times = [];
  for (let i = 0; i < 6; i++) {
    await page.goto(`${base}/items`);
    await page.waitForLoadState('networkidle');
    const t0 = Date.now();
    await page.goto(`${base}/cashbook?period=thisMonth`);
    await page
      .getByText(/^Days$/)
      .first()
      .waitFor({ timeout: 30000 });
    times.push(Date.now() - t0);
  }
  res[label] = times;
  await ctx.close();
}
await b.close();
writeFileSync(out, JSON.stringify(res));
console.log(out, JSON.stringify(res));
