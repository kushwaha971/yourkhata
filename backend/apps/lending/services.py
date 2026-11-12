"""Every write to a lender's book. A collection is written inside one
transaction with the loan's row locked, so two collectors at one door can never
collect twice or read a "left" half-way."""

from __future__ import annotations

import datetime as dt
from decimal import Decimal, InvalidOperation
from typing import Any

from django.db import transaction
from django.db.models import Sum
from django.utils.translation import gettext as _

from apps.common.dates import tenant_today
from apps.common.exceptions import BusinessRuleViolation, NotFound, ValidationFailed
from apps.lending import book
from apps.lending.constants import (
    MAX_AMOUNT,
    MAX_COUNT,
    NAME_MAX,
    NOTE_MAX,
    REASON_MAX,
    CloseReason,
    Frequency,
    LoanStatus,
    MessageKind,
    PayMode,
    RowStatus,
)
from apps.lending.models import Borrower, Collection, Due, Loan, Message, Route, Settings, Visit

# ── cleaning ────────────────────────────────────────────────────────────────


def today(tenant: Any) -> dt.date:
    return tenant_today(tenant)


def clean_text(value: Any, field: str, limit: int = NOTE_MAX, *, required: bool = False) -> str:
    text = " ".join(str(value or "").split())
    if required and not text:
        raise ValidationFailed(details={field: [_("Enter a name.")]})
    if len(text) > limit:
        raise ValidationFailed(details={field: [_("Use %(n)s letters or fewer.") % {"n": limit}]})
    return text


def clean_mobile(value: Any) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if digits and (len(digits) != 10 or digits[0] not in "6789"):
        raise ValidationFailed(details={"mobile": [_("Enter a 10-digit mobile number.")]})
    return digits


def clean_amount(value: Any, field: str = "amount", *, allow_zero: bool = False) -> Decimal:
    try:
        amount = Decimal(str(value if value is not None else "").replace(",", "")).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        amount = None
    if amount is None or not amount.is_finite() or amount < 0 or (amount == 0 and not allow_zero):
        raise ValidationFailed(details={field: [_("Enter an amount more than ₹0.")]})
    # Size before shape: an extra zero is "too large" (H69).
    if amount > MAX_AMOUNT:
        raise ValidationFailed(details={field: [_("This amount is too large.")]})
    return amount


def clean_date(value: Any, field: str, *, default: dt.date | None = None, not_after: dt.date | None = None) -> dt.date:
    if value in (None, ""):
        if default is None:
            raise ValidationFailed(details={field: [_("Choose a date.")]})
        return default
    try:
        day = dt.date.fromisoformat(str(value))
    except ValueError:
        raise ValidationFailed(details={field: [_("Choose a date.")]}) from None
    if not_after and day > not_after:
        raise ValidationFailed(details={field: [_("Choose today or an earlier day.")]})
    return day


# ── settings and routes ─────────────────────────────────────────────────────


def settings_for(tenant: Any) -> Settings:
    row, _created = Settings.objects.get_or_create(tenant=tenant)
    return row


def update_settings(*, tenant: Any, data: dict) -> Settings:
    row = settings_for(tenant)
    if "sign_as" in data:
        row.sign_as = clean_text(data["sign_as"], "sign_as", NAME_MAX)
    if "upi_id" in data:
        upi = str(data["upi_id"] or "").strip()
        if upi and ("@" not in upi or len(upi) > 60 or " " in upi):
            raise ValidationFailed(details={"upi_id": [_("Enter a UPI ID like name@bank.")]})
        row.upi_id = upi
    row.save()
    return row


def save_route(*, tenant: Any, user: Any, data: dict, route_id: Any = None) -> Route:
    route = Route.objects.filter(tenant=tenant, pk=route_id).first() if route_id else Route(tenant=tenant, created_by=user)
    if route is None:
        raise NotFound(_("This route is not in your book."))
    if "name" in data or not route_id:
        route.name = clean_text(data.get("name"), "name", NAME_MAX, required=True)
    if "active" in data:
        route.active = bool(data["active"])
    if not route_id:
        route.sort = Route.objects.filter(tenant=tenant).count()
    route.save()
    return route


