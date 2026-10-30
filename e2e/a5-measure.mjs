// A5 — measure every drawer and sheet against the design's spacing standard
// (docs/performance/2026-10-28-shop-a5-drawer-spacing.md, S1–S17). Used for the
// BASELINE (before any change) and after, with the same yardstick both times.
//
// Opens the four form drawers: Add customer, Add item, Receive money and
// Adjust stock. Measures:
//   S1  label → its box;  S2 box → its hint/error (with errors showing);
//   S3  field → next field;  S4 group → next group;  S7 field height;
//   S10 switch row height;  S11 edge → content;  S12 header height;
//   S13 footer layout (side by side or stacked), padding and button widths;
//   S16 desktop drawer width.
// Also checks each box's text fits it (H18) and that labels share one left
// edge to within 1 px (H19).
//
//   node e2e/a5-measure.mjs [--tag=before] [--width=390]   (E2E_BASE, PW_CHROME)
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3000';
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const tag = arg('tag', 'now');
const widths = arg('width', '390,1280').split(',').map(Number);
const locale = arg('locale', 'en');
const theme = arg('theme', 'light');
const dir = process.env.E2E_SHOTS ?? '/tmp/e2e-shots/a5';
mkdirSync(dir, { recursive: true });

const DRAWERS = [
  { name: 'customer', path: '/customers', open: /^(Add customer|ग्राहक जोड़ें)/ },
  { name: 'item', path: '/items', open: /^(Add item|आइटम जोड़ें)/ },
  { name: 'payment', path: '/payments', open: /^(Receive money|Record payment|New payment|Receive|Money in|पेमेंट लें)/ },
  { name: 'stock', path: null, open: /^(Adjust stock|स्टॉक ठीक करें)/ },
];

