# YourKhata revamp — master plan

**What this is**: the living plan for redesigning the whole app (Shop, Udhaar book, Library, Lending, and everything around them) and fixing slow, silent taps in the installed app. Implementation requires the owner’s recorded phase approval (R-DEC-01). Phase 4 is complete; Phase 5 Shop/Udhaar screens and BP-09 are approved (R-DEC-10/12).

**Start here if you are continuing this work** (any AI tool or person): Phase 4 is built; the next session's task and method are in [START-NEXT-SESSION-PROMPT.txt](START-NEXT-SESSION-PROMPT.txt). The general rules are in [AGENT_START_PROMPT.md](AGENT_START_PROMPT.md). In short, read this page, then [12-decision-log.md](12-decision-log.md) for what is decided and open, then [02-preserve-and-contracts.md](02-preserve-and-contracts.md) before touching anything in Library or Lending.

Last updated: 19 Oct 2026, on `dev`.

## Documents

| # | Document | What it holds | Status |
|---|---|---|---|
| 01 | [Audit and inventory](01-audit-and-inventory.md) | every route, nav, notifications, PWA, feedback, measured performance, problems A-01…A-15 | done (first pass) |
| 02 | [Preserve and contracts](02-preserve-and-contracts.md) | Library and Lending frozen endpoints and rules with file:line; Shop/Udhaar behaviours to keep; how we prove nothing changed | binding |
| 03 | [Goals and principles](03-goals-and-principles.md) | measurable goals G1–G7, ten principles, visual direction | draft for approval |
| 04 | [Navigation strategy](04-navigation-strategy.md) | business → app → section model, phone App button (N-1, approved), desktop sidebar, back, notifications, start screen, You page | proposed |
| 05 | [Feedback and performance](05-feedback-and-performance.md) | causes H1–H8 with how to prove each, feedback rules, duplicate protection, targets, benchmark method, fix list | hypotheses until Phase 1 |
| 06 | [Shared components and architecture](06-shared-components-and-architecture.md) | reuse map of 92 design-system parts, the few new pieces, duplication to remove | proposed |
| 07 | [Screen specs](07-screens/README.md) | template; specs for sign-in, onboarding, shell, notifications, four module entry points | waves 1–3 specified; Customers piece implemented |
| 08 | [Backend change proposals](08-backend-change-proposals.md) | proposals with risk, compatibility, tests, rollback | BP-09/BP-11/BP-12/BP-13 approved; other proposals retain individual status |
| 09 | [Design review](09-design-review.md) | weighted rubric, round 1 (failed) and round 2 (passes provisionally), what each score still needs | whole-module specifications reviewed provisionally |
| 10 | [Roadmap](10-roadmap.md) | phases 1–8 with deliverables, risks and done-when | plan |
| 11 | [QA and regression](11-qa-and-regression.md) | existing gates, added checks, rollout exit criteria | plan |
| 12 | [Decisions and progress](12-decision-log.md) | every decision and activity | living |
| — | [AGENT_START_PROMPT.md](AGENT_START_PROMPT.md) | the prompt to give any coding agent (Codex, Cursor, Claude Code, others) to continue this work the same way | current |
| — | [design/counter-mode.html](design/counter-mode.html) | the visual reference page (open in a browser) | current |
| — | [Imports/exports access evidence](../performance/2026-10-19-access-audit-imports-exports.md) | party import book grant, export book re-check, stored-file route scope, full-run results and open questions | access audit in progress; Home not started |
| — | [Independent review and access follow-up](../performance/2026-10-19-claude-review-access-followup.md) | review of seven Claude commits; legacy/cost/source exports, aging aliases/private fields and disabled-app history corrections | BP-14; next Shop Home |
| — | [Request-context correction evidence](../performance/2026-10-19-bp13-request-context.md) | stale actor/business responses and retry/write intent, real browser refusal/reload, gates and remaining audit limits | BP-13 checkpoint; handoff before Home (R-DEC-19) |
| — | [Access-context correction evidence](../performance/2026-10-19-bp12-context-isolation.md) | Shop-only staff searches, source caches, module/recipient notifications, regression/visual evidence and explicit access audit boundaries | scoped corrections delivered; actor-response correction in BP-13 |
| — | [Suppliers implementation evidence](../performance/2026-10-19-p5-suppliers.md) | shared Counter Mode register, supplier payment journey, multi-party products, backend/frontend checks and delivery evidence | Supplier piece verified; whole Shop ongoing |
| — | [Customers implementation evidence](../performance/2026-10-18-p5-customers.md) | screenshots, 108 browser cases, regression gates, measured performance/bundle cost, provisional score and remaining gaps | Customers piece verified; whole revamp ongoing |
| — | [BP-11 authorization evidence](../performance/2026-10-19-bp11-book-authorization.md) | shared-book API guards, explicit-empty grant migration, isolation regressions and rollout limits | implemented/verified under R-DEC-15; migration required before API startup |
| — | [Shop person implementation evidence](../performance/2026-10-18-p5-shop-person.md) | role-specific product decisions, reused components, browser/regression gates, costs and statement gap | person piece corrected under R-DEC-14; BP-11 implemented; see authorization evidence and deployment migration; Suppliers list next |

## Where this sits among older plans

This folder extends, and does not replace: `docs/mobile-redesign/` (bottom nav and mobile patterns, mostly built), `docs/platform/14` (app switcher), `docs/DESIGN-SYSTEM.md` (theme and rules), `docs/shop-ims-readiness/` (Shop programme, TV gaps). Where they disagree, 01 §8 lists it and 12 records the decision.

## The short version

1. **The slow-tap problem is probably silence first, slowness second.** There are no route loading boundaries and most navigations happen in click handlers, so a tap shows nothing until the next page arrives (H1, H2). Phase 1 measures this before anything is changed.
2. **Phones get an App button** in the bottom bar's fifth slot: one sheet with your apps, the rest of the menu and your account. Desktop keeps switching in the sidebar, as an app tree. Approved by the owner (N-1).
3. **Notifications** become a popover on desktop and a page on phones, with the same backend.
4. **Library and Lending change only how they look.** Their endpoints and rules are listed in 02 and checked by contract snapshots and figure parity before release.
5. **The foundation design scores 8.74 provisionally**; whole-module scores wait until each module's screens are specified, and every score lists what still has to be measured or tested before it counts.
