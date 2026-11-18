"""Students from the paper register (QA F10, rebuilt 12 Nov 2026).

A reading room going live has a register of a couple of hundred students who
joined on a day and have paid up to a day. Each row becomes a student with that
"paid to" date and NO payment: nothing is counted as today's money, because
none changed hands today. Seat and shift are checked against the map and
against the file itself, so two rows can never land on one seat in one shift.
"""

from __future__ import annotations

from typing import Any

from apps.imports.registry import CoerceError, ColumnSpec, ImporterSpec, RowResult, coerce
from apps.imports.registry import register as register_importer

NAME_MAX = 120
MONEY_MAX = 9_999_999

COLUMNS = (
    ColumnSpec("name", required=True, help="required; the student's name",
               aliases=("student", "student_name", "member", "नाम")),
    ColumnSpec("mobile", help="10-digit mobile; +91 is optional",
               aliases=("phone", "mobile_no", "mobile_number", "contact", "फ़ोन")),
    ColumnSpec("shift", help="Morning, Evening or Full day, as in your shifts; blank if you have one",
               aliases=("timing", "batch")),
    ColumnSpec("seat", help="seat number, e.g. 14; blank for no seat", aliases=("seat_no", "seat_number")),
    ColumnSpec("monthly_fee", help="their fee a month, e.g. 800; blank for the shift's fee",
               aliases=("fee", "fees", "monthly", "फ़ीस"), kind="money"),
    ColumnSpec("joined", help="dd/mm/yyyy; the day they joined (blank means today)",
               aliases=("joined_on", "join_date", "admission_date"), kind="date"),
    ColumnSpec("paid_till", help="dd/mm/yyyy; the day their next fee is due",
               aliases=("paid_to", "paid_until", "valid_till", "next_due", "due_date"), kind="date"),
)

TEMPLATE_ROWS = (
    {"name": "Pooja Shinde", "mobile": "9890122311", "shift": "Morning", "seat": "8",
     "monthly_fee": "800", "joined": "04/06/2026", "paid_till": "02/11/2026"},
    {"name": "Rahul Gaikwad", "mobile": "9764011820", "shift": "Full day", "seat": "14",
     "monthly_fee": "1200", "joined": "02/01/2026", "paid_till": "25/10/2026"},
)


def _key(value: str) -> str:
    return " ".join(str(value).lower().split())


def preflight(tenant: Any) -> dict:
    from apps.common.dates import tenant_today
    from apps.library.constants import StudentStatus
    from apps.library.models import Seat, Shift, Student

    shifts = list(Shift.objects.filter(tenant=tenant, active=True))
    held: dict[int, list[Any]] = {}
    for number, shift_id, full in (
        Student.objects.filter(tenant=tenant, seat__isnull=False)
        .exclude(status=StudentStatus.LEFT)
        .values_list("seat__number", "shift_id", "shift__is_full_day")
    ):
        held.setdefault(number, []).append((shift_id, full))
    return {
        "tenant": tenant,
        "today": tenant_today(tenant),
        "shifts": {_key(s.name): s for s in shifts},
        "only_shift": shifts[0] if len(shifts) == 1 else None,
        "seats": set(Seat.objects.filter(tenant=tenant, active=True).values_list("number", flat=True)),
        "held": held,
        "mobiles": {
            m: n for m, n in Student.objects.filter(tenant=tenant).exclude(status=StudentStatus.LEFT)
            .exclude(mobile="").values_list("mobile", "name")
        },
        "names": {_key(n): n for n in Student.objects.filter(tenant=tenant).values_list("name", flat=True)},
    }


def _clashes(ctx: dict, seat: int, shift: Any) -> bool:
    return any(full or shift.is_full_day or sid == shift.pk for sid, full in ctx["held"].get(seat, []))


