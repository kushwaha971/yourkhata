"""The lender's morning bell, as the Library's (owner, 12 Nov 2026).

At 08:00 on each business's clock, one bell row naming how many loans became
late today: a collection day was yesterday, it is unpaid this morning, and
nothing was late before it. For the lender's people only, opening Messages ·
Late. Nothing is sent to a borrower (DEC-012).
"""

from __future__ import annotations

import datetime as dt
from typing import Any

from apps.common.jobs import job_handler

LATE_TODAY = "lending.late_today"


def became_late(tenant: Any, today: dt.date) -> list:
    from apps.lending import selectors

    loans = selectors.active_loans(tenant)
    pos = selectors.positions(tenant, loans, today)
    yesterday = today - dt.timedelta(days=1)
    return [l for l in loans if pos[l.pk].late_since == yesterday]


def notify_late_today(tenant: Any, today: dt.date) -> bool:
    from django.db import transaction

    from apps.notifications.services.notify import notify

    late = became_late(tenant, today)
    if not late:
        return False
    # notify() locks the day's row: it needs a transaction of its own (the Library's lesson).
    with transaction.atomic():
        notify(
            tenant,
            LATE_TODAY,
            params={"count": len(late)},
            group_key=f"lending_late:{today.isoformat()}",
            ids=[str(l.pk) for l in late],
        )
    return True


@job_handler(LATE_TODAY, requires_tenant=False, max_attempts=3)
def late_today(job: Any, ctx: Any) -> dict:
    from django.apps import apps

    from apps.common.dates import tenant_today
    from apps.lending.models import Loan
    from apps.platform_app.services.entitlements import effective_modules

    tenants = apps.get_model("platform", "Tenant").objects.filter(
        status="active", pk__in=Loan.objects.filter(status="active").values("tenant_id")
    )
    notified = 0
    for tenant in tenants:
        if "lending" in effective_modules(tenant) and notify_late_today(tenant, tenant_today(tenant)):
            notified += 1
    return {"tenants": notified}
