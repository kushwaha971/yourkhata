"""C3 — stock count (R-DEC-67): count the shelves, then save every difference.

The four owner decisions this module carries:

1. An open count lives on the server (`StockCount`, one open per location), so
   counting survives a dead phone and two phones count into the same record.
2. Each line keeps `books_qty`, the book stock at the moment the item was
   counted. Saving posts `counted − books_qty`, so a sale made after the shelf
   was counted is not reported as a shortage.
3. Saving is one transaction for the whole count, however many lines differ
   (the stock adjustment's 100-line limit does not apply).
4. Counting needs `inventory.stock.read`; saving needs `inventory.stock.adjust`
   (enforced in the view); value figures follow the cost-visibility gate.

A count's movements are `stocktake_in` / `stocktake_out` with
`source_type="stock_count"`. Stock found on the shelf comes in at the item's
average cost (its value is not a purchase, so no new cost is invented); stock
missing goes out at the average, as every outbound movement does.

Saving allows negative stock for its own lines: the shelf is the truth, and a
refusal would leave the count unsaveable for a book error the count exists to
correct.
"""

from __future__ import annotations

from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.common.audit import AuditAction, write_audit
from apps.common.context import Ctx
from apps.common.dates import tenant_today
from apps.common.exceptions import BusinessRuleViolation, NotFound, ValidationFailed
from apps.common.money import q2, q3, q4
from apps.inventory.constants import (
    MAX_QTY,
    ItemStatus,
    ItemType,
    MovementSource,
    MovementType,
    StockCountStatus,
)
from apps.inventory.models import Item, ItemStock, StockCount, StockCountLine
from apps.inventory.services.parsing import Errors, parse_decimal
from apps.inventory.services.stock import (
    MovementLine,
    default_location,
    ensure_stock_rows,
    lock_stock_rows,
    post_movements,
    validate_qty_for_unit,
)

ZERO3 = Decimal("0.000")


def open_count(*, ctx: Ctx) -> StockCount:
    """The location's open count, started if there is none (a second phone joins it)."""
    location = default_location(ctx.tenant)
    existing = StockCount.objects.filter(
        tenant=ctx.tenant, location=location, status=StockCountStatus.OPEN
    ).first()
    if existing is not None:
        return existing
    try:
        with transaction.atomic():
            return StockCount.objects.create(
                tenant=ctx.tenant,
                location=location,
                created_by=ctx.actor if ctx.actor_type == "user" else None,
            )
    except IntegrityError:
        # Two phones pressed Start together: the other one's count wins.
        return StockCount.objects.get(
            tenant=ctx.tenant, location=location, status=StockCountStatus.OPEN
        )


def get_count(*, ctx: Ctx, count_id: object) -> StockCount:
    try:
        count = StockCount.objects.filter(tenant=ctx.tenant, pk=count_id).first()
    except (ValueError, TypeError, DjangoValidationError):
        count = None
    if count is None:
        raise NotFound("No such stock count.")
    return count


def _countable_item(*, ctx: Ctx, item_id: object) -> Item:
    try:
        item = Item.objects.select_related("unit").filter(tenant=ctx.tenant, pk=item_id).first()
    except (ValueError, TypeError, DjangoValidationError):
        item = None
    if item is None:
        raise NotFound("Item not found.")
    if item.item_type != ItemType.GOODS or not item.track_stock:
        raise BusinessRuleViolation(
            "track_stock_not_allowed",
            "This item does not keep stock, so it is not counted.",
            details={"item_id": str(item.id)},
        )
    if item.status == ItemStatus.ARCHIVED:
        raise BusinessRuleViolation(
            "item_archived", "This item is archived.", details={"item_id": str(item.id)}
        )
    return item


def _books_now(*, count: StockCount, item: Item) -> Decimal:
    stock = ItemStock.objects.filter(
        tenant=count.tenant, item=item, location=count.location
    ).first()
    return stock.on_hand if stock is not None else ZERO3


def _require_open(count: StockCount) -> None:
    if count.status != StockCountStatus.OPEN:
        raise BusinessRuleViolation("count_saved", "This count is already saved.")