def _route(tenant: Any, route_id: Any) -> Route | None:
    if not route_id:
        return None
    route = Route.objects.filter(tenant=tenant, pk=route_id, active=True).first()
    if route is None:
        raise ValidationFailed(details={"route_id": [_("Choose a route.")]})
    return route


# ── borrowers ───────────────────────────────────────────────────────────────


def get_borrower(*, tenant: Any, borrower_id: Any) -> Borrower:
    b = Borrower.objects.filter(tenant=tenant, pk=borrower_id).select_related("route").first()
    if b is None:
        raise NotFound(_("This borrower is not in your book."))
    return b


def save_borrower(*, tenant: Any, user: Any, data: dict, borrower_id: Any = None) -> Borrower:
    with transaction.atomic():
        b = get_borrower(tenant=tenant, borrower_id=borrower_id) if borrower_id else Borrower(tenant=tenant, created_by=user)
        if "name" in data or not borrower_id:
            b.name = clean_text(data.get("name"), "name", NAME_MAX, required=True)
        if "mobile" in data:
            b.mobile = clean_mobile(data.get("mobile"))
            other = (
                Borrower.objects.filter(tenant=tenant, mobile=b.mobile, active=True).exclude(pk=b.pk).first()
                if b.mobile
                else None
            )
            if other:
                raise BusinessRuleViolation(
                    "borrower_exists",
                    _("%(name)s already has this mobile number.") % {"name": other.name},
                    details={"id": str(other.pk)},
                )
        if "work" in data:
            b.work = clean_text(data.get("work"), "work", NAME_MAX)
        if "note" in data:
            b.note = clean_text(data.get("note"), "note")
        if "route_id" in data:
            b.route = _route(tenant, data.get("route_id"))
        b.save()
        return b


# ── loans ───────────────────────────────────────────────────────────────────


def _clean_loan(tenant: Any, data: dict) -> dict:
    frequency = data.get("frequency") or Frequency.DAILY
    if frequency not in Frequency.values:
        raise ValidationFailed(details={"frequency": [_("Choose daily, weekly or monthly.")]})
    try:
        count = int(data.get("count") or 0)
    except (TypeError, ValueError):
        count = 0
    if not 1 <= count <= MAX_COUNT:
        raise ValidationFailed(details={"count": [_("Choose 1 to 400 collections.")]})
    lent = clean_amount(data.get("lent"), "lent")
    each = clean_amount(data.get("each"), "each")
    charges = clean_amount(data.get("charges") or "0", "charges", allow_zero=True)
    if charges >= lent:
        raise ValidationFailed(details={"charges": [_("Charges must be less than the amount lent.")]})
    if each * count < lent:
        raise ValidationFailed(
            details={"each": [_("%(count)s collections of this amount bring back less than was lent.") % {"count": count}]}
        )
    starts_on = clean_date(data.get("starts_on"), "starts_on", default=today(tenant) + dt.timedelta(days=1))
    return {
        "frequency": frequency,
        "count": count,
        "lent": lent,
        "each": each,
        "charges": charges,
        "starts_on": starts_on,
        "skip_sundays": bool(data.get("skip_sundays", True)) if frequency == Frequency.DAILY else False,
    }


def preview_loan(*, tenant: Any, data: dict) -> dict:
    v = _clean_loan(tenant, data)
    rows = book.schedule(starts_on=v["starts_on"], frequency=v["frequency"], count=v["count"], each=v["each"], skip_sundays=v["skip_sundays"])
    total = sum((a for _s, _d, a in rows), Decimal("0"))
    return {
        "to_collect": f"{total:.2f}",
        "in_hand": f"{v['lent'] - v['charges']:.2f}",
        "earns": f"{total - v['lent'] + v['charges']:.2f}",
        "last_day": rows[-1][1].isoformat(),
        "schedule": [{"seq": s, "due_on": d.isoformat(), "amount": f"{a:.2f}"} for s, d, a in rows],
    }


def _next_number(tenant: Any) -> str:
    settings_for(tenant)
    Settings.objects.select_for_update().filter(tenant=tenant).first()
    n = Loan.objects.filter(tenant=tenant).count() + 1
    while Loan.objects.filter(tenant=tenant, number=f"L-{n:04d}").exists():
        n += 1
    return f"L-{n:04d}"


