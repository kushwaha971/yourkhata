/**
 * e2e/demo/ledger-tutorial.mjs — the silent Ledger walkthrough on the loans
 * page: Today → collect a part payment → the loan → a new loan's preview →
 * reminders. Recorded from the demo book (Verma Finance), phone and desktop.
 *
 *   DEMO_FRONTEND=http://localhost:3005 DEMO_API_LOG=<log> node e2e/demo/ledger-tutorial.mjs
 *
 * Silent, so Playwright's recordVideo is fine here (README: its drift only
 * matters against a narration). It COLLECTS ₹150 from Geeta Devi, so run it
 * on a freshly seeded demo book. Writes frontend/public/media/guides/ledger/
 * tutorial-<size>.{mp4,webm,webp,jpg}.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import { CURSOR_SCRIPT, FE, HERE, clickEl, signIn, sleep, typeSlow, useBusiness, writePosters } from './lib.mjs';

const OUT = path.join(HERE, '..', '..', 'frontend', 'public', 'media', 'guides', 'ledger');
const WORK = path.join(process.env.TMPDIR ?? '/tmp', 'ledger-tutorial');
rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
for (const size of ['phone', 'desktop']) {
  const phone = size === 'phone';
  const viewport = phone ? { width: 390, height: 844 } : { width: 1280, height: 800 };
  // Sign in outside the recording, so the film starts on Today.
  const setup = await browser.newContext({ viewport });
  const sp = await setup.newPage();
  await signIn(sp);
  await useBusiness(sp, 'Verma Finance');
  const state = await setup.storageState();
  const get = async (url) => (await (await setup.request.get(`${FE}/api/v1${url}`)).json()).data;
  const kishore = (await get('/lending/borrowers?q=Kishore'))[0];
  await setup.close();

  const dir = path.join(WORK, size);
  const ctx = await browser.newContext({
    viewport, storageState: state, recordVideo: { dir, size: viewport },
    ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : {}),
  });
  await ctx.addInitScript(CURSOR_SCRIPT);
  const page = await ctx.newPage();
  const visible = (id) => page.getByTestId(id).locator('visible=true').first();

  await page.goto(`${FE}/lending`, { waitUntil: 'networkidle' });
  await sleep(2200);
  await clickEl(page, visible('lending-collect'), { after: 900 });
  const dialog = page.getByRole('dialog');
  await clickEl(page, dialog.getByRole('textbox').first(), { after: 200 });
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await typeSlow(page, '150', 160);
  await sleep(1600);
  const posterAt = path.join(WORK, `${size}-poster.png`);
  await page.screenshot({ path: posterAt });
  await page.getByText('Share receipt on WhatsApp').click().catch(() => {}); // off, so no WhatsApp tab opens
  await sleep(400);
  await clickEl(page, dialog.getByTestId('lending-collect-save'), { after: 1800 });

  await clickEl(page, page.getByText('Geeta Devi').locator('visible=true').first(), { after: 0 });
  await page.waitForURL(/\/lending\/loans\//);
  await sleep(2600);
  if (phone) { await page.mouse.wheel(0, 500); await sleep(1800); }

  await page.goto(`${FE}/lending/loans/new?borrower=${kishore.id}`, { waitUntil: 'networkidle' });
  await sleep(800);
  await clickEl(page, page.getByLabel('Amount lent'), { after: 100 });
  await typeSlow(page, '20000');
  await page.getByRole('combobox', { name: 'Plan' }).selectOption('daily-100');
  await sleep(600);
  await clickEl(page, page.getByLabel('Each day'), { after: 100 });
  await typeSlow(page, '220');
  await clickEl(page, page.getByLabel(/Charges taken at start/), { after: 100 });
  await typeSlow(page, '1000');
  await page.getByLabel(/Charges taken at start/).blur();
  await sleep(1500);
  if (phone) { await page.getByTestId('lending-new-loan-preview').scrollIntoViewIfNeeded(); }
  await sleep(2600);

  await page.goto(`${FE}/lending/messages`, { waitUntil: 'networkidle' });
  await sleep(3200);
  await ctx.close();

  const raw = path.join(dir, readdirSync(dir).find((f) => f.endsWith('.webm')));
  const base = path.join(OUT, `tutorial-${size}`);
  const vf = 'fps=24';
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-vf', vf, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', '-preset', 'slow', '-movflags', '+faststart', '-an', `${base}.mp4`]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-vf', vf, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', '-an', `${base}.webm`]);
  await writePosters(posterAt, base);
  console.log(`tutorial-${size}`);
}
await browser.close();
