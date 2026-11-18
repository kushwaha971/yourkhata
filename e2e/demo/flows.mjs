/**
 * e2e/demo/flows.mjs — what the recordings DO, written once for both screens.
 *
 * Every landing-page loop and every scene of the narrated films is one of
 * these flows, performed on the demo stack's real screens. A flow takes a
 * `stage` (the page plus helpers that know whether this is the phone or the
 * desktop layout) and does what a merchant would do: opens, taps, types,
 * saves. Nothing is mocked and no figure is typed into the picture — what the
 * recording shows is what the product computed.
 *
 * `soft(label, fn)` runs a step and, if it cannot be performed, records it as
 * MISSED and carries on, so one changed button fails the run loudly (the
 * recorder exits non-zero) without throwing away the rest of the take.
 */
import { FE, clickEl, sleep, typeSlow } from './lib.mjs';

export const DESKTOP = { name: 'desktop', mobile: false, launch: { executablePath: process.env.PW_CHROME ?? process.env.CHROME }, context: { viewport: { width: 1280, height: 800 } } };
/**
 * The phone: a 390 px touch layout, recorded at twice that. Playwright's video
 * is taken in CSS pixels whatever `deviceScaleFactor` the context asks for —
 * with it set to 2 the 390 px screen came out in the top-left corner of a
 * 780 px frame (found on 11 Oct 2026, in every phone take). Chromium's own
 * `--force-device-scale-factor=2` is what makes the recorded surface 780 px
 * wide, so the phone videos are full-frame and sharp.
 */
export const PHONE = { name: 'mobile', mobile: true, launch: { executablePath: process.env.PW_CHROME ?? process.env.CHROME, args: ['--force-device-scale-factor=2'] }, context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } };

export const makeStage = (page, device, missed = []) => {
  const stage = {
    page,
    mobile: device.mobile,
    missed,
    pause: (ms) => sleep(ms),
    go: async (route) => { await page.goto(`${FE}${route}`, { waitUntil: 'networkidle' }); await sleep(350); },
    tap: (locator, opts) => clickEl(page, locator, { steps: device.mobile ? 14 : 22, ...opts }),
    type: (text, delay = 90) => typeSlow(page, text, delay),
    soft: async (label, fn) => { try { await fn(); } catch (e) { missed.push(`${label} — ${String(e.message).split('\n')[0].slice(0, 150)}`); console.log('MISSED', label); } },
    /** Move the pointer over things worth looking at. */
    look: async (locators, hold = 800) => { for (const locator of locators) { const box = await locator.first().boundingBox().catch(() => null); if (!box) continue; await page.mouse.move(box.x + Math.min(box.width / 2, 160), box.y + box.height / 2, { steps: 20 }); await sleep(hold); } },
    scroll: async (dy, hold = 900) => { await page.mouse.wheel(0, dy); await sleep(hold); },
    settle: () => page.waitForLoadState('networkidle').catch(() => {}),
    /** Sidebar on a desktop; on a phone the route is opened directly. */
    nav: async (name, route) => {
      const link = page.getByRole('navigation').getByRole('link', { name, exact: true }).first();
      if (!device.mobile && (await link.isVisible().catch(() => false))) { await stage.tap(link, { after: 250 }); await stage.settle(); await sleep(300); } else await stage.go(route);
    },
    dialog: () => page.getByRole('dialog').last(),
  };
  return stage;
};

const openRow = (st, name) => st.tap(st.page.getByRole('button', { name: `Open ${name}`, exact: false }).first(), { after: 250 });

// ── Shop & billing ──────────────────────────────────────────────────────────

