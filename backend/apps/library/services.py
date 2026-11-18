"""Every write to a library. Money moves only here, inside one transaction with
the student's row locked, so two taps or two counters can never collect twice
or read a "paid to" half-way."""

from __future__ import annotations

import datetime as dt
from decimal import Decimal, InvalidOperation
from typing import Any

from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.common.dates import tenant_today
from apps.common.exceptions import BusinessRuleViolation, NotFound, ValidationFailed
from apps.library import fees
from apps.library.constants import (
    MAX_AMOUNT,
    MAX_SEATS,
    MAX_SHIFTS,
    NAME_MAX,
    NOTE_MAX,
    REASON_MAX,
    ExpenseHead,
    MessageKind,
    PayMode,
    RowStatus,
    StudentStatus,
)
from apps.library.models import (
    Attendance,
    Book,
    BookIssue,
    Expense,
    Message,
    Payment,
    Seat,
    Settings,
    Shift,
    Student,
)

# ── cleaning ────────────────────────────────────────────────────────────────


def clean_name(value: Any, field: str = "name") -> str:
    text = " ".join(str(value or "").split())
    if not text:
        raise ValidationFailed(details={field: [_("Enter a name.")]})
    if len(text) > NAME_MAX:
        raise ValidationFailed(details={field: [_("Use 120 letters or fewer.")]})
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
    # Size before shape: an extra zero is "too large", not "two decimals" (H69).
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


def clean_text(value: Any, field: str, limit: int = NOTE_MAX) -> str:
    text = " ".join(str(value or "").split())
    if len(text) > limit:
        raise ValidationFailed(details={field: [_("Use %(n)s letters or fewer.") % {"n": limit}]})
    return text


def today(tenant: Any) -> dt.date:
    return tenant_today(tenant)


# ── settings, shifts, seats ─────────────────────────────────────────────────


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
    if "due_soon_days" in data:
        try:
            days = int(data["due_soon_days"])
        except (TypeError, ValueError):
            days = -1
        if not 1 <= days <= 30:
            raise ValidationFailed(details={"due_soon_days": [_("Choose 1 to 30 days.")]})
        row.due_soon_days = days
    row.save()
    return row


def save_shift(*, tenant: Any, user: Any, data: dict, shift_id: Any = None) -> Shift:
    with transaction.atomic():
        if shift_id:
            shift = Shift.objects.select_for_update().filter(tenant=tenant, pk=shift_id).first()
            if shift is None:
                raise NotFound(_("This shift is not in your library."))
        else:
            if Shift.objects.filter(tenant=tenant, active=True).count() >= MAX_SHIFTS:
                raise BusinessRuleViolation("too_many_shifts", _("A library can have up to 6 shifts."))
            shift = Shift(tenant=tenant, created_by=user, sort=Shift.objects.filter(tenant=tenant).count())
        if "name" in data or not shift_id:
            shift.name = clean_text(data.get("name"), "name", 40)
            if not shift.name:
                raise ValidationFailed(details={"name": [_("Enter a name.")]})
        if "monthly_fee" in data or not shift_id:
            shift.monthly_fee = clean_amount(data.get("monthly_fee"), "monthly_fee", allow_zero=True)
        if "is_full_day" in data:
            shift.is_full_day = bool(data["is_full_day"])
        for key in ("starts_at", "ends_at"):
            if key in data:
                try:
                    setattr(shift, key, dt.time.fromisoformat(data[key]) if data[key] else None)
                except ValueError:
                    raise ValidationFailed(details={key: [_("Choose a time.")]}) from None
        if "active" in data:
            shift.active = bool(data["active"])
        shift.save()
        return shift


def set_seat_count(*, tenant: Any, user: Any, count: Any) -> int:
    """Seats 1…N are active; a seat above N with a student on it is refused."""
    try:
        n = int(count)
    except (TypeError, ValueError):
        n = -1
    if not 1 <= n <= MAX_SEATS:
        raise ValidationFailed(details={"count": [_("Choose 1 to 500 seats.")]})
    with transaction.atomic():
        taken = (
            Student.objects.filter(tenant=tenant, seat__number__gt=n)
            .exclude(status=StudentStatus.LEFT)
            .values_list("seat__number", flat=True)
        )
        if taken:
            raise BusinessRuleViolation(
                "seat_in_use",
                _("Seat %(n)s has a student. Move them first.") % {"n": min(taken)},
                details={"seats": sorted(set(taken))},
            )
        have = set(Seat.objects.filter(tenant=tenant).values_list("number", flat=True))
        Seat.objects.bulk_create(
            [Seat(tenant=tenant, created_by=user, number=i) for i in range(1, n + 1) if i not in have]
        )
        Seat.objects.filter(tenant=tenant, number__lte=n).update(active=True)
        Seat.objects.filter(tenant=tenant, number__gt=n).update(active=False)
    return n


