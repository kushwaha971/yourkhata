/**
 * QA audit: dump what the API says for Lending, Library and Money book of the
 * local QA tenant to a JSON file, for backend/scripts-free independent
 * recomputation from raw rows (see docs/testing/apps-audit-2026-11.md).
 *   node e2e/audit-dump.mjs /tmp/audit-api.json
 */
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE ?? 'http://localhost:3005';
const out = process.argv[2] ?? '/tmp/audit-api.json';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME ?? process.env.CHROME });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(`${base}/login/email`);
await page.fill('input[type=email]', 'scale@digikhaato.test');
await page.fill('input[type=password]', process.env.E2E_SCALE_PASSWORD ?? 'Scale-Run-2026!');
await page.keyboard.press('Enter');
await page.waitForURL((u) => !u.pathname.startsWith('/login'));
const get = async (path) => (await ctx.request.get(`${base}/api/v1/${path}`)).json();
const all = async (path) => {
  const rows = [];
  for (let p = 1; p < 200; p += 1) {
    const r = await get(`${path}${path.includes('?') ? '&' : '?'}page=${p}&page_size=100`);
    rows.push(...(r.data ?? []));
    if (!r.meta?.pagination?.has_next && !r.meta?.has_next && (r.data ?? []).length < 100) break;
  }
  return rows;
};
const me = (await get('auth/me')).data;
const dump = { tenant: me.active_tenant_id, user: me.user?.id ?? me.id, meKeys: Object.keys(me) };
dump.people = await all('moneybook/people');
dump.peopleMeta = (await get('moneybook/people?page_size=1')).meta;
dump.report = await get('moneybook/report');
dump.loans = await all('lending/loans');
dump.loansMeta = (await get('lending/loans?page_size=1')).meta;
dump.loanDetail = [];
for (const l of dump.loans.slice(0, 60)) dump.loanDetail.push((await get(`lending/loans/${l.id}`)).data);
dump.today = (await get('lending/today')).data;
dump.students = await all('library/students');
dump.studentsMeta = (await get('library/students?page_size=1')).meta;
dump.money = await get('library/money');
dump.expenses = await get('library/expenses');
dump.home = (await get('library/home')).data;
dump.fees = await get('library/fees');
writeFileSync(out, JSON.stringify(dump, null, 1));
const brief = (v) => JSON.stringify(v)?.slice(0, 420);
console.log('people', dump.people.length, brief(dump.people[0]), brief(dump.peopleMeta));
console.log('report', brief(dump.report));
console.log('loans', dump.loans.length, brief(dump.loans[0]), brief(dump.loansMeta));
console.log('loanDetail', brief(dump.loanDetail[0]));
console.log('today', brief(dump.today));
console.log('students', dump.students.length, brief(dump.students[0]), brief(dump.studentsMeta));
console.log('money', brief(dump.money));
console.log('expenses', brief(dump.expenses));
console.log('home', brief(dump.home));
console.log('fees', brief(dump.fees));
await browser.close();
