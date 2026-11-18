"""G10 — a café's open orders (tokens, tables) and advance orders, and the bill that settles them."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.urls import reverse

from apps.payments.models import Payment

pytestmark = pytest.mark.django_db
URL = "v1:cafe-orders"


@pytest.fixture
def cafe(shop: Any) -> Any:
    from apps.platform_app.models import TenantSetting

    TenantSetting.objects.update_or_create(
        tenant=shop, key="shop.features.cafe_orders", defaults={"value": {"value": True}}
    )
    return shop


def _detail(order: dict) -> str:
    return reverse("v1:cafe-order-detail", args=[order["id"]])


def test_a_shop_that_keeps_no_open_orders_has_none(owner: Any) -> None:
    assert owner.get(reverse(URL)).status_code == 404


def test_tokens_count_from_one_and_lines_take_the_item_price(cafe: Any, owner: Any, make_item: Any) -> None:
    """Design "Token 12 · Cold coffee × 2, sandwich · ₹350": the rate is the
    item's unless typed, and the total is what the lines add up to."""
    coffee = make_item("Cold coffee", "120.00", "GST5", stock=None, track_stock=False)
    sandwich = make_item("Sandwich", "110.00", "GST5", stock=None, track_stock=False)
    body = {"kind": "token", "lines": [{"item_id": str(coffee.id), "qty": "2"}, {"item_id": str(sandwich.id), "qty": "1"}]}
    first = owner.post(reverse(URL), {**body, "client_key": str(uuid.uuid4())}, format="json")
    assert first.status_code == 201, first.json()
    order = first.json()["data"]
    assert (order["number"], order["total"], order["status"]) == ("1", "350.00", "preparing")
    second = owner.post(reverse(URL), {**body, "client_key": str(uuid.uuid4())}, format="json").json()["data"]
    assert second["number"] == "2"
    listed = owner.get(reverse(URL)).json()
    assert [r["number"] for r in listed["data"]] == ["1", "2"] and listed["meta"]["counts"]["open"] == 2


def test_a_table_cannot_be_opened_twice_and_items_are_added(cafe: Any, owner: Any, make_item: Any) -> None:
    pav = make_item("Pav bhaji", "120.00", "GST5", stock=None, track_stock=False)
    lassi = make_item("Lassi", "70.00", "GST5", stock=None, track_stock=False)
    body = {"kind": "table", "table": "2", "lines": [{"item_id": str(pav.id), "qty": "2"}]}
    order = owner.post(reverse(URL), {**body, "client_key": str(uuid.uuid4())}, format="json").json()["data"]
    again = owner.post(reverse(URL), {**body, "client_key": str(uuid.uuid4())}, format="json")
    assert again.status_code == 400 and "table" in again.json()["error"]["details"]
    added = owner.patch(
        _detail(order),
        {"lines": [*order["lines"], {"item_id": str(lassi.id), "qty": "1"}], "status": "served"},
        format="json",
    ).json()["data"]
    assert (added["total"], added["status"], len(added["lines"])) == ("310.00", "served", 3 - 1)


def test_an_advance_order_needs_a_customer_and_holds_the_advance(
    cafe: Any, owner: Any, make_party: Any, make_item: Any
) -> None:
    """Design pAdvance: 20 boxes at ₹720 and a ₹700 cake, ₹5,000 advance, ₹10,100 on delivery."""
    box = make_item("Mixed sweets box 1 kg", "720.00", "GST5", stock="50")
    cake = make_item("Black forest cake 1 kg", "700.00", "GST5", stock=None, track_stock=False)
    lines = [{"item_id": str(box.id), "qty": "20"}, {"item_id": str(cake.id), "qty": "1", "note": "Write: Happy Diwali"}]
    body = {"kind": "advance", "lines": lines, "ready_at": "2099-10-31T11:00", "advance": "5000", "fulfil": "pickup"}
    refused = owner.post(reverse(URL), {**body, "client_key": str(uuid.uuid4())}, format="json")
    assert refused.status_code == 400 and "party_id" in refused.json()["error"]["details"]
    too_much = owner.post(
        reverse(URL), {**body, "advance": "99999", "party_id": str(make_party().id), "client_key": str(uuid.uuid4())}, format="json"
    )
    assert too_much.status_code == 400 and "advance" in too_much.json()["error"]["details"]

    party = make_party(name="Sunita Yadav")
    key = str(uuid.uuid4())
    made = owner.post(reverse(URL), {**body, "party_id": str(party.id), "client_key": key}, format="json")
    again = owner.post(reverse(URL), {**body, "party_id": str(party.id), "client_key": key}, format="json")
    assert (made.status_code, again.status_code) == (201, 200)
    order = made.json()["data"]
    assert (order["number"], order["total"], order["balance"]) == ("ADV-0001", "15100.00", "10100.00")
    assert order["lines"][1]["note"] == "Write: Happy Diwali"
    payments = Payment.objects.filter(meta__cafe_order_number="ADV-0001")
    assert payments.count() == 1 and payments.get().amount == Decimal("5000.00")
    party.refresh_from_db()
    assert party.shop_balance == Decimal("-5000.00")
    listed = owner.get(reverse(URL), {"scope": "advance"}).json()
    assert [r["number"] for r in listed["data"]] == ["ADV-0001"] and listed["meta"]["counts"]["advance"] == 1