export const shop = {
  dashboard: async (st, hold = 1500) => {
    await st.go('/dashboard');
    await st.look([st.page.getByText('To collect').first()], 700);
    await st.pause(hold);
  },

  // Redesigned Shop (Nov 2026): a customer's page shows bills due and payments
  // received; "You gave / You got" belongs to the Money book only (DEC-019).
  openKhata: async (st, name = 'Ramesh Traders') => {
    await st.nav('Customers', '/customers');
    await st.pause(700);
    await st.soft(`open ${name}`, async () => { await openRow(st, name); await st.page.waitForURL(/\/parties\/[0-9a-f-]{20,}/, { timeout: 15000 }); await st.settle(); });
    await st.pause(700);
  },

  /** Receive part of what the customer owes, in cash. */
  receive: async (st, amount) => {
    await st.soft(`receive ${amount}`, async () => {
      await st.tap(st.page.getByRole('button', { name: 'Receive payment' }).first(), { after: 300 });
      const dialog = st.page.getByRole('dialog', { name: 'Receive payment' });
      await dialog.waitFor({ timeout: 15000 });
      await st.pause(500);
      const box = dialog.getByRole('textbox', { name: 'Amount' });
      await st.tap(box, { after: 120 });
      await box.fill(''); // it opens with the whole amount due
      await st.type(amount, 150);
      await st.pause(600);
      await st.tap(dialog.getByRole('button', { name: /^Receive ₹/ }), { after: 300 });
      await dialog.waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    });
    await st.pause(1100);
  },
  /** Older name, kept for the film script: the Shop now records money received. */
  entry: async (st, _kind, amount) => shop.receive(st, amount),

  reminder: async (st) => {
    await st.soft('send reminder', async () => {
      await st.tap(st.page.getByRole('button', { name: 'More actions', exact: true }).first(), { after: 600 });
      await st.tap(st.page.getByRole('dialog', { name: 'More actions' }).getByRole('button', { name: 'Send reminder' }), { after: 400 });
      await st.pause(1900);
    });
    await st.page.keyboard.press('Escape');
    await st.pause(300);
    await st.page.keyboard.press('Escape');
    await st.go('/reports/aging');
    await st.pause(1400);
  },

  /** The bill's steps, one at a time, so a film can speak each as it happens. */
  billParty: async (st, party, { open = true } = {}) => {
    if (open) await st.go('/sales/invoices/new');
    await st.soft(`bill party ${party}`, async () => {
      await st.tap(st.page.getByRole('button', { name: 'Saved customer', exact: true }), { after: 300 });
      await st.type(party.slice(0, 5), 100);
      await st.pause(900);
      await st.tap(st.page.getByRole('option', { name: new RegExp(party) }).first(), { after: 450 });
    });
  },
  billItem: async (st, _n, search, name, qty) => {
    await st.soft(`bill item ${name}`, async () => {
      await st.tap(st.page.getByRole('combobox', { name: 'Search items to add' }), { after: 150 });
      await st.type(search, 110);
      await st.pause(900);
      await st.tap(st.page.getByRole('option', { name: new RegExp(name) }).first(), { after: 400 });
      // A desktop line has a quantity box; a phone line has "One more".
      const field = st.page.getByRole('textbox', { name: `Quantity of ${name}` });
      if (await field.isVisible().catch(() => false)) { await st.tap(field, { after: 100 }); await field.fill(String(qty)); }
      else for (let i = 1; i < qty; i += 1) await st.tap(st.page.getByRole('button', { name: `One more ${name}` }), { after: 300 });
      await st.pause(450);
    });
  },
  billTotals: async (st) => {
    await st.soft('bill totals', async () => { await st.look([st.page.getByRole('button', { name: /^Issue, ₹/ })], 1300); });
  },

  /** A bill from the first field to the issued invoice. `items`: [search, full name, qty][]. */
  bill: async (st, party, items, { issue = true } = {}) => {
    await shop.billParty(st, party);
    for (const [n, [search, name, qty]] of items.entries()) await shop.billItem(st, n, search, name, qty);
    await shop.billTotals(st);
    if (!issue) return;
    await st.soft('issue bill', async () => {
      await st.tap(st.page.getByRole('button', { name: /^Issue, ₹/ }).first(), { after: 350 });
      // "Payment": this bill is a credit sale, so nothing is received now.
      await st.tap(st.page.getByRole('dialog', { name: 'Payment' }).getByRole('button', { name: 'Full credit' }), { after: 300 });
      // "INV/… issued": open the bill itself.
      const view = st.page.getByRole('dialog').getByRole('button', { name: 'View bill' });
      await view.waitFor({ timeout: 20000 });
      await st.pause(900);
      await st.tap(view, { after: 300 });
      await st.page.waitForURL(/\/sales\/invoices\/[0-9a-f-]{20,}$/, { timeout: 20000 });
      await st.settle();
    });
    await st.pause(1500);
  },

  stock: async (st) => {
    await st.nav('Items', '/items');
    await st.pause(900);
    await st.soft('open item', async () => {
      await openRow(st, 'Bath Soap');
      await st.page.waitForURL(/\/items\/[0-9a-f-]{20,}/, { timeout: 15000 });
      await st.settle();
    });
    await st.pause(1300);
    await st.soft('adjust stock', async () => {
      await st.tap(st.page.getByRole('button', { name: 'Adjust stock' }).first(), { after: 700 });
      const dialog = st.page.getByRole('dialog', { name: 'Adjust stock' });
      await dialog.waitFor({ timeout: 10000 });
      await st.tap(dialog.getByRole('textbox', { name: 'Qty, Line 1' }), { after: 120 });
      await st.type('1', 160);
      await st.pause(1100);
    });
  },

  purchase: async (st) => {
    await st.go('/purchases/bills/new');
    await st.soft('purchase supplier', async () => {
      await st.tap(st.page.getByRole('combobox', { name: 'Supplier' }), { after: 120 });
      await st.type('Gupta', 100);
      await st.pause(900);
      await st.tap(st.page.getByRole('option', { name: /Gupta Wholesale/ }).first(), { after: 450 });
      await st.page.waitForURL(/\/purchases\/bills\/[0-9a-f-]{20,}\/edit/, { timeout: 15000 });
    });
    await st.soft('purchase item', async () => {
      await st.tap(st.page.getByRole('combobox', { name: 'Search items to add' }), { after: 150 });
      await st.type('Tea', 110);
      await st.pause(900);
      await st.tap(st.page.getByRole('option', { name: /Tea 250g/ }).first(), { after: 400 });
      const qty = st.page.getByRole('textbox', { name: 'Qty, line 1' });
      await st.tap(qty, { after: 100 }); await qty.fill(''); await st.type('12', 120);
      const cost = st.page.getByRole('textbox', { name: 'Cost, line 1' });
      await st.tap(cost, { after: 100 }); await cost.fill(''); await st.type('95', 120);
      await st.pause(600);
    });
    await st.soft('record purchase', async () => {
      await st.tap(st.page.getByRole('button', { name: 'Record purchase' }).first(), { after: 900 });
      // "Paid now?" — the bill is recorded as paid in cash, in the same step.
      const dialog = st.page.getByRole('dialog', { name: 'Paid now?' });
      await st.tap(dialog.getByRole('button').filter({ hasText: /Record/ }).last(), { after: 400 });
      await dialog.waitFor({ state: 'detached', timeout: 20000 });
      await st.settle();
    });
    await st.pause(1500);
  },

  reports: async (st) => {
    await st.nav('Reports', '/reports');
    await st.pause(1000);
    await st.soft('day book', async () => { await st.tap(st.page.getByRole('link', { name: /Day book/ }).first(), { after: 300 }); await st.settle(); });
    await st.pause(1500);
    await st.go('/reports');
    await st.soft('gst summary', async () => { await st.tap(st.page.getByRole('link', { name: /GST summary/ }).first(), { after: 300 }); await st.settle(); });
    await st.pause(1600);
  },

  itemsAndReports: async (st, cue) => {
    await st.nav('Items', '/items');
    await st.pause(900);
    await cue(1);
    await st.nav('Reports', '/reports');
    await st.look([st.page.getByRole('link', { name: /Day book/ }), st.page.getByRole('link', { name: /Money to collect/ }), st.page.getByRole('link', { name: /Sales register/ }), st.page.getByRole('link', { name: /GST summary/ })], 850);
  },
};

