#!/usr/bin/env node
/**
 * revamp-shots.mjs — R-DEC-07: every revamp piece is photographed on the live
 * stack, at phone and desktop sizes, in each state it has, before the next
 * piece starts (docs/revamp/11 "Screenshots after each piece").
 *
 *   NODE_PATH=$(npm root -g) node e2e/revamp-shots.mjs --piece=loading
 *
 * Pieces:
 *   loading  F1's route loading views. The navigation's own RSC request is
 *            HELD for 4 s, so the frame captured is the one a merchant on a
 *            slow line stares at between the tap and the new screen, not
 *            whatever happened to be painted when a timer fired. Each case is
 *            shot twice: 300 ms after the tap (the loading view) and once the
 *            new screen has settled (what it hands over to).
 *
 *   lock     F3's double-tap lock, on the two money writes a merchant makes
 *            most: an Udhaar "You gave" entry and a Lending collection. The
 *            save's POST is HELD for 3 s and Save is tapped twice; the busy
 *            button is photographed, and the POSTs that left are COUNTED —
 *            the assertion is the network, not the paint (the PTY-02 lesson).
 *            Then a dropped answer: the first collection reaches the server
 *            and the browser is told it timed out; "Save" again must carry
 *            the same Idempotency-Key and come back `Idempotent-Replayed`.
 *
 *   press    F2's pressed looks. A mouse press is HELD (CDP touch does not set
 *            :active headless, calibrated in the Phase 1 baseline) and the
 *            control is photographed at rest and pressed, side by side.
 *
 *   apps     F4's app switching. Phone: the bottom bar's App button (the open
 *            app's icon and short name), the App sheet it opens, its lower
 *            rows, and a switch to another app and back, which must land on
 *            the screen that app was left on, not its home. Desktop: the
 *            sidebar's one Apps row (R-DEC-09: no app is listed in the rail),
 *            the Apps page it opens, the same switch and return,
 *            and the page and rail colours READ from the computed style, not
 *            judged from a picture. Every text node in the bar, the sheet and
 *            the rail is measured against its own box (no cut words), and the
 *            page against the viewport. `--locale=hi` repeats it in Hindi.
 *
 * Writes /tmp/e2e-shots/revamp/<piece>/<width>-<theme>-<case>-<when>.png.
 * Same sign-in and stack as perf-app.mjs (the seed_scale owner).
 */
import { closeBrowserWithDeadline } from './browser-cleanup.mjs';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = require('playwright')); }

const FRONTEND = process.env.E2E_FRONTEND ?? 'http://localhost:3000';
const EMAIL = process.env.E2E_EMAIL ?? 'scale@digikhaato.test';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Scale-Run-2026!';
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).slice(n.length + 3);
const PIECE = arg('piece', 'loading');
// Screen-specific harnesses keep the same approved piece entry point.
if (['bills', 'bill-detail'].includes(PIECE)) {
  process.env.E2E_SHOTS = `${process.env.E2E_SHOTS ?? '/tmp/e2e-shots'}/revamp/${PIECE}`;
  if (PIECE === 'bills') await import('./revamp-bills.mjs');
  else await import('./revamp-bill-detail.mjs');
  process.exit(process.exitCode ?? 0);
}

const DIR = `${process.env.E2E_SHOTS ?? '/tmp/e2e-shots'}/revamp/${PIECE}`;
mkdirSync(DIR, { recursive: true });

