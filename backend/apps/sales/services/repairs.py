"""G5 — a mobile shop's repair jobs (design G5: `pRepair`, `dRepairs`).

A job card for a phone left for repair, by stage (open, waiting for parts,
ready, delivered or cancelled). The advance is an earmarked receipt, exactly as
a custom order's (`custom_orders`): only this job's bill applies it, and
cancelling releases it to the customer's open advances. The bill is made on
delivery; the parts used are its item lines, so they leave stock there.
"""

from __future__ import annotations

import datetime as dt
import uuid
from decimal import Decimal, InvalidOperation
from typing import Any

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, Q

from apps.common.context import Ctx
from apps.common.dates import tenant_today
from apps.common.exceptions import BusinessRuleViolation, NotFound, ValidationFailed
from apps.sales.models import RepairJob

MONEY_MODES = ("cash", "upi", "bank", "cheque", "card")
CAME_WITH = ("phone", "back_cover", "charger", "sim", "memory_card")
#: Each stage and where it may go next.
NEXT = {
    RepairJob.OPEN: (RepairJob.WAITING, RepairJob.READY, RepairJob.CANCELLED),
    RepairJob.WAITING: (RepairJob.OPEN, RepairJob.READY, RepairJob.CANCELLED),
    RepairJob.READY: (RepairJob.OPEN, RepairJob.CANCELLED),
}
LIVE = (RepairJob.OPEN, RepairJob.WAITING, RepairJob.READY)


def view(job: RepairJob, *, today: dt.date | None = None) -> dict:
    late = (today - job.ready_by).days if today and job.status in LIVE and job.ready_by < today else 0
    return {
        "id": str(job.id),
        "number": job.number,
        "party": (
            {"id": str(job.party_id), "name": job.party.name, "mobile": job.party.mobile}
            if job.party_id
            else None
        ),
        "walk_in_name": job.walk_in_name or None,
        "walk_in_mobile": job.walk_in_mobile or None,
        "phone_model": job.phone_model,
        "imei": job.imei or None,
        "fault": job.fault,
        "came_with": list(job.came_with or []),
        "estimate": f"{job.estimate:.2f}",
        "ready_by": job.ready_by.isoformat(),
        "days_late": late,
        "advance": f"{job.advance:.2f}",
        "lock_note": job.lock_note or None,
        "status": job.status,
        "invoice_id": str(job.invoice_id) if job.invoice_id else None,
    }


