"""G2a — a jeweller's tags: one piece each, with its weights (design D3/D5)."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

import pytest
from django.urls import reverse

from apps.common.constants import RoleCode
from apps.inventory.models import Serial

pytestmark = pytest.mark.django_db

TAG = {
    "tag_no": "gc-1042",
    "purity": "gold_22k",
    "gross_g": "12.900",
    "stone_g": "0.560",
    "net_g": "12.340",
    "making_type": "pct",
    "making_value": "12",
    "wastage_pct": "0",
    "huid": "7k2p9x",
}


@pytest.fixture
def jeweller(tenant: Any) -> Any:
    tenant.business_type = "jewellery"
    tenant.save(update_fields=["business_type"])
    return tenant


@pytest.fixture
def owner(api_as: Any, jeweller: Any, main: Any, reference: Any) -> Any:
    return api_as(jeweller, RoleCode.OWNER.value)[0]


@pytest.fixture
def chain(make_item: Any) -> Any:
    item = make_item("Gold chain 22K")
    item.tracking = "serial"
    item.save(update_fields=["tracking"])
    return item


def _stock(item: Any) -> Decimal:
    from apps.inventory.tests.conftest import stock_of

    return stock_of(item)[0]


def test_a_tag_puts_one_piece_in_stock_and_reads_back(owner: Any, chain: Any) -> None:
    """The tag is stored as typed (upper-cased codes), and stock moves by one."""
    res = owner.post(reverse("v1:item-tags", args=[chain.id]), TAG, format="json")
    assert res.status_code == 201, res.content
    rows = owner.get(reverse("v1:item-tags", args=[chain.id])).json()["data"]
    assert [(r["tag_no"], r["net_g"], r["huid"], r["status"]) for r in rows] == [("GC-1042", "12.340", "7K2P9X", "in_stock")]
    assert _stock(chain) == Decimal("1.000")
    assert owner.get(reverse("v1:jewel-tag-summary")).json()["data"]["in_stock"] == 1


def test_net_is_worked_out_when_left_blank(owner: Any, chain: Any) -> None:
    body = {**TAG, "net_g": ""}
    data = owner.post(reverse("v1:item-tags", args=[chain.id]), body, format="json").json()["data"]
    assert data["net_g"] == "12.340"


@pytest.mark.parametrize(
    "change,field",
    [
        ({"net_g": "12.000"}, "net_g"),
        ({"stone_g": "13"}, "stone_g"),
        ({"huid": "7K2P"}, "huid"),
        ({"purity": "platinum"}, "purity"),
        ({"gross_g": "1.2345"}, "gross_g"),
        ({"making_type": "flat"}, "making_type"),
    ],
)
def test_a_wrong_tag_is_refused_by_name_and_moves_no_stock(owner: Any, chain: Any, change: dict, field: str) -> None:
    res = owner.post(reverse("v1:item-tags", args=[chain.id]), {**TAG, **change}, format="json")
    assert res.status_code == 400
    assert field in res.json()["error"]["details"]
    assert _stock(chain) == Decimal("0")


def test_a_tag_no_is_used_once_in_the_business(owner: Any, chain: Any, make_item: Any) -> None:
    owner.post(reverse("v1:item-tags", args=[chain.id]), TAG, format="json")
    ring = make_item("Ladies ring 22K")
    ring.tracking = "serial"
    ring.save(update_fields=["tracking"])
    res = owner.post(reverse("v1:item-tags", args=[ring.id]), {**TAG, "tag_no": "GC-1042"}, format="json")
    assert res.status_code == 400 and "tag_no" in res.json()["error"]["details"]
    assert Serial.objects.filter(serial="GC-1042").count() == 1


def test_an_item_without_tags_refuses_one(owner: Any, make_item: Any) -> None:
    plain = make_item("Gift box")
    assert owner.post(reverse("v1:item-tags", args=[plain.id]), TAG, format="json").status_code == 400


def test_staff_see_tags_and_cannot_add_one(api_as: Any, jeweller: Any, chain: Any) -> None:
    staff = api_as(jeweller, RoleCode.STAFF.value)[0]
    assert staff.get(reverse("v1:item-tags", args=[chain.id])).status_code == 200
    assert staff.post(reverse("v1:item-tags", args=[chain.id]), TAG, format="json").status_code == 403


def test_another_kind_never_sees_tags(api_as: Any, tenant: Any, main: Any, reference: Any, make_item: Any) -> None:
    tenant.business_type = "kirana"
    tenant.save(update_fields=["business_type"])
    client = api_as(tenant, RoleCode.OWNER.value)[0]
    item = make_item("Sugar")
    assert client.get(reverse("v1:item-tags", args=[item.id])).status_code == 404
    assert client.get(reverse("v1:jewel-tag-summary")).status_code == 404


def test_a_piece_already_in_the_shop_is_held_at_its_metal_value_today(owner: Any, chain: Any, jeweller: Any) -> None:
    """No cost is asked (design D3): 12.340 g of 22K at today's ₹11,650 is held at ₹1,43,761."""
    owner.put(reverse("v1:metal-rate-today"), {"gold_22k": "11650"}, format="json")
    owner.post(reverse("v1:item-tags", args=[chain.id]), TAG, format="json")
    from apps.inventory.models import StockMovement

    move = StockMovement.objects.filter(item=chain).latest("created_at")
    assert move.unit_cost == Decimal("143761.0000")


def _create(client: Any, **fields: Any) -> Any:
    import uuid

    from apps.inventory.tests.conftest import unit

    body = {"name": "Gold chain 22K", "unit_id": str(unit("NOS").id), "tracking": "serial", **fields}
    return client.post(reverse("v1:item-list"), body, format="json", HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()))


def test_the_add_item_form_saves_the_item_and_its_first_tag_together(owner: Any) -> None:
    """Design D3 "Tag details" on Add item: one save, both rows."""
    res = _create(owner, tag=TAG)
    assert res.status_code == 201, res.content
    item_id = res.json()["data"]["id"]
    rows = owner.get(reverse("v1:item-tags", args=[item_id])).json()["data"]
    assert [r["tag_no"] for r in rows] == ["GC-1042"]


def test_a_wrong_first_tag_saves_neither_and_names_the_tag_field(owner: Any) -> None:
    """A refused tag must not leave an item behind with no piece in it."""
    from apps.inventory.models import Item

    res = _create(owner, tag={**TAG, "net_g": "1.000"})
    assert res.status_code == 400
    assert "tag.net_g" in res.json()["error"]["details"]
    assert not Item.objects.filter(name="Gold chain 22K").exists()
