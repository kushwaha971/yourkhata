"""G11 — a kirana's phone and WhatsApp orders (design G11 `dPhoneOrders`).

A list a customer sent becomes an order to pack, then a bill, then a delivery.
The order keeps the lines and the list as written; the bill is made from the
lines ("Make bill"), and issuing it moves the order on: out for delivery, or
delivered when the customer picks it up. Nothing is sent to the customer by the
product (DEC-012): replies go out with the share button. See `models.PhoneOrder`.
"""

from __future__ import annotations

import datetime as dt
import re
import uuid
from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.common.context import Ctx
from apps.common.dates import tenant_timezone, tenant_today
from apps.common.exceptions import BusinessRuleViolation, NotFound, ValidationFailed
from apps.sales.models import PhoneOrder
from apps.sales.services.order_lines import clean_lines

FULFIL = ("home", "pickup")
PAY = ("udhaar", "upi", "cash")
LIVE = (PhoneOrder.TO_PACK, PhoneOrder.OUT)
#: Each status and where it may go by hand. A bill moves To pack on by itself.
NEXT = {
    PhoneOrder.TO_PACK: (PhoneOrder.CANCELLED,),
    PhoneOrder.OUT: (PhoneOrder.DELIVERED, PhoneOrder.TO_PACK),
}
LIST_MAX = 2000


def view(order: PhoneOrder) -> dict:
    return {
        "id": str(order.id),
        "number": order.number,
        "party": {"id": str(order.party_id), "name": order.party.name, "mobile": order.party.mobile},
        "lines": list(order.lines or []),
        "list_text": order.list_text or None,
        "total": f"{order.total:.2f}",
        "status": order.status,
        "deliver_by": order.deliver_by.isoformat() if order.deliver_by else None,
        "fulfil": order.fulfil,
        "pay": order.pay,
        "invoice_id": str(order.invoice_id) if order.invoice_id else None,
        "created_at": order.created_at.isoformat(),
    }


def _clean(*, ctx: Ctx, data: dict) -> dict:
    from apps.parties.models import Party

    errors: dict[str, list[str]] = {}
    data = data if isinstance(data, dict) else {}
    party = None
    try:
        party = Party.objects.filter(tenant=ctx.tenant, pk=data.get("party_id"), deleted_at__isnull=True).first()
    except (ValueError, TypeError, ValidationError):
        party = None
    if party is None:
        errors["party_id"] = ["Choose the customer who sent the list."]
    lines, total = clean_lines(ctx.tenant, data.get("lines"), errors)
    deliver_by = None
    if data.get("deliver_by"):
        try:
            deliver_by = dt.datetime.fromisoformat(str(data["deliver_by"]))
        except ValueError:
            errors["deliver_by"] = ["Choose when to deliver."]
        else:
            if timezone.is_naive(deliver_by):
                deliver_by = deliver_by.replace(tzinfo=tenant_timezone(ctx.tenant))
    fulfil = data.get("fulfil") or "home"
    if fulfil not in FULFIL:
        errors["fulfil"] = ["Choose home delivery or pick up."]
    pay = data.get("pay") or "cash"
    if pay not in PAY:
        errors["pay"] = ["Choose how they will pay."]
    try:
        client_key = uuid.UUID(str(data.get("client_key")))
    except (TypeError, ValueError):
        client_key = uuid.uuid4()
    if errors:
        raise ValidationFailed(errors, "Check the order.")
    return {
        "party": party,
        "lines": lines,
        "total": total,
        "list_text": str(data.get("list_text") or "")[:LIST_MAX],
        "deliver_by": deliver_by,
        "fulfil": fulfil,
        "pay": pay,
        "client_key": client_key,
    }


@transaction.atomic
def create_order(*, ctx: Ctx, data: dict) -> tuple[PhoneOrder, bool]:
    clean = _clean(ctx=ctx, data=data)
    # One writer at a time per business: the number is gap-free, and a double
    # tap finds the first tap's order here rather than making a second.
    last = PhoneOrder.objects.select_for_update().filter(tenant=ctx.tenant).order_by("-created_at").first()
    same = PhoneOrder.objects.filter(tenant=ctx.tenant, client_key=clean["client_key"]).first()
    if same is not None:
        return same, False
    next_no = int(last.number.split("-")[1]) + 1 if last else 1
    order = PhoneOrder.objects.create(
        tenant=ctx.tenant,
        number=f"ORD-{next_no:04d}",
        client_key=clean["client_key"],
        party=clean["party"],
        lines=clean["lines"],
        list_text=clean["list_text"],
        total=clean["total"],
        deliver_by=clean["deliver_by"],
        fulfil=clean["fulfil"],
        pay=clean["pay"],
    )
    return order, True


