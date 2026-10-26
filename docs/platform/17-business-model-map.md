# 17 — The business model map: who, where, what they see, and who decides

Written 26 Oct 2026 on `dev` at ecd54b9c1, at the owner's request ("from
onboarding, switch to business, the hierarchy, which data shows to whom, how
settings work per module or business — each and everything"), before Part B
(business types) is built. Everything under **Today** was read in the code;
file references are given so each claim can be checked. Everything under
**Proposed** is BP-22 and waits for the owner's approval.

The owner's direction, 26 Oct: **the server decides, the client draws.** Every
rule about who may see or do what, which features a business has, and which
words it uses is answered once, on the server, and sent in the session. No
screen works it out for itself.

## 1. The hierarchy

```
Person (one account: email + password, one locale)
 └─ Membership — one per business the person owns or works in
     │   role for the business (owner · admin · staff · accountant · module role)
     │   permissions_override {allow, deny}
     └─ App grants — one per app the person may open, each with its own role
         (owner: every app, no grant needed)

Business (tenant) — own GSTIN, data, staff, plan, settings, business type
 ├─ Plan / entitlement → which capabilities may be used at all
 ├─ enabled_modules    → which the owner has switched on (∩ plan ∩ partner)
 ├─ Apps it runs       → Shop · Udhaar · Library · Lending (later Gym, Hotel)
 ├─ Settings           → per capability prefix (sales.*, inventory.*, parties.*…)
 └─ Business type      → a PRESET for Shop defaults, never a behaviour switch

Personal book — private to one person, outside every business (R-DEC-48)
```

| Level | Stored in | Decided by | Code |
|---|---|---|---|
| Person | `platform_user` | the person | `models/auth.py` |
| Membership | `platform_membership` (role, status, override, `last_app`, `last_used_at`) | owner/admin | `models/membership.py`, `services/memberships.py` |
| App grant | `platform_membership_app_grant` (app, role) | owner (admin for non-admin roles) | `apps_registry.py`, migration 0015/0019 |
| Business | `platform_tenant` | owner | `models/tenant` |
| Capability on/off | plan ∩ partner ∩ `enabled_modules` − unreleased | plan + owner | `services/entitlements.effective_modules` |
| App running | the app's anchor capability on | owner | `services/business_apps.set_app_running` |
| Setting | tenant settings, defaults from the business-type preset | owner/admin | `settings_schema.py`, `services/presets.py` |

## 2. The journey

### 2.1 Sign-up and onboarding — Today

1. Create account (`POST /auth/register`): a person with no business.
2. The server's `landing` says `no_business` → create a business.
3. Business setup wizard, per business, owner only, steps 1–4 (business
   type, GST, address…). Stored on `tenant.onboarding_step`. Only a
   wizard-made business stopped at 1–3 is "unfinished" (`is_own_draft`);
   step 0 never is (doc 14 §4.1).
4. The business type picks a **preset**: party labels, inventory on/off,
   favourite units, expense categories, due days (`presets.py`). It does not
   change behaviour; every value is an editable setting afterwards.
5. A new business starts with the Shop. Other apps are added from the
   switcher by the owner (doc 14 §6, decision 3).
6. App setup is a non-blocking checklist on each app's home
   (`register_app_setup`).

**Proposed (Part B, plan 13 F0):** "What do you sell?" picture tiles replace
the type dropdown, with "+ I also sell…" for a second type. The finer types
(kirana, medical, mobile, garments, hardware, café/bakery, jewellery) map to
presets **and** to a default feature set (§5). Old types stay valid.

### 2.2 Sign-in and landing — Today

The server's `resolve_landing` (`selectors/landing.py`) returns one answer:
`set_password` · `no_business` · `invitation` · `choose_business` ·
`business_setup` · `app` (with its path). It opens the business asked for,
else the one last used, else the default. The client has one executor
(`view-model/landing.ts`). This is already server-decided.

### 2.3 Switching business and app — Today

- One switcher outside the menu, grouped "Your businesses" / "Where you work".
- Switching business swaps everything: role, grants, permissions, menu, data
  and words. Owner rights in one business never apply in another (§6.1).
- The open app is remembered per person per business on the server
  (`last_app`), so phone and laptop agree.
- The owner adds or turns off an app; data stays. Others leave an app (their
  own grant).

## 3. Who sees which data — Today

| Rule | Where it is enforced |
|---|---|
| A business's data is visible only inside it; another business's id answers 404 | `TenantModel` / `TenantManager`, every query |
| A person sees only what their permissions allow; rows they may not use are absent, not disabled | `permissions_for` + DRF permission classes; the client hides by the session's `permissions` |
| With app grants, a person holds their business role's shared capabilities plus each grant's role **inside that app only** | `_scoped_by_app_grants`, BP-11 |
| A module role (e.g. a lending agent) never reaches outside its module, even through an override | `permissions_for`, A13 |
| `*.read_all` scopes: an agent sees their own borrowers, not every balance | module roles |
| Cost prices and profit need `reports.financial.read`; without it the server drops the fields | serializers |
| A capability switched off: nobody holds its codenames, its menu is gone, data kept | `permissions_for` (module gating last) |
| The personal Udhaar book belongs to the signed-in person only, never to a business or its staff | `/personal/` routes, R-DEC-48 |
| A suspended partner: reads work, writes answer 403 | `partner_suspended` |
| Support staff see a business only by consented, view-only impersonation | SEC-A |

