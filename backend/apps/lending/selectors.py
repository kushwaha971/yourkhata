"""Every read a lender's screen makes. Positions are computed from the schedule
and the collections each time; nothing is cached, so a removed collection or a
new day changes every figure at once."""

from __future__ import annotations

import datetime as dt
from collections import defaultdict
from decimal import Decimal
from typing import Any

from django.db.models import Count, Q, Sum

from apps.lending import book
from apps.lending.constants import LoanStatus, MessageKind, RowStatus, StopState
from apps.lending.models import Borrower, Collection, Due, Loan, Route, Visit
from apps.lending.services import today

ZERO = Decimal("0.00")


def money(v: Decimal | None) -> str:
    return f"{(v or ZERO):.2f}"


def _dues_by_loan(loans: list[Loan]) -> dict[Any, list[tuple[int, dt.date, Decimal]]]:
    out: dict[Any, list] = defaultdict(list)
    for loan_id, seq, on, amount in Due.objects.filter(loan__in=loans).order_by("loan_id", "seq").values_list(
        "loan_id", "seq", "due_on", "amount"
    ):
        out[loan_id].append((seq, on, amount))
    return out


def _collected_by_loan(loans: list[Loan], *, before: dt.date | None = None, on: dt.date | None = None) -> dict[Any, Decimal]:
    rows = Collection.objects.filter(loan__in=loans, status=RowStatus.LIVE, removes__isnull=True)
    if before is not None:
        rows = rows.filter(collected_on__lt=before)
    if on is not None:
        rows = rows.filter(collected_on=on)
    return {r["loan_id"]: r["t"] for r in rows.values("loan_id").annotate(t=Sum("amount"))}


def loan_json(loan: Loan, pos: book.Position, day: dt.date) -> dict:
    b = loan.borrower
    return {
        "id": str(loan.pk),
        "number": loan.number,
        "borrower_id": str(b.pk),
        "borrower": b.name,
        "mobile": b.mobile,
        "work": b.work,
        "route_id": str(loan.route_id) if loan.route_id else None,
        "route": loan.route.name if loan.route_id else "",
        "lent": money(loan.lent),
        "charges": money(loan.charges),
        "frequency": loan.frequency,
        "count": loan.count,
        "each": money(loan.each),
        "starts_on": loan.starts_on.isoformat(),
        "status": loan.status,
        "closed_on": loan.closed_on.isoformat() if loan.closed_on else None,
        "close_reason": loan.close_reason,
        "total": money(pos.total),
        "collected": money(pos.collected),
        "late": money(pos.late),
        "late_days": pos.late_days,
        "late_since": pos.late_since.isoformat() if pos.late_since else None,
        "due_today": money(pos.due_today),
        "left": money(pos.left),
        "paid_count": pos.paid_count,
        "next_due": pos.next_due.isoformat() if pos.next_due else None,
        "ends_on": pos.ends_on.isoformat() if pos.ends_on else None,
        "created_on": loan.created_at.date().isoformat(),
    }


def positions(tenant: Any, loans: list[Loan], day: dt.date) -> dict[Any, book.Position]:
    dues = _dues_by_loan(loans)
    paid = _collected_by_loan(loans)
    return {l.pk: book.position(dues=dues.get(l.pk, []), collected=paid.get(l.pk, ZERO), day=day) for l in loans}


def active_loans(tenant: Any, *, route: str = "") -> list[Loan]:
    rows = Loan.objects.filter(tenant=tenant, status=LoanStatus.ACTIVE).select_related("borrower", "route")
    if route:
        rows = rows.filter(route_id=route)
    return list(rows.order_by("borrower__name", "number"))


