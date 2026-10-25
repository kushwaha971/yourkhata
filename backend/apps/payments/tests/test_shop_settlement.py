"""BP-08 (R-DEC-26) — settling a Shop contact who is both a customer and a supplier.

Each test names a way a settlement could get money wrong or reach the wrong
person:

* the two role balances stay separate until the merchant settles, and a
  settlement moves each by exactly its amount — through the bills, so every
  list, band and bill status agrees — while no cash, sale or khata total moves;
* it is capped by the smaller balance, refused for zero, a negative amount, a
  contact with one role, an archived one, and balances that changed since the
  merchant looked;
* a retry or a double tap settles once, and two devices settling at once
  cannot together settle more than there was;
* undoing either half undoes both and reopens the bills, and nothing is ever
  deleted;
* only a Shop payment writer settles, only a Shop reader sees, only within
  their own business.
"""

from __future__ import annotations

import datetime as dt
import threading
import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.db import connection
from django.utils import timezone

from apps.common.audit import AuditAction
from apps.common.dates import tenant_today
from apps.parties.models import Party
from apps.payments.models import Payment, ShopSettlement
from apps.purchases.models import PurchaseDocument
from apps.sales.models import SalesDocument
from tests.factories.parties import PartyFactory

pytestmark = pytest.mark.django_db

URL = "/api/v1/payments/shop-settlements"


def _post(client: Any, url: str, body: dict, key: str | None = None) -> Any:
    return client.post(url, body, format="json", HTTP_IDEMPOTENCY_KEY=key or str(uuid.uuid4()))


def invoice(tenant: Any, party: Party, amount: str, number: str, days_old: int = 40) -> Any:
    today = tenant_today(tenant)
    return SalesDocument.objects.create(
        tenant=tenant,
        party=party,
        kind="invoice",
        status="issued",
        number=number,
        fy_label="26-27",
        document_date=today - dt.timedelta(days=days_old),
        due_on=today - dt.timedelta(days=days_old - 10),
        place_of_supply_state="27",
        grand_total=Decimal(amount),
        amount_due=Decimal(amount),
        issued_at=timezone.now(),
    )


def bill(tenant: Any, party: Party, amount: str, number: str, days_old: int = 20) -> Any:
    today = tenant_today(tenant)
    return PurchaseDocument.objects.create(
        tenant=tenant,
        party=party,
        kind="purchase_bill",
        status="recorded",
        number=number,
        fy_label="26-27",
        document_date=today - dt.timedelta(days=days_old),
        due_on=today - dt.timedelta(days=days_old - 5),
        place_of_supply_state="27",
        grand_total=Decimal(amount),
        amount_due=Decimal(amount),
    )


@pytest.fixture
def owner(tenant: Any, api_as: Any) -> Any:
    return api_as(tenant)[0]


@pytest.fixture
def ramesh(tenant: Any) -> Party:
    """Ramesh owes the shop ₹1,000 on two bills and the shop owes him ₹600 on one."""
    party = PartyFactory(tenant=tenant, name="Ramesh Traders", is_customer=True, is_supplier=True)
    invoice(tenant, party, "700.00", "INV-1", days_old=40)
    invoice(tenant, party, "300.00", "INV-2", days_old=10)
    bill(tenant, party, "600.00", "PB-1")
    return party


def figures(client: Any, party: Party) -> dict:
    return client.get(URL, {"party_id": str(party.id)}).json()["data"]


def settle(client: Any, party: Party, amount: str, **extra: Any) -> Any:
    return _post(client, URL, {"party_id": str(party.id), "amount": amount, **extra})


def test_balances_stay_separate_until_settled_then_move_by_the_amount(owner, ramesh):
    before = figures(owner, ramesh)
    assert (before["customer_balance"], before["supplier_balance"]) == ("1000.00", "600.00")
    assert before["max_amount"] == "600.00"
    assert before["settlements"] == []

    response = settle(
        owner,
        ramesh,
        "600.00",
        expected={"customer_balance": "1000.00", "supplier_balance": "600.00"},
    )
    assert response.status_code == 201, response.json()
    data = response.json()["data"]
    assert data["before"] == {"customer_balance": "1000.00", "supplier_balance": "600.00"}
    assert data["after"] == {"customer_balance": "400.00", "supplier_balance": "0.00"}

    after = figures(owner, ramesh)
    assert (after["customer_balance"], after["supplier_balance"]) == ("400.00", "0.00")
    assert after["max_amount"] == "0.00"
    # The lists read the same bills: Customers says 400, Suppliers says nothing.
    customer = owner.get("/api/v1/parties", {"book": "shop", "type": "customer"}).json()["data"]
    supplier = owner.get("/api/v1/parties", {"book": "shop", "type": "supplier"}).json()["data"]
    assert next(r for r in customer if r["id"] == str(ramesh.id))["balance"] == "400.00"
    assert next(r for r in supplier if r["id"] == str(ramesh.id))["balance"] == "0.00"