// ── Library ─────────────────────────────────────────────────────────────────

export const library = {
  home: async (st, hold = 1500) => { await st.go('/library'); await st.pause(hold); },
  // Rebuilt 12 Nov 2026: students on numbered seats, a monthly fee, books lent out.
  students: async (st) => { await st.nav('Students', '/library/students'); await st.pause(1100); },
  collectFee: async (st, name = 'Rohit Pawar') => {
    await st.soft(`collect fee ${name}`, async () => {
      const row = st.page.locator('[data-testid="library-student-row"], [data-testid="library-student-tr"]').filter({ hasText: name, visible: true }).first();
      const open = row.getByText('Open', { exact: true });
      await st.tap((await open.isVisible().catch(() => false)) ? open : row, { after: 300 });
      // A phone opens the student's page; a desktop opens it beside the list.
      const collect = st.page.locator('[data-testid="library-collect"], [data-testid="library-collect-phone"]').filter({ visible: true }).first();
      await collect.waitFor({ timeout: 15000 }); await st.pause(900);
      await st.tap(collect, { after: 900 });
      const amount = st.dialog().getByRole('textbox').first();
      await st.tap(amount, { after: 150 });
      await amount.fill(''); await st.type('800', 150); await st.pause(1200);
      await st.page.getByText('Share receipt on WhatsApp').click({ timeout: 800 }).catch(() => {}); // off: no WhatsApp tab
      await st.tap(st.dialog().getByTestId('library-collect-save'), { after: 400 });
      await st.page.waitForSelector('role=dialog', { state: 'detached', timeout: 15000 }).catch(() => {});
    });
    await st.pause(1300);
  },
  admission: async (st) => {
    await st.soft('enrol', async () => {
      await st.tap(st.page.getByTestId('library-enrol').locator('visible=true').first(), { after: 700 });
      await st.tap(st.dialog().getByRole('textbox').first(), { after: 120 });
      await st.type('Kavita Deshmukh', 65);
      await st.pause(1300);
    });
  },
  closeDialog: async (st) => {
    await st.page.keyboard.press('Escape');
    await st.pause(300);
    await st.page.getByRole('dialog').getByRole('button', { name: /Discard|Leave|Yes/ }).click({ timeout: 1000 }).catch(() => {});
    await st.pause(200);
  },
  seats: async (st) => { await st.nav('Seats', '/library/seats'); await st.pause(1800); },
  books: async (st) => { await st.nav('Books', '/library/books'); await st.pause(1500); },
};

