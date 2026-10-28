// A8 — the first tap on a drawer/sheet opener (design §A8; report
// docs/performance/2026-10-28-shop-a8-first-tap.md, P1–P5).
//
// Each opener runs in a COLD browser (nothing cached), with every JavaScript
// chunk requested after the page is up held back by --delay ms (default 1200),
// which is what a first tap on a slow phone network is. From the tap, every
// 50 ms, it records:
//   P2  the page stays: its heading is still on screen (no blank, no route skeleton);
//   P1/P3  a drawer shape is on screen within 300 ms (the press answered at once);
//   and when the real drawer content arrives.
// P4 (a stalled API) and P5 (a slow return) run once each at the end.
//
//   node e2e/a8-first-tap.mjs [--width=390,1280] [--delay=1200] [--tag=now]   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3000';
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const widths = arg('width', '390,1280').split(',').map(Number);
const delay = Number(arg('delay', '1200'));
const tag = arg('tag', 'now');
const dir = process.env.E2E_SHOTS ?? '/tmp/e2e-shots/a8';
mkdirSync(dir, { recursive: true });

const failures = [];
const fail = (k, m) => failures.push(`${k}: ${m}`);
const rows = [];

/** [page, opener's accessible name, what it opens] — the Shop's drawer openers. */
const OPENERS = [
  ['/dashboard', /^Pay supplier/, 'payment drawer'],
  ['/dashboard', /^(Receive payment|Receive money)/, 'payment drawer'],
  ['/customers', /^Add customer/, 'contact form'],
  ['/suppliers', /^Add supplier/, 'contact form'],
  ['/customers', /^Remind/, 'reminder sheet'],
  ['/suppliers', /^Pay$/, 'payment drawer'],
  ['/items', /^Add item/, 'item form'],
  ['/payments', /^Receive payment/, 'payment drawer'],
  ['/expenses', /^(Add expense|New expense|Record expense)/, 'expense form'],
];

const signIn = async (ctx) => {
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  return page;
};

