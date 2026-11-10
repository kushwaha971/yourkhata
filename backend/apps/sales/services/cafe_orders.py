"""G10 — a café's open orders and advance orders (design G10: `dOpenOrders`, `pAdvance`).

A token or a table is food being made before it is paid for; an advance order is
a festival box or a cake for later, with a ready time and an advance. Neither is
a bill: the lines wait here, and the bill is made when the customer pays, from
these lines, so stock and tax are decided there exactly as for any other bill.
The advance is an earmarked receipt, as a repair job's is (`repairs`): only the
bill that settles this order applies it, and cancelling releases it to the
customer's open advances. See `models.CafeOrder`.
"""

from __future__ import annotations

import datetime as dt
import uuid
from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, Q

from apps.common.context import Ctx
from apps.common.dates import tenant_timezone, tenant_today
from apps.common.exceptions import BusinessRuleViolation, NotFound, ValidationFailed
from apps.sales.models import CafeOrder
from apps.sales.services.order_lines import clean_lines as _clean_lines, dec as _dec

MONEY_MODES = ("cash", "upi", "bank", "cheque", "card")
KINDS = (CafeOrder.TOKEN, CafeOrder.TABLE, CafeOrder.ADVANCE)
FULFIL = ("pickup", "deliver")
LIVE = (CafeOrder.PREPARING, CafeOrder.READY, CafeOrder.SERVED)
#: Each status and where it may go next. Billed is set only by a bill.
NEXT = {
    CafeOrder.PREPARING: (CafeOrder.READY, CafeOrder.SERVED, CafeOrder.CANCELLED),
    CafeOrder.READY: (CafeOrder.PREPARING, CafeOrder.SERVED, CafeOrder.CANCELLED),
    CafeOrder.SERVED: (CafeOrder.READY, CafeOrder.CANCELLED),
}


def view(order: CafeOrder) -> dict:
    return {
        "id": str(order.id),
        "kind": order.kind,
        "number": order.number,
        "party": (
            {"id": str(order.party_id), "name": order.party.name, "mobile": order.party.mobile}
            if order.party_id
            else None
        ),
        "lines": list(order.lines or []),
        "total": f"{order.total:.2f}",
        "status": order.status,
        "ready_at": order.ready_at.isoformat() if order.ready_at else None,
        "fulfil": order.fulfil or None,
        "advance": f"{order.advance:.2f}",
        "balance": f"{max(order.total - order.advance, Decimal('0')):.2f}",
        "invoice_id": str(order.invoice_id) if order.invoice_id else None,
        "created_at": order.created_at.isoformat(),
    }


def _clean(*, ctx: Ctx, data: dict) -> dict:
    from apps.parties.models import Party

    errors: dict[str, list[str]] = {}
    data = data if isinstance(data, dict) else {}
    kind = data.get("kind")
    if kind not in KINDS:
        errors["kind"] = ["Choose token, table or advance order."]
    party = None
    if data.get("party_id"):
        try:
            party = Party.objects.filter(tenant=ctx.tenant, pk=data["party_id"], deleted_at__isnull=True).first()
        except (ValueError, TypeError, ValidationError):
            party = None
        if party is None:
            errors["party_id"] = ["Choose a customer from your list."]
    lines, total = _clean_lines(ctx.tenant, data.get("lines"), errors)
    table = " ".join(str(data.get("table") or "").split())[:12]
    if kind == CafeOrder.TABLE and not table:
        errors["table"] = ["Enter the table, like 2 or Garden."]
    ready_at = None
    fulfil = ""
    advance = Decimal("0")
    mode = data.get("advance_mode") or "cash"
    if kind == CafeOrder.ADVANCE:
        if party is None and "party_id" not in errors:
            errors["party_id"] = ["Choose the customer, so the order and the advance are theirs."]
        try:
            ready_at = dt.datetime.fromisoformat(str(data.get("ready_at") or ""))
        except ValueError:
            errors["ready_at"] = ["Choose when it should be ready."]
        if ready_at is not None:
            from django.utils import timezone

            if timezone.is_naive(ready_at):
                ready_at = ready_at.replace(tzinfo=tenant_timezone(ctx.tenant))
            if ready_at.astimezone(tenant_timezone(ctx.tenant)).date() < tenant_today(ctx.tenant):
                errors["ready_at"] = ["The ready time cannot be in the past."]
        fulfil = data.get("fulfil") or "pickup"
        if fulfil not in FULFIL:
            errors["fulfil"] = ["Choose pick up or deliver."]
        raw = data.get("advance")
        if raw not in (None, ""):
            value = _dec(raw)
            if value is None or value < 0:
                errors["advance"] = ["Enter an amount of zero or more."]
            else:
                advance = value.quantize(Decimal("0.01"))
        if advance > 0 and mode not in MONEY_MODES:
            errors["advance_mode"] = ["Choose how the advance was paid."]
        if advance > total and "lines" not in errors and "advance" not in errors:
            errors["advance"] = ["The advance cannot be more than the order."]
    try:
        client_key = uuid.UUID(str(data.get("client_key")))
    except (TypeError, ValueError):
        client_key = uuid.uuid4()
    if errors:
        raise ValidationFailed(errors, "Check the order.")
    return {
        "kind": kind,
        "party": party,
        "lines": lines,
        "total": total,
        "table": table,
        "ready_at": ready_at,
        "fulfil": fulfil,
        "advance": advance,
        "mode": mode,
        "client_key": client_key,
    }


