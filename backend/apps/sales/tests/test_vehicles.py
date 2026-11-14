"""G8 — vehicle history read from the bills, and parts that fit."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

import pytest
from django.urls import reverse

from apps.sales.tests.conftest import draft, issue, line

pytestmark = pytest.mark.django_db


@pytest.fixture
def auto(shop: Any) -> Any:
    from apps.platform_app.models import TenantSetting

    TenantSetting.objects.update_or_create(
        tenant=shop, key="shop.features.part_numbers", defaults={"value": {"value": True}}
    )
    return shop


def _bill(client: Any, party: Any, item: Any, **extra: Any) -> dict:
    made = draft(client, party_id=str(party.id), lines=[line(item, "1")], **extra).json()["data"]
    return issue(client, made["id"], version=made["version"]).json()["data"]


def test_a_shop_without_part_numbers_answers_404(owner: Any) -> None:
    """Only an auto parts kind keeps vehicles."""
    assert owner.get(reverse("v1:vehicles")).status_code == 404


def test_a_vehicle_adds_up_only_its_own_bills(auto: Any, owner: Any, make_item: Any, make_party: Any) -> None:
    """Spaces and case in the number are one vehicle; another number stays apart."""
    party = make_party()
    item = make_item("Brake shoe", "320", stock="20")
    one = _bill(owner, party, item, vehicle_number="mh 12 kt 4471", vehicle_model="Hero Splendor+ 2021", mechanic="Raju Garage")
    two = _bill(owner, party, item, vehicle_number="MH12KT4471")
    _bill(owner, party, item, vehicle_number="MH14AB1")
    _bill(owner, party, item)
    data = owner.get(reverse("v1:vehicle-detail", args=["MH12 kt4471"])).json()["data"]
    assert data["bills"] == 2
    assert Decimal(data["spent"]) == Decimal(one["grand_total"]) + Decimal(two["grand_total"])
    assert {row["id"] for row in data["bill_rows"]} == {one["id"], two["id"]}
    assert "Brake shoe" in data["bill_rows"][0]["parts"]
    numbers = [row["number"] for row in owner.get(reverse("v1:vehicles")).json()["data"]["vehicles"]]
    assert sorted(numbers) == ["MH12KT4471", "MH14AB1"]


def test_the_mechanics_dues_are_his_own_account(auto: Any, owner: Any, make_item: Any, make_party: Any) -> None:
    """Shown beside the vehicle, read from the garage's own shop balance."""
    garage = make_party(name="Raju Garage")
    item = make_item("Oil", "500", stock="9")
    _bill(owner, garage, item, vehicle_number="MH01X1", mechanic="raju garage")
    garage.refresh_from_db()
    data = owner.get(reverse("v1:vehicle-detail", args=["MH01X1"])).json()["data"]
    assert data["garage"]["id"] == str(garage.id)
    assert Decimal(data["garage"]["due"]) == garage.shop_balance


def test_an_unknown_number_is_not_found(auto: Any, owner: Any) -> None:
    assert owner.get(reverse("v1:vehicle-detail", args=["XX00"])).status_code == 404


def test_parts_that_fit_match_every_word(auto: Any, owner: Any, make_item: Any) -> None:
    """"splendor brake" finds the item whose fits say Splendor, by name brake."""
    from apps.inventory.models import Item

    fits = make_item("Brake shoe", "320", stock="2")
    Item.objects.filter(pk=fits.pk).update(fits_vehicle="Hero Splendor+ 2019-2024")
    other = make_item("Brake shoe Pulsar", "300", stock="2")
    Item.objects.filter(pk=other.pk).update(fits_vehicle="Bajaj Pulsar 150")
    rows = owner.get(reverse("v1:item-list") + "?fits=hero splendor").json()["data"]
    assert [row["id"] for row in rows] == [str(fits.id)]


def test_the_last_oil_change_is_the_newest_bill_with_engine_oil(
    auto: Any, owner: Any, make_item: Any, make_party: Any
) -> None:
    """Design dVehicle "Last oil change": an oil filter is not an oil change, and a later bill without oil keeps it."""
    party = make_party()
    oil = make_item("Castrol Activ 20W-40 1 L", "380.00", "GST0", stock="10")
    filt = make_item("Oil filter Splendor", "140.00", "GST0", stock="10")
    shoe = make_item("Brake shoe", "320.00", "GST0", stock="10")
    for lines in ([line(filt, "1")], [line(oil, "1"), line(filt, "1")], [line(shoe, "1")]):
        made = draft(owner, party_id=str(party.id), lines=lines, vehicle_number="MH12KT4471").json()["data"]
        assert issue(owner, made["id"], version=made["version"]).status_code == 200
    got = owner.get(reverse("v1:vehicle-detail", args=["MH12KT4471"])).json()["data"]
    assert got["last_oil"]["item"] == "Castrol Activ 20W-40 1 L"


def test_parts_that_fit_a_year(auto: Any, owner: Any, make_item: Any) -> None:
    """Design pVehicle "Make · model / Year": a range holds the year; fits with no year fit any."""
    from apps.inventory.models import Item

    for name, fits in (("Shoe A", "Hero Splendor+ 2019–2024"), ("Shoe B", "Hero Splendor+ 2015"), ("Shoe C", "Hero Splendor+")):
        item = make_item(name, "100.00", "GST0", stock="5")
        Item.objects.filter(pk=item.pk).update(fits_vehicle=fits)
    names = lambda year: sorted(r["name"] for r in owner.get(reverse("v1:item-list"), {"fits": "splendor", "fits_year": year}).json()["data"])  # noqa: E731
    assert names("2021") == ["Shoe A", "Shoe C"]
    assert names("2015") == ["Shoe B", "Shoe C"]
    assert names("") == ["Shoe A", "Shoe B", "Shoe C"]
