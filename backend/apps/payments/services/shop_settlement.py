"""BP-08 (R-DEC-26) — settle a Shop contact's customer and supplier balances.

The owner decided (D-03, R-DEC-13) that a person who is both a customer and a
supplier keeps two separate balances, and that only an explicit act of the
merchant may set one against the other. This module is that act and nothing
else calls it.

── What is recorded ──────────────────────────────────────────────────────────
Two `adjustment` payments in the Shop bucket, through `record_adjustment` — the
same validation, locks, numbering, allocation, ledger posting and audit as any
payment (no second writer of money):

* IN from the contact (RCT series), allocated oldest first to their open Shop
  invoices — the ones `parties.selectors.shop` counts in the customer balance;
* OUT to the contact (PAYOUT series), allocated in the purchase target's own
  due-date order to their open purchase bills.

Every role figure, aging band and bill status reads `amount_due`, so all of
them reconcile without a new reader; the Shop khata gets a credit and a debit
of the same amount, so the contact's combined Shop balance does not move, and
`adjustment` is not cash, so the cash book, the cash count and the money cards
never count it. No stock, tax, revenue, Udhaar, Library or Lending row moves.

── What is checked, and when ─────────────────────────────────────────────────
Under the party lock (L1 — every payment, bill and void of this contact waits
on it): the contact is active, is both a customer and a supplier, and the two
balances are re-read. The amount must be > 0 and at most the smaller balance.
When the client sends the balances it showed the merchant (`expected`), a
difference refuses the write with the current figures: the merchant agreed to
"₹1,000 and ₹600", not to whatever they became on another device.

── Reversal (specified before build, as BP-08 requires) ─────────────────────
A settlement is never edited or deleted. It is undone by voiding either of its
payments on `/payments/{id}/void` (`payments.payment.void`: owner and admin,
like any receipt), which voids BOTH in one transaction, reopens the bills each
had settled, writes reversal khata lines dated today and stamps the
settlement's `voided_at`/`voided_by`/`void_reason`. To settle a different
amount the merchant voids and settles again.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from django.db import transaction

from apps.common.audit import AuditAction, write_audit
from apps.common.constants import LedgerBucket, PaymentMode
from apps.common.context import Ctx
from apps.common.dates import tenant_today
from apps.common.db.fields import uuid7
from apps.common.exceptions import BusinessRuleViolation, NotFound, ValidationFailed
from apps.common.money import ZERO
from apps.parties.constants import PartyStatus
from apps.parties.services.balance import lock_party
from apps.payments.constants import PaymentDirection
from apps.payments.models import ShopSettlement

#: `payments_payment.meta.context` of both halves, and what the receipt says.
SETTLEMENT_CONTEXT = "shop_settlement"
NOTE_MAX = 200
CENT = Decimal("0.01")


def role_balances(*, tenant: Any, party_id: Any) -> dict[str, Decimal] | None:
    """The two Shop role balances, exactly as the Customers and Suppliers lists read them."""
    from apps.parties.selectors.shop import shop_party_facts

    party = shop_party_facts(tenant=tenant, party_id=party_id)
    if party is None:
        return None
    return {
        "customer_balance": Decimal(party.shop_customer_balance),
        "supplier_balance": Decimal(party.shop_supplier_balance),
        # A6 — the old balances carried in from before the app. They are in the
        # two figures above (that is what the lists show) but no bill carries
        # them, so a settlement, which nets bills against bills, cannot use them.
        "customer_opening": Decimal(party.shop_customer_opening),
        "supplier_opening": Decimal(party.shop_supplier_opening),
    }


def settleable(balances: dict[str, Decimal]) -> Decimal:
    """The most that may be settled: the smaller of what each side owes, never below zero."""
    return max(
        min(
            balances["customer_balance"] - balances.get("customer_opening", ZERO),
            balances["supplier_balance"] - balances.get("supplier_opening", ZERO),
        ),
        ZERO,
    )


def money_text(balances: dict[str, Decimal]) -> dict[str, str]:
    return {
        key: f"{balances[key]:.2f}" for key in ("customer_balance", "supplier_balance") if key in balances
    }


def _amount(raw: Any) -> Decimal:
    try:
        value = Decimal(str(raw))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationFailed({"amount": ["Enter an amount."]}) from None
    if not value.is_finite() or value <= ZERO:
        raise ValidationFailed({"amount": ["Enter an amount above zero."]})
    if value != value.quantize(CENT):
        raise ValidationFailed({"amount": ["Use at most two decimal places."]})
    return value


def _expected(raw: Any) -> dict[str, Decimal] | None:
    if raw in (None, ""):
        return None
    if not isinstance(raw, dict):
        raise ValidationFailed({"expected": ["Send the two balances you showed."]})
    out: dict[str, Decimal] = {}
    for key in ("customer_balance", "supplier_balance"):
        try:
            out[key] = Decimal(str(raw.get(key)))
        except (InvalidOperation, TypeError, ValueError):
            raise ValidationFailed({f"expected.{key}": ["Send the balance you showed."]}) from None
    return out


def _fifo(rows: list[Any], amount: Decimal, document_type: str) -> list[dict]:
    """Oldest first, each capped by what it still owes, until `amount` is used up."""
    left = amount
    picks: list[dict] = []
    for document in rows:
        if left <= ZERO:
            break
        take = min(Decimal(document.amount_due), left)
        if take <= ZERO:
            continue
        picks.append(
            {"document_type": document_type, "document_id": str(document.id), "amount": str(take)}
        )
        left -= take
    if left > ZERO:
        # The balances said there was enough to settle; the documents disagree. Never write
        # half a settlement or leave the remainder as an advance nobody asked for.
        raise BusinessRuleViolation(
            "settlement_balances_changed",
            "These balances changed. Check the new figures and try again.",
        )
    return picks


def _open_invoices(*, tenant: Any, party_id: Any) -> tuple[Any, list[Any]]:
    """The customer's open Shop invoices — the set the customer balance counts — oldest first."""
    from apps.parties.selectors.shop import shop_invoice_ids
    from apps.payments.services.targets import target_for

    target = target_for("sales_document")
    counted = shop_invoice_ids(tenant=tenant, party_id=party_id)
    rows = [
        doc
        for doc in target.open_documents(tenant=tenant, party_id=party_id)
        if str(doc.id) in counted
    ]
    return target, rows


