# B1 "Pick what you sell": competitor comparison

Checked 30 Oct 2026 from public primary pages (help guides, vendor docs, the vendor's own llms.txt). **No competitor app was installed or used hands-on**, so step counts below come from each vendor's own written guide. Where nothing primary was found, the cell says *unproven*. We do not claim anything better than that.

**The same task for every product:** a new merchant tells the app what they sell, and the app shows the features that kind of shop needs. The test case is a medical store that needs batch and expiry.

| Product | Asks what you sell? When? | Choices | What the choice changes | Change later? | Getting batch + expiry on | Source |
|---|---|---|---|---|---|---|
| **YourKhata B1** (as built to R-DEC-63/64/65) | Yes, at sign-up, one question with pictures | 10 kinds (Wholesale is one choice, with "Wholesale of what?") | Server preset switches on `shop.features.*` (batch/expiry for Medical), menu rows and words | Settings → Shop features (B3) | Already on after picking Medical: 0 extra steps | B1 report, R-DEC-63–65 |
| **Square POS** (global) | Suggests a "mode" at first login | 7 modes (Full service, Quick service, Bar, Retail, Bookings, Services, Standard) | "Set up your POS with features, settings, and tools designed for your industry" | "Add a new mode or change your mode at any time" (More → Settings) | n/a (not an Indian pharmacy product) | [Square community, 13 May 2025](https://community.squareup.com/t5/Product-Updates/Access-more-of-what-Square-has-to-offer-with-modes-in-Square/ba-p/790543) |
| **Vyapar** | *Unproven.* No primary page shows a business-type step at sign-up | — | — | — | Manual: Settings → ITEM → Additional Item Fields → tick Batch No., then edit each item and choose Batch Tracking. About 9 steps, Premium plan only | [Vyapar guide](https://vyaparapp.in/guides/how-to-add-item-batches-serial-numbers-in-vyapar) |
| **myBillBook** | No evidence of a prompt. Its docs say industry pages "describe use cases of the same myBillBook platform; they should not be interpreted as separate products" | Industry pages: retail, distributors, pharmacy, jewellery, restaurants and others | None documented. Batch/expiry is a general feature, "where applicable" | — | General inventory setting (path not in the public summary) | [mybillbook.in/llms.txt](https://mybillbook.in/llms.txt) |
| **BUSY** (desktop) | Marketing lists "20+ business sectors" | 21 industries | One platform you "configure around your workflow". Batch is enabled from the Inventory configuration | — | Inventory menu → enable batch-wise details (exact path not stated) | [busy.in/by-industry](https://busy.in/by-industry.md), [BUSY FAQ](https://busy.in/faqs/where-can-i-find-the-settings-to-enable-advanced-features-like-batch-numbering-in-busy-answerid-41844.md) |
| **Zoho Books** | "Industry" field in Organization Profile | Free text or list | Docs do not say it changes any feature | Yes (profile) | n/a | [Zoho Books help](https://zoho.com/au/books/help/settings/organization-profile.html) |
| **Khatabook, OkCredit** | *Unproven.* No primary source found on a category step | — | — | — | Ledger apps, no batch/expiry | — |

## Where B1 stands

**Better (proposed; tested only on our side).** For the Indian billing apps we could document, choosing a kind changes nothing, and features such as batch/expiry are found and switched on by hand. Vyapar's own guide takes about 9 steps and needs a paid plan. B1 turns the kind's features on at sign-up from one question, in plain words with pictures. This is an advantage on paper until someone runs a hands-on test against Vyapar or myBillBook.

**Equal.** Square already does the same idea: one choice that sets features, which you can change later. B1 is not new as a pattern. It is new among the Indian small-shop apps checked.

**Worse or at risk.**
1. Square *suggests* a mode, while we ask a question. That is one extra decision at sign-up.
2. Square lets one business *add* several modes. R-DEC-64 allows one kind per business, so a shop that is both medical and general store must pick one and switch features on in B3.
3. Changing kind later must be easy to find (B3), or a wrong pick at sign-up costs the merchant.

**Missing evidence (unproven, not "better").** No hands-on sign-up recordings exist yet for Vyapar, myBillBook, Khatabook or OkCredit. Recording each on a phone would settle the *unproven* cells.
