"""BP-08 — reads for Shop settlements: one contact's history, and who could be settled.

Both read the role balances through `parties.selectors.shop`, the seam the
Customers and Suppliers lists read, so the dialog and Home can never show a
figure the lists disagree with.
"""

from __future__ import annotations

from typing import Any

from django.db.models import DecimalField, F
from django.db.models.functions import Least

from apps.common.money import ZERO
from apps.payments.models import ShopSettlement

#: Home names a few people; the count says how many more there are.
CANDIDATE_LIMIT = 3


def settlement_view(settlement: ShopSettlement) -> dict:
    def payment(row: Any) -> dict:
        return {"id": str(row.id), "number": row.number, "status": row.status}

    actor = settlement.created_by
    return {
        "id": str(settlement.id),
        "party_id": str(settlement.party_id),
        "amount": f"{settlement.amount:.2f}",
        "settled_on": settlement.settled_on.isoformat(),
        "note": settlement.note,
        "in_payment": payment(settlement.in_payment),
        "out_payment": payment(settlement.out_payment),
        "before": settlement.before,
        "after": settlement.after,
        "created_at": settlement.created_at.isoformat(),
        # A name, never an email: the history is read at the counter.
        "created_by": (getattr(actor, "full_name", None) or getattr(actor, "name", None) or None)
        if actor
        else None,
        "voided_at": settlement.voided_at.isoformat() if settlement.voided_at else None,
        "void_reason": settlement.void_reason,
    }


def party_settlements(*, tenant: Any, party_id: Any, limit: int = 20) -> list[dict]:
    rows = (
        ShopSettlement.objects.filter(tenant=tenant, party_id=party_id)
        .select_related("in_payment", "out_payment", "created_by")
        .order_by("-created_at", "-id")[:limit]
    )
    return [settlement_view(row) for row in rows]


def settlement_candidates(*, tenant: Any, limit: int = CANDIDATE_LIMIT) -> dict:
    """Active contacts who are both a customer and a supplier, owing AND owed in the Shop.

    Largest settleable amount first. Only dual-role contacts are annotated, so the
    cost follows how many such people a shop has, not the size of its book."""
    from apps.parties.constants import PartyStatus
    from apps.parties.models import Party
    from apps.parties.selectors.shop import with_shop_facts

    money = DecimalField(max_digits=18, decimal_places=2)
    base = Party.objects.for_tenant(tenant).filter(
        status=PartyStatus.ACTIVE, is_customer=True, is_supplier=True
    )
    rows = (
        with_shop_facts(base, tenant=tenant)
        .annotate(
            # A6 — bills against bills: an old balance from before the app has no
            # bill to settle against (see `settleable`).
            settleable=Least(
                F("shop_customer_balance") - F("shop_customer_opening"),
                F("shop_supplier_balance") - F("shop_supplier_opening"),
                output_field=money,
            )
        )
        .filter(settleable__gt=ZERO)
        .order_by("-settleable", "name", "id")
    )
    people = list(rows[: limit + 1]) if limit else []
    total = len(people) if len(people) <= limit else rows.count()
    return {
        "count": total,
        "results": [
            {
                "party_id": str(row.id),
                "name": row.name,
                "customer_balance": f"{row.shop_customer_balance:.2f}",
                "supplier_balance": f"{row.shop_supplier_balance:.2f}",
                "max_amount": f"{row.settleable:.2f}",
            }
            for row in people[:limit]
        ],
    }
