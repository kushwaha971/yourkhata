// C1 — Scan on a bill, on the live stack (design dScan / pScan / pCamBlocked).
//
// Uses its own test item ("C1 scan item", barcode 8906000000017), made once
// by e2e/fixtures/c1_scan_item.py. Checks what the merchant gets, not only the screen:
//   desktop 1280 — a USB scanner burst (fast keys + Enter) adds the line, the
//     same code again raises Qty to 2 and the line flashes; an unknown code
//     shows "Not found: …" and the caret stays in the search; a beep sounded
//     (AudioContext oscillator started) — and the saved draft, read back from
//     the API, holds the line with qty 2;
//   phone 390 — the camera button opens the sheet; a reader that "sees" the
//     code adds the line and buzzes (navigator.vibrate); Done closes it;
//     with no camera the "Camera is blocked" view takes a typed code.
// The camera and the reader are stubbed in the page (a canvas stream and a
// BarcodeDetector that returns the code), so the app's own pipeline runs.
//
//   node e2e/c1-scan.mjs [--skew]   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const skew = process.argv.includes('--skew');
const dir = '/tmp/e2e-shots/c1';
mkdirSync(dir, { recursive: true });
const CODE = '8906000000017';
const NAME = 'C1 scan item';
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STUBS = ({ code, camera }) => {
  window.__beeps = 0;
  window.__buzz = [];
  const Real = window.AudioContext;
  if (Real) {
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a) {
      window.__beeps += 1;
      return start.apply(this, a);
    };
  }
  navigator.vibrate = (p) => {
    window.__buzz.push(p);
    return true;
  };
  window.BarcodeDetector = class {
    async detect() {
      return window.__seeCode ? [{ rawValue: window.__seeCode }] : [];
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
  window.__code = code;
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
const csrfOf = async (ctx) => ({ 'X-CSRF-Token': (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value ?? '' });

// ── desktop: USB scanner ────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(STUBS, { code: CODE, camera: true });
  const page = await signIn(ctx);
  // The test item comes from e2e/fixtures/c1_scan_item.py.
  const found = await (await ctx.request.get(`${base}/api/v1/items/lookup?barcode=${CODE}`)).json().catch(() => ({}));
  check('the test item exists (run the fixture)', Boolean(found?.data?.id));
  await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
  const search = page.getByRole('combobox', { name: 'Search items to add' });
  await search.click();
  const burst = async (code) => {
    for (const ch of code) await page.keyboard.press(ch, { delay: 0 });
    await page.keyboard.press('Enter');
  };
  await burst(CODE);
  await sleep(1200);
  check('desktop: the scanned item is a line', (await page.locator('main').innerText()).includes(skew ? 'XX' : NAME));
  const beeps1 = await page.evaluate(() => window.__beeps);
  check('desktop: a beep sounded', beeps1 >= 1, String(beeps1));
  await burst(CODE);
  await sleep(300);
  const flashed = await page.evaluate(() => Boolean(document.querySelector('[data-scan-flash]')));
  check('desktop: the same code flashes the line green', flashed);
  // Design dScan: "+1 scanned" under that Qty; the badge and the side card.
  const note = await page.evaluate(() => document.getElementById('lines.0.qty')?.closest('[data-scan-note]')?.getAttribute('data-scan-note') ?? '');
  check('desktop: "+1 scanned" under the Qty', note === (skew ? 'XX' : '+1 scanned'), note);
  const main0 = await page.locator('main').innerText();
  check('desktop: "Scanner connected · beep on" and "What the scanner does" after a scan', main0.includes(skew ? 'XX' : 'Scanner connected · beep on') && main0.includes('What the scanner does'));
  await page.screenshot({ path: `${dir}/1280-flash.png` });
  await sleep(1200);
  const qty = await page.locator('[id="lines.0.qty"]').inputValue().catch(() => '');
  check('desktop: the same code raises Qty to 2', qty === (skew ? 'XX' : '2'), qty);
  check('desktop: the caret stays in the search', await search.evaluate((el) => el === document.activeElement));
  // A code no item carries, checked first (8900000000000 is the seed's Ghee).
  const UNKNOWN = '8906999999994';
  const miss = await ctx.request.get(`${base}/api/v1/items/lookup?barcode=${UNKNOWN}`);
  check('the unknown code really is unknown (404)', miss.status() === 404, String(miss.status()));
  await burst(UNKNOWN);
  await sleep(1200);
  const missNote = await page.getByTestId('scan-not-found').innerText().catch(() => '');
  check('desktop: unknown code → "Not found: …" note', missNote.includes(skew ? 'XX' : `Not found: ${UNKNOWN}. The bill is not affected.`), missNote);
  check('desktop: the caret is still in the search', await search.evaluate((el) => el === document.activeElement));
  await page.screenshot({ path: `${dir}/1280-not-found.png` });
  // Read back: the draft the editor saved holds the line at qty 2.
  await sleep(2500);
  const id = /\/sales\/invoices\/([0-9a-f-]{36})/.exec(page.url())?.[1];
  if (id) {
    const doc = (await (await ctx.request.get(`${base}/api/v1/sales/invoices/${id}`)).json()).data;
    const line = (doc?.lines ?? []).find((l) => l.description === NAME || l.item_name === NAME);
    check('API: the saved draft has the line at qty 2', Number(line?.qty) === (skew ? 99 : 2), JSON.stringify(line?.qty));
  } else {
    check('API: the draft was saved (address carries its id)', false, page.url());
  }
  await ctx.close();
}

// ── phone: camera ───────────────────────────────────────────────────────────
for (const camera of [true, false]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(STUBS, { code: CODE, camera });
  const page = await signIn(ctx);
  await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
  await page.getByTestId('open-camera-scan').click();
  await page.getByTestId('scan-sheet').waitFor({ timeout: 10000 });
  if (camera) {
    await sleep(800);
    await page.screenshot({ path: `${dir}/390-camera.png` });
    await page.evaluate((c) => {
      window.__seeCode = c;
    }, CODE);
    await sleep(1200);
    await page.evaluate(() => {
      window.__seeCode = null;
    });
    const tray = await page.getByTestId('scan-sheet').innerText();
    check('phone: the tray shows the item just scanned', tray.includes(skew ? 'XX' : `+ ${NAME}`), tray.slice(0, 120).replace(/\n/g, ' / '));
    // Design pScan `.li2`: "× 1 · ₹…" beside the name, the bill's own figure.
    const rowText = await page.getByTestId('scan-tray-row').first().innerText().catch(() => '');
    check('phone: the tray row says "× 1 · ₹…"', /× 1 · ₹[\d,]+\.\d{2}/.test(rowText) !== skew, rowText.replace(/\n/g, ' '));
    // innerText reads invisible ink too: the first build painted this row
    // dark on the dark tray. Every span in it must carry a light colour.
    const rowInks = await page.getByTestId('scan-tray-row').first().evaluate((r) => [...r.querySelectorAll('span')].map((e) => getComputedStyle(e).color));
    check('phone: the tray row is readable (light ink on the dark tray)', rowInks.length === 2 && rowInks.every((c) => { const [r, g, b] = c.match(/\d+/g).map(Number); return r + g + b > 400; }), JSON.stringify(rowInks));
    const frame = await page.evaluate(() => {
      const c = document.querySelector('[data-scan-corners]');
      return c ? getComputedStyle(c).clipPath.startsWith('polygon') : false;
    });
    check('phone: the frame is corner brackets (clipped ring)', frame);
    const buzz = await page.evaluate(() => window.__buzz);
    check('phone: the phone buzzed once for the scan', buzz.length === (skew ? 9 : 1), JSON.stringify(buzz));
    await page.screenshot({ path: `${dir}/390-camera-scanned.png` });
    // Owner, 31 Oct 2026: an unknown code only buzzed on the camera; the
    // "Not found" came after it was closed. It must be written on the tray.
    await sleep(2600); // past the repeat window
    await page.evaluate(() => { window.__seeCode = '8901030875021'; });
    await sleep(1200);
    await page.evaluate(() => { window.__seeCode = null; });
    const missed = await page.getByTestId('scan-tray-missed').innerText().catch(() => '');
    check('phone: an unknown code says "Not found: 8901030875021" on the camera', missed === 'Not found: 8901030875021', missed);
    await page.screenshot({ path: `${dir}/390-camera-notfound.png` });
    // Nothing of the bill may paint over the camera's tray and Done (the first
    // build drew the bill's dock over them, dimmed).
    const onTop = await page.evaluate(() => {
      const done = [...document.querySelectorAll('[data-testid=scan-sheet] button')].find((b) => b.textContent.trim() === 'Done');
      const r = done.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const last = [...document.querySelectorAll('[data-testid=scan-sheet] span')].find((e) => e.textContent.includes('Last scanned'));
      const lr = last?.getBoundingClientRect();
      const lhit = lr ? document.elementFromPoint(lr.left + 4, lr.top + lr.height / 2) : null;
      // Readable, not only present: the label's ink must differ from the tray.
      const ink = last ? getComputedStyle(last).color : '';
      return { done: done.contains(hit), last: Boolean(last && last.contains(lhit)), ink, readable: ink !== 'rgb(27, 30, 36)' && ink !== '' };
    });
    check('phone: Done and "Last scanned" are on top and readable', onTop.done && onTop.last && onTop.readable, JSON.stringify(onTop));
    await page.getByRole('button', { name: 'Done' }).click();
    await sleep(800);
    check('phone: Done closes the camera', (await page.getByTestId('scan-sheet').count()) === 0);
    check('phone: the line is on the bill', (await page.locator('main').innerText()).includes(skew ? 'XX' : NAME));
  } else {
    const text = await page.getByTestId('scan-sheet').innerText();
    check('phone, no camera: the Barcode box is focused', await page.getByLabel('Barcode').evaluate((el) => el === document.activeElement));
    check('phone, no camera: "Camera is blocked" view', text.includes(skew ? 'XX' : 'Camera is blocked'));
    await page.getByLabel('Barcode').fill(CODE);
    await page.getByRole('button', { name: 'Add' }).click();
    await sleep(1200);
    await page.screenshot({ path: `${dir}/390-blocked.png` });
    await page.getByTestId('scan-sheet').getByRole('button', { name: 'Close' }).click();
    await sleep(600);
    check('phone, no camera: the typed code adds the line', (await page.locator('main').innerText()).includes(skew ? 'XX' : NAME));
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`phone (${camera ? 'camera' : 'no camera'}): no overflow`, overflow <= 0, String(overflow));
  await ctx.close();
}
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed${skew ? ' (skew: read-back checks should FAIL)' : ''}`);
process.exitCode = failed && !skew ? 1 : 0;
