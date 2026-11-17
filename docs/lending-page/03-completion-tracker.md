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
| 15 | Hero and module clips on the home page re-recorded | Done | All 18 loops (hero, six Shop features, Library, Ledger; phone and desktop) re-recorded on 17 Nov from the redesigned Shop and the rebuilt Library and Lending; every step completed. Silent, captioned in English |
| 16 | Tests | Done | 74 landing/solutions tests incl. "no claim the app lacks" and "every guide image exists" |
| 17 | Commit / push | Done | Owner approved 17 Nov 2026; fb376ee on dev and shop/a2 |

| 18 | A guide page per shop kind | Done (awaiting owner look) | `/solutions/shop-<kind>` for the 12 sign-up kinds (`config/shopKinds.ts`): 10 guides each (Dashboard, bill, payment, customers, customer page, receive payment, items, stock card, purchase, reports), 240 screenshots from a GST-registered demo shop of that kind (`e2e/demo/seed-kinds.mjs`, `shop-kind-shots.mjs`); each kind's own words (Retailers/Companies, Distributors) and features |
| 19 | Hindi narrated film re-recorded | Pending | `demo-hi` still shows the old Shop; needs its steps re-run and a new voice track |

| 20 | Home page redesign, SEO/GEO-led | Done (awaiting owner look) | Owner's changes 17 Nov: business tiles moved to /solutions, demo section removed (Watch the demo opens YouTube, or the guides with no id set), menu trimmed to Features · Guides · FAQ, footer uses broad groups (Solutions: Billing & inventory, Loans, Library, By type of business). Home is hero, six jobs, four reasons, FAQ, Start free: phone 18,574 → 6,326 px |
| 21 | Guide pages in the home page's shell | Done | Same header, footer, glow and width; Guides in the menu; header fits from 1024 px |
| 22 | Highlights and clips in guides | Done | Every guide shot rings the control its steps name; six guides per kind carry the matching clip; guides fold on a phone (Jewellery page 16,121 → 10,980 px) |

| 23 | Review fixes (PM, user, phone, UI/UX, SEO/GEO) | Done (awaiting owner look) | Title "YourKhata \| GST Billing, Stock & Dues App for Shops"; h1 is one clean sentence (rotating line outside it); hero copy in plain words; Popular links to six business pages; no language named anywhere; FAQ 11 questions, two answers corrected (no book renewal; any country's mobile); Privacy/Terms links removed from public pages |

## Rebuild the media

```bash
# demo DB seeded (e2e/demo/README.md), API on :8000 or :8100 with console OTP
DEMO_FRONTEND=http://localhost:3005 DEMO_API_LOG=<log> node e2e/demo/ledger-guide-shots.mjs
DEMO_FRONTEND=http://localhost:3005 DEMO_API_LOG=<log> node e2e/demo/ledger-tutorial.mjs   # collects ₹150: fresh seed first
node e2e/demo/seed-kinds.mjs && node e2e/demo/shop-kind-shots.mjs   # the 12 shop kinds
```
