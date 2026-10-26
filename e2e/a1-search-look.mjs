// A1 / FB-011 — the header search, looked at, MEASURED and used on the live stack.
//
// At 390/320/1280 in both themes (Hindi at 320/1280): tap or click the search
// and type at once (the letters must survive the chunk load), screenshot the
// open search, and measure what the design asks — full screen with Back on a
// phone, a 640 px list under the field on a desktop, grouped rows at least
// 48 px tall with a one-line title, no page overflow, no text cut by its box.
// Then use it: Back / Esc close it, a person row opens their page, "New bill
// for …" opens a bill with that customer, and nothing is saved by searching.
//
//   node e2e/a1-search-look.mjs [--base=http://localhost:3000]
//
// Shots and results.json land in $E2E_SHOTS (default /tmp/e2e-shots/a1).
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const base =
  process.argv.find((a) => a.startsWith("--base="))?.slice(7) ??
  "http://localhost:3000";
const dir = process.env.E2E_SHOTS ?? "/tmp/e2e-shots/a1";
mkdirSync(dir, { recursive: true });
const results = [];
const failures = [];
const consoleErrors = [];
const fail = (tag, msg) => failures.push(`${tag}: ${msg}`);

function measure() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const dialog = document.querySelector("[role=dialog]");
  const input = document.querySelector("[cmdk-input]");
  const list = document.querySelector("[cmdk-list]");
  const rows = [...document.querySelectorAll("[cmdk-item]")].map((row) => {
    const r = row.getBoundingClientRect();
    const title = row.querySelector(".truncate");
    return {
      h: Math.round(r.height),
      w: Math.round(r.width),
      titleLines: title
        ? Math.round(
            title.getBoundingClientRect().height /
              parseFloat(getComputedStyle(title).lineHeight),
          )
        : 0,
    };
  });
  const headings = [...document.querySelectorAll("[cmdk-group-heading]")].map(
    (h) => h.textContent,
  );
  const pop = list?.closest("span.absolute");
  const field = input?.closest("span.relative");
  return {
    vw,
    vh,
    overflow: document.documentElement.scrollWidth - vw,
    dialog: dialog
      ? (({ width, height, top, left }) => ({ width, height, top, left }))(
          dialog.getBoundingClientRect(),
        )
      : null,
    inputFocused: document.activeElement === input,
    value: input?.value ?? null,
    rows,
    headings,
    popWidth: pop ? Math.round(pop.getBoundingClientRect().width) : null,
    popBelowField:
      pop && field
        ? Math.round(
            pop.getBoundingClientRect().top -
              field.getBoundingClientRect().bottom,
          )
        : null,
    footer: pop ? (pop.lastElementChild?.textContent ?? "") : "",
  };
}

// A1_SELFTEST=1 skews every expected figure by ₹1, to prove the read-back can fail.
const skew = process.env.A1_SELFTEST ? 1 : 0;
const inr = (v) =>
  "₹" +
  (Number(v) + skew).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** The rows on screen, by group: title, detail and the right-hand figure. */
const shownRows = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[cmdk-group]")].map((g) => ({
      heading: g.querySelector("[cmdk-group-heading]")?.textContent ?? "",
      rows: [...g.querySelectorAll("[cmdk-item]")].map((row) => {
        const spans = row.querySelectorAll(".truncate");
        return {
          title: spans[0]?.textContent ?? "",
          detail: spans[1]?.textContent ?? "",
          meta: row.querySelector(".ds-num")?.textContent ?? "",
        };
      }),
    })),
  );

/**
 * Data, not pixels: every figure the search shows is read back from the API
 * the screen itself uses and compared — the amount a customer owes, a bill's
 * total and paid state, an item's stock and price. A wrong field name shows a
 * plausible wrong number that no screenshot can catch.
 */
