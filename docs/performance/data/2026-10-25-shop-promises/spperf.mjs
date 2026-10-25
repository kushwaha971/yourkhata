// Shop promises A/B: (1) a Shop customer's page, from navigation until the
// balance in the person overview is drawn; (2) Home, until the cash figure's
// amount is drawn. 4x CPU throttle, 6 opens per viewport per page per side.
// Usage: node spperf.mjs <out.json> <partyId>
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = 'http://localhost:3000';
const [out, partyId] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const res = {};
const targets = {
  person: [`/parties/${partyId}`, () => /₹/.test(document.querySelector('[data-testid="shop-person-overview"]')?.textContent ?? '')],
  home: ['/dashboard', () => /₹/.test(document.querySelector('[data-testid="home-figures"] a[href*="cashbook"]')?.textContent ?? '')],
};
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
  for (const [name, [path, ready]] of Object.entries(targets)) {
    const times = [];
    for (let i = 0; i < 6; i++) {
      await page.goto(`${base}/items`);
      await page.waitForLoadState('networkidle');
      const t0 = Date.now();
      await page.goto(`${base}${path}`);
      await page.waitForFunction(ready, null, { timeout: 30000, polling: 16 });
      times.push(Date.now() - t0);
    }
    res[`${name}-${label}`] = times;
  }
  await ctx.close();
}
await b.close();
writeFileSync(out, JSON.stringify(res));
console.log(out, JSON.stringify(res));
