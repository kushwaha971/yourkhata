"""G11 — a kirana's phone orders: the list read against the items, to pack, bill, deliver."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.urls import reverse

pytestmark = pytest.mark.django_db
URL = "v1:phone-orders"


@pytest.fixture
def kirana(shop: Any) -> Any:
    from apps.platform_app.models import TenantSetting

    TenantSetting.objects.update_or_create(
        tenant=shop, key="shop.features.phone_orders", defaults={"value": {"value": True}}
    )
    return shop


def _kg_item(make_item: Any, name: str, price: str) -> Any:
    from apps.inventory.models import Unit

    item = make_item(name, price, "GST0", stock="50")
    item.unit = Unit.objects.get(code="KGS", tenant__isnull=True)
    item.save(update_fields=["unit"])
    return item


def test_a_shop_that_keeps_no_phone_orders_has_none(owner: Any) -> None:
    assert owner.get(reverse(URL)).status_code == 404


def test_a_whatsapp_list_is_read_against_the_items(kirana: Any, owner: Any, make_item: Any) -> None:
    """Design: reads "atta 5kg, tel 1 litre" and asks about the ones it can't match.
    Grams become the item's kg; a word that fits two items is asked, never guessed."""
    _kg_item(make_item, "Aashirvaad Atta", "52.00")
    _kg_item(make_item, "Toor Dal", "160.00")
    make_item("Sugar 1 kg pack", "48.00", "GST0", stock="10")
    make_item("Sugar 5 kg pack", "235.00", "GST0", stock="10")
    text = "atta 5kg\ntoor dal 500 g, sugar 2\n- kesar 1 tin"
    read = owner.post(reverse("v1:phone-orders-read-list"), {"text": text}, format="json").json()["data"]
    assert [(m["name"], m["qty"]) for m in read["matched"]] == [("Aashirvaad Atta", "5"), ("Toor Dal", "0.5")]
    assert read["unmatched"] == ["sugar 2", "kesar 1 tin"]


def test_a_number_inside_a_name_is_not_the_quantity(kirana: Any, owner: Any, make_item: Any) -> None:
    """"Surf 5in1 2" is two packs of Surf 5in1, not five (found by the G11 harness on "QA11 atta 5kg")."""
    make_item("Surf 5in1 1 kg", "120.00", "GST0", stock="10")
    read = owner.post(reverse("v1:phone-orders-read-list"), {"text": "surf 5in1 2"}, format="json").json()["data"]
    assert [(m["name"], m["qty"]) for m in read["matched"]] == [("Surf 5in1 1 kg", "2")]


def test_an_order_is_packed_billed_and_delivered(kirana: Any, owner: Any, make_party: Any, make_item: Any) -> None:
    """To pack → the bill (on udhaar) → out for delivery → delivered today."""
    from apps.inventory.models import ItemStock
    from apps.sales.tests.conftest import draft, issue, line

    atta = _kg_item(make_item, "Atta", "52.00")
    party = make_party(name="Sunita Yadav")
    body = {
        "party_id": str(party.id),
        "lines": [{"item_id": str(atta.id), "qty": "5"}],
        "list_text": "atta 5kg",
        "deliver_by": "2099-10-31T18:00",
        "fulfil": "home",
        "pay": "udhaar",
    }
    key = str(uuid.uuid4())
    made = owner.post(reverse(URL), {**body, "client_key": key}, format="json")
    again = owner.post(reverse(URL), {**body, "client_key": key}, format="json")
    assert (made.status_code, again.status_code) == (201, 200)
    order = made.json()["data"]
    assert (order["number"], order["total"], order["status"], order["lines"][0]["unit"]) == ("ORD-0001", "260.00", "to_pack", "KGS")
    assert owner.get(reverse(URL)).json()["meta"]["counts"]["to_pack"] == 1

    bill = draft(owner, party_id=str(party.id), lines=[line(atta, "5")], phone_order_id=order["id"]).json()["data"]
    assert bill["phone_order"]["number"] == "ORD-0001"
    done = issue(owner, bill["id"], version=bill["version"])
    assert done.status_code == 200, done.content
    assert Decimal(done.json()["data"]["amount_due"]) == Decimal("260.00")  # udhaar: on the customer's account
    detail = reverse("v1:phone-order-detail", args=[order["id"]])
    assert owner.get(detail).json()["data"]["status"] == "out"
    assert sum(s.on_hand for s in ItemStock.objects.filter(item_id=atta.id)) == Decimal("45")
    status = reverse("v1:phone-order-status", args=[order["id"]])
    assert owner.post(status, {"status": "delivered"}, format="json").json()["data"]["status"] == "delivered"
    counts = owner.get(reverse(URL)).json()["meta"]["counts"]
    assert (counts["to_pack"], counts["out"], counts["delivered"]) == (0, 0, 1)
    second = draft(owner, party_id=str(party.id), lines=[line(atta, "1")], phone_order_id=order["id"])
    assert second.status_code == 400


def test_a_pick_up_is_delivered_by_its_bill(kirana: Any, owner: Any, make_party: Any, make_item: Any) -> None:
    from apps.sales.tests.conftest import cash, draft, issue, line

    oil = make_item("Oil 1 L", "150.00", "GST0", stock="10")
    party = make_party()
    order = owner.post(
        reverse(URL),
        {"party_id": str(party.id), "lines": [{"item_id": str(oil.id), "qty": "2"}], "fulfil": "pickup", "pay": "cash", "client_key": str(uuid.uuid4())},
        format="json",
    ).json()["data"]
    assert owner.post(reverse("v1:phone-order-status", args=[order["id"]]), {"status": "delivered"}, format="json").status_code == 409
    bill = draft(owner, party_id=str(party.id), lines=[line(oil, "2")], phone_order_id=order["id"]).json()["data"]
    assert issue(owner, bill["id"], version=bill["version"], payment=cash("300.00")).status_code == 200
    assert owner.get(reverse("v1:phone-order-detail", args=[order["id"]])).json()["data"]["status"] == "delivered"


def test_another_customers_bill_cannot_take_the_order(kirana: Any, owner: Any, make_party: Any, make_item: Any) -> None:
    from apps.sales.tests.conftest import draft, issue, line

    oil = make_item("Oil 1 L", "150.00", "GST0", stock="10")
    order = owner.post(
        reverse(URL),
        {"party_id": str(make_party().id), "lines": [{"item_id": str(oil.id), "qty": "1"}], "client_key": str(uuid.uuid4())},
        format="json",
    ).json()["data"]
    bill = draft(owner, party_id=str(make_party(name="Other").id), lines=[line(oil, "1")], phone_order_id=order["id"]).json()["data"]
    assert issue(owner, bill["id"], version=bill["version"]).status_code == 409
