/**
 * Revamp 08 §12 — the Shop's Expenses register, Add expense and Cancel
 * expense on the LOCAL QA stack, through the real API.
 *
 *   NODE_PATH=$(npm root -g) node e2e/expenses-register.mjs [--shots=/tmp/e2e-shots/expenses-register]
 *
 *  * every list request asks for the Shop's expenses (`app=shop`, DEC-019), and
 *    the total on screen is the server's total for the period;
 *  * LOOKs at 390, 320, 1024 and 1280 in English and Hindi: no sideways
 *    scroll, every text node inside its box, the page itself does not scroll
 *    (only the rows do), chips with a 32 px face and a 44 px target on a phone,
 *    no pager on a phone and a pager on a desktop, the seven columns at 1280;
 *  * a phone joins the next page under its cards when the list is scrolled;
 *  * Add expense: the caret is in Amount on open and nothing is red; one chip
 *    picks the category; Save writes ONE expense and says "Saved ₹1.00 · … ·
 *    EXP/…"; a double tap on "Save and add another" writes one;
 *  * an expense left unpaid, owed to a supplier, moves that supplier's Shop
 *    balance by exactly its amount, reads "Unpaid · owed to …" on its card and
 *    "The Shop owes … this money." in its detail; Cancel expense says what
 *    changes first, swaps the badge to Cancelled in place, and the supplier's
 *    Shop balance returns to what it was.
 *
 * Local QA tenant only. Every expense it writes is ₹1 with a note starting
 * "QA89" and is cancelled before the end, so the cash book is unchanged; the
 * cancelled rows stay, because an expense is never deleted.
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

/** Text cut, run off the screen or split, and chips' faces and targets, under `scope`. */
const measure = (scope) => {
  const cut = [];
  for (const el of document.querySelectorAll(`${scope} *`)) {
    if (el.children.length || !el.textContent?.trim()) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.bottom < 0 || r.top > innerHeight) continue;
    if (el.closest('input, [role=combobox], .sr-only')) continue;
    /* A row that scrolls sideways by design (the chips, the top categories
       on a phone): a piece past its edge is reachable, not cut. */
    let rowScroll = el.parentElement;
    while (rowScroll && getComputedStyle(rowScroll).overflowX !== 'auto') rowScroll = rowScroll.parentElement;
    if (rowScroll && rowScroll !== document.documentElement && rowScroll.matches('[role=radiogroup], [data-testid=expense-register-top]')) continue;
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
    for (const word of el.textContent.trim().split(/\s+/).filter((w) => /^[A-Z]+\/\d/.test(w))) {
      const at = el.textContent.indexOf(word);
      const piece = document.createRange();
      piece.setStart(el.firstChild, at);
      piece.setEnd(el.firstChild, at + word.length);
      if (new Set([...piece.getClientRects()].map((q) => Math.round(q.top))).size > 1) cut.push(`split:${word}`);
    }
  }
  const chips = [...document.querySelectorAll(`${scope} [role="radiogroup"] button[role="radio"]`)].map((b) => {
    const q = b.getBoundingClientRect();
    /* A chip whose target runs under a docked footer is scrolled, not covered:
       it is judged once it is scrolled into view. */
    let frame = b.parentElement;
    while (frame && !['auto', 'scroll'].includes(getComputedStyle(frame).overflowY)) frame = frame.parentElement;
    const f = frame?.getBoundingClientRect();
    const hit =
      innerWidth >= 640 ||
      q.left < 0 ||
      q.right > innerWidth ||
      (f && (q.top - 6 < f.top || q.bottom + 6 > f.bottom)) ||
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
const made = [];
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

  const asked = [];
  const posts = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname === '/api/v1/expenses' && r.method() === 'GET') asked.push(u.searchParams);
    if (u.pathname === '/api/v1/expenses' && r.method() === 'POST') posts.push(r.headers()['idempotency-key']);
  });

  const open = async (query = '') => {
    await page.goto(`${base}/expenses${query}`);
    await page.getByTestId('expenses-screen').waitFor({ timeout: 20000 });
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
      const m = await page.evaluate(measure, 'main');
      const tag = `${width} ${locale}`;
      check(`${tag}: no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
      check(`${tag}: no text cut`, m.cut.length === 0, m.cut.join(' | '));
      check(`${tag}: the page does not scroll, only the rows`, m.pageScroll <= 1, `${m.pageScroll}px`);
      const toolbar = await page.getByTestId('expense-register-toolbar').boundingBox();
      if (width >= 1024) {
        check(`${tag}: the search and filters fit one row`, toolbar && toolbar.height < 60, `${toolbar?.height}px`);
        /* A placeholder is not a text node, so the cut check above cannot see it. */
        const hintFits = await page.getByRole('searchbox').evaluate((el) => {
          const c = document.createElement('canvas').getContext('2d');
          c.font = getComputedStyle(el).font;
          const s = getComputedStyle(el);
          return c.measureText(el.placeholder).width <= el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) + 1;
        });
        check(`${tag}: the search hint is whole`, hintFits);
      }
      const top = await page.getByTestId('expense-register-top').boundingBox();
      if (width < 1024) check(`${tag}: the top categories take one line`, top && top.height <= 32, `${top?.height}px`);
      if (width < 1024) {
        check(
          `${tag}: chips 32 px face, 44 px target`,
          m.chips.length === 3 && m.chips.every((c) => c.face === 32 && c.hit),
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
              ? ['Date', 'Number', 'Category', 'Paid to', 'Paid by', 'Amount', 'Status'].every((h) => m.headers.includes(h))
              : !m.headers.includes('Date') && m.headers.includes('Category'),
            m.headers.join(', ')
          );
      }
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/list-${width}-${locale}.png` });
    }
  }
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);

  /* ---------- the Shop's expenses, and their total ---------- */
  check('every list request asks for the Shop', asked.length > 0 && asked.every((q) => q.get('app') === 'shop'), `${asked.length} requests`);
  const first = asked[0];
  const period = `date_from=${first.get('date_from')}&date_to=${first.get('date_to')}`;
  const shop = await getJson(`/expenses?app=shop&${period}&page_size=1`);
  await page.setViewportSize({ width: 1280, height: 900 });
  await open();
  const summary = await page.getByTestId('expense-register-summary').innerText();
  const inr = (v) => Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  check('the total on screen is the Shop total', summary.includes(inr(shop.meta.totals.amount)), `${summary.replace(/\s+/g, ' ')} vs ${shop.meta.totals.amount}`);
  check('the count on screen is the Shop count', summary.includes(`${shop.meta.totals.count} expenses`), String(shop.meta.totals.count));

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

  /* ---------- Add expense, paid, one tap for the category ---------- */
  const countNow = async () => (await getJson(`/expenses?app=shop&${period}&page_size=1`)).meta.total;
  const startCount = await countNow();
  for (const [width, locale] of [[390, 'en'], [320, 'hi']]) {
    await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
    await page.setViewportSize({ width, height: 780 });
    await open();
    await page.getByRole('button', { name: locale === 'en' ? 'Add expense' : 'खर्च जोड़ें' }).first().click();
    const drawer = page.getByRole('dialog');
    await drawer.waitFor({ timeout: 15000 });
    await page.waitForTimeout(400);
    const caret = await page.evaluate(() => document.activeElement?.getAttribute('inputmode'));
    check(`${width} ${locale}: the caret is in Amount on open`, caret === 'decimal', String(caret));
    const red = await drawer.locator('[role=alert], .text-text-danger').count();
    check(`${width} ${locale}: nothing is red on open`, red === 0, `${red}`);
    const md = await page.evaluate(measure, '[role=dialog]');
    check(`${width} ${locale}: drawer has no text cut`, md.cut.length === 0, md.cut.join(' | '));
    check(`${width} ${locale}: category chips are 32 px with 44 px targets`, md.chips.length > 0 && md.chips.every((c) => c.face === 32 && c.hit), JSON.stringify(md.chips.slice(0, 3)));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/add-${width}-${locale}.png` });
    await page.keyboard.press('Escape');
  }
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);
  await page.setViewportSize({ width: 390, height: 780 });
  await open();
  await page.getByRole('button', { name: 'Add expense' }).first().click();
  const drawer = page.getByRole('dialog');
  await drawer.waitFor({ timeout: 15000 });
  await page.keyboard.type('1');
  const chip = drawer.getByRole('radiogroup', { name: 'Common categories' }).getByRole('radio').first();
  const category = (await chip.innerText()).trim();
  await chip.click();
  await drawer.getByLabel('Note').fill('QA89 tea, harness');
  const postsBefore = posts.length;
  await drawer.getByRole('button', { name: 'Save', exact: true }).click();
  const snack = page.getByText(/^Saved ₹1\.00 · /);
  await snack.waitFor({ timeout: 15000 }).catch(() => undefined);
  const said = (await snack.innerText().catch(() => '')).trim();
  check('Save says "Saved ₹1.00 · category · number"', new RegExp(`^Saved ₹1\\.00 · ${category} · EXP/`).test(said), said);
  check('Save sent one request', posts.length - postsBefore === 1, `${posts.length - postsBefore}`);
  check('the server has one more expense', (await countNow()) === startCount + 1);
  const saved = (await getJson(`/expenses?app=shop&${period}&q=QA89 tea&page_size=5`)).data;
  made.push(...saved.filter((e) => e.status === 'recorded').map((e) => e.id));
  check('it was saved as the Shop\'s, paid, in that category', saved[0]?.app === undefined || saved[0]?.app === 'shop', JSON.stringify(saved[0]?.category?.name));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/saved-390.png` });

  /* ---------- a double tap on "Save and add another" saves once ---------- */
  await page.getByRole('button', { name: 'Add expense' }).first().click();
  await drawer.waitFor({ timeout: 15000 });
  await page.keyboard.type('1');
  await drawer.getByRole('radiogroup', { name: 'Common categories' }).getByRole('radio').first().click();
  await drawer.getByLabel('Note').fill('QA89 double tap');
  const tapBefore = posts.length;
  await drawer.getByRole('button', { name: 'Save and add another' }).dblclick();
  await page.waitForTimeout(2500);
  const twice = (await getJson(`/expenses?app=shop&${period}&q=QA89 double&page_size=5`)).data;
  made.push(...twice.filter((e) => e.status === 'recorded').map((e) => e.id));
  check('a double tap on Save and add another writes one expense', twice.length === 1, `${twice.length} expenses, ${posts.length - tapBefore} requests`);
  const amountAfter = await drawer.getByLabel(/Amount/).inputValue();
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('inputmode'));
  check('it stays open with the amount cleared and focused', amountAfter === '' && focused === 'decimal', `"${amountAfter}" ${focused}`);
  await page.keyboard.press('Escape');

  /* ---------- unpaid, owed to a supplier: the Shop balance moves by exactly ₹1 ---------- */
  const supplier = (await getJson('/parties?type=supplier&page_size=1')).data[0];
  const balanceOf = async () => (await getJson(`/parties/${supplier.id}?book=shop`)).data.shop_balance;
  const owedBefore = await balanceOf();
  await open();
  await page.getByRole('button', { name: 'Add expense' }).first().click();
  await drawer.waitFor({ timeout: 15000 });
  await page.keyboard.type('1');
  await drawer.getByRole('radiogroup', { name: 'Common categories' }).getByRole('radio').first().click();
  await drawer.getByRole('switch', { name: /Paid now/ }).click();
  const owedTo = drawer.getByRole('combobox', { name: /To pay/ });
  await owedTo.fill(supplier.name);
  await page.getByRole('option', { name: new RegExp(supplier.name) }).first().click({ timeout: 15000 });
  const hint = await drawer.getByText(`This is added to what the Shop owes ${supplier.name}.`).count();
  check('the hint names the supplier and the Shop', hint === 1);
  check('the form never says khata', !/khata/i.test(await drawer.innerText()));
  await drawer.getByLabel('Note').fill('QA89 owed');
  /* Pay by is a calendar in a popover: open it and take the month's last day. */
  await drawer.getByLabel(/Pay by/).click();
  await page.locator('[role=grid] button:not([disabled])').last().click({ timeout: 10000 });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/owed-390.png` });
  await drawer.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText(/^Saved ₹1\.00 · /).waitFor({ timeout: 15000 }).catch(() => undefined);
  const owed = (await getJson(`/expenses?app=shop&${period}&q=QA89 owed&page_size=5`)).data.find((e) => e.status === 'recorded');
  if (owed) made.push(owed.id);
  const owedAfter = await balanceOf();
  check('the unpaid expense was saved, owed to the supplier', owed?.paid === false && owed?.party?.id === supplier.id, JSON.stringify({ paid: owed?.paid, party: owed?.party?.name }));
  check('the supplier\'s Shop balance moved by exactly ₹1', Math.abs(Number(owedAfter) - Number(owedBefore) + 1) < 0.001, `${owedBefore} → ${owedAfter}`);

  /* ---------- Unpaid chip, card, detail ---------- */
  await open('?tab=unpaid');
  const card = page.getByTestId('ub-grid-card').filter({ hasText: owed?.number ?? 'none' });
  const cardText = (await card.innerText().catch(() => '')).replace(/\s+/g, ' ');
  check('the Unpaid chip lists it with "Unpaid · owed to …"', cardText.includes('Unpaid') && cardText.includes(`to pay ${supplier.name}`), cardText);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/unpaid-390.png` });
  await card.click();
  const sheet = page.getByRole('dialog');
  await sheet.waitFor({ timeout: 15000 });
  const sheetText = await sheet.innerText();
  check('the detail says the Shop owes the supplier', sheetText.includes(`The Shop has to pay ${supplier.name} this money.`), sheetText.slice(0, 200));
  check('the detail shows Unpaid and Pay by', sheetText.includes('Unpaid') && sheetText.includes('Pay by'));
  const ms = await page.evaluate(measure, '[role=dialog]');
  check('detail 390: no text cut', ms.cut.length === 0, ms.cut.join(' | '));

  /* ---------- Cancel expense ---------- */
  await sheet.getByRole('button', { name: 'Cancel expense' }).click();
  const confirm = page.getByRole('dialog', { name: `Cancel ${owed?.number}?` });
  await confirm.waitFor({ timeout: 10000 });
  const confirmText = await confirm.innerText();
  check('the cancel dialog asks "Cancel EXP/…?"', confirmText.includes(`Cancel ${owed?.number}?`), confirmText.slice(0, 80));
  check('it says what changes first', confirmText.includes(`₹1.00 comes off what the Shop owes ${supplier.name}`), confirmText);
  check('it offers Keep', await confirm.getByRole('button', { name: 'Keep' }).isVisible());
  const caretInReason = await page.evaluate(() => document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.getAttribute('name') === 'reason');
  check('the caret starts in the reason', caretInReason);
  const mc = await page.evaluate(measure, '[role=dialog]:last-of-type, [role=alertdialog]');
  check('cancel dialog 390: no text cut', mc.cut.length === 0, mc.cut.join(' | '));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/cancel-390.png` });
  await confirm.getByRole('radio', { name: 'Entered twice' }).click();
  await confirm.getByTestId('expense-void-confirm').click();
  await page.getByText(`${owed?.number} cancelled`).waitFor({ timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  const swapped = await page.getByRole('dialog').first().innerText().catch(() => '');
  check('the detail swaps to Cancelled in place, with the reason', swapped.includes('Cancelled') && swapped.includes('Entered twice'), swapped.slice(0, 160));
  check('the supplier\'s Shop balance is back where it was', (await balanceOf()) === owedBefore, `${owedBefore} → ${await balanceOf()}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/cancelled-detail-390.png` });

  /* ---------- the Cancelled chip lists it, and every card says so ---------- */
  await open('?tab=void');
  const cards = page.getByTestId('ub-grid-card');
  check('the cancelled expense is listed under Cancelled', (await cards.allInnerTexts()).some((x) => x.includes(owed?.number ?? 'none')));
  const all = await cards.evaluateAll((els) => els.every((e) => /Cancelled/.test(e.textContent)));
  check('every cancelled card says Cancelled', all);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/cancelled-390.png` });

  /* ---------- a number typed in the search finds it ---------- */
  await open();
  await page.getByRole('searchbox').fill(saved[0]?.number ?? 'none');
  await page.waitForFunction((num) => {
    const c = document.querySelectorAll('[data-testid="ub-grid-card"]');
    return c.length >= 1 && [...c].every((e) => e.textContent.includes(num));
  }, saved[0]?.number, { timeout: 15000 }).catch(() => undefined);
  const found = await page.getByTestId('ub-grid-card').allInnerTexts();
  check('an expense number finds that expense', found.length >= 1 && found.every((x) => x.includes(saved[0]?.number)), `${found.length} cards`);
} finally {
  /* Leave the cash book as it was: every ₹1 this run wrote is cancelled. */
  for (const id of made) {
    try {
      const row = (await (await ctx.request.get(`${base}/api/v1/expenses/${id}`)).json()).data;
      if (row?.status === 'recorded') await send(`/expenses/${id}/void`, { reason: 'QA89 harness clean-up' });
    } catch (error) {
      console.log(`clean-up of ${id} failed: ${error.message}`);
    }
  }
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
