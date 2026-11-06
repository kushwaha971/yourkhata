"""PAY-03 — the Collect QR from the tenant's VPA; PAY-04 — the receipt's share text."""

from __future__ import annotations

import re
from typing import Any

import pytest

from apps.common.audit import AuditAction
from apps.payments.models import Payment
from apps.payments.tests.conftest import cash_lines, pay, payment_url
from apps.platform_app.models import AuditLog

pytestmark = pytest.mark.django_db

PRODUCT = re.compile("yourkhata|digikhaato|udhaarbook", re.I)


def test_the_collect_qr_carries_the_amount_and_a_party_reference(
    owner: Any, make_party: Any
) -> None:
    """AC-2 (PAY-03) — `am=2800.00` and `tr=PTY-<short id>`; the QR is local module data."""
    party = make_party()
    response = owner.post(
        "/api/v1/payments/upi-intent",
        {"amount": "2800", "party_id": str(party.id)},
        format="json",
    )
    assert response.status_code == 200, response.json()
    data = response.json()["data"]
    assert data["upi_url"].startswith("upi://pay?pa=sharma@okhdfc&")
    assert "am=2800.00" in data["upi_url"] and "tr=PTY-" in data["upi_url"]
    assert data["qr"]["size"] == len(data["qr"]["modules"]) > 20


def test_a_static_qr_has_no_amount_and_a_missing_vpa_is_409(owner: Any, shop: Any) -> None:
    """BR-3 — no `am`, `tn` or `tr` on the counter QR; without a VPA, `upi_vpa_missing`."""
    static = owner.post("/api/v1/payments/upi-intent", {}, format="json").json()["data"]
    assert "am=" not in static["upi_url"] and "tr=" not in static["upi_url"]
    shop.upi_vpa = ""
    shop.save(update_fields=["upi_vpa"])
    missing = owner.post("/api/v1/payments/upi-intent", {"amount": "10"}, format="json")
    assert missing.status_code == 409 and missing.json()["error"]["code"] == "upi_vpa_missing"


def share_text(client: Any, payment_id: str, locale: str = "en") -> str:
    response = client.post(
        payment_url(payment_id, "share"),
        {"locale": locale},
        format="json",
        HTTP_IDEMPOTENCY_KEY=f"share-{payment_id}-{locale}",
    )
    assert response.status_code == 200, response.json()
    return response.json()["data"]["text"]


def test_the_share_text_says_what_was_paid_against_what_and_the_balance(
    owner: Any, make_party: Any, invoice_for: Any
) -> None:
    """08 §10.2 (owner, 24 Oct 2026) — a greeting by name, "Rs 500 by UPI (UTR …0123)",
    the date in words, the bill, the receipt number, "Still due: Rs 398", signed with
    the business's name; audited as `payment.receipt_shared`. The old text read
    "Balance: Rs 398 (you will give)", which a customer had to decode."""
    party = make_party(mobile="+919812345678")
    inv = invoice_for(party, "898.00")
    paid = pay(
        owner,
        party_id=str(party.id),
        mode_breakup=[{"mode": "upi", "amount": "500.00", "reference": "UTR0000123"}],
    ).json()["data"]
    response = owner.post(
        payment_url(paid["id"], "share"),
        {"locale": "en"},
        format="json",
        HTTP_IDEMPOTENCY_KEY="share-1",
    )
    assert response.status_code == 200, response.json()
    lines = response.json()["data"]["text"].split("\n")
    assert lines[0] == "Namaste Ramesh Traders,"
    assert lines[1].startswith("Received Rs 500 by UPI (UTR …0123) on ")
    assert lines[1].endswith(f" for bill {inv['number']}.")
    assert lines[2] == f"Receipt {paid['number']}."
    assert lines[3] == "Still due: Rs 398."
    assert lines[4].startswith("Thank you — ")
    assert response.json()["data"]["mobile"] == "+919812345678"
    assert AuditLog.objects.filter(action=AuditAction.PAYMENT_RECEIPT_SHARED).count() == 1


def test_cash_with_no_bill_says_in_cash_and_names_the_advance(owner: Any, make_party: Any) -> None:
    """08 §10.2 — "in cash", no bill line, and money beyond what is owed is named as
    the customer's advance rather than as a balance with a sign to decode."""
    party = make_party()
    paid = pay(owner, party_id=str(party.id), mode_breakup=cash_lines("250.00")).json()["data"]
    text = share_text(owner, paid["id"])
    assert " in cash on " in text and " for bill" not in text
    assert "Advance with us: Rs 250." in text
    assert not PRODUCT.search(text)


def test_the_hindi_text_says_the_same_in_hindi(owner: Any, make_party: Any) -> None:
    """The business's language: नमस्ते, the month in Hindi, रसीद, and the same figures."""
    party = make_party()
    paid = pay(owner, party_id=str(party.id), mode_breakup=cash_lines("250.00")).json()["data"]
    text = share_text(owner, paid["id"], "hi")
    assert text.startswith("नमस्ते Ramesh Traders,")
    assert "Rs 250 नकद मिले" in text and f"रसीद {paid['number']}।" in text
    assert "आपका एडवांस: Rs 250।" in text and "धन्यवाद — " in text
    assert any(
        month in text
        for month in (
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
    )


def test_money_paid_out_is_a_voucher_and_an_advance_with_them(owner: Any, make_party: Any) -> None:
    """Money paid to a supplier who was owed nothing is their advance: "Advance with
    you", a Voucher, no "Thank you" — and never the product's name."""
    party = make_party()
    paid = pay(
        owner, direction="out", party_id=str(party.id), mode_breakup=cash_lines("100.00")
    ).json()["data"]
    text = share_text(owner, paid["id"])
    assert "Paid Rs 100 in cash on " in text and f"Voucher {paid['number']}." in text
    assert "Advance with you: Rs 100." in text and "Thank you" not in text
    assert not PRODUCT.search(text)


def test_the_accountant_prints_but_does_not_share(
    shop: Any, api_as: Any, owner: Any, make_party: Any
) -> None:
    """T-PAY-04-10 — the detail (print) is a read; the share is a write."""
    party = make_party()
    pay(owner, party_id=str(party.id), mode_breakup=[{"mode": "cash", "amount": "10"}])
    accountant, _ = api_as(shop, role="accountant")
    payment_id = Payment.objects.get().id
    detail = accountant.get(payment_url(payment_id))
    assert detail.status_code == 200
    assert detail.json()["data"]["party_balance_after"] == "-10.00"
    shared = accountant.post(
        payment_url(payment_id, "share"), {}, format="json", HTTP_IDEMPOTENCY_KEY="share-2"
    )
    assert shared.status_code == 403


def test_a_split_payment_says_and_and_a_cheque_is_not_a_utr(owner: Any, make_party: Any) -> None:
    """The first LOOK of the live message read "by cash + UPI", and called every
    reference a UTR, so a cheque's number went out as "UTR …4417"."""
    party = make_party()
    split = pay(
        owner,
        party_id=str(party.id),
        mode_breakup=[
            {"mode": "cash", "amount": "100.00"},
            {"mode": "upi", "amount": "50.00", "reference": "UTR0000417"},
        ],
    ).json()["data"]
    assert "Received Rs 150 by cash and UPI (UTR …0417) on " in share_text(owner, split["id"])
    cheque = pay(
        owner,
        party_id=str(party.id),
        mode_breakup=[{"mode": "cheque", "amount": "70.00", "reference": "004417"}],
    ).json()["data"]
    assert "Received Rs 70 by cheque (cheque …4417) on " in share_text(owner, cheque["id"])
