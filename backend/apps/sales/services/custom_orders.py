"""G3a — a jeweller's custom orders (design G3): what to make, for whom, by
when, and an advance that may fix the rate. See `models.CustomOrder`."""

from __future__ import annotations

import datetime as dt
import uuid
from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q, Sum

from apps.common.context import Ctx
from apps.common.dates import tenant_today
from apps.common.exceptions import BusinessRuleViolation, NotFound, ValidationFailed
from apps.sales.models import CustomOrder

MONEY_MODES = ("cash", "upi", "bank", "cheque", "card")
#: Each status and where it may go next.
NEXT = {
    CustomOrder.OPEN: (CustomOrder.READY, CustomOrder.CANCELLED),
    CustomOrder.READY: (CustomOrder.DELIVERED, CustomOrder.CANCELLED),
}


def _with_karigar(order: CustomOrder) -> dict | None:
    """G3b — "With Raju · 18.2 g issued": whose hands this order's gold is in."""
    lots = [x for x in order.lots.all() if x.received_g is None]
    if not lots:
        return None
    return {"name": lots[0].karigar.name, "issued_g": f"{sum(x.issued_g for x in lots):.3f}"}


def view(order: CustomOrder) -> dict:
    return {
        "id": str(order.id),
        "number": order.number,
        "party": {"id": str(order.party_id), "name": order.party.name, "mobile": order.party.mobile},
        "what": order.what,
        "approx_weight_g": f"{order.approx_weight_g:.3f}" if order.approx_weight_g is not None else None,
        "purity": order.purity,
        "deliver_on": order.deliver_on.isoformat(),
        "advance": f"{order.advance:.2f}",
        "advance_payment_id": str(order.advance_payment_id) if order.advance_payment_id else None,
        "fixed_rate": f"{order.fixed_rate:.2f}" if order.fixed_rate is not None else None,
        "status": order.status,
        "invoice_id": str(order.invoice_id) if order.invoice_id else None,
        "with_karigar": _with_karigar(order),
    }


def _clean(*, ctx: Ctx, data: dict) -> dict:
    from apps.inventory.services.metal_rates import PURITIES
    from apps.inventory.services.tags import _dec, rate_today
    from apps.parties.models import Party

    errors: dict[str, list[str]] = {}
    party = None
    try:
        party = Party.objects.filter(tenant=ctx.tenant, pk=data.get("party_id"), deleted_at__isnull=True).first()
    except (ValueError, TypeError, ValidationError):  # a malformed id is simply no customer
        party = None
    if party is None:
        errors["party_id"] = ["Choose the customer."]
    what = " ".join(str(data.get("what") or "").split())
    if not what:
        errors["what"] = ["Say what to make."]
    elif len(what) > 200:
        errors["what"] = ["Keep this under 200 characters."]
    weight = _dec(data.get("approx_weight_g"), "approx_weight_g", errors, required=False, places=3, minimum=Decimal("0.001"))
    purity = data.get("purity")
    if purity not in PURITIES:
        errors["purity"] = ["Choose the purity."]
    deliver_on = None
    try:
        deliver_on = dt.date.fromisoformat(str(data.get("deliver_on") or ""))
    except ValueError:
        errors["deliver_on"] = ["Choose the delivery date."]
    if deliver_on is not None and deliver_on < tenant_today(ctx.tenant):
        errors["deliver_on"] = ["The delivery date cannot be in the past."]
    advance = _dec(data.get("advance"), "advance", errors, required=False, places=2, minimum=Decimal("0")) or Decimal("0")
    mode = data.get("advance_mode") or "cash"
    if advance > 0 and mode not in MONEY_MODES:
        errors["advance_mode"] = ["Choose how the advance was paid."]
    fixed = None
    if data.get("fix_rate"):
        if advance <= 0 and "advance" not in errors:
            errors["fix_rate"] = ["The rate is fixed against an advance. Enter the advance."]
        elif purity in PURITIES:
            fixed = rate_today(tenant=ctx.tenant, purity=purity)
            if fixed is None:
                errors["fix_rate"] = ["Set today's rate first."]
    try:
        client_key = uuid.UUID(str(data.get("client_key")))
    except ValueError:
        client_key = uuid.uuid4()
    if errors:
        raise ValidationFailed(errors, "Check the order.")
    return {
        "party": party,
        "what": what,
        "approx_weight_g": weight,
        "purity": purity,
        "deliver_on": deliver_on,
        "advance": advance,
        "mode": mode,
        "fixed_rate": fixed,
        "client_key": client_key,
    }


@transaction.atomic
def create_order(*, ctx: Ctx, data: dict) -> tuple[CustomOrder, bool]:
    """The order and, with an advance, its earmarked receipt. Returns (order, created)."""
    from apps.payments.services.record import record_payment

    clean = _clean(ctx=ctx, data=data)
    # One writer at a time per business: the number is gap-free, and a double
    # tap finds the first tap's order here rather than making a second.
    last = CustomOrder.objects.select_for_update().filter(tenant=ctx.tenant).order_by("-number").first()
    same = CustomOrder.objects.filter(tenant=ctx.tenant, client_key=clean["client_key"]).first()
    if same is not None:
        return same, False
    next_no = int(last.number.split("-")[1]) + 1 if last else 1
    order = CustomOrder.objects.create(
        tenant=ctx.tenant,
        number=f"ORD-{next_no:04d}",
        client_key=clean["client_key"],
        party=clean["party"],
        what=clean["what"],
        approx_weight_g=clean["approx_weight_g"],
        purity=clean["purity"],
        deliver_on=clean["deliver_on"],
        advance=clean["advance"],
        fixed_rate=clean["fixed_rate"],
    )
    if clean["advance"] > 0:
        recorded = record_payment(
            ctx=ctx,
            payload={
                "direction": "in",
                "party_id": str(order.party_id),
                "payment_date": tenant_today(ctx.tenant).isoformat(),
                "mode_breakup": [{"mode": clean["mode"], "amount": str(clean["advance"])}],
                "note": f"Advance for {order.number}",
                "context": "custom_order",
                "bucket": "shop",
                "allocations": [],
                "meta": {
                    "order_number": order.number,
                    "earmark": {"module": "sales", "subject_type": "custom_order", "subject_id": str(order.id)},
                },
            },
        )
        order.advance_payment_id = recorded["payment"].id
        order.save(update_fields=["advance_payment_id"])
    return order, True