// ── Lending ─────────────────────────────────────────────────────────────────

export const lending = {
  today: async (st, hold = 1500) => {
    await st.go('/lending');
    await st.page.getByRole('button', { name: 'Hide' }).click({ timeout: 1200 }).catch(() => {});
    await st.pause(hold);
  },
  collect: async (st) => {
    await st.soft('collect', async () => {
      await st.tap(st.page.getByTestId('lending-collect').locator('visible=true').first(), { after: 1100 });
      await st.tap(st.dialog().getByText('UPI', { exact: true }), { after: 800 });
      await st.page.getByText('Share receipt on WhatsApp').click({ timeout: 800 }).catch(() => {}); // off: no WhatsApp tab
      await st.tap(st.dialog().getByTestId('lending-collect-save'), { after: 400 });
      await st.page.waitForSelector('role=dialog', { state: 'detached', timeout: 15000 }).catch(() => {});
    });
    await st.pause(1500);
  },
  loans: async (st) => { await st.nav('Loans', '/lending/loans'); await st.pause(1300); },
  openLoan: async (st, name = 'Salma Begum') => {
    await st.soft('open loan', async () => { await st.tap(st.page.getByText(name).first(), { after: 300 }); await st.page.waitForURL(/\/lending\/loans\/[0-9a-f-]{20,}/, { timeout: 15000 }); await st.settle(); });
    await st.pause(900);
    await st.scroll(420); await st.scroll(420);
  },
  newLoan: async (st) => { await st.go('/lending/loans/new'); await st.pause(900); await st.scroll(380, 1000); },
};
