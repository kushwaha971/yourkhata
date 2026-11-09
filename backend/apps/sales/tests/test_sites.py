"""G7 — a contractor's sites: dues added up from bills, a split payment."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.urls import reverse

from apps.sales.models import SalesDocument
from apps.sales.tests.conftest import draft, issue, line, recalc_clean

pytestmark = pytest.mark.django_db


@pytest.fixture
def hardware(shop: Any) -> Any:
    from apps.platform_app.models import TenantSetting

    TenantSetting.objects.update_or_create(
        tenant=shop, key="shop.features.sites", defaults={"value": {"value": True}}
    )
    return shop


def _site(client: Any, party: Any, name: str) -> dict:
    made = client.post(
        reverse("v1:sites"),
        {"party_id": str(party.id), "name": name, "client_key": str(uuid.uuid4())},
        format="json",
    )
    assert made.status_code == 201, made.content
    return made.json()["data"]


def _bill(client: Any, party: Any, item: Any, **extra: Any) -> dict:
    made = draft(client, party_id=str(party.id), lines=[line(item, "1")], **extra).json()["data"]
    return issue(client, made["id"], version=made["version"]).json()["data"]


def test_a_shop_without_sites_answers_404(owner: Any) -> None:
    """Only a kind that sells to contractors has this."""
    assert owner.get(reverse("v1:sites")).status_code == 404


def test_a_site_adds_up_only_its_own_bills(hardware: Any, owner: Any, make_item: Any, make_party: Any) -> None:
    """Each site keeps its own dues, and they add up to the contractor's total."""
    party = make_party()
    item = make_item("Cement", "1000", stock="50")
    one, two = _site(owner, party, "Patil Bungalow"), _site(owner, party, "Shinde Row House")
    first = _bill(owner, party, item, site_id=one["id"])
    second = _bill(owner, party, item, site_id=two["id"])
    data = owner.get(reverse("v1:sites")).json()["data"]
    by_id = {row["id"]: row for row in data["sites"]}
    assert Decimal(by_id[one["id"]]["due"]) == Decimal(first["amount_due"])
    assert by_id[one["id"]]["bills"] == 1
    assert Decimal(data["to_collect"]) == Decimal(first["amount_due"]) + Decimal(second["amount_due"])
    detail = owner.get(reverse("v1:site-detail", args=[one["id"]])).json()["data"]
    assert [row["id"] for row in detail["bill_rows"]] == [first["id"]]


def test_a_contractor_with_one_site_is_not_asked(hardware: Any, owner: Any, make_item: Any, make_party: Any) -> None:
    """Design: the bill asks only for a contractor with more than one."""
    party = make_party()
    only = _site(owner, party, "Patil Bungalow")
    bill = _bill(owner, party, make_item("Cement", "100", stock="5"))
    assert bill["site"]["id"] == only["id"]


def test_with_several_sites_a_bill_may_wait(hardware: Any, owner: Any, make_item: Any, make_party: Any) -> None:
    """The server never guesses between two sites."""
    party = make_party()
    _site(owner, party, "One")
    _site(owner, party, "Two")
    assert _bill(owner, party, make_item("Cement", "100", stock="5"))["site"] is None


def test_another_contractors_site_is_refused(hardware: Any, owner: Any, make_item: Any, make_party: Any) -> None:
    """A bill cannot land on a site its customer does not own."""
    other = _site(owner, make_party(), "Theirs")
    made = draft(owner, party_id=str(make_party().id), lines=[line(make_item("Cement", "100", stock="5"), "1")], site_id=other["id"])
    assert made.status_code == 400


def test_a_second_site_of_the_same_name_is_refused(hardware: Any, owner: Any, make_party: Any) -> None:
    """Two sites with one name would make their bills unreadable."""
    party = make_party()
    _site(owner, party, "Patil Bungalow")
    again = owner.post(reverse("v1:sites"), {"party_id": str(party.id), "name": "patil  bungalow"}, format="json")
    assert again.status_code == 400


def _pay(client: Any, body: dict, key: str | None = None) -> Any:
    return client.post(reverse("v1:site-payment"), body, format="json", HTTP_IDEMPOTENCY_KEY=key or str(uuid.uuid4()))


def test_one_payment_splits_across_sites(hardware: Any, owner: Any, make_item: Any, make_party: Any) -> None:
    """The money lands on each site's own bills and the ledger still replays clean."""
    party = make_party()
    item = make_item("Cement", "1000", stock="50")
    one, two = _site(owner, party, "One"), _site(owner, party, "Two")
    first = _bill(owner, party, item, site_id=one["id"])
    second = _bill(owner, party, item, site_id=two["id"])
    paid = _pay(owner, {"splits": [{"site_id": one["id"], "amount": first["amount_due"]}, {"site_id": two["id"], "amount": "100"}]})
    assert paid.status_code == 201, paid.content
    assert SalesDocument.objects.get(pk=first["id"]).amount_due == 0
    assert SalesDocument.objects.get(pk=second["id"]).amount_due == Decimal(second["amount_due"]) - 100
    recalc_clean()


def test_paying_more_than_a_site_owes_is_refused_whole(hardware: Any, owner: Any, make_item: Any, make_party: Any) -> None:
    """Nothing is half applied."""
    party = make_party()
    item = make_item("Cement", "1000", stock="50")
    one = _site(owner, party, "One")
    first = _bill(owner, party, item, site_id=one["id"])
    assert _pay(owner, {"splits": [{"site_id": one["id"], "amount": "999999"}]}).status_code == 400
    assert SalesDocument.objects.get(pk=first["id"]).amount_due == Decimal(first["amount_due"])


def test_a_double_tap_is_one_payment(hardware: Any, owner: Any, make_item: Any, make_party: Any) -> None:
    """The same key replays; the bill is not paid twice."""
    party = make_party()
    one = _site(owner, party, "One")
    bill = _bill(owner, party, make_item("Cement", "1000", stock="5"), site_id=one["id"])
    key = str(uuid.uuid4())
    body = {"splits": [{"site_id": one["id"], "amount": "100"}]}
    assert _pay(owner, body, key).status_code == 201
    _pay(owner, body, key)
    assert SalesDocument.objects.get(pk=bill["id"]).amount_due == Decimal(bill["amount_due"]) - 100