def test_it_settles_the_oldest_invoice_first_and_the_purchase_bill(tenant, owner, ramesh):
    settle(owner, ramesh, "600.00")
    first, second = SalesDocument.objects.filter(party=ramesh).order_by("number")
    assert (first.amount_due, first.status) == (Decimal("100.00"), "overdue")  # due long ago
    assert (second.amount_due, second.status) == (Decimal("300.00"), "issued")
    purchase = PurchaseDocument.objects.get(party=ramesh)
    assert (purchase.amount_due, purchase.status) == (Decimal("0.00"), "paid")


def test_the_dialog_is_told_which_bills_a_settlement_reaches_in_the_order_it_settles(
    owner, ramesh
):
    """A contra entry names the invoices and bills it settles (Sage 200). The dialog shows
    them before the merchant confirms, so the list must be exactly the rows and the order
    the settlement then uses — an order that differed would name the wrong bill."""
    documents = figures(owner, ramesh)["documents"]
    assert [(d["number"], d["amount_due"]) for d in documents["invoices"]] == [
        ("INV-1", "700.00"),
        ("INV-2", "300.00"),
    ]
    assert [(d["number"], d["amount_due"]) for d in documents["bills"]] == [("PB-1", "600.00")]

    settle(owner, ramesh, "600.00")
    after = figures(owner, ramesh)["documents"]
    # INV-1 took the 600 the list said it would, oldest first; PB-1 is paid and gone.
    assert [(d["number"], d["amount_due"]) for d in after["invoices"]] == [
        ("INV-1", "100.00"),
        ("INV-2", "300.00"),
    ]
    assert after["bills"] == []


def test_no_cash_moves_and_the_combined_shop_khata_does_not_change(tenant, owner, ramesh):
    shop_before = Party.objects.get(pk=ramesh.pk).shop_balance
    udhaar_before = Party.objects.get(pk=ramesh.pk).balance
    settle(owner, ramesh, "600.00")
    halves = list(Payment.objects.filter(party=ramesh).order_by("direction"))
    assert [p.direction for p in halves] == ["in", "out"]
    assert {p.primary_mode for p in halves} == {"adjustment"}
    assert {p.bucket for p in halves} == {"shop"}
    assert all(p.unallocated_amount == Decimal("0.00") for p in halves)
    party = Party.objects.get(pk=ramesh.pk)
    assert party.shop_balance == shop_before
    assert party.balance == udhaar_before  # the Udhaar book is never touched

    from apps.reports.selectors.dashboard import money_received_today, period_figures

    today = tenant_today(tenant)
    assert money_received_today(tenant=tenant, today=today) == {"amount": "0.00", "count": 0}
    assert period_figures(tenant=tenant, today=today)["today"]["received"]["amount"] == "0.00"
    listing = owner.get("/api/v1/payments").json()["meta"]["totals"]
    assert listing["amount_in"] == listing["amount_out"] == "0.00"


def test_the_amount_is_capped_by_the_smaller_balance(owner, ramesh):
    response = settle(owner, ramesh, "600.01")
    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "settlement_over_balance"
    assert error["details"]["max_amount"] == "600.00"
    assert ShopSettlement.objects.count() == Payment.objects.count() == 0


@pytest.mark.parametrize("amount", ["0", "-5", "abc", "1.005"])
def test_zero_negative_and_nonsense_amounts_are_refused(owner, ramesh, amount):
    assert settle(owner, ramesh, amount).status_code == 400
    assert ShopSettlement.objects.count() == 0


def test_a_partial_settlement_leaves_the_rest_and_can_be_followed_by_another(owner, ramesh):
    assert settle(owner, ramesh, "250.00").status_code == 201
    middle = figures(owner, ramesh)
    assert (middle["customer_balance"], middle["supplier_balance"]) == ("750.00", "350.00")
    assert settle(owner, ramesh, "350.00").status_code == 201
    end = figures(owner, ramesh)
    assert (end["customer_balance"], end["supplier_balance"]) == ("400.00", "0.00")
    assert len(end["settlements"]) == 2


