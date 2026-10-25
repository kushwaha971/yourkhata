# Udhaar book entry point · People · `/khata`

| Field | |
|---|---|
| Purpose | A standalone khata like a paper book: who owes me, whom I owe, and add an entry in two taps. |
| Who and when | Any shopkeeper or person keeping personal credit; often opened just to add one entry and close. |
| Phone layout | R-DEC-36/37/39 supersede the old mock: no page title, one search and Filters button; two separate To get / To give figures; no chip strip. Joined compact rows show avatar and full wrapping name on the same line as the directional amount. The list scrolls and appends; tapping a person opens their khata history. One floating Add person button sits above the bottom navigation. |
| Desktop layout | Sidebar, concise two-direction summary, fill-height table with Person and Balance; only rows scroll while pagination stays visible. A row opens the existing person page. |
| What matters most | current direction and amount → find a person → their entry history and reminder. |
| Components | existing `PartyListPageContent` (book `main`), `UbViewportPageShell`, `UbDataGrid` register, `UbAmount`, shared `PartyFormDrawer` quick variant, and existing person-page reminder. |
| Main / other | open a person (→ docked You gave / You got) / add person, remind, filter. |
| Wording | R-DEC-37: Gave money / Got money for entry actions; To get / To give for balances. Each amount carries direction in words, not only colour. Hindi: पैसे दिए / पैसे मिले; मिलने हैं / देने हैं. |
| States | **First use**: "Write your first udhaar" with one button "+ Add person" and a one-line example. **Search no match**: "No one called 'ramesh' · + Add Ramesh". **Loading**: list skeleton (warm-up already starts this request, `AppRouteWarmup`). **Error**: list-level retry. **Offline**: cached list readable (service worker caches `/parties`); adding an entry says it needs a connection unless the offline queue covers it. |
| Accessibility | each row reads the full name and directional balance; the avatar is decorative. Filter choices have clear radio labels and one visible selected state. |
| Must keep working | `?book` handling (anything but `shop` reads Udhaar), URL filters (`usePartyListUrl`), tags filter. The shared warm-up must not paint Shop money during an app switch; `/khata` fetches after its book scope settles. |
| Fewer taps | person page opens with the docked You gave / You got pair; amount field focused with numeric keypad (the `autoFocus` dialog fix already in). |

Tracking 25 Oct 2026: R-DEC-35/36/37 approved the simple list, plain wording and quick Add flow; BP-20 approved the server Due read filter. Build in progress at `/khata`; focused party/ledger tests pass, full browser/perf/score and push pending in `docs/performance/2026-10-25-udhaar-people.md`. Existing tenant-main-book ownership and shared customer/supplier role model remain known backend gaps; this screen does not certify independent per-user Udhaar or Shop role isolation.
