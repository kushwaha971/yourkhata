// A3 / FB-013 — the saved customer box on a new bill, looked at, MEASURED,
// read back from the API and used like a busy counter, on the live stack.
//
// Cases: Quick sale, then a saved customer who owes, one with nothing due, one
// in advance (if the book has one), and the longest name in the book; at
// 390/320/1280 in both themes, Hindi at 320/1280. For each it measures the
// design's two lines: avatar · name · Change on line 1 and mobile · balance on
// line 2, with the balance right-aligned in a column and Change aligned to the
// name. It reads the shown balance back from GET /parties/{id}?book=shop.
// Busy counter: double-tapping Change, switching Quick sale ↔ customer fast,
// a slow balance reply, and a reload with a customer chosen.
//
//   node e2e/a3-customer-box-look.mjs   (E2E_SHOTS, PW_CHROME, A3_ONLY=<tag>)
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const base =
  process.argv.find((a) => a.startsWith("--base="))?.slice(7) ??
  (process.env.E2E_BASE ?? "http://localhost:3000");
const dir = process.env.E2E_SHOTS ?? "/tmp/e2e-shots/a3";
mkdirSync(dir, { recursive: true });
const results = [];
const failures = [];
const consoleErrors = [];
const fail = (tag, msg) => failures.push(`${tag}: ${msg}`);
const inr = (v) =>
  "₹" +
  Math.abs(Number(v)).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** The box's geometry and words, whatever markup it is built from. */
function measureBox() {
  const box = document.querySelector("[data-testid=invoice-customer-line]");
  if (!box) return null;
  const r = box.getBoundingClientRect();
  const q = (sel) => box.querySelector(sel);
  const rect = (el) => (el ? el.getBoundingClientRect() : null);
  const name = q("[data-part=name]");
  const change = [...box.querySelectorAll("button")].find((b) =>
    /Change|बदलें/.test(b.textContent),
  );
  const mobile = q("[data-part=mobile]");
  const balance = q("[data-part=balance]");
  const avatar = box.firstElementChild;
  const cut = [...box.querySelectorAll("*")].filter(
    (el) =>
      !el.children.length &&
      el.textContent.trim() &&
      el.scrollWidth > el.clientWidth + 1 &&
      getComputedStyle(el).textOverflow !== "ellipsis",
  ).length;
  return {
    box: {
      w: Math.round(r.width),
      h: Math.round(r.height),
      radius: getComputedStyle(box).borderTopLeftRadius,
    },
    name: name
      ? {
          text: name.textContent,
          cut: name.scrollWidth > name.clientWidth + 1,
          room: Math.round(
            name.parentElement.getBoundingClientRect().width -
              (change ? change.getBoundingClientRect().width : 0) -
              12,
          ),
          need: name.scrollWidth,
          ...rect(name).toJSON(),
        }
      : null,
    change: change ? rect(change).toJSON() : null,
    mobile: mobile
      ? {
          text: mobile.textContent,
          cut: mobile.scrollWidth > mobile.clientWidth + 1,
          ...rect(mobile).toJSON(),
        }
      : null,
    balance: balance
      ? {
          text: balance.textContent,
          color: getComputedStyle(balance).color,
          ...rect(balance).toJSON(),
        }
      : null,
    avatar: avatar ? rect(avatar).toJSON() : null,
    caption: /Saved customer|सहेजा गया ग्राहक/.test(box.textContent),
    cut,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    css: (() => {
      const cs = (el) => (el ? getComputedStyle(el) : null);
      const b = cs(box);
      const nm = cs(name);
      const ch = cs(change);
      const mo = cs(mobile);
      const ba = cs(balance);
      const av = avatar ? avatar.getBoundingClientRect() : null;
      const seg = document.querySelector("[role=group][aria-label]");
      const sg = cs(seg);
      const half = seg?.querySelector("button");
      const hb = half ? getComputedStyle(half) : null;
      const row = box.parentElement;
      return {
        pad: b && `${b.paddingTop} ${b.paddingRight}`,
        radius: b?.borderTopLeftRadius,
        gap: b && `${b.rowGap} ${b.columnGap}`,
        avatar: av && `${Math.round(av.width)}x${Math.round(av.height)}`,
        name: nm && `${nm.fontSize}/${nm.fontWeight}`,
        change: ch && `${ch.fontSize}/${ch.fontWeight}`,
        mobile: mo?.fontSize,
        balance:
          ba && `${ba.fontSize}/${ba.fontWeight}/${ba.fontVariantNumeric}`,
        seg: sg && `${sg.borderTopLeftRadius} ${sg.paddingTop}`,
        half:
          half &&
          `${Math.round(half.getBoundingClientRect().height)} ${hb.fontSize}/${hb.fontWeight}`,
        cols: getComputedStyle(row).gridTemplateColumns,
      };
    })(),
    switchW: (() => {
      const g = document.querySelector("[role=group][aria-label]");
      return g ? Math.round(g.getBoundingClientRect().width) : null;
    })(),
  };
}