# ── students ────────────────────────────────────────────────────────────────


def get_student(*, tenant: Any, student_id: Any, lock: bool = False) -> Student:
    rows = Student.objects.filter(tenant=tenant, pk=student_id).select_related("seat", "shift")
    if lock:
        rows = rows.select_for_update(of=("self",))
    student = rows.first()
    if student is None:
        raise NotFound(_("This student is not in your library."))
    return student


def _shift(tenant: Any, shift_id: Any) -> Shift:
    shift = Shift.objects.filter(tenant=tenant, pk=shift_id, active=True).first() if shift_id else None
    if shift is None:
        raise ValidationFailed(details={"shift_id": [_("Choose a shift.")]})
    return shift


def _seat(tenant: Any, number: Any) -> Seat | None:
    if number in (None, "", 0, "0"):
        return None
    try:
        n = int(number)
    except (TypeError, ValueError):
        n = -1
    seat = Seat.objects.filter(tenant=tenant, number=n, active=True).first()
    if seat is None:
        raise ValidationFailed(details={"seat": [_("Choose a seat from the map.")]})
    return seat


def _check_seat_free(tenant: Any, seat: Seat | None, shift: Shift, *, exclude: Any = None) -> None:
    """A seat is one student's per shift; a full-day student holds it in every shift."""
    if seat is None:
        return
    rows = Student.objects.filter(tenant=tenant, seat=seat).exclude(status=StudentStatus.LEFT)
    if exclude is not None:
        rows = rows.exclude(pk=exclude)
    if not shift.is_full_day:
        rows = rows.filter(Q(shift=shift) | Q(shift__is_full_day=True))
    holder = rows.select_for_update(of=("self",)).first()
    if holder is not None:
        raise BusinessRuleViolation(
            "seat_taken",
            _("Seat %(n)s is %(name)s's in this shift.") % {"n": seat.number, "name": holder.name},
            details={"student_id": str(holder.pk), "seat": seat.number},
        )


def _check_mobile_free(tenant: Any, mobile: str, *, exclude: Any = None) -> None:
    """One mobile, one student who is still here: a fee reminder has one reader."""
    if not mobile:
        return
    existing = (
        Student.objects.filter(tenant=tenant, mobile=mobile).exclude(status=StudentStatus.LEFT).exclude(pk=exclude).first()
    )
    if existing:
        raise BusinessRuleViolation(
            "student_exists",
            _("%(name)s already has this mobile number.") % {"name": existing.name},
            details={"id": str(existing.pk)},
        )


def enrol_student(*, tenant: Any, user: Any, data: dict) -> Student:
    name = clean_name(data.get("name"))
    mobile = clean_mobile(data.get("mobile"))
    shift = _shift(tenant, data.get("shift_id"))
    fee = data.get("monthly_fee")
    monthly_fee = clean_amount(fee if fee not in (None, "") else shift.monthly_fee, "monthly_fee")
    joined_on = clean_date(data.get("joined_on"), "joined_on", default=today(tenant), not_after=today(tenant))
    try:
        with transaction.atomic():
            seat = _seat(tenant, data.get("seat"))
            if seat is not None:
                Seat.objects.select_for_update().filter(pk=seat.pk).first()
            _check_seat_free(tenant, seat, shift)
            _check_mobile_free(tenant, mobile)
            student = Student.objects.create(
                tenant=tenant,
                created_by=user,
                name=name,
                mobile=mobile,
                seat=seat,
                shift=shift,
                monthly_fee=monthly_fee,
                joined_on=joined_on,
                note=clean_text(data.get("note"), "note"),
            )
            first = data.get("first_payment")
            if first not in (None, "", "0", 0):
                collect_fee(
                    tenant=tenant, user=user, student_id=student.pk,
                    data={"amount": first, "mode": data.get("mode") or PayMode.CASH, "paid_on": joined_on.isoformat()},
                )
                student.refresh_from_db()
            return student
    except IntegrityError:
        # Two counters enrolled on the same seat at once: the index decided.
        raise BusinessRuleViolation("seat_taken", _("This seat was just taken. Choose another.")) from None


