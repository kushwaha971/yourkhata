# A6 — Separate customer and supplier forms

> **Status: IN TEST.** Approved by the owner on 25 Oct 2026 ("go": the
> backlog's items 1–4, FB-004) and merged into `dev` (72816dc5b, from
> 59a1eb9). The design page's "waiting for your OK" predates that approval.
> A6 is a verify-and-finish piece. Its backlog note: "phone-width check not
> finished".

Design: §A6 of `docs/revamp/design/shop-fixes-and-business-types.html`,
checked identical to the live page today. Mocks: `pAddSupplier` (phone sheet,
90 %) and `dAddCustomer` (desktop drawer). The spacing is A5's standard.

## Spec to check (from the mocks and "What changes")

| # | What | Customer form | Supplier form |
|---|---|---|---|
| F1 | Title | "Add customer", or the business's own word (B2) | "Add supplier" |
| F2 | Subtitle | — | "No reminders: they are for people who owe you" |
| F3 | No role switches at the top | no "I sell to them / I buy from them" | same |
| F4 | Top group | Name ("Customer name"), Mobile (+91), and "They owe you now" (₹, optional) BESIDE "Credit days" (7 days) in one row (`.row2`) | Name ("Supplier or company name"), Mobile, "You owe them now" (₹, optional) |
| F5 | More details: its subtitle, open | "Code, address, reminders" | "GSTIN, code, address" |
| F6 | More details: its fields | Your code for them · Send them reminders (switch, on) · How they agreed (select) · Also a supplier (switch) | GSTIN (optional) · Your code for them · Also a customer (switch) |
| F7 | Reminders and consent | on the customer form | NOT on the supplier form |
| F8 | Footer | Cancel · **Add customer** | Cancel · **Add supplier** |
| F9 | The "other role" switch | "Also a supplier": the saved party is a supplier too, shown in Suppliers | "Also a customer": the reverse |

## Edge cases to run (before changing anything)

- **Roles saved correctly:** a customer saved from the customer form, with
  "Also a supplier" off, is not in Suppliers; with it on, it is in both,
  read back from the API by its id. The same for suppliers.
- **The supplier form never sends reminder or consent fields,** checked in
  the request body.
