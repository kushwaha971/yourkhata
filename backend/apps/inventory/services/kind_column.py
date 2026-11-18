"""The Items list's one kind-specific column (design D4, `t.col`).

A business sees the column its features call for, and only that one: a tag's
weight for a jeweller, the nearest expiry for a medical store. The lines are read
for the page in one query per kind, and an item with nothing to say gets None.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from apps.inventory.models import Batch, ItemAddon, ItemCode, ItemStock, ItemUnit, Serial
from apps.platform_app.selectors.business_words import features_of

#: First match wins, so a kind with several of these shows the design's own.
ORDER = ("jewellery", "batches", "serials", "part_numbers", "godowns", "alt_units", "variants", "addons")
_PURITY = {"gold_24k": "24K", "gold_22k": "22K", "gold_18k": "18K", "silver": "999", "silver_925": "925"}


def column_of(tenant: Any) -> str | None:
    features = features_of(tenant)
    return next((key for key in ORDER if key in features), None)


def _qty(value: Any) -> str:
    return f"{value:f}".rstrip("0").rstrip(".") if "." in f"{value:f}" else f"{value:f}"


def _tags(ids: list) -> dict:
    rows = (
        Serial.objects.filter(item_id__in=ids, status=Serial.IN_STOCK, tag__isnull=False)
        .select_related("tag")
        .order_by("item_id", "-created_at")
    )
    grouped: dict = defaultdict(list)
    for row in rows:
        grouped[row.item_id].append(row)
    out = {}
    for item_id, tags in grouped.items():
        first = tags[0]
        line = f"{first.serial} · {first.tag.net_g:.3f} g · {_PURITY.get(first.tag.purity, first.tag.purity)}"
        out[item_id] = f"{line} · +{len(tags) - 1}" if len(tags) > 1 else line
    return out


def _batches(ids: list) -> dict:
    grouped: dict = defaultdict(list)
    for row in Batch.objects.filter(item_id__in=ids, qty__gt=0).order_by("expiry"):
        grouped[row.item_id].append(row)
    return {
        item_id: {"expiry": rows[0].expiry.strftime("%m/%y"), "batches": len(rows)}
        for item_id, rows in grouped.items()
    }


def _imei(ids: list) -> dict:
    counts: dict = defaultdict(int)
    for item_id in Serial.objects.filter(item_id__in=ids, status=Serial.IN_STOCK).values_list("item_id", flat=True):
        counts[item_id] += 1
    return {item_id: {"count": n} for item_id, n in counts.items()}


def _addons(ids: list) -> dict:
    grouped: dict = defaultdict(list)
    for row in ItemAddon.objects.filter(item_id__in=ids).order_by("position", "name"):
        grouped[row.item_id].append(row.name)
    return {item_id: ", ".join(names) for item_id, names in grouped.items()}


def _units(ids: list) -> dict:
    grouped: dict = defaultdict(list)
    for row in ItemUnit.objects.filter(item_id__in=ids).select_related("unit", "item__unit"):
        grouped[row.item_id].append(f"{row.unit.code} ({_qty(row.factor)} {row.item.unit.code})")
    return {item_id: ", ".join(parts) for item_id, parts in grouped.items()}


def _godowns(ids: list) -> dict:
    out: dict = defaultdict(lambda: {"shop": "0", "godown": "0"})
    for row in ItemStock.objects.filter(item_id__in=ids).select_related("location"):
        out[row.item_id]["shop" if row.location.is_default else "godown"] = _qty(row.on_hand)
    return dict(out)


def lines(*, key: str | None, items: list) -> dict[str, Any]:
    """Item id → that item's cell, for the items on this page."""
    ids = [item.id for item in items]
    if not key or not ids:
        return {}
    if key == "part_numbers":
        codes: dict = {}
        for row in ItemCode.objects.filter(item_id__in=ids).order_by("code"):
            codes.setdefault(row.item_id, row.code)
        found = {
            item.id: {"part": codes.get(item.id), "rack": item.rack}
            for item in items
            if codes.get(item.id) or item.rack
        }
    elif key == "variants":
        found = {item.id: item.attributes for item in items if item.attributes}
    else:
        found = {"jewellery": _tags, "batches": _batches, "serials": _imei, "godowns": _godowns, "alt_units": _units, "addons": _addons}[key](ids)
    return {str(item_id): value for item_id, value in found.items()}
