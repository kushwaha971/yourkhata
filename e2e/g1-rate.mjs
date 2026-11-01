// G1 — Today's rate (design §G1; report docs/performance/2026-11-01-shop-g1-todays-rate.md).
//
// QA Jewellery (e2e/fixtures/ad_cert_people.py, run it first): owner qa-jeweller,
// staff qa-jstaff, and yesterday's rates seeded. Checks, in order:
//   F   the owner types today's rates, saves, and the API reads back EXACTLY
//       what was typed (--skew adds ₹1 to the expectation: it must then fail);
//   F2  Same as yesterday fills the boxes from the API's yesterday, saves nothing;
//   F3  a zero rate is refused by name and nothing is sent;
//   L   every width × theme × language: no page wider than the screen, no text
//       cut, the design's sizes (phone box 130 × 40, dock buttons ≥ 44 tall,
//       desktop rates column 420 px), and the words from the API on screen;
//   S   staff see the rate and cannot change it;
//   K   a kirana has no menu row and the page is not there for it.
//
//   node e2e/g1-rate.mjs [--width=390,320,1024,1280] [--skew] [--tag=now]   (E2E_BASE, PW_CHROME, E2E_API)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const api = process.env.E2E_API ?? 'http://localhost:8000/api/v1';
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const widths = arg('width', '390,320,1024,1280').split(',').map(Number);
const tag = arg('tag', 'now');
const skew = process.argv.includes('--skew');
const dir = process.env.E2E_SHOTS ?? '/tmp/e2e-shots/g1';
mkdirSync(dir, { recursive: true });
const PASSWORD = 'AdCert-Test-2026!';

const failures = [];
const notes = [];
const fail = (k, m) => failures.push(`${k}: ${m}`);
let consoleErrors = 0;

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });

/** One sign-in per person (the per-IP budget is 20); every later context reuses it. */
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
  const ctx = await browser.newContext({
    storageState: state,
    viewport: { width, height: width < 1024 ? 800 : 860 },
    colorScheme: theme,
    locale: locale === 'hi' ? 'hi-IN' : 'en-IN',
  });
  // The app is dark only by the person's CHOICE (`ub_theme_choice`, bootScripts.ts),
  // never by the OS, so `colorScheme` alone photographs light twice.
  await ctx.addCookies([
    { name: 'ub_locale', value: locale, domain: new URL(base).hostname, path: '/' },
    { name: 'ub_theme_choice', value: theme, domain: new URL(base).hostname, path: '/' },
  ]);
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) {
      consoleErrors += 1;
      notes.push(`console ${width} ${theme} ${locale}: ${m.text().slice(0, 160)}`);
    }
  });
  return { ctx, page };
};

const readToday = async (ctx) => {
  const res = await ctx.request.get(`${api}/metal-rates/today`);
  return { status: res.status(), data: res.ok() ? (await res.json()).data : null };
};

const ready = (page) => page.waitForFunction(() => !!document.querySelector('[data-testid=rate-input-gold_22k]:not([disabled])'), null, { timeout: 15000 });

const owner = await session('qa-jeweller');
const staff = await session('qa-jstaff');
const kirana = await session('qa-owner');

