"""D P1a — an item sold or bought in another unit (1 Box = 20 PCS).

One place turns a document line's unit into the base unit, so every stock
writer (sale, challan, return, purchase, debit note) moves the same figure:
`qty × unit_factor`, in the item's own unit, which is always the smallest.

Costs follow the same rule. A sales line's `unit_cost_snapshot` is per LINE
unit (a box's cost), because profit and item-trade reports multiply it by the
line's own qty; the movement it came from is per base unit. A purchase line's
inbound cost is per line unit too, and the movement takes it ÷ factor.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

ONE = Decimal("1")


@dataclass(frozen=True)
class LineUnit:
    code: str
    factor: Decimal
    #: The extra unit's own selling price, when it has one.
    price: Decimal | None
    allow_decimal: bool


def extra_units(items: list[Any]) -> dict[tuple[Any, str], Any]:
    """`{(item_id, unit_code): ItemUnit}` for the items on a document, one query."""
    from apps.inventory.models import ItemUnit

    ids = [item.id for item in items if item is not None]
    if not ids:
        return {}
    return {
        (row.item_id, row.unit.code): row
        for row in ItemUnit.objects.filter(item_id__in=ids).select_related("unit")
    }


def resolve(item: Any, unit_code: str | None, extras: dict[tuple[Any, str], Any]) -> LineUnit:
    """The line's unit and how many base units one of it is.

    A code the item is not sold in falls back to factor 1, as every line did
    before units existed: an old client sending the base code (or a free-text
    line) behaves exactly as before.
    """
    if item is None:
        return LineUnit(code=(unit_code or "NOS")[:8], factor=ONE, price=None, allow_decimal=True)
    code = (unit_code or item.unit.code)[:8]
    extra = extras.get((item.id, code))
    if extra is None:
        return LineUnit(code=code, factor=ONE, price=None, allow_decimal=item.unit.allow_decimal)
    return LineUnit(
        code=code,
        factor=extra.factor,
        price=extra.selling_price,
        allow_decimal=extra.unit.allow_decimal,
    )


def base_qty(row: dict) -> Decimal:
    """A built line's quantity in the item's own unit."""
    return Decimal(row["qty"]) * Decimal(row.get("unit_factor") or ONE)


def per_line_unit(base_cost: Decimal | None, row: dict) -> Decimal | None:
    if base_cost is None:
        return None
    return base_cost * Decimal(row.get("unit_factor") or ONE)


def per_base_unit(line_cost: Decimal | None, row: dict) -> Decimal | None:
    if line_cost is None:
        return None
    return (Decimal(line_cost) / Decimal(row.get("unit_factor") or ONE)).quantize(Decimal("0.0001"))


MAX_EXTRA_UNITS = 5


def set_units(*, ctx: Any, item: Any, raw: Any) -> None:
    """Replace the item's other units with `raw` (the item form's "Also sold as").

    Each is `{unit_id, factor, barcode?, selling_price?}`. A unit is a multiple
    of the item's own unit (factor above 1), never the item's own unit, never
    twice; a barcode is free across items and units. A factor can change after
    sales: every line keeps the factor it was written with.
    """
    from apps.common.exceptions import ValidationFailed
    from apps.inventory.models import Item, ItemUnit, Unit

    if raw is None:
        return
    if not isinstance(raw, list) or len(raw) > MAX_EXTRA_UNITS:
        raise ValidationFailed({"units": [f"Add up to {MAX_EXTRA_UNITS} other units."]})
    errors: dict = {}
    rows = []
    seen: set = set()
    codes: set = set()
    for index, entry in enumerate(raw):
        path = f"units.{index}"
        entry = entry if isinstance(entry, dict) else {}
        unit = Unit.objects.filter(pk=entry.get("unit_id")).first() if entry.get("unit_id") else None
        if unit is None or (unit.tenant_id not in (None, ctx.tenant.id)):
            errors[f"{path}.unit_id"] = ["Choose a unit."]
            continue
        if unit.pk == item.unit_id:
            errors[f"{path}.unit_id"] = ["This is already the item's own unit."]
            continue
        if unit.pk in seen:
            errors[f"{path}.unit_id"] = ["This unit is added twice."]
            continue
        seen.add(unit.pk)
        try:
            factor = Decimal(str(entry.get("factor")))
        except Exception:  # noqa: BLE001 - any unparsable value is the same refusal
            factor = None
        if factor is None or not factor.is_finite() or factor <= 1 or factor > Decimal("100000"):
            errors[f"{path}.factor"] = [f"How many {item.unit.code} in one {unit.code}? More than 1."]
            continue
        if not item.unit.allow_decimal and factor != factor.to_integral_value():
            errors[f"{path}.factor"] = [f"Use a whole number of {item.unit.code}."]
            continue
        barcode = (str(entry.get("barcode") or "").strip() or None)
        if barcode:
            taken = (
                Item.objects.filter(tenant=ctx.tenant, barcode=barcode).exclude(pk=item.pk).exists()
                or ItemUnit.objects.filter(tenant=ctx.tenant, barcode=barcode)
                .exclude(item=item)
                .exists()
                or barcode == item.barcode
                or barcode in codes
            )
            if taken:
                errors[f"{path}.barcode"] = ["Another item or unit already has this barcode."]
                continue
            codes.add(barcode)
        price = entry.get("selling_price")
        try:
            price = Decimal(str(price)) if price not in (None, "") else None
        except Exception:  # noqa: BLE001
            price = Decimal("-1")
        if price is not None and (not price.is_finite() or price < 0):
            errors[f"{path}.selling_price"] = ["Enter a price of zero or more."]
            continue
        rows.append(
            ItemUnit(
                tenant=ctx.tenant,
                item=item,
                unit=unit,
                factor=factor.quantize(Decimal("0.001")),
                barcode=barcode,
                selling_price=price.quantize(Decimal("0.01")) if price is not None else None,
            )
        )
    if errors:
        raise ValidationFailed(errors)
    ItemUnit.objects.filter(item=item).delete()
    ItemUnit.objects.bulk_create(rows)
