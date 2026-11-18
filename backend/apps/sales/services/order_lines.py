"""Order lines kept before a bill exists (G10 café orders, G11 phone orders).

Each line names an item of this business at its price unless one was typed; the
total is what the lines add up to. The bill made later prices them again.
"""

from __future__ import annotations

import uuid
from decimal import Decimal, InvalidOperation
from typing import Any

MAX_LINES = 50
NOTE_MAX = 60


def dec(raw: Any) -> Decimal | None:
    try:
        return Decimal(str(raw).replace(",", "").strip())
    except (InvalidOperation, ValueError):
        return None


def clean_lines(tenant: Any, raw: Any, errors: dict) -> tuple[list[dict], Decimal]:
    """Each line names an item of this business; its rate is the item's price
    unless the counter typed one. The total is what the lines add up to."""
    from apps.inventory.models import Item

    rows = raw if isinstance(raw, list) else []
    if not rows:
        errors["lines"] = ["Add at least one item."]
        return [], Decimal("0")
    if len(rows) > MAX_LINES:
        errors["lines"] = [f"Keep an order under {MAX_LINES} items."]
        return [], Decimal("0")
    ids = []
    for row in rows:
        try:
            ids.append(uuid.UUID(str((row or {}).get("item_id"))))
        except (TypeError, ValueError, AttributeError):
            ids.append(None)
    items = {
        item.id: item
        for item in Item.objects.select_related("unit").filter(tenant=tenant, pk__in=[i for i in ids if i], status="active", deleted_at__isnull=True)
    }
    lines: list[dict] = []
    total = Decimal("0")
    for index, (row, pk) in enumerate(zip(rows, ids)):
        item = items.get(pk)
        if item is None:
            errors[f"lines.{index}.item_id"] = ["Choose an item from your list."]
            continue
        qty = dec(row.get("qty"))
        if qty is None or qty <= 0 or qty > Decimal("100000"):
            errors[f"lines.{index}.qty"] = ["Enter how many."]
            continue
        rate = item.selling_price if row.get("rate") in (None, "") else dec(row.get("rate"))
        if rate is None or rate < 0:
            errors[f"lines.{index}.rate"] = ["Enter the rate."]
            continue
        qty = qty.quantize(Decimal("0.001"))
        rate = Decimal(rate).quantize(Decimal("0.01"))
        note = " ".join(str(row.get("note") or "").split())[:NOTE_MAX]
        lines.append(
            {
                "item_id": str(item.id),
                "name": item.name,
                "qty": f"{qty.normalize():f}",
                "rate": f"{rate:.2f}",
                "unit": item.unit.code,
                "note": note,
            }
        )
        total += (qty * rate).quantize(Decimal("0.01"))
    return lines, total
