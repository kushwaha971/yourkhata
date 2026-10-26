// A2 / FB-012 — folding sections, looked at and MEASURED on the live stack.
//
// Opens the three places a merchant meets a folding section most — a
// customer's Details, the new bill's "More details" and the item form — at
// 390/320/1280 in both themes (Hindi at 320/1280), screenshots each, and
// measures what FB-012 was about: no bordered box inside the open section,
// the header's fill reaching the border, the root clipping, a 52 px header,
// no page overflow and no text cut by its own box.
//
//   node e2e/a2-disclosure-look.mjs [--base=http://localhost:3000]
//
// Writes go nowhere: it opens and closes sections only. Shots and
// results.json land in /tmp/e2e-shots/a2.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const base =
  process.argv.find((a) => a.startsWith("--base="))?.slice(7) ??
  "http://localhost:3000";
const dir = process.env.E2E_SHOTS ?? "/tmp/e2e-shots/a2";
mkdirSync(dir, { recursive: true });
const results = [];
const failures = [];
const consoleErrors = [];

function measureDisclosures() {
  const out = [];
  for (const trigger of document.querySelectorAll(
    "button[aria-expanded][aria-controls]",
  )) {
    const root = trigger.parentElement;
    const cs = getComputedStyle(root);
    if (!root || !cs.borderTopWidth || cs.borderTopWidth === "0px") continue;
    if (!root.className.includes("overflow-clip")) continue;
    const panel = document.getElementById(
      trigger.getAttribute("aria-controls"),
    );
    const open = trigger.getAttribute("aria-expanded") === "true";
    // An inner box: any descendant of the open panel drawing its own border
    // on all four sides with rounded corners — the "box inside the box".
    let innerBox = null;
    if (open && panel) {
      for (const el of panel.querySelectorAll("*")) {
        if (
          el.matches(
            "input, textarea, select, button, [role=combobox], [role=switch]",
          )
        )
          continue;
        if (
          el.closest(
            "input, textarea, select, button, [role=combobox], [data-ub-field]",
          )
        )
          continue;
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (r.width < panel.getBoundingClientRect().width - 40) continue;
        if (
          s.borderLeftWidth !== "0px" &&
          s.borderRightWidth !== "0px" &&
          s.borderTopWidth !== "0px" &&
          parseFloat(s.borderTopLeftRadius) > 0
        ) {
          innerBox = el.tagName + "." + String(el.className).slice(0, 60);
          break;
        }
      }
    }
    const rr = root.getBoundingClientRect();
    const tr = trigger.getBoundingClientRect();
    out.push({
      label: trigger.innerText.split("\n")[0],
      open,
      headerHeight: Math.round(tr.height),
      headerFillsWidth: Math.abs(tr.width - (rr.width - 2)) <= 1,
      triggerRadius: getComputedStyle(trigger).borderTopLeftRadius,
      rootRadius: cs.borderTopLeftRadius,
      rootOverflow: cs.overflow,
      panelPadding: panel && open ? getComputedStyle(panel).padding : null,
      innerBox,
    });
  }
  return out;
}

function pageFit() {
  const cut = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.children.length || !el.textContent.trim()) continue;
    const s = getComputedStyle(el);
    if (
      s.display === "none" ||
      s.visibility === "hidden" ||
      s.webkitLineClamp !== "none"
    )
      continue;
    if (el.scrollWidth > el.clientWidth + 1 && s.overflow !== "visible")
      cut.push(el.textContent.trim().slice(0, 40));
  }
  return {
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    cut: cut.slice(0, 5),
  };
}

async function check(page, tag, name) {
  await page.mouse.move(1, 1);
  await page.waitForTimeout(250);
  const disclosures = await page.evaluate(measureDisclosures);
  const fit = await page.evaluate(pageFit);
  await page.screenshot({ path: `${dir}/${tag}-${name}.png`, fullPage: true });
  const row = { tag, name, disclosures, fit };
  results.push(row);
  for (const d of disclosures) {
    if (d.innerBox)
      failures.push(
        `${tag} ${name}: "${d.label}" has an inner box ${d.innerBox}`,
      );
    if (d.triggerRadius !== "0px")
      failures.push(
        `${tag} ${name}: "${d.label}" header has its own radius ${d.triggerRadius}`,
      );
    if (!d.headerFillsWidth)
      failures.push(
        `${tag} ${name}: "${d.label}" header fill stops short of the border`,
      );
    if (d.headerHeight < 52)
      failures.push(
        `${tag} ${name}: "${d.label}" header ${d.headerHeight}px < 52`,
      );
  }
  if (fit.overflow > 0)
    failures.push(
      `${tag} ${name}: page ${fit.overflow}px wider than the viewport`,
    );
}

async function openSection(page, name) {
  const trigger = page
    .getByRole("button", { name, exact: false })
    .and(page.locator("[aria-expanded]"))
    .first();
  if (!(await trigger.count())) return false;
  if ((await trigger.getAttribute("aria-expanded")) !== "true")
    await trigger.click();
  return true;
}

const browser = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
);
try {
  for (const locale of ["en", "hi"]) {
    const widths = locale === "hi" ? [320, 1280] : [390, 320, 1280];
    for (const width of widths) {
      for (const theme of ["light", "dark"]) {
        const ctx = await browser.newContext({
          viewport: { width, height: width < 768 ? 800 : 900 },
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
          if (!signedIn) return;
          if (m.type() === "error" || /Warning:/.test(m.text()))
            consoleErrors.push(
              `${width}-${theme}-${locale}: ${m.text().slice(0, 200)}`,
            );
        });
        const tag = `${width}-${theme}-${locale}`;
        await page.goto(`${base}/login/email`);
        await page.fill("input[type=email]", "scale@digikhaato.test");
        await page.fill("input[type=password]", "Scale-Run-2026!");
        await page.keyboard.press("Enter");
        await page.waitForURL((u) => !u.pathname.startsWith("/login"));
        signedIn = true;

        const parties = (
          await (
            await ctx.request.get(
              `${base}/api/v1/parties?type=customer&status=active&page_size=5`,
            )
          ).json()
        ).data;
        const party = parties.find((p) => p.gstin || p.address) ?? parties[0];
        await page.goto(`${base}/parties/${party.id}`, {
          waitUntil: "networkidle",
        });
        const details = locale === "hi" ? "विवरण" : "Details";
        await check(page, tag, "party-closed");
        if (await openSection(page, details))
          await check(page, tag, "party-open");

        await page.goto(`${base}/sales/invoices/new`, {
          waitUntil: "networkidle",
        });
        await check(page, tag, "bill-closed");
        if (await openSection(page, locale === "hi" ? "और" : "More details"))
          await check(page, tag, "bill-open");

        await page.goto(`${base}/items?new=1`, { waitUntil: "networkidle" });
        const add = page
          .getByRole("button", {
            name: locale === "hi" ? "आइटम जोड़ें" : "Add item",
          })
          .first();
        if (await add.count()) {
          await add.click();
          await page.getByRole("dialog").waitFor();
          await check(page, tag, "item-form");
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
