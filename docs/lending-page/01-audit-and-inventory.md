# Lending page — audit and feature inventory (17 Nov 2026)

Source of truth: the running code on `shop/a2` (`backend/apps/lending/`,
`frontend/app/(app)/lending/`, `features/lending/`). Nothing below is taken
from marketing copy.

## 1. What exists today

- **Public page:** `/solutions/lending-collections`, rendered by
  `features/landing/components/SolutionsPage.tsx` from one entry in
  `config/solutions.ts`.
  - It has a title, description and audience, one problem line, 4 feature
    bullets, 3 steps and 2 FAQs.
  - It carries WebPage, BreadcrumbList and FAQPage JSON-LD.
  - There are no screenshots, no video and no mobile/desktop preview, and it
    has a single CTA (Sign in).
- **No Lending guides, case studies or videos exist.** `e2e/demo/` is the
  general product film. It is not a Lending tutorial.

### Copy on the current page that does not match the app

| Current copy | Fact | Action |
|---|---|---|
| "Review lending reports" | There is no Lending reports screen. The Today screen shows book figures (`book_figures`). | Say "see the day's figures on Today". |
| "Record each loan and its agreed repayment details" | True, but it misses the main point: the app **builds the whole schedule** and shows what you will collect before you save. | Lead with this. |
| Missing | Not-paid visits with a promise date, WhatsApp reminder texts, UPI ID on messages, import from a paper register, removing a wrong collection with a reason, write-off. | Add, each with a guide. |

## 2. Feature inventory (implemented)

| # | Feature | Screen | Rules (from code) |
|---|---|---|---|
| F1 | **Today's round** | `/lending` | Every running loan due that day, filtered by route. Each stop is *Late*, *Due today*, *Collected* or *Not paid*. Shows the book's figures for the day. |
| F2 | **Routes (lines/areas)** | `/lending/routes` | Named routes that can be switched on or off. A borrower has a home route, and a loan takes it unless one is chosen. |
| F3 | **Borrowers** | `/lending/borrowers`, `/borrowers/[id]` | Name (required), 10-digit mobile, work, route, note. Can be switched on or off. |
| F4 | **New loan with schedule preview** | `/lending/loans/new` | Amount lent, charges (must be less than lent), daily/weekly/monthly, 1–400 collections, amount each, start date (default tomorrow), skip Sundays (daily only). Refused if count × each < lent. The preview shows *to collect*, *in hand* (lent − charges), *earns* (to collect − lent + charges), the last day and every due date. Loans are numbered L-0001 onward. |
| F5 | **Schedule dates** | (engine `book.py`) | Daily can skip Sundays. Weekly keeps the weekday. A monthly loan on the 31st lands on the 30th or 28th, then returns to the 31st. |
| F6 | **Collect money** | Collect sheet | Cash or UPI, dated no earlier than the loan's start. Refused above what is left ("Only ₹X is left on L-…"). Collecting exactly what is left closes the loan as *Paid in full*. Money pays the oldest dues first. |
| F7 | **Partial payment** | Collect sheet | Any amount up to what is left. Whatever is unpaid stays *Late*. |
| F8 | **Not paid / visit** | Not-paid sheet, or collecting ₹0 | Recorded for today only, with a reason and an optional promise date (today or later). Collecting later the same day clears it. |
| F9 | **Remove a wrong collection** | Loan page | A reason is required. The original row is kept and marked removed (never deleted). If that money had closed the loan, the loan runs again. |
| F10 | **Close a loan** | Loan page | *Paid in full* is allowed only when nothing is left. *Written off* closes a loan that still has money owing. |
| F11 | **Reminders** | `/lending/messages` | Lists for Late, Due today and Due tomorrow, with counts. The text is signed with the lender's own name, in English or Hindi. **Nothing is sent automatically:** WhatsApp opens with the text and the lender presses send. Each opened message is logged. |
| F12 | **Receipts** | after collecting | Receipt text: amount, mode, date, what is left, and the late line. |
| F13 | **Settings** | `/lending/settings` | "Sign as" name, and a UPI ID added to the messages. |
| F14 | **Import running loans** | Import | Columns: name, mobile, work, route, lent, frequency, count, each, given_on, collected. "Collected so far" is entered as one past collection, never as today's cash. |
| F15 | **Roles** | — | `lending.loan.read`, `lending.collection.create`, `lending.loan.create` and `lending.settings.manage`. Owner and collector see every route; there is no per-collector slice yet. |
| F16 | **Separate book** | — | Lending money is its own ledger. It is never mixed with the Shop or the Money book (DEC-019). |
| F17 | **Languages / devices** | — | English and Hindi. Phone first, also on desktop. |

### Limits to state plainly on the page (GEO: capabilities *and* limits)

- No interest-rate calculator. Earnings are the amount collected minus the
  amount lent plus charges.
- No automatic SMS or WhatsApp sending.
- No credit checks or loan approval, and YourKhata provides no credit.
- No per-collector route restriction yet.
- No Lending reports screen beyond the Today figures.

## 3. Who it is for (from the app's own model)

Small daily, weekly and monthly collection lenders who keep a route or line
register (daily-collection or "finance" businesses in towns and villages), and
any business that lends money on a fixed collection schedule. Lending is one
app among the business's apps, chosen at sign-up (DEC-016).

## 4. Things this brief asks for that need the owner or outside work

| Item | Why it cannot simply be "done" here |
|---|---|
| Verified customer stories and testimonials | None exist. Case studies will be marked **illustrative**. |
| YouTube upload, playlist, professional voice-over | Needs the owner's channel and approval to publish. I can produce the scripts, screen recordings and captions, and a narrated cut with the existing demo pipeline. |
| Keyword volumes and rankings | No paid SEO tool. Research uses public search results, and the KPIs are measured after launch (Search Console). |
| SEO/GEO results | Cannot be claimed before launch. Only the implementation is verifiable. |

## 5. Live yourkhata.com checked against the app (17 Nov 2026)

On the live site the lending module is called **Ledger**, so the new page keeps
that name. Its look is matched: Plus Jakarta Sans (Mukta for Hindi), a white
ground, teal accents, marigold "Start free" buttons with a 14 px radius, and
40 px tall buttons.

### Home page, Ledger card

| Live text | Status | Change |
|---|---|---|
| "Record each loan with … **the interest** and the agreed schedule" | **Wrong.** There is no interest field; a loan has charges, a count and an amount each time. | "…the amount, any charges and the collection schedule". |
| "**Print a statement** of what was paid and what is still due" | **Wrong.** Lending has no print or statement. | Remove it, or build the statement first. |
| "See today's collection list: who is due, who has paid and who is late" | Correct | Keep. |
| "Note every collection against its loan, with a dated history" | Correct | Keep. Add part payments, not-paid visits and reminders. |
| "Three modules" | Out of date. The Money book is its own app (DEC-019). | Owner's call: list four, or keep three. |
| "Sign up", "the code **we text you**" | Conflicts with DEC-013: no screen says sign up, and the code comes on **WhatsApp**. | "Start with your mobile number and a code on WhatsApp". |

### `/solutions/lending-collections`

| Live text | Status |
|---|---|
| "Review lending reports" | **Wrong.** There is no reports screen; Today shows the day's figures. |
| No screenshots, video, examples or limits; one FAQ about loans | Thin page. Replaced by the new design. |
| "Create your account" CTA | Conflicts with DEC-013; becomes "Start free". |
