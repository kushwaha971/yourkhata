"""G2a — a jeweller's tags: one piece each, priced by its weight (design D3/D5).

A tag is a `Serial` on an item that tracks serials, plus its `TagDetail`. Adding
a tag outside a purchase (a piece already in the shop) puts one piece into
stock through a stock adjustment in the same transaction, so the item's stock
and its in-stock tags can never disagree (the serial engine's rule, D P3).
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from typing import Any

from django.db import transaction

from apps.common.context import Ctx
from apps.common.dates import tenant_today
from apps.common.exceptions import ValidationFailed
from apps.inventory.models import Item, Serial, TagDetail
from apps.inventory.services.metal_rates import PURITIES

MAKING_TYPES = ("pct", "per_g")
#: A BIS hallmark unique ID: six letters and digits.
HUID = re.compile(r"^[A-Z0-9]{6}$")
#: Net may differ from gross − stone by rounding at the third decimal only.
TOLERANCE = Decimal("0.0005")


def _dec(raw: Any, field: str, errors: dict, *, required: bool, places: int, minimum: Decimal) -> Decimal | None:
    if raw in (None, ""):
        if required:
            errors[field] = ["Enter this."]
        return None
    try:
        value = Decimal(str(raw).replace(",", "").strip())
    except InvalidOperation:
        errors[field] = ["Enter a number."]
        return None
    if not value.is_finite() or value < minimum:
        errors[field] = ["Enter 0 or more." if minimum == 0 else "Enter more than 0."]
    elif value.as_tuple().exponent < -places:  # type: ignore[operator]
        errors[field] = [f"Use at most {places} digits after the point."]
    return value


def _clean(*, tenant: Any, data: dict) -> dict:
    errors: dict[str, list[str]] = {}
    tag_no = str(data.get("tag_no") or "").strip().upper()
    if not tag_no:
        errors["tag_no"] = ["Enter the tag no."]
    elif len(tag_no) > 40:
        errors["tag_no"] = ["Keep the tag no. to 40 characters."]
    elif Serial.objects.filter(tenant=tenant, serial=tag_no).exists():
        errors["tag_no"] = ["This tag no. is already used."]
    purity = data.get("purity")
    if purity not in PURITIES:
        errors["purity"] = ["Choose the metal and purity."]
    gross = _dec(data.get("gross_g"), "gross_g", errors, required=True, places=3, minimum=Decimal("0.001"))
    stone = _dec(data.get("stone_g"), "stone_g", errors, required=False, places=3, minimum=Decimal("0")) or Decimal("0")
    net = _dec(data.get("net_g"), "net_g", errors, required=False, places=3, minimum=Decimal("0.001"))
    if gross is not None and "gross_g" not in errors and "stone_g" not in errors:
        if stone >= gross:
            errors["stone_g"] = ["Stone weight must be less than the gross weight."]
        elif net is None and "net_g" not in errors:
            net = gross - stone
        elif net is not None and "net_g" not in errors and abs(net - (gross - stone)) > TOLERANCE:
            errors["net_g"] = [f"Net should be gross − stone: {gross - stone:.3f} g."]
    making_type = data.get("making_type") or "pct"
    if making_type not in MAKING_TYPES:
        errors["making_type"] = ["Choose % or ₹ per g."]
    making = _dec(data.get("making_value"), "making_value", errors, required=False, places=2, minimum=Decimal("0")) or Decimal("0")
    wastage = _dec(data.get("wastage_pct"), "wastage_pct", errors, required=False, places=2, minimum=Decimal("0")) or Decimal("0")
    if wastage > 100 and "wastage_pct" not in errors:
        errors["wastage_pct"] = ["Wastage is a percentage up to 100."]
    stone_charge = _dec(data.get("stone_charge"), "stone_charge", errors, required=False, places=2, minimum=Decimal("0")) or Decimal("0")
    huid = str(data.get("huid") or "").strip().upper()
    if huid and not HUID.match(huid):
        errors["huid"] = ["HUID is 6 letters and digits from the hallmark."]
    if errors:
        raise ValidationFailed(errors, "Check the tag details.")
    return {
        "tag_no": tag_no,
        "purity": purity,
        "gross_g": gross,
        "stone_g": stone,
        "net_g": net,
        "making_type": making_type,
        "making_value": making,
        "wastage_pct": wastage,
        "stone_charge": stone_charge,
        "huid": huid,
    }


def tag_view(serial: Serial) -> dict:
    detail = getattr(serial, "tag", None)
    return {
        "id": str(serial.id),
        "tag_no": serial.serial,
        "status": serial.status,
        "sold_on": serial.sold_on.isoformat() if serial.sold_on else None,
        "purity": detail.purity if detail else None,
        "gross_g": f"{detail.gross_g:.3f}" if detail else None,
        "stone_g": f"{detail.stone_g:.3f}" if detail else None,
        "net_g": f"{detail.net_g:.3f}" if detail else None,
        "making_type": detail.making_type if detail else None,
        "making_value": f"{detail.making_value:.2f}" if detail else None,
        "wastage_pct": f"{detail.wastage_pct:.2f}" if detail else None,
        "stone_charge": f"{detail.stone_charge:.2f}" if detail else None,
        "huid": detail.huid if detail else "",
    }


def _metal_value(tenant: Any, clean: dict) -> Decimal:
    """What a piece already in the shop is held at: its net weight at today's
    rate for its purity (G1), or 0 before a rate is set. The design's tag form
    asks no cost; a piece BOUGHT comes in through a purchase at its price."""
    from apps.inventory.models import MetalRate

    rate = MetalRate.objects.filter(tenant=tenant, day=tenant_today(tenant)).values_list(clean["purity"], flat=True).first()
    return (clean["net_g"] * rate).quantize(Decimal("0.0001")) if rate else Decimal("0")


@transaction.atomic
def add_tag(*, ctx: Ctx, item: Item, data: dict) -> dict:
    """One piece into stock with its tag; the item must keep serials (tags)."""
    from apps.inventory.services.adjustments import post_adjustment

    if item.tracking != "serial":
        raise ValidationFailed({"tag_no": ["This item does not keep tags."]}, "Check the tag details.")
    clean = _clean(tenant=ctx.tenant, data=data)
    adjustment = post_adjustment(
        ctx=ctx,
        payload={
            "adjustment_date": tenant_today(ctx.tenant).isoformat(),
            "reason": "other",
            "note": f"Tag {clean['tag_no']} added",
            "lines": [{"item_id": str(item.id), "qty": "1", "unit_cost": str(_metal_value(ctx.tenant, clean))}],
        },
    )
    serial = Serial.objects.create(
        tenant=ctx.tenant, item=item, serial=clean.pop("tag_no"), purchase_document_id=adjustment.id
    )
    TagDetail.objects.create(tenant=ctx.tenant, serial=serial, **clean)
    return tag_view(serial)


def item_tags(*, tenant: Any, item: Item) -> list[dict]:
    """The item page's "Weight and rate" tab: in stock first, then sold, newest first."""
    rows = Serial.objects.filter(tenant=tenant, item=item).select_related("tag").order_by("status", "-created_at")
    return [tag_view(s) for s in rows]


