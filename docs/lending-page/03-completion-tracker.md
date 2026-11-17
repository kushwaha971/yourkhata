# Ledger (loans) page — completion tracker (17 Nov 2026)

Page: `/solutions/lending-collections`, built into the existing `SolutionsPage`
(no new route, no duplicate page). Status: **Done**, **Pending**, or
**Needs owner / outside** (cannot be finished in the repo).

| # | Brief item | Status | Evidence / note |
|---|---|---|---|
| 1 | Audit and feature inventory | Done | `01-audit-and-inventory.md` (F1–F17, limits, live-site check) |
| 2 | Wrong claims on live site fixed | Done | Home card: no "interest", no "Print a statement"; loans page: no "reports"; "Sign up" → "Start free" / mobile + WhatsApp code |
| 3 | Premium redesign of the page | Done (awaiting owner look) | Two-column hero with browser + phone frames, highlight chips, In short card, feature cards, video section, worked example, guides with sticky index, case studies, limits, opening questions, closing CTA |
| 4 | Step-by-step user guides, phone + desktop, real screenshots | Done | 7 guides; 28 images in `frontend/public/media/guides/ledger/`, taken from demo business Verma Finance by `e2e/demo/ledger-guide-shots.mjs` |
| 5 | Video tutorials (on the page) | Done | Silent 30 s walkthrough, phone and desktop cuts, `e2e/demo/ledger-tutorial.mjs`; WebM + MP4 + posters |
| 6 | Narrated video / YouTube upload and playlist | Needs owner | Needs the channel and a voice (Mac voice or recorded narrator). Scripts and recordings are ready to reuse |
| 7 | Case studies | Done, marked Illustrative | No real customer stories exist; none invented |
| 8 | Testimonials, ratings, user counts | Not done on purpose | None exist; inventing them is forbidden by the brief |
| 9 | SEO: title, description, H1/H2, alt text | Done | Title "Daily Collection & Loan Record App for Small Lenders"; every screenshot has a describing alt |
| 10 | Structured data | Done | WebPage, BreadcrumbList, FAQPage, 7 × HowTo, VideoObject |
| 11 | GEO: quotable answer, capabilities and limits | Done | "In short" block, FAQ, "What Ledger does not do" |
| 12 | Keywords and competitors | Done (no volumes) | `02-keywords-and-competitors.md`; no paid SEO tool |
| 13 | Hindi page | Pending | Site has one URL per page with language by cookie; needs a reviewed Hindi version |
| 14 | KPIs measured | Needs launch | Search Console and PostHog after deploy; no figures can be claimed now |
| 15 | Hero and module clips on the home page re-recorded | Pending | Demo seed fixed for Shop and Lending; Library demo seed must be rewritten for the rebuilt Library first |
| 16 | Tests | Done | 74 landing/solutions tests incl. "no claim the app lacks" and "every guide image exists" |
| 17 | Commit / push | Waiting for owner approval | Owner: nothing is committed before approval |

## Rebuild the media

```bash
# demo DB seeded (e2e/demo/README.md), API on :8000 or :8100 with console OTP
DEMO_FRONTEND=http://localhost:3005 DEMO_API_LOG=<log> node e2e/demo/ledger-guide-shots.mjs
DEMO_FRONTEND=http://localhost:3005 DEMO_API_LOG=<log> node e2e/demo/ledger-tutorial.mjs   # collects ₹150: fresh seed first
```