def round_for(tenant: Any, *, route: str = "", day: dt.date | None = None) -> dict:
    """I8 — the collector's round: who to visit today, and how the day stands."""
    day = day or today(tenant)
    loans = active_loans(tenant, route=route)
    dues = _dues_by_loan(loans)
    before = _collected_by_loan(loans, before=day)
    today_paid = _collected_by_loan(loans, on=day)
    visits = {v.loan_id: v for v in Visit.objects.filter(loan__in=loans, day=day)}
    # Loans that closed today were in this morning's round too.
    closed_today = list(
        Loan.objects.filter(tenant=tenant, status=LoanStatus.CLOSED, closed_on=day, **({"route_id": route} if route else {}))
        .select_related("borrower", "route")
    )
    if closed_today:
        loans += closed_today
        dues.update(_dues_by_loan(closed_today))
        before.update(_collected_by_loan(closed_today, before=day))
        today_paid.update(_collected_by_loan(closed_today, on=day))
    stops, due_sum, got_sum = [], ZERO, ZERO
    for loan in loans:
        ds = dues.get(loan.pk, [])
        morning = book.position(dues=ds, collected=before.get(loan.pk, ZERO), day=day)
        expected = morning.due_today + morning.late
        if expected <= 0:
            continue
        got = today_paid.get(loan.pk, ZERO)
        now = book.position(dues=ds, collected=before.get(loan.pk, ZERO) + got, day=day)
        if got > 0 and now.due_today == 0:
            state = StopState.DONE
        elif loan.pk in visits:
            state = StopState.NOT_PAID
        elif now.late > 0:
            state = StopState.LATE
        else:
            state = StopState.DUE
        due_sum += expected
        got_sum += min(got, expected)
        v = visits.get(loan.pk)
        stops.append({
            **loan_json(loan, now, day),
            "today": money(morning.due_today),
            "late_at_start": money(morning.late),
            "collected_today": money(got),
            "state": state,
            "reason": v.reason if v else "",
            "promised_on": v.promised_on.isoformat() if v and v.promised_on else None,
        })
    order = {StopState.LATE: 0, StopState.DUE: 1, StopState.NOT_PAID: 2, StopState.DONE: 3}
    stops.sort(key=lambda s: (order[s["state"]], s["borrower"]))
    counts = defaultdict(int)
    for s in stops:
        counts[s["state"]] += 1
    route_row = Route.objects.filter(tenant=tenant, pk=route).first() if route else None
    return {
        "day": day.isoformat(),
        "route_id": str(route_row.pk) if route_row else None,
        "route": route_row.name if route_row else "",
        "due": money(due_sum),
        "collected": money(got_sum),
        "short": money(max(due_sum - got_sum, ZERO)),
        "stops": stops,
        "stops_total": len(stops),
        "stops_done": counts[StopState.DONE],
        "to_visit": counts[StopState.LATE] + counts[StopState.DUE],
        "not_paid": counts[StopState.NOT_PAID],
    }


def book_figures(tenant: Any, day: dt.date) -> dict:
    """The desktop Today's other two figures: Late across the book, lent this month."""
    loans = active_loans(tenant)
    pos = positions(tenant, loans, day)
    late = [p for p in pos.values() if p.late > 0]
    month = Loan.objects.filter(tenant=tenant, created_at__date__gte=day.replace(day=1), created_at__date__lte=day)
    agg = month.aggregate(t=Sum("lent"), n=Count("id"))
    return {
        "late": money(sum((p.late for p in late), ZERO)),
        "late_borrowers": len({l.borrower_id for l in loans if pos[l.pk].late > 0}),
        "lent_month": money(agg["t"]),
        "loans_month": agg["n"],
    }


def loans_list(tenant: Any, *, status: str = "active", route: str = "", q: str = "") -> list[dict]:
    day = today(tenant)
    rows = Loan.objects.filter(tenant=tenant).select_related("borrower", "route")
    if status in LoanStatus.values:
        rows = rows.filter(status=status)
    if route:
        rows = rows.filter(route_id=route)
    if q:
        rows = rows.filter(Q(borrower__name__icontains=q) | Q(number__icontains=q) | Q(borrower__mobile__contains=q))
    loans = list(rows.order_by("-created_at"))
    pos = positions(tenant, loans, day)
    return [loan_json(l, pos[l.pk], day) for l in loans]