Roles (`permissions_registry.ROLE_PERMISSIONS`): **owner** everything;
**admin** everything except tenant deletion, ownership and billing; **staff**
the counter's day-to-day work, with no void, no ledger correction, no cost or
profit (`reports.financial.read`) and no `platform.*`, and stock adjust off
unless granted per person; **accountant** every read and every export, no
writes at all; **module roles** registered by an app (lending agent, library
desk).

## 4. Settings — how each one works — Today

- Each setting key has a section and a capability prefix: `sales.*`,
  `inventory.*`, `ledger.*`, `parties.*`, `documents.*`, `locale.*`.
- A setting exists for a business only while its capability is on
  (`specs_for`): switching inventory off hides `inventory.*` and keeps values.
- Defaults come from the business type's preset; changing the type later does
  not re-apply them (canon §0.2).
- Apps register their own setting specs (`register_setting_spec`).
- Settings are per **business**. There are no per-app or per-person settings
  today, apart from the person's locale and the remembered app.

## 5. Features per business type — Proposed (BP-22, plan 13 F0)

| Piece | Rule |
|---|---|
| Feature keys | `shop.features.alt_units`, `.part_numbers`, `.godowns`, `.variants`, `.serials`, `.batches`, `.schedule_h`, `.eway_bill`, `.einvoice`, `.addons` |
| Default | from the business type(s) preset; **off for every existing business** |
| More than one type, one GSTIN | `shop.extra_types`; features = union of the presets |
| Per category | `inventory_category.features` — batch/expiry only on "Medicines" in a mixed shop |
| One check | `features.on(tenant, key, category=None)` = entitled ∧ switched on ∧ category allows. No code compares a business type or plan code |
| Offers already answered | `shop.offers.answered`, so a "No" is never asked again |

## 6. BP-22 — Server decides, client draws

**Problem.** The server already decides landing, apps, permissions and
modules, and sends them in the session. Three things are still decided — or
not decided at all — in the browser:

1. **Words.** The server keeps each business's words (`parties.labels`:
   Retailer/Company for distribution, Client/Vendor for services) and never
   sends them. Every screen says "Customer". They are stored in English only,
   so they cannot be shown in Hindi as they are.
2. **Features.** F0's feature set does not exist yet. Without one server
   answer, each new field would check a business type in the browser — the
   per-screen rule the owner wants to avoid.
3. **Menu.** Which rows show is filtered in the browser from static manifests
   by permission and module. A feature-dependent row (Godowns, Stock count)
   would add a third filter there.

**Proposal.**

| # | Server change | Client change |
|---|---|---|
| 1 | Session `active_tenant.words`: `{message_id: text}` resolved in the person's locale from `parties.labels` and, later, each type's preset words. Stored as message ids per preset with optional owner text; English-only free text is shown as typed. | `useAppWords().w(id)` already reads `tenant.words` first (added 26 Oct as an empty seam). No screen changes. |
| 2 | Session `active_tenant.features`: the resolved list from `features.on`. Serializers drop a field whose feature is off; writes ignore it (the cost-field pattern). | `useFeature(key, categoryId?)` reads that list. Every new field, column, row and report checks it. |
| 3 | Session `nav`: per app, the menu row keys this person may see (grant ∩ permission ∩ module ∩ feature). | Manifests keep icons, routes and layout ("what can exist"); `useNavigation` shows only the keys the server sent. |
| 4 | Every change that alters any of these (setting saved, app turned on, grant changed, business switched) returns the new session part. | The existing invalidation map refreshes the session. No per-screen fetch. |

**What stays on the client:** layout, routes, code-splitting, instant form
checks (the server's check stays authoritative), and the manifests'
icons and paths. The server says *whether*; the client decides *where on a
320 px phone*.

**Cost.** A few hundred bytes on the session. One more resolver call per
session build (cached per request, like entitlements).

**Tests.**
- Preset table: each business type → expected features and words.
- All-off parity: with every feature off, Shop screens are pixel-identical at
  390 and 1280, and the issue request makes the same number of queries.
- For each feature key: the server drops the field when off and ignores it on
  write.
- Words: a distributor's session sends "Retailer" in English and its Hindi
  word in Hindi; a kirana's sends nothing (generic words).
- Menu: a staff member without `purchases.bill.read` gets no Purchases keys;
  a feature-off row is absent; switching business swaps all of it.
- Architecture: no client file outside `useFeature`/`useAppWords`/`useNavigation`
  reads `business_type`.

**Order.** 1 (words) is small and unblocks every Shop fix's wording; 2 and 3
come with F0. Each ships on its own with its gates.

## 7. Decisions for the owner

These are the design page's E2 questions plus three this map raises.

1. Per business type: words only, or also re-ordering the menu?
2. The phone bottom bar's order.
3. Starter categories: create them, or offer them as ticks?
4. Which business type first?
5. Line details: under the row, or in a side drawer?
6. Should owner-typed words (a custom "Customer" label) be one language, or
   entered in both English and Hindi?
7. Can a business with two types (kirana + medical) have staff who see only
   one type's features, or are features always per business?
8. Should `nav` be sent by the server (BP-22 #3), or is server-sent
   permissions + features enough with the client filtering its manifests?
   Recommended: send it — one rule in one place.
