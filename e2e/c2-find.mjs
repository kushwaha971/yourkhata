// C2 — Scan to find on Items, on the live stack (design pScanNF / pCamBlocked).
//
// Uses the C1 test item ("C1 scan item", barcode 8906000000017, made by
// e2e/fixtures/c1_scan_item.py). Checks what the merchant gets:
//   phone 390 — the camera button beside the search opens the camera; a known
//     code closes it and opens THAT item (its id read back from the lookup
//     API); an unknown code opens "Not in your items" with the code, "Scanned
//     just now with the camera", "Add item with this barcode" (the form opens
//     with the barcode filled) and "Scan again" (the camera opens again);
//     with no camera the "Camera is blocked" view takes a typed code;
//   the phone shows the sheet only — no snackbar repeating it.
// The camera and reader are stubbed in the page, so the app's own pipeline runs.
//
//   node e2e/c2-find.mjs [--skew]   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const skew = process.argv.includes('--skew');
const dir = '/tmp/e2e-shots/c2';
mkdirSync(dir, { recursive: true });
const CODE = '8906000000017';
const UNKNOWN = '8906999999994';
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STUBS = ({ camera }) => {
  window.__buzz = [];
  navigator.vibrate = (p) => {
    window.__buzz.push(p);
    return true;
  };
  window.BarcodeDetector = class {
    async detect() {
      const code = window.__seeCode;
      window.__seeCode = null;
      return code ? [{ rawValue: code }] : [];
    }
  };
  if (camera) {
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 240;
      c.getContext('2d').fillRect(0, 0, 320, 240);
      return c.captureStream(5);
    };
  } else {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
  }
};

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const signIn = async (ctx) => {
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  return page;
};
const see = (page, code) => page.evaluate((c) => { window.__seeCode = c; }, code);

