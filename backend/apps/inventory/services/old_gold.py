"""G2c — old gold taken in against a jeweller's bill (design G2 `pOldGold`).

On the draft the counter types the weight, the tested purity, the rate and
the melting deduction; this module prices it (`price`) and the draft keeps
the result in `meta.old_gold`. When the bill is issued (`take_in`) the value
comes off what the customer pays as a no-money settlement allocated to the
bill — the cashbook never counts it, because no money moved — and the gold
goes into its own old-gold stock row by purity.

value = weight × rate − weight × rate × less %, each part rounded to the
paisa (Decimal's half-to-even), so the printed parts add up to the value.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from apps.inventory.services.metal_rates import PURITIES
from apps.inventory.services.tags import _dec, rate_today

TWO = Decimal("0.01")


def price(*, tenant: Any, raw: Any, errors: dict, path: str = "old_gold") -> dict | None:
    """The `meta.old_gold` of a draft, or None when there is none (or it is refused)."""
    if raw in (None, {}, ""):
        return None
    if not isinstance(raw, dict):
        errors[path] = ["Enter the old gold's weight and purity."]
        return None
    local: dict[str, list[str]] = {}
    weight = _dec(raw.get("weight_g"), "weight_g", local, required=True, places=3, minimum=Decimal("0.001"))
    purity = raw.get("purity")
    if purity not in PURITIES:
        local["purity"] = ["Choose the tested purity."]
    less = _dec(raw.get("less_pct"), "less_pct", local, required=False, places=2, minimum=Decimal("0")) or Decimal("0")
    if less > 100 and "less_pct" not in local:
        local["less_pct"] = ["The deduction is a percentage up to 100."]
    rate = None
    if raw.get("rate") not in (None, ""):
        rate = _dec(raw.get("rate"), "rate", local, required=False, places=2, minimum=Decimal("0.01"))
    elif purity in PURITIES:
        rate = rate_today(tenant=tenant, purity=purity)
        if rate is None:
            local["rate"] = ["Set today's rate first."]
    for name, messages in local.items():
        errors[f"{path}.{name}"] = messages
    if local or weight is None or rate is None:
        return None
    gross = (weight * rate).quantize(TWO)
    less_amount = (gross * less / 100).quantize(TWO)
    return {
        "weight_g": f"{weight:.3f}",
        "purity": purity,
        "rate": f"{rate:.2f}",
        "less_pct": f"{less:.2f}",
        "gross": f"{gross:.2f}",
        "less": f"{less_amount:.2f}",
        "value": f"{gross - less_amount:.2f}",
        **({"cash_back": True} if raw.get("cash_back") else {}),
    }


def value_of(document: Any) -> Decimal:
    """What the old gold on this bill takes off (0 when there is none)."""
    old = (document.meta or {}).get("old_gold") or {}
    return Decimal(old["value"]) if old.get("value") else Decimal("0")


def take_in(*, ctx: Any, document: Any) -> dict | None:
    """At issue: settle the old gold's value against the bill and stock the gold.

    Runs inside the issue's transaction, after the invoice exists. Returns the
    old-gold row's id and the settlement payment, or None when there is none.
    """
    from apps.common.constants import PaymentMode
    from apps.inventory.models import OldGold
    from apps.payments.services.record import record_adjustment, record_payment

    old = (document.meta or {}).get("old_gold") or {}
    value = value_of(document)
    if value <= 0:
        return None
    # More than the bill: the rest stays with a saved customer as an advance.
    walk_in = document.party_id is None
    recorded = record_adjustment(
        ctx=ctx,
        payload={
            "direction": "in",
            "party_id": str(document.party_id) if not walk_in else None,
            "payment_date": document.document_date.isoformat(),
            "amount": str(value),
            "mode_breakup": [{"mode": PaymentMode.ADJUSTMENT.value, "amount": str(value)}],
            "note": f"Old gold {old['weight_g']} g",
            "context": "old_gold",
            "meta": {"document_id": str(document.id), "document_number": document.number},
            "allocations": [
                {"document_type": "sales_document", "document_id": str(document.id), "amount": str(min(value, document.grand_total))}
            ],
        },
        walk_in_document_id=document.id if walk_in else None,
    )
    # Worth more than the bill and the customer wants the rest in cash: real
    # money goes out, so the cashbook counts it and the advance is used up.
    extra = value - document.grand_total
    if old.get("cash_back") and extra > 0 and not walk_in:
        record_payment(
            ctx=ctx,
            payload={
                "direction": "out",
                "party_id": str(document.party_id),
                "payment_date": document.document_date.isoformat(),
                "amount": str(extra),
                "mode_breakup": [{"mode": PaymentMode.CASH.value, "amount": str(extra)}],
                "note": f"Old gold cash back, {document.number}",
                "allocations": "none",
                "meta": {"document_id": str(document.id), "document_number": document.number},
            },
        )
    row = OldGold.objects.create(
        tenant=ctx.tenant,
        document_id=document.id,
        party_id=document.party_id,
        taken_on=document.document_date,
        purity=old["purity"],
        weight_g=Decimal(old["weight_g"]),
        rate=Decimal(old["rate"]),
        less_pct=Decimal(old["less_pct"]),
        value=value,
        payment_id=recorded["payment"].id,
    )
    return {"old_gold_id": str(row.id), "payment_id": str(recorded["payment"].id)}


def stock(*, tenant: Any) -> list[dict]:
    """The old-gold stock: grams held by purity (design D12 "Old gold taken")."""
    from django.db.models import Sum

    from apps.inventory.models import OldGold

    rows = OldGold.objects.filter(tenant=tenant).values("purity").annotate(grams=Sum("weight_g"), worth=Sum("value"))
    return [
        {"purity": r["purity"], "weight_g": f"{r['grams']:.3f}", "value": f"{r['worth']:.2f}"}
        for r in rows.order_by("purity")
    ]