const SIZES = {
  320: { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  390: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  1024: { viewport: { width: 1024, height: 768 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  1280: { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
};
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' });
const failures = [];

const LOCALE = arg('locale', 'en');

async function signedInContext(width, theme) {
  const ctx = await browser.newContext(SIZES[width]);
  const page = await ctx.newPage();
  await page.goto(`${FRONTEND}/login/email`);
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60_000 });
  const host = new URL(FRONTEND).hostname;
  await ctx.addCookies([
    { name: 'ub_theme_choice', value: theme, domain: host, path: '/' },
    { name: 'ub_locale', value: LOCALE, domain: host, path: '/' },
  ]);
  await page.close();
  return ctx;
}

/** The navigation's server payload (RSC, not a prefetch) waits `ms` before it is sent. */
async function holdNavigation(page, ms) {
  await page.route('**/*', async (route) => {
    const h = route.request().headers();
    const isNav = h.rsc === '1' && !h['next-router-prefetch'] && !h['next-router-segment-prefetch'];
    if (isNav) await new Promise((r) => setTimeout(r, ms));
    await route.fallback();
  });
}

// What a merchant taps, per case: start screen, what to tap, the path it should
// reach, a name. The tap is a real click on what is visible, so the router —
// and whether it prefetched the loading view — behaves as it does for a person.
// `link` cases are next/link; `button` cases navigate with router.push (H2).
const link = (href) => (page) => page.locator(`a[href="${href}"]`).filter({ visible: true }).first();
const button = (name) => (page) => page.getByRole('button', { name }).filter({ visible: true }).first();
const ONLY = arg('cases', '').split(',').filter(Boolean);
const ALL_CASES = [
  ['/dashboard', link('/customers'), '^/customers$', 'list'],
  ['/customers', link('/dashboard'), '^/dashboard$', 'home'],
  ['/sales/invoices', button(/^New bill$/), '^/sales/invoices/new$', 'form-button'],
  ['/customers', (page) => (page.viewportSize().width < 1024
    ? page.locator('main [data-testid="ub-grid-card"] button[aria-label^="Open "]').filter({ visible: true }).first()
    : page.locator('main tr[data-testid="ub-grid-row"] button:not([role="checkbox"])').filter({ visible: true }).first()),
  '^/parties/[^/]+$', 'detail-row'],
  ['/library', link('/library/members'), '^/library/members$', 'library-list'],
  ['/lending', link('/lending/loans'), '^/lending/loans$', 'lending-list'],
];
const CASES = ONLY.length ? ALL_CASES.filter((c) => ONLY.includes(c[3])) : ALL_CASES;

async function measureOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

const WIDTHS = arg('widths', '390,320,1280').split(',').map(Number);

// What to press, per width: [start, locator, name]. Never released, so nothing navigates.
const PRESS_CASES = {
  390: [
    ['/customers', (p) => p.locator('nav a[href="/sales/invoices"]').filter({ visible: true }).first(), 'bottom-tab'],
    ['/sales/invoices', (p) => p.getByRole('button', { name: /^New bill$/ }).filter({ visible: true }).first(), 'primary-button'],
    ['/customers', (p) => p.locator('main [data-testid="ub-grid-card"] button[aria-label^="Open "]').filter({ visible: true }).first(), 'list-row'],
  ],
  1280: [
    ['/customers', (p) => p.locator('nav a[href="/sales/invoices"]').filter({ visible: true }).first(), 'sidebar-row'],
    ['/customers', (p) => p.locator('main tr[data-testid="ub-grid-row"] button:not([role="checkbox"])').filter({ visible: true }).first(), 'table-row'],
    ['/customers', (p) => p.getByRole('button', { name: /^Export|^Sort|More actions/ }).filter({ visible: true }).first(), 'secondary-button'],
  ],
};

async function shootPress() {
  for (const width of WIDTHS.filter((w) => PRESS_CASES[w])) {
    for (const theme of THEMES) {
      const ctx = await signedInContext(width, theme);
      for (const [start, find, name] of PRESS_CASES[width]) {
        const page = await ctx.newPage();
        await page.goto(`${FRONTEND}${start}`, { waitUntil: 'networkidle' });
        const el = find(page);
        if (!(await el.count())) { failures.push(`${width} ${theme} ${name}: not found on ${start}`); await page.close(); continue; }
        // The row a control sits in, so a row tint is in the picture.
        const target = name === 'table-row' ? el.locator('xpath=ancestor::tr[1]') : el;
        const box = await el.boundingBox();
        const pad = 12;
        const clipOf = async () => {
          const b = await target.boundingBox();
          return { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: Math.min(width, b.width + 2 * pad), height: b.height + 2 * pad };
        };
        await page.mouse.move(0, 0);
        const file = `${DIR}/${width}-${theme}-${name}`;
        await page.screenshot({ path: `${file}-1-rest.png`, clip: await clipOf() });
        const rest = await target.evaluate((n) => { const c = getComputedStyle(n); const i = n.querySelector('span'); return `${c.backgroundColor} ${c.transform} ${i ? getComputedStyle(i).backgroundColor : ''}`; });
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(150);
        await page.screenshot({ path: `${file}-2-pressed.png`, clip: await clipOf() });
        const pressed = await target.evaluate((n) => { const c = getComputedStyle(n); const i = n.querySelector('span'); return `${c.backgroundColor} ${c.transform} ${i ? getComputedStyle(i).backgroundColor : ''}`; });
        await page.mouse.up({ button: 'left' }).catch(() => {});
        const line = `${width} ${theme} ${name}: rest [${rest}] → pressed [${pressed}]`;
        console.log(line);
        if (rest === pressed) failures.push(`${line} — NO CHANGE`);
        await page.close();
      }
      await ctx.close();
    }
  }
}
const THEMES = arg('themes', 'light,dark').split(',');

// Each opens a money sheet ready to save and returns [save button, POST matcher].
const LOCK_CASES = [
  ['udhaar-entry', async (page) => {
    await page.goto(`${FRONTEND}/khata`, { waitUntil: 'networkidle' });
    const row = page.viewportSize().width < 1024
      ? page.locator('main [data-testid="ub-grid-card"] button[aria-label^="Open "]').filter({ visible: true }).first()
      : page.locator('main tr[data-testid="ub-grid-row"] button:not([role="checkbox"])').filter({ visible: true }).first();
    await row.click();
    await page.waitForURL(/\/parties\/[^/]+$/, { timeout: 20_000 });
    await page.getByRole('button', { name: /^You gave/ }).filter({ visible: true }).first().click();
    const amount = page.getByRole('textbox', { name: /^Amount/ }).filter({ visible: true }).first();
    await amount.fill('1');
    return [page.getByRole('button', { name: /^Save/ }).filter({ visible: true }).last(), /\/ledger-entries$/];
  }],
  ['lending-collect', async (page) => {
    await page.goto(`${FRONTEND}/lending/loans`, { waitUntil: 'networkidle' });
    await page.locator('main button').filter({ hasText: /LN-\d{4}/ }).filter({ visible: true }).first().click();
    // A loan opens as a sheet over the list; Collect is its marigold icon button.
    await page.getByTestId('lending-loan-collect').filter({ visible: true }).first().click();
    const amount = page.getByRole('textbox', { name: 'Amount received' });
    await amount.fill('1');
    // The preview card arrives after a debounce and pushes Save down; a tap
    // during that shift lands on empty sheet, which is not what is under test.
    await page.getByText(/^Left after this/).filter({ visible: true }).first().waitFor({ timeout: 15_000 });
    await page.waitForTimeout(300);
    return [page.getByTestId('lending-collect-save'), /\/lending\/loans\/[^/]+\/collections$/];
  }],
];

async function shootLock() {
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      const ctx = await signedInContext(width, theme);
      for (const [name, open] of LOCK_CASES) {
        const page = await ctx.newPage();
        const file = `${DIR}/${width}-${theme}-${name}`;
        let save, match;
        try { [save, match] = await open(page); } catch (error) {
          failures.push(`${width} ${theme} ${name}: could not open the sheet (${error.message.split('\n')[0]})`);
          await page.screenshot({ path: `${file}-0-open-failed.png` });
          await page.close(); continue;
        }
        await page.screenshot({ path: `${file}-1-ready.png` });
        // A handle, not the locator: the button's NAME changes to "Saving…".
        save = await save.elementHandle();
        const posts = [];
        await page.route('**/*', async (route) => {
          const r = route.request();
          if (r.method() === 'POST' && match.test(new URL(r.url()).pathname)) {
            posts.push(r.headers()['idempotency-key']);
            await new Promise((done) => setTimeout(done, 3000));
          }
          await route.fallback();
        });
        // Two taps 60 ms apart: a thumb that is not sure the first one took.
        await save.click({ noWaitAfter: true });
        await page.waitForTimeout(60);
        // `force`: the second tap lands on whatever the button has become.
        await save.click({ noWaitAfter: true, force: true, timeout: 2000 }).catch(() => {});
        await page.keyboard.press('Enter').catch(() => {});
        await page.waitForTimeout(250);
        const busy = await save.getAttribute('aria-busy');
        await page.screenshot({ path: `${file}-2-busy.png` });
        await page.waitForTimeout(4500);
        await page.screenshot({ path: `${file}-3-saved.png` });
        const over = await measureOverflow(page);
        const line = `${width} ${theme} ${name}: POSTs sent ${posts.length} · busy while held ${busy === 'true' ? 'yes' : 'NO'} · sideways scroll ${over} px`;
        console.log(line);
        if (posts.length !== 1 || busy !== 'true') failures.push(line);
        if (over > 0) failures.push(`${line} — page wider than the screen`);
        await page.close();
      }
      // The dropped answer, once per size: light only, it is a network check.
      if (theme === THEMES[0]) {
        const page = await ctx.newPage();
        let found, match;
        try { [found, match] = await LOCK_CASES[1][1](page); } catch (error) {
          failures.push(`${width} retry after a lost answer: could not open Collect (${error.message.split('\n')[0]})`);
          await page.close(); await ctx.close(); continue;
        }
        const save = await found.elementHandle();
        const sent = [];
        let first = true;
        await page.route('**/*', async (route) => {
          const r = route.request();
          if (r.method() !== 'POST' || !match.test(new URL(r.url()).pathname)) return route.fallback();
          const response = await route.fetch();
          sent.push({ key: r.headers()['idempotency-key'], status: response.status(), replayed: response.headers()['idempotent-replayed'] ?? '', body: await response.text() });
          if (first) { first = false; return route.abort('timedout'); }
          return route.fulfill({ response });
        });
        await save.click();
        await page.waitForTimeout(2500);
        // One plain click must send it: a desktop footer that moved between
        // press and release once swallowed this tap (fixed in CollectDialog).
        if (sent.length !== 1) failures.push(`${width} Collect: the first tap on Save sent ${sent.length} requests`);
        await page.screenshot({ path: `${DIR}/${width}-${theme}-lending-collect-4-no-answer.png` });
        await save.click().catch(() => {});
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `${DIR}/${width}-${theme}-lending-collect-5-retried.png` });
        const receipt = (b) => { try { return JSON.parse(b).data.receipt_number; } catch { return null; } };
        const same = sent.length === 2 && sent[0].key === sent[1].key;
        const replayed = sent[1]?.replayed === 'true' && receipt(sent[0].body) === receipt(sent[1]?.body);
        const line = `${width} retry after a lost answer: ${sent.length} POSTs · same key ${same ? 'yes' : 'NO'} · server replayed ${replayed ? 'yes' : 'NO'} (${sent.map((x) => `${x.status}${x.replayed ? ' replayed' : ''} ${receipt(x.body)}`).join(', ')})`;
        console.log(line);
        if (!same || !replayed) failures.push(line);
        await page.close();
      }
      await ctx.close();
    }
  }
}