/** Runs in the page: every number the spec names, from the open dialog. */
const measure = () => {
  const d = [...document.querySelectorAll('[role=dialog]')].pop();
  if (!d) return null;
  const R = (e) => e.getBoundingClientRect();
  const px = (e, p) => parseFloat(getComputedStyle(e)[p]);
  const panel = R(d);
  const kids = [...d.children].filter((c) => R(c).height > 0);
  // The grab handle comes first on a phone sheet, so find the header by name.
  const header = d.querySelector('[data-ub-dialog-header]') ?? kids[0];
  const footer = d.querySelector('[data-ub-overlay-footer]');
  const body = kids.find((c) => c !== header && c !== footer && getComputedStyle(c).overflowY === 'auto') ?? kids[1];
  const form = body?.querySelector('form') ?? body;
  // Fields: a label with a control below it.
  const fields = [...form.querySelectorAll('label')]
    .map((l) => {
      const id = l.getAttribute('for');
      const ctl = id ? document.getElementById(id) : null;
      // A label hidden for screen readers (1 px, sr-only) is not spacing the
      // eye sees, so it is not measured (it read "0 px" and a second edge).
      return ctl && ctl.tagName !== 'BUTTON' && R(l).height > 2 ? { l, ctl } : null;
    })
    .filter(Boolean);
  const labelGap = fields.map(({ l, ctl }) => Math.round(R(ctl).top - R(l).bottom));
  const heights = fields.map(({ ctl }) => Math.round(R(ctl.closest('div') ?? ctl).height));
  const ctlHeights = fields.map(({ ctl }) => Math.round(R(ctl).height));
  // Field → next field: one field's own outer box (UbField's root: the label's
  // parent) to the next one's, so a reserved empty message row counts as gap.
  const fieldGaps = [];
  for (let i = 1; i < fields.length; i += 1) {
    // Only fields side by side in one container: across a group the gap is
    // the group's (S4), not a field's.
    const pa = fields[i - 1].l.parentElement;
    const pb = fields[i].l.parentElement;
    if (pa.parentElement !== pb.parentElement) continue;
    const a = R(pa);
    const b = R(pb);
    if (b.top > a.bottom - 1 && b.top - a.bottom < 80) fieldGaps.push(Math.round(b.top - a.bottom));
  }
  const switches = [...form.querySelectorAll('[role=switch]')].map((s) => Math.round(R(s.closest('label') ?? s.parentElement).height));
  // One edge per container: the fields inside an open disclosure are inset by
  // the design (A6 opens the Shop's "More details"), so they share their own.
  const leftEdges = [...new Set(fields.filter(({ l }) => !l.closest('[data-ub-disclosure]')).map(({ l }) => Math.round(R(l).left)))];
  const innerEdges = [...new Set(fields.filter(({ l }) => l.closest('[data-ub-disclosure]')).map(({ l }) => Math.round(R(l).left)))];
  const cut = fields.filter(({ ctl }) => ctl.tagName === 'INPUT' && ctl.value && ctl.scrollWidth > ctl.clientWidth + 1).length;
  const fb = footer ? [...footer.querySelectorAll('button')].filter((b) => R(b).width > 0) : [];
  const side = fb.length >= 2 && Math.abs(R(fb[0]).top - R(fb[1]).top) < 2;
  const hints = [...form.querySelectorAll("[data-part='message'] > *")].filter((e) => R(e).height > 0);
  const labelFont = fields.map(({ l }) => `${getComputedStyle(l).fontSize}/${getComputedStyle(l).fontWeight}`);
  const grab = d.querySelector('[data-ub-grab]');
  const gr = grab && R(grab).height ? R(grab) : null;
  return {
    grab: gr ? [Math.round(gr.width), Math.round(gr.height)] : null,
    hintFont: [...new Set(hints.map((h) => getComputedStyle(h).fontSize))],
    labelFont: [...new Set(labelFont)],
    panelW: Math.round(panel.width),
    headerH: header ? Math.round(R(header).height) : null,
    headerPad: header ? ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].map((p) => px(header, p)) : null,
    bodyPad: body ? ['paddingTop', 'paddingLeft'].map((p) => px(body, p)) : null,
    bodyGap: body ? px(form, 'rowGap') || px(body, 'rowGap') : null,
    labelGap: [...new Set(labelGap)],
    fieldGap: [...new Set(fieldGaps)].slice(0, 6),
    ctlH: [...new Set(ctlHeights)],
    switchRow: [...new Set(switches)],
    leftEdges,
    innerEdges,
    cut,
    footerPad: footer ? ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].map((p) => px(footer, p)) : null,
    footerSide: side,
    footerBtnW: fb.map((b) => Math.round(R(b).width)),
    fields: fields.length,
  };
};

