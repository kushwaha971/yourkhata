// A3 functional end to end, through the UI, like a merchant — then the
// result read back from the API, and every other screen showing it checked
// WITHOUT a reload (FB-010).
//
//   1. New bill → Saved customer (one who owes) → the box shows the Shop
//      balance B from the API.
//   2. Add one item from the item search, Issue on credit.
//   3. API: the invoice exists for that customer with total T; the customer's
//      Shop balance is now B + T.
//   4. Without a reload: open a new bill for the same customer (client-side,
//      through the header search) → the box shows B + T; open the customer's
//      page → the same figure.
//
// Writes one invoice to the LOCAL seeded QA tenant only.
//   node e2e/a3-functional.mjs   (PW_CHROME, E2E_SHOTS, --width=390)
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = (process.env.E2E_BASE ?? "http://localhost:3000");
const width = Number(
  process.argv.find((a) => a.startsWith("--width="))?.slice(8) ?? 390,
);
const dir = process.env.E2E_SHOTS ?? "/tmp/e2e-shots/a3-functional";
mkdirSync(dir, { recursive: true });
const failures = [];
const consoleErrors = [];
const fail = (msg) => failures.push(msg);
const inr = (v) =>
  "₹" +
  Math.abs(Number(v)).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
);
const ctx = await browser.newContext({
  viewport: { width, height: width < 1024 ? 800 : 900 },
});
const page = await ctx.newPage();
let signedIn = false;
page.on("console", (m) => {
  if (signedIn && (m.type() === "error" || /Warning:/.test(m.text())))
    consoleErrors.push(m.text().slice(0, 200));
});
const t0 = Date.now();
const mark = (what) =>
  console.log(
    `STEP +${Date.now() - t0}ms ${what} @ ${page.url().replace(base, "")}`,
  );
page.on("request", (r) => {
  if (
    /\/sales\/invoices/.test(r.url()) &&
    ["POST", "PATCH", "PUT"].includes(r.method())
  )
    console.log(
      `REQ +${Date.now() - t0}ms ${r.method()} ${r.url().replace(base, "")} @ ${page.url().replace(base, "")}`,
    );
});
page.on("response", async (r) => {
  if (r.status() >= 400 && r.url().includes("/api/"))
    console.log(
      "HTTP",
      r.status(),
      r.request().method(),
      r.url().replace(base, ""),
      (await r.text().catch(() => "")).slice(0, 300),
    );
});
const api = async (path) =>
  await (await ctx.request.get(`${base}/api/v1${path}`)).json();