def test_cancelling_frees_the_advance(cafe: Any, owner: Any, make_party: Any, make_item: Any) -> None:
    from apps.payments.selectors.payments import open_advances

    party = make_party()
    box = make_item("Box", "720.00", "GST5", stock="5")
    order = owner.post(
        reverse(URL),
        {"kind": "advance", "party_id": str(party.id), "lines": [{"item_id": str(box.id), "qty": "2"}],
         "ready_at": "2099-10-31T11:00", "advance": "500", "client_key": str(uuid.uuid4())},
        format="json",
    ).json()["data"]
    assert not open_advances(tenant=cafe, party_id=party.id).exists()
    assert owner.patch(_detail(order), {"status": "billed"}, format="json").status_code == 409  # only a bill
    assert owner.patch(_detail(order), {"lines": [{"item_id": str(box.id), "qty": "0.5"}]}, format="json").status_code == 400
    assert owner.patch(_detail(order), {"status": "cancelled"}, format="json").status_code == 200
    assert open_advances(tenant=cafe, party_id=party.id).count() == 1


def test_a_bill_settles_the_advance_order_and_applies_its_advance(
    cafe: Any, owner: Any, make_party: Any, make_item: Any
) -> None:
    """₹1,440 of boxes, ₹500 advance: the bill applies it, ₹940 is due, and the order names its bill."""
    from apps.inventory.models import ItemStock
    from apps.sales.tests.conftest import draft, issue, line

    party = make_party()
    box = make_item("Box", "720.00", "GST0", stock="10")
    order = owner.post(
        reverse(URL),
        {"kind": "advance", "party_id": str(party.id), "lines": [{"item_id": str(box.id), "qty": "2"}],
         "ready_at": "2099-10-31T11:00", "advance": "500", "client_key": str(uuid.uuid4())},
        format="json",
    ).json()["data"]
    made = draft(owner, party_id=str(party.id), lines=[line(box, "2")], cafe_order_id=order["id"]).json()["data"]
    assert made["cafe_order"]["number"] == "ADV-0001"
    done = issue(owner, made["id"], version=made["version"])
    assert done.status_code == 200, done.content
    data = done.json()["data"]
    assert (Decimal(data["amount_paid"]), Decimal(data["amount_due"])) == (Decimal("500.00"), Decimal("940.00"))
    after = owner.get(_detail(order)).json()["data"]
    assert (after["status"], after["invoice_id"]) == ("billed", made["id"])
    assert sum(s.on_hand for s in ItemStock.objects.filter(item_id=box.id)) == Decimal("8")
    assert owner.get(reverse(URL), {"scope": "advance"}).json()["data"] == []


def test_a_token_is_settled_by_a_quick_sale(cafe: Any, owner: Any, make_item: Any) -> None:
    from apps.sales.tests.conftest import cash, draft, issue, line

    tea = make_item("Masala tea", "20.00", "GST0", stock=None, track_stock=False)
    order = owner.post(
        reverse(URL), {"kind": "token", "lines": [{"item_id": str(tea.id), "qty": "4"}], "client_key": str(uuid.uuid4())}, format="json"
    ).json()["data"]
    made = draft(owner, lines=[line(tea, "4")], cafe_order_id=order["id"]).json()["data"]
    done = issue(owner, made["id"], version=made["version"], payment=cash("80.00"))
    assert done.status_code == 200, done.content
    assert owner.get(_detail(order)).json()["data"]["status"] == "billed"
    again = draft(owner, lines=[line(tea, "1")], cafe_order_id=order["id"])
    assert again.status_code == 400


def test_home_shows_an_advance_order_the_day_before(cafe: Any, owner: Any, make_party: Any, make_item: Any) -> None:
    """Design pAdvance: "Shows on Home the day before". Nothing due, no block at all."""
    import datetime as dt

    from apps.common.dates import tenant_today

    dashboard = reverse("v1:report-dashboard")
    keys = lambda: [s["key"] for s in owner.get(dashboard).json()["data"]["sections"]]  # noqa: E731
    assert "sales.advance_orders" not in keys()
    box = make_item("Box", "720.00", "GST5", stock="5")
    day = tenant_today(cafe)
    for days, key in ((1, uuid.uuid4()), (5, uuid.uuid4())):
        owner.post(
            reverse(URL),
            {"kind": "advance", "party_id": str(make_party().id), "lines": [{"item_id": str(box.id), "qty": "1"}],
             "ready_at": f"{(day + dt.timedelta(days=days)).isoformat()}T11:00", "client_key": str(key)},
            format="json",
        )
    section = next(s for s in owner.get(dashboard).json()["data"]["sections"] if s["key"] == "sales.advance_orders")
    assert [o["number"] for o in section["data"]["orders"]] == ["ADV-0001"]
