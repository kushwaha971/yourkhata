"""Every read a library screen makes. Fee status is computed here from the
student's caches and today, never stored: "due soon" changes at midnight with
no write at all."""

from __future__ import annotations

import datetime as dt
from collections import Counter
from decimal import Decimal
from typing import Any

from django.db.models import Count, Q, Sum

from apps.library import fees
from apps.library.constants import FeeStatus, RowStatus, StudentStatus
from apps.library.models import Attendance, Book, BookIssue, Expense, Payment, Seat, Shift, Student
from apps.library.services import settings_for, today

ZERO = Decimal("0.00")


def money(value: Decimal | None) -> str:
    return f"{(value or ZERO):.2f}"


def fee_of(student: Student, *, day: dt.date, due_soon_days: int) -> fees.FeeState:
    return fees.fee_state(
        status=student.status, paid_to=student.paid_to, credit=student.credit,
        monthly_fee=student.monthly_fee, joined_on=student.joined_on, today=day,
        due_soon_days=due_soon_days,
    )


def student_json(s: Student, state: fees.FeeState) -> dict:
    return {
        "id": str(s.pk),
        "name": s.name,
        "mobile": s.mobile,
        "seat": s.seat.number if s.seat_id else None,
        "shift_id": str(s.shift_id),
        "shift": s.shift.name,
        "full_day": s.shift.is_full_day,
        "monthly_fee": money(s.monthly_fee),
        "joined_on": s.joined_on.isoformat(),
        "paid_to": state.paid_to.isoformat(),
        "credit": money(s.credit),
        "status": s.status,
        "hold_until": s.hold_until.isoformat() if s.hold_until else None,
        "fee": state.status,
        "due": money(state.due),
        "days_late": state.days_late,
        "note": s.note,
    }


def students_with_fee(tenant: Any, *, include_left: bool = False) -> list[tuple[Student, fees.FeeState]]:
    day = today(tenant)
    soon = settings_for(tenant).due_soon_days
    rows = Student.objects.filter(tenant=tenant).select_related("seat", "shift")
    if not include_left:
        rows = rows.exclude(status=StudentStatus.LEFT)
    return [(s, fee_of(s, day=day, due_soon_days=soon)) for s in rows.order_by("name", "id")]


def students(tenant: Any, *, q: str = "", fee: str = "all", shift: str = "", status: str = "current") -> dict:
    pairs = students_with_fee(tenant, include_left=status in ("left", "all"))
    if status == "left":
        pairs = [p for p in pairs if p[0].status == StudentStatus.LEFT]
    if shift:
        pairs = [p for p in pairs if str(p[0].shift_id) == shift]
    if q:
        needle = q.strip().lower()
        digits = "".join(ch for ch in needle if ch.isdigit())
        pairs = [
            p for p in pairs
            if needle in p[0].name.lower()
            or (digits and digits in p[0].mobile)
            or (digits and p[0].seat_id and str(p[0].seat.number) == digits)
        ]
    current = [p for p in pairs if p[0].status != StudentStatus.LEFT]
    counts = Counter(st.status for _s, st in current)
    if fee != "all":
        pairs = [p for p in pairs if p[1].status == fee]
    return {
        "rows": pairs,
        "counts": {"all": len(current), **{k: counts.get(k, 0) for k in FeeStatus.values}},
        "due": money(sum((st.due for _s, st in pairs if st.status != FeeStatus.PAID), ZERO)),
    }


def shift_counts(tenant: Any) -> list[dict]:
    seats = Seat.objects.filter(tenant=tenant, active=True).count()
    full = Student.objects.filter(tenant=tenant, shift__is_full_day=True, seat__isnull=False).exclude(
        status=StudentStatus.LEFT
    ).count()
    out = []
    for sh in Shift.objects.filter(tenant=tenant, active=True):
        own = Student.objects.filter(tenant=tenant, shift=sh, seat__isnull=False).exclude(
            status=StudentStatus.LEFT
        ).count()
        filled = own if sh.is_full_day else own + full
        out.append({
            "id": str(sh.pk), "name": sh.name, "full_day": sh.is_full_day,
            "monthly_fee": money(sh.monthly_fee), "filled": filled, "seats": seats,
            "starts_at": sh.starts_at.isoformat(timespec="minutes") if sh.starts_at else None,
            "ends_at": sh.ends_at.isoformat(timespec="minutes") if sh.ends_at else None,
        })
    return out


