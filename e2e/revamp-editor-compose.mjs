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
    find: 'Find a line on this bill',
    line: 'Line',
  },
  hi: {
    search: 'जोड़ने के लिए सामान खोजें',
    saved: 'सहेजा गया ग्राहक',
    change: 'बदलें',
    offline: 'इंटरनेट नहीं है। आपका बिल रखा है; इंटरनेट आने पर बिल बनाएँ।',
    find: 'बिल में पंक्ति ढूँढें',
    line: 'पंक्ति',
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
      const path = new URL(r.url()).pathname;
      const m = /\/api\/v1\/sales\/invoices\/([0-9a-f-]{36})$/.exec(path);
      if (m && r.request().method() !== 'DELETE') drafts.add(m[1]);
      // A first save (and a Hold) is a POST to the list: its id is in the body.
      if (/\/api\/v1\/sales\/invoices$/.test(path) && r.request().method() === 'POST')
        r.json().then((b) => b?.data?.id && drafts.add(b.data.id), () => undefined);
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

      // The same item again is one more of it on the SAME line, not a new row.
      await addItem(page, tag);
      await page.keyboard.press('Enter');
      await page
        .waitForFunction(
          () => document.querySelector('[data-line-cell][data-row="0"][data-col="1"] input')?.value === '2',
          null,
          { timeout: 5000 }
        )
        .catch(() => failures.push(`${tag}: a repeat pick did not raise line 1 to Qty 2`));
      if (await page.locator('[data-line-cell][data-row="1"]').count())
        failures.push(`${tag}: a repeat pick added a second line`);
      const caption = await page.getByTestId('total-dock-caption').textContent().catch(() => null);
      if (caption !== null && !/1/.test(caption)) failures.push(`${tag}: dock caption reads "${caption}"`);
      await check(page, tag, 'qty-raised');

      // A long bill: ten more items, then "Find a line on this bill" puts the
      // caret in the chosen line's Qty instead of a scroll past every card.
      for (let k = 0; k < 10; k += 1) {
        await search.click();
        await search.fill('a');
        await page.getByRole('option', { selected: true }).first().waitFor();
        for (let d = 0; d < k; d += 1) await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
      }
      const finder = page.getByRole('combobox', { name: WORDS.find });
      const shown = await finder.waitFor({ timeout: 8000 }).then(() => true, () => false);
      if (!shown) failures.push(`${tag}: no line finder on a bill of ${await page.locator('[data-line-cell][data-col="1"]').count()} lines`);
      if (shown) {
        await finder.click();
        await page.getByRole('option', { name: new RegExp(`^${WORDS.line} 1 · `) }).waitFor();
        await check(page, tag, 'finder-open', { root: '[role="listbox"]' });
        await page.getByRole('option', { name: new RegExp(`^${WORDS.line} 1 · `) }).click();
        await page.waitForFunction(() => document.activeElement?.closest('[data-line-cell]'), null, { timeout: 5000 }).catch(() => undefined);
        const found = await caretCell(page);
        if (found !== '0:1') failures.push(`${tag}: finder put the caret at ${found}, expected line 1 Qty`);
        await check(page, tag, 'line-found');
      }

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
    // "UPI or other" still opens the payment sheet; close it and take the
    // cash in one tap. Below 1536 px the header's buttons are hidden and the
    // dock carries them.
    const dock = page.getByTestId('invoice-dock');
    await dock.getByRole('button', { name: locale === 'hi' ? /UPI या अन्य/ : /UPI or other/ }).click();
    const confirm = page.getByTestId('invoice-payment-confirm');
    await confirm.waitFor();
    await check(page, tag, 'payment-sheet', { root: '[role="dialog"]' });
    await page.keyboard.press('Escape');
    await confirm.waitFor({ state: 'detached' });
    const cash = page.getByTestId('invoice-dock-paid-cash');
    const name = await cash.getAttribute('aria-label');
    if (!/₹/.test(name ?? '')) failures.push(`${tag}: Paid cash's accessible name has no total (${name})`);
    await cash.click();
    const issued = page.getByRole('dialog');
    await issued.getByText(/INV|बिल/).first().waitFor({ timeout: 15000 });
    await check(page, tag, 'issued', { root: '[role="dialog"]' });

    // A session that expires mid-bill: the merchant is sent to sign in and,
    // signed back in, lands on the bill with it offered back.
    {
      const s = await open(1280, 'light');
      const stag = `1280-light-${locale}`;
      await s.page.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
      await s.page.route('**/api/v1/sales/invoices**', dropSaves);
      const box = s.page.getByRole('combobox', { name: WORDS.search });
      await box.click();
      await box.fill(ITEM);
      await s.page.getByRole('option', { name: new RegExp(ITEM), selected: true }).first().waitFor();
      await s.page.keyboard.press('Enter');
      await s.page.waitForTimeout(1500); // the 500 ms device copy
      const host = new URL(base).hostname;
      await s.ctx.clearCookies();
      await s.ctx.addCookies([
        { name: 'ub_locale', value: locale, domain: host, path: '/' },
        { name: 'ub_theme_choice', value: 'light', domain: host, path: '/' },
      ]);
      await box.click();
      await box.fill('a');
      const sent = await s.page.waitForURL(/\/login/, { timeout: 15000 }).then(() => true, () => false);
      if (!sent) failures.push(`${stag}: an expired session did not lead to sign-in`);
      const next = new URL(s.page.url()).searchParams.get('next');
      if (next !== '/sales/invoices/new') failures.push(`${stag}: sign-in returns to ${next}, not the bill`);
      await s.page.unroute('**/api/v1/sales/invoices**', dropSaves);
      await s.page.goto(`${base}/login/email?next=${encodeURIComponent(next ?? '')}`);
      await s.page.fill('input[type=email]', 'scale@digikhaato.test');
      await s.page.fill('input[type=password]', 'Scale-Run-2026!');
      await s.page.click('button[type=submit]');
      await s.page.waitForURL((u) => u.pathname === '/sales/invoices/new', { timeout: 15000 }).catch(() =>
        failures.push(`${stag}: signed back in at ${s.page.url()}, not the bill`)
      );
      const back = s.page.getByRole('dialog');
      const offeredBack = await back.waitFor({ timeout: 8000 }).then(() => true, () => false);
      if (!offeredBack) failures.push(`${stag}: the bill was not offered back after signing in again`);
      if (offeredBack) {
        await check(s.page, stag, 'session-return', { root: '[role="dialog"]' });
        await back.getByRole('button').filter({ hasText: locale === 'hi' ? /वापस|बहाल|रखें/ : /Restore/ }).first().click();
        await s.page.getByText(new RegExp(ITEM)).first().waitFor({ timeout: 5000 }).catch(() =>
          failures.push(`${stag}: the restored bill lost its item`)
        );
      }
      await s.ctx.close();
    }

    // Hold this bill and start the next: it is kept as a draft, a blank bill
    // opens, and the held one is one tap away above the editor.
    for (const w of [1280, 390]) {
      const held = w === 1280 ? { ctx, page } : await open(390, 'light');
      const htag = `${w}-light-${locale}`;
      await held.page.goto(`${base}/sales/invoices/new`, { waitUntil: 'networkidle' });
      const box = held.page.getByRole('combobox', { name: WORDS.search });
      await box.click();
      await box.fill(ITEM);
      await held.page.getByRole('option', { name: new RegExp(ITEM), selected: true }).first().waitFor();
      await held.page.keyboard.press('Enter');
      await held.page.getByTestId('invoice-hold').click();
      const strip = held.page.getByTestId('invoice-held');
      await strip.waitFor({ timeout: 10000 }).catch(() => failures.push(`${htag}: held bill not shown after Hold`));
      // Blank: the docked total is back to nothing (the empty line keeps Qty 1).
      await held.page
        .getByTestId('invoice-dock')
        .getByText('₹0.00')
        .first()
        .waitFor({ timeout: 5000 })
        .catch(() => failures.push(`${htag}: the bill was not blank after Hold`));
      await check(held.page, htag, 'held');
      if (held.ctx !== ctx) await held.ctx.close();
    }
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
