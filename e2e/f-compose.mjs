/**
 * Part F — what each register HAS, design against app (desktop): header
 * buttons, chips, toolbar controls and the count line. The measure tool
 * compares sizes of shared text; this lists what one side has and the other
 * does not, which no size check can see.
 *   NODE_PATH=frontend/node_modules CHROME=… E2E_BASE=http://localhost:3005 node e2e/f-compose.mjs
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const pairs = JSON.parse(readFileSync(new URL('./design-pairs.json', import.meta.url))).filter((p) => /^F-.*-d$/.test(p.mock));
const b = await chromium.launch({ executablePath: process.env.CHROME });
const d = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
await d.goto(`file://${resolve('docs/revamp/design/shop-fixes-and-business-types.html')}`);
await d.waitForTimeout(1500);
await d.locator('select').filter({ has: d.locator('option[value=jewel]') }).first().selectOption('kirana');
await d.waitForTimeout(1500);
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto(`${base}/login/email`);
await p.fill('input[type=email]', 'scale@digikhaato.test');
await p.fill('input[type=password]', 'Scale-Run-2026!');
await p.keyboard.press('Enter');
await p.waitForURL((u) => !u.pathname.startsWith('/login'));
const clean = (x) => x.replace(/\s+/g, ' ').trim();
for (const pair of pairs) {
  const mock = d.locator(`[data-mock="${pair.mock}"]`).first();
  await mock.scrollIntoViewIfNeeded();
  const design = await mock.evaluate((el) => {
    const t = (s) => [...el.querySelectorAll(s)].map((n) => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return { buttons: t('.acts .btn'), chips: t('.pills .chp'), tools: t('.tools .btn'), count: t('.countline').join(' ') };
  });
  await p.goto(base + pair.route, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  const app = await p.evaluate(() => {
    const t = (s) => [...document.querySelectorAll(s)].filter((n) => n.offsetWidth).map((n) => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return {
      buttons: t('[data-ub-page-header] a, [data-ub-page-header] button').filter((x) => x.length < 40),
      chips: t('main [role=radio], main button[aria-pressed]'),
      tools: t('[data-ub-register-frame] button[aria-haspopup], [data-ub-register-frame] [data-testid=period-select]'),
      count: t('[data-ub-count-line]').join(' '),
    };
  });
  console.log(`\n== ${pair.mock.replace(/-d$/, '')} (${pair.route})`);
  for (const k of ['buttons', 'chips', 'tools']) {
    const extra = app[k].filter((x) => !design[k].some((y) => clean(y).toLowerCase().includes(clean(x).toLowerCase().split(':')[0])));
    const missing = design[k].filter((y) => !app[k].some((x) => clean(x).toLowerCase().includes(clean(y).toLowerCase().split(':')[0])));
    if (extra.length || missing.length) console.log(`  ${k}: app adds [${extra.join(' | ')}]  app lacks [${missing.join(' | ')}]`);
  }
  console.log(`  count: design "${design.count}"  app "${app.count}"`);
}
await b.close();
