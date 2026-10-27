"""A6 — the Shop's own old balance (owner, 28 Oct 2026; DEC-019).

A merchant moving to the app types what a customer still has to pay, or what is
still to be paid to a supplier, on the Shop's Add customer / Add supplier form.
Before this the only opening the server knew was the Udhaar book's: every
opening posted to `bucket=main`, so a Shop figure would have appeared in the
Udhaar book and nowhere in the Shop — the mixing DEC-019 ended. These tests pin
the four rules that keep the two books apart.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

import pytest
from django.urls import reverse

from apps.ledger.constants import EntryStatus, EntryType
from apps.ledger.models import LedgerEntry
from apps.parties.models import Party

pytestmark = pytest.mark.django_db

LIST = "v1:party-list"
DETAIL = "v1:party-detail"
ENTRY = "v1:ledger-entry-detail"


def _create(client: Any, **fields: Any) -> Any:
    body = {"name": "Gupta Kirana", "is_customer": True, **fields}
    return client.post(reverse(LIST), body, format="json")


def _shop(client: Any, party_id: str) -> dict:
    response = client.get(f"{reverse(DETAIL, args=[party_id])}?book=shop")
    assert response.status_code == 200, response.json()
    return response.json()["data"]["shop"]


def test_a_shop_opening_is_shop_money_and_never_udhaar_money(tenant: Any, api_as: Any) -> None:
    """The defect it prevents: an opening typed on the Shop form posted to the
    Udhaar book (`bucket=main`), moving `balance` and not the Shop's figure."""
    client, _ = api_as(tenant)
    response = _create(
        client,
        opening_balance_amount="1500.00",
        opening_balance_direction="debit",
        opening_balance_as_of="2026-10-28",
        opening_book="shop",
    )
    assert response.status_code == 201, response.json()
    party_id = response.json()["data"]["id"]

    entry = LedgerEntry.objects.get(party_id=party_id, entry_type=EntryType.OPENING)
    assert entry.bucket == "shop"
    party = Party.objects.get(id=party_id)
    assert party.balance == Decimal("0.00")  # the Udhaar book did not move
    shop = _shop(client, party_id)
    assert shop["customer_balance"] == "1500.00"
    assert shop["customer_opening"] == "1500.00"
    assert shop["supplier_balance"] == "0.00"


def test_a_supplier_side_opening_is_still_to_pay(tenant: Any, api_as: Any) -> None:
    client, _ = api_as(tenant)
    response = _create(
        client,
        name="Sharma Wholesale",
        is_customer=False,
        is_supplier=True,
        opening_balance_amount="900.00",
        opening_balance_direction="credit",
        opening_balance_as_of="2026-10-28",
        opening_book="shop",
    )
    assert response.status_code == 201, response.json()
    shop = _shop(client, response.json()["data"]["id"])
    assert shop["supplier_balance"] == "900.00"
    assert shop["supplier_opening"] == "900.00"
    assert shop["customer_balance"] == "0.00"


def test_the_udhaar_opening_is_unchanged_without_a_book(tenant: Any, api_as: Any) -> None:
    """No `opening_book` means the Udhaar book, as every client before A6 sends."""
    client, _ = api_as(tenant)
    response = _create(
        client,
        opening_balance_amount="700.00",
        opening_balance_direction="debit",
        opening_balance_as_of="2026-10-28",
    )
    assert response.status_code == 201, response.json()
    party = Party.objects.get(id=response.json()["data"]["id"])
    assert party.balance == Decimal("700.00")
    assert LedgerEntry.objects.get(party=party).bucket == "main"
    assert _shop(client, str(party.id))["customer_balance"] == "0.00"


def test_one_shop_opening_per_side_and_the_udhaar_one_is_separate(tenant: Any, api_as: Any) -> None:
    """The one-opening index was per CONTACT across every book, so a contact with
    an Udhaar opening could never be given a Shop one. It is now one per book,
    and one per side in the Shop, because a Shop contact can be both."""
    from apps.common.context import Ctx
    from apps.common.exceptions import BusinessRuleViolation
    from apps.ledger.services.opening import post_opening_balance

    client, member = api_as(tenant)
    response = _create(
        client,
        is_supplier=True,
        opening_balance_amount="100.00",
        opening_balance_direction="debit",
        opening_balance_as_of="2026-10-28",
    )
    party_id = response.json()["data"]["id"]
    ctx = Ctx(tenant=tenant, actor=member.user)
    post_opening_balance(ctx=ctx, party_id=party_id, amount="200.00", direction="debit", as_of="2026-10-28", bucket="shop")
    post_opening_balance(ctx=ctx, party_id=party_id, amount="300.00", direction="credit", as_of="2026-10-28", bucket="shop")
    with pytest.raises(BusinessRuleViolation) as refused:
        post_opening_balance(ctx=ctx, party_id=party_id, amount="5.00", direction="debit", as_of="2026-10-28", bucket="shop")
    assert refused.value.code == "opening_balance_exists"

    party = Party.objects.get(id=party_id)
    assert party.balance == Decimal("100.00")
    shop = _shop(client, party_id)
    assert (shop["customer_balance"], shop["supplier_balance"]) == ("200.00", "300.00")


def test_undoing_a_shop_opening_stays_in_the_shop(tenant: Any, api_as: Any) -> None:
    """LED-03's correction moved `balance` (the Udhaar book) for every entry and
    wrote the reversal in `main`, so undoing a Shop opening would have taken
    ₹1,500 off the merchant's Udhaar book and left the Shop's figure standing."""
    client, _ = api_as(tenant)
    party_id = _create(
        client,
        opening_balance_amount="1500.00",
        opening_balance_direction="debit",
        opening_balance_as_of="2026-10-28",
        opening_book="shop",
    ).json()["data"]["id"]
    entry = LedgerEntry.objects.get(party_id=party_id, entry_type=EntryType.OPENING)

    response = client.post(
        f"{reverse(ENTRY, args=[entry.id])}/reverse", {"reason": "Typed the wrong amount"}, format="json"
    )
    assert response.status_code in (200, 201), response.json()

    reversal = LedgerEntry.objects.get(reverses=entry)
    assert reversal.bucket == "shop"
    entry.refresh_from_db()
    assert entry.status == EntryStatus.REVERSED
    assert Party.objects.get(id=party_id).balance == Decimal("0.00")
    shop = _shop(client, party_id)
    assert (shop["customer_balance"], shop["customer_opening"]) == ("0.00", "0.00")


def test_a_settlement_nets_bills_not_the_old_balance(tenant: Any, api_as: Any) -> None:
    """An old balance has no bill behind it, so settling against it would be
    refused half-way ("the documents disagree"). The settle cap leaves it out."""
    from apps.payments.services.shop_settlement import settleable

    balances = {
        "customer_balance": Decimal("1500.00"),
        "supplier_balance": Decimal("900.00"),
        "customer_opening": Decimal("1500.00"),
        "supplier_opening": Decimal("0.00"),
    }
    assert settleable(balances) == Decimal("0.00")
    balances["customer_opening"] = Decimal("1000.00")
    assert settleable(balances) == Decimal("500.00")