def _next_number(ctx: Ctx, kind: str, table: str) -> str:
    """Token numbers start from 1 each day; an advance order is ADV-0001 for ever;
    a table is its own name. The caller holds the business's order lock."""
    if kind == CafeOrder.TABLE:
        return table
    if kind == CafeOrder.ADVANCE:
        last = CafeOrder.objects.filter(tenant=ctx.tenant, kind=CafeOrder.ADVANCE).order_by("-number").first()
        return f"ADV-{(int(last.number.split('-')[1]) + 1) if last else 1:04d}"
    from django.utils import timezone

    today = tenant_today(ctx.tenant)
    tokens = [
        int(o.number)
        for o in CafeOrder.objects.filter(tenant=ctx.tenant, kind=CafeOrder.TOKEN, created_at__gte=timezone.now() - dt.timedelta(days=2))
        if o.created_at.astimezone(tenant_timezone(ctx.tenant)).date() == today and o.number.isdigit()
    ]
    return str(max(tokens, default=0) + 1)


@transaction.atomic
def create_order(*, ctx: Ctx, data: dict) -> tuple[CafeOrder, bool]:
    """The order and, with an advance, its earmarked receipt. Returns (order, created)."""
    from apps.payments.services.record import record_payment
    from apps.platform_app.models import Tenant

    clean = _clean(ctx=ctx, data=data)
    # One writer at a time per business: token numbers are counted, and a double
    # tap finds the first tap's order here rather than making a second.
    Tenant.objects.select_for_update().filter(pk=ctx.tenant.pk).first()
    same = CafeOrder.objects.filter(tenant=ctx.tenant, client_key=clean["client_key"]).first()
    if same is not None:
        return same, False
    if clean["kind"] == CafeOrder.TABLE and CafeOrder.objects.filter(
        tenant=ctx.tenant, kind=CafeOrder.TABLE, number__iexact=clean["table"], status__in=LIVE
    ).exists():
        raise ValidationFailed({"table": ["This table already has an open order. Add items to it."]}, "Check the order.")
    order = CafeOrder.objects.create(
        tenant=ctx.tenant,
        client_key=clean["client_key"],
        kind=clean["kind"],
        number=_next_number(ctx, clean["kind"], clean["table"]),
        party=clean["party"],
        lines=clean["lines"],
        total=clean["total"],
        ready_at=clean["ready_at"],
        fulfil=clean["fulfil"],
        advance=clean["advance"],
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
                "context": "cafe_order",
                "bucket": "shop",
                "allocations": [],
                "meta": {
                    "cafe_order_number": order.number,
                    "earmark": {"module": "sales", "subject_type": "cafe_order", "subject_id": str(order.id)},
                },
            },
        )
        order.advance_payment_id = recorded["payment"].id
        order.save(update_fields=["advance_payment_id"])
    return order, True


def _lock(ctx: Ctx, order_id: Any) -> CafeOrder:
    try:
        order = (
            CafeOrder.objects.select_for_update(of=("self",))
            .select_related("party")
            .filter(tenant=ctx.tenant, pk=order_id)
            .first()
        )
    except (ValueError, TypeError, ValidationError):
        order = None
    if order is None:
        raise NotFound("No such order.")
    return order


def _release(ctx: Ctx, order: CafeOrder) -> list[str]:
    """Take the earmark off the order's advance; returns its payment id, if any."""
    from apps.payments.models import Payment

    if not order.advance_payment_id:
        return []
    payment = Payment.objects.select_for_update().filter(tenant=ctx.tenant, pk=order.advance_payment_id).first()
    if payment is None:
        return []
    payment.meta = {k: v for k, v in (payment.meta or {}).items() if k != "earmark"}
    payment.save(update_fields=["meta"])
    return [str(payment.id)]


