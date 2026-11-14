"""BP-11 query scope for shared payment reads and object actions."""

from __future__ import annotations

from typing import Any

from apps.common.book_access import allowed_app_modules, allowed_books
from apps.common.tenancy import get_effective_tenant


def scope_payments(request: Any, rows: Any, codename: str) -> Any:
    """Deposit receipts are owned by the deposit's module, not a shared bucket grant."""
    from django.db.models import CharField, Q, Subquery
    from django.db.models.fields.json import KeyTextTransform
    from django.db.models.functions import Cast

    from apps.payments.models import HeldDeposit

    books = allowed_books(request, codename)
    if "deposit" in books:
        return rows.filter(bucket__in=books)
    deposits = (
        HeldDeposit.objects.for_tenant(get_effective_tenant(request))
        .filter(module__in=allowed_app_modules(request, codename))
        .annotate(wire_id=Cast("id", CharField()))
        .values("wire_id")
    )
    return rows.annotate(_deposit_id=KeyTextTransform("deposit_id", "meta")).filter(
        Q(bucket__in=books) | Q(bucket="deposit", _deposit_id__in=Subquery(deposits))
    )