@transaction.atomic
def move_order(*, ctx: Ctx, order_id: Any, status: Any) -> PhoneOrder:
    order = _lock(ctx, order_id)
    if status not in NEXT.get(order.status, ()):
        raise BusinessRuleViolation(
            "phone_order_status", "This order cannot move to that status.", details={"status": order.status}
        )
    order.status = status
    order.delivered_at = timezone.now() if status == PhoneOrder.DELIVERED else None
    order.save(update_fields=["status", "delivered_at", "updated_at"])
    return order


def _lock(ctx: Ctx, order_id: Any) -> PhoneOrder:
    try:
        order = (
            PhoneOrder.objects.select_for_update(of=("self",))
            .select_related("party")
            .filter(tenant=ctx.tenant, pk=order_id)
            .first()
        )
    except (ValueError, TypeError, ValidationError):
        order = None
    if order is None:
        raise NotFound("No such order.")
    return order


def get_order(*, tenant: Any, order_id: Any) -> PhoneOrder:
    try:
        order = PhoneOrder.objects.select_related("party").filter(tenant=tenant, pk=order_id).first()
    except (ValueError, TypeError, ValidationError):
        order = None
    if order is None:
        raise NotFound("No such order.")
    return order


def list_orders(*, tenant: Any, q: str = "", stage: str = "to_pack") -> dict:
    zone = tenant_timezone(tenant)
    start = dt.datetime.combine(tenant_today(tenant), dt.time.min, tzinfo=zone)
    rows = PhoneOrder.objects.filter(tenant=tenant).select_related("party")
    today_done = Q(status=PhoneOrder.DELIVERED, delivered_at__gte=start)
    counts = rows.aggregate(
        to_pack=Count("id", filter=Q(status=PhoneOrder.TO_PACK)),
        out=Count("id", filter=Q(status=PhoneOrder.OUT)),
        delivered=Count("id", filter=today_done),
    )
    shown = {
        "to_pack": rows.filter(status=PhoneOrder.TO_PACK).order_by("deliver_by", "created_at"),
        "out": rows.filter(status=PhoneOrder.OUT).order_by("deliver_by", "created_at"),
        "delivered": rows.filter(today_done).order_by("-delivered_at"),
    }.get(stage, rows.filter(status=PhoneOrder.TO_PACK))
    text = " ".join(str(q or "").split())
    if text:
        shown = shown.filter(Q(number__icontains=text) | Q(party__name__icontains=text) | Q(party__mobile__icontains=text))
    return {"rows": [view(o) for o in shown[:200]], "counts": counts}


def link_to_draft(*, tenant: Any, document: Any, order_id: Any, errors: dict) -> None:
    """`meta.phone_order` of a draft: which order this bill is for (null clears it)."""
    meta = {k: v for k, v in (document.meta or {}).items() if k != "phone_order"}
    document.meta = meta
    if not order_id:
        return
    try:
        order = PhoneOrder.objects.filter(tenant=tenant, pk=order_id).first()
    except (ValueError, TypeError, ValidationError):
        order = None
    if order is None or order.status != PhoneOrder.TO_PACK:
        errors["phone_order_id"] = ["This order already has its bill."]
        return
    document.meta = {**meta, "phone_order": {"id": str(order.id), "number": order.number}}


def order_for_issue(*, ctx: Ctx, document: Any) -> PhoneOrder | None:
    """At issue: lock the linked order and refuse a second bill or another customer."""
    link = (document.meta or {}).get("phone_order") or {}
    if not link.get("id"):
        return None
    order = PhoneOrder.objects.select_for_update().filter(tenant=ctx.tenant, pk=link["id"]).first()
    if order is None or order.status != PhoneOrder.TO_PACK:
        raise BusinessRuleViolation("phone_order_status", "This order already has its bill. Remove it from this bill.", details={})
    if order.party_id != document.party_id:
        raise BusinessRuleViolation("phone_order_status", "This bill is for a different customer than the order.", details={})
    return order