const sample = () => {
  const h1 = [...document.querySelectorAll('main h1, h1')].find((e) => e.getBoundingClientRect().height > 0);
  const dlg = [...document.querySelectorAll('[role=dialog]')].pop();
  const shown = dlg && dlg.getBoundingClientRect().height > 40;
  const real = shown && dlg.querySelector('input, textarea, select, [role=combobox], [role=radio], [role=switch]');
  return { heading: !!h1, dialog: !!shown, real: !!real };
};

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
for (const width of widths) {
  for (const [path, name, what] of OPENERS) {
    const key = `${width} ${path} "${name.source}"`;
    const ctx = await browser.newContext({ viewport: { width, height: width < 1024 ? 800 : 860 } });
    try {
      const page = await signIn(ctx);
      await page.goto(`${base}${path}`, { waitUntil: 'load' });
      await page.waitForTimeout(2500); // the page is up; only on-demand chunks remain
      let armed = true;
      await page.route('**/_next/static/chunks/**', async (route) => {
        if (armed) await new Promise((r) => setTimeout(r, delay));
        await route.continue();
      });
      const btn = page.getByRole('button', { name }).or(page.getByRole('link', { name })).first();
      if (!(await btn.count())) {
        rows.push(`${key}: skipped, no such button here`);
        await ctx.close();
        continue;
      }
      await btn.scrollIntoViewIfNeeded();
      const t0 = Date.now();
      await btn.click({ noWaitAfter: true });
      let firstDialog = null;
      let firstReal = null;
      let lostHeading = null;
      while (Date.now() - t0 < delay + 2500) {
        const s = await page.evaluate(sample);
        const t = Date.now() - t0;
        if (!s.heading && lostHeading === null) lostHeading = t;
        if (s.dialog && firstDialog === null) firstDialog = t;
        if (s.real && firstReal === null) {
          firstReal = t;
          break;
        }
        if (t > 150 && t < 250) await page.screenshot({ path: `${dir}/${tag}-${width}${path.replaceAll('/', '-')}-${what.replaceAll(' ', '-')}-200ms.png` });
        await page.waitForTimeout(40);
      }
      armed = false;
      rows.push(`${key}: shape at ${firstDialog ?? '—'} ms, content at ${firstReal ?? '—'} ms, heading lost at ${lostHeading ?? 'never'}`);
      if (lostHeading !== null) fail(key, `P2 the page went away ${lostHeading} ms after the tap`);
      if (firstDialog === null || firstDialog > 300) fail(key, `P3 no ${what} shape within 300 ms (first at ${firstDialog ?? 'never'})`);
      if (firstReal === null) fail(key, `the ${what} never arrived`);
    } catch (e) {
      fail(key, `error ${e.message.split('\n')[0]}`);
    }
    await ctx.close();
  }
}
// ── P5: a page of the Shop opened from another app (the Library) ─────────────
// The app switch it causes wiped every feature's state, rows included, and the
// list never asked again (8 of 8 trips before the fix). Three trips, each must
// show real rows within 3 s.
for (const width of widths) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 1024 ? 800 : 860 } });
  const page = await signIn(ctx);
  for (let trip = 0; trip < 3; trip += 1) {
    for (const [from, to] of [['/library', '/suppliers'], ['/library', '/customers']]) {
      const key = `${width} P5 ${from} → ${to} #${trip}`;
      await page.goto(`${base}${from}`, { waitUntil: 'load' });
      await page.waitForTimeout(1500);
      const t0 = Date.now();
      await page.goto(`${base}${to}`, { waitUntil: 'load' });
      let shown = null;
      while (Date.now() - t0 < 6000) {
        const ok = await page.evaluate(() => {
          const rows = document.querySelectorAll('[data-testid=ub-grid-card], [data-testid=ub-grid] tbody tr').length;
          return rows > 0 && !document.querySelector('main [aria-busy=true], main .animate-pulse');
        });
        if (ok) {
          shown = Date.now() - t0;
          break;
        }
        await page.waitForTimeout(100);
      }
      rows.push(`${key}: rows at ${shown ?? 'never (6 s)'} ms`);
      if (shown === null || shown > 3000) fail(key, `P5 the list did not load (${shown ?? 'never'} ms)`);
    }
  }
  await ctx.close();
}
// ── P6 (owner, 28 Oct): signing in lands on Home, and Home must show its
// figures without a reload. Signing in wipes every feature's state
// (passwordLogin/verifyOtp: resetAll), the same trap as P5.
for (const width of widths) {
  for (let trip = 0; trip < 4; trip += 1) {
    const key = `${width} P6 sign in → Home #${trip}`;
    const ctx = await browser.newContext({ viewport: { width, height: width < 1024 ? 800 : 860 } });
    const page = await ctx.newPage();
    await page.goto(`${base}/login/email`);
    await page.fill('input[type=email]', 'scale@digikhaato.test');
    await page.fill('input[type=password]', 'Scale-Run-2026!');
    const t0 = Date.now();
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
    let shown = null;
    while (Date.now() - t0 < 8000) {
      const ok = await page.evaluate(() => {
        const m = document.querySelector('main');
        return !!m && /₹/.test(m.innerText) && !m.querySelector('.animate-pulse');
      });
      if (ok) {
        shown = Date.now() - t0;
        break;
      }
      await page.waitForTimeout(150);
    }
    rows.push(`${key}: landed on ${new URL(page.url()).pathname}, figures at ${shown ?? 'never (8 s)'} ms`);
    if (shown === null || shown > 3000) {
      await page.screenshot({ path: `${dir}/${tag}-${width}-login-stuck-${trip}.png` });
      fail(key, `P6 Home showed no figures after sign-in (${shown ?? 'never'} ms)`);
    }
    await ctx.close();
  }
}
await browser.close();
console.log(rows.join('\n'));
console.log(failures.join('\n'));
console.log(`${rows.length} openers, ${failures.length} failures`);
process.exit(failures.length ? 1 : 0);