def create_loan(*, tenant: Any, user: Any, data: dict) -> Loan:
    v = _clean_loan(tenant, data)
    with transaction.atomic():
        borrower = get_borrower(tenant=tenant, borrower_id=data.get("borrower_id")) if data.get("borrower_id") else None
        if borrower is None:
            raise ValidationFailed(details={"borrower_id": [_("Choose a borrower.")]})
        route = _route(tenant, data.get("route_id")) if data.get("route_id") else borrower.route
        loan = Loan.objects.create(
            tenant=tenant, created_by=user, number=_next_number(tenant), borrower=borrower, route=route,
            note=clean_text(data.get("note"), "note"), **v,
        )
        Due.objects.bulk_create(
            [
                Due(tenant=tenant, created_by=user, loan=loan, seq=s, due_on=d, amount=a)
                for s, d, a in book.schedule(
                    starts_on=v["starts_on"], frequency=v["frequency"], count=v["count"], each=v["each"],
                    skip_sundays=v["skip_sundays"],
                )
            ]
        )
        return loan


def get_loan(*, tenant: Any, loan_id: Any, lock: bool = False) -> Loan:
    rows = Loan.objects.filter(tenant=tenant, pk=loan_id).select_related("borrower", "route")
    if lock:
        rows = rows.select_for_update(of=("self",))
    loan = rows.first()
    if loan is None:
        raise NotFound(_("This loan is not in your book."))
    return loan


def dues_of(loan: Loan) -> list[tuple[int, dt.date, Decimal]]:
    return list(Due.objects.filter(loan=loan).order_by("seq").values_list("seq", "due_on", "amount"))


def collected_on_loan(loan: Loan) -> Decimal:
    return (
        Collection.objects.filter(loan=loan, status=RowStatus.LIVE, removes__isnull=True).aggregate(t=Sum("amount"))["t"]
        or Decimal("0.00")
    )


def _clean_collection(tenant: Any, data: dict) -> tuple[Decimal, str, dt.date]:
    # ₹0 is allowed: "visited, paid nothing" (owner, 12 Nov). It never becomes a
    # ₹0 collection — `collect` records it as a Not paid visit instead.
    amount = clean_amount(data.get("amount"), allow_zero=True)
    mode = data.get("mode") or PayMode.CASH
    if mode not in PayMode.values:
        raise ValidationFailed(details={"mode": [_("Choose Cash or UPI.")]})
    day = clean_date(data.get("collected_on"), "collected_on", default=today(tenant), not_after=today(tenant))
    return amount, mode, day


def preview_collection(*, tenant: Any, loan_id: Any, data: dict) -> book.Position:
    loan = get_loan(tenant=tenant, loan_id=loan_id)
    amount, _mode, _day = _clean_collection(tenant, data)
    return book.after(dues=dues_of(loan), collected=collected_on_loan(loan), amount=amount, day=today(tenant))


def collect(*, tenant: Any, user: Any, loan_id: Any, data: dict) -> Collection | Visit:
    """Money collected; or, for ₹0, the visit at which nothing was paid (owner,
    12 Nov: "collect 0 rupees" = visited, paid nothing). The money stays late."""
    amount, mode, day = _clean_collection(tenant, data)
    if amount == 0:
        if day != today(tenant):
            raise ValidationFailed(details={"collected_on": [_("A visit with nothing paid is recorded for today.")]})
        return not_paid(tenant=tenant, user=user, loan_id=loan_id,
                        data={"reason": data.get("reason") or _("Visited, paid nothing"), "promised_on": data.get("promised_on")})
    with transaction.atomic():
        loan = get_loan(tenant=tenant, loan_id=loan_id, lock=True)
        if loan.status != LoanStatus.ACTIVE:
            raise BusinessRuleViolation("loan_closed", _("Loan %(n)s is closed.") % {"n": loan.number})
        left = book.position(dues=dues_of(loan), collected=collected_on_loan(loan), day=day).left
        if amount > left:
            raise BusinessRuleViolation(
                "more_than_left",
                _("Only %(left)s is left on %(n)s.") % {"left": f"₹{left:,.2f}".replace(".00", ""), "n": loan.number},
                details={"left": f"{left:.2f}"},
            )
        row = Collection.objects.create(
            tenant=tenant, created_by=user, loan=loan, amount=amount, mode=mode, collected_on=day
        )
        # Collected today means it was not "not paid" today after all.
        Visit.objects.filter(loan=loan, day=day).delete()
        if amount == left:
            loan.status, loan.closed_on, loan.close_reason = LoanStatus.CLOSED, day, CloseReason.PAID
            loan.save(update_fields=["status", "closed_on", "close_reason", "updated_at"])
        return row


