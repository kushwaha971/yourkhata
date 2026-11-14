# Reports hub · 24 Oct 2026 (09 §10.1, R-DEC-32, R-DEC-34)

Scope: `/reports` (`ReportsHubPageContent`) and its copy. The catalogue
(`constants/reportCatalogue.ts`), its permission and module gates and the
module-report registry are unchanged. The reports themselves are the next
pieces (§10.2–§10.7).

Who needs it: the owner on a Sunday and the accountant at month end, looking
for the screen that answers a question. What it saves them: they read the
question they have ("Who owes me, and since when?") instead of having to know
that its answer is called "Receivables aging".

## Spec-to-check map

| Requirement | Source | Check | Status |
|---|---|---|---|
| Groups Money · People · Stock · Sales and tax, in that order | 09 §10.1 | page test; harness at 390/320/1024/1280 EN/HI | passed |
| Each row: the question as title, the report's name as caption | 09 §10.1 | page test; harness reads the link's name | passed |
| Rows are links with the question and the name | 09 §10.1 Accessibility | link name "What happened today? · Day book" | passed |
| One list per group on a phone, two-column card grid on a desktop | 09 §10.1 | harness counts columns: 1 below 1024, 2 from 1024 | passed |
| Whole row is one target, 44 px or more | R-DEC-32 #3 | harness measures every row and taps the card's edge | passed |
| Only reports this role can open; none → "No reports for your role. Ask the owner." | 09 §10.1 States | page tests (catalogue gates unchanged) | passed |
| Every row opens a real screen | must keep | harness opens all ten | passed |
| Module reports only when registered AND listed by the server | 09 §10.1 | unchanged; no module registers a report today | kept |

## What changed

- Rows are titled by their question, with the report's name under it; the
  one-line descriptions they replace said the same thing in report words.
- Names a shopkeeper uses: "Who owes you" and "What you owe" (were
  "Receivables aging" / "Payables aging"), "Cash book", "Profit" (was
  "Profit and loss", which this report is not: it is profit on sales).
- Groups "People" and "Sales and tax", as the spec names them.
- Two columns on a desktop (were three, which put a group's last row alone).
- Its own empty state: "No reports for your role · Ask the owner."

## Deviations

1. The report screens' own titles are not renamed in this piece; they move
   with each report's piece (§10.2–§10.7).
2. The GST question says "this month" though the report also does quarters;
   the month is the common case.

## Performance

Not measured with an A/B: the page makes no request and only its copy and
grid columns changed; the route chunk is 62.1 KB gz (budget 72).

## Competitor comparison

Not done for this piece; unproven.

## Gates

| Gate | Result |
|---|---|
| `ReportPageShell.test.tsx` (holds the hub tests) | 8 passed (two new; the old link names fail on the new copy and vice versa) |
| type-check, feature lint | clean |
| `npm run i18n:split && npm run i18n:check` | pass |
| build + `npm run bundle:check` | pass |
| `node e2e/reports-hub.mjs` (live stack) | 52/52 |
