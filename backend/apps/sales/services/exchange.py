"""G6 — exchange at the counter: one credit note and one bill, made together.

Nothing new is invented for the money. The return is an ordinary credit note
against the old bill (stock back, credit on the customer's book, any due on the
old bill settled first), and the new sale is an ordinary bill that takes that
note's credit. Whatever the bill leaves over stays open on the note to use
later; it is never paid out as cash. Either both documents exist or neither.
"""

from __future__ import annotations

from typing import Any

from django.db import transaction

from apps.common.context import Ctx
from apps.common.exceptions import ValidationFailed
from apps.sales.constants import CreditNoteReason, Settlement
from apps.sales.services import documents as drafts
from apps.sales.services.credit_note_issue import issue_credit_note
from apps.sales.services.credit_notes import create_credit_note, invoice_for_credit
from apps.sales.services.issue import issue_invoice


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

    old_bill = invoice_for_credit(ctx.tenant, data.get("against_id"))
    if old_bill.party_id is None:
        raise ValidationFailed({"against_id": ["Exchange needs a bill with a saved customer."]})

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
