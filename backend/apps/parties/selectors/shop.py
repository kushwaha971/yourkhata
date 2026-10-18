"""BP-09: one read seam for Shop party facts, never a financial posting.

Core keeps its import boundary: Shop/payment models are reached only inside
this seam, following ledger.services.messaging's deferred-import pattern (D5).
All per-party facts are correlated SQL annotations, not per-row Python queries.
A customer's money is never reduced by a payable to the same supplier.
"""

from __future__ import annotations

from typing import Any

from django.db.models import (
    Case,
    DateField,
    DecimalField,
    F,
    OuterRef,
    Q,
    Subquery,
    Sum,
    Value,
    When,
)
from django.db.models.functions import Coalesce, Greatest

from apps.common.money import ZERO


def with_shop_facts(queryset: Any, *, tenant: Any) -> Any:
    from apps.common.constants import LedgerBucket
    from apps.ledger.models import LedgerEntry
    from apps.payments.selectors.payments import open_advances
    from apps.purchases.models import PurchaseDocument
    from apps.sales.models import SalesDocument

    money = DecimalField(max_digits=18, decimal_places=2)

    def amount(rows: Any, field: str = "amount_due") -> Any:
        grouped = rows.order_by().values("party_id").annotate(total=Sum(field)).values("total")[:1]
        return Coalesce(Subquery(grouped, output_field=money), Value(ZERO), output_field=money)

    sales = SalesDocument.objects.filter(tenant=tenant, party_id=OuterRef("pk")).filter(
        Q(origin_module__isnull=True) | Q(origin_module="")
    )
    invoices = sales.filter(
        kind__in=("invoice", "bill_of_supply"),
        status__in=("issued", "partially_paid", "overdue", "paid"),
    )
    purchases = PurchaseDocument.objects.filter(tenant=tenant, party_id=OuterRef("pk"))
    bills = purchases.filter(
        kind="purchase_bill", status__in=("recorded", "partially_paid", "overdue", "paid")
    )
    incoming = open_advances(
        tenant=tenant, party_id=OuterRef("pk"), direction="in", bucket="shop"
    ).exclude(meta__has_key="debit_note_id")
    outgoing = open_advances(
        tenant=tenant, party_id=OuterRef("pk"), direction="out", bucket="shop"
    ).exclude(meta__has_key="debit_note_id")
    entries = LedgerEntry.objects.filter(
        tenant=tenant, party_id=OuterRef("pk"), bucket=LedgerBucket.SHOP, status="posted"
    ).order_by("-created_at", "-id")
    sale_activity = (
        sales.exclude(status__in=("draft", "void", "cancelled"))
        .annotate(activity_at=Coalesce("issued_at", "created_at"))
        .order_by("-activity_at", "-id")
    )
    purchase_activity = (
        purchases.exclude(status__in=("draft", "void", "cancelled"))
        .annotate(activity_at=Coalesce("recorded_at", "created_at"))
        .order_by("-activity_at", "-id")
    )
    queryset = (
        queryset.annotate(
            shop_customer_due=amount(invoices),
            shop_customer_credit=amount(
                sales.filter(kind="credit_note", status__in=("issued", "applied"))
            )
            + amount(incoming, "unallocated_amount"),
            shop_supplier_due=amount(bills),
            shop_supplier_credit=amount(purchases.filter(kind="debit_note", status="issued"))
            + amount(outgoing, "unallocated_amount"),
            shop_customer_due_on=Subquery(
                invoices.filter(amount_due__gt=ZERO, due_on__isnull=False)
                .order_by("due_on", "id")
                .values("due_on")[:1]
            ),
            shop_supplier_due_on=Subquery(
                bills.filter(amount_due__gt=ZERO, due_on__isnull=False)
                .order_by("due_on", "id")
                .values("due_on")[:1]
            ),
            shop_ledger_at=Subquery(entries.values("created_at")[:1]),
            shop_sale_at=Subquery(sale_activity.values("activity_at")[:1]),
            shop_purchase_at=Subquery(purchase_activity.values("activity_at")[:1]),
        )
        .annotate(
            shop_customer_balance=F("shop_customer_due") - F("shop_customer_credit"),
            shop_supplier_balance=F("shop_supplier_due") - F("shop_supplier_credit"),
            shop_last_activity_at=Greatest("shop_ledger_at", "shop_sale_at", "shop_purchase_at"),
        )
        .annotate(
            shop_supplier_list_balance=-F("shop_supplier_balance"),
            shop_customer_open_due_on=Case(
                When(shop_customer_balance__gt=ZERO, then=F("shop_customer_due_on")),
                default=None,
                output_field=DateField(null=True),
            ),
            shop_supplier_open_due_on=Case(
                When(shop_supplier_balance__gt=ZERO, then=F("shop_supplier_due_on")),
                default=None,
                output_field=DateField(null=True),
            ),
            shop_last_activity_kind=Case(
                When(
                    shop_last_activity_at=F("shop_ledger_at"),
                    then=Subquery(entries.values("entry_type")[:1]),
                ),
                When(
                    shop_last_activity_at=F("shop_sale_at"),
                    then=Subquery(sale_activity.values("kind")[:1]),
                ),
                When(
                    shop_last_activity_at=F("shop_purchase_at"),
                    then=Subquery(purchase_activity.values("kind")[:1]),
                ),
                default=Value(""),
            ),
        )
    )
    return queryset


def shop_party_facts(*, tenant: Any, party_id: Any) -> Any:
    from apps.parties.models import Party

    return with_shop_facts(
        Party.objects.for_tenant(tenant).filter(pk=party_id), tenant=tenant
    ).first()


def serialize_shop_facts(party: Any, *, today: Any, kind: str = "customer") -> dict:
    """Money stays decimal text; dates/age are computed on the business clock."""
    due_on = party.shop_supplier_due_on if kind == "supplier" else party.shop_customer_due_on
    balance = party.shop_supplier_balance if kind == "supplier" else party.shop_customer_balance
    return {
        "customer_balance": f"{party.shop_customer_balance:.2f}",
        "customer_due": f"{party.shop_customer_due:.2f}",
        "customer_credit": f"{party.shop_customer_credit:.2f}",
        "supplier_balance": f"{party.shop_supplier_balance:.2f}",
        "supplier_due": f"{party.shop_supplier_due:.2f}",
        "supplier_credit": f"{party.shop_supplier_credit:.2f}",
        "oldest_due_on": due_on.isoformat() if due_on else None,
        "days_overdue": max((today - due_on).days, 0) if due_on and balance > ZERO else None,
        "last_activity_at": (
            party.shop_last_activity_at.isoformat() if party.shop_last_activity_at else None
        ),
        "last_activity_kind": party.shop_last_activity_kind or None,
    }