def in_stock_count(*, tenant: Any) -> int:
    """Items list chip "Tags in stock · N"."""
    return Serial.objects.filter(tenant=tenant, status=Serial.IN_STOCK, tag__isnull=False).count()


# ── G2b: a tag on a bill, priced by its weight (design D1/D2 jewellery line) ──

TWO = Decimal("0.01")


def rate_today(*, tenant: Any, purity: str) -> Decimal | None:
    """Today's G1 rate per gram for a purity, or None before it is set."""
    from apps.inventory.models import MetalRate

    if purity not in PURITIES:
        return None
    return MetalRate.objects.filter(tenant=tenant, day=tenant_today(tenant)).values_list(purity, flat=True).first()


def price_piece(
    *, net_g: Decimal, rate: Decimal, making_type: str, making_value: Decimal, wastage_pct: Decimal, stone_charge: Decimal
) -> dict[str, Decimal]:
    """Metal = net × rate; making is a % of the metal or ₹ per net gram; wastage
    is a % of the metal; the stone charge is added as it is. Each part is
    rounded to the paisa, and the total is their sum, so the printed parts
    always add up to the printed total. GST is on the bill, not here."""
    metal = (net_g * rate).quantize(TWO)
    making = (metal * making_value / 100).quantize(TWO) if making_type == "pct" else (net_g * making_value).quantize(TWO)
    wastage = (metal * wastage_pct / 100).quantize(TWO)
    stone = stone_charge.quantize(TWO)
    return {"metal": metal, "making": making, "wastage": wastage, "stone": stone, "total": metal + making + wastage + stone}