// ── F / F2 / F3: the business task, read back from the API ───────────────────
{
  const { ctx, page } = await open(owner, { width: 1280 });
  await page.goto(`${base}/stock/rates`);
  await ready(page);
  const before = await readToday(ctx);
  if (!before.data?.yesterday) fail('F2', 'the fixture has no yesterday row');

  // F2 — Same as yesterday fills from the API's yesterday and sends nothing.
  let puts = 0;
  page.on('request', (r) => {
    if (r.method() === 'PUT' && r.url().includes('/metal-rates/today')) puts += 1;
  });
  await page.getByTestId('rate-same').click();
  const y = before.data?.yesterday?.rates ?? {};
  for (const p of ['gold_24k', 'gold_22k', 'gold_18k', 'silver']) {
    const shown = (await page.getByTestId(`rate-input-${p}`).inputValue()).replaceAll(',', '');
    const want = y[p] ? String(Number(y[p])) : '';
    if (shown !== want) fail('F2', `${p} box shows "${shown}", yesterday was "${want}"`);
  }
  if (puts !== 0) fail('F2', `Same as yesterday sent ${puts} save(s)`);

  // F3 — a zero is refused by name, nothing sent.
  await page.getByTestId('rate-input-silver').fill('0');
  await page.getByTestId('rate-save').click();
  await page.waitForTimeout(400);
  if (!(await page.getByText('Enter a rate above zero.').count())) fail('F3', 'no refusal under Silver');
  if (puts !== 0) fail('F3', 'a zero rate was sent');

  // F — type a distinctive set, save, read back exactly.
  const stamp = (Date.now() % 97) + 1; // a different figure every run, so a stale read cannot pass
  const typed = { gold_24k: String(12700 + stamp), gold_22k: String(11640 + stamp), gold_18k: '', silver: '150.5' };
  for (const [p, v] of Object.entries(typed)) await page.getByTestId(`rate-input-${p}`).fill(v);
  await page.getByTestId('rate-save').click();
  await page.getByText("Today's rates saved").first().waitFor({ timeout: 8000 });
  const after = await readToday(ctx);
  const got = after.data?.today?.rates ?? {};
  for (const [p, v] of Object.entries(typed)) {
    const want = v === '' ? null : (Number(v) + (skew && p === 'gold_22k' ? 1 : 0)).toFixed(2);
    if (got[p] !== want) fail('F', `${p}: API has ${got[p]}, typed ${v} (expected ${want})`);
  }
  if (!after.data?.today?.set_by) fail('F', 'no "set by" on today');
  // The screen shows what the API holds: the history's first row and the set line.
  await page.reload();
  await ready(page);
  const box = (await page.getByTestId('rate-input-gold_22k').inputValue()).replaceAll(',', '');
  if (box !== String(Number(got.gold_22k))) fail('F', `after reload the 22K box shows ${box}, API ${got.gold_22k}`);
  // The box must not hide paise the API holds (seen: ₹150.50 saved, "150" shown).
  const silverBox = Number((await page.getByTestId('rate-input-silver').inputValue()).replaceAll(',', ''));
  if (silverBox !== Number(got.silver)) fail('F', `after reload the Silver box shows ${silverBox}, API ${got.silver}`);
  const firstRow = await page.locator('[data-testid=ub-grid-row]').first().innerText();
  // Every history column has room and none sits on another (seen: one widthShare
  // collapsed the other four into one overlapping heap, while innerText still read fine).
  const heads = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid=ub-grid-table] th')].map((th) => {
      const r = th.getBoundingClientRect();
      return [th.textContent.trim(), Math.round(r.left), Math.round(r.width)];
    })
  );
  heads.forEach(([name, left, w], n) => {
    if (w < 40) fail('F', `history column "${name}" is ${w}px wide`);
    if (n > 0 && left < heads[n - 1][1] + heads[n - 1][2] - 1) fail('F', `history column "${name}" overlaps "${heads[n - 1][0]}"`);
  });
  const want22 = `₹${Number(got.gold_22k).toLocaleString('en-IN')}`;
  if (!firstRow.includes(want22)) fail('F', `history's first row "${firstRow.replace(/\s+/g, ' ')}" lacks ${want22}`);
  const setLine = await page.getByTestId('rate-set-line').innerText();
  if (!setLine.includes(after.data.today.set_by)) fail('F', `set line "${setLine}" does not name ${after.data.today.set_by}`);
  // F4 — the month picker: last month's rows, read back from the API.
  const prev = new Date(`${after.data.day.slice(0, 7)}-01T00:00:00`);
  prev.setMonth(prev.getMonth() - 1);
  const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  const hist = (await (await ctx.request.get(`${api}/metal-rates?month=${prevMonth}`)).json()).data.rows;
  await page.getByRole('combobox', { name: 'Month' }).click();
  await page.getByRole('option', { name: prev.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) }).click();
  await page.waitForFunction((n) => document.querySelectorAll('[data-testid=ub-grid-row]').length === n, hist.length, { timeout: 8000 }).catch(() => undefined);
  const shownRows = await page.locator('[data-testid=ub-grid-row]').count();
  if (hist.length < 2) fail('F4', `the fixture left ${hist.length} rows in ${prevMonth}`);
  if (shownRows !== hist.length) fail('F4', `${prevMonth}: ${shownRows} rows on screen, API has ${hist.length}`);
  const top = hist[0] ? `₹${Number(hist[0].rates.gold_22k).toLocaleString('en-IN')}` : '';
  if (hist[0] && !(await page.locator('[data-testid=ub-grid-row]').first().innerText()).includes(top)) fail('F4', `first row lacks ${top}`);
  notes.push(`F saved 22K ${got.gold_22k}, 24K ${got.gold_24k}, silver ${got.silver}; history row: ${firstRow.replace(/\s+/g, ' ')}`);
  await ctx.close();
}

// ── L: every width × theme × language ────────────────────────────────────────
const measure = () => {
  const out = { overflow: document.documentElement.scrollWidth - window.innerWidth, cut: [] };
  const main = document.querySelector('main') ?? document.body;
  for (const el of main.querySelectorAll('span, p, h1, h2, button, label, td, th')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || getComputedStyle(el).visibility === 'hidden') continue;
    if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') {
      out.cut.push(el.textContent.trim().slice(0, 40));
    }
  }
  const box = document.querySelector('[data-testid=rate-input-gold_22k]');
  const shell = box?.closest('[data-ub-money-input], .relative, label') ?? box;
  const b = shell?.getBoundingClientRect();
  out.box = b ? [Math.round(b.width), Math.round(b.height)] : null;
  out.save = (() => {
    const r = document.querySelector('[data-testid=rate-save]')?.getBoundingClientRect();
    return r ? [Math.round(r.height), Math.round(r.bottom), window.innerHeight] : null;
  })();
  const px = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { h: Math.round(r.height), font: parseFloat(cs.fontSize), weight: cs.fontWeight };
  };
  out.btn = px(document.querySelector('[data-testid=rate-same]'));
  out.row = px(document.querySelector('[data-testid=rate-row-gold_22k]'));
  const card = document.querySelector('[data-testid=rate-screen] > *');
  out.col = card ? Math.round(card.getBoundingClientRect().width) : null;
  return out;
};

