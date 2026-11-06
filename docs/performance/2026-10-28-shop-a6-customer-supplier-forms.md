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

## The Shop's own old balance (owner, 28 Oct: "Udhaar is independent … use simple English")

- **Backend (no new dependency):**
  - `opening_book: shop` on create posts the opening in the Shop's book
    (`bucket=shop`). Without it, the opening still goes to the Udhaar book.
  - Migration `ledger 0010` keeps one Udhaar opening per contact, and allows
    one Shop opening per side: debit, still to collect; credit, still to pay.
  - The Shop's figures count posted Shop openings, and send `customer_opening`
    / `supplier_opening`.
  - **A defect closed in passing:** LED-03 corrections always moved the Udhaar
    book and wrote the undo in `main`. They now keep the original's book.
  - Settling a contact's two sides nets bills against bills, so the old balance
    is left out of the settle cap (it has no bill to settle against).
  - `test_shop_opening.py`: 6 tests. Five fail on the old code; the sixth
    guards the unchanged Udhaar path.
- **Words (no "owe"):**
  - the fields are "Old balance to collect (optional)" / "Old balance to pay
    (optional)", with the hint "Money from before you started using the app.";
  - the person page says "Started with ₹1,500.00 old balance";
  - a payment with no bill says "goes against their old balance", not
    "advance for the next bill";
  - the supplier subtitle is "No reminders: they are for customers who have to
    pay you".
- **Read back:**
  - an old balance of ₹1,500 shows ₹1,500 to collect in the Shop and ₹0 in
    the Udhaar book;
  - a ₹500 payment leaves ₹1,000;
  - a supplier's ₹900 is to pay.
- **Limit, listed:** an old balance is not a payment target. Money paid
  against it is held like an advance against the whole balance, so totals are
  always right. But if a later bill uses that advance, the person page cannot
  say which part of the balance is "old". Making the old balance a real target
  is a payments-engine change; it waits for the owner.

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
- **Unit:** 395 parties tests and 25 payment-sheet tests; type-check, lint,
  i18n, bundle (three +0.0–0.2 KB first loads raised with a note).
- **Backend:** `test_shop_opening.py` 6 pass, and the ledger, contacts and
  payments suites pass. The full suite has 5 failures, none in A6's files:
  - three architecture/export checks on the personal Udhaar files committed
    25 Oct (5094e1d40);
  - one from an empty `apps/.claude` tool folder, not in git;
  - the Dues 5,000-schedule timing test (73 s against 60 under load).
  They are listed for a fix of their own.

## Monkey (`e2e/monkey.mjs`, 250 steps)

- `/customers` and `/suppliers`, seeds 81, 82, 83, at 390 and 1280: **12 of 12 PASS**.
- After the old balance: `/customers`, `/suppliers` and `/payments`, seeds 91,
  92, 93, at 390 and 1280: **15 of 18 pass**, and one more after a harness fix.
  - **Payments 92 @1280, a harness defect, fixed.** It reported an
    "/auth/me + /auth/refresh request loop". The monkey had switched the app to
    Hindi and tapped "साइन आउट करें" (sign out), which its English-only skip
    list allowed. It then reloaded the sign-in page and tapped "कोड भेजें" (send
    code). The product makes one `/auth/me` and one `/auth/refresh` per load
    (measured: 2 calls untouched in 6 s, 8 for 4 reloads). The skip list now
    covers both languages and sending codes; a signed-out run now stops with
    that reason. Seed 92 passes.
  - **Customers 93 and Suppliers 93 @390: the A8 slow return, open.** About
    10 s on a "return" after Back/Forward, to `/parties/{id}`, `/lending` and
    `/library`. The same person page loads in 535 ms directly. This is seed 64's
    pattern, seen before A6 changed that page, and it goes to A8.
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
| Business 2 | 2 | Roles, the pick (one contact, both roles, data kept), credit days, the Shop's own old balance (Shop ₹1,500, Udhaar ₹0, a ₹500 payment leaves ₹1,000) and the no-reminder rule, all read back by id with a self-test |
| Design 1 | 1 | 24 views measured and looked at; the pick card reuses A3's box |
| Functional 1 | 1 | Double tap, pick, already-in-list, edit, tap outside |
| User 2 | 2 | Hand-driven pass in the browser (phone and desktop): add with an old balance, the list updating live (+₹2,750.00), pick on Suppliers, one contact read back, tap-outside keeps a typed search. Monkey 12/12, then 16/18 (one harness defect fixed; two A8 slow returns, outside A6, open) |
| Data 1 | 1 | The supplier-reminder default and the lost-search tap fixed and proved |
| Performance 1 | 1 | Bundle within budget (+0.1 KB routes, noted); open time as A5 |
| Honesty 1 | 1 | This report |
| Owner found nothing 1 | 0 | The owner's |
| **Total** | **9.0 / 10** | **Ready for the owner's check.** The last point is the owner's to give |

## Conflicts for the owner (listed, not chosen)

1. **"Owe" outside A6.** The Customers chip says "Owe you", the Suppliers chip
   "You owe", and the payment sheet's header "owes ₹1,500.00". These are older
   words, partly the design's (R-DEC-54), against your simple-words rule. A6
   did not change them; changing them belongs with A7 (lists) and the payment
   sheet.
2. **A first tap waits.** On a phone, the first "+" took 1–3 s to show the
   form while the machine was busy, the first download of its code. It goes to
   A8, together with the seed-64 slow return.