const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
);
try {
  for (const locale of ["en", "hi"]) {
    for (const width of locale === "hi" ? [320, 1280] : [390, 320, 1280]) {
      for (const theme of ["light", "dark"]) {
        const tag = `${width}-${theme}-${locale}`;
        if (process.env.A3_ONLY && process.env.A3_ONLY !== tag) continue;
        const phone = width < 1024;
        const ctx = await browser.newContext({
          viewport: { width, height: phone ? 800 : 900 },
          colorScheme: theme,
        });
        const host = new URL(base).hostname;
        await ctx.addCookies([
          { name: "ub_locale", value: locale, domain: host, path: "/" },
          { name: "ub_theme_choice", value: theme, domain: host, path: "/" },
        ]);
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

        const all = (
          await (
            await ctx.request.get(
              `${base}/api/v1/parties?type=customer&status=active&book=shop&page_size=100`,
            )
          ).json()
        ).data;
        const shopBal = (p) => Number(p.shop?.customer_balance ?? 0);
        const owes = all.find((p) => shopBal(p) > 0);
        const settled = all.find((p) => shopBal(p) === 0);
        const advance = all.find((p) => shopBal(p) < 0);
        const longest = [...all].sort(
          (a, b) => b.name.length - a.name.length,
        )[0];
        const cases = [
          ["owes", owes],
          ["settled", settled],
          ["advance", advance],
          ["long", longest],
        ].filter(([, p]) => p);

        await page.goto(`${base}/sales/invoices/new`, {
          waitUntil: "networkidle",
        });
        await page.mouse.move(1, 1);
        await page.screenshot({ path: `${dir}/${tag}-quick.png` });
        const quick = await page.evaluate(measureBox);
        results.push({ tag, case: "quick", ...quick });

        for (const [name, party] of cases) {
          await page.goto(
            `${base}/sales/invoices/new?party=${party.id}&partyName=${encodeURIComponent(party.name)}`,
            { waitUntil: "networkidle" },
          );
          await page
            .locator("[data-testid=invoice-customer-line]")
            .waitFor({ timeout: 15000 });
          await page.waitForTimeout(600);
          await page.mouse.move(1, 1);
          const m = await page.evaluate(measureBox);
          await page.screenshot({ path: `${dir}/${tag}-${name}.png` });
          results.push({ tag, case: name, party: party.name, ...m });
          if (!m) {
            fail(tag, `${name}: no customer box`);
            continue;
          }
          // Data: the shown balance is the server's SHOP figure, read back —
          // `shop.customer_balance`, the Customers list's number; never
          // `summary.balance`, which is the main (Udhaar) book (FB-018).
          const api = (
            await (
              await ctx.request.get(
                `${base}/api/v1/parties/${party.id}?book=shop`,
              )
            ).json()
          ).data;
          const bal = Number(api.shop?.customer_balance ?? 0);
          const shown = m.balance?.text ?? "";
          const expected = bal === 0 ? null : inr(bal);
          if (expected && !shown.includes(expected))
            fail(
              tag,
              `${name}: box shows "${shown}", the API balance is ${bal}`,
            );
          if (!expected && /₹/.test(shown))
            fail(
              tag,
              `${name}: box shows "${shown}", the API says nothing due`,
            );
          if (
            api.mobile &&
            !(m.mobile?.text ?? "")
              .replace(/\s/g, "")
              .includes(api.mobile.replace(/^\+91/, "").slice(-5))
          )
            fail(
              tag,
              `${name}: mobile "${m.mobile?.text}" is not ${api.mobile}`,
            );
          // The design's numbers (§A3 .cbox / .segc), measured.
          const want = {
            pad: "12px 14px",
            radius: "10px",
            gap: "2px 12px",
            avatar: "36x36",
            name: "15px/600",
            change: "14px/600",
            mobile: "13px",
            balance: "13px/600/tabular-nums",
            seg: "10px 3px",
            half: "36 14px/600",
          };
          for (const [k, v] of Object.entries(want))
            if (m.css[k] !== v)
              fail(tag, `${name}: ${k} is ${m.css[k]}, the design says ${v}`);
          if (!phone) {
            // R-DEC-53 (A4): at 1280 More details moved to the bill's 340 px
            // side column, and dBill draws this card as 300px · minmax(0,1fr).
            // The A3-era rule (300 · 1fr · 360) failed every 1280 view after
            // that, unnoticed until the §10 regression ran it again.
            const cols = m.css.cols.split(" ");
            if (cols[0] !== "300px" || cols.length !== 2)
              fail(
                tag,
                `${name}: desktop row is ${m.css.cols}, dBill says 300px · 1fr`,
              );
          }
          // The design's composition.
          if (m.caption)
            fail(
              tag,
              `${name}: the extra "Saved customer" caption is still in the box`,
            );
          if (
            m.name &&
            m.change &&
            Math.abs(
              m.name.top +
                m.name.height / 2 -
                (m.change.top + m.change.height / 2),
            ) > 4
          )
            fail(tag, `${name}: Change is not on the name's line`);
          // The balance shares the mobile's line when both fit; when they
          // cannot, it wraps to its own line rather than cutting the number.
          if (
            m.mobile &&
            m.balance &&
            m.mobile.right + 12 + m.balance.width <= m.balance.right + 1 &&
            Math.abs(
              m.mobile.top +
                m.mobile.height / 2 -
                (m.balance.top + m.balance.height / 2),
            ) > 4
          )
            fail(
              tag,
              `${name}: balance left the mobile's line although both fit`,
            );
          if (
            m.balance &&
            m.change &&
            Math.abs(m.balance.right - m.change.right) > 2
          )
            fail(
              tag,
              `${name}: balance and Change do not share a right edge (${m.balance.right} / ${m.change.right})`,
            );
          if (m.mobile?.cut)
            fail(
              tag,
              `${name}: the mobile is cut ("${m.mobile.text}" does not fit)`,
            );
          if (m.name?.cut && m.name.need <= m.name.room)
            fail(
              tag,
              `${name}: the name is cut with room to spare (${m.name.need}px needed, ${m.name.room}px free)`,
            );
          if (m.cut)
            fail(tag, `${name}: ${m.cut} text node(s) cut without an ellipsis`);
          if (m.overflow > 0)
            fail(tag, `${name}: page ${m.overflow}px wider than the viewport`);
          if (
            phone &&
            m.change &&
            m.change.height < 44 &&
            !(await page
              .locator("[data-testid=invoice-customer-line] button.ub-hit")
              .count())
          )
            fail(
              tag,
              `${name}: Change is a ${Math.round(m.change.height)}px target with no hit area`,
            );
        }

        if (locale === "en" && theme === "light" && owes) {
          // Busy counter. Double-tap Change: one search field, no error.
          await page.goto(
            `${base}/sales/invoices/new?party=${owes.id}&partyName=${encodeURIComponent(owes.name)}`,
            { waitUntil: "networkidle" },
          );
          const change = page.locator(
            "[data-testid=invoice-customer-line] button",
            { hasText: "Change" },
          );
          await change.dblclick();
          await page.waitForTimeout(300);
          if (await page.locator("[data-testid=invoice-customer-line]").count())
            fail(tag, "Change did not clear the customer");
          // Switch fast Quick sale ↔ Saved customer: ends on what was pressed last.
          // Today's chips are radios, the new switch is buttons: find either.
          const seg = (n) =>
            page.locator("button, [role=radio]").filter({ hasText: n }).first();
          for (let i = 0; i < 4; i += 1) {
            await seg(/Quick sale/i).click();
            await seg(/Saved customer/i).click();
          }
          const last = seg(/Saved customer/i);
          const on =
            (await last.getAttribute("aria-pressed")) ??
            (await last.getAttribute("aria-checked"));
          if (on !== "true")
            fail(tag, "fast switching did not end on Saved customer");
          // A slow balance reply for a customer, then the box must show the server's figure.
          const cdp = await ctx.newCDPSession(page);
          await cdp.send("Network.enable");
          await cdp.send("Network.emulateNetworkConditions", {
            offline: false,
            latency: 1500,
            downloadThroughput: 60000,
            uploadThroughput: 60000,
          });
          await page.goto(
            `${base}/sales/invoices/new?party=${owes.id}&partyName=${encodeURIComponent(owes.name)}`,
          );
          await page
            .locator("[data-testid=invoice-customer-line]")
            .waitFor({ timeout: 30000 });
          const early = await page.evaluate(measureBox);
          await page.screenshot({ path: `${dir}/${tag}-slow.png` });
          await cdp.send("Network.emulateNetworkConditions", {
            offline: false,
            latency: 0,
            downloadThroughput: -1,
            uploadThroughput: -1,
          });
          await page.waitForTimeout(2500);
          const late = await page.evaluate(measureBox);
          if (
            early?.box.h &&
            late?.box.h &&
            Math.abs(early.box.h - late.box.h) > 1
          )
            fail(
              tag,
              `the box changes height when the balance arrives (${early.box.h} → ${late.box.h})`,
            );
          // Reload with the customer chosen: the same customer and figure.
          await page.reload({ waitUntil: "networkidle" });
          await page.waitForTimeout(800);
          const again = await page.evaluate(measureBox);
          if (again?.name?.text !== owes.name)
            fail(tag, `after reload the box says "${again?.name?.text}"`);
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
for (const f of failures.slice(0, 50)) console.log("FAIL", f);
for (const c of [...new Set(consoleErrors)].slice(0, 10))
  console.log("CONSOLE", c);
process.exitCode = failures.length || consoleErrors.length ? 1 : 0;