def remove_collection(*, tenant: Any, user: Any, collection_id: Any, reason: Any) -> Loan:
    why = clean_text(reason, "reason", REASON_MAX)
    if not why:
        raise ValidationFailed(details={"reason": [_("Say why, so the record makes sense later.")]})
    with transaction.atomic():
        row = Collection.objects.filter(tenant=tenant, pk=collection_id, removes__isnull=True).first()
        if row is None:
            raise NotFound(_("This collection is not in your book."))
        loan = get_loan(tenant=tenant, loan_id=row.loan_id, lock=True)
        row = Collection.objects.select_for_update().get(pk=row.pk)
        if row.status != RowStatus.LIVE:
            raise BusinessRuleViolation("already_removed", _("This collection is already removed."))
        Collection.objects.create(
            tenant=tenant, created_by=user, loan=loan, amount=row.amount, mode=row.mode,
            collected_on=today(tenant), status=RowStatus.REMOVED, removes=row, reason=why,
        )
        Collection.objects.filter(pk=row.pk).update(status=RowStatus.REMOVED)
        # A loan closed by the money just removed is running again.
        if loan.status == LoanStatus.CLOSED and loan.close_reason == CloseReason.PAID:
            loan.status, loan.closed_on, loan.close_reason = LoanStatus.ACTIVE, None, ""
            loan.save(update_fields=["status", "closed_on", "close_reason", "updated_at"])
        return loan


def not_paid(*, tenant: Any, user: Any, loan_id: Any, data: dict) -> Visit:
    with transaction.atomic():
        loan = get_loan(tenant=tenant, loan_id=loan_id, lock=True)
        day = today(tenant)
        promised = clean_date(data.get("promised_on"), "promised_on") if data.get("promised_on") else None
        if promised and promised < day:
            raise ValidationFailed(details={"promised_on": [_("Choose today or a later day.")]})
        visit, _created = Visit.objects.update_or_create(
            tenant=tenant, loan=loan, day=day,
            defaults={"reason": clean_text(data.get("reason"), "reason", REASON_MAX), "promised_on": promised, "created_by": user},
        )
        return visit


def close_loan(*, tenant: Any, loan_id: Any, data: dict) -> Loan:
    reason = data.get("reason") or CloseReason.PAID
    if reason not in CloseReason.values:
        raise ValidationFailed(details={"reason": [_("Choose why the loan is closed.")]})
    with transaction.atomic():
        loan = get_loan(tenant=tenant, loan_id=loan_id, lock=True)
        left = book.position(dues=dues_of(loan), collected=collected_on_loan(loan), day=today(tenant)).left
        if reason == CloseReason.PAID and left > 0:
            raise BusinessRuleViolation(
                "money_left",
                _("%(left)s is still left on %(n)s.") % {"left": f"₹{left:,.2f}".replace(".00", ""), "n": loan.number},
                details={"left": f"{left:.2f}"},
            )
        loan.status, loan.closed_on, loan.close_reason = LoanStatus.CLOSED, today(tenant), reason
        loan.save(update_fields=["status", "closed_on", "close_reason", "updated_at"])
        return loan


def record_message(*, tenant: Any, user: Any, loan_id: Any, kind: Any, text: Any) -> Message:
    if kind not in MessageKind.values:
        raise ValidationFailed(details={"kind": [_("Choose a message.")]})
    body = str(text or "").strip()
    if not body or len(body) > 1000:
        raise ValidationFailed(details={"text": [_("Write the message.")]})
    loan = get_loan(tenant=tenant, loan_id=loan_id)
    return Message.objects.create(tenant=tenant, created_by=user, loan=loan, kind=kind, text=body)


def seed_lending(ctx: Any, tenant: Any) -> None:
    """Switched on: a settings row. Routes and borrowers are the lender's own."""
    settings_for(tenant)