def _money(raw: Any, field: str, errors: dict) -> Decimal:
    if raw in (None, ""):
        return Decimal("0")
    try:
        value = Decimal(str(raw)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        errors[field] = ["Enter an amount."]
        return Decimal("0")
    if value < 0:
        errors[field] = ["Enter an amount of zero or more."]
    return value


def _clean(*, ctx: Ctx, data: dict) -> dict:
    from apps.parties.models import Party

    errors: dict[str, list[str]] = {}
    data = data if isinstance(data, dict) else {}
    party = None
    if data.get("party_id"):
        try:
            party = Party.objects.filter(tenant=ctx.tenant, pk=data["party_id"], deleted_at__isnull=True).first()
        except (ValueError, TypeError, ValidationError):
            party = None
        if party is None:
            errors["party_id"] = ["Choose a customer from your list."]
    name = " ".join(str(data.get("walk_in_name") or "").split())[:120]
    mobile = "".join(ch for ch in str(data.get("walk_in_mobile") or "") if ch.isdigit())[-10:]
    if party is None and not mobile and "party_id" not in errors:
        errors["walk_in_mobile"] = ["Enter the customer's mobile, so the shop can call when it is ready."]
    phone_model = " ".join(str(data.get("phone_model") or "").split())[:80]
    if not phone_model:
        errors["phone_model"] = ["Enter the phone, like Redmi Note 12."]
    fault = " ".join(str(data.get("fault") or "").split())[:200]
    if not fault:
        errors["fault"] = ["Say what is wrong."]
    imei = "".join(str(data.get("imei") or "").split())[:20]
    came = [c for c in (data.get("came_with") or []) if c in CAME_WITH]
    estimate = _money(data.get("estimate"), "estimate", errors)
    advance = _money(data.get("advance"), "advance", errors)
    mode = data.get("advance_mode") or "cash"
    if advance > 0:
        if party is None and "party_id" not in errors:
            errors["advance"] = ["Choose a saved customer to take an advance."]
        if mode not in MONEY_MODES:
            errors["advance_mode"] = ["Choose how the advance was paid."]
    try:
        ready_by = dt.date.fromisoformat(str(data.get("ready_by")))
    except (TypeError, ValueError):
        errors["ready_by"] = ["Choose when it will be ready."]
        ready_by = None
    try:
        client_key = uuid.UUID(str(data.get("client_key")))
    except (TypeError, ValueError):
        client_key = uuid.uuid4()
    if errors:
        raise ValidationFailed(errors)
    return {
        "party": party,
        "walk_in_name": name if party is None else "",
        "walk_in_mobile": mobile if party is None else "",
        "phone_model": phone_model,
        "imei": imei,
        "fault": fault,
        "came_with": came,
        "estimate": estimate,
        "advance": advance,
        "mode": mode,
        "ready_by": ready_by,
        "lock_note": " ".join(str(data.get("lock_note") or "").split())[:60],
        "client_key": client_key,
    }


@transaction.atomic
def create_job(*, ctx: Ctx, data: dict) -> tuple[RepairJob, bool]:
    """The job and, with an advance, its earmarked receipt. Returns (job, created)."""
    from apps.payments.services.record import record_payment

    clean = _clean(ctx=ctx, data=data)
    # One writer at a time per business: the number is gap-free, and a double
    # tap finds the first tap's job here rather than making a second.
    last = RepairJob.objects.select_for_update().filter(tenant=ctx.tenant).order_by("-number").first()
    same = RepairJob.objects.filter(tenant=ctx.tenant, client_key=clean["client_key"]).first()
    if same is not None:
        return same, False
    next_no = int(last.number.split("-")[1]) + 1 if last else 1
    job = RepairJob.objects.create(
        tenant=ctx.tenant,
        number=f"JOB-{next_no:04d}",
        client_key=clean["client_key"],
        party=clean["party"],
        walk_in_name=clean["walk_in_name"],
        walk_in_mobile=clean["walk_in_mobile"],
        phone_model=clean["phone_model"],
        imei=clean["imei"],
        fault=clean["fault"],
        came_with=clean["came_with"],
        estimate=clean["estimate"],
        ready_by=clean["ready_by"],
        advance=clean["advance"],
        lock_note=clean["lock_note"],
    )
    if clean["advance"] > 0:
        recorded = record_payment(
            ctx=ctx,
            payload={
                "direction": "in",
                "party_id": str(job.party_id),
                "payment_date": tenant_today(ctx.tenant).isoformat(),
                "mode_breakup": [{"mode": clean["mode"], "amount": str(clean["advance"])}],
                "note": f"Advance for {job.number}",
                "context": "repair_job",
                "bucket": "shop",
                "allocations": [],
                "meta": {
                    "job_number": job.number,
                    "earmark": {"module": "sales", "subject_type": "repair_job", "subject_id": str(job.id)},
                },
            },
        )
        job.advance_payment_id = recorded["payment"].id
        job.save(update_fields=["advance_payment_id"])
    return job, True


def _release(ctx: Ctx, job: RepairJob) -> list[str]:
    """Take the earmark off the job's advance; returns its payment id, if any."""
    from apps.payments.models import Payment

    if not job.advance_payment_id:
        return []
    payment = Payment.objects.select_for_update().filter(tenant=ctx.tenant, pk=job.advance_payment_id).first()
    if payment is None:
        return []
    payment.meta = {k: v for k, v in (payment.meta or {}).items() if k != "earmark"}
    payment.save(update_fields=["meta"])
    return [str(payment.id)]


@transaction.atomic
def move_job(*, ctx: Ctx, job_id: Any, status: Any) -> RepairJob:
    """Open ⇄ waiting for parts → ready; cancelled before delivery. Delivery is a
    bill (`advance_for_issue`), never a status set by hand. Cancelling releases
    the advance to the customer's open advances."""
    # Lock the job row only: a walk-in job has no customer to join, and a
    # nullable join cannot be locked.
    job = (
        RepairJob.objects.select_for_update(of=("self",))
        .select_related("party")
        .filter(tenant=ctx.tenant, pk=job_id)
        .first()
    )
    if job is None:
        raise NotFound("No such repair.")
    if status not in NEXT.get(job.status, ()):
        raise BusinessRuleViolation("repair_status", "This repair cannot move to that stage.", details={"status": job.status})
    job.status = status
    job.save(update_fields=["status", "updated_at"])
    if status == RepairJob.CANCELLED:
        _release(ctx, job)
    return job


def list_jobs(*, tenant: Any, q: str = "", stage: str = "open") -> dict:
    today = tenant_today(tenant)
    rows = RepairJob.objects.filter(tenant=tenant).select_related("party")
    counts = rows.aggregate(
        open=Count("id", filter=Q(status__in=LIVE)),
        waiting=Count("id", filter=Q(status=RepairJob.WAITING)),
        ready=Count("id", filter=Q(status=RepairJob.READY)),
    )
    shown = {
        "open": rows.filter(status__in=LIVE),
        "waiting": rows.filter(status=RepairJob.WAITING),
        "ready": rows.filter(status=RepairJob.READY),
        "delivered": rows.filter(status=RepairJob.DELIVERED),
    }.get(stage, rows.filter(status__in=LIVE))
    text = " ".join(str(q or "").split())
    if text:
        shown = shown.filter(
            Q(number__icontains=text)
            | Q(party__name__icontains=text)
            | Q(party__mobile__icontains=text)
            | Q(walk_in_mobile__icontains=text)
            | Q(walk_in_name__icontains=text)
            | Q(imei__icontains=text)
            | Q(phone_model__icontains=text)
        )
    return {
        "rows": [view(j, today=today) for j in shown.order_by("ready_by", "number")[:200]],
        "counts": counts,
    }


def get_job(*, tenant: Any, job_id: Any) -> RepairJob:
    try:
        job = RepairJob.objects.select_related("party").filter(tenant=tenant, pk=job_id).first()
    except (ValueError, TypeError, ValidationError):
        job = None
    if job is None:
        raise NotFound("No such repair.")
    return job


def link_to_draft(*, tenant: Any, document: Any, job_id: Any, errors: dict) -> None:
    """`meta.repair_job` of a draft: which job this bill delivers (null clears it)."""
    meta = {k: v for k, v in (document.meta or {}).items() if k != "repair_job"}
    document.meta = meta
    if not job_id:
        return
    try:
        job = RepairJob.objects.filter(tenant=tenant, pk=job_id).first()
    except (ValueError, TypeError, ValidationError):
        job = None
    if job is None or job.status not in LIVE:
        errors["repair_job_id"] = ["This repair is already finished."]
        return
    document.meta = {
        **meta,
        "repair_job": {"id": str(job.id), "number": job.number, "advance": f"{job.advance:.2f}"},
    }


def advance_for_issue(*, ctx: Ctx, document: Any) -> tuple[RepairJob | None, list[str]]:
    """At issue: lock the linked job, refuse if this bill cannot deliver it, and
    release its advance so the issue applies it to this bill."""
    link = (document.meta or {}).get("repair_job") or {}
    if not link.get("id"):
        return None, []
    job = RepairJob.objects.select_for_update().filter(tenant=ctx.tenant, pk=link["id"]).first()
    if job is None or job.status not in LIVE:
        raise BusinessRuleViolation("repair_status", "This repair is already finished. Remove it from the bill.", details={})
    if job.party_id and job.party_id != document.party_id:
        raise BusinessRuleViolation("repair_status", "This bill is for a different customer than the repair.", details={})
    return job, _release(ctx, job)


def mark_delivered_by(*, job: RepairJob | None, document: Any) -> None:
    if job is None:
        return
    job.status = RepairJob.DELIVERED
    job.invoice_id = document.id
    job.save(update_fields=["status", "invoice_id", "updated_at"])
