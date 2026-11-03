"""G2d — a jeweller's PAN on a bill of ₹2 lakh or more (design G2, `dJewelBill`).

The bill offers a PAN box from ₹2 lakh and keeps what is typed in `meta.pan`;
a saved customer with a GSTIN already carries it (characters 3–12), so it is
filled from there. It never stops a bill: the PAN and how a bill is paid are
the business's own responsibility (owner, 2 Nov 2026), so neither the design's
PAN requirement nor its cash limit is enforced.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

#: Where the bill starts offering the PAN box (Rule 114B's figure).
LIMIT = Decimal("200000.00")


def pan_limit(tenant: Any) -> Decimal:
    """The figure the owner set in Settings, ₹2 lakh until they do."""
    from apps.sales.services.settings import setting_field

    return Decimal(str(setting_field(tenant, "shop.jewel", "pan_limit", f"{LIMIT:.2f}")))


def fill_pan_from_gstin(*, tenant: Any, document: Any, party: Any) -> None:
    """A jeweller's big bill with no PAN typed takes the one its customer's GSTIN carries."""
    from apps.platform_app.selectors.business_words import features_of
    from apps.tax.validators import is_valid_gstin, pan_from_gstin

    if "jewellery" not in features_of(tenant):
        return
    if document.grand_total < pan_limit(tenant) or (document.meta or {}).get("pan"):
        return
    gstin = getattr(party, "gstin", None) if party is not None else None
    if gstin and is_valid_gstin(gstin):
        document.meta = {**(document.meta or {}), "pan": pan_from_gstin(gstin)}
        type(document).objects.filter(pk=document.pk).update(meta=document.meta)
