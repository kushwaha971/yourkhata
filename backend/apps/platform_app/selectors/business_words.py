"""B2 / BP-22 #1–#2 — what a business calls its people, and which features it has.

The server decides and the session carries both, so no screen ever reads a
business type to choose a word or a menu row (R-DEC-51 #6/#8, R-DEC-65).

* ``features_of`` — the `shop.features.*` keys that are on (each a stored
  setting, else its kind's preset default), plus ``wholesale`` when
  `shop.wholesale` is on.
* ``words_of`` — message id → text in the person's language, ONLY for the ids
  whose word differs from the shared one: a medical store's "Distributors", a
  wholesaler's "Retailers" and "Companies". Owner-typed English labels are sent
  as typed (R-DEC-51 #6: English required, Hindi optional).
"""

from __future__ import annotations

from typing import Any

from apps.platform_app.services import presets

#: singular → Hindi singular, for "Add <one>".
_ONE_HI: dict[str, str] = {
    "Customer": "ग्राहक",
    "Supplier": "सप्लायर",
    "Distributor": "वितरक",
    "Retailer": "रिटेलर",
    "Company": "कंपनी",
    "Client": "क्लाइंट",
    "Vendor": "वेंडर",
}

#: singular → (English plural, Hindi plural). The shared pair is Customer /
#: Supplier, whose words the client already has, so it is never sent.
_KNOWN: dict[str, tuple[str, str]] = {
    "Customer": ("Customers", "ग्राहक"),
    "Supplier": ("Suppliers", "सप्लायर"),
    "Distributor": ("Distributors", "वितरक"),
    "Retailer": ("Retailers", "रिटेलर"),
    "Company": ("Companies", "कंपनियाँ"),
    "Client": ("Clients", "क्लाइंट"),
    "Vendor": ("Vendors", "वेंडर"),
}
_SHARED = ("Customer", "Supplier")

#: Design `rail()`: the kind under the business name ("Hardware · Shop").
_KIND: dict[str, tuple[str, str]] = {
    "kirana": ("Kirana", "किराना"),
    "medical": ("Medical", "मेडिकल"),
    "electronics": ("Mobile", "मोबाइल"),
    "garments": ("Clothes", "कपड़े"),
    "hardware": ("Hardware", "हार्डवेयर"),
    "auto_parts": ("Auto parts", "ऑटो पार्ट्स"),
    "wholesale": ("Wholesale", "थोक"),
    "food": ("Sweets", "मिठाई"),
    "jewellery": ("Jewellery", "ज्वेलरी"),
    "stationery": ("Stationery", "स्टेशनरी"),
    "agri": ("Agri inputs", "खेती का सामान"),
    "furniture": ("Furniture", "फर्नीचर"),
    "services": ("Services", "सेवाएँ"),
}

#: B3 — which of the design's kind pictures (`b-*` symbols) the kind uses.
_PICTURE: dict[str, str] = {
    "kirana": "kirana",
    "medical": "medical",
    "electronics": "mobile",
    "garments": "garments",
    "hardware": "hardware",
    "auto_parts": "auto",
    "wholesale": "wholesale",
    "food": "cafe",
    "jewellery": "jewel",
}

#: Every feature key the session may carry.
FEATURE_KEYS: tuple[str, ...] = (*presets.SIGNUP_FEATURES, "orders", "part_numbers", "godowns")


def _setting(tenant: Any, rows: dict[str, Any], key: str) -> Any:
    from apps.platform_app.settings_schema import SETTINGS

    if key in rows:
        return rows[key]
    spec = SETTINGS.get(key)
    return spec.default(tenant.business_type) if spec else None


def _rows(tenant: Any) -> dict[str, Any]:
    from apps.platform_app.models import TenantSetting

    return dict(
        TenantSetting.objects.filter(
            tenant=tenant, key__in=["shop.wholesale", "parties.labels"]
            + [f"shop.features.{k}" for k in FEATURE_KEYS]
        ).values_list("key", "value")
    )


