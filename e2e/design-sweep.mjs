// Every jewellery screen beside its design mock, one contact sheet per group, for LOOKING.
//   node e2e/design-sweep.mjs [--kind=medical --email=<qa login>]  (E2E_BASE, PW_CHROME) writes /tmp/e2e-shots/jd
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3000';
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const kind = arg('kind', 'jewel');
const only = arg('only', '').split(',').filter(Boolean);
const email = arg('email', 'qa-jeweller@adcert.test');
const out = `/tmp/e2e-shots/jd/${kind}`;
mkdirSync(out, { recursive: true });
const PAIRS = JSON.parse(readFileSync(new URL('./design-pairs.json', import.meta.url)));
const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});

const design = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
await design.goto(`file://${resolve('docs/revamp/design/shop-fixes-and-business-types.html')}`);
await design.waitForTimeout(1500);
await design.locator('select').filter({ has: design.locator('option[value=jewel]') }).first().selectOption(kind);
await design.waitForTimeout(2000);

const login = async (w, h) => {
  const c = await b.newContext({ viewport: { width: w, height: h } });
  const page = await c.newPage();
  await page.goto(`${base}/login/email`);
  await page.locator('input[type=email],input[name=email]').first().fill(email);
  await page.locator('input[type=password]').first().fill('AdCert-Test-2026!');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  return page;
};
const phone = await login(390, 844);
const desk = await login(1280, 800);
const sheet = await (await b.newContext({ viewport: { width: 1500, height: 800 } })).newPage();
const uri = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

for (const { mock, route, section } of PAIRS) {
  if (only.length && !only.includes(mock)) continue;
  const page = mock.startsWith('p') || mock.endsWith('-p') ? phone : desk;
  const el = design.locator(section ? `#${section} [data-mock="${mock}"]` : `[data-mock="${mock}"]`).first();
  if (!(await el.isVisible())) { console.log('no mock', mock); continue; }
  await el.scrollIntoViewIfNeeded();
  await design.waitForTimeout(150);
  const left = await el.screenshot();
  const res = await page.goto(base + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const m = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth }));
  console.log(mock, route, res.status(), page.url().replace(base, ''), `overflow ${m.over}`);
  const right = await page.screenshot();
  await sheet.setContent(`<body style="margin:0;background:#888;display:flex;gap:12px;align-items:flex-start"><img style="max-width:${page === phone ? 400 : 740}px" src="${uri(left)}"><img style="max-width:${page === phone ? 400 : 740}px" src="${uri(right)}"></body>`);
  await sheet.waitForTimeout(200);
  await sheet.screenshot({ path: `${out}/${mock}.png`, fullPage: true });
}
await b.close();
