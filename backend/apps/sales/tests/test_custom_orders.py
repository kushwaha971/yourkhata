"""G3a — a jeweller's custom orders: the advance, the fixed rate, the statuses."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.urls import reverse

from apps.payments.models import Payment

pytestmark = pytest.mark.django_db
URL = "v1:custom-orders"


@pytest.fixture
def jeweller(shop: Any) -> Any:
    shop.business_type = "jewellery"
    shop.save(update_fields=["business_type"])
    return shop


def _body(party: Any, **extra: Any) -> dict:
    return {
        "party_id": str(party.id),
        "what": "Mangalsutra, 2 lines, black beads",
        "approx_weight_g": "18.0",
        "purity": "gold_22k",
        "deliver_on": "2099-11-07",
        "client_key": str(uuid.uuid4()),
        **extra,
    }


def _rate(owner: Any) -> None:
    assert owner.put(reverse("v1:metal-rate-today"), {"gold_22k": "11650"}, format="json").status_code in (200, 201)


def test_an_order_with_an_advance_fixes_the_rate_and_is_a_real_receipt(jeweller: Any, owner: Any, make_party: Any) -> None:
    _rate(owner)
    res = owner.post(reverse(URL), _body(make_party(), advance="50000", advance_mode="upi", fix_rate=True), format="json")
    assert res.status_code == 201, res.content
    data = res.json()["data"]
    assert data["number"] == "ORD-0001" and data["fixed_rate"] == "11650.00" and data["status"] == "open"
    payment = Payment.objects.get(pk=data["advance_payment_id"])
    assert payment.amount == Decimal("50000.00") and payment.primary_mode == "upi"
    listed = owner.get(reverse(URL)).json()["data"]
    assert listed["open"] == 1 and listed["advance_held"] == "50000.00"


def test_the_advance_is_held_for_the_order_until_it_is_delivered(jeweller: Any, owner: Any, make_party: Any) -> None:
    """Earmarked, no other bill applies it automatically; delivered, it is open to the bill."""
    from apps.payments.selectors.payments import open_advances

    party = make_party()
    data = owner.post(reverse(URL), _body(party, advance="1000"), format="json").json()["data"]
    assert not open_advances(tenant=jeweller, party_id=party.id).exists()
    status = reverse("v1:custom-order-status", args=[data["id"]])
    assert owner.post(status, {"status": "delivered"}, format="json").status_code == 409  # not ready yet
    assert owner.post(status, {"status": "ready"}, format="json").status_code == 200
    assert owner.post(status, {"status": "delivered"}, format="json").status_code == 200
    assert open_advances(tenant=jeweller, party_id=party.id).count() == 1
    assert owner.get(reverse(URL)).json()["data"]["advance_held"] == "0.00"


def test_a_double_tapped_save_is_one_order_and_one_receipt(jeweller: Any, owner: Any, make_party: Any) -> None:
    body = _body(make_party(), advance="1000")
    first = owner.post(reverse(URL), body, format="json")
    second = owner.post(reverse(URL), body, format="json")
    assert first.status_code == 201 and second.status_code == 200
    assert first.json()["data"]["id"] == second.json()["data"]["id"]
    assert Payment.objects.filter(amount=Decimal("1000.00")).count() == 1


def test_refusals_are_said_under_their_fields(jeweller: Any, owner: Any, make_party: Any) -> None:
    res = owner.post(reverse(URL), {"what": "", "purity": "x", "deliver_on": "2000-01-01", "fix_rate": True}, format="json")
    details = res.json()["error"]["details"]
    assert res.status_code == 400 and {"party_id", "what", "purity", "deliver_on", "fix_rate"} <= set(details)


def test_a_shop_that_is_not_a_jeweller_has_no_custom_orders(owner: Any) -> None:
    assert owner.get(reverse(URL)).status_code == 404
