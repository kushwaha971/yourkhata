"""BP-17 — recording a counted drawer (R-DEC-26: "physical cash counts").

One transaction: compute the Shop's cash by its records NOW, store the count
beside it with the variance, audit it. The browser sends only what was counted
(and an optional note); it never sends the expected figure, because a tile it
loaded a minute ago is exactly the stale number BP-17 forbids subtracting.

Concurrent sales while somebody counts are not locked out — the drawer keeps
working. The snapshot is whatever was COMMITTED when the count was saved, and
the row says when that was, so a later reader sees the count against the
figure it was compared with and, on Home, how far the records moved since.
"""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction

from apps.common.audit import AuditAction, write_audit
from apps.common.context import Ctx
from apps.common.dates import tenant_today
from apps.reports.models import CashCount
from apps.reports.selectors.dashboard import cash_in_hand


@transaction.atomic
def record_cash_count(*, ctx: Ctx, counted_amount: Decimal, note: str = "") -> CashCount:
    tenant = ctx.tenant
    today = tenant_today(tenant)
    expected = cash_in_hand(tenant=tenant, today=today)
    count = CashCount.objects.create(
        tenant=tenant,
        created_by=ctx.actor if ctx.actor_type == "user" else None,
        business_date=today,
        counted_amount=counted_amount,
        expected_amount=expected,
        variance=counted_amount - expected,
        note=note,
    )
    write_audit(
        ctx=ctx,
        action=AuditAction.CASH_COUNTED,
        entity_type="reports_cash_count",
        entity_id=count.id,
        after={
            "business_date": today,
            "counted_amount": count.counted_amount,
            "expected_amount": count.expected_amount,
            "variance": count.variance,
            "note": note,
        },
        metadata={"idempotency_key": ctx.idempotency_key},
    )
    return count