/** Text nodes inside `root` whose rendered text is wider than their own box: a cut word. */
async function cutText(page, selector) {
  return page.evaluate((sel) => {
    const out = [];
    for (const root of document.querySelectorAll(sel)) {
      for (const el of root.querySelectorAll('*')) {
        if (!el.childNodes.length || [...el.childNodes].every((n) => n.nodeType !== 3 || !n.textContent.trim())) continue;
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        const clips = getComputedStyle(el).overflow !== 'visible';
        if (clips && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) out.push(el.textContent.trim());
      }
    }
    return out;
  }, selector);
}

const bg = (page, sel) => page.locator(sel).first().evaluate((n) => getComputedStyle(n).backgroundColor);
const pathOf = (page) => new URL(page.url()).pathname;
const settle = async (page) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(600);
};

async function shootApps() {
  const tag = LOCALE === 'en' ? '' : `-${LOCALE}`;
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      const ctx = await signedInContext(width, theme);
      const page = await ctx.newPage();
      const file = (name) => `${DIR}/${width}-${theme}${tag}-${name}.png`;
      const fail = (m) => { failures.push(`${width} ${theme}${tag}: ${m}`); console.log(`  FAIL ${m}`); };
      // A screen deeper than an app's home, so "back where you were" is visible.
      const place = '/customers';
      await page.goto(`${FRONTEND}${place}`, { waitUntil: 'networkidle' });
      await settle(page);
      if (width < 1024) {
        const appButton = page.locator('nav button[aria-haspopup="dialog"]').filter({ visible: true }).first();
        if (!(await appButton.count())) { fail('no App button in the bottom bar'); await ctx.close(); continue; }
        const label = await appButton.getAttribute('aria-label');
        console.log(`${width} ${theme}${tag} App button: "${(await appButton.innerText()).trim()}" · label "${label}"`);
        await page.screenshot({ path: file('1-bar') });
        const cutBar = await cutText(page, 'nav[aria-label]');
        if (cutBar.length) fail(`bar text cut: ${cutBar.join(' | ')}`);
        await appButton.click();
        const sheet = page.getByRole('dialog');
        await sheet.waitFor({ timeout: 10_000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: file('2-sheet') });
        const tiles = sheet.getByTestId('app-sheet-tiles').locator('button');
        const names = (await tiles.allInnerTexts()).map((x) => x.trim());
        const current = await sheet.locator('button[aria-current], button[aria-pressed="true"]').count();
        console.log(`  tiles: ${names.join(' · ')} · marked current: ${current}`);
        if (names.length < 2) fail('fewer than two app tiles');
        if (!current) fail('no tile marked as the open app');
        const cutSheet = await cutText(page, '[role="dialog"]');
        if (cutSheet.length) fail(`sheet text cut: ${cutSheet.join(' | ')}`);
        const focusIn = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
        if (!focusIn) fail('focus is not inside the sheet');
        // The sheet's lower half: the More rows and You.
        await sheet.locator('a, button').last().scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await page.screenshot({ path: file('3-sheet-more') });
        // Switch to Library, then back: Shop must reopen on Customers.
        const other = tiles.filter({ hasNotText: /Shop|दुकान/ }).first();
        const otherName = (await other.innerText()).trim();
        await other.click();
        await page.waitForURL((u) => u.pathname !== place, { timeout: 20_000 }).catch(() => {});
        await settle(page);
        const there = pathOf(page);
        await page.screenshot({ path: file('4-switched') });
        const newLabel = (await page.locator('nav button[aria-haspopup="dialog"]').filter({ visible: true }).first().innerText()).trim();
        console.log(`  tile "${otherName}" → ${there} · button now "${newLabel}"`);
        if (there === place) fail('a tile did not switch app');
        await page.locator('nav button[aria-haspopup="dialog"]').filter({ visible: true }).first().click();
        await page.getByRole('dialog').waitFor();
        await page.getByRole('dialog').getByTestId('app-sheet-tiles').locator('button').filter({ hasText: /Shop|दुकान/ }).first().click();
        await page.waitForURL((u) => u.pathname === place, { timeout: 20_000 }).catch(() => {});
        await settle(page);
        console.log(`  back to Shop → ${pathOf(page)}`);
        if (pathOf(page) !== place) fail(`Shop reopened on ${pathOf(page)}, not ${place}`);
        await page.screenshot({ path: file('5-back') });
      } else {
        // R-DEC-09: the rail lists no app; one "Apps" row opens the Apps page.
        const rail = page.locator('nav:has([data-testid="sidebar-apps-row"])');
        if (!(await rail.count())) { fail('no Apps row in the sidebar'); await ctx.close(); continue; }
        await page.screenshot({ path: file('1-rail') });
        const body = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        const railBg = await rail.evaluate((n) => getComputedStyle(n).backgroundColor);
        console.log(`${width} ${theme}${tag} page ${body} · rail ${railBg}`);
        if (theme === 'light' && body !== 'rgb(255, 255, 255)') fail(`page is ${body}, not white`);
        const listed = (await rail.locator('a').allInnerTexts()).map((x) => x.trim());
        const leaked = listed.filter((x) => /^(Library|Lending|Udhaar book|लाइब्रेरी|उधार-वसूली|उधार खाता)$/.test(x));
        if (leaked.length) fail(`rail still lists apps: ${leaked.join(', ')}`);
        // Every label measured against what it sits on.
        const ink = await rail.locator('a').evaluateAll((links) => {
          const rgb = (c) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
          const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
            .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
          const ratio = (a, b) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
          return links.map((a) => {
            const label = [...a.querySelectorAll('span')].find((n) => n.textContent.trim()) ?? a;
            let e = a; while (e && getComputedStyle(e).backgroundColor === 'rgba(0, 0, 0, 0)') e = e.parentElement;
            return [label.textContent.trim(), Math.round(ratio(getComputedStyle(label).color, getComputedStyle(e).backgroundColor) * 10) / 10];
          });
        });
        const faint = ink.filter(([, r]) => r < 4.5);
        console.log(`  rail rows: ${listed.length} · lowest label contrast ${Math.min(...ink.map(([, r]) => r))}:1`);
        if (faint.length) fail(`rail labels below 4.5:1: ${faint.map(([n, r]) => `${n} ${r}`).join(', ')}`);
        const cutRail = await cutText(page, 'nav:has([data-testid="sidebar-apps-row"])');
        if (cutRail.length) fail(`rail text cut: ${cutRail.join(' | ')}`);
        await page.screenshot({ path: file('1b-rail'), clip: { x: 0, y: 0, width: 300, height: SIZES[width].viewport.height } });
        // Apps row → Apps page.
        await page.getByTestId('sidebar-apps-row').locator('a').click();
        await page.waitForURL((u) => u.pathname === '/apps', { timeout: 20_000 }).catch(() => {});
        await settle(page);
        if (pathOf(page) !== '/apps') fail(`Apps row went to ${pathOf(page)}`);
        await page.screenshot({ path: file('2-apps-page') });
        const tiles = page.getByTestId('app-sheet-tiles').locator('button');
        const names = (await tiles.allInnerTexts()).map((x) => x.trim());
        console.log(`  Apps page tiles: ${names.join(' · ')} · to add: ${(await page.getByTestId('app-add-tiles').locator('button').allInnerTexts().catch(() => [])).map((x) => x.trim()).join(' · ') || 'none'}`);
        const cutPage = await cutText(page, 'main');
        if (cutPage.length) fail(`Apps page text cut: ${cutPage.join(' | ')}`);
        const other = tiles.filter({ hasNotText: /Shop|दुकान/ }).first();
        const otherName = (await other.innerText()).trim();
        await other.click();
        await page.waitForURL((u) => u.pathname !== '/apps', { timeout: 20_000 }).catch(() => {});
        await settle(page);
        console.log(`  tile "${otherName}" → ${pathOf(page)}`);
        await page.screenshot({ path: file('3-switched') });
        await page.getByTestId('sidebar-apps-row').locator('a').click();
        await page.waitForURL((u) => u.pathname === '/apps', { timeout: 20_000 }).catch(() => {});
        await settle(page);
        await page.getByTestId('app-sheet-tiles').locator('button').filter({ hasText: /Shop|दुकान/ }).first().click();
        await page.waitForURL((u) => u.pathname === place, { timeout: 20_000 }).catch(() => {});
        await settle(page);
        console.log(`  back to Shop → ${pathOf(page)}`);
        if (pathOf(page) !== place) fail(`Shop reopened on ${pathOf(page)}, not ${place}`);
        await page.screenshot({ path: file('4-back') });
      }
      const over = await measureOverflow(page);
      if (over > 0) fail(`page ${over} px wider than the screen`);
      await ctx.close();
    }
  }
}

