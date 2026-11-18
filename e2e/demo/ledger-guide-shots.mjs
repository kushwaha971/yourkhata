/**
 * e2e/demo/ledger-guide-shots.mjs — the screenshots in the Ledger (loans)
 * guides on /solutions/lending-collections, taken from the demo book's
 * Verma Finance so no QA name or email appears on a public page.
 *
 *   DEMO_FRONTEND=http://localhost:3005 DEMO_API_LOG=<log> node e2e/demo/ledger-guide-shots.mjs
 *
 * Writes WebP files to frontend/public/media/guides/ledger/<size>-<step>.webp.
 * Nothing is saved: the new loan is previewed, not created, and the collect
 * and not-paid sheets are photographed open and then closed.
 */
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'playwright';

import { FE, HERE, signIn, useBusiness, sleep } from './lib.mjs';

const OUT = path.join(HERE, '..', '..', 'frontend', 'public', 'media', 'guides', 'ledger');
const TMP = path.join(process.env.TMPDIR ?? '/tmp', 'ledger-guide-shots');
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });
const sharp = createRequire(path.join(HERE, '..', '..', 'frontend', 'package.json'))('sharp');

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
for (const size of ['phone', 'desktop']) {
  const phone = size === 'phone';
  const ctx = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    deviceScaleFactor: phone ? 2 : 1,
    ...(phone ? { isMobile: true, hasTouch: true } : {}),
  });
  const page = await ctx.newPage();
  const shot = async (step) => {
    await sleep(700);
    const png = path.join(TMP, `${size}-${step}.png`);
    await page.screenshot({ path: png });
    await sharp(png).webp({ quality: 80 }).toFile(path.join(OUT, `${size}-${step}.webp`));
    await sharp(png).jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(OUT, `${size}-${step}.jpg`));
    console.log(`${size}-${step}`);
  };
  await signIn(page);
  await useBusiness(page, 'Verma Finance');
  const get = async (url) => (await (await ctx.request.get(`${FE}/api/v1${url}`)).json()).data;

  await page.goto(`${FE}/lending`, { waitUntil: 'networkidle' });
  await shot('today');

  await page.getByTestId('lending-collect').locator('visible=true').first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByTestId('lending-collect-after').first().waitFor();
  const amount = dialog.getByRole('textbox').first();
  await amount.fill('150');
  await shot('collect');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' }).catch(() => {});

  await page.getByTestId('lending-not-paid').locator('visible=true').first().click();
  await page.getByRole('dialog').waitFor();
  await shot('not-paid');
  await page.keyboard.press('Escape');

  const geeta = (await get('/lending/loans?q=Geeta'))[0];
  await page.goto(`${FE}/lending/loans/${geeta.id}`, { waitUntil: 'networkidle' });
  await shot('loan');
  if (phone) {
    await page.getByTestId('lending-collections').scrollIntoViewIfNeeded();
    await shot('loan-history');
  }

  const kishore = (await get('/lending/borrowers?q=Kishore'))[0];
  await page.goto(`${FE}/lending/loans/new?borrower=${kishore.id}`, { waitUntil: 'networkidle' });
  await page.getByLabel('Amount lent').fill('20000');
  await page.getByRole('combobox', { name: 'Plan' }).selectOption('daily-100');
  await page.getByLabel('Each day').fill('220');
  await page.getByLabel(/Charges taken at start/).fill('1000');
  await page.getByLabel(/Charges taken at start/).blur();
  await sleep(1200);
  await shot('new-loan');
  if (phone) {
    await page.getByTestId('lending-new-loan-preview').scrollIntoViewIfNeeded();
    await shot('new-loan-preview');
  }

  await page.goto(`${FE}/lending/messages`, { waitUntil: 'networkidle' });
  await shot('messages');
  await page.goto(`${FE}/lending/borrowers`, { waitUntil: 'networkidle' });
  await shot('borrowers');
  await page.goto(`${FE}/lending/routes`, { waitUntil: 'networkidle' });
  await shot('routes');
  await page.goto(`${FE}/lending/settings`, { waitUntil: 'networkidle' });
  await shot('settings');
  await ctx.close();
}
await browser.close();
rmSync(TMP, { recursive: true, force: true });