def _open_bills(*, tenant: Any, party_id: Any) -> tuple[Any, list[Any]]:
    """The supplier's open purchase bills, in the purchase target's own order (PUR-02 FR-3)."""
    from apps.payments.services.targets import target_for

    target = target_for("purchase_document")
    return target, target.open_documents(tenant=tenant, party_id=party_id)


def _invoice_allocations(*, tenant: Any, party_id: Any, amount: Decimal) -> list[dict]:
    target, rows = _open_invoices(tenant=tenant, party_id=party_id)
    return _fifo(rows, amount, target.document_type)


def _bill_allocations(*, tenant: Any, party_id: Any, amount: Decimal) -> list[dict]:
    target, rows = _open_bills(tenant=tenant, party_id=party_id)
    return _fifo(rows, amount, target.document_type)


def settlement_documents(*, tenant: Any, party_id: Any) -> dict[str, list[dict]]:
    """The open invoices and bills a settlement would settle, in the order it settles them.

    The dialog shows which ones a given amount reaches, as a contra entry names them
    (Sage 200 "Contra entries"), using exactly the rows and order `settle_shop_roles` uses."""

    def rows(found: tuple[Any, list[Any]]) -> list[dict]:
        target, documents = found
        out = []
        for document in documents:
            due = Decimal(target.outstanding(document))
            if due <= ZERO:
                continue
            out.append(
                {
                    "document_id": str(document.id),
                    "number": document.number,
                    "document_date": document.document_date.isoformat(),
                    "amount_due": f"{due:.2f}",
                }
            )
        return out

    return {
        "invoices": rows(_open_invoices(tenant=tenant, party_id=party_id)),
        "bills": rows(_open_bills(tenant=tenant, party_id=party_id)),
    }


def _refuse_changed(current: dict[str, Decimal]) -> BusinessRuleViolation:
    return BusinessRuleViolation(
        "settlement_balances_changed",
        "These balances changed. Check the new figures and try again.",
        details={**money_text(current), "max_amount": f"{settleable(current):.2f}"},
    )