@transaction.atomic
def set_counted(
    *, ctx: Ctx, count: StockCount, item_id: object, qty: object = None, add: object = None
) -> StockCountLine:
    """Set an item's counted quantity (`qty`) or add to it (`add`, a scan is +1).

    The line row is locked, so two phones scanning the same item both count.
    `books_qty` is taken when the item is first counted and again whenever the
    count is typed afresh; a scan that only adds keeps the original moment.
    """
    count = StockCount.objects.select_for_update().get(pk=count.pk)
    _require_open(count)
    item = _countable_item(ctx=ctx, item_id=item_id)
    errors = Errors()
    if (qty is None) == (add is None):
        errors.add("qty", "Send the counted quantity.", "required")
        raise ValidationFailed(errors.payload())
    value = parse_decimal(
        qty if qty is not None else add,
        path="qty" if qty is not None else "add",
        errors=errors,
        places=3,
        maximum=MAX_QTY,
        required=True,
        allow_zero=qty is not None,
        allow_negative=add is not None,
        code="invalid_qty",
        message="Enter the quantity on the shelf.",
    )
    if value is not None and validate_qty_for_unit(value, allow_decimal=item.unit.allow_decimal):
        errors.add("qty", f"Quantity must be a whole number for {item.unit.code}.", "qty_must_be_whole")
    if errors:
        raise ValidationFailed(errors.payload())

    now = timezone.now()
    actor = ctx.actor if ctx.actor_type == "user" else None
    line = (
        StockCountLine.objects.select_for_update()
        .filter(count=count, item=item)
        .first()
    )
    if line is None:
        counted = q3(value)
        if counted < 0:
            raise ValidationFailed({"add": ["A count cannot go below zero."]})
        return StockCountLine.objects.create(
            tenant=ctx.tenant,
            created_by=actor,
            count=count,
            item=item,
            counted_qty=counted,
            books_qty=_books_now(count=count, item=item),
            counted_at=now,
            counted_by=actor,
        )
    if qty is not None:
        line.counted_qty = q3(value)
        line.books_qty = _books_now(count=count, item=item)
        line.counted_at = now
    else:
        counted = q3(line.counted_qty + value)
        if counted < 0:
            raise ValidationFailed({"add": ["A count cannot go below zero."]})
        line.counted_qty = counted
    line.counted_by = actor
    line.save(update_fields=["counted_qty", "books_qty", "counted_at", "counted_by", "updated_at"])
    return line


@transaction.atomic
def uncount(*, ctx: Ctx, count: StockCount, item_id: object) -> None:
    """Take an item back out of the count (it was counted by mistake)."""
    count = StockCount.objects.select_for_update().get(pk=count.pk)
    _require_open(count)
    try:
        StockCountLine.objects.filter(count=count, item_id=item_id).delete()
    except (ValueError, TypeError, DjangoValidationError) as exc:
        raise NotFound("Item not found.") from exc


@transaction.atomic
def save_count(*, ctx: Ctx, count: StockCount) -> StockCount:
    """Post every difference, all or nothing, and close the count (R-DEC-67 #3).

    A double tap is safe: the count row is locked, and the second save finds it
    saved and is refused with `count_saved`, posting nothing.
    """
    count = StockCount.objects.select_for_update().get(pk=count.pk)
    _require_open(count)
    lines = list(
        StockCountLine.objects.filter(count=count).select_related("item", "item__unit")
    )
    if not lines:
        raise BusinessRuleViolation("count_empty", "Count at least one item before saving.")
    differing = [line for line in lines if line.counted_qty != line.books_qty]
    pairs = [(line.item_id, count.location_id) for line in differing]
    ensure_stock_rows(tenant=ctx.tenant, pairs=pairs)
    rows = lock_stock_rows(tenant=ctx.tenant, pairs=pairs)
    today = tenant_today(ctx.tenant)
    movement_lines = []
    for index, line in enumerate(differing):
        delta = q3(line.counted_qty - line.books_qty)
        avg = rows[(line.item_id, count.location_id)].avg_cost
        movement_lines.append(
            MovementLine(
                item=line.item,
                location=count.location,
                qty=delta,
                unit_cost=q4(avg) if delta > 0 else None,
                movement_type=MovementType.STOCKTAKE_IN if delta > 0 else MovementType.STOCKTAKE_OUT,
                movement_date=today,
                source_type=MovementSource.STOCK_COUNT,
                source_id=count.id,
                reason="count",
                index=index,
            )
        )
    posted = post_movements(ctx=ctx, lines=movement_lines, allow_negative=True)

    count.status = StockCountStatus.SAVED
    count.saved_at = timezone.now()
    count.saved_by = ctx.actor if ctx.actor_type == "user" else None
    count.save(update_fields=["status", "saved_at", "saved_by", "updated_at"])

    total = Decimal("0.00")
    snapshot = []
    for row in posted:
        impact = q2(row.movement.qty * (row.movement.unit_cost or Decimal("0")))
        total += impact
        snapshot.append(
            {
                "item_id": str(row.line.item.id),
                "qty": str(row.movement.qty),
                "unit_cost": str(row.movement.unit_cost),
                "on_hand_before": str(row.on_hand_before),
                "on_hand_after": str(row.movement.on_hand_after),
                "value_impact": str(impact),
            }
        )
    write_audit(
        ctx=ctx,
        action=AuditAction.STOCK_COUNT_SAVED,
        entity_type="inventory_stock_count",
        entity_id=count.id,
        after={
            "counted": len(lines),
            "differ": len(differing),
            "lines": snapshot,
            "value_impact_total": str(q2(total)),
        },
    )
    return count
