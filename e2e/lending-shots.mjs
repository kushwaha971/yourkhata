/**
 * Lending screens in the states the design draws (I8–I11), for side-by-side
 * and measurement: Today, the Collect sheet on Sunil (two days late), the loan
 * page, New loan filled in, and Messages · Late.
 *
 *   node e2e/lending-shots.mjs --shots=/tmp/e2e-shots/lending-design
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const SHOTS = arg('shots', '/tmp/e2e-shots/lending-design');
const base = process.env.E2E_BASE ?? 'http://localhost:3005';
mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
for (const width of [390, 1280]) {
  const phone = width < 768;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 860 }, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  const routes = (await (await ctx.request.get(`${base}/api/v1/lending/routes`)).json()).data;
  const market = routes.find((r) => r.name === 'Market road');
  await page.goto(`${base}/lending`, { waitUntil: 'networkidle' });
  await page.getByRole('combobox', { name: 'Route' }).first().selectOption(market.id).catch(() => undefined);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/${width}-today.png` });
  const sunil = (await (await ctx.request.get(`${base}/api/v1/lending/loans?q=Sunil`)).json()).data[0];
  if (phone) {
    await page.getByTestId('lending-collect').first().click();
    await page.getByRole('dialog').getByTestId('lending-collect-after').filter({ hasText: /After this/ }).waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/${width}-collect.png` });
    await page.keyboard.press('Escape');
  }
  await page.goto(`${base}/lending/loans/${sunil.id}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${SHOTS}/${width}-loan.png` });
  const kavita = (await (await ctx.request.get(`${base}/api/v1/lending/borrowers?q=Kavita`)).json()).data[0];
  await page.goto(`${base}/lending/loans/new?borrower=${kavita.id}`, { waitUntil: 'networkidle' });
  await page.getByLabel('Amount lent').fill('20000');
  await page.getByLabel('Each day').fill('500');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/${width}-new.png` });
  await page.goto(`${base}/lending/messages`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/${width}-messages.png` });
  await ctx.close();
}
await browser.close();
