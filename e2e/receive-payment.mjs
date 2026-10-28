/**
 * Revamp 08 §6 — the Shop's Receive payment drawer on the LOCAL QA stack,
 * through the real API.
 *
 *   NODE_PATH=$(npm root -g) node e2e/receive-payment.mjs [--shots=/tmp/e2e-shots/receive]
 *
 *  * LOOKs at the drawer opened from a customer's page at 390, 320, 1024 and
 *    1280 in English and Hindi: no sideways scroll, every text node inside its
 *    box, the footer's buttons whole and tappable, "Still due after this" on
 *    one line, the amount focused, the header saying what the customer owes;
 *  * the states a counter meets: more than due (the advance as a row and the
 *    "not a refund" line), an over-allocation (named, Save held), bills that
 *    could not be read (Save still allowed with Auto, and says how), no
 *    unpaid bills, a slow save ("Still working…"), a refused save and a lost
 *    one ("Didn't go through" / "No answer yet", Try again on the SAME key),
 *    and dues changed on another device (found on focus, Save held until
 *    "Use the new figures");
 *  * Enter in the amount moves to Paid by on a desktop;
 *  * a real ₹1 receipt: a double tap posts once, the saved panel says it once
 *    (no toast), Share receipt asks the server once and the message never
 *    names the product, and the server holds ₹1 against the oldest bill.
 *
 * Local QA tenant only. Every receipt it records ("QA91") is cancelled at the end.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_FRONTEND ?? (process.env.E2E_BASE ?? 'http://localhost:3000');
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const SHOTS = arg('shots', '');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const PRODUCT = /yourkhata|digikhaato|udhaarbook/i;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

/** Text that runs past its box, a page wider than the screen, and the footer's buttons. */
const measure = () => {
  const dialog = [...document.querySelectorAll('[role=dialog]')].at(-1);
  const cut = [];
  for (const el of dialog?.querySelectorAll('*') ?? []) {
    if (el.children.length || !el.textContent?.trim()) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || el.closest('.sr-only')) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && s.overflow !== 'visible')
      cut.push(el.textContent.trim().slice(0, 30));
    if (r.right > innerWidth + 1) cut.push(`offscreen:${el.textContent.trim().slice(0, 30)}`);
    const range = document.createRange();
    range.selectNodeContents(el);
    const text = range.getBoundingClientRect();
    let clip = el.parentElement;
    while (clip && getComputedStyle(clip).overflowX === 'visible') clip = clip.parentElement;
    const box = clip?.getBoundingClientRect();
    if (box && text.right > box.right + 1) cut.push(`clipped:${el.textContent.trim().slice(0, 30)}`);
  }
  const save = dialog?.querySelector('[data-testid="payment-save"], [data-testid="payment-saved-share"]');
  const footer = save?.closest('footer') ?? save?.parentElement?.parentElement;
  const buttons = [...(footer?.querySelectorAll('button, a') ?? [])]
    .filter((b) => b.getBoundingClientRect().width > 0)
    .map((b) => {
      const q = b.getBoundingClientRect();
      return {
        name: b.textContent.trim(),
        h: Math.round(q.height),
        inside: q.left >= 0 && q.right <= innerWidth + 0.5 && q.bottom <= innerHeight + 0.5,
        reachable: b.contains(document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2)),
      };
    });
  const leftLabel = dialog?.querySelector('[data-testid="payment-left"] > *');
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    cut: [...new Set(cut)],
    buttons,
    leftLines: leftLabel ? Math.round(leftLabel.getBoundingClientRect().height / 16) : null,
    focused: document.activeElement?.getAttribute('name'),
    description: dialog?.querySelector('[id$="-description"], p')?.textContent?.trim() ?? '',
    width: Math.round(dialog?.getBoundingClientRect().width ?? 0),
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

  /* ---------- a customer who owes the Shop and has unpaid Shop bills ---------- */
  let customer = null;
  let bills = [];
  for (const party of (await getJson('/parties?type=customer&page_size=40&book=shop&balance=owes_me')).data) {
    const open = (await getJson(`/payments/open-documents?party_id=${party.id}&direction=in&bucket=shop`)).data;
    if (open.length && Number(open[0].amount_due) > 5) {
      customer = party;
      bills = open;
      break;
    }
  }
  if (!customer) throw Error('No QA customer owes the Shop with an unpaid Shop bill');
  const shopNow = async () => (await getJson(`/parties/${customer.id}?book=shop`)).data.shop;
  const owed = Number((await shopNow()).customer_balance);
  console.log(`customer ${customer.name}: owes ${owed}, ${bills.length} unpaid bill(s)`);

  const drawer = page.getByRole('dialog').last();
  const openDrawer = async (width) => {
    await page.goto(`${base}/customers`, { waitUntil: 'domcontentloaded' });
    await page.goto(`${base}/parties/${customer.id}`, { waitUntil: 'networkidle' });
    const actions = width < 1024 ? page.getByTestId('shop-person-dock') : page.locator('main header');
    await actions.getByRole('button', { name: /^(Receive payment|भुगतान लें)$/ }).click();
    await drawer.waitFor();
    await drawer.locator('input[name="lines.0.amount"]').waitFor();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
  };
  const close = async () => {
    await page.keyboard.press('Escape');
    const confirm = page.getByRole('dialog', { name: /Leave without saving\?|बिना सेव/ });
    if (await confirm.isVisible().catch(() => false))
      await confirm.getByRole('button').filter({ hasText: /Discard changes|बदलाव हटाएँ/ }).first().click();
    await page.getByRole('dialog').first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => undefined);
  };
  const shot = async (name) => {
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
  };
  const amount = () => drawer.locator('input[name="lines.0.amount"]');
  const look = async (tag) => {
    const m = await page.evaluate(measure);
    check(`${tag}: no sideways scroll`, m.overflow <= 0, `${m.overflow}px`);
    check(`${tag}: no text cut`, m.cut.length === 0, m.cut.join(' | '));
    check(
      `${tag}: footer buttons whole, inside the screen and tappable`,
      m.buttons.length >= 2 && m.buttons.every((b) => b.inside && b.reachable && b.h >= 40),
      JSON.stringify(m.buttons)
    );
    return m;
  };

  /* ---------- LOOK: Ready ---------- */
  for (const locale of ['en', 'hi']) {
    await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
    for (const width of [390, 320, 1024, 1280]) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 780 });
      await openDrawer(width);
      const tag = `ready ${width} ${locale}`;
      const m = await look(tag);
      check(`${tag}: the amount has the caret`, m.focused === 'lines.0.amount', m.focused);
      check(`${tag}: "Still due after this" on one line`, m.leftLines === 1, String(m.leftLines));
      const text = await drawer.innerText();
      check(
        `${tag}: the header says who owes what`,
        text.includes(customer.name) && /to collect ₹|₹[\d,.]+ बाकी/.test(text),
        m.description
      );
      check(`${tag}: the unpaid bills are counted`, /unpaid bill|बिल बाकी/.test(text));
      if (width >= 1024) check(`${tag}: a 440 px drawer`, Math.abs(m.width - 440) <= 1, String(m.width));
      await shot(`ready-${width}-${locale}`);
      await close();
    }
  }
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);

  /* ---------- states, on a phone and at 320 in Hindi ---------- */
  for (const [width, locale] of [
    [390, 'en'],
    [320, 'hi'],
  ]) {
    await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
    await page.setViewportSize({ width, height: 780 });
    const tag = `${width} ${locale}`;

    // More than due: the advance is a row, and it is not a refund.
    const owesNow = Number((await shopNow()).customer_balance);
    await openDrawer(width);
    await amount().fill((owesNow + 155).toFixed(2));
    await amount().blur();
    await page.waitForTimeout(200);
    await look(`more than due ${tag}`);
    const hint = await drawer.getByTestId('payment-hint').innerText();
    check(`more than due ${tag}: says ₹155 stays as advance`, /155\.00/.test(hint), hint);
    const row = drawer.getByTestId('alloc-advance-row');
    check(
      `more than due ${tag}: the advance is a row before saving`,
      (await row.count()) === 1 && /Shop book|दुकान/.test(await row.innerText())
    );
    await shot(`more-than-due-${width}-${locale}`);

    // Over-allocation: named with its figures, Save held.
    await amount().fill('3');
    await drawer.getByRole('switch').click();
    await drawer.locator('input[name="allocations.0.amount"]').fill('4');
    await page.waitForTimeout(200);
    const over = drawer.getByTestId('alloc-over');
    check(`over-allocation ${tag}: named with its figures`, /₹4\.00[\s\S]*₹3\.00/.test(await over.innerText().catch(() => '')));
    check(`over-allocation ${tag}: Save held`, await drawer.getByTestId('payment-save').isDisabled());
    await look(`over-allocation ${tag}`);
    await shot(`over-${width}-${locale}`);
    await close();

    // Bills could not be read: Save still allowed with Auto, and it says how.
    await page.route('**/api/v1/payments/open-documents?**', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'server_error', message: 'Could not load bills.', details: {} } }),
      })
    );
    await openDrawer(width);
    await drawer.getByText(/Couldn't load bills|बिल नहीं खुले/).waitFor();
    check(`bills unread ${tag}: Save allowed with Auto`, await drawer.getByTestId('payment-save').isEnabled());
    check(`bills unread ${tag}: says bills match oldest first`, /matched oldest first|सबसे पुराने बिल पहले/.test(await drawer.innerText()));
    await look(`bills unread ${tag}`);
    await shot(`bills-unread-${width}-${locale}`);
    await close();
    await page.unroute('**/api/v1/payments/open-documents?**');

    // No unpaid bills.
    await page.route('**/api/v1/payments/open-documents?**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
    );
    await openDrawer(width);
    const none = await drawer.getByTestId('alloc-none').innerText();
    check(`no bills ${tag}: kept as advance for the next bill, no "khata"`, /advance|एडवांस/.test(none) && !/khata/i.test(none), none);
    await look(`no bills ${tag}`);
    await shot(`no-bills-${width}-${locale}`);
    await close();
    await page.unroute('**/api/v1/payments/open-documents?**');

    // Slow, then refused; then lost; Try again keeps the key.
    const keys = [];
    let mode = 'slow-refuse';
    const hold = async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      keys.push(route.request().headers()['idempotency-key']);
      if (mode === 'slow-refuse') {
        await new Promise((r) => setTimeout(r, 3600));
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'server_error', message: 'Something went wrong.', details: {} } }),
        });
      }
      return route.abort('connectionreset');
    };
    await page.route('**/api/v1/payments', hold);
    await openDrawer(width);
    await amount().fill('1');
    await drawer.getByTestId('payment-save').click();
    await page.waitForTimeout(3300);
    const busy = await drawer.innerText();
    check(`slow ${tag}: says it is still working and won't save twice`, /Still working|अभी हो रहा है/.test(busy));
    check(`slow ${tag}: the button says Receiving…`, /Receiving…|ले रहे हैं…/.test(busy));
    await look(`slow ${tag}`);
    await shot(`slow-${width}-${locale}`);
    await drawer.getByRole('alert').waitFor();
    check(`refused ${tag}: "Didn't go through. Nothing was saved."`, /Didn't go through|नहीं हुआ/.test(await drawer.getByRole('alert').innerText()));
    check(`refused ${tag}: the button reads Try again`, /Try again|फिर कोशिश/.test(await drawer.getByTestId('payment-save').innerText()));
    check(`refused ${tag}: the amount is kept`, (await amount().inputValue()) === '1.00', await amount().inputValue());
    await look(`refused ${tag}`);
    await shot(`refused-${width}-${locale}`);
    mode = 'lost';
    await drawer.getByTestId('payment-save').click();
    await drawer.getByRole('alert').filter({ hasText: /No answer|जवाब नहीं/ }).waitFor();
    check(`lost ${tag}: "No answer yet", and it won't be saved twice`, /twice|दो बार/.test(await drawer.getByRole('alert').innerText()));
    check(`Try again ${tag}: the same key every time`, keys.length === 2 && keys[0] === keys[1], keys.join(' / '));
    await shot(`lost-${width}-${locale}`);
    await page.unroute('**/api/v1/payments', hold);
    await close();

    // Changed elsewhere: another device takes ₹1 while the drawer is open.
    await openDrawer(width);
    const elsewhere = await send('/payments', {
      direction: 'in',
      party_id: customer.id,
      payment_date: new Date().toISOString().slice(0, 10),
      note: 'QA91 other device',
      bucket: 'shop',
      mode_breakup: [{ mode: 'cash', amount: '1.00' }],
      allocations: 'auto',
    });
    recorded.add(elsewhere.id);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    const changed = drawer.getByRole('status').filter({ hasText: /another device|दूसरे फ़ोन/ });
    await changed.waitFor({ timeout: 10000 });
    check(`changed ${tag}: the banner names the new figure`, /₹[\d,]+\.\d\d/.test(await changed.innerText()), await changed.innerText());
    check(`changed ${tag}: Save held until the merchant looks`, await drawer.getByTestId('payment-save').isDisabled());
    await look(`changed ${tag}`);
    await shot(`changed-${width}-${locale}`);
    await drawer.getByRole('button', { name: /Use the new figures|नए आँकड़े लें/ }).click();
    await page.waitForTimeout(400);
    check(`changed ${tag}: the header now says "now owes"`, /now to collect|अब ₹/.test(await drawer.innerText()));
    check(`changed ${tag}: Save allowed again`, await drawer.getByTestId('payment-save').isEnabled());
    await close();
  }
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);

  /* ---------- Enter in the amount moves on, on a desktop ---------- */
  await page.setViewportSize({ width: 1280, height: 900 });
  await openDrawer(1280);
  await amount().focus();
  await page.keyboard.press('Enter');
  const after = await page.evaluate(() => ({
    role: document.activeElement?.getAttribute('aria-label'),
    open: Boolean(document.querySelector('[role=dialog] [data-testid="payment-save"]')),
  }));
  check('desktop: Enter in the amount moves to Paid by and saves nothing', after.role === 'Paid by' && after.open, JSON.stringify(after));
  await close();

  /* ---------- a real ₹1 receipt ---------- */
  await page.setViewportSize({ width: 390, height: 780 });
  const before = Number((await shopNow()).customer_balance);
  const oldest = (await getJson(`/payments/open-documents?party_id=${customer.id}&direction=in&bucket=shop`)).data[0];
  await openDrawer(390);
  await amount().fill('1');
  await drawer.getByRole('button', { name: /More details/ }).click();
  await drawer.locator('input[name="note"]').fill('QA91 receive drawer');
  let posts = 0;
  const count = (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/v1/payments') posts += 1;
  };
  page.on('request', count);
  await drawer.getByTestId('payment-save').evaluate((b) => {
    b.click();
    b.click();
  });
  const saved = drawer.getByTestId('payment-saved');
  await saved.waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);
  page.off('request', count);
  check('a double tap on Receive posts once', posts === 1, `${posts} posts`);
  const savedText = await saved.innerText();
  check('the saved panel says who paid what and the receipt number', /Received ₹1\.00 from/.test(savedText) && /RCT/.test(savedText), savedText);
  const toast = await page.locator('[data-ub-snackbar], [role=status][class*="snackbar"]').count();
  check('no toast repeats the saved panel', toast === 0, String(toast));
  await look('saved 390 en');
  await shot('saved-390-en');
  const number = savedText.match(/RCT\/[\w/-]+/)?.[0];
  const list = await getJson(`/payments?bucket=shop&q=${encodeURIComponent(number)}&page_size=5`);
  const mine = list.data.find((r) => r.number === number);
  if (mine) recorded.add(mine.id);
  const held = mine ? (await getJson(`/payments/${mine.id}`)).data : null;
  check('the server holds ₹1 against the oldest bill', held && Number(held.amount) === 1 && held.allocations[0]?.document_id === oldest.document_id, JSON.stringify(held?.allocations?.[0] ?? null));
  check('the customer owes ₹1 less in the Shop', Math.abs(Number((await shopNow()).customer_balance) - (before - 1)) < 0.001);

  let shares = 0;
  const countShare = (r) => {
    if (r.method() === 'POST' && /\/payments\/[^/]+\/share$/.test(new URL(r.url()).pathname)) shares += 1;
  };
  page.on('request', countShare);
  await drawer.getByTestId('payment-saved-share').dblclick();
  const sheet = page.getByRole('dialog').filter({ hasText: /can't tell whether it was delivered/ });
  await sheet.waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  page.off('request', countShare);
  check('Share receipt asks the server once for a double tap', shares === 1, `${shares}`);
  const message = await sheet.locator('textarea').inputValue().catch(async () => sheet.innerText());
  check('the message never names the product', !PRODUCT.test(message), message.slice(0, 120));
  await shot('share-390-en');
  await page.keyboard.press('Escape');
  await drawer.getByRole('button', { name: 'Done' }).click();
} finally {
  /* Every receipt this run recorded is cancelled, so QA balances end where they began. */
  for (const id of recorded) {
    await send?.(`/payments/${id}/void`, { reason: 'QA91 harness clean-up' }).catch((e) => console.log(`void ${id}: ${e.message}`));
  }
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
