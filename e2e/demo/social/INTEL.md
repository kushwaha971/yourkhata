# INTEL: action list (owned by the analytics session)
Updated 18 Nov 2026. Evidence: `reports/2026-11-18-baseline.md`, `RESEARCH.md` (second pass).
Nothing here is done without the owner's yes.

| # | Priority | Action | Impact | Effort | Measured by |
|---|---|---|---|---|---|
| 1 | Critical | Add PostHog events `otp_verified`, `business_created`, `first_bill_issued` (code change, follows analyticsRules) | Makes the funnel visible at all | S (½ day) | Funnel insight exists and shows counts |
| 2 | Critical | UTM link in every post body; store first-touch UTM on the person | Tells us which post brings users | S | >80% of social sessions carry utm_campaign |
| 3 | Critical | Give this session Search Console access (owner signs in as kushwahaakash971 in the pane, or adds this account) | Unblocks all SEO work | XS (owner, 2 min) | Queries table readable |
| 4 | High | Limit the feedback survey to signed-in users after onboarding, once per person | Stops nagging visitors (490 shown, 2 answers) | XS | Response rate up; survey shown to <10% of visitors |
| 5 | High | Point posts to /solutions guide pages; check each has a "Start free" button to /login | Guide pages already draw 16 of 24 visitors | S | Guide → /login rate |
| 6 | High | Filter internal traffic in PostHog (owner's IPs/emails) | Honest numbers | XS | Internal-filter toggle on |
| 7 | High | Meta route: owner posts carousels from Meta Business Suite on the phone, or connects Claude in Chrome | Unblocks IG/FB | XS (owner) | IG/FB rows move to scheduled |
| 8 | Medium | Server redirect from /signup to /login | Removes rage clicks | XS | $rageclick on /signup = 0 |
| 9 | Medium | GA4 access, or decide PostHog is enough | One source of truth | XS | Decision recorded |
| 10 | Medium | SEO pages answering job questions ("how to send payment reminder on WhatsApp", "GST bill on mobile without app", "daily collection register"), each with a Short | Search + AI answers | M (per page) | GSC impressions per page after 4 weeks |
| 11 | Low | One unified dashboard (proposal below) | Saves weekly report time | S | Owner uses it weekly |
| 12 | Low | Hands-on audit of competitors' IG/YouTube (frequency, formats) | Better format choices | M | RESEARCH.md filled in |

## SEO/GEO → social pairs (to check against GSC once access is given)
- Payment reminder on WhatsApp → guide page + the 19 Nov "remind" post
- GST bill on a phone browser → feat-bill Short
- Closing the day, cash vs sales → close-day carousel
- Daily collection round → Ledger guide + Short
Internal links: every guide page links to 2 related guides and to /login. The home page links every guide.

## Dashboard proposal (build only after a yes)
A PostHog dashboard called "Marketing": daily visitors by source/utm_campaign; funnel (visit → /login → otp_verified → business_created → first bill); top pages; mobile/desktop split; survey stats. Social platform numbers would be entered weekly in the report, since PostHog can't read them.

## Report schedule proposal (set up only after a yes; times are configurable)
- Daily, 9:30 AM IST: yesterday's visitors, sign-ups, top post (5 lines)
- Weekly, Monday 10 AM: full funnel, per-post results, next-week calendar changes
- Monthly, 1st, 11 AM: channel trends, SEO queries, competitor changes
- Quarterly: strategy review and positioning check
