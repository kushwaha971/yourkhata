"""BP-16 — writing Shop promises (R-DEC-26: "Shop promises / follow-ups").

Every write is one transaction with its audit row. None of them touches a
bill, a due date, a payment or a balance: a promise is what somebody said, and
recording, changing or closing it changes nothing a statement prints.

The rules a service enforces rather than a screen:

* the role must be one the contact has in the Shop (a promise "as supplier"
  for somebody who has never supplied anything is a typo, not a fact);
* an archived contact takes no new promise and no change (PTY-04 FR-14);
* a promise date is today or later when it is set — a date already past is a
  broken promise the moment it is saved;
* one open promise per contact and role (the database's partial unique index;
  `promise_already_open` when two arrive at once);
* a change or a close names the version it was made against, and a stale one
  is refused (`stale_version`) instead of overwriting somebody else's edit.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal
from typing import Any

from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.common.audit import AuditAction, write_audit
from apps.common.context import Ctx
from apps.common.dates import tenant_today
from apps.common.exceptions import BusinessRuleViolation, NotFound, StaleVersion, ValidationFailed
from apps.parties.constants import PartyStatus, ShopPromiseRole, ShopPromiseState
from apps.parties.models import Party, ShopPromise

_UNSET: Any = object()


def _snapshot(promise: ShopPromise) -> dict[str, Any]:
    return {
        "party_id": str(promise.party_id),
        "role": promise.role,
        "promised_on": promise.promised_on,
        "amount": promise.amount,
        "note": promise.note,
        "state": promise.state,
    }


def _actor(ctx: Ctx) -> Any:
    return ctx.actor if ctx.actor_type == "user" else None


def _check_date(tenant: Any, promised_on: dt.date) -> None:
    if promised_on < tenant_today(tenant):
        raise ValidationFailed({"promised_on": [_("Choose today or a later date.")]})


def _check_party(party: Party, role: str) -> None:
    if party.status == PartyStatus.ARCHIVED:
        raise BusinessRuleViolation(
            "party_archived", _("This contact is archived. Restore them to add a promise.")
        )
    has_role = party.is_customer if role == ShopPromiseRole.CUSTOMER else party.is_supplier
    if not has_role:
        raise ValidationFailed(
            {"role": [_("This contact is not one of your Shop's {role}s.").format(role=role)]}
        )


def _already_open() -> BusinessRuleViolation:
    return BusinessRuleViolation(
        "promise_already_open",
        _("There is already an open promise for this contact. Change that one instead."),
    )


@transaction.atomic
def create_promise(
    *,
    ctx: Ctx,
    party_id: Any,
    role: str,
    promised_on: dt.date,
    amount: Decimal | None = None,
    note: str = "",
) -> ShopPromise:
    tenant = ctx.tenant
    party = Party.objects.for_tenant(tenant).select_for_update().filter(pk=party_id).first()
    if party is None:
        raise NotFound()
    _check_party(party, role)
    _check_date(tenant, promised_on)
    if ShopPromise.objects.filter(
        tenant=tenant, party=party, role=role, state=ShopPromiseState.OPEN
    ).exists():
        raise _already_open()
    actor = _actor(ctx)
    try:
        with transaction.atomic():
            promise = ShopPromise.objects.create(
                tenant=tenant,
                party=party,
                role=role,
                promised_on=promised_on,
                amount=amount,
                note=note,
                created_by=actor,
                updated_by=actor,
            )
    except IntegrityError as exc:  # the same promise, from another device, first
        raise _already_open() from exc
    write_audit(
        ctx=ctx,
        action=AuditAction.SHOP_PROMISE_CREATED,
        entity_type="parties_shop_promise",
        entity_id=promise.id,
        after=_snapshot(promise),
        metadata={"idempotency_key": ctx.idempotency_key},
    )
    return promise


def _locked(ctx: Ctx, promise_id: Any, version: int) -> ShopPromise:
    promise = (
        ShopPromise.objects.filter(tenant=ctx.tenant, pk=promise_id)
        .select_for_update()
        .select_related("party")
        .first()
    )
    if promise is None:
        raise NotFound()
    if promise.version != version:
        raise StaleVersion(current_version=promise.version)
    if promise.state != ShopPromiseState.OPEN:
        raise BusinessRuleViolation(
            "promise_closed", _("This promise is already closed. Add a new one instead.")
        )
    return promise


@transaction.atomic
def change_promise(
    *,
    ctx: Ctx,
    promise_id: Any,
    version: int,
    promised_on: dt.date | Any = _UNSET,
    amount: Decimal | None | Any = _UNSET,
    note: str | Any = _UNSET,
) -> ShopPromise:
    promise = _locked(ctx, promise_id, version)
    _check_party(promise.party, promise.role)
    before = _snapshot(promise)
    if promised_on is not _UNSET and promised_on != promise.promised_on:
        _check_date(ctx.tenant, promised_on)
        promise.promised_on = promised_on
    if amount is not _UNSET:
        promise.amount = amount
    if note is not _UNSET:
        promise.note = note
    after = _snapshot(promise)
    if after == before:
        return promise  # nothing changed: no new version, no audit row
    promise.version += 1
    promise.updated_by = _actor(ctx)
    promise.save(
        update_fields=["promised_on", "amount", "note", "version", "updated_by", "updated_at"]
    )
    write_audit(
        ctx=ctx,
        action=AuditAction.SHOP_PROMISE_CHANGED,
        entity_type="parties_shop_promise",
        entity_id=promise.id,
        before=before,
        after=after,
        metadata={"idempotency_key": ctx.idempotency_key},
    )
    return promise


@transaction.atomic
def close_promise(*, ctx: Ctx, promise_id: Any, version: int, state: str) -> ShopPromise:
    """Kept or cancelled. Either way the promise stays, as the contact's history."""
    if state not in (ShopPromiseState.KEPT, ShopPromiseState.CANCELLED):
        raise ValidationFailed({"state": [_("Choose kept or cancelled.")]})
    promise = _locked(ctx, promise_id, version)
    before = _snapshot(promise)
    actor = _actor(ctx)
    promise.state = state
    promise.closed_at = timezone.now()
    promise.closed_by = actor
    promise.updated_by = actor
    promise.version += 1
    promise.save(
        update_fields=["state", "closed_at", "closed_by", "updated_by", "version", "updated_at"]
    )
    write_audit(
        ctx=ctx,
        action=(
            AuditAction.SHOP_PROMISE_KEPT
            if state == ShopPromiseState.KEPT
            else AuditAction.SHOP_PROMISE_CANCELLED
        ),
        entity_type="parties_shop_promise",
        entity_id=promise.id,
        before=before,
        after=_snapshot(promise),
        metadata={"idempotency_key": ctx.idempotency_key},
    )
    return promise