/** The design's numbers (S1–S16): what a measurement must be, or why it fails. */
const near = (a, b, tol = 1) => typeof a === 'number' && Math.abs(a - b) <= tol;
const verdict = (m, phone) => {
  const f = [];
  if (!m.labelGap.every((g) => near(g, 6))) f.push(`S1 label → box ${m.labelGap} (6)`);
  if (m.errorGap.length && !m.errorGap.every((g) => near(g, 4))) f.push(`S2 box → error ${m.errorGap} (4)`);
  if (m.fieldGap.length && !m.fieldGap.every((g) => near(g, 16))) f.push(`S3 field → field ${m.fieldGap} (16)`);
  if (!m.ctlH.filter((h) => h < 60).every((h) => near(h, phone ? 44 : 40))) f.push(`S7 box ${m.ctlH} (${phone ? 44 : 40})`);
  if (m.switchRow.length && !m.switchRow.every((h) => h >= 47)) f.push(`S10 switch row ${m.switchRow} (≥48)`);
  if (m.headerH < (phone ? 56 : 60)) f.push(`S12 header ${m.headerH} (≥${phone ? 56 : 60})`);
  if (phone && (!m.grab || m.grab[0] !== 36 || m.grab[1] !== 4)) f.push(`S15 grab ${m.grab} (36×4)`);
  if (phone) {
    if (!m.footerSide) f.push('S13 footer stacked (side by side)');
    else if (!near(m.footerBtnW[1] / m.footerBtnW[0], 2, 0.15)) f.push(`S13 footer ${m.footerBtnW.join(':')} (1:2)`);
  } else if (!near(m.panelW, 480)) f.push(`S16 drawer ${m.panelW} (480)`);
  if (m.hintFont.length && !m.hintFont.every((x) => x === '12.5px')) f.push(`S14b hint ${m.hintFont} (12.5px)`);
  if (!m.labelFont.every((x) => x === '13px/600')) f.push(`S6 label ${m.labelFont} (13px/600)`);
  if (m.leftEdges.length > 1) f.push(`H19 labels on ${m.leftEdges.length} left edges`);
  if (m.innerEdges?.length > 1) f.push(`H19 inner labels on ${m.innerEdges.length} left edges`);
  if (m.cut) f.push(`H18 ${m.cut} box(es) cut`);
  return f;
};
const failures = [];
/** Departures listed for the owner (never counted as a pass): key → spec ids. */
const LISTED = {
  '1280-stock': {
    S16: 'a 7-column item table needs 900 px (the design has a wider .drawer.w560 too)',
    S7: "the table's compact row boxes (32 px), like the bill table's row inputs",
  },
};
const listed = [];

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const out = {};
try {
  for (const width of widths) {
    const phone = width < 1024;
    const ctx = await browser.newContext({
      viewport: { width, height: phone ? 800 : 900 },
      colorScheme: theme,
      ...(phone ? { hasTouch: true, isMobile: true } : {}),
    });
    await ctx.addCookies([
      { name: 'ub_locale', value: locale, domain: new URL(base).hostname, path: '/' },
      { name: 'ub_theme_choice', value: theme, domain: new URL(base).hostname, path: '/' },
    ]);
    const page = await ctx.newPage();
    await page.goto(`${base}/login/email`);
    await page.fill('input[type=email]', 'scale@digikhaato.test');
    await page.fill('input[type=password]', 'Scale-Run-2026!');
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    const item = (await (await ctx.request.get(`${base}/api/v1/items?page_size=1&ordering=name`)).json()).data[0];
    for (const dr of DRAWERS) {
      const key = `${width}-${theme}-${locale}-${dr.name}`;
      await page.goto(`${base}${dr.path ?? `/items/${item.id}`}`, { waitUntil: 'load' });
      await page.waitForTimeout(1500);
      const btn = page.getByRole('button', { name: dr.open }).first();
      if (!(await btn.count())) {
        out[key] = { error: `no "${dr.open}" button on ${dr.path ?? 'the item page'}` };
        continue;
      }
      await btn.click();
      await page.getByRole('dialog').last().waitFor({ timeout: 8000 });
      await page.waitForTimeout(700);
      out[key] = await page.evaluate(measure);
      await page.getByRole('dialog').last().screenshot({ path: `${dir}/${tag}-${key}.png` }).catch(() => {});
      // With errors showing: press the primary action on the empty form.
      const save = page.locator('[data-ub-overlay-footer] button').last();
      await save.click().catch(() => {});
      await page.waitForTimeout(700);
      const withErr = await page.evaluate(() => {
        const d = [...document.querySelectorAll('[role=dialog]')].pop();
        const errs = [...d.querySelectorAll('[id$="-error"]')];
        return errs.map((e) => {
          const box = document.querySelector(`[aria-describedby~="${e.id}"]`);
          return box ? Math.round(e.getBoundingClientRect().top - box.getBoundingClientRect().bottom) : null;
        }).filter((x) => x !== null);
      });
      out[key].errorGap = [...new Set(withErr)];
      for (const f of verdict(out[key], width < 1024)) {
        const id = f.split(' ')[0];
        const lk = `${width}-${dr.name}`;
        if (LISTED[lk]?.[id]) listed.push(`${key}: ${f} — ${LISTED[lk][id]}`);
        else failures.push(`${key}: ${f}`);
      }
      await page.getByRole('dialog').last().screenshot({ path: `${dir}/${tag}-${key}-errors.png` }).catch(() => {});
      console.log(key, JSON.stringify(out[key]));
    }

    // ── Behaviour on Add customer (what a restyle must not break) ───────────
    // Once, in English light: the layout runs cover the other cases.
    if (locale !== 'en' || theme !== 'light') {
      await ctx.close();
      continue;
    }
    const openCustomer = async () => {
      await page.goto(`${base}/customers`, { waitUntil: 'load' });
      await page.waitForTimeout(1200);
      await page.getByRole('button', { name: /^Add customer/ }).first().click();
      const dlg = page.getByRole('dialog').last();
      await dlg.waitFor({ timeout: 8000 });
      await page.waitForTimeout(500);
      return dlg;
    };
    // A tap outside a half-filled drawer keeps the drawer and the text.
    let dlg = await openCustomer();
    await dlg.locator('input').first().fill('Half typed');
    await page.mouse.click(5, 5);
    await page.waitForTimeout(500);
    if (!(await page.getByRole('dialog').count())) failures.push(`${width}: a tap outside a half-filled drawer closed it`);
    else if ((await dlg.locator('input').first().inputValue()) !== 'Half typed') failures.push(`${width}: a tap outside lost the typed text`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const discard = page.getByRole('button', { name: /^(Discard|Leave|Close without)/ });
    if (await discard.count()) await discard.first().click();

    // A double-tapped Save makes ONE contact, read back by its unique name.
    const unique = `A5 check ${Date.now() % 1000000}`;
    const mobile = `9${String(Date.now()).slice(-9)}`;
    dlg = await openCustomer();
    await dlg.getByLabel(/^Name/).fill(unique);
    await dlg.getByLabel(/^Mobile/).fill(mobile);
    await page.locator('[data-ub-overlay-footer] button').last().dblclick();
    await page.waitForTimeout(2500);
    // The search matches loosely (it found a name never saved), so only an
    // EXACT name counts; the self-test proves that count can come back 0 (H2).
    const exact = async (name) =>
      ((await (await ctx.request.get(`${base}/api/v1/parties?q=${encodeURIComponent(name)}&page_size=25`)).json()).data ?? []).filter((p) => p.name === name);
    const found = await exact(unique);
    const ghost = await exact(`${unique} never`);
    if (ghost.length) failures.push(`${width}: self-test: the party search matched a name never saved`);
    if (found.length !== 1) failures.push(`${width}: a double-tapped Save made ${found.length} contacts`);
    else if (!String(found[0].mobile ?? '').endsWith(mobile.slice(-10))) failures.push(`${width}: saved mobile ${found[0].mobile}, typed ${mobile}`);
    console.log(`${width} behaviour: double Save → ${found.length} contact(s); self-test ghost ${ghost.length}`);

    // Every form drawer still SAVES after the restyle, read back by its record.
    // Add item: a new item with a price, found by its exact name.
    const itemName = `A5 item ${Date.now() % 1000000}`;
    await page.goto(`${base}/items`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: /^Add item/ }).first().click();
    dlg = page.getByRole('dialog').last();
    await dlg.waitFor({ timeout: 8000 });
    // The drawer focuses the name; tapping a switch first must not paint it red.
    await dlg.getByRole('switch').first().click();
    await page.waitForTimeout(300);
    if (await dlg.getByText('Enter an item name.').count()) failures.push(`${width}: tapping a switch painted the untouched name red`);
    await dlg.getByRole('switch').first().click();
    await dlg.getByLabel(/^Item name/).fill(itemName);
    await dlg.locator('#sellingPrice').fill('25');
    await page.locator('[data-ub-overlay-footer] button').last().click();
    await page.waitForTimeout(2500);
    const items = ((await (await ctx.request.get(`${base}/api/v1/items?q=${encodeURIComponent(itemName)}&page_size=10`)).json()).data ?? []).filter((x) => x.name === itemName);
    if (items.length !== 1) failures.push(`${width}: Add item saved ${items.length} items named "${itemName}"`);
    else if (Number(items[0].selling_price) !== 25) failures.push(`${width}: the saved item's price is ${items[0].selling_price}, typed 25`);
    // Adjust stock: remove 1 as damaged; on hand falls by exactly 1.
    const target = (await (await ctx.request.get(`${base}/api/v1/items?page_size=200&ordering=name`)).json()).data.find((x) => Number(x.on_hand) > 2 && !/^(A5 item|Edge|A6)/.test(x.name));
    const before = Number((await (await ctx.request.get(`${base}/api/v1/items/${target.id}`)).json()).data.on_hand);
    await page.goto(`${base}/items/${target.id}`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /^Adjust stock/ }).first().click();
    dlg = page.getByRole('dialog').last();
    await dlg.waitFor({ timeout: 8000 });
    // The reasons are radio chips; without one the drawer says "Choose a reason."
    await dlg.getByRole('radio', { name: 'Damaged' }).or(dlg.getByText('Damaged', { exact: true })).first().click();
    await dlg.getByPlaceholder('How many').first().fill('1');
    await page.locator('[data-ub-overlay-footer] button').last().click();
    await page.waitForTimeout(3000);
    const after = Number((await (await ctx.request.get(`${base}/api/v1/items/${target.id}`)).json()).data.on_hand);
    if (Math.abs(before - after - 1) > 0.0005) failures.push(`${width}: Adjust stock −1 moved on hand ${before} → ${after}`);
    console.log(`${width} saves: item "${itemName}" ×${items.length} at ₹${items[0]?.selling_price}; stock ${before} → ${after}`);

    // A reload with a half-filled drawer: nothing half-saved appears.
    const half = `A5 half ${Date.now() % 1000000}`;
    dlg = await openCustomer();
    await dlg.getByLabel(/^Name/).fill(half);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1500);
    if ((await exact(half)).length) failures.push(`${width}: a reload with a half-filled drawer saved "${half}"`);

    // Speed: the tap on Add customer to the drawer on screen.
    await page.goto(`${base}/customers`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const t0 = Date.now();
    await page.getByRole('button', { name: /^Add customer/ }).first().click();
    await page.getByRole('dialog').last().waitFor({ timeout: 8000 });
    const openMs = Date.now() - t0;
    console.log(`${width} speed: Add customer drawer on screen ${openMs} ms after the tap`);
    if (openMs > 1000) failures.push(`${width}: the drawer took ${openMs} ms to open`);
    await page.keyboard.press('Escape');

    // A 600 px-tall phone: the last field focused, the footer still on screen.
    if (width < 1024) {
      await page.setViewportSize({ width, height: 600 });
      dlg = await openCustomer();
      await dlg.locator('input:visible').last().focus();
      await page.waitForTimeout(500);
      const fit = await page.evaluate(() => {
        const f = document.querySelector('[data-ub-overlay-footer]')?.getBoundingClientRect();
        const a = document.activeElement?.getBoundingClientRect();
        const vh = window.visualViewport?.height ?? innerHeight;
        return { footerBottom: f ? Math.round(f.bottom) : null, focusedBottom: a ? Math.round(a.bottom) : null, vh: Math.round(vh) };
      });
      if (fit.footerBottom === null || fit.footerBottom > fit.vh + 1) failures.push(`${width}x600: the footer ends at ${fit.footerBottom}, below the ${fit.vh} px screen`);
      if (fit.focusedBottom > fit.vh) failures.push(`${width}x600: the focused field ends at ${fit.focusedBottom}, off the ${fit.vh} px screen`);
      console.log(`${width}x600 short screen:`, JSON.stringify(fit));
      await page.keyboard.press('Escape');
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync(`${dir}/${tag}.json`, JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out)) if (v.error) failures.push(`${k}: ${v.error}`);
for (const l of listed) console.log(`LISTED ${l}`);
console.log(failures.length ? `FAIL (${failures.length})\n- ${failures.join('\n- ')}` : 'PASS');
process.exitCode = failures.length ? 1 : 0;
