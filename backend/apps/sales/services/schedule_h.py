"""G4 — the Schedule H register (design: Reports, "Doctor and patient for each sale").

Every issued bill in the period that carries a Schedule H, H1 or X medicine:
its date and number, the customer, the scheduled medicines and quantities, and
the doctor and patient kept with the bill. A sale with no doctor written is
listed all the same, marked, because the register is where a missing
prescription is found, not hidden.
"""

from __future__ import annotations

import datetime as dt
from typing import Any

from apps.common.exceptions import ValidationFailed
from apps.sales.models import SalesDocument

SCHEDULED = ("H", "H1", "X")


def _date(raw: Any, field: str) -> dt.date:
    try:
        return dt.date.fromisoformat(str(raw))
    except (TypeError, ValueError) as exc:
        raise ValidationFailed({field: ["Enter a date as YYYY-MM-DD."]}) from exc


def register(*, tenant: Any, date_from: Any, date_to: Any) -> dict:
    start, end = _date(date_from, "date_from"), _date(date_to, "date_to")
    if start > end:
        raise ValidationFailed({"date_to": ["The end is before the start."]})
    docs = (
        SalesDocument.objects.filter(
            tenant=tenant,
            kind="invoice",
            document_date__gte=start,
            document_date__lte=end,
            lines__item__schedule__in=SCHEDULED,
        )
        .exclude(status__in=("draft", "void"))
        .select_related("party")
        .prefetch_related("lines__item")
        .distinct()
        .order_by("-document_date", "-number")
    )
    rows = []
    missing = 0
    for doc in docs:
        rx = (doc.meta or {}).get("rx") or {}
        medicines = [
            {
                "name": line.description,
                "schedule": line.item.schedule,
                "qty": str(line.qty),
                "unit_code": line.unit_code,
            }
            for line in doc.lines.all()
            if line.item_id and line.item.schedule in SCHEDULED
        ]
        if not rx.get("doctor"):
            missing += 1
        rows.append(
            {
                "id": str(doc.id),
                "date": doc.document_date.isoformat(),
                "number": doc.number,
                "customer": doc.party.name if doc.party_id else (doc.walk_in_name or None),
                "medicines": medicines,
                "doctor": rx.get("doctor"),
                "patient": rx.get("patient"),
            }
        )
    return {"rows": rows, "counts": {"bills": len(rows), "without_doctor": missing}}
