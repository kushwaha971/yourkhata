# Owner feedback

Every point the owner raises while testing, in one place, in the order it was
raised. Add each new point as the next row, and keep its status current when the
work moves. Priority: **P0** wrong money/data or blocked work, **P1** a daily
annoyance, **P2** polish. Status: Open, In progress, Fixed (with the commit),
Answered (a question, no change), Needs info.

| ID | Date | Area | Feedback (owner's point) | Priority | Status |
|---|---|---|---|---|---|
| FB-001 | 25 Oct 2026 | Shop · settle customer–supplier | Compare the settlement with KhataBook, Vyapar and other competitors and work the same way. | P1 | Fixed: the dialog names the bills it settles and Customers/Suppliers rows offer "Settle…" (851ddc6). Comparison in `docs/performance/2026-10-25-shop-settlement.md`. |
| FB-002 | 25 Oct 2026 | Shop · customer form and filter | Remove the Udhaar book's collection date from the Shop ("no user as of now"). | P2 | Fixed (851ddc6). |
| FB-003 | 25 Oct 2026 | Local data | After pushing, clear the whole database (local test database only). | P2 | Done: local `udhaarbook` dropped, migrated and seeded. |
| FB-004 | 25 Oct 2026 | Shop · add customer / supplier | Both forms are the same drawer and ask "I sell to them / I buy from them" although the list already says which. Keep only what each needs. | P1 | Fixed: role switches gone in the Shop; one "Also a supplier / customer" switch under More details; supplier form has no reminder or consent fields (59a1eb9). |
| FB-005 | 25 Oct 2026 | Whole app · buttons | The first tap on many buttons (e.g. Pay supplier on Home) blanks the whole page before the drawer opens. | P1 | Fixed: 32 lazily loaded drawers and panels had no loading spot of their own; a test now guards every new one (59a1eb9). |
| FB-006 | 25 Oct 2026 | Tables | The table header's grey is square inside the rounded border, and there is an extra line under the table. | P2 | Fixed in the shared table (59a1eb9). |
| FB-007 | 25 Oct 2026 | Registers · search | While searching, the count and amounts line just above the table disappears and the table jumps. Keep it in place with a loading shimmer; show zeros when there is nothing. | P1 | Fixed in the shared totals line and every register that uses it (bills, purchases, estimates/orders/challans/credit notes, payments, expenses). |
| FB-008 | 25 Oct 2026 | Shop · suppliers and items | Is a supplier linked to items and stock? | P2 | Answered: only through purchase bills (item page Purchases tab, last-rate note on a bill, low-stock last cost). Gaps, not built: no usual supplier on an item, no "items from this supplier" on the supplier page, no supplier × item report. |
| FB-009 | 25 Oct 2026 | Home · after login | After logging in, Home shows only the skeleton; a refresh shows the figures. | P0 | In progress. Not reproduced locally (fresh login, sign-out and in, slow network). Fixed one likely cause: the offline helper served an old saved page on any connection slower than 3 s. Needs the owner's steps and device if it recurs. |
| FB-010 | 25 Oct 2026 | Whole app · fresh data | A change made in one place does not show elsewhere until a refresh (e.g. bank/UPI added in Settings, then the customer's QR). Happens in many places and shows false information. Most critical. | P0 | In progress. Not reproduced locally for the QR example. Fixed so far: API answers are never kept by a browser or proxy (`no-store`), and the offline helper no longer serves old saved pages on a slow connection. Needs the owner's exact steps for the remaining cases. |
| FB-011 | 25 Oct 2026 | Header search (phone) | The header search's dropdown looks bad. | P2 | Open: waits for the full design review ("Design every Shop screen for review"). |
| FB-012 | 25 Oct 2026 | Accordions (forms, drawers) | Opening an accordion shows a second box inside with its own padding and margin; the header background does not fill, and the bottom corner's background colour is slightly off. | P2 | Open: waits for the design review. |
| FB-013 | 25 Oct 2026 | Sales · new bill · Saved customer box | The amount and other text in the Saved customer box are not aligned. | P2 | Open: waits for the design review. |
| FB-014 | 25 Oct 2026 | Sales · new bill · Search or scan item | The add-item form's layout in the Search or scan item section is poor for the user. | P1 | Open: waits for the design review. |
| FB-015 | 25 Oct 2026 | Drawers and forms | Vertical spacing between fields in drawers is uneven, not to our standard. | P2 | Open: waits for the design review. |
| FB-016 | 25 Oct 2026 | Design · all Shop screens | Before fixing the UI, make an updated design of every screen (desktop and phone) as an artifact to review like a real project, including the planned features for more business types; sidebar and wording should follow the business type, generic only where needed. Then implement from it and add it to the user guide per business type. | P1 | In progress in the thread "Design every Shop screen for review". |
