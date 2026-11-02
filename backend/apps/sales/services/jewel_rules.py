"""G2d — a jeweller's two legal limits on one bill (design G2, `dJewelBill`).

* PAN: a sale of jewellery of ₹2 lakh or more needs the buyer's PAN (Income
  Tax Rule 114B). The bill keeps it in `meta.pan`; a saved customer with a
  GSTIN already carries it (characters 3–12), so it is filled from there.
* Cash: no one may receive ₹2 lakh or more in cash for one transaction
  (s.269ST), so the bill refuses a cash part of ₹2 lakh or more and says to
  take the rest by UPI, card or bank.

Both apply to a business with the `jewellery` feature only, as the design
draws them (BP-22); the limits are the law's, not a setting.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from apps.common.exceptions import ValidationFailed

#: Rule 114B and s.269ST both start at ₹2,00,000.
LIMIT = Decimal("200000.00")


def _jeweller(tenant: Any) -> bool:
    from apps.platform_app.selectors.business_words import features_of

    return "jewellery" in features_of(tenant)


def check_jewel_limits(*, tenant: Any, document: Any, payment: dict | None, party: Any) -> None:
    """Refuse the issue before anything is written; fill a PAN the GSTIN carries."""
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
    cash = sum(
        (Decimal(str(line.get("amount") or 0)) for line in (payment or {}).get("mode_breakup") or [] if line.get("mode") == "cash"),
        Decimal("0"),
    )
    if cash >= LIMIT:
        errors["payment"] = ["Cash over ₹1,99,999 can't be taken on one bill. Take the rest by UPI, card or bank."]
    if errors:
        raise ValidationFailed(errors, "Check the PAN and the payment.")
