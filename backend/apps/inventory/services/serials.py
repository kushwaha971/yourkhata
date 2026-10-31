"""D P3 — IMEI / serial numbers for items that track them (plan §P3).

A tracked item (`Item.tracking == "serial"`) still keeps a quantity; the
serials say WHICH pieces. Each document line carries `serials`, one per piece:

* a purchase brings them in (`in_stock`), refusing one already in stock;
* a sale picks them out of stock (`sold`), under a row lock, so the same phone
  cannot be sold twice even from two counters at once;
* a return or a void puts them back; a purchase void takes them out again.

Untracked items never reach this module, so their path is unchanged.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal
from typing import Any

from apps.common.exceptions import BusinessRuleViolation, ValidationFailed

SERIAL_MAX = 40


def tracked(item: Any) -> bool:
    return item is not None and getattr(item, "tracking", "none") == "serial"


def parse(raw: Any, *, item: Any, base_qty: Decimal | None, path: str, errors: dict, strict: bool) -> list[str]:
    """A line's serials: trimmed, upper-cased, unique; on a strict save, one per piece."""
    if not tracked(item):
        return []
    values: list[str] = []
    for entry in raw if isinstance(raw, list) else []:
        text = "".join(str(entry or "").split()).upper()[:SERIAL_MAX]
        if text and text not in values:
            values.append(text)
    if strict and base_qty is not None and Decimal(len(values)) != base_qty:
        errors[f"{path}.serials"] = [f"Enter {base_qty.normalize():f} IMEI / serial numbers ({len(values)} entered)."]
    return values


def _warranty(item: Any, on: dt.date) -> dt.date | None:
    months = getattr(item, "warranty_months", None)
    if not months:
        return None
    year, month = divmod(on.month - 1 + int(months), 12)
    day = min(on.day, 28)
    return dt.date(on.year + year, month + 1, day)


def receive(*, ctx: Any, document: Any, rows: list[dict]) -> None:
    """Purchase recorded: every serial of every tracked row is now in stock."""
    from apps.inventory.models import Serial

    clash: list[str] = []
    for row in rows:
        item = row.get("item")
        for serial in row.get("serials") or []:
            if not tracked(item):
                continue
            existing = Serial.objects.select_for_update().filter(tenant=ctx.tenant, item=item, serial=serial).first()
            if existing is not None and existing.status == Serial.IN_STOCK:
                clash.append(serial)
                continue
            if existing is not None:
                existing.status = Serial.IN_STOCK
                existing.purchase_document_id = document.id
                existing.sales_document_id = None
                existing.sold_on = None
                existing.save()
            else:
                Serial.objects.create(
                    tenant=ctx.tenant,
                    item=item,
                    serial=serial,
                    purchase_document_id=document.id,
                )
    if clash:
        raise BusinessRuleViolation(
            "serial_in_stock",
            "These IMEI / serial numbers are already in stock.",
            details={"serials": clash},
        )


def sell(*, ctx: Any, document: Any, rows: list[dict]) -> None:
    """Bill issued: each serial must be in stock, and is sold now."""
    from apps.inventory.models import Serial

    missing: list[str] = []
    for row in rows:
        item = row.get("item")
        if not tracked(item):
            continue
        for serial in row.get("serials") or []:
            found = (
                Serial.objects.select_for_update()
                .filter(tenant=ctx.tenant, item=item, serial=serial, status=Serial.IN_STOCK)
                .first()
            )
            if found is None:
                missing.append(serial)
                continue
            found.status = Serial.SOLD
            found.sales_document_id = document.id
            found.sold_on = document.document_date
            found.warranty_until = _warranty(item, document.document_date)
            found.save()
    if missing:
        raise BusinessRuleViolation(
            "serial_not_in_stock",
            "These IMEI / serial numbers are not in stock.",
            details={"serials": missing},
        )


def put_back(*, ctx: Any, item_serials: list[tuple[Any, list[str]]]) -> None:
    """A return or a bill's void: the serials are in stock again."""
    from apps.inventory.models import Serial

    for item, serials in item_serials:
        if tracked(item) and serials:
            Serial.objects.filter(tenant=ctx.tenant, item=item, serial__in=serials).update(
                status=Serial.IN_STOCK, sales_document_id=None, sold_on=None, warranty_until=None
            )


def take_out(*, ctx: Any, item_serials: list[tuple[Any, list[str]]]) -> None:
    """A purchase's void or debit note: those serials leave stock."""
    from apps.inventory.models import Serial

    for item, serials in item_serials:
        if tracked(item) and serials:
            Serial.objects.filter(
                tenant=ctx.tenant, item=item, serial__in=serials, status=Serial.IN_STOCK
            ).delete()


def find(*, tenant: Any, code: str) -> dict | None:
    """`GET /serials/{code}` — find by IMEI: the item, whether sold, when, warranty left."""
    from apps.inventory.models import Serial

    text = "".join(str(code or "").split()).upper()
    row = Serial.objects.filter(tenant=tenant, serial=text).select_related("item").first()
    if row is None:
        return None
    from apps.purchases.models import PurchaseDocument
    from apps.sales.models import SalesDocument

    sale = (
        SalesDocument.objects.filter(tenant=tenant, pk=row.sales_document_id).select_related("party").first()
        if row.sales_document_id
        else None
    )
    bought = (
        PurchaseDocument.objects.filter(tenant=tenant, pk=row.purchase_document_id)
        .select_related("party")
        .first()
        if row.purchase_document_id
        else None
    )

    def who(party: Any, walk_in: str | None = None, mobile: str | None = None) -> dict | None:
        if party is not None:
            return {"name": party.name, "mobile": getattr(party, "mobile", None)}
        if walk_in or mobile:
            return {"name": walk_in or "", "mobile": mobile}
        return None

    return {
        "serial": row.serial,
        "status": row.status,
        "item": {"id": str(row.item_id), "name": row.item.name},
        "sold_on": row.sold_on.isoformat() if row.sold_on else None,
        "warranty_until": row.warranty_until.isoformat() if row.warranty_until else None,
        # D8 — "Sold to", "Bill", "Bought from".
        "sale": (
            {
                "id": str(sale.id),
                "number": sale.number,
                "date": sale.document_date.isoformat(),
                "customer": who(sale.party, sale.walk_in_name, sale.walk_in_mobile),
            }
            if sale is not None
            else None
        ),
        "purchase": (
            {
                "id": str(bought.id),
                "number": bought.number,
                "date": bought.document_date.isoformat(),
                "supplier": who(bought.party),
            }
            if bought is not None
            else None
        ),
    }


def refuse_if_untracked_serials(raw: Any, item: Any, path: str) -> None:
    """Serials sent for an item that does not track them are an error, not ignored."""
    if raw and not tracked(item):
        raise ValidationFailed({f"{path}.serials": ["This item does not track IMEI / serial numbers."]})
