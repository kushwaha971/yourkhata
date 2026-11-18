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
        return {"name": order.karigar.name, "issued_g": None} if order.karigar_id else None
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
        "karigar_id": str(order.karigar_id) if order.karigar_id else None,
        "photo_id": str(order.photo_id) if order.photo_id else None,
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
    karigar = None
    if data.get("karigar_id"):
        from apps.sales.models import Karigar

        try:
            karigar = Karigar.objects.filter(tenant=ctx.tenant, pk=data["karigar_id"]).first()
        except (ValueError, TypeError, ValidationError):
            karigar = None
        if karigar is None:
            errors["karigar_id"] = ["Choose a karigar from the list."]
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
        "karigar": karigar,
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
        karigar=clean["karigar"],
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


def list_orders(*, tenant: Any, q: str = "", scope: str = "open", karigar: str = "") -> dict:
    rows = CustomOrder.objects.filter(tenant=tenant).select_related("party", "karigar").prefetch_related("lots__karigar")
    live = rows.filter(status__in=(CustomOrder.OPEN, CustomOrder.READY))
    summary = live.aggregate(held=Sum("advance"))
    shown = live if scope == "open" else rows
    text = " ".join(str(q or "").split())
    if text:
        shown = shown.filter(Q(number__icontains=text) | Q(party__name__icontains=text) | Q(what__icontains=text))
    if karigar:
        try:
            shown = shown.filter(lots__karigar_id=uuid.UUID(str(karigar))).distinct()
        except ValueError:
            shown = shown.none()
    return {
        "rows": [view(o) for o in shown.order_by("deliver_on", "number")[:200]],
        "open": live.count(),
        "advance_held": f"{summary['held'] or Decimal('0'):.2f}",
    }


def get_order(*, tenant: Any, order_id: Any) -> CustomOrder:
    order = CustomOrder.objects.select_related("party", "karigar").filter(tenant=tenant, pk=order_id).first()
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


@transaction.atomic
def update_order(*, ctx: Ctx, order_id: Any, data: dict) -> CustomOrder:
    """What to make, weight, date and karigar, while the order is live. The
    customer, advance and fixed rate are money already taken, so they stay."""
    from apps.common.audit import AuditAction, write_audit
    from apps.inventory.services.tags import _dec
    from apps.sales.models import Karigar

    order = CustomOrder.objects.select_for_update(of=("self",)).select_related("party", "karigar").filter(tenant=ctx.tenant, pk=order_id).first()
    if order is None:
        raise NotFound("No such order.")
    if order.status not in (CustomOrder.OPEN, CustomOrder.READY):
        raise BusinessRuleViolation("custom_order_status", "This order is already finished.", details={})
    before = view(order)
    errors: dict[str, list[str]] = {}
    what = " ".join(str(data.get("what", order.what) or "").split())
    if not what:
        errors["what"] = ["Say what to make."]
    elif len(what) > 200:
        errors["what"] = ["Keep this under 200 characters."]
    weight = order.approx_weight_g
    if "approx_weight_g" in data:
        weight = _dec(data.get("approx_weight_g"), "approx_weight_g", errors, required=False, places=3, minimum=Decimal("0.001"))
    deliver_on = order.deliver_on
    if "deliver_on" in data:
        try:
            deliver_on = dt.date.fromisoformat(str(data.get("deliver_on") or ""))
        except ValueError:
            errors["deliver_on"] = ["Choose the delivery date."]
    karigar = order.karigar
    if "karigar_id" in data:
        karigar = None
        if data.get("karigar_id"):
            try:
                karigar = Karigar.objects.filter(tenant=ctx.tenant, pk=data["karigar_id"]).first()
            except (ValueError, TypeError, ValidationError):
                karigar = None
            if karigar is None:
                errors["karigar_id"] = ["Choose a karigar from the list."]
    if errors:
        raise ValidationFailed(errors, "Check the order.")
    order.what, order.approx_weight_g, order.deliver_on, order.karigar = what, weight, deliver_on, karigar
    order.save(update_fields=["what", "approx_weight_g", "deliver_on", "karigar"])
    write_audit(ctx=ctx, action=AuditAction.CUSTOM_ORDER_UPDATED, entity_type="custom_order", entity_id=order.id, before=before, after=view(order))
    return order