async function readBack(page, ctx, tag, term, wide) {
  const groups = await shownRows(page);
  const people = groups[1]?.rows ?? [];
  const api = (
    await (
      await ctx.request.get(
        `${base}/api/v1/parties?book=shop&status=active&q=${encodeURIComponent(term)}&ordering=name&page_size=20`,
      )
    ).json()
  ).data;
  let checked = 0;
  for (const row of people) {
    const party = api.find((p) => p.name === row.title);
    if (!party) {
      fail(
        tag,
        `People row "${row.title}" is not in the API answer for "${term}"`,
      );
      continue;
    }
    const supplierRow = /Supplier|सप्लायर/.test(row.detail);
    const due = supplierRow
      ? party.shop?.supplier_due
      : party.shop?.customer_due;
    const expected = Number(due) > 0 ? inr(due) : "";
    const shown = row.meta
      .replace(/ to (collect|pay)$/, "")
      .replace(/ (लेने|देने) हैं$/, "");
    if (shown !== expected)
      fail(
        tag,
        `"${row.title}" shows "${row.meta}", the API says ${expected || "nothing due"}`,
      );
    if (
      party.mobile &&
      !row.detail
        .replace(/\s/g, "")
        .includes(party.mobile.replace(/^\+91/, "").slice(-5))
    )
      fail(
        tag,
        `"${row.title}" detail "${row.detail}" does not carry mobile ${party.mobile}`,
      );
    checked += 1;
  }
  const bills = groups.find((g) => /Bills|बिल/.test(g.heading))?.rows ?? [];
  if (bills.length) {
    const inv = (
      await (
        await ctx.request.get(
          `${base}/api/v1/sales/invoices?book=shop&date_from=2000-01-01&q=${encodeURIComponent(term)}`,
        )
      ).json()
    ).data;
    for (const row of bills) {
      const number = row.title.split(" · ")[0];
      const doc = inv.find((d) => d.number === number);
      if (!doc) continue; // a purchase bill; its own list is not read here
      if (row.meta !== inr(doc.grand_total))
        fail(
          tag,
          `bill ${number} shows ${row.meta}, the API total is ${inr(doc.grand_total)}`,
        );
      const left = Number(doc.amount_due ?? 0);
      const state =
        left <= 0
          ? "Paid"
          : left < Number(doc.grand_total)
            ? "Part paid"
            : "Not paid";
      if (tag.endsWith("-en") && !row.detail.endsWith(state))
        fail(
          tag,
          `bill ${number} says "${row.detail}", the API due ${left} means "${state}"`,
        );
      checked += 1;
    }
  }
  return checked;
}

