"""G2d — a jeweller's PAN on a bill of ₹2 lakh or more (design G2, `dJewelBill`).

A sale of jewellery of ₹2 lakh or more needs the buyer's PAN (Income Tax
Rule 114B). The bill keeps it in `meta.pan`; a saved customer with a GSTIN
already carries it (characters 3–12), so it is filled from there. For a
business with the `jewellery` feature only (BP-22).

How a bill is paid is the business's own choice (owner, 2 Nov 2026): no cash
limit is applied anywhere, so the design's s.269ST check was taken back out.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from apps.common.exceptions import ValidationFailed

#: Rule 114B starts at ₹2,00,000.
LIMIT = Decimal("200000.00")


def _jeweller(tenant: Any) -> bool:
    from apps.platform_app.selectors.business_words import features_of

    return "jewellery" in features_of(tenant)


def check_jewel_limits(*, tenant: Any, document: Any, party: Any) -> None:
    """Refuse the issue without a PAN before anything is written; fill one the GSTIN carries."""
    if not _jeweller(tenant):
        return
    errors: dict[str, list[str]] = {}
    if document.grand_total >= LIMIT and not (document.meta or {}).get("pan"):
        from apps.tax.validators import is_valid_gstin, pan_from_gstin

        gstin = getattr(party, "gstin", None) if party is not None else None
        if gstin and is_valid_gstin(gstin):
            document.meta = {**(document.meta or {}), "pan": pan_from_gstin(gstin)}
            type(document).objects.filter(pk=document.pk).update(meta=document.meta)
        else:
            errors["pan"] = ["PAN is needed because the bill is ₹2 lakh or more."]
    if errors:
        raise ValidationFailed(errors, "Check the PAN.")
