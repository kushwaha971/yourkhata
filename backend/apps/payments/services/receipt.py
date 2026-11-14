"""PAY-04 BR-4 — the receipt's WhatsApp text, rendered server-side.

The client never composes a sentence with money in it: it asks for this text
and hands it to the share sheet, which opens `wa.me` with it. The merchant's
own WhatsApp sends it (NTF-03), so nothing here says "sent" (DEC-012).

── What is not in the text, deliberately ────────────────────────────────────
08 §10.2's example ends with a `Receipt: https://…/d/…` line for the public
`/d/<token>` page. That page renders a stub today (the sales track records the
same gap), and a link that opens a stub teaches a customer the receipt is not
real. The line is left out until `parties_share_link` and the public page
exist. The rest is §10.2's wording (owner, 24 Oct 2026), with `Rs` for the
rupee glyph as every message in the product writes it.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from apps.common.audit import AuditAction, write_audit
from apps.common.context import Ctx
from apps.common.money import ZERO
from apps.ledger.services.messaging import format_rs, message_locale, shop_name
from apps.payments.constants import PaymentDirection
from apps.payments.models import Payment
from apps.payments.selectors.payments import allocation_details, party_balance_after

#: How a payment arrived, as the sentence says it: "in cash", "by UPI".
MODE_WORDS = {
    "en": {
        "cash": "cash",
        "upi": "UPI",
        "bank": "bank transfer",
        "cheque": "cheque",
        "card": "card",
        "other": "other",
    },
    "hi": {
        "cash": "नकद",
        "upi": "UPI",
        "bank": "बैंक ट्रांसफ़र",
        "cheque": "चेक",
        "card": "कार्ड",
        "other": "अन्य",
    },
}
HI_MONTHS = (
    "जनवरी",
    "फ़रवरी",
    "मार्च",
    "अप्रैल",
    "मई",
    "जून",
    "जुलाई",
    "अगस्त",
    "सितंबर",
    "अक्टूबर",
    "नवंबर",
    "दिसंबर",
)

#: 08 §10.2 — a greeting, what came in and how, the bills, the receipt number,
#: what is still due, signed with the business's name only. Plain words, one
#: fact a line, so it reads on a phone's lock screen. `Rs`, never the rupee glyph
#: (NTF-02 FR-7: it turns one SMS into three).
LINES = {
    "en": {
        "hello": "Namaste {name},",
        "hello_nobody": "Namaste,",
        "in": "Received Rs {amount} {how} on {date}{bills}.",
        "out": "Paid Rs {amount} {how} on {date}{bills}.",
        "how_cash": "in cash",
        "how": "by {modes}",
        "and": " and ",
        "ref_utr": " (UTR …{ref})",
        "ref_cheque": " (cheque …{ref})",
        "ref": " (ref …{ref})",
        "bill": " for bill {numbers}",
        "bills": " for bills {numbers}",
        "receipt_in": "Receipt {number}.",
        "receipt_out": "Voucher {number}.",
        # From the customer's side (LED-08 BR-2): never "you owe".
        "due": "Still due: Rs {amount}.",
        "advance_in": "Advance with us: Rs {amount}.",
        "to_pay": "Still to pay you: Rs {amount}.",
        "advance_out": "Advance with you: Rs {amount}.",
        "clear": "Nothing due now.",
        "sign_in": "Thank you — {shop}",
        "sign_out": "— {shop}",
    },
    "hi": {
        "hello": "नमस्ते {name},",
        "hello_nobody": "नमस्ते,",
        "in": "{date} को आपसे Rs {amount} {how} मिले{bills}।",
        "out": "{date} को आपको Rs {amount} {how} दिए{bills}।",
        "how_cash": "नकद",
        "how": "{modes} से",
        "and": " और ",
        "ref_utr": " (UTR …{ref})",
        "ref_cheque": " (चेक …{ref})",
        "ref": " (रेफ़ …{ref})",
        "bill": ", बिल {numbers} के लिए",
        "bills": ", बिल {numbers} के लिए",
        "receipt_in": "रसीद {number}।",
        "receipt_out": "वाउचर {number}।",
        "due": "बाकी: Rs {amount}।",
        "advance_in": "आपका एडवांस: Rs {amount}।",
        "to_pay": "आपको देना बाकी: Rs {amount}।",
        "advance_out": "आपके पास एडवांस: Rs {amount}।",
        "clear": "अब कुछ बाकी नहीं।",
        "sign_in": "धन्यवाद — {shop}",
        "sign_out": "— {shop}",
    },
}


def _date(value: Any, locale: str) -> str:
    if locale == "hi":
        return f"{value.day} {HI_MONTHS[value.month - 1]} {value.year}"
    return f"{value.day} {value.strftime('%b')} {value.year}"


def _how(payment: Payment, words: dict[str, str], locale: str) -> str:
    modes = [line["mode"] for line in payment.mode_breakup]
    if modes == ["cash"]:
        how = words["how_cash"]
    else:
        names = MODE_WORDS[locale]
        how = words["how"].format(modes=words["and"].join(names.get(m, m) for m in modes))
    if payment.reference:
        # A UTR is what UPI and bank transfers carry; a cheque has its number;
        # anything else is just a reference (a card slip, a note).
        if any(m in ("upi", "bank") for m in modes):
            key = "ref_utr"
        elif "cheque" in modes:
            key = "ref_cheque"
        else:
            key = "ref"
        how += words[key].format(ref=payment.reference[-4:])
    return how


def _balance_line(balance: Decimal, direction: str, words: dict[str, str]) -> str:
    """Positive: they owe the business; negative: the business owes them."""
    amount = format_rs(abs(balance))
    if balance == ZERO:
        return words["clear"]
    if direction == PaymentDirection.IN:
        return (words["due"] if balance > ZERO else words["advance_in"]).format(amount=amount)
    return (words["advance_out"] if balance > ZERO else words["to_pay"]).format(amount=amount)


def receipt_share_text(payment: Payment, *, locale: str | None = None) -> str:
    """08 §10.2 — the receipt's message; no link until the public page exists (module docstring)."""
    tenant = payment.tenant
    if (payment.meta or {}).get("context") == "shop_settlement":
        # BP-08 — half of a settlement: a "Received Rs 600 by adjustment" line and the
        # contact's COMBINED balance would both mislead. Say what the settlement did.
        from apps.payments.models import ShopSettlement
        from apps.payments.services.shop_settlement import settlement_share_text

        settlement = (
            ShopSettlement.objects.filter(tenant_id=payment.tenant_id)
            .filter(pk=(payment.meta or {}).get("shop_settlement_id"))
            .select_related("party", "tenant", "in_payment", "out_payment")
            .first()
        )
        if settlement is not None:
            return settlement_share_text(settlement, locale=locale)
    locale = locale if locale in ("en", "hi") else message_locale(tenant)
    words = LINES[locale]
    numbers = [row["number"] for row in allocation_details(payment) if row.get("number")]
    bills = ""
    if numbers:
        bills = words["bill" if len(numbers) == 1 else "bills"].format(numbers=", ".join(numbers))
    out = payment.direction == PaymentDirection.OUT
    name = payment.party.name.strip() if payment.party_id and payment.party else ""
    lines = [
        words["hello"].format(name=name) if name else words["hello_nobody"],
        words["out" if out else "in"].format(
            amount=format_rs(payment.amount),
            how=_how(payment, words, locale),
            date=_date(payment.payment_date, locale),
            bills=bills,
        ),
        words["receipt_out" if out else "receipt_in"].format(number=payment.number),
    ]
    balance = party_balance_after(payment)
    if balance is not None:
        lines.append(_balance_line(balance, payment.direction, words))
    lines.append(words["sign_out" if out else "sign_in"].format(shop=shop_name(tenant)))
    return "\n".join(lines)


def record_receipt_share(*, ctx: Ctx, payment: Payment, channel: str) -> None:
    """§16 `payment.receipt_shared` — who handed a receipt to whom, by which channel."""
    write_audit(
        ctx=ctx,
        action=AuditAction.PAYMENT_RECEIPT_SHARED,
        entity_type="payments_payment",
        entity_id=payment.id,
        after={"channel": channel},
        metadata={"number": payment.number},
    )
