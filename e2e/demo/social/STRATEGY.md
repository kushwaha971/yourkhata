# YourKhata social strategy (v1, 17 Nov 2026)

## Pricing message (owner, 18 Nov 2026)
YourKhata is free right now: no charges, no hidden charges, no card. Lead with it in
every post ("Free. No charges, no hidden charges, no card needed."). Don't promise
"free forever" or name any future price, because the price is undecided.

## Positioning
**Bills, stock and who owes you — in one place, on your phone.** A web app:
nothing to install, sign in with a mobile number and a 6-digit WhatsApp code,
free right now with no card. Bills carry the business's own name.

Only say what is built (source: landing `solutions.ts`, `shopKinds.ts`, `faq.ts`).
Never: profit reports, SMS, e-invoicing, offline desktop app, auto-sent
reminders, a price, a language, "small business", "sign up", a list of shop kinds.

## Problems we speak to (every business, no kinds named)
1. **Money stuck with customers** — dues across notebook and chats; awkward to ask.
   → Who owes you, bill by bill; Remind opens WhatsApp with the exact amount.
2. **Billing takes too long at a busy counter** → search item, qty, Issue; GST per line.
3. **Stock you think you have but don't** → stock moves with every bill and purchase; low items on Home.
4. **Supplier bills and what you owe them** → purchases with input GST, paid now or later.
5. **End of day: did the cash match?** → day book, cash book, GST summary for the accountant.
6. **Staff on the owner's login** → each person their own login and role.
Separate modules get their own occasional posts: Library (members, seats, fees,
books), Ledger (loans and daily collection rounds), Money Book (you gave / you got).

## Content pillars (weekly mix)
| Pillar | Share | Example |
|---|---|---|
| Problem → fix (one job in 3 taps) | 40% | "Remind who owes you" carousel |
| Real screens / how-to | 30% | Reel or Short from a guide clip |
| Trust (your name on bills, your data, no password) | 15% | Facebook post |
| Module spotlights (Library, Ledger, Money Book) | 15% | LinkedIn/YouTube |
No testimonials until real ones exist; worked examples are labelled Illustrative.

## Funnel
- **Awareness:** Reels, Shorts, carousels (IG, FB, YT). Metric: reach, 3-s views.
- **Consideration:** per-job guide pages `/solutions/...`, LinkedIn case posts, long-form YT. Metric: link clicks, guide page views (PostHog).
- **Conversion:** yourkhata.com → `/login`. Metric: first OTP verified with `utm_*` (PostHog).
- **Activation:** first bill issued within a day. Metric: PostHog event.
- **Retention:** weekly tips for existing users (WhatsApp channel later). Metric: 7/30-day return.

## UTM rule
`https://yourkhata.com/?utm_source=<instagram|facebook|linkedin|youtube|medium>&utm_medium=<social|reel|short|bio>&utm_campaign=<yyyy-mm-dd>-<topic>`
Every link in every post. (Check whether PostHog stores `utm_*` on the first
pageview before the first report; if not, that is a site change for approval.)

## Cadence (proposed)
Mon LinkedIn · Tue IG carousel · Wed FB + IG Reel · Thu YT Short · Sat IG Reel.
Weekly report every Monday from platform insights + PostHog; adjust times
after 3 weeks of data (current times are estimates).

## Quality bar: 9/10 (owner, 17 Nov 2026)
- **Lead with the moment, not the screen.** Slide 1 and the Reel's first seconds are a drawn scene of the problem; the app screen is proof, cropped to the part that matters so it reads on a phone.
- **Reels end on the solution steps**, never on a sales line. Voice is Hinglish (female); subtitles carry the same words in Roman letters for sound-off viewers.
- **Every post asks a question** (last slide, LinkedIn closing line) — comments and saves drive reach.
- **LinkedIn** = one problem statement per post, one idea per image.
- **Known cap:** the computer voice holds the Reels near 7/10; a recorded human voice is needed for 9.

## SEO / GEO rules for every post
1. Open with the question people search or ask an AI (`search` in the week file), then a one-sentence answer that names YourKhata and the exact steps — quotable as-is.
2. Repeat the same entity sentence (`ENTITY`) in every caption and description, so search and answer engines learn one consistent set of facts.
3. Alt text on every slide; YouTube gets a keyword title, the answer as the first description line, and the `.srt` subtitles (spoken words become searchable).
4. Every link carries UTMs and points to the page whose screens the post shows.
5. Hashtags: 5–6 specific ones, never a list of shop kinds.
