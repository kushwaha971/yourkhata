// R-DEC-69 — the app names (Business, Money book, Ledger) on the screens that
// name them, at 390 and 1280, light and dark, English and Hindi. It fails if any
// screen still prints an old app name, and photographs every case for the LOOK.
//   node e2e/rename-look.mjs   (E2E_BASE, PW_CHROME)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const dir = '/tmp/e2e-shots/rename';
mkdirSync(dir, { recursive: true });
const OLD = {
  en: /\b(Udhaar book|Udhaar khata|Lending & collections|Shop features|Shop book|Shop balance)\b|^Shop$|^Lending$/m,
  hi: /उधार खाता|उधार बही|उधार-वसूली|कर्ज़ और वसूली|दुकान की सुविधाएँ|दुकान की बही/,
};
const NEW = { en: /Business|Money book|Ledger/, hi: /व्यापार|मनी बुक|लेजर/ };
const SCREENS = ['/apps', '/more', '/settings', '/khata', '/settings/shop', '/ledger/reminders', '/'];
let fails = 0;
const check = (name, ok, detail = '') => {
  if (!ok) fails += 1;
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};
const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
for (const locale of ['en', 'hi']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([{ name: 'ub_locale', value: locale, domain: new URL(base).hostname, path: '/' }]);
  const page = await ctx.newPage();
  await page.goto(`${base}/login/email`);
  await page.fill('input[type=email]', 'scale@digikhaato.test');
  await page.fill('input[type=password]', 'Scale-Run-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  for (const scheme of ['light', 'dark']) {
    // ub_theme_choice picks the theme; colorScheme alone draws "dark" light (B thread, 30 Oct).
    await ctx.addCookies([{ name: 'ub_theme_choice', value: scheme, domain: new URL(base).hostname, path: '/' }]);
    await page.emulateMedia({ colorScheme: scheme });
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      for (const path of SCREENS) {
        await page.goto(`${base}${path}`, { waitUntil: 'networkidle' }).catch(() => {});
        await page.waitForTimeout(600);
        const text = await page.locator('body').innerText();
        const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        const dark = bg.match(/\d+/g).slice(0, 3).reduce((a, b) => a + Number(b), 0) < 300;
        check(`${path} ${scheme}: the page is really ${scheme}`, dark === (scheme === 'dark'), bg);
        const tag = `${locale}-${scheme}-${width}${path.replaceAll('/', '_') || '_home'}`;
        await page.screenshot({ path: `${dir}/${tag}.png`, fullPage: false });
        const old = text.match(OLD[locale]);
        check(`${tag}: no old app name`, !old, old?.[0]);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(`${tag}: nothing past the screen edge`, over <= 0, `${over}px`);
        if (scheme === 'light' && ['/apps', '/more', '/settings'].includes(path)) {
          check(`${tag}: a new name is shown`, NEW[locale].test(text));
        }
      }
    }
  }
  await ctx.close();
}
await browser.close();
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
