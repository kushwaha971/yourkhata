/**
 * e2e/demo/shop-kind-shots.mjs — the screenshots in each shop kind's guides on
 * /solutions/shop-<kind>, taken from that kind's demo shop (seed-kinds.mjs).
 *
 *   DEMO_FRONTEND=http://localhost:3005 DEMO_API_LOG=<log> node e2e/demo/shop-kind-shots.mjs [kind…]
 *
 * Writes frontend/public/media/guides/shop/<kind>/<size>-<step>.{webp,jpg}.
 * Nothing is saved: the bill and the purchase are filled and photographed,
 * then left as drafts are discarded by leaving the page; the payment sheet is
 * photographed open and closed.
 */
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'playwright';

import { FE, HERE, signIn, sleep, useBusiness } from './lib.mjs';

const KINDS = JSON.parse(readFileSync(path.join(HERE, '.kinds-state.json'), 'utf8'));
const only = process.argv.slice(2);
const TMP = path.join(process.env.TMPDIR ?? '/tmp', 'shop-kind-shots');
mkdirSync(TMP, { recursive: true });
const sharp = createRequire(path.join(HERE, '..', '..', 'frontend', 'package.json'))('sharp');

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
// Sign in once: the server waits 60 s between codes to one number, so a code per shoot is refused.
const login = await browser.newContext();
await signIn(await login.newPage());
const session = await login.storageState();
await login.close();
for (const [kind, k] of Object.entries(KINDS)) {
  if (only.length && !only.includes(kind)) continue;
  const OUT = path.join(HERE, '..', '..', 'frontend', 'public', 'media', 'guides', 'shop', kind);
  mkdirSync(OUT, { recursive: true });
  for (const size of ['phone', 'desktop']) {
    const phone = size === 'phone';
    const ctx = await browser.newContext({
      storageState: session,
      viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      deviceScaleFactor: phone ? 2 : 1,
      ...(phone ? { isMobile: true, hasTouch: true } : {}),
    });
    const page = await ctx.newPage();
    /** Rings the control a guide's steps talk about and badges it, the way a teacher points. */
    const mark = async (locator) => {
      const box = await locator.first().boundingBox().catch(() => null);
      if (!box) return;
      await page.evaluate(({ x, y, width, height }) => {
        const pad = 5;
        const ring = document.createElement('div');
        ring.dataset.guideMark = '';
        Object.assign(ring.style, {
          position: 'fixed', left: `${x - pad}px`, top: `${y - pad}px`, width: `${width + pad * 2}px`, height: `${height + pad * 2}px`,
          border: '3px solid #E8590C', borderRadius: '12px', boxShadow: '0 0 0 6px rgba(232,89,12,0.18)', zIndex: 2147483646, pointerEvents: 'none',
        });
        const dot = document.createElement('div');
        dot.dataset.guideMark = '';
        dot.textContent = '1';
        Object.assign(dot.style, {
          position: 'fixed', left: `${Math.max(4, x - pad - 12)}px`, top: `${Math.max(4, y - pad - 12)}px`, width: '24px', height: '24px',
          borderRadius: '50%', background: '#E8590C', color: '#fff', font: '700 13px/24px system-ui', textAlign: 'center', zIndex: 2147483647, pointerEvents: 'none',
        });
        document.body.append(ring, dot);
      }, box);
    };
    const shot = async (step, target) => {
      await sleep(700);
      if (target) await mark(target);
      const png = path.join(TMP, `${kind}-${size}-${step}.png`);
      await page.screenshot({ path: png });
      await sharp(png).webp({ quality: 72 }).toFile(path.join(OUT, `${size}-${step}.webp`));
      await sharp(png).jpeg({ quality: 70, mozjpeg: true }).toFile(path.join(OUT, `${size}-${step}.jpg`));
      await page.evaluate(() => document.querySelectorAll('[data-guide-mark]').forEach((n) => n.remove()));
    };
    const visible = (l) => l.filter({ visible: true });
    const go = (url) => page.goto(`${FE}${url}`, { waitUntil: 'networkidle' });
    await page.goto(`${FE}/dashboard`, { waitUntil: 'networkidle' });
    await useBusiness(page, k.name);

    await go('/dashboard'); await shot('dashboard', visible(page.getByRole('link', { name: 'New bill' }).or(page.getByRole('button', { name: 'New bill' }))));

    await go('/sales/invoices/new');
    await page.getByRole('button', { name: 'Saved customer', exact: true }).click();
    // A jeweller's bill opens on Saved customer already; tap the box itself.
    await page.getByRole('combobox', { name: 'Saved customer' }).click().catch(() => {});
    await page.keyboard.type(k.customer.slice(0, 5), { delay: 40 });
    await page.getByRole('option', { name: new RegExp(k.customer.replace(/[()]/g, '.')) }).first().click();
    await page.getByRole('combobox', { name: 'Search items to add' }).click();
    await page.keyboard.type(k.item.slice(0, 6), { delay: 40 });
    await page.getByRole('option', { name: new RegExp(k.item.slice(0, 6)) }).first().click();
    await page.keyboard.press('Escape').catch(() => {});
    await shot('bill', visible(page.getByRole('combobox', { name: 'Search items to add' })));
    await page.getByRole('button', { name: /^Issue/ }).first().click();
    await page.getByRole('dialog', { name: 'Payment' }).waitFor();
    await shot('bill-payment', visible(page.getByRole('dialog', { name: 'Payment' }).getByRole('button', { name: 'Full credit' })));
    await page.keyboard.press('Escape');
    // Picking a customer saved a draft; discard it so the demo shop stays as seeded.
    await page.getByRole('button', { name: /Discard draft|More actions/ }).first().click().catch(() => {});
    await page.getByRole('button', { name: 'Discard draft' }).last().click({ timeout: 2000 }).catch(() => {});
    await page.getByRole('dialog').getByRole('button', { name: /Discard/ }).last().click({ timeout: 3000 }).catch(() => {});

    await go('/customers'); await shot('customers', visible(page.getByRole('button', { name: /^Remind/ })));
    await go(`/parties/${k.customerId}`); await shot('customer', visible(page.getByRole('button', { name: 'Receive payment' })));
    await page.getByRole('button', { name: 'Receive payment' }).first().click();
    await page.getByRole('dialog', { name: 'Receive payment' }).waitFor();
    await shot('receive', visible(page.getByRole('dialog', { name: 'Receive payment' }).getByRole('textbox', { name: 'Amount' })));
    await page.keyboard.press('Escape');

    await go('/items'); await shot('items', visible(page.getByRole('button', { name: /Add item/ })));
    await go(`/items/${k.itemId}`); await shot('item', visible(page.getByRole('button', { name: 'Adjust stock' })));

    await go('/purchases/bills/new');
    await page.getByRole('combobox', { name: 'Supplier' }).click();
    await page.keyboard.type(k.supplier.slice(0, 5), { delay: 40 });
    await page.getByRole('option', { name: new RegExp(k.supplier.slice(0, 5)) }).first().click();
    await page.waitForURL(/\/purchases\/bills\/[0-9a-f-]{20,}\/edit/);
    await page.getByRole('combobox', { name: 'Search items to add' }).click();
    await page.keyboard.type(k.item.slice(0, 6), { delay: 40 });
    await page.getByRole('option', { name: new RegExp(k.item.slice(0, 6)) }).first().click();
    await shot('purchase', visible(page.getByRole('button', { name: 'Record purchase' })));
    // The purchase draft is the server's; delete it so the demo shop stays as seeded.
    await page.getByRole('button', { name: 'Delete draft' }).click().catch(() => {});
    await page.getByRole('dialog').getByRole('button', { name: /Delete/ }).last().click({ timeout: 3000 }).catch(() => {});

    await go('/reports'); await shot('reports', visible(page.getByRole('link', { name: /Day book/ })));
    await ctx.close();
    console.log(kind, size);
  }
}
await browser.close();
rmSync(TMP, { recursive: true, force: true });
