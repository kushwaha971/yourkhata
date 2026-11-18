"""G7 — a contractor's sites (design `pSite`, `dSite`).

A contractor buys for many sites. Each site keeps its own bills and dues; the
contractor's own balance does not change, because a site is only a label on
bills. A payment split across sites is one ordinary payment with its allocations
chosen site by site, oldest bill first.
"""

from __future__ import annotations

import uuid
from decimal import Decimal, InvalidOperation
from typing import Any

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, Max, Min, Q, Sum

from apps.common.context import Ctx
from apps.common.exceptions import NotFound, ValidationFailed
from apps.common.dates import tenant_today
from apps.sales.constants import INVOICE_KINDS, DocumentStatus
from apps.sales.models import ContractorSite, SalesDocument

NAME_MAX = 120
_LIVE = Q(documents__kind__in=INVOICE_KINDS) & ~Q(
    documents__status__in=[DocumentStatus.DRAFT, DocumentStatus.VOID]
)
_DUE = _LIVE & Q(documents__amount_due__gt=0)


def _with_figures(rows: Any) -> Any:
    return rows.select_related("party").annotate(
        bills=Count("documents", filter=_LIVE, distinct=True),
        due=Sum("documents__amount_due", filter=_LIVE),
        last_bill=Max("documents__document_date", filter=_LIVE),
        oldest_due_on=Min("documents__due_on", filter=_DUE),
        oldest_due_bill=Min("documents__document_date", filter=_DUE),
    )


def _days_late(site: Any, today: Any) -> int:
    """Days past the oldest unpaid bill's due date; a bill with none counts from its date."""
    if not site.due:
        return 0
    since = site.oldest_due_on or site.oldest_due_bill
    return max((today - since).days, 0) if since else 0


def view(site: Any, *, today: Any) -> dict:
    limit = site.party.credit_limit
    return {
        "id": str(site.id),
        "name": site.name,
        "party": {"id": str(site.party_id), "name": site.party.name, "mobile": site.party.mobile},
        "bills": site.bills,
        "last_bill": site.last_bill.isoformat() if site.last_bill else None,
        "due": str(site.due or Decimal("0.00")),
        "days_late": _days_late(site, today),
        "credit_limit": str(limit) if limit is not None else None,
    }


def list_sites(*, tenant: Any, q: str = "", party_id: Any = None) -> dict:
    rows = ContractorSite.objects.filter(tenant=tenant)
    if party_id:
        rows = rows.filter(party_id=party_id)
    if q.strip():
        rows = rows.filter(Q(name__icontains=q.strip()) | Q(party__name__icontains=q.strip()))
    today = tenant_today(tenant)
    sites = [view(site, today=today) for site in _with_figures(rows).order_by("name")]
    # Most owed first; a settled site sinks to the bottom.
    sites.sort(key=lambda row: -Decimal(row["due"]))
    return {
        "sites": sites,
        "to_collect": str(sum((Decimal(row["due"]) for row in sites), Decimal("0.00"))),
        "open": sum(1 for row in sites if Decimal(row["due"]) > 0),
    }


def create_site(*, ctx: Ctx, data: dict) -> tuple[Any, bool]:
    from apps.parties.models import Party

    name = " ".join(str(data.get("name") or "").split())
    errors: dict[str, list[str]] = {}
    if not name:
        errors["name"] = ["Enter the site's name."]
    elif len(name) > NAME_MAX:
        errors["name"] = [f"Keep the name under {NAME_MAX} letters."]
    try:
        key = uuid.UUID(str(data.get("client_key")))
    except (ValueError, TypeError):
        key = uuid.uuid4()
    party = None
    try:
        party = Party.objects.filter(
            tenant=ctx.tenant, pk=data.get("party_id"), deleted_at__isnull=True
        ).first()
    except (ValueError, ValidationError):  # a malformed id is simply no customer
        party = None
    if party is None:
        errors["party_id"] = ["Choose the contractor from your list."]
    if errors:
        raise ValidationFailed(errors)
    same = ContractorSite.objects.filter(tenant=ctx.tenant, client_key=key).first()
    if same:
        return same, False
    if ContractorSite.objects.filter(tenant=ctx.tenant, party=party, name__iexact=name).exists():
        raise ValidationFailed({"name": ["This contractor already has a site with this name."]})
    return ContractorSite.objects.create(tenant=ctx.tenant, party=party, name=name, client_key=key), True


