# Bill editor toward the Counter Mode standard: busy-counter steps

20 October 2026. R-DEC-27 billing/POS, 07-screens/09 §3, measured against the
owner's Counter Mode artifact (steps 9 and 10) as the acceptance reference.
**This is part of the >8.5 plan; Jump to line, the expired-session return and
the rescore are still to come** (see "Not in this piece"). Two commits: the
counter steps (b7a001a), then hold/resume and "Add <name>" (second section).

## What changed and why

- **The same item again raises Qty** on its line instead of adding a row
  (`InvoiceLinesSection.quickAdd`, `stepQuantity`). Six scans of one bulb were
  six rows to read and check.
- **A scan keeps the caret in the search.** A HID scanner types into whatever
  has focus; with the caret moved to Qty after a scan, the next code would have
  been typed into the quantity. `ItemQuickAdd` now says how a row was chosen
  (`'scan' | 'list'`); a pick from the list still moves the caret to Qty.
- **"Paid cash" issues a Quick Sale in one tap**, with exactly the row the
  payment sheet defaults to (`fullCashPayment`); "UPI or other" opens the sheet
  as before. Same schema check, keyed issue and offline refusal. On a Quick
  Sale the dock holds these two; Save draft moves to the header (autosave and
  the device copy keep the bill either way). A saved customer's bill keeps
  Issue, because it may go on credit. *Deliberate difference from the artifact,
  whose dock shows Save draft and Save bill; told to the owner on 20 Oct.*
- **The docked total says what it counts**: "1 item · includes GST ₹162.00",
  and the draft's save state moved into the dock when docked (one live region,
  not two). `UbTotalDock` gained `caption` and `meta`.
- **Picker options say stock in words and the GST**: "40 PCS in stock",
  "Low: 3 PCS left", "Out of stock"; "Usual price ₹450.00 · plus GST 18%" or
  "GST 5% included". The list API now sends `gst_percent` to every member
  (it is printed on the bill they write); cost and margin stay cost-gated.
- **No match**: a member who may add items is offered the archived look-alike
  first ("Restore Ragi flour 1 kg (archived)"), then "Create “ragi” as a new
  item", which opens the item form with the name; the restored or created item
  lands on the bill. Others still read "Ask the owner to add it."
- **A changed rate says "For this bill only. The usual price stays ₹450.00."**
  Item defaults and bill prices stay separate.

## Defects found on the way

1. **The list could hide a name typed straight after a pick.** The box's
   close-on-blur timer (150 ms) outlived a return to it, so a quick second name
   was answered and then shut. Found as a flaky test; fixed by clearing the
   timer on focus; a regression fails without the fix.
2. **Importing the item form into the search cost every editor route the whole
   items catalogue** (`i18n:check` refused it). The create path is its own
   `dynamic()` module, `ItemQuickCreate`.
3. **Scanner into Qty** (above) — a design defect of the morning's piece.

## Verification

- Frontend: 410 suites, **4,580 tests** pass; changed-file lint, type-check,
  `i18n:split`/`i18n:check` (6,626 keys), production build, bundle (after the
  raise below) and contrast (174 pairings) pass. Two runs of the full suite each
  had one timing failure in a different search test before fix 1; after it,
  four parallel runs of the sales/inventory folders and the full suite passed.
- Backend: `apps/inventory/tests/test_items_api.py` 33 passed (staff now get
  `gst_percent` and still no `purchase_price`).
- Live local QA (`e2e/revamp-editor-compose.mjs`): **80 frames**, English at
  390/320/1024/1280 light and dark plus Hindi at 320/1280, zero page overflow,
  zero cut text, zero low-contrast labels. Flows at 1280: unsynced bill offered
  back and restored; "UPI or other" opens the sheet; **a real Quick Sale issued
  with one tap on "Paid cash"**.
- Bundle: sales editors +1.2 KB route/first load (five features), purchase
  editors +0.0 (rounding); 21 exceeded scalars raised to measured + 0.3 with a
  note in `bundle-budgets.json`.
- Navigation perf: see `data/2026-10-20-counter-billing-nav.json` (run quietly
  after the frames; compared with the 18 Oct baseline from this container).

## Second step: hold a bill, add a customer from the search

- **Hold** (header, beside Save) keeps the bill as a draft and opens a blank
  one; the held bills sit above the editor as one quiet row, "On hold · 2",
  each chip "Quick Sale 12:53 ₹531.00" a link back into that bill. It reads the
  existing drafts (`listInvoices` tab=draft) and only restarts once the save has
  answered, so an unsaved bill is never thrown away. myBillBook's "Hold & create
  another", as the artifact's research appendix proposed.
- **"Add “Ramesh Electricals” as a new customer"** under the Saved customer
  search when nobody matches, for members with `parties.party.write`. It opens
  the existing contact form with the name (`PartyQuickCreate`, `dynamic()`) and
  puts the saved customer on the bill.
- The list API's rows now carry `updated_at` (additive), so held bills of the
  same amount are told apart by time.

Found by looking at it live, not by tests: four held bills wrapped into **three
rows of a 390 px phone** above the bill being written, and three held Quick
Sales of ₹531.00 were **indistinguishable**. Now one row that scrolls sideways,
each with its time. The harness itself had a defect: drafts created by a first
save (a POST, as Hold makes) were never collected for clean-up, so ten held
QA drafts piled up; it now reads the id from the POST body, and a re-run left
nothing behind.

Verification: 4,585 tests; type-check, lint, locales, build, bundle (sales
editors +0.6–0.7 KB, purchase editors +0.0–0.1, raised to measured + 0.3 with a
note), contrast; backend `test_draft_recovery.py` + `tests/contracts` 81 passed,
4 skipped. Live: 54 English and 30 Hindi frames with zero overflow, cut text or
low contrast, including the held row at 1280 and 390; Hold then a blank bill,
verified on the docked total.

## Not in this piece

Jump to line on 50+ lines, the expired-session return, the per-line
"₹450 usual price" caption (only the changed-rate note is shown, to keep phone
cards short), and the rescore in the artifact's table. Physical scanners,
phones and merchant timing are not proved by desktop Chromium.
