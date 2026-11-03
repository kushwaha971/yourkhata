"""G1 — today's metal rate for a jeweller (design §G1).

Typed once each morning; every bill that day uses it (G2 copies it onto the
bill). `save_today` replaces today's row, never an earlier day's: yesterday's
figures are what "Same as yesterday" and the history table read, and a bill
already issued keeps its own copy.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal, InvalidOperation
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.common.context import Ctx
from apps.common.dates import tenant_timezone, tenant_today
from apps.common.exceptions import ValidationFailed
from apps.inventory.models import MetalRate

#: The four purities the design draws, in its order (`RATES`). Per gram.
PURITIES: tuple[str, ...] = ("gold_24k", "gold_22k", "gold_18k", "silver")
#: A per-gram rate above this is a typo (gold is about ₹12,000 a gram).
MAX_RATE = Decimal("1000000")


def _figures(row: MetalRate | None) -> dict[str, str | None]:
    return {p: (None if row is None or getattr(row, p) is None else f"{getattr(row, p):.2f}") for p in PURITIES}


def _view(row: MetalRate | None, tenant: Any) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "day": row.day.isoformat(),
        "rates": _figures(row),
        "set_by": row.set_by_name,
        "set_at": row.updated_at.astimezone(tenant_timezone(tenant)).isoformat(),
    }


def jewel_defaults(tenant: Any) -> dict[str, str]:
    """The owner's making, wastage and PAN figures, as Settings stores them."""
    from apps.platform_app.models import TenantSetting
    from apps.platform_app.settings_schema import SETTINGS

    row = TenantSetting.objects.filter(tenant=tenant, key="shop.jewel").first()
    return row.value if row is not None else SETTINGS["shop.jewel"].default("")


def today_view(*, tenant: Any) -> dict[str, Any]:
    """Today's row (or null), the latest earlier day's, and today's date."""
    today = tenant_today(tenant)
    rows = MetalRate.objects.filter(tenant=tenant, day__lte=today).order_by("-day")[:2]
    current = next((r for r in rows if r.day == today), None)
    previous = next((r for r in rows if r.day < today), None)
    return {"day": today.isoformat(), "defaults": jewel_defaults(tenant), "today": _view(current, tenant), "yesterday": _view(previous, tenant)}


def _parse(raw: Any, field: str, details: dict[str, list[str]]) -> Decimal | None:
    if raw in (None, ""):
        return None
    try:
        value = Decimal(str(raw).replace(",", "").strip())
    except InvalidOperation:
        details[field] = ["Enter a rate in rupees, like 11650."]
        return None
    if not value.is_finite() or value <= 0:
        details[field] = ["Enter a rate above zero."]
    elif value > MAX_RATE:
        details[field] = ["This rate looks too high for one gram."]
    elif value.as_tuple().exponent < -2:  # type: ignore[operator]
        details[field] = ["Use at most two digits after the point."]
    return value


def save_today(*, ctx: Ctx, data: dict[str, Any]) -> dict[str, Any]:
    details: dict[str, list[str]] = {}
    values = {p: _parse(data.get(p), p, details) for p in PURITIES}
    if not details and all(v is None for v in values.values()):
        details["gold_22k"] = ["Type at least one rate."]
    if details:
        raise ValidationFailed(details, "Check the rates.")
    today = tenant_today(ctx.tenant)
    name = getattr(ctx.actor, "full_name", "") or ""
    with transaction.atomic():
        MetalRate.objects.update_or_create(
            tenant=ctx.tenant,
            day=today,
            defaults={**values, "set_by_name": name[:120], "created_by": ctx.actor, "updated_at": timezone.now()},
        )
    return today_view(tenant=ctx.tenant)


def month_rows(*, tenant: Any, month: str | None) -> dict[str, Any]:
    """One row per day set in the month (newest first), for "Rate history"."""
    today = tenant_today(tenant)
    try:
        first = dt.date.fromisoformat(f"{month}-01") if month else today.replace(day=1)
    except ValueError:
        raise ValidationFailed({"month": ["Use YYYY-MM."]}, "Pick a month.") from None
    after = (first.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
    rows = MetalRate.objects.filter(tenant=tenant, day__gte=first, day__lt=after).order_by("-day")
    return {"month": first.strftime("%Y-%m"), "rows": [_view(r, tenant) for r in rows]}
