"""D P1c — godowns and moving stock between them (design D10, plan §P1).

A shop starts with one place, `MAIN`. Adding a second ("Godown") is what turns
the concept on: the Move stock screen, and later the godown choice on bills.

A transfer is one numbered header and, per line, a `transfer_out` from one
place and a `transfer_in` to the other at the SAME unit cost (the average at
the source), so the shop's total stock and its value do not change. The out
side posts first and refuses a line that would take the source below zero
("Only 9 in Godown"), whatever the shop's negative-stock setting: goods that
are not in the godown cannot be carried out of it.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction

from apps.common.audit import AuditAction, write_audit
from apps.common.context import Ctx
from apps.common.dates import tenant_today
from apps.common.exceptions import ValidationFailed
from apps.common.money import q3
from apps.inventory.constants import MAX_QTY, ItemStatus, ItemType, MovementSource, MovementType
from apps.inventory.models import Item, Location, StockTransfer
from apps.inventory.services.parsing import Errors, clean_text, parse_decimal
from apps.inventory.services.stock import (
    MovementLine,
    default_location,
    post_movements,
    validate_qty_for_unit,
)

MAX_LINES = 200
MAX_LOCATIONS = 10


def add_location(*, ctx: Ctx, name: Any) -> Location:
    text = clean_text(name or "")[:80]
    if not text:
        raise ValidationFailed({"name": ["Name the place, for example Godown."]})
    default_location(ctx.tenant)  # the shop's first place exists before its second
    existing = Location.objects.filter(tenant=ctx.tenant)
    if existing.filter(name__iexact=text).exists():
        raise ValidationFailed({"name": [f"{text} is already one of your places."]})
    if existing.count() >= MAX_LOCATIONS:
        raise ValidationFailed({"name": [f"Up to {MAX_LOCATIONS} places."]})
    # D P1c — a second place turns godowns on: the bill and purchase editors
    # read `godowns` from the session before they ask which place.
    from apps.platform_app.models import TenantSetting

    TenantSetting.objects.update_or_create(
        tenant=ctx.tenant, key="shop.features.godowns", defaults={"value": {"value": True}}
    )
    code = f"L{existing.count() + 1:02d}"
    while existing.filter(code=code).exists():
        code = f"L{int(code[1:]) + 1:02d}"
    return Location.objects.create(
        tenant=ctx.tenant,
        created_by=ctx.actor if ctx.actor_type == "user" else None,
        name=text,
        code=code,
        is_default=False,
        is_active=True,
    )


def _place(ctx: Ctx, raw: Any, path: str, errors: Errors) -> Location | None:
    try:
        place = Location.objects.filter(tenant=ctx.tenant, pk=raw, is_active=True).first() if raw else None
    except (ValueError, TypeError, DjangoValidationError):
        place = None
    if place is None:
        errors.add(path, "Choose one of your places.", "required")
    return place


@transaction.atomic
def post_transfer(*, ctx: Ctx, payload: dict) -> StockTransfer:
    errors = Errors()
    source = _place(ctx, payload.get("from_location_id"), "from_location_id", errors)
    target = _place(ctx, payload.get("to_location_id"), "to_location_id", errors)
    if source and target and source.pk == target.pk:
        errors.add("to_location_id", "Choose a different place to move to.", "same_location")
    raw_lines = payload.get("lines")
    if not isinstance(raw_lines, list) or not raw_lines:
        errors.add("lines", "Add an item to move.", "required")
        raw_lines = []
    if len(raw_lines) > MAX_LINES:
        errors.add("lines", f"Move up to {MAX_LINES} items at once.", "max_lines")
    note = clean_text(payload.get("note") or "")[:200]
    item_ids = [line.get("item_id") for line in raw_lines if isinstance(line, dict)]
    try:
        items = {
            str(item.id): item
            for item in Item.objects.filter(tenant=ctx.tenant, pk__in=item_ids).select_related("unit")
        }
    except (ValueError, TypeError, DjangoValidationError):
        items = {}
    parsed: list[tuple[int, Item, Decimal]] = []
    seen: set = set()
    for index, line in enumerate(raw_lines):
        path = f"lines.{index}"
        line = line if isinstance(line, dict) else {}
        item = items.get(str(line.get("item_id")))
        if item is None:
            errors.add(f"{path}.item_id", "Choose an item from your list.", "required")
            continue
        if item.item_type != ItemType.GOODS or not item.track_stock:
            errors.add(f"{path}.item_id", "This item does not keep stock.", "track_stock_not_allowed")
            continue
        if item.status == ItemStatus.ARCHIVED:
            errors.add(f"{path}.item_id", "This item is archived.", "item_archived")
            continue
        if item.id in seen:
            errors.add(f"{path}.item_id", "This item is in the list twice.", "duplicate")
            continue
        seen.add(item.id)
        qty = parse_decimal(
            line.get("qty"),
            path=f"{path}.qty",
            errors=errors,
            places=3,
            maximum=MAX_QTY,
            required=True,
            allow_zero=False,
            code="invalid_qty",
            message="Enter how many to move.",
        )
        if qty is not None and validate_qty_for_unit(qty, allow_decimal=item.unit.allow_decimal):
            errors.add(f"{path}.qty", f"Use a whole number for {item.unit.code}.", "qty_must_be_whole")
            continue
        if qty is not None:
            parsed.append((index, item, q3(qty)))
    if errors:
        raise ValidationFailed(errors.payload())

    today = tenant_today(ctx.tenant)
    transfer = StockTransfer(
        tenant=ctx.tenant,
        created_by=ctx.actor if ctx.actor_type == "user" else None,
        number="",
        transfer_date=today,
        from_location=source,
        to_location=target,
        note=note,
    )
    outs = post_movements(
        ctx=ctx,
        lines=[
            MovementLine(
                item=item,
                qty=-qty,
                movement_type=MovementType.TRANSFER_OUT,
                movement_date=today,
                source_type=MovementSource.STOCK_TRANSFER,
                source_id=transfer.id,
                location=source,
                index=index,
            )
            for index, item, qty in parsed
        ],
        allow_negative=False,
    )
    post_movements(
        ctx=ctx,
        lines=[
            MovementLine(
                item=row.line.item,
                qty=-row.movement.qty,
                movement_type=MovementType.TRANSFER_IN,
                movement_date=today,
                source_type=MovementSource.STOCK_TRANSFER,
                source_id=transfer.id,
                unit_cost=row.movement.unit_cost,
                location=target,
                index=row.line.index,
            )
            for row in outs
        ],
    )
    from apps.platform_app.services.sequences import allocate_number

    transfer.number = allocate_number(tenant=ctx.tenant, kind="stock_transfer", on_date=today)
    transfer.save(force_insert=True)
    write_audit(
        ctx=ctx,
        action=AuditAction.STOCK_TRANSFER_POSTED,
        entity_type="inventory_stock_transfer",
        entity_id=transfer.id,
        after={
            "number": transfer.number,
            "from": source.name,
            "to": target.name,
            "lines": [{"item_id": str(item.id), "qty": str(qty)} for _i, item, qty in parsed],
        },
    )
    return transfer

