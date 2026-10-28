/**
 * Revamp 09 §10.7 — the Shop's Old dues on the LOCAL QA stack.
 *
 *   NODE_PATH=$(npm root -g) node e2e/old-dues.mjs [--shots=/tmp/e2e-shots/old-dues]
 *
 *  * at 320, 360, 390, 1024 and 1280 in English and Hindi, for customers and
 *    suppliers: no sideways scroll, no text cut, no figure broken across lines;
 *  * the tabs say "Customers owe you" / "You owe suppliers" with the server's
 *    total, and the age bars carry the server's four buckets;
 *  * on a phone: one card per server row, each 44 px or more, its total the
 *    server's, the oldest bucket in words; no table;
 *  * from 1024: the table with a ⋯ per row, no cards;
 *  * a card opens the sheet with every bucket; to collect it offers Remind and
 *    Receive payment, to pay it offers Pay; Receive opens the payment form with
 *    the optional Note; Remind opens the reminder sheet; nothing is saved.
 * Read-only: it writes nothing.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_FRONTEND ?? (process.env.E2E_BASE ?? 'http://localhost:3000');
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const SHOTS = arg('shots', '');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const inr = (v) => Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const measure = () => {
  const cut = [];
  for (const el of document.querySelectorAll('main *')) {
    if (el.children.length || !el.textContent?.trim()) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1) continue;
    const s = getComputedStyle(el);
    if (el.closest('[data-testid="ub-grid-table-scroller"]')) {
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && s.overflow !== 'visible')
        cut.push(el.textContent.trim().slice(0, 30));
      continue;
    }
    const clamped = s.webkitLineClamp && s.webkitLineClamp !== 'none';
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && s.overflow !== 'visible')
      cut.push(el.textContent.trim().slice(0, 30));
    if (clamped && el.scrollHeight > el.clientHeight + 1) cut.push(`clamped:${el.textContent.trim().slice(0, 30)}`);
    if (r.right > innerWidth + 1) cut.push(`offscreen:${el.textContent.trim().slice(0, 30)}`);
  }
  const broken = [];
  for (const el of document.querySelectorAll('[data-testid="aging-row"] span, [role="tab"] span')) {
    if (el.children.length) continue;
    for (const m of el.textContent.matchAll(/[-‑]?₹[\d,.]+/g)) {
      const node = el.firstChild;
      if (!node || node.nodeType !== 3) continue;
      const range = document.createRange();
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      if (range.getClientRects().length > 1) broken.push(m[0]);
    }
  }
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    cut: [...new Set(cut)],
    broken,
    tab: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent ?? '',
    bars: document.querySelector('[data-testid="aging-bars"]')?.textContent ?? null,
    cards: [...document.querySelectorAll('[data-testid="aging-row"]')].map((c) => ({
      h: Math.round(c.getBoundingClientRect().height),
      label: c.getAttribute('aria-label'),
    })),
    table: Boolean(document.querySelector('[data-testid="ub-grid-table"]')),
    more: document.querySelectorAll('[data-testid="aging-row-actions"]').length,
  };
};

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));

  const served = (type) =>
    page.evaluate(async (k) => {
      const r = await fetch(`/api/v1/ledger/aging?book=shop&type=${k}`);
      return r.json();
    }, type);
  const data = { receivable: await served('receivable'), payable: await served('payable') };
  for (const kind of ['receivable', 'payable'])
    check(`the QA Shop book has ${kind} dues`, data[kind].data.length > 0, `${data[kind].meta?.total ?? data[kind].data.length} contacts`);

  for (const locale of ['en', 'hi']) {
    await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
    for (const width of [320, 360, 390, 1024, 1280]) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 780 });
      for (const kind of ['receivable', 'payable']) {
        await page.goto(`${base}/reports/aging${kind === 'payable' ? '?type=payable' : ''}`, { waitUntil: 'networkidle' });
        await page.getByTestId('aging-bars').waitFor();
        const tag = `${width} ${locale} ${kind}`;
        const m = await page.evaluate(measure);
        const served = data[kind];
        check(`${tag}: no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
        check(`${tag}: no text cut`, m.cut.length === 0, m.cut.join(' | '));
        check(`${tag}: no figure broken across lines`, m.broken.length === 0, m.broken.join(' | '));
        if (locale === 'en' && (width === 390 || width === 1280)) {
          const word = kind === 'payable' ? 'To pay suppliers' : 'To collect from customers';
          check(`${tag}: the tab says "${word}" with the server's total`, m.tab.includes(word) && m.tab.includes(inr(served.meta.totals.total)), m.tab);
          const t = served.meta.totals;
          check(`${tag}: the bars carry the server's buckets`, ['0_30', '31_60', '61_90', '90_plus'].every((b) => m.bars?.includes(inr(t[b]))), m.bars?.slice(0, 120));
        }
        if (width < 1024) {
          check(`${tag}: cards, no table`, m.cards.length > 0 && !m.table, `${m.cards.length} cards`);
          check(`${tag}: every card is a 44 px target`, m.cards.every((c) => c.h >= 44), JSON.stringify([...new Set(m.cards.map((c) => c.h))]));
          if (locale === 'en' && width === 390) {
            check(`${tag}: one card per server row`, m.cards.length === served.data.length, `${m.cards.length} vs ${served.data.length}`);
            const dueWord = kind === 'payable' ? 'You will give' : 'You will get';
            const wrong = served.data.filter((r, i) => !(m.cards[i]?.label ?? '').includes(`${dueWord} ₹${inr(r.total)}`) || !(m.cards[i]?.label ?? '').includes(r.party.name));
            check(`${tag}: every card's name and total are the server's`, wrong.length === 0, wrong.slice(0, 3).map((r) => r.party.name).join(', '));
          }
        } else {
          check(`${tag}: the table with a ⋯ per row, no cards`, m.table && m.cards.length === 0 && m.more === served.data.length, `table=${m.table} cards=${m.cards.length} more=${m.more}`);
        }
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${kind}-${width}-${locale}.png`, fullPage: true });
      }
    }
  }

  // The sheet and its actions, on a phone.
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);
  await page.setViewportSize({ width: 390, height: 780 });
  for (const kind of ['receivable', 'payable']) {
    const first = data[kind].data[0];
    await page.goto(`${base}/reports/aging${kind === 'payable' ? '?type=payable' : ''}`, { waitUntil: 'networkidle' });
    await page.getByTestId('aging-row').first().click();
    const sheet = page.getByTestId('aging-row-sheet');
    await sheet.waitFor();
    const text = await sheet.innerText();
    check(`${kind}: the sheet carries every bucket and the total`, ['0_30', '31_60', '61_90', '90_plus', 'total'].every((b) => text.includes(inr(first[b]))), text.replace(/\n/g, ' ').slice(0, 160));
    const has = async (id) => (await page.getByTestId(id).count()) > 0;
    if (kind === 'receivable') {
      check('to collect: Remind and Receive payment, no Pay', (await has('aging-action-remind')) && (await has('aging-action-receive')) && !(await has('aging-action-pay')));
    } else {
      check('to pay: Pay, no Remind or Receive', (await has('aging-action-pay')) && !(await has('aging-action-remind')) && !(await has('aging-action-receive')));
    }
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/sheet-${kind}-390.png` });
    await page.getByTestId(kind === 'receivable' ? 'aging-action-receive' : 'aging-action-pay').click();
    const form = page.getByRole('dialog');
    await page.getByText(/More details/).first().waitFor({ timeout: 15000 }).catch(() => undefined);
    const formText = await form.last().innerText().catch(() => '');
    check(`${kind}: the payment form opens for ${first.party.name} with the optional Note`, formText.includes(first.party.name) && /note/i.test(formText), formText.replace(/\n/g, ' ').slice(0, 160));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/payment-${kind}-390.png` });
    await page.keyboard.press('Escape');
  }

  const first = data.receivable.data[0];
  await page.goto(`${base}/reports/aging`, { waitUntil: 'networkidle' });
  await page.getByTestId('aging-row').first().click();
  await page.getByTestId('aging-action-remind').click();
  const remind = page.getByRole('dialog').filter({ hasText: first.party.name });
  await remind.first().waitFor({ timeout: 15000 }).catch(() => undefined);
  check('Remind opens the Shop reminder sheet for that customer', (await remind.count()) > 0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/remind-390.png` });
} catch (error) {
  check('harness ran to the end', false, error.message);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
