"""D P6 — café add-ons: priced into the line, kept as a snapshot."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

import pytest

from apps.sales.tests.conftest import draft, issue, line

pytestmark = pytest.mark.django_db


def test_two_cold_coffees_with_ice_cream_are_two_times_150(
    owner: Any, make_item: Any, make_party: Any
) -> None:
    """D11 "Add · ₹300": ₹120 + ₹30 ice cream = ₹150 a cup; the line keeps the
    add-on and its price even if the menu changes later; GST on the whole."""
    coffee = make_item(
        "Cold coffee",
        "120.00",
        "GST5",
        stock=None,
        track_stock=False,
        addons=[{"name": "Ice cream", "price": "30"}, {"name": "Less sugar", "price": "0"}],
    )
    made = draft(owner, party_id=str(make_party().id), lines=[line(coffee, "2", addons=[{"name": "ice cream"}])])
    assert made.status_code == 201, made.json()
    doc = made.json()["data"]
    only = doc["lines"][0]
    assert only["unit_price"] == "150.0000"
    assert only["addons"] == [{"name": "Ice cream", "price": "30.00"}]
    assert Decimal(only["taxable_value"]) == Decimal("300.00")
    assert issue(owner, doc["id"], version=doc["version"]).status_code == 200


def test_an_add_on_the_item_does_not_have_is_refused(owner: Any, make_item: Any, make_party: Any) -> None:
    coffee = make_item("Cold coffee", "120.00", "GST5", stock=None, track_stock=False, addons=[{"name": "Ice cream", "price": "30"}])
    made = draft(owner, party_id=str(make_party().id), lines=[line(coffee, "1", addons=[{"name": "Gold leaf"}])])
    assert made.status_code == 400
    assert "lines.0.addons" in made.json()["error"]["details"]
