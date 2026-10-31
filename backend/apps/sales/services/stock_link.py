"""Stock for returns and voids, through `inventory.post_movements` (Part 20 §20.6.2).

Two movements, and both go through the one writer so the weighted-average rule
and the arrival order (CR-2026-09-24-INV-A) are never restated here:

* A credit note's RESTOCK is a `sale_return_in` inbound at the invoice line's
  `unit_cost_snapshot` (SAL-04 FR-5, BR-5) — the goods come back at the cost
  they left at, so the average is restored rather than distorted. A standalone
  note has no snapshot and comes back at the item's current average.
* A VOID posts one `reversal` per movement the document wrote, pointing at it
  with `reverses_id` (SAL-05 FR-2, SAL-04 FR-10). The costing step's value-
  reversal cases take the reversed row's own cost, so after a void with nothing
  in between the average is exactly what it was before the sale (BR-2).

Both are dated TODAY for a void (SAL-05 BR-6) and the document's date for a
restock, which is when the goods came back.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from apps.common.context import Ctx
from apps.common.dates import tenant_today

VOID_REASON_CODE = "document_void"


def _tracked(item: Any) -> bool:
    from apps.inventory.constants import ItemType

    return item is not None and item.item_type == ItemType.GOODS and bool(item.track_stock)


def restock_rows(ctx: Ctx, document: Any, rows: list[dict]) -> list[str]:
    """`sale_return_in` for every tracked goods row. Returns the movement ids."""
    from apps.inventory.constants import MovementType
    from apps.inventory.services.stock import MovementLine, post_movements
    from apps.inventory.services.units import base_qty, per_base_unit

    lines = []
    for row in rows:
        item = row.get("item")
        if not _tracked(item):
            continue
        # None (standalone, or an invoice line with no snapshot) is the costing
        # step's "inbound without a cost": in at the current average, which is
        # left unchanged.
        cost = per_base_unit(row.get("unit_cost_snapshot"), row)
        lines.append(
            MovementLine(
                item=item,
                qty=base_qty(row),
                # A return comes back to the godown the bill sold from.
                location=getattr(getattr(document, "against", None), "location", None)
                or document.location,
                movement_type=MovementType.SALE_RETURN_IN,
                movement_date=document.document_date,
                source_type="sales_document",
                source_id=document.id,
                unit_cost=cost,
                index=row["line_no"] - 1,
            )
        )
    from apps.inventory.services import serials

    serials.put_back(
        ctx=ctx, item_serials=[(row.get("item"), list(row.get("serials") or [])) for row in rows]
    )
    from apps.inventory.services import batches

    batches.put_back(
        ctx=ctx, item_batches=[(row.get("item"), list(row.get("batches") or [])) for row in rows]
    )
    return [str(p.movement.id) for p in post_movements(ctx=ctx, lines=lines)]


def reverse_document_stock(ctx: Ctx, document: Any) -> list[str]:
    """One `reversal` per movement this document wrote that nothing has reversed yet.

    Raises 409 `insufficient_stock` when undoing an INBOUND (a restock) would
    take the item below zero and the tenant disallows negative stock
    (SAL-04 EC-10) — the returned goods were sold again since.
    """
    from apps.inventory.constants import MovementType
    from apps.inventory.models import StockMovement
    from apps.inventory.services.stock import MovementLine, post_movements

    written = list(
        StockMovement.objects.filter(
            tenant=ctx.tenant, source_type="sales_document", source_id=document.id
        )
        .exclude(movement_type=MovementType.REVERSAL)
        .select_related("item", "item__unit", "location")
        .order_by("sequence_no")
    )
    if not written:
        return []
    undone = set(
        StockMovement.objects.filter(reverses__in=written).values_list("reverses_id", flat=True)
    )
    today = tenant_today(ctx.tenant)
    lines = [
        MovementLine(
            item=movement.item,
            qty=-movement.qty,
            movement_type=MovementType.REVERSAL,
            movement_date=today,
            source_type="sales_document",
            source_id=document.id,
            reason=VOID_REASON_CODE,
            reverses=movement,
            location=movement.location,
            index=index,
        )
        for index, movement in enumerate(written)
        if movement.id not in undone
    ]
    # D P3 — a voided bill's phones are back in stock (a voided return's leave again
    # through the same movements; their serials were never moved by the note).
    from apps.inventory.services import serials

    if document.kind != "credit_note":
        serials.put_back(
            ctx=ctx,
            item_serials=[(line.item, list(line.serials or [])) for line in document.lines.all()],
        )
        from apps.inventory.services import batches

        batches.put_back(
            ctx=ctx,
            item_batches=[(line.item, list(line.batches or [])) for line in document.lines.all()],
        )
    return [str(p.movement.id) for p in post_movements(ctx=ctx, lines=lines)]
