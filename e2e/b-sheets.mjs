// Part B contact sheets — every case of B1, B2 and B3 photographed on the live
// app and laid out as one sheet per piece, so the owner can look at all of
// them at once (owner, 30 Oct 2026: "screenshot contact sheets for every case,
// phone and desktop, light/dark, EN/HI, every state").
//
// Read-only: B1 is opened by the QA owner (the wizard is never continued past
// a client-side refusal), B2/B3 by the per-kind test owners from
// e2e/fixtures/b2_kind_owners.py. One sign-in per account (the per-IP budget).
//
//   node e2e/b-sheets.mjs [--tag=after] [--width=390,320,1024,1280]   (E2E_BASE, PW_CHROME)
//
// Shots: $E2E_SHOTS (default /tmp/e2e-shots/b-sheets)/<tag>/…; sheets: <tag>-sheet-<piece>.png
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3006';
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const tag = arg('tag', 'now');
const widths = arg('width', '390,320,1024,1280').split(',').map(Number);
const root = process.env.E2E_SHOTS ?? '/tmp/e2e-shots/b-sheets';
const dir = `${root}/${tag}`;
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const problems = [];
const sheetsOnly = process.argv.includes('--sheets-only');

async function signIn(email, password) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', password);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

async function open(storageState, width, theme, locale) {
  const phone = width < 1024;
  const ctx = await browser.newContext({
    storageState,
    viewport: { width, height: phone ? 860 : 900 },
    colorScheme: theme,
    isMobile: phone,
    hasTouch: phone,
  });
  // The theme is the CHOSEN one (`ub_theme_choice`), not the OS's: a context's
  // colorScheme alone left every "dark" shot light (B-thread, 30 Oct 2026).
  const domain = new URL(base).hostname;
  await ctx.addCookies([
    { name: 'ub_locale', value: locale, domain, path: '/' },
    { name: 'ub_theme_choice', value: theme, domain, path: '/' },
  ]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`${width}-${theme}-${locale}: ${e.message.slice(0, 120)}`));
  return { ctx, page, phone };
}

/** The generic measuring checks, on every shot: no page overflow, no cut text. */
async function measure(page, name) {
  const m = await page.evaluate(() => {
    const cut = [...document.querySelectorAll('main span, main p, main label, main h1, main h2, main h3, nav span')]
      .filter((e) => e.children.length === 0 && e.textContent.trim())
      .filter((e) => {
        const s = getComputedStyle(e);
        if (s.textOverflow !== 'ellipsis' && s.webkitLineClamp === 'none') return false;
        return e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1;
      })
      .map((e) => e.textContent.trim().slice(0, 40));
    return { overflow: document.documentElement.scrollWidth - window.innerWidth, cut };
  });
  if (m.overflow > 0) problems.push(`${name}: page ${m.overflow}px wider than the screen`);
  if (m.cut.length) problems.push(`${name}: text cut — ${m.cut.join(' | ')}`);
}

async function shot(page, name, { full = true, at } = {}) {
  // The wizard scrolls inside its own pane on a desktop, so a full-page shot
  // there is one viewport; show the part the state is about instead.
  if (at) await page.locator(at).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(350);
  const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (!name.includes(`-${theme}-`)) problems.push(`${name}: page drew the ${theme} theme`);
  await measure(page, name);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: full });
}

const cases = [];
for (const width of widths) for (const theme of ['light', 'dark']) for (const locale of ['en', 'hi']) cases.push({ width, theme, locale });

// ── B1: the wizard's step 1 ────────────────────────────────────────────────
if (!sheetsOnly) {
  const state = await signIn('scale@digikhaato.test', 'Scale-Run-2026!');
  for (const { width, theme, locale } of cases) {
    const key = `${width}-${theme}-${locale}`;
    const { ctx, page, phone } = await open(state, width, theme, locale);
    try {
      await page.goto(`${base}/onboarding/step/1`, { waitUntil: 'networkidle' });
      if (!(await page.locator('[data-kind=other]').count())) {
        await page.getByRole('checkbox', { name: /Shop|दुकान/ }).first().click();
      }
      await page.locator('[data-kind=kirana]').first().waitFor({ timeout: 15000 });
      const d = (at) => ({ full: phone, at: phone ? undefined : at });
      await shot(page, `b1-${key}-1-open`, d('[data-kind=kirana]'));
      await page.locator('[data-kind=hardware]').first().click();
      await shot(page, `b1-${key}-2-hardware`, d('[data-kind=other]'));
      await page.locator('[data-kind=wholesale]').first().click();
      await page.locator('[role=radiogroup]').nth(1).locator('[data-kind=kirana]').click();
      await shot(page, `b1-${key}-3-wholesale-kirana`, d('[role=radiogroup] >> nth=1'));
      await page.locator('[role=radiogroup]').first().locator('[data-kind=other]').click();
      await page.getByRole('radio', { name: /Agri|कृषि|खेती/ }).first().click({ timeout: 8000 });
      await shot(page, `b1-${key}-4-other-agri`, d('[role=switch] >> nth=3'));
      // Continue with no name: the client refuses, nothing is sent.
      await page.getByRole('button', { name: /Continue|आगे/ }).last().click();
      await shot(page, `b1-${key}-5-continue-no-name`, d('input'));
    } catch (e) {
      problems.push(`b1 ${key}: ${e.message.slice(0, 140)}`);
      await page.screenshot({ path: `${dir}/b1-${key}-error.png`, fullPage: true }).catch(() => {});
    }
    await ctx.close();
  }
}

