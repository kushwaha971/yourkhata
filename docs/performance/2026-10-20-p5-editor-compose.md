# Bill editor: always-open item search, customer line, offline and issue states

20 October 2026. R-DEC-27 billing/POS, 07-screens/09 §3. **Editor composition
piece verified locally; the sales/POS family is still not complete** (see
"Not in this piece").

## What changed and why

- **Item search always open at the top of the lines** (`ItemQuickAdd`). The
  search used to live only inside a line, so every item cost a tap on "Add item"
  first and a scanner aimed at the screen had nowhere to land. It reuses
  `useItemSearch` (the one item source) and its `lookup` scanner path; a pick
  goes through the editor's existing `pick` → `itemLineDefaults`, so prices,
  price lists, stock warnings and tax are owned where they were. It fills the
  trailing empty line or appends one, then the caret goes to that line's Qty
  (`UbLineItemsEditor` gained `focusRequest`, which also expands a compact
  card). Enter while the list still answers an earlier term is a scan, never a
  pick of the stale row. No match says so, and adds "Ask the owner to add it."
  for a member without `inventory.item.write`.
- **The picked customer collapses to one line**: name, what they owe in the
  **Shop** book (`getParty(id, signal, 'shop')`, DEC-019) and Change. The same
  single read sets the place of supply, as before.
- **Offline**: with the network confirmed gone, Issue is disabled with the
  reason under it ("No internet. Your bill is kept; issue it when you're back
  online."), in the dock below 1536 px and above the form from 1536 px.
  Degraded links still issue; the issue is keyed.
- **Slow issue**: after 3 s "Still issuing… it won't be issued twice."
  (`useStillWorking`).
- **Issue's accessible name carries the total** ("Issue, ₹1,062.00").

## Defects found by running it, not by tests

1. **320 px: the customer's name squeezed to "Bose &…"** between the figure and
   Change. The measuring check failed it in both themes; the name now owns its
   line and the figure and Change wrap under it.
2. **Draft recovery drew Restore as the red danger button**, with no time —
   the safe answer looked like the destructive one. Restore is now the primary,
   and the title says when the bill was kept ("…at 08:47?").
3. **Escape, × or a stray tap discarded the kept bill.** `onOpenChange(false)`
   called `discardRestore`. Now only Discard throws the copy away; closing the
   offer keeps it (`postponeRestore`, `UbConfirmDialog.onCancel`). Test fails on
   the old code.

## Acceptance

- 12 new editor/dialog tests + 2 hook tests, each failing before its change (one guard, "not drawn without item rights", passes either way)
  (8 editor tests failed on the old editor; the dialog Escape test failed with
  `discardRestore` called once). One existing fixture updated to the real
  `getParty` shape (`summary`), and its call assertion to the Shop book.
- Changed-file ESLint, type check, locale split/check, **410 suites / 4,564
  tests**, production build, bundle and 174 contrast pairs pass; jest and build
  sequential, standalone frontend restarted after the final build.
- `e2e/revamp-editor-compose.mjs` on the local QA tenant (Scale Traders, 5,000
  items, 2,000 contacts): **80 frames** — English 390/320/1024/1280 light and
  dark, Hindi 320/1280 light and dark — empty, search open, item added, second
  item, customer line, offline; then at 1280 the real flows: a bill kept on the
  device when its save is refused, reload, Restore offered and accepted, and a
  **real Quick Sale issued** (INV/26-27/10960, paid ₹531.00 cash, on an
  untracked QA cable item). Every frame: no page overflow, no cut text, no
  label under 4.5:1; caret on Qty after each pick; Issue disabled offline.
  Drafts the run created are deleted at the end. Nothing was sent to anybody.
- Editor reads measured on the API: the customer's Shop read 56–84 ms, item
  search 43–60 ms.

## Bundle

Sales editor routes +2.9 KB, purchase editors +1.1 KB (shared line editor and
dock). About 0.8–1.0 KB on unrelated routes is Turbopack re-splitting a shared
chunk, measured on /settings/team against an unchanged dev build (one 27.6 KB
chunk became 20.4 + 8.2 KB with no editor code in either). The unchanged dev
build was already 0.1 KB over on several first-load scalars. Exceeded scalars
raised to measured + 0.3 KB with the reason in `bundle-budgets.json`; framework
and shared-app ceilings unchanged. Moving the five search strings from the
item-picker catalogue (loaded by reports and settings) into the sales
catalogue was tried and measured: it made no difference to those routes, so
the cost there is the re-split, not the strings — the strings stay in sales.

## Speed

`perf-app.mjs --reps=3 --only=nav`, compared with this container's 18 Oct run
(same 36 cases): median content 578 → 738 ms, p95 1,243 → 2,115 ms. **This is
not a claim about the editor**, which the harness does not navigate to. Most
cases moved +7 to +275 ms unthrottled. One case moved a lot and is a real
finding: **Shop Home → Customers 131–214 → 1,649–1,668 ms** because
`GET /parties?book=shop&type=customer` takes 1.5–1.9 s on this tenant (the
plain list is 136 ms). The time is in three queries that compute each
customer's Shop dues with a correlated `SUM(amount_due)` over `sales_document`
for all 2,000 contacts (list 0.75 s, totals 0.33 s, chip counts 0.28 s). It
predates this piece and is recorded as the next fix in the Shop order. Raw:
`data/2026-10-20-editor-compose-nav.json`.

## Not in this piece

Create item / restore an archived look-alike from a no-match search (needs the
item drawer in the editor's chunk), "Add Ramesh" from the customer search, the
"For this bill only. The usual price stays ₹450." line under a changed rate, a
same-item pick adding quantity rather than a second line (spec is silent; kept
as separate lines), the 50+ line "Jump to line" chip, and the expired-session
return. Physical phones, scanners and keyboards are not proved by Chromium.

Provisional self-review of this piece's verified scope against 09's weights:
**8.4/10** — not a whole-POS or merchant-research score.
