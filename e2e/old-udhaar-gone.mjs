/**
 * old-udhaar-gone.mjs — the old Udhaar person page and statement are removed
 * (owner, 13 Nov 2026: "Remove them").
 *
 * After the Money Book was rebuilt with its own screens, `/parties/{id}` and
 * `/parties/{id}/statement` had no menu link but still opened by address from a
 * Money Book session and drew the old shared ledger (Gave money / Got money,
 * the credit limit). This proves, on the running app:
 *   - from the Shop the person page still opens, with the Shop's own tools;
 *   - from the Money Book both addresses send the visitor to the Money Book
 *     and never draw the old view, on a phone and on a desktop.
 */
import { createRequire } from 'node:module';
import { enterUdhaarBook } from './lib/udhaar-book.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const FRONTEND = process.env.E2E_FRONTEND ?? (process.env.E2E_BASE ?? 'http://localhost:3000');
const BACKEND = process.env.E2E_BACKEND ?? 'http://localhost:8000/api/v1';

const results = [];
const record = (check, ok, detail = '') => {
  results.push({ check, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${check}${detail ? `\n        ${detail}` : ''}`);
};

const stamp = Date.now();
const OWNER = { email: `oug-${stamp}@shop.test`, password: 'Dukaan2026x', name: 'Owner Person' };

const api = async (method, path, body, token, extra = {}) => {
  const response = await fetch(`${BACKEND}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Client': 'api', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => null);
  if (response.status >= 400) throw new Error(`${path} ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
};

const OLD_WORDS = /Gave money|Got money|You gave|You got|Credit limit/;

try {
  const registered = await api('POST', '/auth/register', { email: OWNER.email, password: OWNER.password, full_name: OWNER.name });
  await api('POST', '/tenants', { name: 'Kumar Stores', business_type: 'retail', state_code: '27' },
    registered.data.access_token, { 'Idempotency-Key': `tenant-${stamp}` });
  const token = (await api('POST', '/auth/login', { email: OWNER.email, password: OWNER.password })).data.access_token;
  const party = (await api('POST', '/parties', { name: 'Naidu Agency', is_customer: true, mobile: null }, token,
    { 'Idempotency-Key': `p-${stamp}` })).data.id;
  // A second person, never opened in the Shop: the app remembers which app a
  // visited address belonged to, so an address already opened in the Shop
  // opens there again, which is the Shop's own page and not the old view.
  const stranger = (await api('POST', '/parties', { name: 'Old Udhaar Person', is_customer: true, mobile: null }, token,
    { 'Idempotency-Key': `q-${stamp}` })).data.id;

  const browser = await chromium.launch({ executablePath: process.env.CHROME || process.env.PW_CHROME || undefined });
  for (const size of [{ id: 'phone', width: 390, height: 844 }, { id: 'desktop', width: 1280, height: 800 }]) {
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
    await page.goto(`${FRONTEND}/login/email`, { waitUntil: 'networkidle', timeout: 180000 });
    await page.fill('input[type="email"]', OWNER.email);
    await page.fill('input[type="password"]', OWNER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 90000 });
    await page.waitForLoadState('networkidle');

    // The Shop keeps its person page. The open app is remembered per person,
    // so the second size starts where the first one left it: in the Money Book.
    await enterUdhaarBook(page, FRONTEND, 'shop');
    await page.goto(`${FRONTEND}/parties/${party}`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Naidu Agency' }).first().waitFor({ timeout: 30000 }).catch(() => {});
    const shopText = await page.locator('body').innerText();
    record(`${size.id}: from the Shop the person page still opens`, new URL(page.url()).pathname === `/parties/${party}` && shopText.includes('Naidu Agency'), page.url());
    record(`${size.id}: and it is the Shop's page, not the old Udhaar view`, !/Gave money|Got money/.test(shopText));

    // From the Money Book the old addresses are gone.
    const switched = await enterUdhaarBook(page, FRONTEND);
    record(`${size.id}: the session moves to the Money Book`, switched === 200, String(switched));
    await page.goto(`${FRONTEND}/money-book`, { waitUntil: 'networkidle' });
    for (const path of [`/parties/${stranger}`, `/parties/${stranger}/statement`]) {
      await page.goto(`${FRONTEND}${path}`, { waitUntil: 'networkidle' });
      await page.waitForURL((url) => url.pathname.startsWith('/money-book'), { timeout: 20000 }).catch(() => {});
      await page.waitForLoadState('networkidle');
      const landed = new URL(page.url()).pathname;
      const text = await page.locator('body').innerText();
      const what = path.endsWith('statement') ? 'statement' : 'person page';
      record(`${size.id}: the old ${what} sends a Money Book visitor to the Money Book`, landed.startsWith('/money-book'), landed);
      record(`${size.id}: the old ${what} is not drawn`, !OLD_WORDS.test(text) && !text.includes('Old Udhaar Person'), text.match(OLD_WORDS)?.[0] ?? '');
    }
    record(`${size.id}: no page errors`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
  await browser.close();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
} catch (error) {
  console.error(error);
  process.exit(1);
}
