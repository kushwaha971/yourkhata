"""G4 — the medical store's short book (design dShortBook / pSubst).

What ran out or was asked for, with the distributor it usually comes from and
the last rate paid, so each distributor can be sent one list. Rows come from
two places: `ShortBookEntry` (asked at the counter, or added by hand) and items
below their own reorder level. An item with no reorder level set is never
listed by stock alone: a catalogue full of never-stocked items would bury the
book.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.common.context import Ctx
from apps.common.dates import tenant_today
from apps.common.exceptions import NotFound, ValidationFailed
from apps.inventory.constants import ItemStatus, StockStatus
from apps.inventory.models import Item, ShortBookEntry
from apps.inventory.selectors.stock import low_stock_queryset, suggested_qty

REASONS = ("asked", "manual")


def _last_purchases(tenant: Any, item_ids: list[Any]) -> dict[Any, dict]:
    """Each item's latest recorded purchase line: who it came from and the rate."""
    from apps.purchases.constants import DocumentKind, DocumentStatus
    from apps.purchases.models import PurchaseDocumentLine

    out: dict[Any, dict] = {}
    rows = (
        PurchaseDocumentLine.objects.filter(
            document__tenant=tenant,
            document__kind=DocumentKind.PURCHASE_BILL,
            item_id__in=item_ids,
        )
        .exclude(document__status__in=[DocumentStatus.DRAFT, DocumentStatus.VOID])
        .select_related("document__party")
        .order_by("item_id", "-document__document_date", "-document__created_at")
    )
    for line in rows:
        if line.item_id in out:
            continue
        party = line.document.party
        out[line.item_id] = {
            "supplier": {"id": str(party.id), "name": party.name} if party else None,
            "last_rate": str(line.unit_cost.quantize(Decimal("0.01"))),
        }
    return out


def short_book(*, tenant: Any) -> dict:
    entries = list(
        ShortBookEntry.objects.filter(tenant=tenant, ordered_at__isnull=True)
        .select_related("item__unit")
        .order_by("-asked_count", "created_at")
    )
    in_book = {entry.item_id for entry in entries}
    low = [
        item
        for item in low_stock_queryset(tenant=tenant, location_id=None)
        if item.reorder_point is not None and item.id not in in_book
    ]
    stock = {
        item.id: item
        for item in low_stock_queryset(tenant=tenant, location_id=None).filter(
            id__in=list(in_book)
        )
    }
    ids = [entry.item_id for entry in entries] + [item.id for item in low]
    last = _last_purchases(tenant, ids)
    today = tenant_today(tenant)
    rows: list[dict] = []
    asked_today = 0
    for entry in entries:
        item = entry.item
        on_hand = getattr(stock.get(item.id), "on_hand", None)
        if entry.reason == "asked" and timezone.localdate(entry.updated_at) == today:
            asked_today += 1
        rows.append(
            {
                "item": _item(item),
                "reason": entry.reason,
                "asked_count": entry.asked_count,
                "on_hand": str(on_hand) if on_hand is not None else None,
                "qty": str(entry.qty) if entry.qty is not None else None,
                **last.get(item.id, {"supplier": None, "last_rate": None}),
            }
        )
    for item in low:
        rows.append(
            {
                "item": _item(item),
                "reason": "low",
                "asked_count": 0,
                "on_hand": str(item.on_hand),
                "qty": str(suggested_qty(on_hand=item.on_hand, reorder_point=item.reorder_point)),
                **last.get(item.id, {"supplier": None, "last_rate": None}),
            }
        )
    distributors = {row["supplier"]["id"] for row in rows if row["supplier"]}
    return {
        "rows": rows,
        "counts": {"items": len(rows), "distributors": len(distributors), "asked_today": asked_today},
    }


def _item(item: Item) -> dict:
    return {
        "id": str(item.id),
        "name": item.name,
        "unit_code": item.unit.code,
        "salt": item.salt,
    }


@transaction.atomic
def add(*, ctx: Ctx, item_id: Any, reason: str = "asked", qty: Any = None) -> dict:
    """Write an item into the book, or count one more ask on its open row."""
    if reason not in REASONS:
        raise ValidationFailed({"reason": ["Choose asked or manual."]})
    try:
        item = Item.objects.get(tenant=ctx.tenant, pk=item_id, status=ItemStatus.ACTIVE)
    except (Item.DoesNotExist, ValueError, TypeError) as exc:
        raise NotFound("Item not found.") from exc
    amount = None
    if qty not in (None, ""):
        try:
            amount = Decimal(str(qty))
        except Exception as exc:  # noqa: BLE001 — any unparsable text is the same refusal
            raise ValidationFailed({"qty": ["Enter a quantity."]}) from exc
        if amount <= 0:
            raise ValidationFailed({"qty": ["Enter a quantity above zero."]})
    entry = (
        ShortBookEntry.objects.select_for_update()
        .filter(tenant=ctx.tenant, item=item, ordered_at__isnull=True)
        .first()
    )
    if entry is None:
        try:
            with transaction.atomic():
                entry = ShortBookEntry.objects.create(
                    tenant=ctx.tenant,
                    item=item,
                    reason=reason,
                    asked_count=1 if reason == "asked" else 0,
                    qty=amount,
                    created_by=ctx.actor if ctx.actor_type == "user" else None,
                )
                return {"item_id": str(item.id), "asked_count": entry.asked_count, "created": True}
        except IntegrityError:
            # Two counters wrote it at once: the other row wins; count this ask on it.
            entry = ShortBookEntry.objects.select_for_update().get(
                tenant=ctx.tenant, item=item, ordered_at__isnull=True
            )
    if reason == "asked":
        entry.asked_count += 1
    if amount is not None:
        entry.qty = amount
    entry.save(update_fields=["asked_count", "qty", "updated_at"])
    return {"item_id": str(item.id), "asked_count": entry.asked_count, "created": False}


@transaction.atomic
def mark_ordered(*, ctx: Ctx, item_ids: list[Any]) -> int:
    """Close the open rows of items that were just put on purchase orders."""
    if not isinstance(item_ids, list) or not item_ids:
        raise ValidationFailed({"item_ids": ["Choose the items that were ordered."]})
    return ShortBookEntry.objects.filter(
        tenant=ctx.tenant, item_id__in=item_ids, ordered_at__isnull=True
    ).update(ordered_at=timezone.now())


def substitutes(*, tenant: Any, item_id: Any) -> list[dict]:
    """G4 pSubst — other medicines with the same salt, in stock first, then cheapest."""
    from apps.inventory.selectors.stock import with_stock

    try:
        item = Item.objects.get(tenant=tenant, pk=item_id)
    except (Item.DoesNotExist, ValueError, TypeError) as exc:
        raise NotFound("Item not found.") from exc
    salt = " ".join((item.salt or "").split()).lower()
    if not salt:
        return []
    same = [
        other
        for other in with_stock(
            Item.objects.filter(tenant=tenant, status=ItemStatus.ACTIVE, salt__isnull=False)
            .exclude(pk=item.pk)
            .select_related("unit"),
            location_id=None,
        )
        if " ".join((other.salt or "").split()).lower() == salt
    ]
    same.sort(key=lambda o: (o.stock_status == StockStatus.OUT, -o.on_hand, o.selling_price))
    return [
        {
            "item": _item(other),
            "on_hand": str(other.on_hand),
            "selling_price": str(other.selling_price),
            "in_stock": other.stock_status != StockStatus.OUT,
        }
        for other in same
    ]
