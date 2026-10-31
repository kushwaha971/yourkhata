"""D P4 — batch and expiry for medicines (design D6 / D7, plan §P4).

Built beside the stock engine, as IMEIs are, not inside it: the item's
quantity and its average cost stay in `ItemStock` / `StockMovement` exactly as
for every other item, and `inventory_batch` says which strips are which batch,
when each expires, and how many are left. The plan's deeper version (a batch
key on every stock row) would put a batch in the lock order of every kirana
bill; this keeps non-batch bills on today's path, untouched.

* a purchase line names its batch, expiry and MRP: that batch grows;
* a sale takes the earliest-expiring batch first (FEFO), skipping expired
  ones, and the line records which batches it took ("B-2231 · exp 03/27");
* a return or a sale's void puts them back; a purchase's void takes its batch
  back out.

Batches are counted in the item's own unit, and are per business, not per
godown (a known limit, listed in the piece report).
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError

ZERO = Decimal("0")


def tracked(item: Any) -> bool:
    return item is not None and getattr(item, "tracking", "none") == "batch"


def parse_purchase(raw: Any, *, item: Any, path: str, errors: dict, strict: bool) -> list[dict]:
    """A purchase line's batch: `{batch_no, expiry, mrp?}` (one per line)."""
    if not tracked(item):
        return []
    entry = raw[0] if isinstance(raw, list) and raw else (raw if isinstance(raw, dict) else {})
    number = "".join(str(entry.get("batch_no") or "").split()).upper()[:32]
    expiry = entry.get("expiry")
    try:
        when = dt.date.fromisoformat(str(expiry)) if expiry else None
    except ValueError:
        when = None
    if strict and not number:
        errors[f"{path}.batch_no"] = ["Enter the batch number."]
    if strict and when is None:
        errors[f"{path}.expiry"] = ["Enter the expiry (month and year)."]
    if not number and when is None:
        return []
    out: dict = {"batch_no": number, "expiry": when.isoformat() if when else None}
    if entry.get("mrp") not in (None, ""):
        out["mrp"] = str(entry.get("mrp"))
    return [out]


def receive(*, ctx: Any, document: Any, rows: list[dict]) -> None:
    from apps.inventory.models import Batch
    from apps.inventory.services.units import base_qty

    for row in rows:
        item = row.get("item")
        if not tracked(item) or not row.get("batches"):
            continue
        entry = row["batches"][0]
        qty = base_qty(row)
        batch = (
            Batch.objects.select_for_update()
            .filter(tenant=ctx.tenant, item=item, batch_no=entry["batch_no"])
            .first()
        )
        if batch is None:
            batch = Batch(
                tenant=ctx.tenant,
                item=item,
                batch_no=entry["batch_no"],
                expiry=dt.date.fromisoformat(entry["expiry"]),
            )
        batch.qty = (batch.qty or ZERO) + qty
        if entry.get("mrp"):
            batch.mrp = Decimal(entry["mrp"])
        batch.supplier_id = getattr(document, "party_id", None)
        batch.save()
        entry["qty"] = str(qty)


def allocate(*, ctx: Any, document: Any, rows: list[dict]) -> None:
    """Sale: earliest expiry first, expired batches skipped, under row locks.

    What no batch covers is left unallocated rather than refused: the stock
    engine has already decided whether the quantity may be sold.
    """
    from apps.inventory.models import Batch
    from apps.inventory.services.units import base_qty

    today = document.document_date
    for row in rows:
        item = row.get("item")
        if not tracked(item):
            continue
        wanted = base_qty(row)
        named = [b.get("batch_no") for b in row.get("batches") or [] if b.get("batch_no")]
        live = Batch.objects.select_for_update().filter(
            tenant=ctx.tenant, item=item, qty__gt=0, expiry__gte=today
        )
        if named:
            live = live.filter(batch_no__in=named)
        taken: list[dict] = []
        for batch in live.order_by("expiry", "batch_no"):
            if wanted <= 0:
                break
            take = min(batch.qty, wanted)
            batch.qty -= take
            batch.save(update_fields=["qty", "updated_at"])
            wanted -= take
            taken.append(
                {"batch_no": batch.batch_no, "expiry": batch.expiry.isoformat(), "qty": str(take)}
            )
        row["batches"] = taken


def put_back(*, ctx: Any, item_batches: list[tuple[Any, list[dict]]], factor: Decimal | None = None) -> None:
    """A return or a sale's void: each batch taken gets its pieces back."""
    from apps.inventory.models import Batch

    for item, taken in item_batches:
        if not tracked(item):
            continue
        for entry in taken or []:
            qty = Decimal(str(entry.get("qty") or "0")) * (factor or Decimal("1"))
            Batch.objects.filter(tenant=ctx.tenant, item=item, batch_no=entry.get("batch_no")).update(
                qty=models_f("qty") + qty
            )


def take_out(*, ctx: Any, item_batches: list[tuple[Any, list[dict]]]) -> None:
    """A purchase's void: its batch loses what that purchase added."""
    from apps.inventory.models import Batch

    for item, added in item_batches:
        if not tracked(item):
            continue
        for entry in added or []:
            qty = Decimal(str(entry.get("qty") or "0"))
            Batch.objects.filter(tenant=ctx.tenant, item=item, batch_no=entry.get("batch_no")).update(
                qty=models_f("qty") - qty
            )


def models_f(name: str) -> Any:
    from django.db.models import F

    return F(name)


def expiry_rows(*, tenant: Any, within: str, today: dt.date) -> list[dict]:
    """D7 — batches that have expired, or will within 30 / 60 / 90 days."""
    from apps.inventory.models import Batch, ItemStock
    from apps.parties.models import Party

    qs = Batch.objects.filter(tenant=tenant, qty__gt=0).select_related("item")
    if within == "expired":
        qs = qs.filter(expiry__lt=today)
    else:
        try:
            days = int(within)
        except (TypeError, ValueError):
            days = 30
        qs = qs.filter(expiry__gte=today, expiry__lte=today + dt.timedelta(days=days))
    rows = list(qs.order_by("expiry", "item__name"))
    avg = {
        s.item_id: s.avg_cost
        for s in ItemStock.objects.filter(item_id__in=[r.item_id for r in rows])
    }
    try:
        suppliers = dict(
            Party.objects.filter(tenant=tenant, pk__in=[r.supplier_id for r in rows if r.supplier_id]).values_list(
                "id", "name"
            )
        )
    except (ValueError, DjangoValidationError):
        suppliers = {}
    return [
        {
            "item": {"id": str(r.item_id), "name": r.item.name},
            "batch_no": r.batch_no,
            "expiry": r.expiry.isoformat(),
            "days": (r.expiry - today).days,
            "qty": str(r.qty),
            "value": str((r.qty * avg.get(r.item_id, ZERO)).quantize(Decimal("0.01"))),
            "supplier": suppliers.get(r.supplier_id),
        }
        for r in rows
    ]
