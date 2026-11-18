"""D P1c — moving stock from the godown to the shop (design D10)."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.urls import reverse

from apps.common.constants import RoleCode
from apps.inventory.models import ItemStock, Location, StockMovement
from apps.inventory.services.stock import default_location

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner(api_as: Any, tenant: Any, main: Any, reference: Any) -> Any:
    return api_as(tenant, RoleCode.OWNER.value)[0]


def add_place(client: Any, name: str) -> dict:
    response = client.post(reverse("v1:location-list"), {"name": name}, format="json")
    assert response.status_code == 201, response.json()
    return response.json()["data"]


def move(client: Any, source: str, target: str, lines: list[dict]) -> Any:
    return client.post(
        reverse("v1:stock-transfer-list"),
        {"from_location_id": source, "to_location_id": target, "lines": lines},
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
    )


def held(item: Any, place_id: Any) -> Decimal:
    row = ItemStock.objects.filter(item=item, location_id=place_id).first()
    return row.on_hand if row else Decimal("0.000")


def test_moving_keeps_total_stock_and_value(owner: Any, tenant: Any, make_item: Any) -> None:
    """20 cases from the shop to the godown and 5 back: each place right, the
    total 140 and its value unchanged, each side at the same cost."""
    parle = make_item("Parle-G 50 g", opening=("140", "40"))
    shop = str(default_location(tenant).id)
    godown = add_place(owner, "Godown")["id"]
    first = move(owner, shop, godown, [{"item_id": str(parle.id), "qty": "20"}])
    assert first.status_code == 201, first.json()
    assert first.json()["data"]["number"].startswith("TRF/")
    assert move(owner, godown, shop, [{"item_id": str(parle.id), "qty": "5"}]).status_code == 201
    assert (held(parle, shop), held(parle, godown)) == (Decimal("125.000"), Decimal("15.000"))
    rows = ItemStock.objects.filter(item=parle)
    assert sum(r.on_hand for r in rows) == Decimal("140.000")
    assert sum(r.stock_value for r in rows) == Decimal("5600.00")
    pair = StockMovement.objects.filter(item=parle, movement_type__in=["transfer_out", "transfer_in"])
    assert {m.unit_cost for m in pair} == {Decimal("40.0000")}


def test_more_than_the_godown_holds_is_refused_and_nothing_moves(
    owner: Any, tenant: Any, make_item: Any
) -> None:
    """D10 "Only 9 in Godown": the whole transfer is refused, no line moves."""
    tea = make_item("Tata Tea 250 g", opening=("9", "100"))
    parle = make_item("Parle-G", opening=("50", "40"))
    shop = str(default_location(tenant).id)
    godown = add_place(owner, "Godown")["id"]
    refused = move(owner, shop, godown, [
        {"item_id": str(parle.id), "qty": "20"},
        {"item_id": str(tea.id), "qty": "12"},
    ])
    assert refused.status_code == 409
    short = refused.json()["error"]["details"]["lines"]
    assert [(s["index"], s["available"]) for s in short] == [(1, "9.000")]
    assert not StockMovement.objects.filter(movement_type="transfer_out").exists()


def test_same_place_twice_and_a_second_godown_name_are_refused(owner: Any, tenant: Any, make_item: Any) -> None:
    item = make_item("Soap", opening=("5", "10"))
    shop = str(default_location(tenant).id)
    add_place(owner, "Godown")
    again = owner.post(reverse("v1:location-list"), {"name": "godown"}, format="json")
    assert again.status_code == 400
    same = move(owner, shop, shop, [{"item_id": str(item.id), "qty": "1"}])
    assert same.status_code == 400 and "to_location_id" in same.json()["error"]["details"]


def test_the_move_screen_reads_both_places(owner: Any, tenant: Any, make_item: Any) -> None:
    parle = make_item("Parle-G", opening=("140", "40"))
    shop = str(default_location(tenant).id)
    godown = add_place(owner, "Godown")["id"]
    move(owner, shop, godown, [{"item_id": str(parle.id), "qty": "12"}])
    url = reverse("v1:stock-transfer-stock") + f"?from={godown}&to={shop}"
    rows = owner.get(url).json()["data"]
    assert [(r["name"], r["at_from"], r["at_to"]) for r in rows] == [("Parle-G", "12.000", "128.000")]
    places = owner.get(reverse("v1:location-list")).json()["data"]
    assert [p["name"] for p in places][0] == Location.objects.get(pk=shop).name


def test_staff_cannot_move_stock(api_as: Any, tenant: Any, make_item: Any, main: Any) -> None:
    item = make_item("Soap", opening=("5", "10"))
    staff = api_as(tenant, RoleCode.STAFF.value)[0]
    shop = str(default_location(tenant).id)
    assert move(staff, shop, shop, [{"item_id": str(item.id), "qty": "1"}]).status_code == 403
    assert staff.get(reverse("v1:location-list")).status_code == 200


def test_lists_show_the_whole_business_or_one_godown(owner: Any, tenant: Any, make_item: Any) -> None:
    """Before this, every list read MAIN only: 30 moved to the godown vanished
    from the Items list and the stock value. Without `location_id` they show
    every place summed; with it, one place."""
    parle = make_item("Parle-G", opening=("100", "40"))
    shop = str(default_location(tenant).id)
    godown = add_place(owner, "Godown")["id"]
    move(owner, shop, godown, [{"item_id": str(parle.id), "qty": "30"}])
    row = owner.get(reverse("v1:item-list") + "?q=Parle").json()["data"][0]
    assert (row["on_hand"], row["avg_cost"]) == ("100.000", "40.0000")
    summary = owner.get(reverse("v1:stock-summary")).json()["data"]
    assert [r["on_hand"] for r in summary if r["item"]["name"] == "Parle-G"] == ["100.000"]
    at_godown = owner.get(reverse("v1:item-list") + f"?q=Parle&location_id={godown}").json()["data"][0]
    assert at_godown["on_hand"] == "30.000"
    bad = owner.get(reverse("v1:item-list") + "?location_id=01a18dba-0000-7000-8000-000000000000")
    assert bad.status_code == 400
