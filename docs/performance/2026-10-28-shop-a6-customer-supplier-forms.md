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

- **F1/F8:** title and footer "Add customer" / "Add supplier" (new `parties.form.shop.*` keys,
  EN and HI; the generic "Save customer" keys stay for the other books).
- **F2:** no subtitle on the customer form; "No reminders: they are for people who owe you" on the supplier form.
- **F3:** no role switches (already so since 25 Oct).
- **F4:** placeholders "Customer name" / "Supplier or company name" and "Mobile number"; **Credit days in
  the customer's top group** (it sets each bill's due date). Tags moved into More details.
- **F5:** one "More details", **open**, with the subtitle "Code, address, reminders" / "GSTIN, code, address".
- **F6:** customer: code → reminders → How they agreed → GSTIN, state, email, address → another number,
  note, tags → Also a supplier. Supplier: GSTIN → code → state, email, address → another number, note,
  tags → Also a customer. The kept fields are listed, not dropped (R-DEC-29).
- **F7 — a defect fixed:** the supplier form had no reminder switch, but its default was "on", so every
  supplier was saved `sms_opt_in: true`. `toWireBody` now sends neither reminder key for a contact who is
  not a customer (test fails before, passes after).

## Not built, waiting on the owner

1. **"They owe you now" / "You owe them now" (F4).** The server posts every opening balance to the Udhaar
   book (`bucket main`), and one opening is allowed per contact across books. Showing it on the Shop form
   would put Shop money in the Udhaar book (DEC-019). It needs a backend change: a Shop-book opening and a
   change to the one-opening-per-contact index. Not started without approval.
2. **Editing in the Shop.** Edit from a Shop person page opens the generic "Edit contact" (role
   switches, separate "GST and address"). Roles are kept on save (read back). The design has no edit mock,
   so the A6 edit form is not invented: should edit use the A6 form, with the role fixed by the list?

## Results (`e2e/a6-forms.mjs`)

- **Look:** 24 views (390, 320, 1280 × light/dark × EN/HI) × both forms: F1–F9, no cut text, no
  overflow; 0 failures, 0 console errors. Shots LOOKED at: 390 light EN customer, 390 dark HI supplier,
  320 customer, 1280 customer page.
- **Functional** (390 and 1280, read back by id): a customer is customer-only with `credit_days 7`; a
  double tap on Add makes one record; a supplier's request body has no `sms_opt_in` / `consent_source`;
  "Also a customer" saves both roles. `--skew` flips one expected role and the run fails (self-test).
- **Edit:** roles kept after saving a note (probe, read back).
- **Unit:** 1014 parties + design-system tests pass; type-check, lint, i18n check clean.

## Regression (P0 §10)

- `a5-measure` passes (its H19 check now compares label edges per container, since the open disclosure
  insets its fields as the design does); `a3-customer-box-look` 40 views and `a3-functional` pass.
- Bundle: three first loads over by 0.0–0.1 KB (rounding), raised with a note.

## Monkey

- `/customers` seed 61 @390, seed 63 @1280; `/suppliers` seed 62 @390: PASS.
- **`/suppliers` seed 64 @320: FAIL, reproducible.** On a "return" after Back/Forward the list took
  ~7.9 s to show, with `GET /parties/roles` still open and DOM-ready at 25 ms, and the slowest answered API
  call 140 ms. Not reproduced by a direct Back/Forward/goto probe. It is on the list page, which A6 does not
  touch; it is the A8 class (a page waiting with no time-out). Replay:
  `node e2e/monkey.mjs --path=/suppliers --seed=64 --steps=250 --width=320`. The monkey now names what
  kept a slow page busy and which requests were still open.

## Score sheet (P0 §8)

| Points | Earned | Evidence |
|---|---|---|
| Business 2 | 1 | Roles, credit days and the no-reminder rule read back; the opening balance (F4) is not built |
| Design 1 | 1 | F1–F9 in 24 views, looked at; order checked |
| Functional 1 | 1 | Double tap, also-role, edit keeps roles |
| User 2 | 1 | Monkey 3 of 4; the fourth fails (above, open); manual pass of the forms by probe and shots only |
| Data 1 | 1 | The supplier default defect fixed and proved; nothing half-saved |
| Performance 1 | 1 | Drawer open 385 ms (390) / 843 ms (1280), as A5; bundle within budget |
| Honesty 1 | 1 | This report |
| Owner found nothing 1 | 0 | The owner's |
| **Total** | **7.0 / 10** | **In test.** Waiting on the two decisions above and the seed-64 finding |