const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
);
try {
  for (const locale of ["en", "hi"]) {
    for (const width of locale === "hi" ? [320, 1280] : [390, 320, 1280]) {
      for (const theme of ["light", "dark"]) {
        if (
          process.env.A1_ONLY &&
          process.env.A1_ONLY !== `${width}-${theme}-${locale}`
        )
          continue;
        const phone = width < 1024;
        const tag = `${width}-${theme}-${locale}`;
        const ctx = await browser.newContext({
          viewport: { width, height: phone ? 800 : 900 },
          colorScheme: theme,
        });
        const host = new URL(base).hostname;
        await ctx.addCookies([
          { name: "ub_locale", value: locale, domain: host, path: "/" },
          { name: "ub_theme_choice", value: theme, domain: host, path: "/" },
        ]);
        // Counts React commits (the dev build calls the DevTools hook on each).
        await ctx.addInitScript(() => {
          window.__commits = 0;
          window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
            supportsFiber: true,
            renderers: new Map(),
            inject: () => 1,
            onCommitFiberRoot: () => {
              window.__commits += 1;
            },
            onCommitFiberUnmount: () => {},
            onPostCommitFiberRoot: () => {},
            checkDCE: () => {},
          };
        });
        const page = await ctx.newPage();
        let signedIn = false;
        page.on("console", (m) => {
          if (signedIn && (m.type() === "error" || /Warning:/.test(m.text())))
            consoleErrors.push(`${tag}: ${m.text().slice(0, 200)}`);
        });
        await page.goto(`${base}/login/email`);
        await page.fill("input[type=email]", "scale@digikhaato.test");
        await page.fill("input[type=password]", "Scale-Run-2026!");
        await page.keyboard.press("Enter");
        await page.waitForURL((u) => !u.pathname.startsWith("/login"));
        signedIn = true;
        const customers = (
          await (
            await ctx.request.get(
              `${base}/api/v1/parties?type=customer&status=active&book=shop&page_size=5`,
            )
          ).json()
        ).data;
        const person = customers[0];
        const term = person.name.split(" ")[0].toLowerCase();

        await page.goto(`${base}/customers`, { waitUntil: "networkidle" });
        const trigger = page
          .locator("[data-testid=counter-search] button[aria-haspopup]")
          .first();
        // Tap and type at once, as a merchant does: the letters must not be lost.
        const requests = [];
        const count = (r) =>
          /\/api\/v1\/(parties|items|sales\/invoices|purchases\/bills)\?/.test(
            r.url(),
          ) && requests.push(r.url());
        page.on("request", count);
        await page.mouse.move(1, 1);
        await page.screenshot({ path: `${dir}/${tag}-closed.png` });
        await trigger.click();
        await page.locator("[cmdk-input]").waitFor();
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${dir}/${tag}-empty.png` });
        const commitsBefore = await page.evaluate(() => window.__commits);
        await page.keyboard.type(term, { delay: 15 });
        await page.locator("[cmdk-item]").first().waitFor({ timeout: 15000 });
        await page.waitForTimeout(1200);
        const commits =
          (await page.evaluate(() => window.__commits)) - commitsBefore;
        const m = await page.evaluate(measure);
        const typedRequests = requests.length;
        m.readBack = await readBack(page, ctx, tag, term, !phone);
        if (m.readBack === 0) fail(tag, "no row was read back from the API");
        await page.screenshot({ path: `${dir}/${tag}-open.png` });
        // No match: the empty line, nothing else.
        await page.locator("[cmdk-input]").fill("zzqxw");
        await page
          .getByText(locale === "en" ? /^No match/ : /.+/)
          .first()
          .waitFor();
        await page.waitForTimeout(900);
        const none = await page.evaluate(measure);
        if (none.rows.length)
          fail(tag, `"zzqxw" still shows ${none.rows.length} rows`);
        await page.screenshot({ path: `${dir}/${tag}-nomatch.png` });
        await page.locator("[cmdk-input]").fill(term);
        await page.locator("[cmdk-item]").first().waitFor();
        page.off("request", count);
        m.requests = typedRequests;
        m.commits = commits;
        // A letter is a few commits (the field, the debounce, the answer), not dozens.
        if (commits > term.length * 4 + 12)
          fail(
            tag,
            `${commits} React commits while typing ${term.length} letters`,
          );
        // Each source is asked once per settled term, not once per letter.
        if (typedRequests > 8)
          fail(
            tag,
            `${typedRequests} search requests for "${term}" (one per letter?)`,
          );
        await page.screenshot({ path: `${dir}/${tag}-open.png` });
        results.push({ tag, ...m });

        if (m.value !== term)
          fail(tag, `typed "${term}" but the field holds "${m.value}"`);
        if (!m.inputFocused) fail(tag, "the search field does not have focus");
        if (m.overflow > 0)
          fail(tag, `page ${m.overflow}px wider than the viewport`);
        if (m.headings.length < 2)
          fail(tag, `only ${m.headings.length} group heading(s)`);
        for (const r of m.rows) {
          if (r.h < 48) fail(tag, `a row is ${r.h}px tall (< 48)`);
          if (r.titleLines > 1) fail(tag, "a row title wraps");
        }
        if (phone) {
          if (
            !m.dialog ||
            Math.round(m.dialog.width) !== width ||
            m.dialog.top !== 0
          )
            fail(tag, `not full screen: ${JSON.stringify(m.dialog)}`);
        } else {
          if (m.popWidth === null || Math.abs(m.popWidth - 640) > 2)
            fail(tag, `list is ${m.popWidth}px wide, not 640`);
          if (
            m.popBelowField === null ||
            m.popBelowField < 0 ||
            m.popBelowField > 12
          )
            fail(tag, `list is ${m.popBelowField}px from the field`);
          if (!/Enter/.test(m.footer))
            fail(tag, "no keyboard hints under the list");
        }

        if (locale === "en" && theme === "dark") {
          // Busy counter: a double tap opens ONE search; a slow network keeps
          // the field and what was typed; Back closes it.
          if (phone) await page.getByRole("button", { name: "Back" }).click();
          else await page.keyboard.press("Escape");
          await trigger.dblclick();
          await page.waitForTimeout(300);
          const inputs = await page.locator("[cmdk-input]").count();
          if (inputs !== 1)
            fail(tag, `a double tap left ${inputs} search fields`);
          const cdp = await ctx.newCDPSession(page);
          await cdp.send("Network.emulateNetworkConditions", {
            offline: false,
            latency: 1500,
            downloadThroughput: 50000,
            uploadThroughput: 50000,
          });
          await page.keyboard.type(term, { delay: 15 });
          await page.waitForTimeout(400);
          const slow = await page.evaluate(measure);
          if (slow.value !== term)
            fail(tag, `slow network: field holds "${slow.value}"`);
          await page.screenshot({ path: `${dir}/${tag}-slow.png` });
          await cdp.send("Network.emulateNetworkConditions", {
            offline: false,
            latency: 0,
            downloadThroughput: -1,
            uploadThroughput: -1,
          });
          await page.locator("[cmdk-item]").first().waitFor({ timeout: 20000 });
        }
        if (locale === "en" && theme === "light") {
          // Items: stock and price read back from the item API.
          const item = (
            await (
              await ctx.request.get(
                `${base}/api/v1/items?page_size=1&ordering=name`,
              )
            ).json()
          ).data?.[0];
          if (item) {
            const word = item.name.split(" ")[0];
            await page.locator("[cmdk-input]").fill(word);
            const itemRow = page
              .locator("[cmdk-group]", { hasText: "Items" })
              .locator("[cmdk-item]")
              .filter({ has: page.getByText(item.name, { exact: true }) })
              .first();
            await itemRow
              .waitFor({ timeout: 15000 })
              .catch(() =>
                fail(tag, `item "${item.name}" not found by "${word}"`),
              );
            if (await itemRow.count()) {
              const meta = await itemRow.locator(".ds-num").innerText();
              if (meta !== inr(item.selling_price))
                fail(
                  tag,
                  `item ${item.name} shows ${meta}, the API price is ${inr(item.selling_price)}`,
                );
              const detail = await itemRow
                .locator(".truncate")
                .nth(1)
                .innerText();
              if (
                item.on_hand != null &&
                !detail.includes(String(Number(item.on_hand)))
              )
                fail(
                  tag,
                  `item ${item.name} says "${detail}", the API stock is ${item.on_hand}`,
                );
            }
          }
          // Close: Back on a phone, Esc on a desktop. Focus returns to the trigger.
          if (phone) await page.getByRole("button", { name: "Back" }).click();
          else await page.keyboard.press("Escape");
          await page.waitForTimeout(200);
          if (await page.locator("[cmdk-input]").count())
            fail(tag, "search still open after closing");
          // Person row opens their page.
          await trigger.click();
          // The seeded names end in a number, which the search reads as an
          // amount ("ramesh 500"); search the name and pick the exact row.
          const word = person.name.replace(/\s*\d+$/, "");
          await page.keyboard.type(word, { delay: 10 });
          const personRow = page
            .locator("[cmdk-group]", { hasText: "People" })
            .locator("[cmdk-item]")
            .filter({ has: page.getByText(person.name, { exact: true }) })
            .first();
          await personRow.waitFor();
          const typedPerson = await page.locator("[cmdk-input]").inputValue();
          if (typedPerson !== word)
            fail(tag, `typed "${word}" but the field holds "${typedPerson}"`);
          await personRow.click();
          await page
            .waitForURL((u) => u.pathname === `/parties/${person.id}`, {
              timeout: 10000,
            })
            .catch(() =>
              fail(
                tag,
                `person row did not open /parties/${person.id}; at ${page.url()}`,
              ),
            );
          // New bill for … opens a bill with the customer, saving nothing.
          const before = (
            await (
              await ctx.request.get(
                `${base}/api/v1/sales/invoices?book=shop&page_size=1`,
              )
            ).json()
          ).meta?.total;
          await trigger.click();
          await page.keyboard.type(person.name.replace(/\s*\d+$/, ""), {
            delay: 10,
          });
          const billRow = page
            .locator("[cmdk-item]", { hasText: "New bill for " })
            .first();
          await billRow.waitFor();
          const billFor = (
            await billRow.locator(".truncate").first().innerText()
          ).replace("New bill for ", "");
          await billRow.click();
          await page
            .waitForURL((u) => u.pathname === "/sales/invoices/new", {
              timeout: 10000,
            })
            .catch(() =>
              fail(
                tag,
                `New bill row did not open a new bill; at ${page.url()}`,
              ),
            );
          const url = new URL(page.url());
          if (
            url.searchParams.get("partyName") !== billFor ||
            !url.searchParams.get("party")
          )
            fail(
              tag,
              `new bill opened for ${url.searchParams.get("partyName")}, the row said ${billFor}`,
            );
          const after = (
            await (
              await ctx.request.get(
                `${base}/api/v1/sales/invoices?book=shop&page_size=1`,
              )
            ).json()
          ).meta?.total;
          if (before !== after)
            fail(
              tag,
              `searching saved something: invoices ${before} → ${after}`,
            );
          await page.screenshot({ path: `${dir}/${tag}-new-bill.png` });
        }
        await ctx.close();
      }
    }
  }
} finally {
  writeFileSync(
    `${dir}/results.json`,
    JSON.stringify({ results, failures, consoleErrors }, null, 2),
  );
  await browser.close();
}
console.log(
  `${results.length} views, ${failures.length} failures, ${consoleErrors.length} console errors`,
);
for (const f of failures.slice(0, 40)) console.log("FAIL", f);
for (const c of [...new Set(consoleErrors)].slice(0, 10))
  console.log("CONSOLE", c);
process.exitCode = failures.length || consoleErrors.length ? 1 : 0;