- **Opening balance direction:** "They owe you" on a customer is a receivable;
  "You owe them" on a supplier is a payable, read back as the right book's
  balance (DEC-019: the Shop's), with a self-test.
- **Editing:** an existing customer's form shows the same fields and keeps the
  roles.
- **Phone width** (the unfinished check): 390, 320 and 1280, light and dark,
  EN and HI, using the A5 measurements.
- The A5 behaviour checks again: a double Save makes one record, a tap outside
  keeps the form, and no false red on an untouched name.

## What was built (28 Oct 2026, the Shop forms only; Udhaar and `/parties` unchanged)

Owner, 28 Oct (R-DEC-61), overriding the mock where they differ: no "Also a …"
switch and no role switches; the rare person already in the other list is
picked; a busy counter asks a name and a mobile only; a screen with no mock
is designed from the artifact's own references.

- **The counter path:** "Choose from phone contacts" (where the phone offers
  it), "Already your supplier? (optional)" / "Already your customer?
  (optional)", Name, Mobile number. Nothing else is open.
- **F1/F8:** "Add customer" / "Add supplier" in the title and on the button.
- **F2:** the supplier's subtitle "No reminders: they are for people who owe you".
- **F4:** placeholders "Customer name" / "Supplier or company name", "Mobile number".
- **F5:** one "More details" with the design's subtitle, **closed** (R-DEC-61).
- **F6, inside it:** customer: code, Credit days, reminders, How they agreed,
  GSTIN, state, email, address, another number, note, tags. Supplier: GSTIN,
  code, state, email, address, another number, note, tags.
- **F7, a defect fixed:** suppliers were saved opted in to reminders (a
  default of "on" behind a hidden switch). A supplier-only contact now sends no
  reminder keys.
- **F9 → the pick (R-DEC-61):** picking fills the form from that contact's saved
  record. The card is A3's saved-customer box: avatar, name, Change, "Your
  supplier · will be your customer too". Add then PATCHes that same contact,
  adding the role and keeping its note and tags. Picking someone already in this
  list says "Already your customer: nothing to add".
- **Edit in the Shop:** "Edit customer" / "Edit supplier", the same fields, no
  role switches, roles kept.
- **A defect found by A5's check:** typing a search and tapping outside closed
  the drawer, because the search is not a form value. A typed search or a
  picked contact now keeps the drawer.

## Not built, waiting on the owner

1. **"They owe you now" / "You owe them now".** Every opening balance posts to
   the Udhaar book (`bucket main`), and one is allowed per contact. On the Shop
   form it would put Shop money in the Udhaar book (DEC-019). This needs an
   approved backend change. It would sit in "More details" (R-DEC-61).

## Results

- **`e2e/a6-forms.mjs`:** 24 views (390, 320, 1280 × light/dark × EN/HI), both
  forms, 0 failures and 0 console errors. It checks:
  - the counter fields are exactly the pick, Name and Mobile;
  - "More details" starts closed, with its subtitle;
  - no role or also switch; the order inside; no cut text or overflow.
- **Functional, read back by id (390 and 1280):**
  - a customer with Credit days 7, and a double tap makes one record;
  - a supplier's body has no reminder keys;
  - picking that supplier on Add customer makes no POST, leaves one contact
    with both roles, and keeps the note;
  - Shop edit is "Edit customer", with no role switch, and keeps the roles;
  - `--skew` makes the run fail (self-test).
- **Phone contacts:** with the picker simulated as Android Chrome gives it, the
  button shows on both forms and fills Name and Mobile.
- **Looked at:** the counter view, the picked card at 390 and 1280, edit, Hindi
  dark supplier, and the phone-contacts fill.
- **Unit:** 394 parties tests (the pick, the closed details, no switches);
  type-check, lint, i18n, bundle.

## Monkey (`e2e/monkey.mjs`, 250 steps)

- `/customers` and `/suppliers`, seeds 81, 82, 83, at 390 and 1280: **12 of 12 PASS**.
- **Still open (not A6):** `/suppliers` seed 64 @320 reproduces a ~7.9 s slow
  "return" on the list after Back/Forward, with `GET /parties/roles` still
  open. It is the A8 class. Replay:
  `node e2e/monkey.mjs --path=/suppliers --seed=64 --steps=250 --width=320`.

## Regression (P0 §10)

- `a5-measure` PASS (after the tap-outside fix); `a3-customer-box-look` 40
  views and `a3-functional` PASS; `a4-money`, `a4-remove-undo` and
  `a4-functional` PASS.
- **`a4-edges` 11/11 at 390 and 1280, after a harness fix.** It had failed 4/11
  because it picked items by position. Other harnesses' items ("A5 item …",
  0 in stock) now sort first, and the product correctly refused "Not enough
  stock". The cases now pick priced, stocked, seeded items.

## Score sheet (P0 §8)

| Points | Earned | Evidence |
|---|---|---|
| Business 2 | 1 | Roles, the pick (one contact, data kept), credit days and the no-reminder rule are read back; the opening balance is not built |
| Design 1 | 1 | 24 views measured and looked at; the pick card reuses A3's box |
| Functional 1 | 1 | Double tap, pick, already-in-list, edit, tap outside |
| User 2 | 1 | Monkey 12/12 on A6's screens; no hand-driven browser pass yet |
| Data 1 | 1 | The supplier-reminder default and the lost-search tap fixed and proved |
| Performance 1 | 1 | Bundle within budget (+0.1 KB routes, noted); open time as A5 |
| Honesty 1 | 1 | This report |
| Owner found nothing 1 | 0 | The owner's |
| **Total** | **7.0 / 10** | **In test**: the opening-balance decision and a hand-driven pass remain |
