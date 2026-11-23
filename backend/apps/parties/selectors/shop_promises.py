"""BP-16 — reading Shop promises, for the contact's page and for Home.

Both screens read this one source (R-DEC-26: "Home and person pages use the
same source"). Late is computed here, on the business's clock, never stored.
Home's rows carry the contact's CURRENT Shop balance for that role, read by
the same seam the Shop's lists use, so "promised ₹1,500 · owes ₹3,100" is
never a figure remembered from when the promise was made.
"""

from __future__ import annotations

import datetime as dt
from typing import Any

from apps.parties.constants import ShopPromiseState
from apps.parties.models import Party, ShopPromise

#: A contact's page shows the open promise and this many closed ones.
HISTORY_LIMIT = 20
#: Home's Follow-ups is a short list, most urgent first.
OPEN_LIMIT = 50


def _name(user: Any) -> str | None:
    if user is None:
        return None
    return getattr(user, "full_name", None) or getattr(user, "name", None) or None


def promise_view(promise: ShopPromise, *, today: dt.date) -> dict[str, Any]:
    is_open = promise.state == ShopPromiseState.OPEN
    days_late = (today - promise.promised_on).days if is_open else 0
    return {
        "id": str(promise.id),
        "party": {"id": str(promise.party_id), "name": promise.party.name},
        "role": promise.role,
        "promised_on": promise.promised_on.isoformat(),
        "amount": None if promise.amount is None else f"{promise.amount:.2f}",
        "note": promise.note,
        "state": promise.state,
        "days_late": max(days_late, 0) if is_open else None,
        "version": promise.version,
        "created_at": promise.created_at.isoformat(),
        "created_by": _name(promise.created_by),
        "closed_at": promise.closed_at.isoformat() if promise.closed_at else None,
        "closed_by": _name(promise.closed_by),
    }


def party_promises(*, tenant: Any, party_id: Any, role: str) -> list[ShopPromise]:
    """The open promise first, then the closed ones newest first."""
    rows = (
        ShopPromise.objects.filter(tenant=tenant, party_id=party_id, role=role)
        .select_related("party", "created_by", "closed_by")
        .order_by("-created_at", "-id")
    )
    open_rows = [row for row in rows.filter(state=ShopPromiseState.OPEN)[:1]]
    closed = list(rows.exclude(state=ShopPromiseState.OPEN)[:HISTORY_LIMIT])
    return open_rows + closed


def open_promises(*, tenant: Any, until: dt.date, roles: tuple[str, ...]) -> list[dict[str, Any]]:
    """Open promises due on or before `until`, oldest date first, with each
    contact's current Shop balance in that role and their mobile for Remind."""
    from apps.parties.selectors.shop import with_shop_facts

    rows = list(
        ShopPromise.objects.filter(
            tenant=tenant,
            state=ShopPromiseState.OPEN,
            promised_on__lte=until,
            role__in=roles,
        )
        .select_related("party", "created_by")
        .order_by("promised_on", "created_at", "id")[:OPEN_LIMIT]
    )
    if not rows:
        return []
    facts = {
        party.pk: party
        for party in with_shop_facts(
            Party.objects.for_tenant(tenant).filter(pk__in={row.party_id for row in rows}),
            tenant=tenant,
        )
    }
    return [{"promise": row, "party": facts.get(row.party_id)} for row in rows]
