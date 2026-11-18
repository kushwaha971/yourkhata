"""Every read of a Money Book. Totals are over the FILTERED set, never the page;
the balance after each entry is computed, never stored."""

from __future__ import annotations

import datetime as dt
from decimal import Decimal
from typing import Any

from django.db.models import Count, F, Q, Sum, Value, Window
from django.db.models.functions import Coalesce, Lower

from apps.moneybook.constants import EntryKind, EntryStatus
from apps.moneybook.models import Entry, Person, Settings

ZERO = Decimal("0.00")

SORTS = {
    # By the day the last entry was FOR, then when it was typed: a back-dated
    # entry (yesterday's ₹500, typed today) must not jump its person to the top.
    "last_entry": (
        F("last_entry_date").desc(nulls_last=True),
        F("last_entry_at").desc(nulls_last=True),
        F("id").desc(),
    ),
    "name": (Lower("name").asc(), F("id").asc()),
    "amount": (F("balance").desc(), F("id").desc()),
}


def people(*, owner: Any, q: str = "", balance: str = "all", status: str = "active", sort: str = "last_entry") -> Any:
    rows = Person.objects.filter(owner=owner)
    rows = rows.filter(archived_at__isnull=status != "archived")
    q = " ".join((q or "").split())
    if q:
        digits = "".join(ch for ch in q if ch.isdigit())
        match = Q(name__icontains=q)
        if len(digits) >= 3:
            match |= Q(mobile__contains=digits)
        rows = rows.filter(match)
    if balance == "get":
        rows = rows.filter(balance__gt=0)
    elif balance == "give":
        rows = rows.filter(balance__lt=0)
    elif balance == "settled":
        rows = rows.filter(balance=0)
    return rows.order_by(*SORTS.get(sort, SORTS["last_entry"]))


def totals(rows: Any) -> dict:
    agg = rows.order_by().aggregate(
        to_get=Coalesce(Sum("balance", filter=Q(balance__gt=0)), Value(ZERO)),
        to_give=Coalesce(Sum("balance", filter=Q(balance__lt=0)), Value(ZERO)),
        people_to_get=Count("id", filter=Q(balance__gt=0)),
        people_to_give=Count("id", filter=Q(balance__lt=0)),
        people=Count("id"),
    )
    to_give = -agg["to_give"]
    return {
        "to_get": f"{agg['to_get']:.2f}",
        "to_give": f"{to_give:.2f}",
        "net": f"{agg['to_get'] - to_give:.2f}",
        "people_to_get": agg["people_to_get"],
        "people_to_give": agg["people_to_give"],
        "people": agg["people"],
    }


def _signed_amount() -> Any:
    from django.db.models import Case, When

    return Case(When(kind=EntryKind.GAVE, then=F("amount")), default=-F("amount"))


ORDER = ("entry_date", "sort_at", "id")


def entries(*, person: Person, include_removed: bool = False) -> list[Entry]:
    """Newest first, each with `balance_after`.

    The window runs over every row of this person (removals included, since
    each pair cancels), so a row's figure is the balance as it stood after it.
    A removed original and its removal share `sort_at`, so they sit together
    and every live row between them reads true.
    """
    rows = (
        Entry.objects.filter(person=person)
        .annotate(
            balance_after=Window(
                Sum(_signed_amount()),
                order_by=[F(name).asc() for name in ORDER],
            )
        )
        .order_by(*[F(name).desc() for name in ORDER])
    )
    result = list(rows)
    if not include_removed:
        result = [e for e in result if e.status == EntryStatus.LIVE]
    return result


def report(*, owner: Any, person_id: Any = None, date_from: dt.date | None = None, date_to: dt.date | None = None) -> dict:
    """All people (or one), any dates: the design's Report (I3)."""
    rows = Entry.objects.filter(owner=owner, status=EntryStatus.LIVE).select_related("person")
    if person_id:
        rows = rows.filter(person_id=person_id)
    if date_from:
        rows = rows.filter(entry_date__gte=date_from)
    if date_to:
        rows = rows.filter(entry_date__lte=date_to)
    agg = rows.aggregate(
        gave=Coalesce(Sum("amount", filter=Q(kind=EntryKind.GAVE)), Value(ZERO)),
        got=Coalesce(Sum("amount", filter=Q(kind=EntryKind.GOT)), Value(ZERO)),
        gave_entries=Count("id", filter=Q(kind=EntryKind.GAVE)),
        got_entries=Count("id", filter=Q(kind=EntryKind.GOT)),
    )
    book = Person.objects.filter(owner=owner, archived_at__isnull=True)
    if person_id:
        book = Person.objects.filter(owner=owner, pk=person_id)
    now = totals(book)
    return {
        "you_gave": f"{agg['gave']:.2f}",
        "you_gave_entries": agg["gave_entries"],
        "you_got": f"{agg['got']:.2f}",
        "you_got_entries": agg["got_entries"],
        "to_get_now": now["to_get"],
        "people_to_get": now["people_to_get"],
        "to_give_now": now["to_give"],
        "people_to_give": now["people_to_give"],
        "rows": rows.order_by("-entry_date", "-sort_at", "-id"),
    }


def old_dues(*, owner: Any, days: int, today: dt.date) -> Any:
    """People who owe the owner and have had no entry for `days` days."""
    since = today - dt.timedelta(days=days)
    return (
        Person.objects.filter(owner=owner, archived_at__isnull=True, balance__gt=0)
        .filter(Q(last_entry_date__lte=since) | Q(last_entry_date__isnull=True))
        .order_by(F("last_entry_date").asc(nulls_first=True), "id")
    )


def settings_for(owner: Any) -> Settings:
    return Settings.objects.filter(owner=owner).first() or Settings(owner=owner)
