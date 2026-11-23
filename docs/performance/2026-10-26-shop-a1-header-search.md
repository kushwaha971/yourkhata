# A1 — Header search (FB-011), 26 Oct 2026

Design: `docs/revamp/design/shop-fixes-and-business-types.html` §A1
(`M.pSearch`, `M.dSearch`; `.sgh`, `.sgi`, `.pop`, `.sgfoot`). Base: `dev`
at b03714233.

## What a merchant gets

- **Phone:** the magnifier opens a full-screen search. Back is on the left,
  the field has focus and the keyboard is up. A one-line tip sits under the
  field. Results use the full width.
- **Desktop:** the field opens in place, with a 640 px grouped list under it
  and keyboard hints at the bottom (↑ ↓ move · Enter open · Esc close), plus
  the short tip.
- **Groups:** Start, People, Items and Bills.
  - Each row has an icon, one line of title and one line of detail, cut with
    "…" instead of wrapping, and the amount on the right.
  - "Nothing is saved until you press Save" is said once, in the Start
    heading, not on every row.
- **Start** offers the best match's actions: New bill for X, and Receive
  money from X when X owes. On desktop that line adds "N days late". When an
  amount is typed ("ramesh 500"), the first three people are offered.
- **Shorter hint:** "Search name, item or bill no." fits at 320 px.

Every action the old search had is kept, behind the same permission checks:
new bill for a customer, receive or pay a typed amount, open a customer or a
supplier, start a bill from an item, and open a sales or purchase bill.

## Spec to check

| Design (source) | Built | Verified by |
|---|---|---|
| Phone full screen, Back, field, keyboard up (§A1 2) | MLDialog full screen; the field takes focus on mount | measured: dialog width = viewport, top 0, input focused (all sizes) |
| Short hint, tip under the field (§A1 3) | "Search name, item or bill no." / tip line | screenshot at 320 EN and HI |
| Groups; one line of title and one of detail, "…" (§A1 4); `.sgi` 48 px, 8/14, gap 12; `.sgh` 11.5 px, 700, uppercase | `UbCommandSearch` | measured: every row ≥ 48 px, no title wraps |
| Amount on the right, neutral ink (`.sgi .m` ink-2) | `text-text-secondary` | design-vs-built sheet |
| Highlighted row `.sgi.hl`, teal wash | `bg-accent-quiet` (forced over the vendor's grey) | pixel: design 232,244,245 / built 230,242,243 |
| Desktop: 640 px list under the field, key hints (§A1 5) | in-place popover | measured: 640 px, 6 px below the field, hints present |
| Warning moved to the Start heading (§A1 6) | the heading | unit test |

### Deliberate differences from the drawing

- **No scan button in the phone header.** Scanning is Part C and is not
  built; the owner's rule is never to show unbuilt features. It arrives with
  Part C.
- **Focused field:** today's product focus style (an ink border), not the
  drawing's teal glow. The notes say to keep today's tokens.
- **Bill date:** dd/mm/yyyy, per the owner's standing rule for rows. The
  drawing shows "24 Oct".
- **Item "Rack —":** racks are Part D P1 and not built, so the field is
  omitted.

## Defects found by using it, not by tests

1. **Letters lost and no keyboard on a phone.** Seen in today's app as well:
   the panel chunk loaded on the tap, and "Loading…" was squeezed into the
   44 px header slot. In the first build, the magnifier kept focus under the
   full-screen search and the dialog then focused Back. Fixed in three parts:
   the panel is preloaded at idle, the fallback is a real field bound to the
   same query, and the field takes focus itself. The check types straight
   after the tap at every size.
2. **The highlight was grey, not the design's teal.** The vendor's selected
   style won. Found by sampling pixels against the design.
3. **Start flooded the list:** two rows for each matching customer, and the
   whole book twice over with nothing typed. Start is now the best match only,
   and only once something is typed. A unit test fails without the limit.
4. **Amounts were green or red;** the design draws them neutral.
5. **Bills had no paid state.** Added: Not paid, Part paid or Paid, from the
   amount the server says is still due.
6. **The accessible name and the old tests** were rewritten against the real
   component; the old ones mocked the combobox out.

## Data, not pixels — read back from the API

In every view, each shown People and Bills row is fetched again from the same
API the screen uses, and its figures are compared: amount owed (customer or
supplier), mobile, bill total, paid state. Items are compared on price and
stock. **34 rows per view, 10 views, 0 mismatches.**

The check can fail: with every expected figure skewed by ₹1
(`A1_SELFTEST=1`), it reports all 34 rows wrong.

Journeys read back from the API too:
- A person row opens that person (`/parties/<id>` from the API).
- New bill opens with the row's customer (`party` and `partyName`).
- Searching saves nothing: the invoice count is unchanged.

## Busy counter, renders, network

- **Double tap:** one search field. **Slow network** (1.5 s latency, 50 KB/s):
  the typed letters stay and a loading line shows. **Back and Esc** close the
  search and focus returns to the magnifier.
- **Requests:** 6 for the six letters of "sharma" across the three sources
  (debounced), not one per letter.
- **React commits** while typing six letters: 24–27, measured through the
  DevTools hook. That is a few per letter, against a threshold of 36.
- **Console errors and React warnings:** 0 in every view.

## Evidence

- `e2e/a1-search-look.mjs`: 390, 320 and 1280, light and dark, EN; 320 and
  1280 HI. Cases: closed, nothing typed, results, no match, slow network,
  after a double tap, and the new bill. 0 failures.
- `e2e/design-compare.mjs`: design mocks next to built screens, one pair per
  case.
- Unit: `CounterSearch.test.tsx` has 7 tests (the 4 old behaviours plus
  groups, Receive from the best match, and the Start limit). The shell test
  was updated for the new hint.
- Gates: type-check clean; changed-file eslint clean; jest 4879/4879; build
  OK; bundle:check OK after the note; contrast OK; i18n in step (7170 keys).

### Bundle

The open search is its own lazy chunk; checked, none of its code is in a
Library page's first load. Shared app is unchanged at 115.0 KB. A build of
b03714233 had no overruns. This build measures:
- the header chunk carrying `CounterSearch` up 0.3 KB: the preload, the field
  that keeps letters, and the outside-press close;
- Turbopack regrouping two app-layout chunks, about +0.4 KB, inferred from the
  regroup and not traced to one module.

133 limits use measured + 0.3 KB, dated in `bundle-budgets.json`.

## Business types: built in, not bolted on later

Words come through `useAppWords().w()`, which now has a third layer:
shared word → the app's word → the business's own word (`tenant.words`).
"Customer" and "Supplier" in this search come from there. Until BP-22 sends
the business's words, the generic ones show. See
`docs/platform/17-business-model-map.md`.

## Not verified

- Physical phones, a real on-screen keyboard and OS gestures.
- Bills with a purchase number are matched only for sales bills in the
  read-back; purchase rows are not compared.
- Speed timing on a production build was not measured, so no speed claim is
  made.

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---|---|---|---|
| Function (phone / desktop) | 8.5 / 8.5 | journeys and API read-back, 10 views | purchase rows not read back | medium-high |
| Busy use | 8.5 | double tap, slow network, typed-before-load, Back/Esc | no lost-reply or offline case | medium |
| UI/UX (phone / desktop) | 8.5 / 8.5 | design-vs-built per case, pixel colour, measured rows | scan button waits for Part C | medium |
| Performance | not scored | +0.3–0.8 KB first load, explained above | no timing run | — |