// ── B2: menus and words per kind; B3: Settings › Shop features ─────────────
const owners = [
  ['hardware', 'b2-hardware@yourkhata.test'],
  ['wholesale', 'b2-kirana-wholesale@yourkhata.test'],
  ['jewellery', 'b2-jewellery@yourkhata.test'],
];
for (const [kind, email] of sheetsOnly ? [] : owners) {
  const state = await signIn(email, 'B2-Kinds-Test-2026!');
  for (const { width, theme, locale } of cases) {
    const key = `${width}-${theme}-${locale}`;
    const { ctx, page, phone } = await open(state, width, theme, locale);
    try {
      await page.goto(`${base}${phone ? '/more' : '/home'}`, { waitUntil: 'networkidle' });
      await shot(page, `b2-${kind}-${key}-${phone ? 'more' : 'home'}`, { full: phone });
      if (kind === 'hardware' || (theme === 'light' && locale === 'en')) {
        await page.goto(`${base}/settings/shop-features`, { waitUntil: 'networkidle' });
        await page.getByRole('switch').first().waitFor({ timeout: 15000 });
        await shot(page, `b3-${kind}-${key}-features`, { full: false });
      }
    } catch (e) {
      problems.push(`b2/b3 ${kind} ${key}: ${e.message.slice(0, 140)}`);
    }
    await ctx.close();
  }
}

// ── Contact sheets ─────────────────────────────────────────────────────────
const files = readdirSync(dir).filter((f) => f.endsWith('.png'));
for (const piece of ['b1', 'b2', 'b3']) {
  const mine = files.filter((f) => f.startsWith(`${piece}-`)).sort((a, b) => {
    const w = (f) => Number(f.match(/-(\d{3,4})-/)?.[1] ?? 0);
    return w(a) - w(b) || a.localeCompare(b);
  });
  for (const group of ['phone', 'desktop']) {
    const set = mine.filter((f) => (Number(f.match(/-(\d{3,4})-/)?.[1]) < 1024) === (group === 'phone'));
    if (!set.length) continue;
    const ctx = await browser.newContext({ viewport: { width: 2400, height: 1200 } });
    const page = await ctx.newPage();
    const col = group === 'phone' ? 220 : 460;
    const html = `<html><body style="margin:0;padding:16px;background:#e9eef0;font:13px system-ui">
      <h1 style="font:600 20px system-ui;margin:0 0 12px">${piece.toUpperCase()} · ${group} · ${tag} · ${set.length} shots</h1>
      <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start">${set
        .map((f) => `<figure style="margin:0;width:${col}px;background:#fff;border:1px solid #c9d3d6;border-radius:8px;padding:6px">
          <img src="${f}" style="width:100%;display:block"><figcaption style="margin-top:4px;word-break:break-all">${f.replace('.png', '')}</figcaption></figure>`)
        .join('')}</div></body></html>`;
    // A file next to the shots: an about:blank page may not load file:// images.
    const sheetHtml = `${dir}/sheet-${piece}-${group}.html`;
    writeFileSync(sheetHtml, html);
    await page.goto(`file://${sheetHtml}`, { waitUntil: 'load' });
    await page.screenshot({ path: `${root}/${tag}-sheet-${piece}-${group}.png`, fullPage: true });
    await ctx.close();
  }
}
await browser.close();
console.log(problems.length ? `PROBLEMS (${problems.length}):\n  ${problems.join('\n  ')}` : 'no overflow, no cut text, no page errors');
console.log(`sheets: ${root}/${tag}-sheet-*.png`);
process.exitCode = problems.length ? 1 : 0;