def test_nothing_to_settle_when_one_side_is_zero(tenant, owner):
    party = PartyFactory(tenant=tenant, is_customer=True, is_supplier=True)
    invoice(tenant, party, "500.00", "INV-9")
    response = settle(owner, party, "1.00")
    assert response.status_code == 409
    assert "nothing to settle" in response.json()["error"]["message"]


def test_credit_notes_and_advances_count_as_their_own_role_only(tenant, owner, ramesh):
    """A ₹200 credit note brings what Ramesh owes to ₹800; what is owed to him is unchanged."""
    SalesDocument.objects.create(
        tenant=tenant,
        party=ramesh,
        kind="credit_note",
        status="issued",
        number="CN-1",
        fy_label="26-27",
        document_date=tenant_today(tenant),
        place_of_supply_state="27",
        grand_total=Decimal("200.00"),
        amount_due=Decimal("200.00"),
    )
    data = figures(owner, ramesh)
    assert (data["customer_balance"], data["supplier_balance"]) == ("800.00", "600.00")
    assert settle(owner, ramesh, "600.00").status_code == 201
    data = figures(owner, ramesh)
    assert (data["customer_balance"], data["supplier_balance"]) == ("200.00", "0.00")


def test_a_contact_with_one_role_or_archived_is_refused(tenant, owner, ramesh):
    customer_only = PartyFactory(tenant=tenant, is_customer=True, is_supplier=False)
    invoice(tenant, customer_only, "100.00", "INV-7")
    response = settle(owner, customer_only, "50.00")
    assert response.json()["error"]["code"] == "settlement_not_dual_role"

    Party.objects.filter(pk=ramesh.pk).update(status="archived")
    response = settle(owner, ramesh, "100.00")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "party_archived"


def test_balances_that_changed_since_the_merchant_looked_are_refused(tenant, owner, ramesh):
    invoice(tenant, ramesh, "50.00", "INV-3")  # another device billed him meanwhile
    response = settle(
        owner,
        ramesh,
        "600.00",
        expected={"customer_balance": "1000.00", "supplier_balance": "600.00"},
    )
    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "settlement_balances_changed"
    assert error["details"]["customer_balance"] == "1050.00"
    assert ShopSettlement.objects.count() == 0


def test_a_retry_with_the_same_key_settles_once(owner, ramesh):
    key = str(uuid.uuid4())
    body = {"party_id": str(ramesh.id), "amount": "600.00"}
    first = _post(owner, URL, body, key)
    second = _post(owner, URL, body, key)
    assert first.status_code == 201
    assert second.json()["data"]["id"] == first.json()["data"]["id"]
    assert ShopSettlement.objects.count() == 1
    assert Payment.objects.count() == 2


