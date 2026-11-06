"""D P2 — a garment in sizes and colours (design D3, plan §P2).

`create_variants` makes one Product and one ordinary Item per size × colour
("Cotton shirt · Blue · M"), each with its own SKU, stock and (optional)
opening stock, in one transaction. Nothing downstream changes: a bill line is
an item, a return is an item, a report is items.
"""

from __future__ import annotations

from itertools import product as cartesian
from typing import Any

from django.db import transaction

from apps.common.context import Ctx
from apps.common.exceptions import ValidationFailed
from apps.inventory.models import Product
from apps.inventory.services.parsing import clean_text

MAX_VALUES = 12
MAX_VARIANTS = 60
KEYS = ("colour", "size")


def _values(raw: Any, path: str, errors: dict) -> list[str]:
    if raw in (None, ""):
        return []
    if not isinstance(raw, list):
        errors[path] = ["Send a list."]
        return []
    out: list[str] = []
    for value in raw:
        text = clean_text(value or "")[:24]
        if text and text.lower() not in {v.lower() for v in out}:
            out.append(text)
    if len(out) > MAX_VALUES:
        errors[path] = [f"Up to {MAX_VALUES}."]
    return out


@transaction.atomic
def create_variants(*, ctx: Ctx, payload: dict) -> dict:
    """`payload` is an item body plus `variants: {sizes: [...], colours: [...]}`.

    Returns `{product, items, warnings}`. The body's barcode and opening stock
    belong to no single size, so they are refused rather than guessed at.
    """
    from apps.inventory.services.items import create_item

    errors: dict = {}
    spec = payload.get("variants") or {}
    sizes = _values(spec.get("sizes"), "variants.sizes", errors)
    colours = _values(spec.get("colours"), "variants.colours", errors)
    if not sizes and not colours and not errors:
        errors["variants"] = ["Add at least one size or colour."]
    if payload.get("barcode"):
        errors["barcode"] = ["Each size gets its own code; leave the barcode empty here."]
    if payload.get("opening_stock"):
        errors["opening_stock"] = ["Add opening stock for each size after saving."]
    name = clean_text(payload.get("name") or "")
    if not name:
        errors["name"] = ["Enter the item name."]
    combos = list(cartesian(colours or [None], sizes or [None]))
    if len(combos) > MAX_VARIANTS:
        errors["variants"] = [f"That makes {len(combos)} items; up to {MAX_VARIANTS}."]
    if errors:
        raise ValidationFailed(errors)

    product = Product.objects.create(
        tenant=ctx.tenant,
        created_by=ctx.actor if ctx.actor_type == "user" else None,
        name=name,
        attributes={k: v for k, v in (("size", sizes), ("colour", colours)) if v},
    )
    items = []
    warnings: list = []
    base = {k: v for k, v in payload.items() if k not in ("variants", "barcode", "opening_stock", "sku")}
    for colour, size in combos:
        attributes = {k: v for k, v in (("colour", colour), ("size", size)) if v}
        label = " · ".join([name, *[v for v in (colour, size) if v]])
        result = create_item(ctx=ctx, payload={**base, "name": label})
        item = result["item"]
        item.product = product
        item.attributes = attributes
        item.save(update_fields=["product", "attributes", "updated_at"])
        items.append(item)
        warnings.extend(result["warnings"])
    return {"product": product, "items": items, "warnings": warnings}