def loan_detail(tenant: Any, loan: Loan) -> dict:
    day = today(tenant)
    ds = list(Due.objects.filter(loan=loan).order_by("seq").values_list("seq", "due_on", "amount"))
    live = list(Collection.objects.filter(loan=loan, removes__isnull=True).order_by("-collected_on", "-created_at"))
    total = sum((c.amount for c in live if c.status == RowStatus.LIVE), ZERO)
    pos = book.position(dues=ds, collected=total, day=day)
    # Each schedule row's state, paying oldest first.
    money_left = total
    schedule = []
    for seq, on, amount in ds:
        paid = min(money_left, amount)
        money_left -= paid
        if paid == amount:
            state = "collected"
        elif on < day:
            state = "late"
        elif on == day:
            state = "due"
        else:
            state = "upcoming"
        schedule.append({"seq": seq, "due_on": on.isoformat(), "amount": money(amount), "paid": money(paid), "state": state})
    return {
        **loan_json(loan, pos, day),
        "schedule": schedule,
        "collections": [
            {"id": str(c.pk), "amount": money(c.amount), "mode": c.mode, "collected_on": c.collected_on.isoformat(),
             "status": c.status, "by": getattr(c.created_by, "full_name", "") or getattr(c.created_by, "email", "")}
            for c in live
        ],
        "visits": [
            {"day": v.day.isoformat(), "reason": v.reason, "promised_on": v.promised_on.isoformat() if v.promised_on else None}
            for v in Visit.objects.filter(loan=loan).order_by("-day")[:20]
        ],
        "days_to_go": book.days_to_go(dues=ds, day=day),
    }


def borrowers_list(tenant: Any, q: str = "") -> list[dict]:
    day = today(tenant)
    rows = Borrower.objects.filter(tenant=tenant, active=True).select_related("route")
    if q:
        rows = rows.filter(Q(name__icontains=q) | Q(mobile__contains=q) | Q(work__icontains=q))
    borrowers = list(rows.order_by("name"))
    loans = list(Loan.objects.filter(borrower__in=borrowers, status=LoanStatus.ACTIVE).select_related("borrower", "route"))
    pos = positions(tenant, loans, day)
    by: dict[Any, list[Loan]] = defaultdict(list)
    for l in loans:
        by[l.borrower_id].append(l)
    return [
        {
            "id": str(b.pk), "name": b.name, "mobile": b.mobile, "work": b.work,
            "route_id": str(b.route_id) if b.route_id else None, "route": b.route.name if b.route_id else "",
            "note": b.note,
            "loans": len(by[b.pk]),
            "left": money(sum((pos[l.pk].left for l in by[b.pk]), ZERO)),
            "late": money(sum((pos[l.pk].late for l in by[b.pk]), ZERO)),
        }
        for b in borrowers
    ]


def remind_list(tenant: Any, kind: str) -> list[dict]:
    """I11 — Late, Due today, Due tomorrow."""
    day = today(tenant)
    loans = active_loans(tenant)
    pos = positions(tenant, loans, day)
    tomorrow = day + dt.timedelta(days=1)
    tomorrow_due = set(
        Due.objects.filter(loan__in=loans, due_on=tomorrow).values_list("loan_id", flat=True)
    )
    out = []
    for loan in loans:
        p = pos[loan.pk]
        if kind == MessageKind.LATE and p.late > 0:
            out.append(loan_json(loan, p, day))
        elif kind == MessageKind.DUE_TODAY and p.due_today > 0:
            out.append(loan_json(loan, p, day))
        elif kind == MessageKind.DUE_TOMORROW and loan.pk in tomorrow_due and p.left > 0:
            out.append(loan_json(loan, p, day))
    if kind == MessageKind.LATE:
        out.sort(key=lambda r: (-r["late_days"], r["borrower"]))
    return out


def remind_counts(tenant: Any) -> dict:
    return {k: len(remind_list(tenant, k)) for k in (MessageKind.LATE, MessageKind.DUE_TODAY, MessageKind.DUE_TOMORROW)}
