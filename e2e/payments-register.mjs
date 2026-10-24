/**
 * Revamp 08 §9 — the Shop's Payments register on the LOCAL QA stack, through
 * the real API.
 *
 *   NODE_PATH=$(npm root -g) node e2e/payments-register.mjs [--shots=/tmp/e2e-shots/payments]
 *
 *  * every list request the page sends asks for the Shop's bucket (C-3), and
 *    the figures on screen are the server's Shop totals for the period;
 *  * LOOKs at 390, 320, 1024 and 1280 in English and Hindi: no sideways
 *    scroll, every text node inside its box, the page itself does not scroll
 *    (only the rows do), chips with a 32 px face and a 44 px target on a phone,
 *    no pager on a phone and a pager on a desktop, the six columns at 1280
 *    and the date joined under the number at 1024;
 *  * a phone joins the next page under its cards when the list is scrolled;
 *  * Cancelled asks the server for cancelled payments and every card says so;
 *  * a receipt number typed in the search finds that receipt;
 *  * a card opens its receipt; Receive payment opens the drawer.
 *
 * Local QA tenant only. It records one ₹1 receipt to a QA customer and
 * cancels it, because the QA book has no cancelled payment to read.
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

const measure = () => {
  const cut = [];
  for (const el of document.querySelectorAll('main *')) {
    if (el.children.length || !el.textContent?.trim()) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.bottom < 0 || r.top > innerHeight) continue;
    if (el.closest('input, [role=combobox], .sr-only')) continue;
    /* A chip row scrolls sideways at 320 px by design (08 §9); a chip past
       its edge is reachable, not cut. */
    if (el.closest('[role=radiogroup]') && getComputedStyle(el.closest('[role=radiogroup]')).overflowX === 'auto') continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && s.overflow !== 'visible')
      cut.push(el.textContent.trim().slice(0, 30));
    if (r.right > innerWidth + 1) cut.push(`offscreen:${el.textContent.trim().slice(0, 30)}`);
    /* Text past the box that CLIPS it: a table cell hides overflow without an
       ellipsis, which the scrollWidth test above cannot see ("24/10/202"). */
    const range = document.createRange();
    range.selectNodeContents(el);
    const text = range.getBoundingClientRect();
    let clip = el.parentElement;
    while (clip && getComputedStyle(clip).overflowX === 'visible') clip = clip.parentElement;
    const box = clip?.getBoundingClientRect();
    if (box && box.width < innerWidth && text.right > box.right + 1)
      cut.push(`clipped:${el.textContent.trim().slice(0, 30)}`);
    /* A receipt number is one word: split across lines it reads as two. */
    const words = el.textContent.trim().split(/\s+/);
    for (const word of words.filter((w) => /^[A-Z]+\/\d/.test(w))) {
      const at = el.textContent.indexOf(word);
      const piece = document.createRange();
      piece.setStart(el.firstChild, at);
      piece.setEnd(el.firstChild, at + word.length);
      const lines = new Set([...piece.getClientRects()].map((q) => Math.round(q.top)));
      if (lines.size > 1) cut.push(`split:${word}`);
    }
  }
  const chips = [...document.querySelectorAll('main button[role="radio"]')].map((b) => {
    const q = b.getBoundingClientRect();
    const hit =
      innerWidth >= 640 ||
      q.left < 0 ||
      q.right > innerWidth ||
      [q.y + q.height / 2 - 21, q.y + q.height / 2 + 21].every((y) =>
        b.contains(document.elementFromPoint(q.x + q.width / 2, y))
      );
    return { face: Math.round(q.height), hit };
  });
  const region = document.querySelector('[data-testid="ub-grid-scroll-region"]');
  const r = region?.getBoundingClientRect();
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    pageScroll: Math.max(0, document.documentElement.scrollHeight - innerHeight),
    cut: [...new Set(cut)],
    chips,
    regionTop: r ? Math.round(r.top) : null,
    regionHeight: r ? Math.round(r.height) : null,
    pager: Boolean(
      [...document.querySelectorAll('button[aria-label="Next page"], button[aria-label="अगला पेज"]')].find(
        (b) => b.getBoundingClientRect().width > 0
      )
    ),
    headers: [...document.querySelectorAll('main th')].map((th) => th.textContent.trim()).filter(Boolean),
  };
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
  const api = `${base}/api/v1`;
  const getJson = async (path) => (await ctx.request.get(`${api}${path}`)).json();
  const csrf = (await ctx.cookies()).find((c) => c.name === 'ub_csrf')?.value;
  const send = async (path, data) => {
    const r = await ctx.request.post(`${api}${path}`, {
      headers: { 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() },
      data,
    });
    if (!r.ok()) throw Error(`POST ${path} ${r.status()}: ${await r.text()}`);
    return (await r.json()).data;
  };

  const asked = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname === '/api/v1/payments') asked.push(u.searchParams);
  });

  const open = async (query = '') => {
    await page.goto(`${base}/payments${query}`);
    await page.getByTestId('payments-screen').waitFor({ timeout: 20000 });
    await page.getByTestId('ub-grid-card').or(page.locator('main tbody tr')).first().waitFor({ timeout: 20000 });
    await page.waitForLoadState('networkidle');
  };

  /* ---------- LOOK ---------- */
  for (const locale of ['en', 'hi']) {
    await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
    for (const width of [390, 320, 1024, 1280]) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 780 });
      await open();
      await page.waitForTimeout(250);
      const m = await page.evaluate(measure);
      const tag = `${width} ${locale}`;
      check(`${tag}: no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
      check(`${tag}: no text cut`, m.cut.length === 0, m.cut.join(' | '));
      check(`${tag}: the page does not scroll, only the rows`, m.pageScroll <= 1, `${m.pageScroll}px`);
      if (width < 1024) {
        check(
          `${tag}: chips 32 px face, 44 px target`,
          m.chips.length === 4 && m.chips.every((c) => c.face === 32 && c.hit),
          JSON.stringify(m.chips)
        );
        check(`${tag}: no pager on a phone`, !m.pager);
        check(
          `${tag}: cards start in the top half and fill the rest`,
          m.regionTop !== null && m.regionTop < 780 * 0.5 && m.regionHeight > 780 * 0.4,
          `top ${m.regionTop}, height ${m.regionHeight}`
        );
      } else {
        check(`${tag}: a pager on a desktop`, m.pager);
        if (locale === 'en')
          check(
            `${tag}: columns`,
            width === 1280
              ? ['Date', 'Number', 'Contact', 'Mode', 'Status', 'Amount'].every((h) => m.headers.includes(h))
              : !m.headers.includes('Date') && m.headers.includes('Contact'),
            m.headers.join(', ')
          );
      }
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/list-${width}-${locale}.png` });
    }
  }
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);

  /* ---------- the Shop's book, and its totals ---------- */
  check('every list request asks for the Shop bucket', asked.length > 0 && asked.every((q) => q.get('bucket') === 'shop'), `${asked.length} requests`);
  const first = asked[0];
  const shop = await getJson(`/payments?bucket=shop&date_from=${first.get('date_from')}&date_to=${first.get('date_to')}&page_size=1`);
  const all = await getJson(`/payments?date_from=${first.get('date_from')}&date_to=${first.get('date_to')}&page_size=1`);
  check('the period has payments of other apps the page leaves out', all.meta.total > shop.meta.total, `all ${all.meta.total}, shop ${shop.meta.total}`);
  await page.setViewportSize({ width: 1280, height: 900 });
  await open();
  const summary = await page.getByTestId('payment-register-summary').innerText();
  const inr = (v) => Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  check('Received on screen is the Shop total', summary.includes(inr(shop.meta.totals.amount_in)), `${summary.replace(/\s+/g, ' ')} vs ${shop.meta.totals.amount_in}`);
  check('Paid out on screen is the Shop total', summary.includes(inr(shop.meta.totals.amount_out)), shop.meta.totals.amount_out);

  /* ---------- a desktop row opens its receipt ---------- */
  const firstRow = page.locator('main tbody tr').first();
  await firstRow.getByRole('button').or(firstRow.getByRole('link')).first().click();
  await page.waitForURL(/\/payments\/[0-9a-f-]{36}/, { timeout: 15000 });
  check('a table row opens its receipt', /\/payments\/[0-9a-f-]{36}/.test(page.url()), page.url());

  /* ---------- phone: scroll joins the next page ---------- */
  await page.setViewportSize({ width: 390, height: 780 });
  await open();
  const before = await page.getByTestId('ub-grid-card').count();
  const pages = asked.length;
  await page.getByTestId('ub-grid-scroll-region').evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.waitForFunction((n) => document.querySelectorAll('[data-testid="ub-grid-card"]').length > n, before, { timeout: 15000 }).catch(() => undefined);
  const after = await page.getByTestId('ub-grid-card').count();
  check('scrolling the cards joins the next page', after > before, `${before} → ${after}`);
  check('the next page was asked for page 2', asked.slice(pages).some((q) => q.get('page') === '2'));

  /* ---------- Cancelled ---------- */
  /* networkidle can settle before the chip's request is sent; wait for it. */
  const voidAsked = page
    .waitForRequest((r) => new URL(r.url()).searchParams.get('status') === 'void', { timeout: 15000 })
    .catch(() => null);
  await page.getByRole('radio', { name: 'Cancelled' }).click();
  const voidRequest = await voidAsked;
  await page.waitForLoadState('networkidle');
  check('Cancelled asks the server for cancelled Shop payments', new URL(voidRequest?.url() ?? 'http://x/').searchParams.get('bucket') === 'shop', voidRequest?.url() ?? 'no request');
  /* The QA book has no cancelled payment, so make one to read. */
  const customer = (await getJson('/parties?type=customer&page_size=1')).data[0];
  const made = await send('/payments', {
    direction: 'in',
    party_id: customer.id,
    payment_date: first.get('date_to'),
    note: 'QA88 cancelled receipt',
    mode_breakup: [{ mode: 'cash', amount: '1.00' }],
    allocations: [],
  });
  await send(`/payments/${made.id}/void`, { reason: 'QA88 wrong customer' });
  await open('?tab=void');
  const cards = page.getByTestId('ub-grid-card');
  const n = await cards.count();
  check('the cancelled receipt is listed', (await cards.allInnerTexts()).some((x) => x.includes(made.number)), made.number);
  const said = n ? await cards.evaluateAll((els) => els.every((e) => /Cancelled/.test(e.textContent))) : null;
  check('every cancelled card says Cancelled', n === 0 || said === true, `${n} cards`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/cancelled-390.png` });

  /* ---------- search by receipt number ---------- */
  const one = (await getJson(`/payments?bucket=shop&date_from=${first.get('date_from')}&date_to=${first.get('date_to')}&page_size=1`)).data[0];
  await open();
  await page.getByRole('searchbox').fill(one.number);
  await page.waitForFunction((num) => {
    const c = document.querySelectorAll('[data-testid="ub-grid-card"]');
    return c.length >= 1 && [...c].every((e) => e.textContent.includes(num));
  }, one.number, { timeout: 15000 }).catch(() => undefined);
  const found = await page.getByTestId('ub-grid-card').allInnerTexts();
  check('a receipt number finds that receipt', found.length >= 1 && found.every((x) => x.includes(one.number)), `${found.length} cards for ${one.number}`);

  /* ---------- a card opens its receipt ---------- */
  await page.getByTestId('ub-grid-card').first().click();
  await page.waitForURL(new RegExp(`/payments/${one.id}`), { timeout: 15000 }).catch(() => undefined);
  check('a card opens its receipt', page.url().includes(`/payments/${one.id}`), page.url());

  /* ---------- Receive payment ---------- */
  await open();
  await page.getByRole('button', { name: 'Receive payment' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ timeout: 15000 });
  check('Receive payment opens the drawer', await dialog.isVisible());
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/receive-390.png` });
  await page.keyboard.press('Escape');
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