try {
  await page.goto(`${base}/login/email`);
  await page.fill("input[type=email]", "scale@digikhaato.test");
  await page.fill("input[type=password]", "Scale-Run-2026!");
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  signedIn = true;

  const customers = (
    await api("/parties?type=customer&status=active&book=shop&page_size=100")
  ).data;
  const party = customers.find((p) => Number(p.shop?.customer_balance) > 0);
  const before = Number(
    (await api(`/parties/${party.id}?book=shop`)).data.shop.customer_balance,
  );
  const item = (await api("/items?page_size=50&ordering=name")).data.find(
    (i) => Number(i.selling_price) > 0 && Number(i.on_hand ?? 1) > 0,
  );
  console.log(
    `customer ${party.name} owes ${before}; item ${item.name} ${item.selling_price}`,
  );

  // 1. New bill → Saved customer → pick from the search, as a merchant does.
  await page.goto(`${base}/sales/invoices/new`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Saved customer" }).click();
  await page.getByLabel("Saved customer").fill(party.name);
  await page
    .getByRole("option", {
      name: new RegExp(party.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    })
    .first()
    .click();
  const box = page.getByTestId("invoice-customer-line");
  await box.waitFor();
  await page.waitForTimeout(800);
  const shown1 = await box.locator("[data-part=balance]").innerText();
  if (!shown1.includes(inr(before)))
    fail(
      `before: box shows "${shown1}", the API Shop balance is ${inr(before)}`,
    );

  // 2. One item, then Issue on credit.
  const add = page
    .getByRole("combobox", { name: /Search items to add|Add item/ })
    .first();
  await add.click();
  await page.keyboard.type(item.name, { delay: 10 });
  await page
    .getByRole("option", {
      name: new RegExp(item.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    })
    .first()
    .click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/${width}-before-issue.png` });
  const dialogText = async () =>
    page.evaluate(() =>
      [...document.querySelectorAll("[role=dialog]")].map((d) =>
        d.innerText.slice(0, 300),
      ),
    );
  console.log("dialogs before Issue:", JSON.stringify(await dialogText()));
  const issue = page.getByRole("button", { name: /^Issue/ }).last();
  mark("tap Issue");
  await issue.click({ timeout: 8000 }).catch(async (e) => {
    await page.screenshot({ path: `${dir}/${width}-issue-blocked.png` });
    console.log(
      "dialogs when Issue was blocked:",
      JSON.stringify(await dialogText()),
    );
    throw e;
  });
  await page.waitForTimeout(800);
  console.log("dialogs after Issue:", JSON.stringify(await dialogText()));
  // The payment sheet: "Take all, part or none now". Full credit, then the
  // sheet's own Issue.
  const sheet = page.getByRole("dialog");
  mark("tap Full credit");
  await sheet.getByRole("button", { name: "Full credit" }).click();
  mark("tap sheet Issue");
  await sheet.getByRole("button", { name: /Issue/ }).last().click();
  await page.waitForTimeout(2500);
  console.log("after issuing, at", page.url());
  await page.screenshot({ path: `${dir}/${width}-issued.png` });

  // 3. API read-back.
  const list =
    (
      await api(
        `/sales/invoices?book=shop&party_id=${party.id}&date_from=2000-01-01`,
      )
    ).data ?? [];
  const newest = [...list].sort((a, b) =>
    String(b.created_at ?? b.issued_at ?? "").localeCompare(
      String(a.created_at ?? a.issued_at ?? ""),
    ),
  )[0];
  const inv = newest ? (await api(`/sales/invoices/${newest.id}`)).data : null;
  if (!inv) fail("no invoice found from the issued page");
  const total = Number(inv?.grand_total ?? 0);
  if (inv && inv.party?.id !== party.id && inv.party_id !== party.id)
    fail(`invoice is for ${inv.party?.id ?? inv.party_id}, not ${party.id}`);
  if (inv && inv.status !== "issued") fail(`invoice status is ${inv.status}`);
  const after = Number(
    (await api(`/parties/${party.id}?book=shop`)).data.shop.customer_balance,
  );
  if (Math.abs(after - (before + total)) > 0.005)
    fail(
      `Shop balance ${before} + bill ${total} should be ${before + total}, the API says ${after}`,
    );
  console.log(
    `issued ${inv?.number} for ${total}; Shop balance ${before} → ${after}`,
  );

  // 4. Other screens, WITHOUT a reload. The merchant taps "New bill" on the
  // issued sheet and starts the next bill for the same customer through the
  // header search: every step is client-side.
  mark("tap New bill");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "New bill" })
    .click();
  await page.waitForTimeout(800);
  const trigger = page
    .locator("[data-testid=counter-search] button[aria-haspopup]")
    .first();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${dir}/${width}-after-new-bill.png` });
  console.log(
    "after New bill:",
    JSON.stringify(
      await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find(
          (x) => x.textContent === "Saved customer",
        );
        const r1 = b?.getBoundingClientRect();
        return {
          disabled: b?.disabled,
          pressed: b?.getAttribute("aria-pressed"),
          top: r1?.top,
          dialogs: [...document.querySelectorAll("[role=dialog]")].map((d) =>
            d.innerText.slice(0, 120),
          ),
          fieldsetDisabled: !!b?.closest("fieldset[disabled]"),
        };
      }),
    ),
  );
  mark("next bill: tap Saved customer");
  await page.getByRole("button", { name: "Saved customer" }).click();
  await page.getByLabel("Saved customer").fill(party.name);
  await page
    .getByRole("option", {
      name: new RegExp(party.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    })
    .first()
    .click();
  mark("next bill: customer picked");
  await box.waitFor();
  await page.waitForTimeout(4000);
  mark("next bill: after autosave window");
  await page.waitForTimeout(1000);
  const shown2 = await box.locator("[data-part=balance]").innerText();
  if (!shown2.includes(inr(after)))
    fail(
      `next bill, no reload: box shows "${shown2}", the API says ${inr(after)}`,
    );
  await page.screenshot({ path: `${dir}/${width}-next-bill.png` });
  await trigger.click();
  await page.keyboard.type(party.name.replace(/\s*\d+$/, ""), { delay: 10 });
  await page
    .locator("[cmdk-group]", { hasText: "People" })
    .locator("[cmdk-item]")
    .filter({ has: page.getByText(party.name, { exact: true }) })
    .first()
    .click();
  await page.waitForURL((u) => u.pathname === `/parties/${party.id}`);
  await page.waitForTimeout(1500);
  const text = await page.locator("main").innerText();
  if (!text.includes(inr(after)))
    fail(`customer page, no reload: ${inr(after)} is not on the page`);
  await page.screenshot({ path: `${dir}/${width}-customer.png` });
} finally {
  await browser.close();
}
console.log(
  `${failures.length} failures, ${consoleErrors.length} console errors`,
);
for (const f of failures) console.log("FAIL", f);
for (const c of [...new Set(consoleErrors)].slice(0, 10))
  console.log("CONSOLE", c);
process.exitCode = failures.length || consoleErrors.length ? 1 : 0;
