// Price lists: from navigation until the list's name is visible, on the list
// page and on its detail page, 4x CPU throttle, 6 opens per page per side.
// Needs a list named by argv[3] (made by plab.sh through the API).
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = 'http://localhost:3000';
const [out, listId, listName] = process.argv.slice(2);
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
  for (const [key, path] of [['list', '/items/price-lists'], ['detail', `/items/price-lists/${listId}`]]) {
    const times = [];
    for (let i = 0; i < 6; i++) {
      await page.goto(`${base}/items`);
      await page.waitForLoadState('networkidle');
      const t0 = Date.now();
      await page.goto(`${base}${path}`);
      await page.getByText(listName, { exact: true }).locator('visible=true').first().waitFor({ timeout: 30000 });
      times.push(Date.now() - t0);
    }
    res[`${label}-${key}`] = times;
  }
  await ctx.close();
}
await b.close();
writeFileSync(out, JSON.stringify(res));
console.log(out, JSON.stringify(res));
