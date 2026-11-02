// G2a — a jeweller's tags (design D3 "Tag details", D5 "Weight and rate", D4
// "Tags in stock"; report docs/performance/2026-11-02-shop-g2-jewellery-bill.md).
//
// QA Jewellery (e2e/fixtures/ad_cert_people.py): owner qa-jeweller. Checks:
//   F1  Add item with Tag details: the item and its first tag are one save; the
//       API reads back the tag as typed, net worked out as gross − stone
//       (--skew expects 0.001 g more: it must then fail);
//   F2  a net that is not gross − stone is refused UNDER the Net box, and no
//       item is left behind;
//   F3  the item page's Weight and rate tab lists the tag; Add tag adds a second
//       piece; the API then has two and "Tags in stock" says the API's number;
//   K   a kirana's Add item form has no Tag details, and its tag API is 404;
//   L   the Add item drawer and the tab at 390, 320, 1024, 1280 × light/dark ×
//       EN/HI: no page wider than the screen, no text cut, the theme painted.
//
//   node e2e/g2a-tags.mjs [--width=390,320,1024,1280] [--skew] [--tag=now]
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const api = process.env.E2E_API ?? 'http://localhost:8000/api/v1';
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const widths = arg('width', '390,320,1024,1280').split(',').map(Number);
const tag = arg('tag', 'now');
const skew = process.argv.includes('--skew');
const dir = process.env.E2E_SHOTS ?? '/tmp/e2e-shots/g2a';
mkdirSync(dir, { recursive: true });
const PASSWORD = 'AdCert-Test-2026!';
const run = Date.now().toString(36).toUpperCase().slice(-5);

const failures = [];
const notes = [];
const fail = (k, m) => failures.push(`${k}: ${m}`);
let consoleErrors = 0;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });

const session = async (who) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', `${who}@adcert.test`);
  await page.fill('input[type=password]', PASSWORD);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  const state = await ctx.storageState();
  await ctx.close();
  return state;
};

const open = async (state, { width, theme = 'light', locale = 'en' }) => {
  const ctx = await browser.newContext({ storageState: state, viewport: { width, height: width < 1024 ? 800 : 860 } });
  const host = new URL(base).hostname;
  await ctx.addCookies([
    { name: 'ub_locale', value: locale, domain: host, path: '/' },
    { name: 'ub_theme_choice', value: theme, domain: host, path: '/' },
  ]);
  const page = await ctx.newPage();
  if (process.env.G2A_DEBUG) page.on('response', async (r) => { if (r.url().includes('/items') && r.request().method() === 'POST') console.log('POST', r.status(), (await r.text()).slice(0, 200)); });
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) {
      consoleErrors += 1;
      notes.push(`console ${width} ${theme} ${locale}: ${m.text().slice(0, 160)}`);
    }
  });
  return { ctx, page };
};

const get = async (ctx, path) => {
  const res = await ctx.request.get(`${api}${path}`);
  return { status: res.status(), body: res.ok() ? await res.json() : null };
};

const openAddItem = async (page) => {
  await page.goto(`${base}/items`);
  await page.getByRole('button', { name: /^Add item/ }).first().click();
  await page.getByRole('dialog').getByLabel('Name', { exact: true }).waitFor({ timeout: 15000 });
};

const fillTag = async (page, { no, gross, stone, net = '' }) => {
  await page.getByLabel('Tag no.').fill(no);
  await page.getByLabel('Gross').fill(gross);
  await page.getByLabel('Stone').fill(stone);
  if (net) await page.getByLabel('Net', { exact: true }).fill(net);
  await page.getByLabel('Making amount').fill('12');
  await page.getByLabel('HUID').fill('7K2P9X');
};

const owner = await session('qa-jeweller');
const kirana = await session('qa-owner');
let itemId = null;