def update_student(*, tenant: Any, student_id: Any, data: dict) -> Student:
    with transaction.atomic():
        student = get_student(tenant=tenant, student_id=student_id, lock=True)
        if "name" in data:
            student.name = clean_name(data["name"])
        if "mobile" in data:
            student.mobile = clean_mobile(data["mobile"])
            if student.status != StudentStatus.LEFT:
                _check_mobile_free(tenant, student.mobile, exclude=student.pk)
        if "monthly_fee" in data:
            student.monthly_fee = clean_amount(data["monthly_fee"], "monthly_fee")
        if "note" in data:
            student.note = clean_text(data["note"], "note")
        student.save()
        return student


def move_student(*, tenant: Any, student_id: Any, data: dict) -> Student:
    try:
        with transaction.atomic():
            student = get_student(tenant=tenant, student_id=student_id, lock=True)
            if student.status == StudentStatus.LEFT:
                raise BusinessRuleViolation("student_left", _("%(name)s has left.") % {"name": student.name})
            shift = _shift(tenant, data.get("shift_id") or student.shift_id)
            seat = _seat(tenant, data.get("seat"))
            _check_seat_free(tenant, seat, shift, exclude=student.pk)
            student.seat, student.shift = seat, shift
            student.save(update_fields=["seat", "shift", "updated_at"])
            return student
    except IntegrityError:
        raise BusinessRuleViolation("seat_taken", _("This seat was just taken. Choose another.")) from None


def set_status(*, tenant: Any, student_id: Any, action: str, data: dict) -> Student:
    with transaction.atomic():
        student = get_student(tenant=tenant, student_id=student_id, lock=True)
        if action == "hold":
            if student.status == StudentStatus.LEFT:
                raise BusinessRuleViolation(
                    "student_left", _("%(name)s has left. Bring them back first.") % {"name": student.name}
                )
            until = clean_date(data.get("hold_until"), "hold_until") if data.get("hold_until") else None
            if until and until < today(tenant):
                raise ValidationFailed(details={"hold_until": [_("Choose today or a later day.")]})
            student.status, student.hold_until = StudentStatus.HOLD, until
        elif action == "resume":
            if student.status == StudentStatus.LEFT and student.seat_id:
                _check_seat_free(tenant, student.seat, student.shift, exclude=student.pk)
            if student.status == StudentStatus.LEFT:
                _check_mobile_free(tenant, student.mobile, exclude=student.pk)
            student.status = StudentStatus.ACTIVE
            student.hold_until = None
        elif action == "leave":
            # Leaving frees the seat; any fee still due stays on the record.
            student.status = StudentStatus.LEFT
            student.seat = None
            student.hold_until = None
        student.save()
        return student


# ── fees ────────────────────────────────────────────────────────────────────


def _clean_payment(tenant: Any, data: dict) -> tuple[Decimal, str, dt.date]:
    amount = clean_amount(data.get("amount"))
    mode = data.get("mode") or PayMode.CASH
    if mode not in PayMode.values:
        raise ValidationFailed(details={"mode": [_("Choose Cash or UPI.")]})
    paid_on = clean_date(data.get("paid_on"), "paid_on", default=today(tenant), not_after=today(tenant))
    return amount, mode, paid_on


def preview_fee(*, tenant: Any, student_id: Any, data: dict) -> dict:
    student = get_student(tenant=tenant, student_id=student_id)
    amount, _mode, _day = _clean_payment(tenant, data)
    applied = fees.apply_payment(
        paid_to=student.paid_to, credit=student.credit, amount=amount,
        monthly_fee=student.monthly_fee, joined_on=student.joined_on,
    )
    return {"months": applied.months, "paid_to": applied.paid_to.isoformat(), "credit": f"{applied.credit:.2f}"}


def collect_fee(*, tenant: Any, user: Any, student_id: Any, data: dict) -> tuple[Payment, Student]:
    amount, mode, paid_on = _clean_payment(tenant, data)
    with transaction.atomic():
        student = get_student(tenant=tenant, student_id=student_id, lock=True)
        if student.status == StudentStatus.LEFT:
            raise BusinessRuleViolation("student_left", _("%(name)s has left.") % {"name": student.name})
        applied = fees.apply_payment(
            paid_to=student.paid_to, credit=student.credit, amount=amount,
            monthly_fee=student.monthly_fee, joined_on=student.joined_on,
        )
        payment = Payment.objects.create(
            tenant=tenant, created_by=user, student=student, amount=amount, mode=mode, paid_on=paid_on,
            months=applied.months, from_date=applied.from_date, to_date=applied.to_date,
            paid_to_before=student.paid_to, credit_before=student.credit,
        )
        student.paid_to = applied.paid_to if (applied.months or student.paid_to) else None
        student.credit = applied.credit
        student.save(update_fields=["paid_to", "credit", "updated_at"])
        return payment, student


