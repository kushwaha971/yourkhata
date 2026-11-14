"""The Library's one scheduled job: the morning bell (owner, 12 Nov 2026: "add
the bell").

At 09:00 on each business's own clock, one bell row per library naming how many
fees became overdue today — the students whose "paid to" was yesterday and who
have not paid. Nothing is sent to a student (DEC-012): the bell is for the
people at the counter, and opens Fees · Overdue. A library switched off, or a
day with nobody newly late, raises nothing.
"""

from __future__ import annotations

import datetime as dt
from typing import Any

from apps.common.jobs import job_handler

OVERDUE_TODAY = "library.overdue_today"


def became_overdue(tenant: Any, today: dt.date) -> list:
    """Students whose fee was due yesterday and is still unpaid this morning."""
    from apps.library.constants import StudentStatus
    from apps.library.fees import start_paid_to
    from apps.library.models import Student

    yesterday = today - dt.timedelta(days=1)
    rows = Student.objects.filter(tenant=tenant, status=StudentStatus.ACTIVE).only(
        "id", "paid_to", "joined_on"
    )
    return [s for s in rows if (s.paid_to or start_paid_to(s.joined_on)) == yesterday]


def notify_overdue_today(tenant: Any, today: dt.date) -> bool:
    from django.db import transaction

    from apps.notifications.services.notify import notify

    late = became_overdue(tenant, today)
    if not late:
        return False
    # notify() locks the day's row to group into it, so it needs a transaction of
    # its own: outside one it raised, and every unit test passed because each runs
    # inside a test transaction (found by running the job on the live stack, 12 Nov).
    with transaction.atomic():
        notify(
            tenant,
            OVERDUE_TODAY,
            params={"count": len(late)},
            group_key=f"library_overdue:{today.isoformat()}",
            ids=[str(s.pk) for s in late],
        )
    return True


@job_handler(OVERDUE_TODAY, requires_tenant=False, max_attempts=3)
def overdue_today(job: Any, ctx: Any) -> dict:
    from django.apps import apps

    from apps.common.dates import tenant_today
    from apps.library.models import Student
    from apps.platform_app.services.entitlements import effective_modules

    tenants = apps.get_model("platform", "Tenant").objects.filter(
        status="active", pk__in=Student.objects.values("tenant_id")
    )
    notified = 0
    for tenant in tenants:
        if "library" in effective_modules(tenant) and notify_overdue_today(tenant, tenant_today(tenant)):
            notified += 1
    return {"tenants": notified}