def jewel_home(*, tenant: Any) -> dict:
    """D12's strip for a jeweller: today's 22K rate, orders due, old gold this month."""
    from apps.inventory.models import MetalRate, OldGold

    today = tenant_today(tenant)
    rate = MetalRate.objects.filter(tenant=tenant, day=today).first()
    live = CustomOrder.objects.filter(tenant=tenant, status__in=(CustomOrder.OPEN, CustomOrder.READY))
    due = live.filter(deliver_on__lte=today + dt.timedelta(days=7))
    with_karigar = due.filter(lots__received_g__isnull=True, lots__isnull=False).distinct().count()
    grams = OldGold.objects.filter(tenant=tenant, taken_on__year=today.year, taken_on__month=today.month).aggregate(g=Sum("weight_g"))["g"]
    return {
        "gold_22k": f"{rate.gold_22k:.2f}" if rate and rate.gold_22k is not None else None,
        "silver": f"{rate.silver:.2f}" if rate and rate.silver is not None else None,
        "orders_due": due.count(),
        "orders_with_karigar": with_karigar,
        "old_gold_month_g": f"{grams or Decimal('0'):.3f}",
    }


def old_gold_page(*, tenant: Any) -> dict:
    """G2's old-gold stock: grams held by purity, and each lot with its bill."""
    from apps.inventory.models import OldGold
    from apps.inventory.services.old_gold import stock
    from apps.parties.models import Party
    from apps.sales.models import SalesDocument

    rows = list(OldGold.objects.filter(tenant=tenant).order_by("-taken_on", "-created_at")[:200])
    names = dict(Party.objects.filter(tenant=tenant, pk__in=[r.party_id for r in rows if r.party_id]).values_list("id", "name"))
    bills = dict(SalesDocument.objects.filter(tenant=tenant, pk__in=[r.document_id for r in rows]).values_list("id", "number"))
    return {
        "stock": stock(tenant=tenant),
        "rows": [
            {
                "id": str(r.id),
                "taken_on": r.taken_on.isoformat(),
                "customer": names.get(r.party_id),
                "bill_id": str(r.document_id),
                "bill_number": bills.get(r.document_id),
                "purity": r.purity,
                "weight_g": f"{r.weight_g:.3f}",
                "rate": f"{r.rate:.2f}",
                "less_pct": f"{r.less_pct:.2f}",
                "value": f"{r.value:.2f}",
            }
            for r in rows
        ],
    }


@transaction.atomic
def set_photo(*, ctx: Ctx, order_id: Any, upload: Any) -> CustomOrder:
    """G3's design photo: checked and re-encoded like every image the app stores."""
    from apps.files.constants import AttachmentKind
    from apps.files.services.images import retire, store_branding_image

    order = CustomOrder.objects.select_for_update(of=("self",)).select_related("party", "karigar").filter(tenant=ctx.tenant, pk=order_id).first()
    if order is None:
        raise NotFound("No such order.")
    if upload is None:
        raise ValidationFailed({"photo": ["Choose a photo."]}, "Choose a photo.")
    stored = store_branding_image(
        tenant=ctx.tenant,
        kind=AttachmentKind.ITEM_IMAGE,
        upload=upload,
        owner_type="custom_order",
        owner_id=order.id,
        actor=ctx.actor if ctx.actor_type == "user" else None,
    )
    if order.photo_id:
        retire(attachment_id=order.photo_id, tenant=ctx.tenant)
    order.photo_id = stored.id
    order.save(update_fields=["photo_id"])
    return order
