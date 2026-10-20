"""BP-15 read-only Shop Counter Mode facts; no financial postings."""

from __future__ import annotations

import datetime as dt
from typing import Any
from zoneinfo import ZoneInfo

from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.common.document_scope import shop_origin_q
from apps.common.money import ZERO
from apps.reports.constants import SALE_KINDS


def money(value: Any) -> str:
    return f"{value or ZERO:.2f}"


def role_lane(*, tenant: Any, today: dt.date, supplier: bool, can_mobile: bool) -> dict:
    """Group role balances by oldest open bill; never net customer and supplier."""
    from apps.parties.models import Party
    from apps.parties.selectors.shop import with_shop_facts
    from apps.reports.selectors.dashboard import mask_mobile

    stem = "supplier" if supplier else "customer"
    balance, due = f"shop_{stem}_balance", f"shop_{stem}_open_due_on"
    rows = with_shop_facts(Party.objects.for_tenant(tenant), tenant=tenant).filter(
        status="active", **{f"is_{stem}": True, f"{balance}__gt": ZERO}
    )
    late = Q(**{f"{due}__lt": today})
    old = Q(**{f"{due}__lt": today - dt.timedelta(days=30)})
    soon = Q(**{f"{due}__gte": today, f"{due}__lte": today + dt.timedelta(days=7)})
    predicates = (
        {"late": late, "soon": soon, "later": ~late & ~soon}
        if supplier
        else {
            "over30": old,
            "late30": late & ~old,
            "not_due": ~late,
        }
    )
    stats = rows.aggregate(
        total=Sum(balance),
        count=Count("id"),
        **{key: Sum(balance, filter=predicate) for key, predicate in predicates.items()},
    )
    people = []
    for person in rows.order_by(due, "name", "id")[:3]:
        due_on = getattr(person, due)
        people.append(
            {
                "id": str(person.id),
                "name": person.name,
                "amount": money(getattr(person, balance)),
                "due_on": due_on.isoformat() if due_on else None,
                "days_late": max(0, (today - due_on).days) if due_on else 0,
                "mobile": person.mobile if can_mobile else None,
                "mobile_masked": mask_mobile(person.mobile),
            }
        )
    return {
        "total": money(stats["total"]),
        "count": stats["count"],
        "bands": [{"key": key, "amount": money(stats[key])} for key in predicates],
        "people": people,
    }


def counter_data(
    *,
    tenant: Any,
    granted: frozenset[str],
    modules: frozenset[str],
    now: dt.datetime | None = None,
    document_refs: tuple = (),
) -> dict:
    """Optional blocks require their source read right."""
    now = now or timezone.now()
    local = now.astimezone(ZoneInfo(tenant.timezone or "Asia/Kolkata"))
    result: dict[str, Any] = {"as_of": local.isoformat()}
    if "parties.party.read" in granted:
        for supplier, code, module in [
            (False, "sales.invoice.read", "sales"),
            (True, "purchases.bill.read", "purchases"),
        ]:
            if module in modules and code in granted:
                result["suppliers" if supplier else "customers"] = role_lane(
                    tenant=tenant,
                    today=local.date(),
                    supplier=supplier,
                    can_mobile="ledger.reminder.write" in granted,
                )
    suggestions = repeat_sources(
        tenant=tenant, today=local.date(), granted=granted, modules=modules
    )
    if suggestions:
        result["repeat"] = suggestions
    if document_refs:
        from apps.reports.selectors.counter_documents import document_facts

        result["documents"] = document_facts(
            tenant=tenant, refs=document_refs, granted=granted, modules=modules, today=local.date()
        )
    return result


def repeat_sources(
    *, tenant: Any, today: dt.date, granted: frozenset[str], modules: frozenset[str]
) -> list[dict]:
    """Frequent recent parties/categories; latest real source, never a posted copy."""
    from apps.expenses.models import Expense
    from apps.purchases.models import PurchaseDocument
    from apps.sales.models import SalesDocument

    result = []
    start = today - dt.timedelta(days=13)
    for kind, model, date_field, live, permission, module in [
        (
            "sale",
            SalesDocument,
            "document_date",
            ("issued", "partially_paid", "paid", "overdue"),
            "sales.invoice.read",
            "sales",
        ),
        (
            "purchase",
            PurchaseDocument,
            "document_date",
            ("recorded", "partially_paid", "paid", "overdue"),
            "purchases.bill.read",
            "purchases",
        ),
        ("expense", Expense, "expense_date", ("recorded",), "expenses.expense.read", "expenses"),
    ]:
        if module not in modules or permission not in granted:
            continue
        qs = model.objects.filter(
            tenant=tenant, status__in=live, **{f"{date_field}__range": (start, today)}
        )
        if kind == "sale":
            qs = qs.filter(kind__in=SALE_KINDS, party__status="active").filter(shop_origin_q())
        elif kind == "purchase":
            qs = qs.filter(kind="purchase_bill", party__status="active")
        else:
            qs = qs.filter(app="shop", category__status="active", paid=True)
        group = "category_id" if kind == "expense" else "party_id"
        frequent = qs.values(group).annotate(uses=Count("id")).order_by("-uses", group).first()
        if not frequent:
            continue
        row = (
            qs.filter(**{group: frequent[group]})
            .select_related("category" if kind == "expense" else "party")
            .order_by(f"-{date_field}", "-created_at", "-id")
            .first()
        )
        source = {
            "kind": kind,
            "id": str(row.id),
            "name": row.category.name if kind == "expense" else row.party.name,
            "date": getattr(row, date_field).isoformat(),
            "amount": money(row.amount if kind == "expense" else row.grand_total),
            "uses": frequent["uses"],
        }
        if kind == "expense":
            source["expense"] = {
                "amount": money(row.amount),
                "categoryId": str(row.category_id),
                "paid": True,
                "mode": row.mode,
                "upiApp": row.upi_app or "",
                "note": row.note,
                "partyId": str(row.party_id) if row.party_id else "",
                "partyName": row.party.name if row.party_id else "",
                "reference": "",
                "dueOn": "",
            }
        result.append(source)
    return result