// ── F1 / F2 / F3 ────────────────────────────────────────────────────────────
{
  const { ctx, page } = await open(owner, { width: 1280 });
  // F2 first: the refusal must leave no item behind.
  await openAddItem(page);
  const badName = `G2a refused ${run}`;
  await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill(badName);
  await fillTag(page, { no: `X-${run}`, gross: '12.900', stone: '0.560', net: '12.000' });
  await page.getByRole('dialog').getByRole('button', { name: 'Save item', exact: true }).click();
  if (process.env.G2A_DEBUG) await page.screenshot({ path: `${dir}/debug-after-save.png` });
  const netBox = page.getByLabel('Net', { exact: true });
  await page.waitForFunction(() => document.querySelector('[id="tag.netG"]')?.getAttribute('aria-invalid') === 'true', null, { timeout: 8000 }).catch(() => undefined);
  if ((await netBox.getAttribute('aria-invalid')) !== 'true') fail('F2', 'a wrong net was not marked under the Net box');
  const left = await get(ctx, `/items?q=${encodeURIComponent(badName)}`);
  if ((left.body?.data ?? []).length) fail('F2', 'a refused tag left the item behind');

  // F1 — fix the net (blank: the server works it out) and save.
  const name = `G2a chain ${run}`;
  await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill(name);
  await netBox.fill('');
  await page.getByRole('dialog').getByRole('button', { name: 'Save item', exact: true }).click();
  await page.getByTestId('item-tag-fields').waitFor({ state: 'detached', timeout: 10000 }).catch(() => undefined);
  const made = await get(ctx, `/items?q=${encodeURIComponent(name)}`);
  itemId = made.body?.data?.[0]?.id ?? null;
  if (!itemId) fail('F1', 'the item was not created');
  else {
    const tags = (await get(ctx, `/items/${itemId}/tags`)).body?.data ?? [];
    const want = skew ? '12.341' : '12.340';
    if (tags.length !== 1 || tags[0].tag_no !== `X-${run}` || tags[0].net_g !== want || tags[0].huid !== '7K2P9X') {
      fail('F1', `API has ${JSON.stringify(tags.map((r) => [r.tag_no, r.net_g, r.huid]))}, want X-${run} ${want} 7K2P9X`);
    }
    notes.push(`F1 item ${itemId}: ${JSON.stringify(tags.map((r) => [r.tag_no, r.net_g, r.purity, r.status]))}`);

    // F3 — the tab, Add tag, and the count.
    await page.goto(`${base}/items/${itemId}`);
    await page.getByTestId('item-tags').waitFor({ timeout: 15000 });
    await page.getByText(`X-${run}`).first().waitFor({ timeout: 8000 }).catch(() => undefined);
    if (!(await page.getByText(`X-${run}`).count())) fail('F3', 'the Weight and rate tab does not list the tag');
    await page.getByTestId('tag-add').click();
    await page.getByLabel('Tag no.').waitFor({ timeout: 10000 });
    await fillTag(page, { no: `Y-${run}`, gross: '10.100', stone: '0.080' });
    await page.getByTestId('tag-add-save').click();
    await page.getByText(`Y-${run}`).first().waitFor({ timeout: 8000 }).catch(() => undefined);
    if (!(await page.getByText(`Y-${run}`).count())) fail('F3', 'the added tag is not listed without a reload');
    const after = (await get(ctx, `/items/${itemId}/tags`)).body?.data ?? [];
    if (after.length !== 2) fail('F3', `API has ${after.length} tags, want 2`);
    const summary = (await get(ctx, '/jewel-tags/summary')).body?.data?.in_stock;
    await page.goto(`${base}/items`);
    const line = await page.getByTestId('tags-in-stock').innerText({ timeout: 10000 }).catch(() => '');
    if (!line.includes(String(summary))) fail('F3', `"${line}" does not say the API's ${summary}`);
    notes.push(`F3 tags ${after.length}, in stock ${summary}, list says "${line}"`);
  }
  await ctx.close();
}

// ── K: a kirana never sees tags ──────────────────────────────────────────────
{
  const { ctx, page } = await open(kirana, { width: 1280 });
  if ((await get(ctx, '/jewel-tags/summary')).status !== 404) fail('K', 'kirana tag API is not 404');
  await openAddItem(page);
  if (await page.getByTestId('item-tag-fields').count()) fail('K', 'kirana Add item shows Tag details');
  await ctx.close();
}

// ── L: looks ─────────────────────────────────────────────────────────────────
const measure = () => {
  const out = { overflow: document.documentElement.scrollWidth - window.innerWidth, cut: [] };
  for (const el of document.querySelectorAll('[role=dialog] span, [role=dialog] label, [role=dialog] p, [role=dialog] button, main td, main th')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || el.closest('.sr-only') || getComputedStyle(el).clip === 'rect(0px, 0px, 0px, 0px)') continue;
    if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') out.cut.push(el.textContent.trim().slice(0, 30));
  }
  for (const el of document.querySelectorAll('[role=dialog] input')) {
    if (el.value && el.scrollWidth > el.clientWidth + 1) out.cut.push(`input ${el.id}`);
  }
  out.theme = document.documentElement.getAttribute('data-theme');
  return out;
};
for (const width of widths) {
  for (const theme of ['light', 'dark']) {
    for (const locale of ['en', 'hi']) {
      const key = `L ${width} ${theme} ${locale}`;
      const { ctx, page } = await open(owner, { width, theme, locale });
      try {
        await page.goto(`${base}/items`);
        await page.getByRole('button', { name: locale === 'hi' ? /आइटम जोड़ें|Add item/ : /^Add item/ }).first().click();
        await page.getByTestId('item-tag-fields').waitFor({ timeout: 15000 });
        await page.getByTestId('item-tag-fields').scrollIntoViewIfNeeded();
        await page.getByLabel(locale === 'hi' ? 'टैग नंबर' : 'Tag no.').fill('GC-1042');
        await page.getByLabel(locale === 'hi' ? 'कुल वज़न' : 'Gross').fill('12.900');
        await page.waitForTimeout(300);
        let m = await page.evaluate(measure);
        if (m.theme !== theme) fail(key, `page painted ${m.theme}`);
        if (m.overflow > 0) fail(key, `form: page ${m.overflow}px wider than the screen`);
        if (m.cut.length) fail(key, `form: text cut ${m.cut.slice(0, 4).join(' | ')}`);
        await page.screenshot({ path: `${dir}/${tag}-${width}-${theme}-${locale}-form.png` });
        if (itemId) {
          await page.goto(`${base}/items/${itemId}`);
          await page.getByTestId('item-tags').waitFor({ timeout: 15000 });
          await page.waitForTimeout(800);
          m = await page.evaluate(measure);
          if (m.overflow > 0) fail(key, `tab: page ${m.overflow}px wider than the screen`);
          if (m.cut.length) fail(key, `tab: text cut ${m.cut.slice(0, 4).join(' | ')}`);
          await page.getByTestId('item-tags').scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${dir}/${tag}-${width}-${theme}-${locale}-tab.png` });
        }
      } catch (e) {
        fail(key, `error ${e.message.split('\n')[0]}`);
      }
      await ctx.close();
    }
  }
}

await browser.close();
console.log(notes.join('\n'));
console.log(failures.join('\n'));
console.log(`${failures.length} failures, ${consoleErrors} console errors${skew ? ' (SKEWED: failures expected)' : ''}`);
process.exit(skew ? (failures.length ? 0 : 1) : failures.length || consoleErrors ? 1 : 0);
