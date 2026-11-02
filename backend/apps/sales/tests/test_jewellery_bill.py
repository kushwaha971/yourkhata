"""G2b — a jeweller's bill: a scanned tag priced by its weight at the day's rate."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

import pytest
from django.urls import reverse

from apps.inventory.models import Serial
from apps.sales.tests.conftest import draft, issue, line

pytestmark = pytest.mark.django_db

CHAIN = {
    "tag_no": "GC-1042",
    "purity": "gold_22k",
    "gross_g": "12.900",
    "stone_g": "0.560",
    "net_g": "12.340",
    "making_type": "pct",
    "making_value": "12",
    "wastage_pct": "0",
    "huid": "7K2P9X",
}


@pytest.fixture
def jeweller(shop: Any) -> Any:
    shop.business_type = "jewellery"
    shop.save(update_fields=["business_type"])
    return shop


@pytest.fixture
def chain(jeweller: Any, owner: Any, make_item: Any) -> Any:
    item = make_item("Gold chain 22K", "0", "GST3", stock=None, tracking="serial")
    assert owner.post(reverse("v1:item-tags", args=[item.id]), CHAIN, format="json").status_code == 201
    return item


def _rate(owner: Any, gold_22k: str = "11650") -> None:
    res = owner.put(reverse("v1:metal-rate-today"), {"gold_22k": gold_22k}, format="json")
    assert res.status_code in (200, 201), res.content


def test_the_design_example_prices_to_the_paisa(chain: Any) -> None:
    """D2: 12.340 g × ₹11,650 = ₹1,43,761.00; making 12% = ₹17,251.32; total
    ₹1,61,012.32. Each part is rounded, and the parts add up to the total."""
    from apps.inventory.services.tags import price_piece

    parts = price_piece(
        net_g=Decimal("12.340"), rate=Decimal("11650"), making_type="pct",
        making_value=Decimal("12"), wastage_pct=Decimal("0"), stone_charge=Decimal("0"),
    )
    assert parts == {
        "metal": Decimal("143761.00"), "making": Decimal("17251.32"), "wastage": Decimal("0.00"),
        "stone": Decimal("0.00"), "total": Decimal("161012.32"),
    }
    per_gram = price_piece(
        net_g=Decimal("3.850"), rate=Decimal("11650"), making_type="per_g",
        making_value=Decimal("850"), wastage_pct=Decimal("0"), stone_charge=Decimal("4500"),
    )
    assert per_gram["making"] == Decimal("3272.50") and per_gram["total"] == Decimal("52625.00")


def test_a_scanned_tag_comes_back_priced_at_todays_rate(owner: Any, chain: Any) -> None:
    _rate(owner)
    found = owner.get(reverse("v1:jewel-tag-lookup"), {"tag": "gc-1042"}).json()["data"]
    assert found["item_id"] == str(chain.id)
    assert found["jewel"]["rate"] == "11650.00" and found["jewel"]["total"] == "161012.32"
    assert owner.get(reverse("v1:jewel-tag-lookup"), {"tag": "NOPE"}).status_code == 404


def test_the_bill_prices_the_line_and_keeps_its_rate(owner: Any, chain: Any, make_party: Any) -> None:
    """The client's price is ignored: the server's is the snapshot's total, GST
    3% added on top. A rate changed after the bill does not move it."""
    _rate(owner)
    body = line(chain, "1", serials=["GC-1042"], jewel={}, unit_price="1")
    made = draft(owner, party_id=str(make_party().id), lines=[body]).json()["data"]
    row = made["lines"][0]
    assert Decimal(row["unit_price"]) == Decimal("161012.32")
    assert Decimal(row["taxable_value"]) == Decimal("161012.32")
    assert row["jewel"]["rate"] == "11650.00" and row["jewel"]["huid"] == "7K2P9X"
    assert issue(owner, made["id"], version=made["version"]).status_code == 200
    _rate(owner, "12000")
    again = owner.get(reverse("v1:sales-invoice-detail", args=[made["id"]])).json()["data"]
    assert again["lines"][0]["jewel"]["rate"] == "11650.00"
    assert Serial.objects.get(serial="GC-1042").status == "sold"
    assert owner.get(reverse("v1:jewel-tag-lookup"), {"tag": "GC-1042"}).status_code == 404


def test_the_counter_may_change_the_line_but_never_the_tag(owner: Any, chain: Any, make_party: Any) -> None:
    _rate(owner)
    body = line(chain, "1", serials=["GC-1042"], jewel={"rate": "11000", "making_type": "per_g", "making_value": "800"})
    row = draft(owner, party_id=str(make_party().id), lines=[body]).json()["data"]["lines"][0]
    # 12.340 × 11,000 = 1,35,740.00; 12.340 × 800 = 9,872.00.
    assert Decimal(row["unit_price"]) == Decimal("145612.00")
    tag = owner.get(reverse("v1:item-tags", args=[chain.id])).json()["data"][0]
    assert tag["making_type"] == "pct" and tag["making_value"] == "12.00"


def test_no_rate_today_is_said_under_the_line(owner: Any, chain: Any, make_party: Any) -> None:
    body = line(chain, "1", serials=["GC-1042"], jewel={})
    made = draft(owner, party_id=str(make_party().id), lines=[body])
    assert made.status_code == 400, made.content
    assert made.json()["error"]["details"]["lines.0.jewel.rate"] == ["Set today's rate first."]