@transaction.atomic
def settle_shop_roles(
    *, ctx: Ctx, party_id: Any, amount: Any, note: Any = "", expected: Any = None
) -> dict:
    """Settle `amount` of a dual-role contact's two Shop balances. See the module docstring.

    Returns `{settlement, in_payment, out_payment, before, after, documents}`.
    """
    value = _amount(amount)
    shown = _expected(expected)
    text = str(note or "").strip()
    if len(text) > NOTE_MAX:
        raise ValidationFailed({"note": [f"Keep the note under {NOTE_MAX} characters."]})

    try:
        party = lock_party(tenant=ctx.tenant, party_id=party_id)
    except (ValueError, TypeError):
        party = None
    if party is None or party.deleted_at is not None:
        raise NotFound("No such contact.")
    if party.status == PartyStatus.ARCHIVED:
        raise BusinessRuleViolation(
            "party_archived",
            "This contact is archived. Restore them to settle their balances.",
            details={"party_id": str(party.id), "name": party.name},
        )
    if not (party.is_customer and party.is_supplier):
        raise BusinessRuleViolation(
            "settlement_not_dual_role",
            "Only someone who is both your customer and your supplier can be settled.",
            details={"party_id": str(party.id)},
        )

    before = role_balances(tenant=ctx.tenant, party_id=party.id)
    assert before is not None  # the row is locked and visible
    if shown is not None and (
        shown["customer_balance"] != before["customer_balance"]
        or shown["supplier_balance"] != before["supplier_balance"]
    ):
        raise _refuse_changed(before)
    most = settleable(before)
    if value > most:
        raise BusinessRuleViolation(
            "settlement_over_balance",
            (
                f"You can settle up to ₹{most:,.2f}, the smaller of the two balances."
                if most > ZERO
                else "There is nothing to settle: one of the two balances is zero."
            ),
            details={**money_text(before), "max_amount": f"{most:.2f}"},
        )

    from apps.payments.services.record import record_adjustment

    settlement_id = uuid7()
    today = tenant_today(ctx.tenant)
    common = {
        "party_id": str(party.id),
        "payment_date": today.isoformat(),
        "amount": str(value),
        "mode_breakup": [{"mode": PaymentMode.ADJUSTMENT.value, "amount": str(value)}],
        "note": text[:NOTE_MAX],
        "bucket": LedgerBucket.SHOP.value,
        "context": SETTLEMENT_CONTEXT,
        "meta": {"shop_settlement_id": str(settlement_id)},
        # A bill dated after today is still owed; the merchant chose to settle it.
        "confirm_early_allocation": True,
    }
    received = record_adjustment(
        ctx=ctx,
        payload={
            **common,
            "direction": PaymentDirection.IN.value,
            "allocations": _invoice_allocations(tenant=ctx.tenant, party_id=party.id, amount=value),
        },
    )
    paid = record_adjustment(
        ctx=ctx,
        payload={
            **common,
            "direction": PaymentDirection.OUT.value,
            "allocations": _bill_allocations(tenant=ctx.tenant, party_id=party.id, amount=value),
        },
    )
    after = role_balances(tenant=ctx.tenant, party_id=party.id)
    assert after is not None
    settlement = ShopSettlement.objects.create(
        id=settlement_id,
        tenant=ctx.tenant,
        created_by=ctx.actor if ctx.actor_type == "user" else None,
        party=party,
        amount=value,
        settled_on=today,
        note=text,
        in_payment=received["payment"],
        out_payment=paid["payment"],
        before=money_text(before),
        after=money_text(after),
    )
    write_audit(
        ctx=ctx,
        action=AuditAction.SHOP_SETTLEMENT_RECORDED,
        entity_type="payments_shop_settlement",
        entity_id=settlement.id,
        before=money_text(before),
        after=money_text(after),
        metadata={
            "idempotency_key": ctx.idempotency_key,
            "party_id": str(party.id),
            "amount": f"{value:.2f}",
            "in_payment": {"id": str(received["payment"].id), "number": received["payment"].number},
            "out_payment": {"id": str(paid["payment"].id), "number": paid["payment"].number},
            # Which bills each half settled, and what each still owes now.
            "documents": [
                {
                    "document_id": row.get("document_id"),
                    "number": row.get("number"),
                    "amount_due": row.get("amount_due"),
                }
                for row in received["documents"] + paid["documents"]
                if isinstance(row, dict)
            ],
        },
    )
    return {
        "settlement": settlement,
        "in_payment": received["payment"],
        "out_payment": paid["payment"],
        "before": before,
        "after": after,
        "documents": received["documents"] + paid["documents"],
    }


