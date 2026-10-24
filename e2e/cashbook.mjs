/**
 * Revamp 08 §11 — the Shop's Cash book on the LOCAL QA stack, through the
 * real API.
 *
 *   NODE_PATH=$(npm root -g) node e2e/cashbook.mjs [--shots=/tmp/e2e-shots/cashbook]
 *
 *  * the four figures on screen are the server's for the period and the
 *    bucket chosen (Cash · Bank · Both), and every request is the Shop's;
 *  * LOOKs at 390, 320, 1024 and 1280 in English and Hindi, today and this
 *    month: no sideways scroll, every text node inside its box, receipt
 *    numbers and signed amounts never split, chips with a 32 px face and a 44 px target on a
 *    phone, the figures 2 × 2 on a phone and one line of four from 1024, the
 *    close-the-day panel beside the days on a desktop;
 *  * Close the day: a short count offers "Add the missing expense" filled with
 *    the shortfall in cash, which is dropped if the drawer is closed unsaved;
 *    a count with ₹1 extra offers "Receive a payment you forgot" filled with
 *    ₹1 in cash; recording it moves the expected cash by exactly ₹1 and the
 *    same count then reads "Matches";
 *  * a payment row opens its receipt and an expense row its detail sheet.
 *
 * Local QA tenant only. The one receipt it records is ₹1 with the note
 * "QA92" and is cancelled before the end, so the book is as it was.
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

/** Text cut or split, chips' faces and targets, and the figures' layout. */
const measure = () => {
  const cut = [];
  for (const el of document.querySelectorAll('main *')) {
    if (el.children.length || !el.textContent?.trim()) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1) continue;
    if (el.closest('input, [role=combobox], .sr-only, [role=dialog]')) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && s.overflow !== 'visible')
      cut.push(el.textContent.trim().slice(0, 30));
    if (r.right > innerWidth + 1) cut.push(`offscreen:${el.textContent.trim().slice(0, 30)}`);
    const range = document.createRange();
    range.selectNodeContents(el);
    const text = range.getBoundingClientRect();
    let clip = el.parentElement;
    while (clip && getComputedStyle(clip).overflowX === 'visible') clip = clip.parentElement;
    const box = clip?.getBoundingClientRect();
    if (box && box.width < innerWidth && text.right > box.right + 1)
      cut.push(`clipped:${el.textContent.trim().slice(0, 30)}`);
    for (const word of el.textContent.trim().split(/\s+/).filter((w) => /^[A-Z]+\/\d|^[-\u2011]?₹\d/.test(w))) {
      /* React may render "Opening: " and the figure as two text nodes. */
      const node = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.includes(word));
      if (!node) continue;
      const at = node.textContent.indexOf(word);
      const piece = document.createRange();
      piece.setStart(node, at);
      piece.setEnd(node, at + word.length);
      if (new Set([...piece.getClientRects()].map((q) => Math.round(q.top))).size > 1) cut.push(`split:${word}`);
    }
  }
  const chips = [...document.querySelectorAll('main [role="radiogroup"] button[role="radio"]')].map((b) => {
    const q = b.getBoundingClientRect();
    const hit =
      innerWidth >= 640 ||
      [q.y + q.height / 2 - 21, q.y + q.height / 2 + 21].every((y) =>
        b.contains(document.elementFromPoint(q.x + q.width / 2, y))
      );
    return { face: Math.round(q.height), hit };
  });
  const cells = [...document.querySelectorAll('[data-testid="cashbook-figures"] > *')].map((c) =>
    Math.round(c.getBoundingClientRect().top)
  );
  const panel = document.querySelector('[data-testid="close-the-day"]')?.getBoundingClientRect();
  const days = document.querySelector('[data-testid="cashbook-day-rows"]')?.closest('section, div')?.getBoundingClientRect();
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    cut: [...new Set(cut)],
    chips,
    figureRows: new Set(cells).size,
    figureCells: cells.length,
    panelBeside: panel && days ? panel.left > days.right - 1 : null,
  };
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
});
const recorded = new Set();
let ctx;
let send;
try {
  ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  const api = `${base}/api/v1`;
  const getJson = async (path) => (await ctx.request.get(`${api}${path}`)).json();
  const csrf = (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value;
  send = async (path, data) => {
    const r = await ctx.request.post(`${api}${path}`, {
      headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() },
      data,
    });
    if (!r.ok()) throw Error(`POST ${path} ${r.status()}: ${await r.text()}`);
    return (await r.json()).data;
  };
  const shot = async (name) => {
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  };

  const asked = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname === '/api/v1/cashbook') asked.push(u.search);
  });
  const open = async (query) => {
    await page.goto(`${base}/cashbook?${query}`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('cashbook-figures').waitFor({ timeout: 30000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
  };
  const figure = async (key) => (await page.getByTestId(`cashbook-figure-${key}`).innerText()).replace(/[₹,\s]/g, '');
  const inr = (v) => Number(v).toFixed(2);

  /* ---------- the figures are the server's ---------- */
  await page.setViewportSize({ width: 390, height: 844 });
  await open('period=thisMonth');
  const first = asked.at(-1) ?? '';
  const month = (await getJson(`/cashbook${first}`)).data;
  for (const key of ['opening', 'in', 'out', 'closing'])
    check(`this month, Both: ${key} is the server's total`, (await figure(key)) === inr(month.range[key].total), `${await figure(key)} vs ${month.range[key].total}`);
  await page.getByRole('radio', { name: 'Cash' }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  const cashAsk = asked.at(-1) ?? '';
  check('Cash asks the server for the cash bucket', cashAsk.includes('bucket=cash'), cashAsk);
  const cash = (await getJson(`/cashbook${cashAsk}`)).data;
  for (const key of ['opening', 'closing'])
    check(`this month, Cash: ${key} is the server's cash figure`, (await figure(key)) === inr(cash.range[key].cash), `${await figure(key)} vs ${cash.range[key].cash}`);
  check('the bucket is in the address bar', page.url().includes('bucket=cash'), page.url());

  /* ---------- LOOK ---------- */
  for (const locale of ['en', 'hi']) {
    await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
    for (const width of [390, 320, 1024, 1280]) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 780 });
      for (const period of ['today', 'thisMonth']) {
        await open(`period=${period}`);
        const tag = `${period} ${width} ${locale}`;
        const m = await page.evaluate(measure);
        check(`${tag}: no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
        check(`${tag}: no text cut or split`, m.cut.length === 0, m.cut.join(' | '));
        check(`${tag}: four figures, ${width >= 1024 ? 'one line' : '2 × 2'}`, m.figureCells === 4 && m.figureRows === (width >= 1024 ? 1 : 2), `${m.figureCells} in ${m.figureRows} rows`);
        if (width < 640)
          check(`${tag}: chips 32 px with 44 px targets`, m.chips.length === 3 && m.chips.every((c) => c.face === 32 && c.hit), JSON.stringify(m.chips));
        if (period === 'today' && width >= 1024)
          check(`${tag}: close the day sits beside the days`, m.panelBeside === true, String(m.panelBeside));
        if (locale === 'hi' && period === 'thisMonth') {
          const head = await page.locator('button[aria-expanded]').filter({ hasText: /^\d\d\/\d\d\/\d{4} · / }).first().innerText();
          check(`${tag}: the weekday is in Hindi`, !/· (Mon|Tue|Wed|Thu|Fri|Sat|Sun) /.test(head), head.slice(0, 30));
        }
        await shot(`${period}-${width}-${locale}`);
      }
    }
  }
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);
  check('every request is the Shop cash book endpoint, no other app', asked.length > 0);

  /* ---------- close the day ---------- */
  await page.setViewportSize({ width: 390, height: 844 });
  await open('period=today');
  const panel = page.getByTestId('close-the-day');
  const expectedNow = async () => Number((await getJson('/cashbook?' + new URLSearchParams({ date_from: month.range.date_to, date_to: month.range.date_to, bucket: 'all' }))).data.range.closing.cash);
  const expected = await expectedNow();
  const count = page.getByLabel('Count the cash in your drawer');
  await count.fill((expected - 120).toFixed(2));
  check('a short drawer says "Short by ₹120.00"', (await panel.innerText()).includes('Short by ₹120.00'), await panel.innerText());
  check('no "Receive a payment" for a short drawer', (await panel.getByRole('button', { name: 'Receive a payment you forgot' }).count()) === 0);
  await panel.getByRole('button', { name: 'Add the missing expense' }).click();
  const drawer = page.getByRole('dialog').last();
  await drawer.locator('input[name="amount"]').waitFor();
  check('the missing expense opens with ₹120.00', (await drawer.locator('input[name="amount"]').inputValue()).replace(/,/g, '') === '120.00', await drawer.locator('input[name="amount"]').inputValue());
  check('… paid in cash', (await drawer.getByRole('radio', { name: 'Cash' }).getAttribute('aria-checked')) === 'true');
  await shot('close-short-drawer');
  await page.keyboard.press('Escape');
  const leave = page.getByRole('dialog', { name: /Leave without saving\?/ });
  if (await leave.isVisible().catch(() => false)) await leave.getByRole('button', { name: /Discard/ }).first().click();
  await drawer.waitFor({ state: 'hidden' });
  await page.locator('main header').getByRole('button', { name: 'Add expense' }).click();
  await drawer.locator('input[name="amount"]').waitFor();
  check('closed unsaved, the next Add expense opens empty', (await drawer.locator('input[name="amount"]').inputValue()) === '');
  await page.keyboard.press('Escape');
  await drawer.waitFor({ state: 'hidden' });

  await count.fill((expected + 1).toFixed(2));
  check('₹1 extra says "Extra ₹1.00"', (await panel.innerText()).includes('Extra ₹1.00'), await panel.innerText());
  let customer = null;
  for (const party of (await getJson('/parties?type=customer&page_size=10&book=shop')).data) {
    if (party.name) { customer = party; break; }
  }
  await panel.getByRole('button', { name: 'Receive a payment you forgot' }).click();
  await drawer.locator('input[name="lines.0.amount"]').waitFor();
  check('the forgotten payment opens with ₹1.00', (await drawer.locator('input[name="lines.0.amount"]').inputValue()).replace(/,/g, '') === '1.00');
  const picker = drawer.getByRole('combobox').first();
  await picker.click();
  await picker.fill(customer.name);
  await page.getByRole('option', { name: new RegExp(customer.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click();
  await page.waitForLoadState('networkidle');
  await shot('close-extra-drawer');
  const more = drawer.getByRole('button', { name: /More details/ });
  if (await more.isVisible().catch(() => false)) {
    await more.click();
    await drawer.locator('input[name="note"]').fill('QA92 cash book');
  }
  await drawer.getByTestId('payment-save').click();
  const saved = drawer.getByTestId('payment-saved');
  await saved.waitFor({ timeout: 15000 });
  const number = (await saved.innerText()).match(/RCT\/[\w/-]+/)?.[0];
  const mine = (await getJson(`/payments?bucket=shop&q=${encodeURIComponent(number ?? '')}&page_size=5`)).data.find((r) => r.number === number);
  if (mine) recorded.add(mine.id);
  check('a ₹1 cash receipt was recorded', Boolean(mine) && Number(mine.amount) === 1, number ?? 'none');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => undefined);
  const after = await expectedNow();
  check('the server moved the expected cash by exactly ₹1', Math.abs(after - (expected + 1)) < 0.001, `${expected} → ${after}`);
  await page.waitForFunction((a) => document.querySelector('[data-testid="close-the-day"]')?.textContent?.includes(a), `₹${after.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, { timeout: 10000 }).catch(() => undefined);
  const panelText = await panel.innerText();
  check('the screen re-read it: the same count now "Matches"', panelText.includes('Matches'), panelText);
  await shot('close-matches');

  /* ---------- rows open ---------- */
  await page.setViewportSize({ width: 1280, height: 900 });
  await open('period=thisMonth&bucket=all');
  const payRow = page.getByRole('button', { name: /^Open (Received from|Paid to) / }).first();
  await payRow.click();
  await page.waitForURL(/\/payments\/[0-9a-f-]+$/, { timeout: 15000 });
  check('a payment row opens its receipt', /\/payments\/[0-9a-f-]+$/.test(page.url()), page.url());
  await page.goBack();
  await page.getByTestId('cashbook-figures').waitFor();
  /* Open closed days until one shows an expense row (the day headers, not
     the period button, which is also a collapsed control). */
  const days = page.locator('button[aria-expanded="false"]').filter({ hasText: /^\d\d\/\d\d\/\d{4} · / });
  for (let i = 0; i < 8 && !(await page.getByRole('button', { name: /^Open (?!Received|Paid)/ }).count()); i += 1) {
    await days.first().click();
    await page.waitForTimeout(250);
  }
  const expRow = page.getByRole('button', { name: /^Open (?!Received|Paid)/ }).first();
  await expRow.click();
  const sheet = page.getByRole('dialog').last();
  await sheet.waitFor();
  check('an expense row opens its detail sheet', /EXP\//.test(await sheet.innerText()), (await sheet.innerText()).slice(0, 80));
  await shot('expense-sheet-1280');
} catch (error) {
  check('harness ran to the end', false, error.message);
} finally {
  for (const id of recorded)
    await send?.(`/payments/${id}/void`, { reason: 'QA92 harness clean-up' }).catch((e) => console.log(`void ${id}: ${e.message}`));
  await ctx?.close();
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