@transaction.atomic
def update_order(*, ctx: Ctx, order_id: Any, data: dict) -> CafeOrder:
    """Move the status, or replace the lines ("add items") while the order is live."""
    order = _lock(ctx, order_id)
    data = data if isinstance(data, dict) else {}
    if order.status not in LIVE:
        raise BusinessRuleViolation("cafe_order_status", "This order is already finished.", details={"status": order.status})
    fields = ["updated_at"]
    if "lines" in data:
        errors: dict[str, list[str]] = {}
        lines, total = _clean_lines(ctx.tenant, data.get("lines"), errors)
        if not errors and total < order.advance:
            errors["lines"] = ["The order cannot be less than the advance taken."]
        if errors:
            raise ValidationFailed(errors, "Check the order.")
        order.lines, order.total = lines, total
        fields += ["lines", "total"]
    status = data.get("status")
    if status is not None and status != order.status:
        if status not in NEXT.get(order.status, ()):
            raise BusinessRuleViolation(
                "cafe_order_status", "This order cannot move to that status.", details={"status": order.status}
            )
        order.status = status
        fields.append("status")
    order.save(update_fields=fields)
    if order.status == CafeOrder.CANCELLED:
        _release(ctx, order)
    return order


def list_orders(*, tenant: Any, scope: str = "open") -> dict:
    """`open` — tokens and tables being served; `advance` — advance orders by
    ready time. The counts and the "ready tomorrow" list are for both screens
    and Home, which shows an advance order the day before."""
    today = tenant_today(tenant)
    rows = CafeOrder.objects.filter(tenant=tenant, status__in=LIVE).select_related("party")
    counts = rows.aggregate(
        open=Count("id", filter=~Q(kind=CafeOrder.ADVANCE)),
        advance=Count("id", filter=Q(kind=CafeOrder.ADVANCE)),
    )
    advance = rows.filter(kind=CafeOrder.ADVANCE).order_by("ready_at", "number")
    soon = [
        view(o)
        for o in advance
        if o.ready_at is not None and o.ready_at.astimezone(tenant_timezone(tenant)).date() <= today + dt.timedelta(days=1)
    ]
    shown = advance if scope == "advance" else rows.exclude(kind=CafeOrder.ADVANCE).order_by("created_at")
    return {"rows": [view(o) for o in shown[:200]], "counts": counts, "soon": soon[:20]}


def get_order(*, tenant: Any, order_id: Any) -> CafeOrder:
    try:
        order = CafeOrder.objects.select_related("party").filter(tenant=tenant, pk=order_id).first()
    except (ValueError, TypeError, ValidationError):
        order = None
    if order is None:
        raise NotFound("No such order.")
    return order


def link_to_draft(*, tenant: Any, document: Any, order_id: Any, errors: dict) -> None:
    """`meta.cafe_order` of a draft: which order this bill settles (null clears it)."""
    meta = {k: v for k, v in (document.meta or {}).items() if k != "cafe_order"}
    document.meta = meta
    if not order_id:
        return
    try:
        order = CafeOrder.objects.filter(tenant=tenant, pk=order_id).first()
    except (ValueError, TypeError, ValidationError):
        order = None
    if order is None or order.status not in LIVE:
        errors["cafe_order_id"] = ["This order is already finished."]
        return
    document.meta = {
        **meta,
        "cafe_order": {
            "id": str(order.id),
            "kind": order.kind,
            "number": order.number,
            "advance": f"{order.advance:.2f}",
        },
    }


def advance_for_issue(*, ctx: Ctx, document: Any) -> tuple[CafeOrder | None, list[str]]:
    """At issue: lock the linked order, refuse if this bill cannot settle it, and
    release its advance so the issue applies it to this bill."""
    link = (document.meta or {}).get("cafe_order") or {}
    if not link.get("id"):
        return None, []
    order = CafeOrder.objects.select_for_update().filter(tenant=ctx.tenant, pk=link["id"]).first()
    if order is None or order.status not in LIVE:
        raise BusinessRuleViolation("cafe_order_status", "This order is already billed. Remove it from the bill.", details={})
    if order.party_id and order.party_id != document.party_id:
        raise BusinessRuleViolation("cafe_order_status", "This bill is for a different customer than the order.", details={})
    return order, _release(ctx, order)


def mark_billed_by(*, order: CafeOrder | None, document: Any) -> None:
    if order is None:
        return
    order.status = CafeOrder.BILLED
    order.invoice_id = document.id
    order.save(update_fields=["status", "invoice_id", "updated_at"])


def due_soon(tenant: Any, today: dt.date) -> dict | None:
    """Home's block: advance orders to be ready today or tomorrow, in one query.
    None when there are none (every business but a café, most days), so Home
    carries no empty block."""
    zone = tenant_timezone(tenant)
    end = dt.datetime.combine(today + dt.timedelta(days=2), dt.time.min, tzinfo=zone)
    rows = (
        CafeOrder.objects.filter(tenant=tenant, kind=CafeOrder.ADVANCE, status__in=LIVE, ready_at__lt=end)
        .select_related("party")
        .order_by("ready_at")[:10]
    )
    orders = [view(o) for o in rows]
    return {"orders": orders} if orders else None