def get_site(*, tenant: Any, site_id: Any) -> Any:
    site = _with_figures(ContractorSite.objects.filter(tenant=tenant, pk=site_id)).first()
    if site is None:
        raise NotFound("This site is not in your list.")
    return site


def site_bills(*, site: Any, limit: int = 100) -> list[dict]:
    rows = SalesDocument.objects.filter(site=site, kind__in=INVOICE_KINDS).exclude(
        status__in=[DocumentStatus.DRAFT, DocumentStatus.VOID]
    )
    return [
        {
            "id": str(bill.id),
            "number": bill.number,
            "date": bill.document_date.isoformat(),
            "total": str(bill.grand_total),
            "due": str(bill.amount_due),
            "status": bill.status,
        }
        for bill in rows.order_by("-document_date", "-created_at")[:limit]
    ]


def place_on_site(*, tenant: Any, document: Any, payload: dict, errors: dict) -> None:
    """Which site a bill is for. A contractor with one site is never asked: that
    site is taken. With several, the bill may stay without one, so the counter is
    never stopped by a question the contractor cannot answer yet."""
    if document.party_id is None:
        document.site = None
        return
    if "site_id" in payload and payload["site_id"]:
        site = ContractorSite.objects.filter(
            tenant=tenant, pk=payload["site_id"], party_id=document.party_id
        ).first()
        if site is None:
            errors["site_id"] = ["Choose one of this contractor's sites."]
            return
        document.site = site
        return
    if "site_id" in payload:
        document.site = None
        return
    if document.site_id and document.site.party_id != document.party_id:
        document.site = None
    if document.site_id is None:
        only = list(ContractorSite.objects.filter(tenant=tenant, party_id=document.party_id)[:2])
        if len(only) == 1:
            document.site = only[0]


def _amount(value: Any) -> Decimal | None:
    try:
        amount = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return None
    return amount if amount.is_finite() and amount > 0 else None


@transaction.atomic
def split_payment(*, ctx: Ctx, data: dict) -> dict:
    """One payment, split across a contractor's sites, oldest bill first in each."""
    from apps.payments.services.record import record_payment

    errors: dict[str, list[str]] = {}
    splits = [row for row in (data.get("splits") or []) if isinstance(row, dict)]
    if not splits:
        errors["splits"] = ["Enter how much is for each site."]
    allocations: list[dict] = []
    total = Decimal("0.00")
    party_id = None
    seen: set[str] = set()
    for index, row in enumerate(splits):
        key = f"splits.{index}.amount"
        amount = _amount(row.get("amount"))
        site = ContractorSite.objects.filter(tenant=ctx.tenant, pk=row.get("site_id")).first()
        if site is None or str(site.id) in seen:
            errors[f"splits.{index}.site_id"] = ["Choose one of this contractor's sites."]
            continue
        seen.add(str(site.id))
        if party_id not in (None, site.party_id):
            errors[f"splits.{index}.site_id"] = ["All sites must be the same contractor's."]
            continue
        party_id = site.party_id
        if amount is None:
            errors[key] = ["Enter an amount."]
            continue
        left = amount
        bills = (
            SalesDocument.objects.select_for_update()
            .filter(site=site, kind__in=INVOICE_KINDS, amount_due__gt=0)
            .exclude(status__in=[DocumentStatus.DRAFT, DocumentStatus.VOID])
            .order_by("document_date", "created_at")
        )
        for bill in bills:
            if left <= 0:
                break
            part = min(left, bill.amount_due)
            allocations.append(
                {"document_type": "sales_document", "document_id": str(bill.id), "amount": str(part)}
            )
            left -= part
        if left > 0:
            errors[key] = [f"{site.name} owes only ₹{amount - left}."]
        total += amount
    mode = str(data.get("mode") or "cash")
    if errors:
        raise ValidationFailed(errors)
    recorded = record_payment(
        ctx=ctx,
        payload={
            "direction": "in",
            "party_id": str(party_id),
            "payment_date": tenant_today(ctx.tenant).isoformat(),
            "mode_breakup": [{"mode": mode, "amount": str(total)}],
            "bucket": "shop",
            "allocations": allocations,
        },
    )
    payment = recorded["payment"] if isinstance(recorded, dict) and "payment" in recorded else recorded
    return {"payment_id": str(getattr(payment, "id", "")), "amount": str(total)}