for (const width of widths) {
  for (const theme of ['light', 'dark']) {
    for (const locale of ['en', 'hi']) {
      const key = `L ${width} ${theme} ${locale}`;
      const { ctx, page } = await open(owner, { width, theme, locale });
      try {
        await page.goto(`${base}/stock/rates`);
        await ready(page);
        await page.waitForTimeout(300);
        const m = await page.evaluate(measure);
        const painted = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        if (painted !== theme) fail(key, `the page painted ${painted}, not ${theme}`);
        if (m.overflow > 0) fail(key, `page ${m.overflow}px wider than the screen`);
        if (m.cut.length) fail(key, `text cut: ${m.cut.slice(0, 4).join(' | ')}`);
        if (width < 1024) {
          if (!m.box || Math.abs(m.box[0] - 130) > 2 || Math.abs(m.box[1] - 40) > 2) fail(key, `rate box ${m.box} (design 130×40)`);
          if (!m.save || m.save[0] < 44) fail(key, `Save ${m.save?.[0]}px tall (< 44)`);
          if (m.save && m.save[1] > m.save[2]) fail(key, `Save below the screen (${m.save[1]} > ${m.save[2]})`);
          // design .btn.lg 46 / 15px, .li min-height 56
          // 320 px has no mock; the two dock buttons step down a size there to fit.
          // Design .btn.lg is 46 / 15 px; the design system's lg is 44 px with the shared
          // button type (DESIGN-SYSTEM.md). Listed for the owner; checked against the system.
          if (m.btn && m.btn.h !== 44) fail(key, `dock button ${m.btn.h}px (design system lg 44)`);
          if (m.row && m.row.h < 56) fail(key, `rate row ${m.row.h}px (design ≥ 56)`);
        } else {
          if (m.col !== 420) fail(key, `rates column ${m.col}px (design 420)`);
          // design .btn 40 / 14px 600
          // Height matches the design (40); its 14 px / 600 type differs from the shared
          // button token (16–17 px / 700). Listed for the owner, not changed on one screen.
          if (m.btn && m.btn.h !== 40) fail(key, `header button ${m.btn.h}px (design 40)`);
        }
        const title = locale === 'hi' ? 'आज का भाव' : "Today's rate";
        if (!(await page.getByRole('heading', { name: title }).count())) fail(key, `no "${title}" heading`);
        await page.screenshot({ path: `${dir}/${tag}-${width}-${theme}-${locale}.png`, fullPage: true });
        notes.push(`${key}: box ${m.box} save ${m.save} col ${m.col} btn ${JSON.stringify(m.btn)} row ${m.row?.h}`);
      } catch (e) {
        fail(key, `error ${e.message.split('\n')[0]}`);
      }
      await ctx.close();
    }
  }
}

// ── S: staff read, cannot change ─────────────────────────────────────────────
{
  const { ctx, page } = await open(staff, { width: 390 });
  await page.goto(`${base}/stock/rates`);
  await page.getByTestId('rate-input-gold_22k').waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  if (!(await page.getByTestId('rate-input-gold_22k').isDisabled())) fail('S', 'staff can type a rate');
  if (!(await page.getByTestId('rate-save').isDisabled())) fail('S', 'staff can tap Save');
  const res = await ctx.request.put(`${api}/metal-rates/today`, { data: { gold_22k: '1' } });
  if (res.status() !== 403) fail('S', `staff PUT answered ${res.status()} (want 403)`);
  await page.screenshot({ path: `${dir}/${tag}-staff-390.png`, fullPage: true });
  await ctx.close();
}

// ── K: a kirana never sees it ────────────────────────────────────────────────
{
  const { ctx, page } = await open(kirana, { width: 1280 });
  const res = await readToday(ctx);
  if (res.status !== 404) fail('K', `kirana API answered ${res.status} (want 404)`);
  await page.goto(`${base}/items`);
  await page.waitForTimeout(1500);
  if (await page.getByRole('link', { name: "Today's rate" }).count()) fail('K', 'kirana menu shows Today\'s rate');
  await ctx.close();
}

await browser.close();
console.log(notes.join('\n'));
console.log(failures.join('\n'));
console.log(`${failures.length} failures, ${consoleErrors} console errors${skew ? ' (SKEWED: failures expected)' : ''}`);
process.exit(skew ? (failures.length ? 0 : 1) : failures.length || consoleErrors ? 1 : 0);
