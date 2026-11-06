"""G4 — a medical store's short book, same-salt substitutes and drug schedule (dShortBook, pSubst)."""

from __future__ import annotations

from typing import Any

import pytest
from django.urls import reverse

from apps.common.constants import RoleCode

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner(api_as: Any, tenant: Any, main: Any, reference: Any) -> Any:
    return api_as(tenant, RoleCode.OWNER.value)[0]


@pytest.fixture
def medical(tenant: Any) -> Any:
    from apps.platform_app.models import TenantSetting

    TenantSetting.objects.update_or_create(
        tenant=tenant, key="shop.features.batches", defaults={"value": {"value": True}}
    )
    return tenant


def book(client: Any) -> Any:
    return client.get(reverse("v1:short-book"))


def ask(client: Any, item: Any, **body: Any) -> Any:
    return client.post(reverse("v1:short-book"), {"item_id": str(item.id), **body}, format="json")


def test_a_kirana_has_no_short_book(owner: Any) -> None:
    """The book belongs to a medical store; another kind is told so, not shown an empty one."""
    assert book(owner).status_code == 404


def test_asking_twice_counts_two_asks_on_one_row(owner: Any, medical: Any, make_item: Any) -> None:
    """A busy counter writes the same missing medicine twice: one row, "Asked · 2 times"."""
    crocin = make_item("Crocin 650")
    assert ask(owner, crocin).status_code == 201
    assert ask(owner, crocin).status_code == 200
    rows = book(owner).json()["data"]
    assert [(r["item"]["name"], r["reason"], r["asked_count"]) for r in rows] == [("Crocin 650", "asked", 2)]
    # The screen shows what an order would carry, never a blank that becomes 1.
    assert rows[0]["qty"] == "1.000"
    assert book(owner).json()["meta"]["counts"]["asked_today"] == 1


def test_only_items_below_their_own_reorder_level_join_by_stock(
    owner: Any, medical: Any, make_item: Any
) -> None:
    """An item with no reorder level is not listed for being out: a catalogue of
    never-stocked items would bury the book."""
    make_item("Azithral 500", reorder_point="10", opening=("2", "80"))
    make_item("Never stocked syrup")
    rows = book(owner).json()["data"]
    assert [(r["item"]["name"], r["reason"], r["on_hand"]) for r in rows] == [
        ("Azithral 500", "low", "2.000")
    ]
    assert rows[0]["qty"] is not None


def test_ordering_closes_the_rows_and_a_new_ask_opens_a_fresh_one(
    owner: Any, medical: Any, make_item: Any
) -> None:
    crocin = make_item("Crocin 650")
    ask(owner, crocin)
    closed = owner.post(reverse("v1:short-book-ordered"), {"item_ids": [str(crocin.id)]}, format="json")
    assert closed.json()["data"]["closed"] == 1
    assert book(owner).json()["data"] == []
    assert ask(owner, crocin).status_code == 201


def test_substitutes_share_the_salt_and_list_stock_first_then_cheapest(
    owner: Any, medical: Any, make_item: Any
) -> None:
    """pSubst — "Same salt: Paracetamol 650 mg. Sorted by stock, then price." Spacing
    and capitals in the typed salt do not split one salt into two."""
    crocin = make_item("Crocin 650", salt="Paracetamol 650 mg")
    make_item("Dolo 650", salt="paracetamol  650 MG", selling_price="32", opening=("40", "20"))
    make_item("Calpol 650", salt="Paracetamol 650 mg", selling_price="30", opening=("12", "20"))
    make_item("Pacimol 650", salt="Paracetamol 650 mg", selling_price="28")
    make_item("Azithral 500", salt="Azithromycin 500 mg", opening=("5", "80"))
    rows = owner.get(reverse("v1:item-substitutes", args=[crocin.id])).json()["data"]
    assert [(r["item"]["name"], r["in_stock"]) for r in rows] == [
        ("Dolo 650", True),
        ("Calpol 650", True),
        ("Pacimol 650", False),
    ]


def test_a_schedule_is_none_h_h1_or_x(owner: Any, medical: Any) -> None:
    from apps.inventory.tests.conftest import unit

    body = {"name": "Azithral 500", "unit_id": str(unit("NOS").id), "schedule": "h", "salt": "Azithromycin 500 mg"}
    made = owner.post(reverse("v1:item-list"), body, format="json")
    assert made.status_code == 201, made.json()
    item = made.json()["data"]["item"] if "item" in made.json()["data"] else made.json()["data"]
    assert (item["schedule"], item["salt"]) == ("H", "Azithromycin 500 mg")
    body["schedule"] = "Y"
    body["name"] = "Bad"
    refused = owner.post(reverse("v1:item-list"), body, format="json")
    assert refused.status_code == 400
    assert "schedule" in str(refused.json())
