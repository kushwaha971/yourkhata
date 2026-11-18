"""The lending rules, with no database in it (01-model-and-api.md, "The money rule").

A loan is a fixed schedule of collections. Money collected pays the schedule
oldest first; on any day a loan then has a collected, a late (unpaid money on
earlier days), a due today and a left. Nothing here is cached anywhere.
"""

from __future__ import annotations

import calendar
import datetime as dt
from dataclasses import dataclass
from decimal import Decimal

from apps.lending.constants import Frequency

ZERO = Decimal("0.00")
ONE_DAY = dt.timedelta(days=1)
SUNDAY = 6


def add_months(day: dt.date, months: int, anchor: int) -> dt.date:
    month0 = day.month - 1 + months
    year = day.year + month0 // 12
    month = month0 % 12 + 1
    return dt.date(year, month, min(anchor, calendar.monthrange(year, month)[1]))


def schedule_dates(*, starts_on: dt.date, frequency: str, count: int, skip_sundays: bool) -> list[dt.date]:
    """The days money is collected. Daily skips Sundays when asked; weekly and
    monthly keep the starting weekday / day of month (a monthly on the 31st
    lands on the 30th or 28th and comes back to the 31st)."""
    days: list[dt.date] = []
    if frequency == Frequency.DAILY:
        day = starts_on
        while len(days) < count:
            if not (skip_sundays and day.weekday() == SUNDAY):
                days.append(day)
            day += ONE_DAY
    elif frequency == Frequency.WEEKLY:
        days = [starts_on + dt.timedelta(weeks=i) for i in range(count)]
    else:
        days = [add_months(starts_on, i, starts_on.day) for i in range(count)]
    return days


def schedule(*, starts_on: dt.date, frequency: str, count: int, each: Decimal, skip_sundays: bool) -> list[tuple[int, dt.date, Decimal]]:
    """(seq, day, amount) for every collection; every one is `each`."""
    return [
        (i + 1, day, each)
        for i, day in enumerate(schedule_dates(starts_on=starts_on, frequency=frequency, count=count, skip_sundays=skip_sundays))
    ]


@dataclass(frozen=True)
class Position:
    """A loan on a day."""

    total: Decimal          # the whole schedule
    collected: Decimal      # every live collection
    late: Decimal           # unpaid money on days before `day`
    late_days: int          # how many earlier collection days are not (fully) paid
    late_since: dt.date | None
    due_today: Decimal      # unpaid money on `day` itself
    left: Decimal           # total − collected
    paid_count: int         # collection days fully paid
    next_due: dt.date | None  # the first day from `day` on with money unpaid
    ends_on: dt.date | None


def position(*, dues: list[tuple[int, dt.date, Decimal]], collected: Decimal, day: dt.date) -> Position:
    """Collections pay the schedule oldest first."""
    total = sum((a for _s, _d, a in dues), ZERO)
    money = collected
    late = due_today = ZERO
    late_days = paid_count = 0
    late_since = next_due = None
    for _seq, on, amount in dues:
        paid = min(money, amount)
        money -= paid
        unpaid = amount - paid
        if unpaid == 0:
            paid_count += 1
            continue
        if on < day:
            late += unpaid
            late_days += 1
            late_since = late_since or on
        elif on == day:
            due_today += unpaid
        if on >= day and next_due is None:
            next_due = on
    return Position(
        total=total,
        collected=collected,
        late=late,
        late_days=late_days,
        late_since=late_since,
        due_today=due_today,
        left=max(total - collected, ZERO),
        paid_count=paid_count,
        next_due=next_due,
        ends_on=dues[-1][1] if dues else None,
    )


def after(*, dues: list[tuple[int, dt.date, Decimal]], collected: Decimal, amount: Decimal, day: dt.date) -> Position:
    """The same loan after `amount` more is collected today (the sheet's "After this")."""
    return position(dues=dues, collected=collected + amount, day=day)


def days_to_go(*, dues: list[tuple[int, dt.date, Decimal]], day: dt.date) -> int:
    return sum(1 for _s, on, _a in dues if on >= day)