def mark_billed_by(*, order: PhoneOrder | None, document: Any) -> None:
    """A home delivery goes out with its bill; a pick-up is handed over there and then."""
    if order is None:
        return
    order.invoice_id = document.id
    if order.fulfil == "pickup":
        order.status, order.delivered_at = PhoneOrder.DELIVERED, timezone.now()
    else:
        order.status = PhoneOrder.OUT
    order.save(update_fields=["invoice_id", "status", "delivered_at", "updated_at"])


# ── "Paste a WhatsApp list" ───────────────────────────────────────────────────

#: "5kg", "1 litre", "500 g", "2 packet" — a number and the unit it was asked in.
#: The number stands on its own: the "11" in "QA11" or the "5" in "Surf 5in1" is a name.
_QTY = re.compile(
    r"(?<![\w.])(?P<qty>\d+(?:\.\d+)?)\s*(?P<unit>kgs?|kilo|g|gm|gms|grams?|l|ltr|litres?|liters?|ml|pcs?|pc|nos|packets?|pkts?|pkt)?\b",
    re.IGNORECASE,
)
#: The unit the customer wrote → (the item unit it fits, how many of that unit).
_UNIT = {
    "kg": ("KGS", Decimal("1")), "kgs": ("KGS", Decimal("1")), "kilo": ("KGS", Decimal("1")),
    "g": ("KGS", Decimal("0.001")), "gm": ("KGS", Decimal("0.001")), "gms": ("KGS", Decimal("0.001")),
    "gram": ("KGS", Decimal("0.001")), "grams": ("KGS", Decimal("0.001")),
    "l": ("LTR", Decimal("1")), "ltr": ("LTR", Decimal("1")), "litre": ("LTR", Decimal("1")),
    "litres": ("LTR", Decimal("1")), "liter": ("LTR", Decimal("1")), "liters": ("LTR", Decimal("1")),
    "ml": ("LTR", Decimal("0.001")),
}
_SPLIT = re.compile(r"[\n,;]+")


def read_list(*, tenant: Any, text: Any) -> dict:
    """Read "atta 5kg, tel 1 litre" against this business's items.

    Each piece is a name and a quantity; a piece whose words all appear in
    exactly one item's name is matched, and grams and millilitres become the
    item's kg or litre. Anything else is returned as it was written, to ask
    about — a guess between two items would put the wrong one on the bill.
    """
    from apps.inventory.models import Item

    raw = str(text or "")[:LIST_MAX]
    items = list(
        Item.objects.select_related("unit")
        .filter(tenant=tenant, status="active", deleted_at__isnull=True)
        .only("id", "name", "selling_price", "unit__code")[:5000]
    )
    matched: list[dict] = []
    unmatched: list[str] = []
    for piece in (p.strip(" -•*\t") for p in _SPLIT.split(raw)):
        if not piece:
            continue
        # The last quantity is the one asked for: "Fortune oil 1 litre 2" is two of them.
        found = next(reversed(list(_QTY.finditer(piece))), None)
        qty, unit = Decimal("1"), None
        name = piece
        if found:
            qty = Decimal(found.group("qty"))
            unit = (found.group("unit") or "").lower() or None
            name = (piece[: found.start()] + " " + piece[found.end() :]).strip()
        words = [w for w in re.split(r"\W+", name.lower()) if w]
        hits = [i for i in items if words and all(w in i.name.lower() for w in words)]
        if len(hits) != 1 or qty <= 0:
            unmatched.append(piece)
            continue
        item = hits[0]
        if unit in _UNIT and _UNIT[unit][0] == item.unit.code:
            qty = qty * _UNIT[unit][1]
        matched.append(
            {
                "item_id": str(item.id),
                "name": item.name,
                "qty": f"{qty.quantize(Decimal('0.001')).normalize():f}",
                "rate": f"{item.selling_price:.2f}",
                "unit": item.unit.code,
                "from": piece,
            }
        )
    return {"matched": matched, "unmatched": unmatched}

