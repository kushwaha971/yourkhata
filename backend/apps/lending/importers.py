"""Running loans from the paper register (QA F10, rebuilt 12 Nov 2026).

A lender going live has loans already running: lent on a day, collected some.
Each row becomes a borrower (or the borrower already in the book with that
mobile) and a loan with its whole schedule; what was collected so far comes in
as one collection dated the loan's last collection day before today, so it is
history and never today's cash.
"""

from __future__ import annotations

from typing import Any

from apps.imports.registry import CoerceError, ColumnSpec, ImporterSpec, RowResult, coerce
from apps.imports.registry import register as register_importer

MONEY_MAX = 99_999_999

COLUMNS = (
    ColumnSpec("name", required=True, help="required; the borrower's name", aliases=("borrower", "नाम")),
    ColumnSpec("mobile", help="10-digit mobile; +91 is optional", aliases=("phone", "mobile_no", "फ़ोन")),
    ColumnSpec("work", help="what they do, e.g. Tea stall", aliases=("business", "shop", "kaam")),
    ColumnSpec("route", help="route name; a new name adds the route", aliases=("line", "area")),
    ColumnSpec("lent", required=True, help="amount lent, e.g. 20000", aliases=("amount", "loan"), kind="money"),
    ColumnSpec("frequency", help="daily, weekly or monthly (blank = daily)", aliases=("plan", "collect")),
    ColumnSpec("count", required=True, help="number of collections, e.g. 40", aliases=("instalments", "days")),
    ColumnSpec("each", required=True, help="amount each time, e.g. 500", aliases=("each_instalment", "installment"), kind="money"),
    ColumnSpec("given_on", help="dd/mm/yyyy; the first collection day", aliases=("starts_on", "start", "date"), kind="date"),
    ColumnSpec("collected", help="collected so far, e.g. 4500", aliases=("paid", "received"), kind="money"),
)

TEMPLATE_ROWS = (
    {"name": "Sunil Mane", "mobile": "9822041178", "work": "Tea stall", "route": "Market road", "lent": "20000",
     "frequency": "daily", "count": "40", "each": "500", "given_on": "02/11/2026", "collected": "4500"},
)


def preflight(tenant: Any) -> dict:
    from apps.common.dates import tenant_today
    from apps.lending.models import Borrower, Route

    return {
        "tenant": tenant,
        "today": tenant_today(tenant),
        "routes": {r.name.lower(): r for r in Route.objects.filter(tenant=tenant)},
        "mobiles": {b.mobile: b for b in Borrower.objects.filter(tenant=tenant, active=True).exclude(mobile="")},
    }


def validate_row(ctx: dict, row: dict[str, str], number: int) -> RowResult:
    from decimal import Decimal

    from apps.lending import book

    result = RowResult()

    def attempt(column: str, fn: Any, *args: Any, **kwargs: Any) -> Any:
        try:
            return fn(row.get(column, ""), *args, **kwargs)
        except CoerceError as exc:
            result.error(column, exc.code, exc.message)
            return None

    name = " ".join(coerce.text(row.get("name")).split())
    if not 1 <= len(name) <= 120:
        result.error("name", "invalid_name", "Enter a name (up to 120 letters).")
    mobile = attempt("mobile", coerce.mobile)
    frequency = (coerce.text(row.get("frequency")) or "daily").strip().lower()
    if frequency not in ("daily", "weekly", "monthly"):
        result.error("frequency", "invalid_frequency", "Write daily, weekly or monthly.")
    try:
        count = int(coerce.text(row.get("count")).strip())
    except ValueError:
        count = 0
    if not 1 <= count <= 400:
        result.error("count", "invalid_count", "Write how many collections, 1 to 400.")
    lent = attempt("lent", coerce.money, maximum=MONEY_MAX)
    each = attempt("each", coerce.money, maximum=MONEY_MAX)
    collected = attempt("collected", coerce.money, maximum=MONEY_MAX) or Decimal("0")
    given = attempt("given_on", coerce.date_value, today=ctx["today"]) or ctx["today"]
    if lent is not None and each and count and each * count < lent:
        result.error("each", "too_little", "These collections bring back less than was lent.")
    if each and count and collected > each * count:
        result.error("collected", "too_much", "More was collected than the loan brings back.")
    if not result.errors and collected and frequency in ("daily", "weekly", "monthly"):
        days = book.schedule_dates(starts_on=given, frequency=frequency, count=count, skip_sundays=frequency == "daily")
        past = [d for d in days if d < ctx["today"]]
        if not past:
            result.error("collected", "not_started", "Nothing can be collected before the first collection day.")
    route = coerce.text(row.get("route")).strip()
    result.clean = {
        "name": name, "mobile": mobile or "", "work": coerce.text(row.get("work")).strip(), "route": route,
        "lent": str(lent or ""), "frequency": frequency, "count": count, "each": str(each or ""),
        "starts_on": given.isoformat(), "collected": str(collected),
    }
    if mobile and mobile in ctx["mobiles"]:
        result.duplicate = ctx["mobiles"][mobile].name
    result.tally = {"loans": 1}
    result.preview = {**result.clean}
    return result


def commit_rows(ctx: dict, service_ctx: Any, rows: list[tuple[int, dict]], progress: Any) -> dict:
    import datetime as dt
    from decimal import Decimal

    from apps.lending import book, services
    from apps.lending.models import Borrower, Collection, Route

    tenant, user = service_ctx.tenant, service_ctx.actor
    today = ctx["today"]
    created = 0
    for index, (_n, c) in enumerate(rows, start=1):
        route = None
        if c["route"]:
            route = ctx["routes"].get(c["route"].lower())
            if route is None:
                route = services.save_route(tenant=tenant, user=user, data={"name": c["route"]})
                ctx["routes"][c["route"].lower()] = route
        borrower = Borrower.objects.filter(tenant=tenant, mobile=c["mobile"], active=True).first() if c["mobile"] else None
        if borrower is None:
            borrower = services.save_borrower(
                tenant=tenant, user=user,
                data={"name": c["name"], "mobile": c["mobile"], "work": c["work"], "route_id": str(route.pk) if route else None},
            )
        loan = services.create_loan(
            tenant=tenant, user=user,
            data={"borrower_id": str(borrower.pk), "route_id": str(route.pk) if route else None, "lent": c["lent"],
                  "frequency": c["frequency"], "count": c["count"], "each": c["each"], "starts_on": c["starts_on"]},
        )
        paid = Decimal(c["collected"] or "0")
        if paid > 0:
            days = book.schedule_dates(starts_on=dt.date.fromisoformat(c["starts_on"]), frequency=c["frequency"],
                                       count=c["count"], skip_sundays=c["frequency"] == "daily")
            on = max(d for d in days if d < today)
            Collection.objects.create(tenant=tenant, created_by=user, loan=loan, amount=paid, mode="cash", collected_on=on)
        created += 1
        progress(index)
    return {"created_loans": created}


def register() -> ImporterSpec:
    return register_importer(
        ImporterSpec(
            kind="loans",
            label="imports.kind.loans",
            columns=COLUMNS,
            template_rows=TEMPLATE_ROWS,
            required_permissions=("lending.loan.create",),
            read_permission="lending.loan.read",
            preflight=preflight,
            validate_row=validate_row,
            commit_rows=commit_rows,
            unique_columns=(),
            max_rows=5_000,
            modules=("lending",),
            summary_fields=("created_loans",),
            records_route="/lending/loans",
        )
    )