def seat_map(tenant: Any, *, shift_id: str) -> dict:
    shift = Shift.objects.filter(tenant=tenant, pk=shift_id).first() if shift_id else None
    if shift is None:
        shift = Shift.objects.filter(tenant=tenant, active=True).first()
    day = today(tenant)
    soon = settings_for(tenant).due_soon_days
    holders: dict[int, Student] = {}
    if shift is not None:
        rows = Student.objects.filter(tenant=tenant, seat__isnull=False).exclude(status=StudentStatus.LEFT)
        if not shift.is_full_day:
            rows = rows.filter(Q(shift=shift) | Q(shift__is_full_day=True))
        else:
            # A full-day map shows a seat as taken by anybody in any shift.
            rows = rows.order_by("-shift__is_full_day")
        for s in rows.select_related("seat", "shift"):
            holders.setdefault(s.seat.number, s)
    seats = []
    for seat in Seat.objects.filter(tenant=tenant, active=True):
        s = holders.get(seat.number)
        seats.append({
            "number": seat.number,
            "student": student_json(s, fee_of(s, day=day, due_soon_days=soon)) if s else None,
        })
    filled = sum(1 for x in seats if x["student"])
    return {
        "shift_id": str(shift.pk) if shift else None,
        "seats": seats,
        "filled": filled,
        "empty": len(seats) - filled,
        "shifts": shift_counts(tenant),
    }


def month_start(day: dt.date) -> dt.date:
    return day.replace(day=1)


def collected(tenant: Any, start: dt.date, end: dt.date) -> tuple[Decimal, int]:
    agg = Payment.objects.filter(
        tenant=tenant, status=RowStatus.LIVE, removes__isnull=True, paid_on__gte=start, paid_on__lte=end
    ).aggregate(total=Sum("amount"), n=Count("id"))
    return agg["total"] or ZERO, agg["n"]


def home(tenant: Any) -> dict:
    day = today(tenant)
    soon_days = settings_for(tenant).due_soon_days
    pairs = students_with_fee(tenant)
    week_end = day + dt.timedelta(days=7)
    due_week = [
        (s, st) for s, st in pairs
        if st.status in (FeeStatus.SOON, FeeStatus.PART) and st.paid_to <= week_end and st.paid_to >= day
    ]
    over = [(s, st) for s, st in pairs if st.status in (FeeStatus.OVER, FeeStatus.PART) and st.days_late > 0]
    total, n = collected(tenant, month_start(day), day)
    seats = Seat.objects.filter(tenant=tenant, active=True).count()
    seated = Student.objects.filter(tenant=tenant, seat__isnull=False).exclude(status=StudentStatus.LEFT)
    order = {FeeStatus.OVER: 0, FeeStatus.PART: 1, FeeStatus.SOON: 2, FeeStatus.HOLD: 3}
    needs = sorted(
        [(s, st) for s, st in pairs if st.status in order],
        key=lambda p: (order[p[1].status], -p[1].days_late, p[1].paid_to, p[0].name),
    )
    return {
        "day": day.isoformat(),
        "seats": seats,
        "seats_filled": seated.values("seat").distinct().count(),
        "shifts": shift_counts(tenant),
        "collected": money(total),
        "payments": n,
        "due_week": money(sum((st.due for _s, st in due_week), ZERO)),
        "due_week_students": len(due_week),
        "overdue": money(sum((st.due for _s, st in over), ZERO)),
        "overdue_students": len(over),
        "today": [student_json(s, st) for s, st in needs[:20]],
        "students": len(pairs),
        "due_soon_days": soon_days,
    }


def fees_page(tenant: Any, *, fee: str = "over") -> dict:
    data = students(tenant, fee=fee)
    day = today(tenant)
    total, _n = collected(tenant, month_start(day), day)
    pairs = students_with_fee(tenant)
    to_come = sum((st.due for _s, st in pairs if st.status in (FeeStatus.OVER, FeeStatus.SOON, FeeStatus.PART)), ZERO)
    order = {FeeStatus.OVER: 0, FeeStatus.PART: 1, FeeStatus.SOON: 2, FeeStatus.HOLD: 3, FeeStatus.PAID: 4}
    rows = sorted(data["rows"], key=lambda p: (order[p[1].status], -p[1].days_late, p[0].name))
    return {
        "rows": [student_json(s, st) for s, st in rows],
        "counts": data["counts"],
        "collected": money(total),
        "to_come": money(to_come),
        "month": day.isoformat(),
    }