if (PIECE === 'person') {
  const { shootPerson } = await import('./revamp-person.mjs');
  await shootPerson({ signedInContext, widths: WIDTHS, themes: THEMES, locale: LOCALE, dir: DIR, frontend: FRONTEND, failures, baseline: process.argv.includes('--baseline') });
}
else if (PIECE === 'account-context') {
  const { shootAccountContext } = await import('./revamp-account-context.mjs');
  await shootAccountContext({signedInContext,widths:WIDTHS,themes:THEMES,locale:LOCALE,dir:DIR,frontend:FRONTEND,failures});
}
else if (PIECE === 'contexts') {
  const { shootContexts } = await import('./revamp-contexts.mjs');
  await shootContexts({signedInContext,widths:WIDTHS,themes:THEMES,locale:LOCALE,dir:DIR,frontend:FRONTEND,failures});
}
else if (PIECE === 'suppliers') {
  const { shootCustomers } = await import('./revamp-customers.mjs');
  await shootCustomers({ signedInContext, widths: WIDTHS, themes: THEMES, locale: LOCALE, dir: DIR, frontend: FRONTEND, failures, baseline: process.argv.includes('--baseline'), kind: 'supplier' });
}
else if (PIECE === 'customers') {
  const { shootCustomers } = await import('./revamp-customers.mjs');
  await shootCustomers({ signedInContext, widths: WIDTHS, themes: THEMES, locale: LOCALE, dir: DIR, frontend: FRONTEND, failures, baseline: process.argv.includes('--baseline') });
}
else if (PIECE === 'home') {
  const { shootHome } = await import('./revamp-home.mjs');
  await shootHome({ signedInContext, widths: WIDTHS, themes: THEMES, locale: LOCALE, dir: DIR, frontend: FRONTEND, failures, baseline: process.argv.includes('--baseline') });
}
else if (PIECE === 'press') await shootPress();
else if (PIECE === 'apps') await shootApps();
else if (PIECE === 'lock') await shootLock();
else for (const width of WIDTHS) {
  for (const theme of THEMES) {
    if (width === 320 && theme === 'dark') continue;
    const ctx = await signedInContext(width, theme);
    for (const [start, tap, target, name] of CASES) {
      const page = await ctx.newPage();
      await page.goto(`${FRONTEND}${start}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500); // let next/link prefetch the loading view
      await holdNavigation(page, 4000);
      const control = tap(page);
      const file = `${DIR}/${width}-${theme}-${name}`;
      if (!(await control.count())) { failures.push(`${width} ${theme} ${name}: nothing to tap on ${start}`); await page.close(); continue; }
      const t0 = Date.now();
      await control.click({ noWaitAfter: true });
      await page.waitForTimeout(300);
      const busy = await page.locator('[aria-busy="true"], [data-loading="true"]').count();
      await page.screenshot({ path: `${file}-1-loading.png` });
      const over1 = await measureOverflow(page);
      const re = new RegExp(target);
      await page.waitForURL((u) => re.test(u.pathname), { timeout: 20_000 }).catch(() => {});
      // Settled = the held payload has landed and no loading view is left.
      await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${file}-2-settled.png` });
      const over2 = await measureOverflow(page);
      const reached = re.test(new URL(page.url()).pathname);
      const line = `${width} ${theme} ${name}: loading view at 300 ms ${busy ? 'YES' : 'NO'} · reached ${reached ? 'yes' : 'NO'} · sideways scroll ${over1}/${over2} px · ${Date.now() - t0} ms`;
      console.log(line);
      if (!busy || !reached) failures.push(line);
      if (over1 > 0 || over2 > 0) failures.push(`${line} — page wider than the screen`);
      await page.close();
    }
    await ctx.close();
  }
}
console.log(failures.length ? `\nFAIL ${failures.length}\n${failures.join('\n')}` : '\nall cases passed');
await closeBrowserWithDeadline(browser);
process.exit(failures.length ? 1 : 0);
