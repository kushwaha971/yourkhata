/**
 * 07-screens/09 §3 — the bill editor's composition on the live LOCAL QA stack:
 * the always-open item search, the picked customer's one line with Shop dues,
 * Issue disabled offline with its reason, a real Quick Sale issued end to end,
 * and the unsynced bill offered back after a reload.
 *
 *   NODE_PATH=$(npm root -g) node e2e/revamp-editor-compose.mjs [--locale=hi] [--widths=390,1280]
 *
 * Writes go to the local seeded QA tenant only (drafts, and one issued Quick
 * Sale per run on an untracked QA item). Drafts this run creates are deleted at
 * the end. Nothing is sent to anybody.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';

import { measureCustomers } from './revamp-customers.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_FRONTEND ?? 'http://localhost:3000';
const locale = arg('locale', 'en');
const out = `${process.env.E2E_SHOTS ?? '/tmp/e2e-shots'}/revamp/editor-compose`;
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
mkdirSync(out, { recursive: true });

const WORDS = {
  en: {
    search: 'Search items to add',
    saved: 'Saved customer',
    change: 'Change',
    offline: "No internet. Your bill is kept; issue it when you're back online.",
  },
  hi: {
    search: 'जोड़ने के लिए सामान खोजें',
    saved: 'सहेजा गया ग्राहक',
    change: 'बदलें',
    offline: 'इंटरनेट नहीं है। आपका बिल रखा है; इंटरनेट आने पर बिल बनाएँ।',
  },
}[locale];
const ITEM = 'Copper Electrical Cable';

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' });
const results = [];
const failures = [];
const drafts = new Set();
let auth;
let csrf;
try {
  auth = await browser.newContext();
  const p = await auth.newPage();
  await p.goto(`${base}/login/email`);
  await p.fill('input[type=email]', 'scale@digikhaato.test');
  await p.fill('input[type=password]', 'Scale-Run-2026!');
  await p.click('button[type=submit]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'));
  csrf = (await auth.cookies()).find((c) => c.name === 'ub_csrf')?.value;
  // One untracked QA item to bill, created once on the local tenant.
  const found = await (await auth.request.get(`${base}/api/v1/items?q=${encodeURIComponent(ITEM)}&status=active`)).json();
  if (!found.data?.length) {
    const units = (await (await auth.request.get(`${base}/api/v1/units`)).json()).data;
    const r = await auth.request.post(`${base}/api/v1/items`, {
      headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() },
      data: {
        name: `Radhe Krishna Enterprises ${ITEM} 2.5 sq mm`,
        unit_id: units.find((x) => x.code === 'NOS').id,
        selling_price: '450.00',
        purchase_price: '380.00',
        tax_code: 'GST18',
        hsn_sac: '8544',
        track_stock: false,
      },
    });
    if (!r.ok()) throw Error(`items ${r.status()} ${await r.text()}`);
  }
  const storageState = await auth.storageState();

  const open = async (width, theme) => {
    const ctx = await browser.newContext({
      storageState,
      viewport: { width, height: width < 768 ? 844 : 900 },
      deviceScaleFactor: width < 768 ? 2 : 1,
      isMobile: width < 768,
      hasTouch: width < 768,
    });
    const host = new URL(base).hostname;
    await ctx.addCookies([
      { name: 'ub_locale', value: locale, domain: host, path: '/' },
      { name: 'ub_theme_choice', value: theme, domain: host, path: '/' },
    ]);
    const page = await ctx.newPage();
    page.on('response', (r) => {
      const m = /\/api\/v1\/sales\/invoices\/([0-9a-f-]{36})$/.exec(new URL(r.url()).pathname);
      if (m && r.request().method() !== 'DELETE') drafts.add(m[1]);
    });
    return { ctx, page };
  };

  const check = async (page, tag, state, { root = 'main' } = {}) => {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    const m = await measureCustomers(page, root);
    // The dock is outside <main>: its note and total are measured on their own.
    const dock = page.getByTestId('invoice-dock');
    if (await dock.count()) {
      const d = await measureCustomers(page, '[data-testid="invoice-dock"]');
      m.cut.push(...d.cut);
      m.lowContrast.push(...d.lowContrast);
    }
    results.push({ tag, state, ...m });
    await page.screenshot({ path: `${out}/${tag}-${state}.png`, fullPage: false });
    console.log(`${tag} ${state}: overflow ${m.overflow}px, cut ${m.cut.length}, contrast ${m.lowContrast.length}`);
    if (m.overflow > 0 || m.cut.length || m.lowContrast.length) failures.push(`${tag} ${state}: ${JSON.stringify(m)}`);
  };

  const caretCell = (page) =>
    page.evaluate(() => {
      const cell = document.activeElement?.closest('[data-line-cell]');
      return cell ? `${cell.getAttribute('data-row')}:${cell.getAttribute('data-col')}` : null;
    });

  const addItem = async (page, tag) => {
    const search = page.getByRole('combobox', { name: WORDS.search });
    await search.click();
    await search.fill(ITEM);
    const option = page.getByRole('option', { name: new RegExp(ITEM), selected: true }).first();
    await option.waitFor();
    return { search, option };
  };

  for (const width of arg('widths', '390,320,1024,1280').split(',').filter(Boolean).map(Number)) {
    for (const theme of arg('themes', 'light,dark').split(',')) {
      const tag = `${width}-${theme}-${locale}`;
      const { ctx, page } = await open(width, theme);
      await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
      const search = page.getByRole('combobox', { name: WORDS.search });
      await search.waitFor();
      await check(page, tag, 'empty');

      await addItem(page, tag);
      await check(page, tag, 'search-open');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.activeElement?.closest('[data-line-cell]'));
      const caret = await caretCell(page);
      if (caret !== '0:1') failures.push(`${tag}: caret after pick at ${caret}, expected line 1 Qty`);
      if ((await search.inputValue()) !== '') failures.push(`${tag}: search kept its text after a pick`);
      await check(page, tag, 'item-added');

      // A second item goes on a NEW line, and the caret follows it.
      await addItem(page, tag);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.activeElement?.closest('[data-line-cell][data-row="1"]'));
      const caret2 = await caretCell(page);
      if (caret2 !== '1:1') failures.push(`${tag}: second pick caret at ${caret2}, expected line 2 Qty`);
      await check(page, tag, 'two-items');

      // A saved customer collapses to one line with their Shop dues and Change.
      await page.getByRole('radio', { name: WORDS.saved }).click();
      const picker = page.getByRole('combobox', { name: WORDS.saved });
      await picker.click();
      await page.getByRole('option').first().click();
      const line = page.getByTestId('invoice-customer-line');
      await line.waitFor();
      await line.locator('text=₹').first().waitFor().catch(() => failures.push(`${tag}: customer line drew no Shop figure`));
      await check(page, tag, 'customer-line');

      // Offline: Issue disabled with the reason under it, before the tap.
      await ctx.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      const note = page.getByText(WORDS.offline).first();
      await note.waitFor({ timeout: 5000 }).catch(() => failures.push(`${tag}: offline reason not shown`));
      const issueDisabled = await page.evaluate(() =>
        [...document.querySelectorAll('button')]
          .filter((b) => b.getClientRects().length && /Issue|बिल बनाएँ|जारी/.test(b.textContent ?? ''))
          .every((b) => b.disabled)
      );
      if (!issueDisabled) failures.push(`${tag}: a visible Issue stayed enabled offline`);
      await check(page, tag, 'offline');
      await ctx.setOffline(false);
      await ctx.close();
    }
  }

  // ── Business flows, once, at a laptop: draft recovery, then a real issue. ──
  if (!process.argv.includes('--no-flows')) {
    const tag = `1280-light-${locale}`;
    const { ctx, page } = await open(1280, 'light');
    await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
    await page.getByRole('combobox', { name: WORDS.search }).waitFor();
    // The first save never reaches the server (the connection drops on the
    // write), so the bill lives only in this device's copy.
    const dropSaves = (route) =>
      route.request().method() === 'GET' ? route.continue() : route.abort('internetdisconnected');
    await page.route('**/api/v1/sales/invoices**', dropSaves);
    const search = page.getByRole('combobox', { name: WORDS.search });
    await search.click();
    await search.fill(ITEM);
    await page.getByRole('option', { name: new RegExp(ITEM), selected: true }).first().waitFor();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000); // the 500 ms device copy and the 3 s server save, refused
    await page.unroute('**/api/v1/sales/invoices**', dropSaves);
    await page.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
    const dialog = page.getByRole('dialog');
    const offered = await dialog.waitFor({ timeout: 6000 }).then(() => true, () => false);
    if (!offered) failures.push(`${tag}: an unsynced bill was not offered back after reload`);
    await check(page, tag, 'restore-offered', { root: '[role="dialog"]' });
    if (offered) {
      await dialog.getByRole('button').filter({ hasText: locale === 'hi' ? /वापस|बहाल|रखें/ : /Restore/ }).first().click();
      await page.getByText(new RegExp(ITEM)).first().waitFor();
      await check(page, tag, 'restored');
    }
    // Issue it as a Quick Sale: payment sheet with the whole amount in cash.
    // Below 1536 px the header's Issue is hidden and the dock carries it.
    const issue = page.getByTestId('invoice-dock').getByRole('button').last();
    const name = await issue.getAttribute('aria-label');
    if (!/₹/.test(name ?? '')) failures.push(`${tag}: Issue's accessible name has no total (${name})`);
    await issue.click();
    const confirm = page.getByTestId('invoice-payment-confirm');
    await confirm.waitFor();
    await check(page, tag, 'payment-sheet', { root: '[role="dialog"]' });
    await confirm.click();
    const issued = page.getByRole('dialog');
    await issued.getByText(/INV|बिल/).first().waitFor({ timeout: 15000 });
    await check(page, tag, 'issued', { root: '[role="dialog"]' });
    await ctx.close();
  }
} finally {
  // Tidy the drafts this run left; an issued bill refuses the delete, as it must.
  for (const id of drafts) {
    await auth?.request
      .delete(`${base}/api/v1/sales/invoices/${id}`, { headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() } })
      .catch(() => undefined);
  }
  writeFileSync(`${out}/results-${locale}.json`, JSON.stringify({ results, failures }, null, 2));
  await browser.close();
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
