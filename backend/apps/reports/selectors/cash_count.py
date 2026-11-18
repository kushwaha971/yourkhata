"""BP-17 — reading the Shop's cash counts.

The history is the merchant's record of when the drawer was counted and how
it compared; `latest_count` is what Home shows beside "Cash by your records".
`moved_since` is how far the records have moved since that count — the
difference between today's figure and the count's own snapshot — so the screen
can say "₹1,200 has moved since" rather than present an old variance as if it
described the drawer now.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from apps.reports.models import CashCount


def counts_for(*, tenant: Any) -> Any:
    """Newest first, with who counted, for a list or the latest one."""
    return (
        CashCount.objects.filter(tenant=tenant)
        .select_related("created_by")
        .order_by("-created_at", "-id")
    )


def count_view(count: CashCount, *, expected_now: Decimal | None = None) -> dict[str, Any]:
    """The API's shape for one count. `expected_now` adds `moved_since`."""
    actor = count.created_by
    body: dict[str, Any] = {
        "id": str(count.id),
        "business_date": count.business_date.isoformat(),
        "counted_at": count.created_at.isoformat(),
        "counted_amount": str(count.counted_amount),
        "expected_amount": str(count.expected_amount),
        "variance": str(count.variance),
        "note": count.note,
        "counted_by": (
            {"id": str(actor.id), "name": actor.full_name or ""}
            if actor is not None
            else None
        ),
    }
    if expected_now is not None:
        body["moved_since"] = str(expected_now - count.expected_amount)
    return body


def latest_count(*, tenant: Any, expected_now: Decimal) -> dict[str, Any] | None:
    count = counts_for(tenant=tenant).first()
    return count_view(count, expected_now=expected_now) if count else None