for (const [w, h] of [[390, 844], [320, 700]]) {
  // ── camera ──
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(STUBS, { camera: true });
  const page = await signIn(ctx);
  const known = (await (await ctx.request.get(`${base}/api/v1/items/lookup?barcode=${CODE}`)).json().catch(() => ({})))?.data;
  check(`@${w} the test item exists (run the fixture)`, Boolean(known?.id));
  const miss = await ctx.request.get(`${base}/api/v1/items/lookup?barcode=${UNKNOWN}`);
  check(`@${w} the unknown code really is unknown (404)`, miss.status() === 404, String(miss.status()));
  await page.goto(`${base}/items`, { waitUntil: 'networkidle' });
  const btn = page.getByRole('button', { name: 'Scan with camera' });
  check(`@${w} camera button beside the search`, (await btn.count()) === 1);
  const box = await btn.boundingBox();
  check(`@${w} camera button is 44 × 44`, box && Math.round(box.width) === 44 && Math.round(box.height) === 44, JSON.stringify(box));
  await page.screenshot({ path: `${dir}/${w}-items.png` });

  // known code → that item
  await btn.click();
  await page.getByTestId('scan-sheet').waitFor({ timeout: 10000 });
  await sleep(600);
  await see(page, CODE);
  await page.waitForURL(/\/items\/[0-9a-f-]{36}/, { timeout: 8000 }).catch(() => {});
  const opened = /\/items\/([0-9a-f-]{36})/.exec(page.url())?.[1];
  check(`@${w} a known code opens THAT item (id read back)`, opened === (skew ? 'XX' : known?.id), `${opened} vs ${known?.id}`);
  check(`@${w} the camera closed after one read`, (await page.getByTestId('scan-sheet').count()) === 0);

  // unknown code → sheet
  await page.goto(`${base}/items`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Scan with camera' }).click();
  await page.getByTestId('scan-sheet').waitFor({ timeout: 10000 });
  await sleep(600);
  await see(page, UNKNOWN);
  const sheet = page.getByTestId('scan-not-in-items');
  await sheet.waitFor({ timeout: 8000 }).catch(() => {});
  const text = await sheet.innerText().catch(() => '');
  check(`@${w} unknown → "Not in your items" with the code`, text.includes(skew ? 'XX' : UNKNOWN) && (await page.getByText('Not in your items').count()) > 0, text.replace(/\n/g, ' / '));
  check(`@${w} says it came from the camera`, text.includes('Scanned just now with the camera'));
  check(`@${w} no snackbar repeats it on a phone`, (await page.getByText(`No item with barcode ${UNKNOWN}`).count()) === 0);
  const buzz = await page.evaluate(() => window.__buzz);
  check(`@${w} the phone buzzed the not-found pattern`, JSON.stringify(buzz.at(-1)) === (skew ? '"XX"' : '[60,60,60]'), JSON.stringify(buzz));
  const look = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    cut: [...document.querySelectorAll('[data-testid=scan-not-in-items] span, [data-testid=scan-not-in-items] button')]
      .filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim()),
    targets: [...document.querySelectorAll('[data-testid=scan-not-in-items] button')].map((b) => Math.round(b.getBoundingClientRect().height)),
  }));
  check(`@${w} sheet: no overflow, nothing cut, buttons ≥ 44`, look.overflow <= 0 && look.cut.length === 0 && look.targets.every((t) => t >= 44), JSON.stringify(look));
  // Design pScanNF: the sheet's grab handle, and the search reads the
  // design's words ("Name, code or barcode"; the longer one was cut at 390).
  check(`@${w} sheet has its grab handle`, await page.locator('[role=dialog] [data-ub-grab]').isVisible().catch(() => false));
  const ph = await page.locator('input[type=search]').first().getAttribute('placeholder');
  check(`@${w} search placeholder is the design's`, ph === 'Name, code or barcode', ph);
  await page.screenshot({ path: `${dir}/${w}-not-found.png` });

  // Scan again → the camera opens again
  await sheet.getByRole('button', { name: /Scan again/ }).click();
  check(`@${w} "Scan again" reopens the camera`, await page.getByTestId('scan-sheet').waitFor({ timeout: 8000 }).then(() => true).catch(() => false));
  await see(page, UNKNOWN);
  await sheet.waitFor({ timeout: 8000 }).catch(() => {});
  // Add item with this barcode → the form with the barcode in it
  await sheet.getByRole('button', { name: /Add item with this barcode/ }).click();
  const barcodeField = page.getByRole('dialog').getByLabel('Barcode', { exact: true });
  await barcodeField.waitFor({ timeout: 8000 }).catch(() => {});
  const filled = await barcodeField.inputValue().catch(() => '');
  check(`@${w} Add opens the item form with the barcode filled`, filled === (skew ? 'XX' : UNKNOWN), filled);
  check(`@${w} …and the barcode is in sight (its section open)`, await barcodeField.isVisible().catch(() => false));
  await barcodeField.scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: `${dir}/${w}-add-form.png` });
  await ctx.close();

  // ── no camera ──
  const ctx2 = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
  await ctx2.addInitScript(STUBS, { camera: false });
  const page2 = await signIn(ctx2);
  await page2.goto(`${base}/items`, { waitUntil: 'networkidle' });
  await page2.getByRole('button', { name: 'Scan with camera' }).click();
  await page2.getByTestId('scan-sheet').waitFor({ timeout: 10000 });
  const blocked = await page2.getByTestId('scan-sheet').innerText();
  check(`@${w} no camera: "Camera is blocked"`, blocked.includes(skew ? 'XX' : 'Camera is blocked'));
  check(`@${w} no camera: the Barcode box is focused`, await page2.getByTestId('scan-sheet').getByLabel('Barcode', { exact: true }).evaluate((el) => el === document.activeElement));
  await page2.screenshot({ path: `${dir}/${w}-blocked.png` });
  await page2.getByTestId('scan-sheet').getByLabel('Barcode', { exact: true }).fill(CODE);
  await page2.getByTestId('scan-sheet').getByRole('button', { name: 'Find', exact: true }).click();
  await page2.waitForURL(/\/items\/[0-9a-f-]{36}/, { timeout: 8000 }).catch(() => {});
  const typed = /\/items\/([0-9a-f-]{36})/.exec(page2.url())?.[1];
  check(`@${w} no camera: a typed code opens that item`, typed === (skew ? 'XX' : known?.id), String(typed));
  await ctx2.close();
}

// ── desktop: the scanner path is unchanged (banner + Create item) ──
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(STUBS, { camera: true });
  const page = await signIn(ctx);
  await page.goto(`${base}/items`, { waitUntil: 'networkidle' });
  check('desktop: no camera button (the scanner types into the page)', (await page.getByRole('button', { name: 'Scan with camera' }).count()) === 0);
  // A USB scanner types into whatever has focus; with nothing focused the
  // page's scan listener takes it. (The first run clicked the header's
  // command search and scanned into that.)
  await page.evaluate(() => document.activeElement?.blur());
  for (const ch of UNKNOWN) await page.keyboard.press(ch, { delay: 0 });
  await page.keyboard.press('Enter');
  await sleep(1500);
  const main = await page.locator('main').innerText();
  check('desktop: an unknown scan shows the banner with Create item', main.includes(skew ? 'XX' : `No item with barcode ${UNKNOWN}`));
  await page.screenshot({ path: `${dir}/1280-not-found.png` });
  await ctx.close();
}

await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed${skew ? ' (skew: read-back checks should FAIL)' : ''}`);
process.exitCode = failed && !skew ? 1 : 0;