def validate_row(ctx: dict, row: dict[str, str], number: int) -> RowResult:
    result = RowResult()

    def attempt(column: str, fn: Any, *args: Any, **kwargs: Any) -> Any:
        try:
            return fn(row.get(column, ""), *args, **kwargs)
        except CoerceError as exc:
            result.error(column, exc.code, exc.message)
            return None

    name = " ".join(coerce.text(row.get("name")).split())
    if not 1 <= len(name) <= NAME_MAX:
        result.error("name", "invalid_name", "Enter a name (up to 120 letters).")
    mobile = attempt("mobile", coerce.mobile)
    if mobile and mobile in ctx["mobiles"]:
        result.error("mobile", "already_student", f"{ctx['mobiles'][mobile]} already has this mobile.")
    elif not mobile and name and _key(name) in ctx["names"]:
        result.duplicate = ctx["names"][_key(name)]

    raw_shift = row.get("shift", "")
    shift = None
    if coerce.is_blank(raw_shift):
        shift = ctx["only_shift"]
        if shift is None:
            result.error("shift", "required", "Write the shift — you have more than one.")
    else:
        shift = ctx["shifts"].get(_key(coerce.text(raw_shift)))
        if shift is None:
            result.error("shift", "unknown_shift", "No shift by this name.")

    seat = None
    raw_seat = coerce.text(row.get("seat", "")).strip()
    if raw_seat:
        try:
            seat = int(raw_seat)
        except ValueError:
            seat = -1
        if seat not in ctx["seats"]:
            result.error("seat", "unknown_seat", "No seat with this number on your seat map.")
            seat = None
        elif shift is not None and _clashes(ctx, seat, shift):
            result.error("seat", "seat_taken", "Seat already taken in this shift.")
            seat = None

    fee = attempt("monthly_fee", coerce.money, maximum=MONEY_MAX)
    if not fee and shift is not None:
        fee = shift.monthly_fee
    if not fee:
        result.error("monthly_fee", "required", "Write the monthly fee, or set the shift's fee first.")
    joined = attempt("joined", coerce.date_value, today=ctx["today"]) or ctx["today"]
    paid_till = attempt("paid_till", coerce.date_value)
    if joined > ctx["today"]:
        result.error("joined", "invalid_date", "The joining day is after today.")
    if paid_till is not None and paid_till < joined:
        result.error("paid_till", "invalid_date", "Paid till is before the day they joined.")
    if paid_till is None and not result.errors:
        result.warn("paid_till", "paid_till_assumed", "No paid-till date: the first fee is due on joining.")

    if not result.errors:
        if seat is not None:
            # Two rows of the same file on one seat and shift: the second is refused.
            ctx["held"].setdefault(seat, []).append((shift.pk, shift.is_full_day))
        if mobile:
            ctx["mobiles"][mobile] = name
    result.clean = {
        "name": name, "mobile": mobile or "", "shift_id": str(shift.pk) if shift else None,
        "seat": seat, "monthly_fee": str(fee or ""), "joined_on": joined.isoformat(),
        "paid_to": paid_till.isoformat() if paid_till else None,
    }
    result.tally = {"students": 1}
    result.preview = {
        "name": name, "mobile": mobile, "shift": shift.name if shift else None, "seat": seat,
        "monthly_fee": str(fee) if fee else None, "joined": joined.isoformat(),
        "paid_till": paid_till.isoformat() if paid_till else None,
    }
    return result


def commit_rows(ctx: dict, service_ctx: Any, rows: list[tuple[int, dict]], progress: Any) -> dict:
    """The enrol service per row, then the register's paid-to date. No payment row."""
    import datetime as dt

    from apps.library.models import Student
    from apps.library.services import enrol_student

    created = 0
    for index, (_number, clean) in enumerate(rows, start=1):
        data = {k: v for k, v in clean.items() if k != "paid_to"}
        student = enrol_student(tenant=service_ctx.tenant, user=service_ctx.actor, data=data)
        if clean.get("paid_to"):
            Student.objects.filter(pk=student.pk).update(paid_to=dt.date.fromisoformat(clean["paid_to"]))
        created += 1
        progress(index)
    return {"created_students": created}


def register() -> ImporterSpec:
    return register_importer(
        ImporterSpec(
            kind="students",
            label="imports.kind.students",
            columns=COLUMNS,
            template_rows=TEMPLATE_ROWS,
            required_permissions=("library.member.write",),
            read_permission="library.member.read",
            preflight=preflight,
            validate_row=validate_row,
            commit_rows=commit_rows,
            unique_columns=("mobile",),
            max_rows=5_000,
            modules=("library",),
            summary_fields=("created_students",),
            records_route="/library/students",
        )
    )

