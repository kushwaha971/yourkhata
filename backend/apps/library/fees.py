"""The fee rule, with no database in it (01-model-and-api.md, "The fee rule").

`paid_to` is the day the next fee is due ("Paid to 25 Nov"): the fee is late
the day AFTER it. Before any payment it is the joining day — a student owes on
the day they join, not the day before. Months move on the joining day's date,
so 31 Jan → 28 Feb → 31 Mar and never drifts to the 28th.
"""

from __future__ import annotations

import calendar
import datetime as dt
from dataclasses import dataclass
from decimal import Decimal

from apps.library.constants import FeeStatus, StudentStatus

ONE_DAY = dt.timedelta(days=1)
#: Never count more than ten years of unpaid months: a typo in a join date
#: must not loop for ever or print a fee nobody can read.
MAX_PERIODS = 120


def start_paid_to(joined_on: dt.date) -> dt.date:
    """Before any payment, the first fee is due on the joining day."""
    return joined_on


def anchor_day(joined_on: dt.date) -> int:
    return start_paid_to(joined_on).day


def add_months(day: dt.date, months: int, anchor: int) -> dt.date:
    month0 = day.month - 1 + months
    year = day.year + month0 // 12
    month = month0 % 12 + 1
    last = calendar.monthrange(year, month)[1]
    return dt.date(year, month, min(anchor, last))


@dataclass(frozen=True)
class Applied:
    months: int
    from_date: dt.date | None
    to_date: dt.date | None
    paid_to: dt.date
    credit: Decimal


def apply_payment(
    *, paid_to: dt.date | None, credit: Decimal, amount: Decimal, monthly_fee: Decimal, joined_on: dt.date
) -> Applied:
    """Whole months move `paid_to`; what is left stays as credit (Part paid)."""
    current = paid_to or start_paid_to(joined_on)
    money = credit + amount
    months = int(money // monthly_fee) if monthly_fee > 0 else 0
    left = money - monthly_fee * months if monthly_fee > 0 else money
    anchor = anchor_day(joined_on)
    new_paid_to = add_months(current, months, anchor) if months else current
    return Applied(
        months=months,
        # The days this payment pays for: from the due day to the day before the next.
        from_date=current if months else None,
        to_date=new_paid_to - ONE_DAY if months else None,
        paid_to=new_paid_to,
        credit=left,
    )


def periods_unpaid(*, paid_to: dt.date | None, joined_on: dt.date, today: dt.date) -> int:
    """How many monthly periods have started that the fee does not cover."""
    current = paid_to or start_paid_to(joined_on)
    anchor = anchor_day(joined_on)
    n = 0
    while n < MAX_PERIODS and add_months(current, n, anchor) < today:
        n += 1
    return n


@dataclass(frozen=True)
class FeeState:
    status: str
    due: Decimal
    days_late: int
    paid_to: dt.date


def fee_state(
    *,
    status: str,
    paid_to: dt.date | None,
    credit: Decimal,
    monthly_fee: Decimal,
    joined_on: dt.date,
    today: dt.date,
    due_soon_days: int,
) -> FeeState:
    current = paid_to or start_paid_to(joined_on)
    unpaid = periods_unpaid(paid_to=paid_to, joined_on=joined_on, today=today)
    days_late = max(0, (today - current).days)
    # What it takes to be paid up to the end of the current period.
    due = max(Decimal("0.00"), monthly_fee * unpaid - credit)
    if status == StudentStatus.HOLD:
        return FeeState(FeeStatus.HOLD, due, days_late, current)
    if unpaid > 0:
        # Late is late, whatever part was paid: three months behind with ₹300 put
        # down is Overdue, not "Part paid" (found 12 Nov). The part is taken off the due.
        return FeeState(FeeStatus.OVER, due, days_late, current)
    if credit > 0:
        # Part paid and not yet late: the rest of the month being paid for.
        return FeeState(FeeStatus.PART, max(monthly_fee - credit, Decimal("0.00")), 0, current)
    if (current - today).days < due_soon_days:
        return FeeState(FeeStatus.SOON, monthly_fee, 0, current)
    return FeeState(FeeStatus.PAID, Decimal("0.00"), 0, current)
