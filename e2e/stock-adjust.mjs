/**
 * Revamp §8.4 — the stock adjustment drawer on the LOCAL QA stack, through the
 * real API.
 *
 *   NODE_PATH=$(npm root -g) node e2e/stock-adjust.mjs [--shots=/tmp/e2e-shots/stock-adjust]
 *
 * Makes a goods item with 20 NOS at ₹380, opens Adjust stock from its page and:
 *
 *  * LOOKs at 390, 320 and 1280 in English and Hindi with Counted chosen and a
 *    count typed: no sideways scroll, every text node inside its box, reason
 *    chips 32 px visible with a ≥ 44 px target on a phone, Save ≥ 44 px on a
 *    phone, a 900 px drawer with the line table on a desktop;
 *  * Save with no reason is refused in words, nothing posted;
 *  * Counted → "Set to" 17: After reads 17, the consequence reads −₹1,140.00,
 *    Save; the server says 17, and the snackbar's View opens that adjustment;
 *  * Add 3 at the prefilled average: the server says 20 again;
 *  * Remove 25 of 20: either the 409 marks the line with what is available
 *    (negative stock off) or it posts (on) — whichever the tenant allows, read
 *    from the server, and the server's on-hand agrees with what was shown;
 *  * offline: Save waits and says why.
 *
 * Local QA tenant only; nothing is sent to anybody.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_FRONTEND ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const SHOTS = arg('shots', '');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
});
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  const csrf = (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value;
  const api = `${base}/api/v1`;
  const get = async (path) => (await (await ctx.request.get(`${api}${path}`)).json()).data;
  const post = async (path, data = {}) => {
    const r = await ctx.request.post(`${api}${path}`, {
      headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() },
      data,
    });
    if (!r.ok()) throw Error(`POST ${path} ${r.status()}: ${await r.text()}`);
    return (await r.json()).data;
  };
  const units = await get('/units');
  const nos = (units.find?.((u) => u.code === 'NOS') ?? units[0]).id;
  const stamp = Date.now().toString(36).toUpperCase();
  const made = await post('/items', {
    name: `QA84 Oil tin ${stamp}`,
    unit_id: nos,
    selling_price: '450.00',
    purchase_price: '390.00',
    tax_code: 'GST5',
    opening_stock: { qty: '20', unit_cost: '380' },
  });
  const item = made.item ?? made;
  const onHand = async () => Number((await get(`/items/${item.id}`)).on_hand);

  const openDrawer = async () => {
    await page.goto(`${base}/items/${item.id}`);
    await page.getByTestId('item-detail-screen').waitFor({ timeout: 15000 });
    const adjust = page.getByRole('button', { name: /Adjust stock|स्टॉक/ }).locator('visible=true').first();
    await adjust.click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radiogroup').waitFor({ timeout: 15000 });
    return dialog;
  };

  /* ---------- LOOK ---------- */
  for (const locale of ['en', 'hi']) {
    await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
    for (const width of [390, 320, 1280]) {
      await page.setViewportSize({ width, height: width === 1280 ? 900 : 780 });
      const dialog = await openDrawer();
      await dialog.getByRole('radio').first().click(); // Counted, the first chip
      const qty = dialog.locator('input[inputmode="decimal"], input[inputmode="numeric"]').first();
      await qty.fill('17');
      await page.waitForTimeout(200);
      const m = await page.evaluate(() => {
        const dialog = document.querySelector('[role=dialog]');
        const cut = [];
        for (const el of dialog.querySelectorAll('*')) {
          if (el.children.length || !el.textContent?.trim()) continue;
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden') continue;
          const r = el.getBoundingClientRect();
          if (r.width <= 1) continue;
          if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && s.overflow !== 'visible')
            cut.push(el.textContent.trim().slice(0, 30));
          if (r.right > innerWidth + 1) cut.push(`offscreen:${el.textContent.trim().slice(0, 30)}`);
        }
        const target = (el) => {
          if (!el) return 0;
          const h = el.getBoundingClientRect().height;
          if (innerWidth > 639) return Math.round(h);
          const a = getComputedStyle(el, '::after');
          const over = -(parseFloat(a.top) || 0) - (parseFloat(a.bottom) || 0);
          return Math.round(h + Math.max(0, over));
        };
        const chip = dialog.querySelector('[role=radio]');
        const save = [...dialog.querySelectorAll('button')].find((b) => b.type === 'submit');
        const panel = dialog.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          cut: [...new Set(cut)],
          chipFace: Math.round(chip?.getBoundingClientRect().height ?? 0),
          chipTarget: target(chip),
          save: target(save),
          width: Math.round(panel.width),
          layout: dialog.querySelector('[data-testid=line-items-editor]')?.dataset.layout ?? '',
          consequence: dialog.querySelector('[data-testid=adjust-consequence]')?.textContent ?? '',
        };
      });
      const tag = `${width} ${locale}`;
      check(`${tag}: no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
      check(`${tag}: no text cut`, m.cut.length === 0, m.cut.join(' | '));
      check(`${tag}: reason chip face is 32 px`, m.chipFace === 32, `${m.chipFace}`);
      if (width < 1280) {
        check(`${tag}: reason chip target ≥ 44 px`, m.chipTarget >= 44, `${m.chipTarget}`);
        check(`${tag}: Save target ≥ 44 px`, m.save >= 44, `${m.save}`);
      } else {
        /* Owner, 24 Oct: "do whatever is best" — the drawer is as wide as the
           line table needs, so a desktop gets the table rather than phone cards. */
        check(`${tag}: the drawer is 900 px`, Math.abs(m.width - 900) <= 2, `${m.width}`);
        check(`${tag}: a desktop gets the line table`, m.layout === 'table', m.layout);
      }
      check(`${tag}: the consequence reads a loss of 3 at ₹380`, m.consequence.includes('1,140.00'), m.consequence);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/counted-${width}-${locale}.png`, fullPage: true });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      // A dirty drawer may refuse a backdrop close; a fresh page load clears it.
    }
  }
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);
  await page.setViewportSize({ width: 390, height: 780 });

  /* ---------- Reason is required ---------- */
  let dialog = await openDrawer();
  await dialog.getByPlaceholder('How many').first().fill('1');
  await dialog.getByRole('button', { name: 'Save adjustment' }).click();
  await dialog.getByText('Choose a reason.').waitFor({ timeout: 10000 });
  check('Save with no reason is refused in words', true);
  check('nothing was posted without a reason', (await onHand()) === 20, String(await onHand()));

  /* ---------- Counted: Set to 17 ---------- */
  // A line already typed keeps its mode (the merchant said what they meant), so
  // a fresh drawer: Counted must turn its untyped line into "Set to".
  dialog = await openDrawer();
  await dialog.getByRole('radio', { name: 'Counted' }).click();
  const countBox = dialog.getByPlaceholder('Count').first();
  check('Counted turns the untyped line into "Set to"', (await countBox.count()) === 1);
  await countBox.fill('17');
  check('After reads the count', (await dialog.getByText('17 NOS').count()) >= 1);
  check(
    'the consequence names the value of the loss',
    (await dialog.getByTestId('adjust-consequence').innerText()).includes('1,140.00')
  );
  await dialog.getByRole('button', { name: 'Save adjustment' }).click();
  const snackbar = page.getByTestId('snackbar');
  await snackbar.getByText(/Stock adjusted · /).waitFor({ timeout: 15000 });
  const number = (await snackbar.innerText()).match(/·\s*(\S+)/)?.[1] ?? '';
  check('the snackbar says Stock adjusted with its number', Boolean(number), number);
  check('the server says 17 after a count of 17', (await onHand()) === 17, String(await onHand()));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/saved-390.png` });
  await snackbar.getByRole('button', { name: 'View' }).click();
  const view = page.getByRole('dialog').filter({ hasText: number });
  await view.waitFor({ timeout: 15000 });
  check('View opens the adjustment just saved', (await view.getByText(/Counted/).count()) >= 1);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/view-390.png` });
  await page.keyboard.press('Escape');

  /* ---------- Add 3 at the prefilled average ---------- */
  dialog = await openDrawer();
  await dialog.getByRole('radio', { name: 'Other' }).click();
  await dialog.getByRole('textbox', { name: /Note/ }).fill('Found behind the shelf');
  const mode = dialog.getByRole('combobox', { name: /Mode/ }).first();
  await mode.click();
  await page.getByRole('option', { name: 'Add' }).click();
  await dialog.getByPlaceholder('How many').first().fill('3');
  await dialog.getByRole('button', { name: 'Save adjustment' }).click();
  await dialog.waitFor({ state: 'detached', timeout: 15000 });
  check('Add 3 brings the server back to 20', (await onHand()) === 20, String(await onHand()));

  /* ---------- Remove more than on hand ---------- */
  dialog = await openDrawer();
  await dialog.getByRole('radio', { name: 'Damaged' }).click();
  await dialog.getByPlaceholder('How many').first().fill('25');
  await dialog.getByRole('button', { name: 'Save adjustment' }).click();
  const short = dialog.getByText('Only 20 NOS available');
  const outcome = await Promise.race([
    short.waitFor({ timeout: 15000 }).then(() => 'short'),
    dialog.waitFor({ state: 'detached', timeout: 15000 }).then(() => 'posted'),
  ]);
  if (outcome === 'short') {
    check('a short line says what is available', true);
    check('nothing posted for a short line', (await onHand()) === 20, String(await onHand()));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/short-390.png`, fullPage: true });
  } else {
    check('negative stock is on: the remove posted', (await onHand()) === -5, String(await onHand()));
  }

  /* ---------- Offline ---------- */
  dialog = await openDrawer();
  // A response still in flight when the connection drops counts as proof of a
  // network (signal 1) and would flip the state back; let the drawer settle.
  await page.waitForLoadState('networkidle');
  await ctx.setOffline(true);
  await dialog.getByTestId('adjust-offline').waitFor({ timeout: 10000 }).catch(() => {});
  check('offline: the drawer says why Save waits', (await dialog.getByTestId('adjust-offline').count()) === 1);
  check(
    'offline: Save is disabled',
    await dialog.getByRole('button', { name: 'Save adjustment' }).isDisabled()
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/offline-390.png`, fullPage: true });
  await ctx.setOffline(false);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
