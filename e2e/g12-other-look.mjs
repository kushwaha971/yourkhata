/**
 * G12 — Other's "What kind?" and "Anything your business needs?" on step 1,
 * measured against design `pOtherKind` / `dOtherKind` on the LOCAL QA stack.
 *
 *   NODE_PATH=frontend/node_modules CHROME=… E2E_BASE=http://localhost:3005 \
 *     node e2e/g12-other-look.mjs [--shots=/tmp/e2e-shots/g12]
 *
 *  * desktop (1280): the two blocks side by side, 14 px apart, tops level;
 *    phone (390, 320): one under the other, 10 px apart;
 *  * Something else starts every switch off; Agri inputs turns on Batch and expiry only;
 *  * no raw message key, no text cut, no sideways scroll; EN and HI.
 * The sign-up journey itself (what the server saves) is `e2e/b1-signup.mjs`.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

import { newUser } from './lib/fixtures.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = process.env.E2E_BASE ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const SHOTS = arg('shots', '/tmp/e2e-shots/g12');
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const RAW = /\b(common|onboarding|nav)\.[a-zA-Z]+\.[a-zA-Z.]+/;

const user = await newUser({ name: 'QA G12', prefix: 'qa-g12' });
const browser = await chromium.launch({ executablePath: process.env.CHROME });
try {
  for (const locale of ['en', 'hi']) {
    for (const width of [390, 320, 1280]) {
      const ctx = await browser.newContext({ viewport: { width, height: width < 1024 ? 860 : 900 } });
      await ctx.addCookies([{ name: 'ub_locale', value: locale, url: base }]);
      const page = await ctx.newPage();
      await page.goto(`${base}/login/email`);
      await page.fill('input[type=email]', user.email);
      await page.fill('input[type=password]', user.password);
      await page.keyboard.press('Enter');
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
      await page.goto(`${base}/onboarding/step/1`, { waitUntil: 'networkidle' });
      if (!(await page.locator('[role=radiogroup]').count())) {
        const shop = page.getByRole('checkbox', { name: /^(Business|व्यापार)/ }).first();
        if (await shop.count()) await shop.click();
      }
      await page.locator('[role=radiogroup] [data-kind=other]').click();
      const section = page.getByTestId('other-kind-section');
      await section.waitFor({ timeout: 10000 });
      const key = `${locale}-${width}`;
      const m = await section.evaluate((el) => {
        const [a, b] = [...el.children].map((c) => c.getBoundingClientRect());
        return { aRight: a.right, bLeft: b.left, aTop: a.top, bTop: b.top, aBottom: a.bottom };
      });
      if (width >= 1024) {
        check(`${key}: side by side, 14 px apart, tops level`, Math.round(m.bLeft - m.aRight) === 14 && Math.abs(m.aTop - m.bTop) < 1, JSON.stringify(m));
      } else {
        check(`${key}: one under the other, 10 px apart`, Math.round(m.bTop - m.aBottom) === 10, JSON.stringify(m));
      }
      const heads = await section.evaluate((el) =>
        [el.querySelector('label'), el.querySelector('h3')].map((n) => `${getComputedStyle(n).fontSize}/${getComputedStyle(n).fontWeight}`)
      );
      check(`${key}: both headings share one size and weight (600)`, heads[0] === heads[1] && heads[0].endsWith('/600'), heads.join(' vs '));
      const pressed = await section.locator('[role=switch][aria-checked=true]').count();
      check(`${key}: Something else starts every switch off`, pressed === 0, String(pressed));
      // The second kind is Agri inputs (OTHER_KINDS order), whatever the language.
      await section.getByRole('radio').nth(1).click();
      const on = await section.locator('[role=switch][aria-checked=true]').allInnerTexts().catch(() => []);
      const onCount = await section.locator('[role=switch][aria-checked=true]').count();
      check(`${key}: Agri inputs turns on one switch (batch and expiry)`, onCount === 1, on.join(','));
      const text = await section.innerText();
      check(`${key}: no raw key`, !RAW.test(text));
      const cut = await section.evaluate((el) =>
        [...el.querySelectorAll('*')].filter((n) => n.children.length === 0 && n.textContent.trim() && n.scrollWidth > n.clientWidth + 1).length
      );
      check(`${key}: no text cut`, cut === 0, String(cut));
      check(`${key}: no sideways scroll`, (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
      await section.screenshot({ path: `${SHOTS}/${key}.png` });
      await ctx.close();
    }
  }
} catch (error) {
  check('harness ran to the end', false, error.message.split('\n')[0]);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
