"""D P1b — an auto part known by several numbers, its rack and the vehicles it fits."""

from __future__ import annotations

from typing import Any

import pytest
from django.urls import reverse

from apps.common.constants import RoleCode
from apps.common.exceptions import ValidationFailed

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner(api_as: Any, tenant: Any, main: Any, reference: Any) -> Any:
    return api_as(tenant, RoleCode.OWNER.value)[0]


@pytest.fixture
def brake(make_item: Any) -> Any:
    return make_item(
        "Brake shoe Splendor",
        opening=("5", "200"),
        part_numbers=["06430-kte-305", " BS-SPL-01 ", "06430-KTE-305"],
        rack="B-4",
        fits_vehicle="Splendor, Passion Pro",
    )


def test_the_item_carries_its_numbers_rack_and_vehicles(owner: Any, brake: Any) -> None:
    """Codes are stored upper-case, trimmed, once each; rack and vehicles as typed."""
    data = owner.get(reverse("v1:item-detail", args=[brake.id])).json()["data"]
    assert data["part_numbers"] == ["06430-KTE-305", "BS-SPL-01"]
    assert (data["rack"], data["fits_vehicle"]) == ("B-4", "Splendor, Passion Pro")


def test_search_finds_the_part_by_any_number(owner: Any, brake: Any) -> None:
    """D1 — "Search finds an item by any of its part numbers" (prefix, any case)."""
    rows = owner.get(reverse("v1:item-list") + "?q=06430-kte").json()["data"]
    assert [row["id"] for row in rows] == [str(brake.id)]
    assert rows[0]["match_field"] == "part"


def test_the_scanner_finds_the_part_by_an_exact_number(owner: Any, brake: Any) -> None:
    data = owner.get(reverse("v1:item-lookup") + "?barcode=BS-SPL-01").json()["data"]
    assert data["id"] == str(brake.id) and data["match_field"] == "part"


def test_one_number_names_one_part(brake: Any, make_item: Any) -> None:
    """Two parts sharing a number would make the scanner pick one at random."""
    with pytest.raises(ValidationFailed) as refused:
        make_item("Brake shoe Passion", part_numbers=["bs-spl-01"])
    assert "part_numbers.0" in refused.value.details