def payments_of(student: Student, *, include_removed: bool = False) -> list[Payment]:
    rows = Payment.objects.filter(student=student, removes__isnull=True)
    if not include_removed:
        rows = rows.filter(status=RowStatus.LIVE)
    return list(rows.order_by("-paid_on", "-created_at"))


def paid_this_year(student: Student, day: dt.date) -> tuple[Decimal, int]:
    agg = Payment.objects.filter(
        student=student, status=RowStatus.LIVE, removes__isnull=True, paid_on__year=day.year
    ).aggregate(total=Sum("amount"), n=Count("id"))
    return agg["total"] or ZERO, agg["n"]


def attendance_month(student: Student, month: dt.date) -> list[str]:
    start = month.replace(day=1)
    end = (start + dt.timedelta(days=32)).replace(day=1)
    return [
        d.isoformat()
        for d in Attendance.objects.filter(student=student, day__gte=start, day__lt=end).values_list("day", flat=True)
    ]


def attendance_day(tenant: Any, day: dt.date) -> list[Attendance]:
    return list(
        Attendance.objects.filter(tenant=tenant, day=day).select_related("student", "student__seat").order_by("in_at")
    )


def money_report(tenant: Any, *, start: dt.date, end: dt.date) -> dict:
    fees_in, n = collected(tenant, start, end)
    exp = Expense.objects.filter(tenant=tenant, status=RowStatus.LIVE, spent_on__gte=start, spent_on__lte=end)
    out = exp.aggregate(t=Sum("amount"))["t"] or ZERO
    heads = {r["head"]: money(r["t"]) for r in exp.values("head").annotate(t=Sum("amount"))}
    return {
        "from": start.isoformat(), "to": end.isoformat(),
        "fees": money(fees_in), "payments": n, "expenses": money(out), "net": money(fees_in - out),
        "heads": heads,
    }


def books(tenant: Any, q: str = "", code: str = "") -> list[dict]:
    rows = Book.objects.filter(tenant=tenant)
    if code:
        # A scan is an exact match, never a search: one scan, one book.
        rows = rows.filter(code="".join(code.split()))
    elif q:
        rows = rows.filter(Q(title__icontains=q) | Q(author__icontains=q))
    out = []
    issues = BookIssue.objects.filter(tenant=tenant, back_on__isnull=True).select_related("student")
    by_book: dict[Any, list[BookIssue]] = {}
    for i in issues:
        by_book.setdefault(i.book_id, []).append(i)
    for b in rows:
        out_now = by_book.get(b.pk, [])
        out.append({
            "id": str(b.pk), "title": b.title, "author": b.author, "copies": b.copies, "note": b.note, "code": b.code,
            "out": [
                {"id": str(i.pk), "student_id": str(i.student_id), "student": i.student.name,
                 "given_on": i.given_on.isoformat()}
                for i in out_now
            ],
            "left": b.copies - len(out_now),
        })
    return out


def library_setup(tenant: Any) -> list:
    """The Home's set-up card (docs/platform/14 step 5): what it charges, where
    people sit, and someone enrolled. Each is read from the books, never ticked."""
    from apps.platform_app.apps_registry import SetupStep

    return [
        SetupStep(
            key="plans",
            label_id="library.setup.plans",
            path="/library/settings",
            done=Shift.objects.filter(tenant=tenant, active=True, monthly_fee__gt=0).exists(),
            permission="library.settings.manage",
        ),
        SetupStep(
            key="seats",
            label_id="library.setup.seats",
            path="/library/seats",
            done=Seat.objects.filter(tenant=tenant, active=True).exists(),
            permission="library.settings.manage",
        ),
        SetupStep(
            key="student",
            label_id="library.setup.student",
            path="/library/students",
            done=Student.objects.filter(tenant=tenant).exists(),
            permission="library.member.write",
        ),
    ]