def remove_payment(*, tenant: Any, user: Any, payment_id: Any, reason: Any) -> Student:
    """Undo a fee. Only the LATEST live payment can be removed: the caches are
    put back to what they were before it, which is exact only for the last one."""
    why = clean_text(reason, "reason", REASON_MAX)
    if not why:
        raise ValidationFailed(details={"reason": [_("Say why, so the record makes sense later.")]})
    with transaction.atomic():
        payment = Payment.objects.filter(tenant=tenant, pk=payment_id, removes__isnull=True).first()
        if payment is None:
            raise NotFound(_("This payment is not in your library."))
        student = get_student(tenant=tenant, student_id=payment.student_id, lock=True)
        payment = Payment.objects.select_for_update().get(pk=payment.pk)
        if payment.status != RowStatus.LIVE:
            raise BusinessRuleViolation("already_removed", _("This payment is already removed."))
        latest = (
            Payment.objects.filter(student=student, status=RowStatus.LIVE, removes__isnull=True)
            .order_by("-created_at", "-id")
            .first()
        )
        if latest is None or latest.pk != payment.pk:
            raise BusinessRuleViolation(
                "not_latest_payment",
                _("Remove the newest payment first."),
                details={"latest_id": str(latest.pk) if latest else None},
            )
        Payment.objects.create(
            tenant=tenant, created_by=user, student=student, amount=payment.amount, mode=payment.mode,
            paid_on=today(tenant), months=-payment.months, paid_to_before=student.paid_to,
            credit_before=student.credit, status=RowStatus.REMOVED, removes=payment, reason=why,
        )
        Payment.objects.filter(pk=payment.pk).update(status=RowStatus.REMOVED)
        student.paid_to = payment.paid_to_before
        student.credit = payment.credit_before
        student.save(update_fields=["paid_to", "credit", "updated_at"])
        return student


def recalc(student: Student) -> tuple[dt.date | None, Decimal]:
    """Re-derive `paid_to` and `credit` from every live payment, in order."""
    paid_to, credit = None, Decimal("0.00")
    for p in Payment.objects.filter(student=student, status=RowStatus.LIVE, removes__isnull=True).order_by(
        "created_at", "id"
    ):
        applied = fees.apply_payment(
            paid_to=paid_to, credit=credit, amount=p.amount,
            monthly_fee=student.monthly_fee, joined_on=student.joined_on,
        )
        paid_to = applied.paid_to if (applied.months or paid_to) else None
        credit = applied.credit
    return paid_to, credit


# ── attendance ──────────────────────────────────────────────────────────────


def mark_in(*, tenant: Any, user: Any, student_id: Any) -> Attendance:
    student = get_student(tenant=tenant, student_id=student_id)
    if student.status == StudentStatus.LEFT:
        raise BusinessRuleViolation("student_left", _("%(name)s has left.") % {"name": student.name})
    day = today(tenant)
    row, _created = Attendance.objects.get_or_create(
        tenant=tenant, student=student, day=day, defaults={"in_at": timezone.now(), "created_by": user}
    )
    return row


def mark_out(*, tenant: Any, student_id: Any) -> Attendance:
    row = Attendance.objects.filter(tenant=tenant, student_id=student_id, day=today(tenant)).first()
    if row is None:
        raise BusinessRuleViolation("not_in", _("Mark them in first."))
    if row.out_at is None:
        row.out_at = timezone.now()
        row.save(update_fields=["out_at", "updated_at"])
    return row


# ── expenses ────────────────────────────────────────────────────────────────


def add_expense(*, tenant: Any, user: Any, data: dict) -> Expense:
    head = data.get("head")
    if head not in ExpenseHead.values:
        raise ValidationFailed(details={"head": [_("Choose what it was for.")]})
    return Expense.objects.create(
        tenant=tenant, created_by=user, head=head, amount=clean_amount(data.get("amount")),
        spent_on=clean_date(data.get("spent_on"), "spent_on", default=today(tenant), not_after=today(tenant)),
        note=clean_text(data.get("note"), "note"),
    )