def features_of(tenant: Any, rows: dict[str, Any] | None = None) -> list[str]:
    rows = _rows(tenant) if rows is None else rows
    on = [
        key
        for key in FEATURE_KEYS
        if bool((_setting(tenant, rows, f"shop.features.{key}") or {}).get("value"))
    ]
    if bool((_setting(tenant, rows, "shop.wholesale") or {}).get("value")):
        on.append("wholesale")
    return sorted(on)


def _plural(label: str, locale: str) -> str:
    known = _KNOWN.get(label)
    if known:
        return known[1] if locale == "hi" else known[0]
    return label if label.endswith("s") else f"{label}s"


def words_of(tenant: Any, locale: str = "en", rows: dict[str, Any] | None = None) -> dict[str, str]:
    rows = _rows(tenant) if rows is None else rows
    labels = _setting(tenant, rows, "parties.labels") or {}
    customer = (labels.get("customer") or "Customer").strip()
    supplier = (labels.get("supplier") or "Supplier").strip()
    # B3: "I also sell wholesale" switched in Settings after setup. Labels that
    # are still one of the two STARTING pairs (the kind's own, or the kind's
    # sold wholesale) follow the switch; words the owner typed are kept.
    wholesale = bool((_setting(tenant, rows, "shop.wholesale") or {}).get("value"))
    plain = presets.preset_for(tenant.business_type).party_labels
    bulk = presets.combined(tenant.business_type, wholesale=True).party_labels
    if (customer, supplier) in (plain, bulk):
        customer, supplier = bulk if wholesale else plain
    words: dict[str, str] = {}
    kind = _KIND.get(tenant.business_type)
    if kind:
        words["business.kind"] = kind[1] if locale == "hi" else kind[0]
    hi = locale == "hi"

    def add(one: str) -> str:
        return f"{_ONE_HI.get(one, one)} जोड़ें" if hi else f"Add {one.lower()}"

    if customer != _SHARED[0]:
        many = _plural(customer, locale)
        words["nav.parties"] = many
        words["nav.tab.parties"] = many
        # The Shop's people list (partyBooks catalogue).
        words["parties.list.customer.title"] = many
        words["parties.list.customer.add"] = add(customer)
    if supplier != _SHARED[1]:
        many = _plural(supplier, locale)
        one = _ONE_HI.get(supplier, supplier) if hi else supplier
        words["nav.suppliers"] = many
        words["parties.list.supplier.title"] = many
        words["parties.list.supplier.add"] = add(supplier)
        words["parties.list.supplier.column.name"] = one
        words["parties.list.supplier.searchLabel"] = (
            f"{many} खोजें" if hi else f"Search {many.lower()}"
        )
        words["parties.list.supplier.empty.title"] = (
            f"अभी कोई {one} नहीं" if hi else f"No {many.lower()} yet"
        )
    if "nav.parties" in words or "nav.suppliers" in words:
        joiner = " और " if locale == "hi" else " & "
        left = words.get("nav.parties") or _plural(customer, locale)
        right = words.get("nav.suppliers") or _plural(supplier, locale)
        words["nav.section.parties"] = (
            f"{left}{joiner}{right}" if locale == "hi" else f"{left}{joiner}{right.lower()}"
        )
    return words


#: The languages the app is drawn in. The screen's language is the person's
#: switch (a cookie), which can differ from the account's saved locale, so the
#: session carries both and the client shows the one on screen.
LOCALES: tuple[str, ...] = ("en", "hi")


def business_block(tenant: Any) -> dict[str, Any]:
    """The session's `active_tenant.features` and `.words` (per language), one query."""
    rows = _rows(tenant)
    return {
        # B3: the design draws the kind as a chip with its picture; Other's
        # kinds and the older broad types use the "other" picture.
        "kind_picture": _PICTURE.get(tenant.business_type, "other"),
        "features": features_of(tenant, rows),
        "words": {locale: words_of(tenant, locale, rows) for locale in LOCALES},
    }