def stamp_settlement_voided(
    ctx: Ctx, settlement: ShopSettlement, payments: list[Any], reason: str
) -> None:
    """Called by `void_payment` once both halves are void, inside its transaction."""
    from django.utils import timezone

    settlement.voided_at = timezone.now()
    settlement.voided_by = ctx.actor if ctx.actor_type == "user" else None
    settlement.void_reason = reason
    settlement.save(update_fields=["voided_at", "voided_by", "void_reason", "updated_at"])
    after = role_balances(tenant=ctx.tenant, party_id=settlement.party_id) or {}
    write_audit(
        ctx=ctx,
        action=AuditAction.SHOP_SETTLEMENT_VOIDED,
        entity_type="payments_shop_settlement",
        entity_id=settlement.id,
        before={"voided_at": None, **settlement.after},
        after={"voided_at": settlement.voided_at.isoformat(), **money_text(after)},
        metadata={
            "reason": reason,
            "party_id": str(settlement.party_id),
            "payment_ids": [str(payment.id) for payment in payments],
        },
    )


# ── The message the merchant may send (editable on the phone before it goes) ──
#: From the contact's side, signed with the business's name only, `Rs` not the glyph
#: (receipt.py's rules). It names both remaining balances, because a settlement is
#: about both, and says plainly that no money moved.
SHARE_LINES = {
    "en": {
        "hello": "Namaste {name},",
        "hello_nobody": "Namaste,",
        "what": (
            "On {date} we settled Rs {amount} of what you owe us against what we owe you."
            " No cash changed hands."
        ),
        "owe_us": "You still owe us: Rs {amount}.",
        "owe_you": "We still owe you: Rs {amount}.",
        "clear_us": "Nothing due from you now.",
        "clear_you": "Nothing due to you now.",
        "refs": "Receipt {received} · Voucher {paid}.",
        "sign": "— {shop}",
    },
    "hi": {
        "hello": "नमस्ते {name},",
        "hello_nobody": "नमस्ते,",
        "what": (
            "{date} को आपकी बाकी रकम में से Rs {amount} हमारी बाकी रकम से बराबर किए।"
            " कोई नकद लेन-देन नहीं हुआ।"
        ),
        "owe_us": "आपसे लेना बाकी: Rs {amount}।",
        "owe_you": "आपको देना बाकी: Rs {amount}।",
        "clear_us": "अब आपसे कुछ लेना बाकी नहीं।",
        "clear_you": "अब आपको कुछ देना बाकी नहीं।",
        "refs": "रसीद {received} · वाउचर {paid}।",
        "sign": "— {shop}",
    },
}


def settlement_share_text(settlement: ShopSettlement, *, locale: str | None = None) -> str:
    """The balances AFTER the settlement as the merchant confirmed them (`after`)."""
    from apps.ledger.services.messaging import format_rs, message_locale, shop_name
    from apps.payments.services.receipt import _date

    tenant = settlement.tenant
    locale = locale if locale in ("en", "hi") else message_locale(tenant)
    words = SHARE_LINES[locale]
    name = (settlement.party.name or "").strip()
    owed = Decimal(settlement.after.get("customer_balance") or "0")
    owing = Decimal(settlement.after.get("supplier_balance") or "0")
    lines = [
        words["hello"].format(name=name) if name else words["hello_nobody"],
        words["what"].format(
            date=_date(settlement.settled_on, locale), amount=format_rs(settlement.amount)
        ),
        words["owe_us"].format(amount=format_rs(owed)) if owed > ZERO else words["clear_us"],
        words["owe_you"].format(amount=format_rs(owing)) if owing > ZERO else words["clear_you"],
        words["refs"].format(
            received=settlement.in_payment.number, paid=settlement.out_payment.number
        ),
        words["sign"].format(shop=shop_name(tenant)),
    ]
    return "\n".join(lines)
