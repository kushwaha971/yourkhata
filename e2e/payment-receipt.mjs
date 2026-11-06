/**
 * Revamp 08 §10 — a Shop payment receipt on the LOCAL QA stack, through the
 * real API.
 *
 *   NODE_PATH=$(npm root -g) node e2e/payment-receipt.mjs [--shots=/tmp/e2e-shots/receipt]
 *
 *  * records a ₹2 receipt (₹1 cash + ₹1 UPI) from a QA customer against one of
 *    their open bills, so the page has a split, a settled bill and a due;
 *  * LOOKs at 390, 320, 1024 and 1280 in English and Hindi: no sideways page
 *    scroll, every text node inside its box (the A5 preview may scroll inside
 *    its own region), Share · Print · ⋯ docked on a phone with 44 px targets
 *    and inside the screen, the same three in the header on a desktop, the
 *    summary left of the print from 1280;
 *  * the amount, the modes and the settled line equal what the server holds,
 *    and the bill's "still due" is the bill's figure now;
 *  * Share: one request for a double tap, the sheet opens, and the message
 *    names the business and never the product;
 *  * the print sheet with `emulateMedia print`: the screen furniture is gone,
 *    the receipt is there, and it does not name the product either;
 *  * offline: Share is held back and Print still works;
 *  * cancel: ⋯ → Cancel receipt, consequence-first dialog, a reason chip,
 *    and the banner swaps in place; the server says void and the bill's due
 *    is back.
 *
 * Local QA tenant only. It records and cancels one ₹2 receipt ("QA90").
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

const measure = (scope = 'main *, [data-testid="payment-dock"] *') => {
  const cut = [];
  const preview = document.querySelector('main [role=region][tabindex="0"]');
  for (const el of document.querySelectorAll(scope)) {
    if (el.children.length || !el.textContent?.trim()) continue;
    /* The A5 print scrolls sideways inside its own named region on a phone, by
       design (08 §10); what is past that region's edge is reachable, not cut. */
    const inPreview = Boolean(preview?.contains(el));
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.bottom < 0 || r.top > innerHeight) continue;
    if (el.closest('.sr-only')) continue;
    if (!inPreview && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && s.overflow !== 'visible')
      cut.push(el.textContent.trim().slice(0, 30));
    if (!inPreview && r.right > innerWidth + 1) cut.push(`offscreen:${el.textContent.trim().slice(0, 30)}`);
    const range = document.createRange();
    range.selectNodeContents(el);
    const text = range.getBoundingClientRect();
    let clip = el.parentElement;
    while (clip && getComputedStyle(clip).overflowX === 'visible') clip = clip.parentElement;
    const box = clip?.getBoundingClientRect();
    if (!inPreview && box && box.width < innerWidth && text.right > box.right + 1)
      cut.push(`clipped:${el.textContent.trim().slice(0, 30)}`);
    /* A document number is one word: split across lines it reads as two. This
       one runs inside the print too, which the first run caught splitting
       "INV/25-26/5877" over three lines on a phone. */
    for (const word of el.textContent.trim().split(/\s+/).filter((w) => /^[A-Z]+\/\d/.test(w))) {
      const at = el.textContent.indexOf(word);
      if (!el.firstChild || el.firstChild.nodeType !== 3) continue;
      const piece = document.createRange();
      piece.setStart(el.firstChild, at);
      piece.setEnd(el.firstChild, at + word.length);
      const lines = new Set([...piece.getClientRects()].map((q) => Math.round(q.top)));
      if (lines.size > 1) cut.push(`split:${word}`);
    }
  }
  const dock = document.querySelector('[data-testid="payment-dock"]');
  const dockBox = dock?.getBoundingClientRect();
  const dockShown = Boolean(dock && getComputedStyle(dock).display !== 'none' && dockBox.height > 0);
  const buttons = (root) =>
    [...(root?.querySelectorAll('button') ?? [])]
      .filter((b) => b.getBoundingClientRect().width > 0)
      .map((b) => {
        const q = b.getBoundingClientRect();
        return {
          name: (b.getAttribute('aria-label') || b.textContent).trim(),
          h: Math.round(q.height),
          w: Math.round(q.width),
          inside: q.left >= 0 && q.right <= innerWidth && q.bottom <= innerHeight,
          /* Nothing on top of it: the first run found the dock UNDER the
             phone's bottom menu, inside the screen and impossible to tap. */
          reachable: b.contains(document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2)),
        };
      });
  const header = document.querySelector('main header') ?? document.querySelector('header');
  const panel = document.querySelector('main [aria-label][class*="rounded"]');
  const settled = document.querySelector('main ul[aria-label="Settled"], main ul[aria-label="चुकाए गए बिल"]');
  const p = settled?.closest('[class*="rounded"]')?.getBoundingClientRect();
  const v = preview?.getBoundingClientRect();
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    cut: [...new Set(cut)],
    dockShown,
    /* The gap between the dock and the phone's bottom menu (or the screen's edge). */
    dockGap: dockBox
      ? Math.round(
          (document.querySelector('[data-ub-bottom-nav]')?.getBoundingClientRect().top ?? innerHeight) -
            dockBox.bottom
        )
      : null,
    dockButtons: dockShown ? buttons(dock) : [],
    headerButtons: buttons(header),
    sideBySide: Boolean(p && v && p.right <= v.left && Math.abs(p.top - v.top) < 120),
    panelSeen: Boolean(panel),
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

  /* ---------- a receipt worth reading: a split, a bill, a due ---------- */
  let customer = null;
  let bill = null;
  for (const party of (await getJson('/parties?type=customer&page_size=40&book=shop')).data) {
    const open = (
      await getJson(`/payments/open-documents?party_id=${party.id}&direction=in&bucket=shop`)
    ).data.find((d) => Number(d.amount_due) > 5);
    if (open) {
      customer = party;
      bill = open;
      break;
    }
  }
  if (!bill) throw Error('No QA customer has an open bill to settle');
  const today = new Date().toISOString().slice(0, 10);
  const made = await send('/payments', {
    direction: 'in',
    party_id: customer.id,
    payment_date: today,
    note: 'QA90 receipt page',
    mode_breakup: [
      { mode: 'cash', amount: '1.00' },
      { mode: 'upi', amount: '1.00', reference: '4417' },
    ],
    allocations: [{ document_type: bill.document_type, document_id: bill.document_id, amount: '2.00' }],
  });
  const held = (await getJson(`/payments/${made.id}`)).data;
  const allocation = held.allocations[0];
  const inr = (v) =>
    `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const open = async (path = `/payments/${made.id}`) => {
    await page.goto(`${base}${path}`);
    await page.getByRole('region', { name: /Receipt preview|रसीद/ }).first().waitFor({ timeout: 20000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(250);
  };

  /* ---------- LOOK ---------- */
  for (const locale of ['en', 'hi']) {
    await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
    for (const width of [390, 320, 1024, 1280]) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 780 });
      await open();
      const m = await page.evaluate(measure);
      const tag = `${width} ${locale}`;
      check(`${tag}: no sideways page scroll`, m.overflow <= 0, `${m.overflow}px`);
      check(`${tag}: no text cut`, m.cut.length === 0, m.cut.join(' | '));
      if (width < 1024) {
        check(
          `${tag}: Share · Print · More docked above the menu, 44 px, tappable`,
          m.dockShown &&
            m.dockButtons.length === 3 &&
            m.dockButtons.every((b) => b.h >= 44 && b.w >= 44 && b.inside && b.reachable) &&
            Math.abs(m.dockGap) <= 1,
          `gap ${m.dockGap} ${JSON.stringify(m.dockButtons)}`
        );
      } else {
        check(`${tag}: no dock on a desktop`, !m.dockShown);
        check(
          `${tag}: Share, Print and More in the header`,
          m.headerButtons.length >= 3,
          m.headerButtons.map((b) => b.name).join(', ')
        );
      }
      if (width === 1280) check(`${tag}: summary left of the print`, m.sideBySide);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/receipt-${width}-${locale}.png`, fullPage: true });
    }
  }
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);

  /* ---------- what it says is what the server holds ---------- */
  await page.setViewportSize({ width: 390, height: 780 });
  await open();
  const main = page.locator('main');
  const modes = await main.getByRole('list', { name: 'How it was paid' }).innerText();
  check('two mode lines, Cash ₹1 and UPI ₹1 with its reference', /Cash[\s\S]*₹1\.00[\s\S]*UPI · 4417[\s\S]*₹1\.00/.test(modes), modes.replace(/\s+/g, ' '));
  const settled = await main.getByRole('list', { name: 'Settled' }).innerText();
  const due = Number(allocation.amount_due);
  const expected = `${allocation.number} · ${inr(allocation.amount)} · ${due === 0 ? 'paid in full' : `${inr(due)} still due`}`;
  check('the settled line is the bill, the amount and what is still due now', settled.includes(expected), `${settled} vs ${expected}`);
  check('the bill is still due what it was due less ₹2', Math.abs(Number(bill.amount_due) - 2 - due) < 0.001, `${bill.amount_due} → ${due}`);
  check('the header says Received', (await main.innerText()).includes('Received'));

  /* ---------- Share ---------- */
  let shareRequests = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname.endsWith(`/payments/${made.id}/share`)) shareRequests += 1;
  });
  const share = page.getByTestId('payment-dock').getByRole('button', { name: /Share receipt/ });
  await share.dblclick();
  const sheet = page.getByRole('dialog');
  await sheet.waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
  check('a double tap on Share sends one request', shareRequests === 1, `${shareRequests} requests`);
  const message = await sheet.locator('textarea').inputValue().catch(async () => sheet.innerText());
  check('the message names the business', message.includes(held.business.name), message.slice(0, 120));
  check('the message never names the product', !PRODUCT.test(message), message);
  /* §10.2 (owner, 24 Oct): a greeting, what was received and how, the receipt
     number, what is still due, and the shop's thanks, one line each, in "Rs". */
  const lines = message.split('\n');
  check('the message opens with a greeting to the customer', lines[0] === `Namaste ${customer.name},`, lines[0]);
  check('the message says what was received, in Rs', /^Received Rs 2 /.test(lines[1] ?? '') && !message.includes('₹'), lines[1]);
  check('the message carries the receipt number', lines.includes(`Receipt ${made.number}.`), message);
  check('the message says what is still due or that nothing is', /^(Still due: Rs [\d,]+(\.\d\d)?\.|Advance with us: Rs [\d,]+(\.\d\d)?\.|Nothing due now\.)$/.test(lines[3] ?? ''), lines[3]);
  check('the message is signed with thanks from the business', lines.at(-1) === `Thank you — ${held.business.name}`, lines.at(-1));
  console.log(`     message: ${JSON.stringify(message)}`);
  check('the sheet says what is shared and that we cannot see it delivered', (await sheet.innerText()).includes(`${made.number} · ₹2.00 from ${customer.name}`) && (await sheet.innerText()).includes("can't tell whether it was delivered"));
  const ms = await page.evaluate(measure, '[role=dialog] *');
  check('share sheet 390: no text cut', ms.cut.length === 0, ms.cut.join(' | '));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/share-390.png` });
  await page.keyboard.press('Escape');
  await sheet.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => undefined);

  /* ---------- the print sheet ---------- */
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: width >= 1024 ? 900 : 780 });
    await open();
    await page.emulateMedia({ media: 'print' });
    const printed = await page.evaluate(() => {
      const shown = (el) => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
      return {
        dock: shown(document.querySelector('[data-testid="payment-dock"]')),
        actions: [...document.querySelectorAll('button')].filter(shown).map((b) => b.textContent.trim()),
        text: document.body.innerText,
      };
    });
    check(`${width} print: no dock and no buttons`, !printed.dock && printed.actions.length === 0, printed.actions.join(', '));
    check(`${width} print: the receipt is there`, printed.text.includes(made.number) && printed.text.includes(held.business.name));
    check(`${width} print: never names the product`, !PRODUCT.test(printed.text));
    const sheetCut = await page.evaluate(measure, '[data-testid="payment-receipt-print"] *');
    const split = sheetCut.cut.filter((c) => c.startsWith('split:'));
    check(`${width} print: no bill or receipt number split over lines`, split.length === 0, split.join(' | '));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/print-${width}.png`, fullPage: true });
    await page.emulateMedia({ media: 'screen' });
  }

  /* ---------- offline ---------- */
  await page.setViewportSize({ width: 390, height: 780 });
  await open();
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.waitForTimeout(800);
  const dockNow = page.getByTestId('payment-dock');
  check('offline: Share is held back', await dockNow.getByRole('button', { name: /Share receipt/ }).isDisabled());
  check('offline: Print still works', await dockNow.getByRole('button', { name: /Print/ }).isEnabled());
  check('offline: says why', (await main.innerText()).includes('No internet'));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/offline-390.png` });
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));

  /* ---------- the cancel dialog in Hindi at 320, then kept ---------- */
  await ctx.addCookies([{ name: 'ub_locale', value: 'hi', url: base }]);
  await page.setViewportSize({ width: 320, height: 780 });
  await open();
  await page.getByTestId('payment-dock').getByRole('button', { name: 'और विकल्प' }).click();
  await page.getByRole('button', { name: /रसीद रद्द करें/ }).click();
  const hiDialog = page.getByRole('dialog', { name: `${made.number} रद्द करें?` });
  await hiDialog.waitFor({ timeout: 15000 });
  const mhd = await page.evaluate(measure, '[role=dialog] *');
  check('cancel dialog 320 hi: no text cut', mhd.cut.length === 0, mhd.cut.join(' | '));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/cancel-dialog-320-hi.png` });
  await hiDialog.getByRole('button', { name: 'रसीद रखें' }).click();
  await hiDialog.waitFor({ state: 'hidden', timeout: 5000 });
  check('Keep receipt keeps it', (await getJson(`/payments/${made.id}`)).data.status === 'recorded');
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);
  await page.setViewportSize({ width: 390, height: 780 });

  /* ---------- cancel ---------- */
  await open();
  await page.getByTestId('payment-dock').getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('button', { name: /Cancel receipt/ }).click();
  const dialog = page.getByRole('dialog', { name: `Cancel ${made.number}?` });
  await dialog.waitFor({ timeout: 15000 });
  const said = await dialog.innerText();
  check('the dialog says what changes, in Shop words', said.includes(`The Shop will collect ₹2.00 more from ${customer.name}`) && !/khata|void/i.test(said), said.replace(/\s+/g, ' ').slice(0, 240));
  check('the dialog says the bill will be due again', said.includes(`${allocation.number} will be due again: ${inr(due + 2)}`), said.replace(/\s+/g, ' ').slice(0, 240));
  check('Keep receipt is the safe choice', await dialog.getByRole('button', { name: 'Keep receipt' }).isVisible());
  const focused = await page.evaluate(() => document.activeElement?.tagName + ':' + (document.activeElement?.textContent ?? '').trim().slice(0, 20));
  check('focus opens on the reason or Keep receipt, never on Cancel receipt', !/Cancel receipt/.test(focused), focused);
  const md = await page.evaluate(measure, '[role=dialog] *');
  check('cancel dialog 390: no text cut', md.cut.length === 0, md.cut.join(' | '));
  const chips = await dialog.getByRole('radio').evaluateAll((els) =>
    els.map((b) => {
      const q = b.getBoundingClientRect();
      return { face: Math.round(q.height), fits: b.scrollWidth <= b.clientWidth + 1 };
    })
  );
  check('reason chips: 32 px faces, whole words', chips.length === 5 && chips.every((c) => c.face === 32 && c.fits), JSON.stringify(chips));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/cancel-dialog-390.png` });
  await dialog.getByRole('radio', { name: 'Wrong contact' }).click();
  await dialog.getByTestId('payment-void-confirm').click();
  await page.getByText(/^Cancelled on /).first().waitFor({ timeout: 15000 });
  check('the banner swaps in place with the reason', (await main.innerText()).includes('Reason: Wrong contact'));
  check('Record again is offered', await page.getByTestId('payment-dock').getByRole('button', { name: /Record again/ }).isVisible());
  const after = (await getJson(`/payments/${made.id}`)).data;
  check('the server holds it as cancelled, number kept', after.status === 'void' && after.number === made.number, after.status);
  const reopened = (
    await getJson(`/payments/open-documents?party_id=${customer.id}&direction=in&bucket=shop`)
  ).data.find((d) => d.document_id === bill.document_id);
  check('the bill is due what it was before the receipt', reopened && Math.abs(Number(reopened.amount_due) - Number(bill.amount_due)) < 0.001, `${bill.amount_due} → ${reopened?.amount_due}`);
  const m = await page.evaluate(measure);
  check('cancelled 390: no text cut, dock tappable', m.cut.length === 0 && m.dockButtons.every((b) => b.inside && b.reachable), `${m.cut.join(' | ')} ${JSON.stringify(m.dockButtons)}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/cancelled-390.png`, fullPage: true });
  await ctx.addCookies([{ name: 'ub_locale', value: 'hi', url: base }]);
  await page.setViewportSize({ width: 320, height: 780 });
  await open();
  const mh = await page.evaluate(measure);
  check('cancelled 320 hi: no text cut', mh.cut.length === 0, mh.cut.join(' | '));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/cancelled-320-hi.png`, fullPage: true });
  await ctx.addCookies([{ name: 'ub_locale', value: 'en', url: base }]);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
