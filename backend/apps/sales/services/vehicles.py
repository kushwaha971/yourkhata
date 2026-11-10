"""G8 — vehicle history (design `dVehicle`).

A bill already keeps the vehicle number and the mechanic it came with in
`meta.vehicle` (D P1b). A vehicle is nothing more than those bills read
together: no table, so nothing can drift from the bills themselves. The
mechanic's own dues are his own customer account and are only shown beside the
vehicle, never mixed into what the vehicle spent.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db.models import Count, Max, Min, Q, Sum
from django.db.models.fields.json import KT

from apps.common.exceptions import NotFound
from apps.sales.constants import INVOICE_KINDS, DocumentStatus
from apps.sales.models import SalesDocument

NUMBER_MAX = 20


def clean_number(raw: Any) -> str:
    return "".join(str(raw or "").split()).upper()[:NUMBER_MAX]


def _bills(tenant: Any) -> Any:
    return (
        SalesDocument.objects.filter(tenant=tenant, kind__in=INVOICE_KINDS)
        .exclude(status__in=[DocumentStatus.DRAFT, DocumentStatus.VOID])
        .annotate(vno=KT("meta__vehicle__number"))
        .exclude(Q(vno__isnull=True) | Q(vno=""))
    )


def _owner(bill: Any) -> str | None:
    if bill.party_id:
        return bill.party.name
    return bill.walk_in_name or (bill.party_snapshot or {}).get("name") or None


def _latest(bills: Any, key: str) -> str | None:
    """The newest bill that names it: a later bill without a mechanic does not
    forget the one the vehicle came with."""
    for bill in bills:
        value = ((bill.meta or {}).get("vehicle") or {}).get(key)
        if value:
            return value
    return None


def list_vehicles(*, tenant: Any, q: str = "", limit: int = 200) -> dict:
    rows = _bills(tenant)
    text = clean_number(q)
    if text:
        rows = rows.filter(vno__contains=text)
    grouped = (
        rows.values("vno")
        .annotate(bills=Count("id"), spent=Sum("grand_total"), last_bill=Max("document_date"))
        .order_by("-last_bill", "vno")[:limit]
    )
    vehicles = []
    for row in grouped:
        bills = list(rows.filter(vno=row["vno"]).select_related("party").order_by("-document_date", "-created_at")[:20])
        vehicles.append(
            {
                "number": row["vno"],
                "model": _latest(bills, "model"),
                "owner": _owner(bills[0]),
                "mechanic": _latest(bills, "mechanic"),
                "bills": row["bills"],
                "spent": str(row["spent"] or Decimal("0.00")),
                "last_bill": row["last_bill"].isoformat(),
            }
        )
    return {"vehicles": vehicles}


def vehicle_detail(*, tenant: Any, number: Any, limit: int = 100) -> dict:
    """One vehicle's figures and bills. A number with no bill is not a vehicle here."""
    from apps.parties.models import Party

    vno = clean_number(number)
    rows = _bills(tenant).filter(vno=vno).select_related("party")
    figures = rows.aggregate(bills=Count("id"), spent=Sum("grand_total"), since=Min("document_date"))
    if not figures["bills"]:
        raise NotFound("No bill has this vehicle number yet.")
    ordered = list(rows.prefetch_related("lines").order_by("-document_date", "-created_at")[:limit])
    latest = ordered[0]
    mechanic = _latest(ordered, "mechanic")
    # The mechanic's dues are his own shop account, found by his exact name.
    garage = None
    if mechanic:
        party = (
            Party.objects.filter(tenant=tenant, name__iexact=mechanic, deleted_at__isnull=True)
            .order_by("created_at")
            .first()
        )
        if party is not None:
            garage = {"id": str(party.id), "name": party.name, "due": str(party.shop_balance or Decimal("0.00"))}
    return {
        "number": vno,
        "model": _latest(ordered, "model"),
        "owner": _owner(latest),
        "owner_id": str(latest.party_id) if latest.party_id else None,
        "mechanic": mechanic,
        "garage": garage,
        "bills": figures["bills"],
        "spent": str(figures["spent"] or Decimal("0.00")),
        "since": figures["since"].isoformat(),
        "bill_rows": [
            {
                "id": str(bill.id),
                "number": bill.number,
                "date": bill.document_date.isoformat(),
                "parts": ", ".join(line.description for line in bill.lines.all()),
                "mechanic": ((bill.meta or {}).get("vehicle") or {}).get("mechanic") or None,
                "total": str(bill.grand_total),
            }
            for bill in ordered
        ],
    }
