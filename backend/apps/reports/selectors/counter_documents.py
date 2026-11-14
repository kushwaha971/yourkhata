"""Bounded, current Shop document facts for the Home register; no writes or identity data."""

from __future__ import annotations

import datetime as dt
from typing import Any
from uuid import UUID

from django.db.models import BooleanField, Case, Count, Q, Value, When

from apps.common.document_scope import shop_origin_q
from apps.common.overdue import overdue_q
from apps.reports.constants import CREDIT_NOTE_KIND, RECENT_ACTIVITY_LIMIT, SALE_KINDS

DocumentRef = tuple[str, UUID]
SOURCE_KINDS = frozenset({"sales_document", "purchase_document"})


def parse_document_refs(raw: str | None) -> tuple[DocumentRef, ...]:
    """Reject an unbounded/unknown request; IDs never authorize a source."""
    if not raw:
        return ()
    parts = raw.split(",")
    if len(parts) > RECENT_ACTIVITY_LIMIT or len(raw) > RECENT_ACTIVITY_LIMIT * 60:
        raise ValueError(f"Choose at most {RECENT_ACTIVITY_LIMIT} documents.")
    found: dict[DocumentRef, None] = {}
    for part in parts:
        kind, separator, identifier = part.partition(":")
        if not separator or kind not in SOURCE_KINDS:
            raise ValueError("Choose a sales or purchase document.")
        try:
            ref = (kind, UUID(identifier))
        except (ValueError, AttributeError):
            raise ValueError("Enter valid document IDs.") from None
        found[ref] = None
    return tuple(found)


def document_facts(
    *,
    tenant: Any,
    refs: tuple[DocumentRef, ...],
    granted: frozenset[str],
    modules: frozenset[str],
    today: dt.date,
) -> dict[str, dict]:
    """At most one query per readable source, with tenant/origin and kind fences."""
    from apps.purchases.constants import OPEN_STATUSES as PURCHASE_OPEN
    from apps.purchases.models import PurchaseDocument
    from apps.sales.constants import OPEN_STATUSES as SALE_OPEN
    from apps.sales.models import SalesDocument

    result = {}
    for source, model, permission, module, kinds, opened in [
        (
            "sales_document",
            SalesDocument,
            "sales.invoice.read",
            "sales",
            (*SALE_KINDS, CREDIT_NOTE_KIND),
            SALE_OPEN,
        ),
        (
            "purchase_document",
            PurchaseDocument,
            "purchases.bill.read",
            "purchases",
            ("purchase_bill",),
            PURCHASE_OPEN,
        ),
    ]:
        identifiers = [identifier for kind, identifier in refs if kind == source]
        if not identifiers or module not in modules or permission not in granted:
            continue
        rows = model.objects.filter(tenant=tenant, pk__in=identifiers, kind__in=kinds)
        if source == "sales_document":
            rows = rows.filter(shop_origin_q())
        late = overdue_q(today=today, open_statuses=opened)
        if source == "sales_document":
            late &= Q(kind__in=SALE_KINDS)
        rows = rows.annotate(
            item_count=Count("lines"),
            is_late=Case(
                When(late, then=Value(True)), default=Value(False), output_field=BooleanField()
            ),
        ).values("id", "kind", "status", "amount_due", "item_count", "is_late")
        for row in rows:
            result[f"{source}:{row['id']}"] = {
                "kind": row["kind"],
                "status": "overdue" if row["is_late"] else row["status"],
                "amount_due": f"{row['amount_due']:.2f}",
                "item_count": row["item_count"],
            }
    return result