def _snapshot(detail: dict, rate: Decimal | None) -> dict:
    parts = (
        price_piece(
            net_g=detail["net_g"],
            rate=rate,
            making_type=detail["making_type"],
            making_value=detail["making_value"],
            wastage_pct=detail["wastage_pct"],
            stone_charge=detail["stone_charge"],
        )
        if rate is not None
        else None
    )
    return {
        "tag_no": detail["tag_no"],
        "purity": detail["purity"],
        "gross_g": f"{detail['gross_g']:.3f}",
        "stone_g": f"{detail['stone_g']:.3f}",
        "net_g": f"{detail['net_g']:.3f}",
        "rate": f"{rate:.2f}" if rate is not None else None,
        "making_type": detail["making_type"],
        "making_value": f"{detail['making_value']:.2f}",
        "wastage_pct": f"{detail['wastage_pct']:.2f}",
        "stone_charge": f"{detail['stone_charge']:.2f}",
        "huid": detail["huid"],
        **({k: f"{v:.2f}" for k, v in parts.items()} if parts else {}),
    }


def _detail_of(serial: Serial) -> dict:
    d = serial.tag
    return {
        "tag_no": serial.serial,
        "purity": d.purity,
        "gross_g": d.gross_g,
        "stone_g": d.stone_g,
        "net_g": d.net_g,
        "making_type": d.making_type,
        "making_value": d.making_value,
        "wastage_pct": d.wastage_pct,
        "stone_charge": d.stone_charge,
        "huid": d.huid,
    }


def lookup(*, tenant: Any, tag_no: str) -> dict | None:
    """A scanned tag label → the item and the line it makes at today's rate.

    Only a tag in stock is found: a sold piece cannot be billed twice."""
    serial = (
        Serial.objects.filter(tenant=tenant, serial=str(tag_no or "").strip().upper(), status=Serial.IN_STOCK, tag__isnull=False)
        .select_related("tag", "item", "item__unit")
        .first()
    )
    if serial is None:
        return None
    detail = _detail_of(serial)
    return {
        "item_id": str(serial.item_id),
        "item_name": serial.item.name,
        "unit_code": serial.item.unit.code,
        "tax_code": serial.item.tax_code,
        "hsn_sac": serial.item.hsn_sac,
        "jewel": _snapshot(detail, rate_today(tenant=tenant, purity=detail["purity"])),
    }


def line_jewel(*, tenant: Any, item: Any, serials: list, raw: Any, path: str, errors: dict) -> dict | None:
    """The `jewel` snapshot of a bill line, and so its price (one piece).

    The tag's own weights and charges are the defaults; the counter may change
    the net weight, rate, making or wastage on the line (design D2), which
    changes this bill and never the tag. The rate defaults to today's and,
    once written on the line, stays: an issued bill is never repriced."""
    if not isinstance(raw, dict) or item is None or getattr(item, "tracking", None) != "serial":
        return None
    tag_no = str((serials or [None])[0] or raw.get("tag_no") or "").strip().upper()
    serial = Serial.objects.filter(tenant=tenant, item=item, serial=tag_no).select_related("tag").first()
    if serial is None or getattr(serial, "tag", None) is None:
        errors[f"{path}.serials"] = ["Scan a tag of this item."]
        return None
    detail = _detail_of(serial)
    local: dict[str, list[str]] = {}
    for name, places in (("net_g", 3), ("making_value", 2), ("wastage_pct", 2), ("stone_charge", 2)):
        if raw.get(name) not in (None, ""):
            value = _dec(raw.get(name), name, local, required=False, places=places, minimum=Decimal("0.001") if name == "net_g" else Decimal("0"))
            if value is not None and name not in local:
                detail[name] = value
    if raw.get("making_type") in MAKING_TYPES:
        detail["making_type"] = raw["making_type"]
    rate = _dec(raw.get("rate"), "rate", local, required=False, places=2, minimum=Decimal("0.01")) if raw.get("rate") not in (None, "") else None
    if rate is None and "rate" not in local:
        rate = rate_today(tenant=tenant, purity=detail["purity"])
        if rate is None:
            local["rate"] = ["Set today's rate first."]
    if detail["wastage_pct"] > 100 and "wastage_pct" not in local:
        local["wastage_pct"] = ["Wastage is a percentage up to 100."]
    for name, messages in local.items():
        errors[f"{path}.jewel.{name}"] = messages
    if local:
        return None
    return _snapshot(detail, rate)