def remove_expense(*, tenant: Any, expense_id: Any, reason: Any) -> Expense:
    why = clean_text(reason, "reason", REASON_MAX)
    if not why:
        raise ValidationFailed(details={"reason": [_("Say why, so the record makes sense later.")]})
    with transaction.atomic():
        row = Expense.objects.select_for_update().filter(tenant=tenant, pk=expense_id).first()
        if row is None:
            raise NotFound(_("This expense is not in your library."))
        if row.status == RowStatus.LIVE:
            row.status, row.reason = RowStatus.REMOVED, why
            row.save(update_fields=["status", "reason", "updated_at"])
        return row


# ── books ───────────────────────────────────────────────────────────────────


def add_book(*, tenant: Any, user: Any, data: dict, book_id: Any = None) -> Book:
    with transaction.atomic():
        book = Book.objects.select_for_update().filter(tenant=tenant, pk=book_id).first() if book_id else Book(
            tenant=tenant, created_by=user
        )
        if book is None:
            raise NotFound(_("This book is not in your library."))
        if "title" in data or not book_id:
            book.title = clean_name(data.get("title"), "title")
        if "code" in data:
            code = "".join(str(data.get("code") or "").split())
            if len(code) > 40:
                raise ValidationFailed(details={"code": [_("Use 40 letters or fewer.")]})
            other = Book.objects.filter(tenant=tenant, code=code).exclude(pk=book.pk).first() if code else None
            if other:
                raise BusinessRuleViolation(
                    "code_in_use", _("This barcode is on %(t)s.") % {"t": other.title}, details={"id": str(other.pk)}
                )
            book.code = code
        if "author" in data:
            book.author = clean_text(data.get("author"), "author", NAME_MAX)
        if "copies" in data or not book_id:
            try:
                copies = int(data.get("copies", 1))
            except (TypeError, ValueError):
                copies = 0
            if not 1 <= copies <= 999:
                raise ValidationFailed(details={"copies": [_("Choose 1 to 999 copies.")]})
            out = BookIssue.objects.filter(book_id=book.pk, back_on__isnull=True).count() if book.pk else 0
            if copies < out:
                raise BusinessRuleViolation(
                    "copies_out", _("%(n)s copies are with students now.") % {"n": out}, details={"out": out}
                )
            book.copies = copies
        book.save()
        return book


def give_book(*, tenant: Any, user: Any, book_id: Any, student_id: Any) -> BookIssue:
    with transaction.atomic():
        book = Book.objects.select_for_update().filter(tenant=tenant, pk=book_id).first()
        if book is None:
            raise NotFound(_("This book is not in your library."))
        student = get_student(tenant=tenant, student_id=student_id)
        if student.status == StudentStatus.LEFT:
            raise BusinessRuleViolation("student_left", _("%(name)s has left.") % {"name": student.name})
        out = BookIssue.objects.filter(book=book, back_on__isnull=True).aggregate(n=Count("id"))["n"]
        if out >= book.copies:
            raise BusinessRuleViolation("no_copy_left", _("Every copy of this book is out."))
        return BookIssue.objects.create(
            tenant=tenant, created_by=user, book=book, student=student, given_on=today(tenant)
        )


def take_back(*, tenant: Any, issue_id: Any) -> BookIssue:
    with transaction.atomic():
        issue = BookIssue.objects.select_for_update().filter(tenant=tenant, pk=issue_id).first()
        if issue is None:
            raise NotFound(_("This book is not out."))
        if issue.back_on is None:
            issue.back_on = today(tenant)
            issue.save(update_fields=["back_on", "updated_at"])
        return issue


# ── messages ────────────────────────────────────────────────────────────────


def record_message(*, tenant: Any, user: Any, student_id: Any, kind: Any, text: Any) -> Message:
    if kind not in MessageKind.values:
        raise ValidationFailed(details={"kind": [_("Choose a message.")]})
    body = str(text or "").strip()
    if not body or len(body) > 1000:
        raise ValidationFailed(details={"text": [_("Write the message.")]})
    student = get_student(tenant=tenant, student_id=student_id)
    return Message.objects.create(tenant=tenant, created_by=user, student=student, kind=kind, text=body)


def seed_library(ctx: Any, tenant: Any) -> None:
    """Switched on: a settings row and the three shifts every study library has.

    Fees start at ₹0 so nothing is guessed; the Home's set-up card asks for
    them and for the seat count. Idempotent: switching off and on adds nothing.
    """
    settings_for(tenant)
    if not Shift.objects.filter(tenant=tenant).exists():
        Shift.objects.bulk_create([
            Shift(tenant=tenant, name=_("Morning"), sort=0),
            Shift(tenant=tenant, name=_("Evening"), sort=1),
            Shift(tenant=tenant, name=_("Full day"), sort=2, is_full_day=True),
        ])