@pytest.mark.django_db(transaction=True)
def test_two_devices_at_once_cannot_settle_more_than_there_was(tenant, api_as, ramesh):
    """Both ask for ₹600 of a ₹600 supplier balance: one wins, one is told the new figure."""
    results: list[int] = []

    def run() -> None:
        try:
            client, _ = api_as(tenant)
            results.append(settle(client, ramesh, "600.00").status_code)
        finally:
            connection.close()

    threads = [threading.Thread(target=run) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert sorted(results) == [201, 409]
    assert ShopSettlement.objects.count() == 1
    assert PurchaseDocument.objects.get(party=ramesh).amount_due == Decimal("0.00")


def test_voiding_either_half_undoes_both_and_reopens_the_bills(tenant, owner, ramesh):
    created = settle(owner, ramesh, "600.00").json()["data"]
    out_id = created["out_payment"]["id"]
    detail = owner.get(f"/api/v1/payments/{out_id}").json()["data"]
    assert detail["settlement_pair"]["partner"]["number"] == created["in_payment"]["number"]

    response = _post(owner, f"/api/v1/payments/{out_id}/void", {"reason": "Wrong amount"})
    assert response.status_code == 200, response.json()
    assert set(Payment.objects.values_list("status", flat=True)) == {"void"}
    settlement = ShopSettlement.objects.get()
    assert settlement.voided_at is not None and settlement.void_reason == "Wrong amount"
    data = figures(owner, ramesh)
    assert (data["customer_balance"], data["supplier_balance"]) == ("1000.00", "600.00")
    assert data["settlements"][0]["voided_at"] is not None
    dues = sorted(SalesDocument.objects.filter(party=ramesh).values_list("amount_due", flat=True))
    assert dues == [Decimal("300.00"), Decimal("700.00")]
    assert PurchaseDocument.objects.get(party=ramesh).amount_due == Decimal("600.00")
    # Nothing was deleted: the settlement and both payments stay as history.
    assert ShopSettlement.objects.count() == 1 and Payment.objects.count() == 2


def test_staff_may_settle_but_not_undo(tenant, api_as, ramesh):
    staff, _ = api_as(tenant, role="staff")
    created = settle(staff, ramesh, "100.00")
    assert created.status_code == 201
    in_id = created.json()["data"]["in_payment"]["id"]
    assert _post(staff, f"/api/v1/payments/{in_id}/void", {"reason": "x" * 5}).status_code == 403


def test_a_reader_sees_but_cannot_settle(tenant, api_as, ramesh):
    accountant, _ = api_as(tenant, role="accountant")
    assert accountant.get(URL, {"party_id": str(ramesh.id)}).status_code == 200
    assert settle(accountant, ramesh, "100.00").status_code == 403


def test_a_member_without_contacts_or_payments_sees_nothing(tenant, api_as, ramesh):
    client, member = api_as(tenant, role="staff")
    member.permissions_override = {"deny": ["parties.party.read"]}
    member.save(update_fields=["permissions_override"])
    assert client.get(URL, {"party_id": str(ramesh.id)}).status_code == 403
    assert client.get(f"{URL}/candidates").status_code == 403
    assert settle(client, ramesh, "100.00").status_code == 403
    assert ShopSettlement.objects.count() == 0


def test_another_business_cannot_see_or_settle_this_contact(other_tenant, api_as, ramesh):
    stranger, _ = api_as(other_tenant)
    assert stranger.get(URL, {"party_id": str(ramesh.id)}).status_code == 404
    assert settle(stranger, ramesh, "100.00").status_code == 404
    assert stranger.get(f"{URL}/candidates").json()["data"]["results"] == []


def test_home_lists_people_who_could_be_settled_largest_first(tenant, owner, ramesh):
    small = PartyFactory(tenant=tenant, name="Anil Kirana", is_customer=True, is_supplier=True)
    invoice(tenant, small, "80.00", "INV-20")
    bill(tenant, small, "50.00", "PB-20")
    one_side = PartyFactory(tenant=tenant, is_customer=True, is_supplier=True)
    invoice(tenant, one_side, "80.00", "INV-21")
    data = owner.get(f"{URL}/candidates").json()["data"]
    assert data["count"] == 2
    assert [row["name"] for row in data["results"]] == ["Ramesh Traders", "Anil Kirana"]
    assert data["results"][0] == {
        "party_id": str(ramesh.id),
        "name": "Ramesh Traders",
        "customer_balance": "1000.00",
        "supplier_balance": "600.00",
        "max_amount": "600.00",
    }
    settle(owner, ramesh, "600.00")
    assert owner.get(f"{URL}/candidates").json()["data"]["count"] == 1


def test_it_is_audited_with_what_the_merchant_saw_and_what_it_became(owner, ramesh):
    from apps.platform_app.models import AuditLog

    created = settle(owner, ramesh, "600.00").json()["data"]
    row = AuditLog.objects.get(action=AuditAction.SHOP_SETTLEMENT_RECORDED)
    assert row.entity_id == uuid.UUID(created["id"])
    assert row.before == {"customer_balance": "1000.00", "supplier_balance": "600.00"}
    assert row.after == {"customer_balance": "400.00", "supplier_balance": "0.00"}
    assert row.metadata["in_payment"]["number"] == created["in_payment"]["number"]


def test_the_message_names_both_balances_and_only_the_business(tenant, owner, ramesh):
    created = settle(owner, ramesh, "600.00").json()["data"]
    text = _post(owner, f"{URL}/{created['id']}/share", {"locale": "en"}).json()["data"]["text"]
    assert "Rs 600" in text and "No cash changed hands" in text
    assert "You still owe us: Rs 400" in text and "Nothing due to you now" in text
    assert "YourKhata" not in text and "yourkhata" not in text.lower()
    assert text.splitlines()[-1] == f"— {tenant.name}"
    # The receipt of either half says the same thing, not "Received by adjustment".
    receipt = _post(owner, f"/api/v1/payments/{created['in_payment']['id']}/share", {})
    assert receipt.json()["data"]["text"] == text or "No cash" in receipt.json()["data"]["text"]
