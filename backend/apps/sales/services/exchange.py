"""G6 — exchange at the counter: one credit note and one bill, made together.

Nothing new is invented for the money. The return is an ordinary credit note
against the old bill (stock back, credit on the customer's book, any due on the
old bill settled first), and the new sale is an ordinary bill that takes that
note's credit. Whatever the bill leaves over stays open on the note to use
later; it is never paid out as cash. Either both documents exist or neither.

A quick-sale bill has nobody to hold a credit, so the customer is saved first
and the bill is linked to them (SAL-04 EC-7), inside the same transaction. The
bill was paid in full and posted no ledger line, so linking moves no balance.
"""

from __future__ import annotations

from typing import Any

from django.db import transaction

from apps.common.context import Ctx
from apps.common.exceptions import ValidationFailed
from apps.sales.constants import (
    CREDITABLE_STATUSES,
    INVOICE_KINDS,
    CreditNoteReason,
    Settlement,
)
from apps.sales.models import SalesDocument
from apps.sales.services import documents as drafts
from apps.sales.services.credit_note_issue import issue_credit_note
from apps.sales.services.credit_notes import create_credit_note, invoice_for_credit
from apps.sales.services.issue import issue_invoice


def _save_quick_sale_customer(*, ctx: Ctx, bill_id: Any, data: dict) -> None:
    """Link a quick-sale bill to the customer standing at the counter."""
    from apps.parties.models import Party
    from apps.parties.services.crud import create_party

    bill = SalesDocument.objects.select_for_update().get(tenant=ctx.tenant, pk=bill_id)
    if bill.party_id is not None:
        return
    customer = data.get("customer") if isinstance(data.get("customer"), dict) else {}
    name = str(customer.get("name") or bill.walk_in_name or "").strip()
    mobile = str(customer.get("mobile") or bill.walk_in_mobile or "").strip()
    errors: dict[str, list[str]] = {}
    if not name:
        errors["customer.name"] = ["Enter the customer's name."]
    if not mobile:
        errors["customer.mobile"] = ["Enter the customer's mobile."]
    if errors:
        raise ValidationFailed(errors)
    party = Party.objects.filter(
        tenant=ctx.tenant, mobile__endswith=mobile[-10:], deleted_at__isnull=True, status="active"
    ).first()
    if party is None:
        party, _warnings = create_party(
            ctx=ctx, payload={"name": name, "mobile": mobile, "type": "customer"}
        )
    snapshot = dict(bill.party_snapshot or {})
    snapshot.update(name=snapshot.get("name") or party.name, mobile=party.mobile)
    SalesDocument.objects.filter(pk=bill.pk).update(
        party=party, walk_in_name=None, walk_in_mobile=None, party_snapshot=snapshot
    )


@transaction.atomic
def make_exchange(*, ctx: Ctx, data: dict) -> dict:
    """Returns `{credit_note, invoice}`, both issued."""
    returns = [row for row in (data.get("returns") or []) if isinstance(row, dict)]
    lines = [row for row in (data.get("lines") or []) if isinstance(row, dict)]
    errors: dict[str, list[str]] = {}
    if not returns:
        errors["returns"] = ["Tick what is coming back."]
    if not lines:
        errors["lines"] = ["Add what is going out."]
    if errors:
        raise ValidationFailed(errors)

    against_id = data.get("against_id")
    if (
        SalesDocument.objects.filter(
            tenant=ctx.tenant, pk=against_id, kind__in=INVOICE_KINDS, status__in=CREDITABLE_STATUSES
        )
        .filter(party__isnull=True)
        .exists()
    ):
        _save_quick_sale_customer(ctx=ctx, bill_id=against_id, data=data)
    old_bill = invoice_for_credit(ctx.tenant, against_id)

    note = create_credit_note(
        ctx=ctx,
        payload={
            "against_id": old_bill.id,
            "lines": returns,
            "reason": CreditNoteReason.SALES_RETURN.value,
            "restock": True,
            "settlement": Settlement.HOLD_ADVANCE.value,
        },
    )["document"]
    note = issue_credit_note(ctx=ctx, document_id=note.id)["document"]

    draft = drafts.create_draft(
        ctx=ctx,
        payload={"party_id": old_bill.party_id, "lines": lines},
    )["document"]
    outcome = issue_invoice(
        ctx=ctx,
        document_id=draft.id,
        payment=data.get("payment") or None,
        apply_credit_note_ids=[note.id] if note.amount_due > 0 else [],
    )
    note.refresh_from_db()
    return {"credit_note": note, "invoice": outcome["document"]}


def preview_exchange(*, ctx: Ctx, data: dict) -> dict:
    """The real figures, with GST and rounding, from the real issue paths, then
    rolled back: the screen shows what Done will do and keeps no second tax sum."""
    with transaction.atomic():
        body = view(make_exchange(ctx=ctx, data=data))
        transaction.set_rollback(True)
    return {
        "goes_out": body["invoice"]["grand_total"],
        "comes_back": body["credit_note"]["grand_total"],
        "to_pay": body["invoice"]["amount_due"],
        "credit_left": body["credit_note"]["open_credit"],
    }


def view(result: dict[str, Any]) -> dict:
    note, invoice = result["credit_note"], result["invoice"]
    return {
        "credit_note": {
            "id": str(note.id),
            "number": note.number,
            "grand_total": str(note.grand_total),
            "open_credit": str(note.amount_due),
        },
        "invoice": {
            "id": str(invoice.id),
            "number": invoice.number,
            "grand_total": str(invoice.grand_total),
            "amount_due": str(invoice.amount_due),
        },
    }
