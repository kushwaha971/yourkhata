/**
 * Revamp 09 §10.2 — the Day book on the LOCAL QA stack.
 *
 *   NODE_PATH=$(npm root -g) node e2e/day-book.mjs [--shots=/tmp/e2e-shots/day-book]
 *
 *  * at 320, 360, 390, 1024 and 1280 in English and Hindi: no sideways scroll
 *    and no text cut (09 §10.0's measuring check);
 *  * the figure line is the server's: money in and out, and the cash and bank
 *    at close for the owner;
 *  * on a phone: a band per date whose in and out are its rows', cards of
 *    three things at least 44 px tall with no running cash on them, and a tap
 *    opens the row sheet with every column and the document behind it;
 *  * from 1024: the table with its Cash after column, no cards;
 *  * a quiet day names the day;
 *  * DEC-019: a ₹1 cash "You got" posted in the UDHAAR book today does not
 *    appear in the Shop's day book and does not move its cash at close.
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
const rupees = (text) => Number(String(text).replace(/[^\d.\-‑]/g, '').replace('‑', '-'));

const measure = () => {
  const cut = [];
  for (const el of document.querySelectorAll('main *')) {
    if (el.children.length || !el.textContent?.trim()) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1) continue;
    const s = getComputedStyle(el);
    const clamped = s.webkitLineClamp && s.webkitLineClamp !== 'none';
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && s.overflow !== 'visible')
      cut.push(el.textContent.trim().slice(0, 30));
    if (clamped && el.scrollHeight > el.clientHeight + 1) cut.push(`clamped:${el.textContent.trim().slice(0, 30)}`);
    if (r.right > innerWidth + 1) cut.push(`offscreen:${el.textContent.trim().slice(0, 30)}`);
  }
  // A figure or an amount split over two lines ("₹" on one, the digits on the next).
  const split = [...document.querySelectorAll('[data-testid^="day-book-figure-"], [data-testid="day-book-row"] .ds-num')]
    .filter((el) => /₹/.test(el.textContent) && el.getClientRects().length === 1 && el.getBoundingClientRect().height > 40)
    .map((el) => el.textContent.trim());
  // A number or a signed figure broken over two lines ("INV/26-" / "27/10028").
  const broken = [...document.querySelectorAll('[data-testid="day-book-row-number"], [data-testid="day-book-figures"] span')]
    .filter((el) => el.children.length === 0 && el.getClientRects().length > 1 && /[0-9]/.test(el.textContent) && /\/|₹/.test(el.textContent) && !/ /.test(el.textContent.replace(/^[^₹]*₹/, '')) && el.textContent.length < 24)
    .map((el) => el.textContent.trim());
  for (const el of document.querySelectorAll('[data-testid="day-book-figures"] span')) {
    const m = el.textContent.match(/[-‑]?₹[\d,.]+/);
    if (!m) continue;
    const range = document.createRange();
    const node = el.firstChild;
    const at = el.textContent.indexOf(m[0]);
    if (!node || node.nodeType !== 3) continue;
    range.setStart(node, at);
    range.setEnd(node, at + m[0].length);
    if (range.getClientRects().length > 1) broken.push(m[0]);
  }
  const cards = [...document.querySelectorAll('[data-testid="day-book-row"]')].map((c) => {
    const r = c.getBoundingClientRect();
    return { h: Math.round(r.height), w: Math.round(r.width), text: c.innerText };
  });
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    cut: [...new Set(cut)],
    split,
    broken,
    cards,
    figures: [...document.querySelectorAll('[data-testid="day-book-figures"] > *')].length,
    table: Boolean(document.querySelector('[data-testid="ub-grid-table"]')),
    bands: [...document.querySelectorAll('[data-testid="day-book-band"]')].map((b) => ({
      heading: b.querySelector('h2')?.textContent,
      money: b.querySelector('h2')?.nextElementSibling?.textContent,
      rows: b.querySelectorAll('[data-testid="day-book-row"]').length,
    })),
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

  const api = (path, init) =>
    page.evaluate(
      async ({ path, init }) => {
        const csrf = document.cookie.match(/ub_csrf=([^;]+)/)?.[1] ?? '';
        const r = await fetch(`/api/v1${path}`, {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': decodeURIComponent(csrf),
            'Idempotency-Key': crypto.randomUUID(),
          },
        });
        return { status: r.status, body: await r.json().catch(() => null) };
      },
      { path, init }
    );
  const today = await page.evaluate(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  );
  const MONTH = `period=thisMonth`;
  const monthFrom = `${today.slice(0, 8)}01`;
  const book = (b) => (b?.data?.rows ? b.data : b);
  const server = book((await api(`/reports/day-book?date_from=${monthFrom}&date_to=${today}&page_size=100`)).body);

  const open = async (query) => {
    await page.goto(`${base}/reports/day-book?${query}`, { waitUntil: 'networkidle' });
    await page.getByTestId('day-book-screen').waitFor();
  };

  for (const locale of ['en', 'hi']) {
    await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
    for (const width of [320, 360, 390, 1024, 1280]) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 780 });
      await open(MONTH);
      await page.getByTestId('day-book-figures').waitFor();
      const tag = `${width} ${locale}`;
      const m = await page.evaluate(measure);
      check(`${tag}: no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
      check(`${tag}: no text cut`, m.cut.length === 0, m.cut.join(' | '));
      check(`${tag}: no amount split over two lines`, m.split.length === 0, m.split.join(' | '));
      check(`${tag}: no number or signed figure broken across lines`, m.broken.length === 0, m.broken.join(' | '));
      check(`${tag}: four figures for the owner`, m.figures === 4, String(m.figures));
      if (width < 1024) {
        check(`${tag}: cards, no table`, m.cards.length > 0 && !m.table, `${m.cards.length} cards`);
        check(`${tag}: every card is 44 px or more`, m.cards.every((c) => c.h >= 44), JSON.stringify([...new Set(m.cards.map((c) => c.h))]));
        check(`${tag}: no running cash on a card`, m.cards.every((c) => !/after|बाद/i.test(c.text)));
        check(`${tag}: a band per date, each a heading`, m.bands.length > 1 && m.bands.every((b) => b.heading && b.rows > 0), `${m.bands.length} bands`);
      } else {
        check(`${tag}: the table, no cards`, m.table && m.cards.length === 0);
      }
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/month-${width}-${locale}.png`, fullPage: true });
    }
  }

  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);
  await page.setViewportSize({ width: 390, height: 780 });
  await open(MONTH);
  const figure = async (key) => rupees(await page.getByTestId(`day-book-figure-${key}`).innerText());
  check('money in is the server\'s', (await figure('in')) === Number(server.totals.money_in), `${await figure('in')} vs ${server.totals.money_in}`);
  check('money out is the server\'s', (await figure('out')) === Number(server.totals.money_out), `${await figure('out')} vs ${server.totals.money_out}`);
  check('cash at close is the server\'s', (await figure('cash')) === Number(server.closing.cash), `${await figure('cash')} vs ${server.closing.cash}`);
  check('bank at close is the server\'s', (await figure('bank')) === Number(server.closing.bank), `${await figure('bank')} vs ${server.closing.bank}`);

  // Each band's in and out are its own rows' (page one of the month).
  const bands = await page.evaluate(measure).then((m) => m.bands);
  const byDate = {};
  for (const row of server.rows) {
    const d = (byDate[row.date] ??= { in: 0, out: 0 });
    if (!row.void) {
      d.in += Number(row.money_in ?? 0);
      d.out += Number(row.money_out ?? 0);
    }
  }
  const wrong = bands.filter((b) => {
    const [dd, mm, yyyy] = b.heading.split(' ')[0].split('/');
    const want = byDate[`${yyyy}-${mm}-${dd}`];
    const [inText, outText] = b.money.split('·');
    return !want || Math.abs(rupees(inText) - want.in) > 0.001 || Math.abs(rupees(outText) - want.out) > 0.001;
  });
  check('every band\'s In and Out are its rows\'', bands.length > 0 && wrong.length === 0, wrong.map((b) => `${b.heading} ${b.money}`).join(' | '));
  check('a band on a paged range says it is this page only', server.total_pages <= 1 || /On this page/.test(bands.at(-1).money), bands.at(-1)?.money);

  // A tap opens the row sheet with everything the card leaves out.
  const card = page.getByTestId('day-book-row').first();
  await card.click();
  const sheet = page.getByTestId('day-book-row-sheet');
  await sheet.waitFor();
  const sheetText = await sheet.innerText();
  check('the sheet has the running cash and bank', /Cash after this/.test(sheetText) && /Bank after this/.test(sheetText));
  check('the sheet has the number, mode and who recorded it', /Number/.test(sheetText) && /Mode/.test(sheetText) && /By/.test(sheetText));
  const docLink = page.getByRole('link', { name: new RegExp(`^Open ${server.rows[0].number?.replace(/[/]/g, '\\/') ?? ''}`) });
  const href = await docLink.first().getAttribute('href');
  check('the sheet offers the document', Boolean(href), href ?? 'none');
  await docLink.first().click();
  await page.waitForURL((u) => u.pathname !== '/reports/day-book', { timeout: 15000 }).catch(() => undefined);
  const shown = await page
    .locator('main')
    .getByText(server.rows[0].number ?? '@@')
    .first()
    .waitFor({ timeout: 20000 })
    .then(() => true, () => false);
  const docText = await page.locator('main').innerText();
  check('Open reaches the document', shown && !/not found|404/i.test(docText), `${page.url()} ${docText.slice(0, 60).replace(/\n/g, ' ')}`);

  // A quiet day names the day.
  await open('period=custom&from=2020-01-01&to=2020-01-01');
  check('a quiet day names the day', await page.getByText('Nothing recorded on 01/01/2020').isVisible());

  // DEC-019 — the Udhaar book's cash is not the Shop's.
  const before = book((await api(`/reports/day-book?date_from=${today}&date_to=${today}&page_size=100`)).body);
  const party = (await api('/parties?page_size=1')).body.data[0];
  const posted = await api(`/parties/${party.id}/ledger-entries`, {
    method: 'POST',
    body: JSON.stringify({ direction: 'credit', amount: '1.00', entry_date: today, note: 'Day book DEC-019 check', payment_mode: 'cash' }),
  });
  check('a ₹1 cash You got is posted in the Udhaar book', posted.status === 201, String(posted.status));
  const after = book((await api(`/reports/day-book?date_from=${today}&date_to=${today}&page_size=100`)).body);
  check('it is not in the Shop\'s day book', after.total === before.total && !after.rows.some((r) => r.note === 'Day book DEC-019 check'), `${before.total} → ${after.total}`);
  check('the Shop\'s cash at close did not move', after.closing.cash === before.closing.cash, `${before.closing.cash} → ${after.closing.cash}`);
  await open('');
  check('the screen shows the same cash at close', (await figure('cash')) === Number(after.closing.cash));
  // Undo it in the Udhaar book, as a merchant would: reverse the entry.
  const entryId = posted.body?.data?.id;
  if (entryId) {
    const undo = await api(`/ledger-entries/${entryId}/reverse`, { method: 'POST', body: JSON.stringify({ reason: 'Day book harness check' }) });
    check('the check entry is reversed again', [200, 201].includes(undo.status), String(undo.status));
  }

  // Phone screenshots of the sheet and of today.
  if (SHOTS) {
    await open(MONTH);
    await page.getByTestId('day-book-row').first().click();
    await page.getByTestId('day-book-row-sheet').waitFor();
    await page.screenshot({ path: `${SHOTS}/sheet-390-en.png` });
    await open('');
    await page.screenshot({ path: `${SHOTS}/today-390-en.png`, fullPage: true });
  }
} catch (error) {
  check('harness ran to the end', false, error.message);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