@transaction.atomic
def move_order(*, ctx: Ctx, order_id: Any, status: Any) -> CustomOrder:
    """Open → Ready → Delivered, or Cancelled before delivery. Delivering or
    cancelling releases the advance to the customer's open advances."""
    from apps.payments.models import Payment

    order = CustomOrder.objects.select_for_update().select_related("party").filter(tenant=ctx.tenant, pk=order_id).first()
    if order is None:
        raise NotFound("No such order.")
    if status not in NEXT.get(order.status, ()):
        raise BusinessRuleViolation(
            "custom_order_status", "This order cannot move to that status.", details={"status": order.status}
        )
    order.status = status
    order.save(update_fields=["status"])
    if status in (CustomOrder.DELIVERED, CustomOrder.CANCELLED) and order.advance_payment_id:
        payment = Payment.objects.select_for_update().filter(tenant=ctx.tenant, pk=order.advance_payment_id).first()
        if payment is not None:
            payment.meta = {k: v for k, v in (payment.meta or {}).items() if k != "earmark"}
            payment.save(update_fields=["meta"])
    return order


def list_orders(*, tenant: Any, q: str = "", scope: str = "open") -> dict:
    rows = CustomOrder.objects.filter(tenant=tenant).select_related("party").prefetch_related("lots__karigar")
    live = rows.filter(status__in=(CustomOrder.OPEN, CustomOrder.READY))
    summary = live.aggregate(held=Sum("advance"))
    shown = live if scope == "open" else rows
    text = " ".join(str(q or "").split())
    if text:
        shown = shown.filter(Q(number__icontains=text) | Q(party__name__icontains=text) | Q(what__icontains=text))
    return {
        "rows": [view(o) for o in shown.order_by("deliver_on", "number")[:200]],
        "open": live.count(),
        "advance_held": f"{summary['held'] or Decimal('0'):.2f}",
    }


def get_order(*, tenant: Any, order_id: Any) -> CustomOrder:
    order = CustomOrder.objects.select_related("party").filter(tenant=tenant, pk=order_id).first()
    if order is None:
        raise NotFound("No such order.")
    return order


def link_to_draft(*, tenant: Any, document: Any, order_id: Any, errors: dict) -> None:
    """`meta.custom_order` of a draft: which order this bill delivers (null clears it)."""
    meta = {k: v for k, v in (document.meta or {}).items() if k != "custom_order"}
    document.meta = meta
    if not order_id:
        return
    try:
        order = CustomOrder.objects.filter(tenant=tenant, pk=order_id).first()
    except (ValueError, TypeError, ValidationError):
        order = None
    if order is None or order.status not in (CustomOrder.OPEN, CustomOrder.READY):
        errors["custom_order_id"] = ["This order is already finished."]
        return
    document.meta = {
        **meta,
        "custom_order": {
            "id": str(order.id),
            "number": order.number,
            "purity": order.purity,
            "fixed_rate": f"{order.fixed_rate:.2f}" if order.fixed_rate is not None else None,
            "advance": f"{order.advance:.2f}",
        },
    }


def advance_for_issue(*, ctx: Ctx, document: Any) -> tuple[CustomOrder | None, list[str]]:
    """At issue: lock the linked order, refuse if it cannot be delivered by this
    bill, and release its advance so the issue can apply it to this bill."""
    from apps.payments.models import Payment

    link = (document.meta or {}).get("custom_order") or {}
    if not link.get("id"):
        return None, []
    order = CustomOrder.objects.select_for_update().filter(tenant=ctx.tenant, pk=link["id"]).first()
    if order is None or order.status not in (CustomOrder.OPEN, CustomOrder.READY):
        raise BusinessRuleViolation(
            "custom_order_status", "This order is already finished. Remove it from the bill.", details={}
        )
    if order.party_id != document.party_id:
        raise BusinessRuleViolation(
            "custom_order_status", "This bill is for a different customer than the order.", details={}
        )
    if not order.advance_payment_id:
        return order, []
    payment = Payment.objects.select_for_update().filter(tenant=ctx.tenant, pk=order.advance_payment_id).first()
    if payment is None:
        return order, []
    payment.meta = {k: v for k, v in (payment.meta or {}).items() if k != "earmark"}
    payment.save(update_fields=["meta"])
    return order, [str(payment.id)]


def mark_delivered_by(*, order: CustomOrder | None, document: Any) -> None:
    if order is None:
        return
    order.status = CustomOrder.DELIVERED
    order.invoice_id = document.id
    order.save(update_fields=["status", "invoice_id"])
