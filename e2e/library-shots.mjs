/**
 * Library screens in the states the design draws (I4–I7), for side-by-side and
 * pixel measurement: Home, the seat map with seat 14 open, the student page,
 * the Collect sheet open on an overdue student, and Fees · Overdue.
 *
 *   node e2e/library-shots.mjs --shots=/tmp/e2e-shots/library-design
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const SHOTS = arg('shots', '/tmp/e2e-shots/library-design');
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
  const rahul = (await (await ctx.request.get(`${base}/api/v1/library/students?q=Rahul`)).json()).data[0];
  await page.goto(`${base}/library/students/${rahul.id}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${SHOTS}/${width}-student.png` });
  await page.getByTestId(phone ? 'library-collect-phone' : 'library-collect').click();
  await page.getByRole('dialog').getByTestId('library-collect-after').filter({ hasText: 'Paid to' }).waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${width}-collect.png` });
  await ctx.close();
}
await browser.close();
