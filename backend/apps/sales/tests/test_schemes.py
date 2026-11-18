"""G9 — schemes on a real bill: a free line, a discount, the claim, and what a hand discount keeps."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.urls import reverse

from apps.sales.tests.conftest import draft, invoice_url, issue, line

pytestmark = pytest.mark.django_db


@pytest.fixture
def wholesale(shop: Any) -> Any:
    from apps.platform_app.models import TenantSetting

    TenantSetting.objects.update_or_create(
        tenant=shop, key="shop.features.schemes", defaults={"value": {"value": True}}
    )
    return shop


def _scheme(client: Any, **data: Any) -> dict:
    made = client.post(
        reverse("v1:schemes"),
        {"client_key": str(uuid.uuid4()), "company": "Parle Products", "valid_till": "2099-12-31", **data},
        format="json",
    )
    assert made.status_code == 201, made.content
    return made.json()["data"]


def test_a_shop_without_schemes_answers_404(owner: Any) -> None:
    assert owner.get(reverse("v1:schemes")).status_code == 404


def test_buy_ten_get_one_adds_a_free_line_that_moves_stock(wholesale: Any, owner: Any, make_item: Any, make_party: Any) -> None:
    """The free case is a ₹0 line, so the stock and the retailer's bill both show it, and the claim is its worth."""
    from apps.inventory.models import Item

    item = make_item("Parle-G case", "620", stock="50")
    _scheme(owner, code="parle oct", rule="free", item_id=str(item.id), buy_qty="10", free_qty="1")
    made = draft(owner, party_id=str(make_party().id), lines=[line(item, "10")]).json()["data"]
    lines = made["lines"]
    assert len(lines) == 2
    free = lines[1]
    assert Decimal(free["unit_price"]) == 0 and Decimal(free["qty"]) == 1
    assert free["scheme_code"] == "PARLEOCT" and free["description"].endswith("· free")
    assert Decimal(free["scheme_claim"]) == Decimal("620.00")
    issued = issue(owner, made["id"], version=made["version"]).json()["data"]
    assert Decimal(issued["grand_total"]) == Decimal(lines[0]["line_total"])
    stock = owner.get(reverse("v1:item-detail", args=[item.id])).json()["data"]
    assert Decimal(stock["on_hand"]) == Decimal("39")
    listed = owner.get(reverse("v1:schemes")).json()["data"]
    assert listed["schemes"][0]["free_given"] == "1"
    assert listed["claims"] == [{"company": "Parle Products", "claim": "620.00"}]
    _ = Item


def test_saving_again_does_not_double_the_free_line(wholesale: Any, owner: Any, make_item: Any, make_party: Any) -> None:
    """A draft saved twice still has one free line, made again from the bill's own lines."""
    item = make_item("Parle-G case", "620", stock="50")
    _scheme(owner, code="P1", rule="free", item_id=str(item.id), buy_qty="10", free_qty="1")
    made = draft(owner, party_id=str(make_party().id), lines=[line(item, "20")]).json()["data"]
    again = owner.patch(
        invoice_url(made["id"]),
        {"version": made["version"], "notes": "again"},
        format="json",
    )
    assert again.status_code == 200, again.content
    lines = again.json()["data"]["lines"]
    assert [Decimal(row["qty"]) for row in lines] == [Decimal("20"), Decimal("2")]


def test_per_case_off_is_a_discount_and_a_hand_discount_wins(wholesale: Any, owner: Any, make_item: Any, make_party: Any) -> None:
    item = make_item("Tata tea case", "500", stock="50")
    _scheme(owner, code="TATA", rule="per_unit", item_id=str(item.id), amount="40", company="Tata Consumer")
    made = draft(owner, party_id=str(make_party().id), lines=[line(item, "3"), {**line(item, "1"), "discount_type": "percent", "discount_value": "5"}]).json()["data"]
    first, second = made["lines"]
    assert first["scheme_code"] == "TATA" and Decimal(first["discount_amount"]) == Decimal("120.00")
    assert Decimal(first["scheme_claim"]) == Decimal("120.00")
    assert second["scheme_code"] is None and second["discount_type"] == "percent"


def test_an_ended_scheme_does_not_apply(wholesale: Any, owner: Any, make_item: Any, make_party: Any) -> None:
    item = make_item("Parle-G case", "620", stock="50")
    scheme = _scheme(owner, code="OLD", rule="free", item_id=str(item.id), buy_qty="1", free_qty="1")
    owner.patch(reverse("v1:scheme-detail", args=[scheme["id"]]), {"active": False}, format="json")
    made = draft(owner, party_id=str(make_party().id), lines=[line(item, "5")]).json()["data"]
    assert len(made["lines"]) == 1


def test_a_scheme_needs_its_numbers(wholesale: Any, owner: Any) -> None:
    bad = owner.post(
        reverse("v1:schemes"),
        {"client_key": str(uuid.uuid4()), "code": "X", "company": "Y", "rule": "free", "valid_till": "2099-01-01"},
        format="json",
    )
    assert bad.status_code == 400
    assert {"item_id", "buy_qty", "free_qty"} <= set(bad.json()["error"]["details"] if "details" in bad.json()["error"] else bad.json()["error"]["fields"])


def test_issuing_keeps_a_scheme_discounted_line(wholesale: Any, owner: Any, make_item: Any, make_party: Any) -> None:
    """Issue re-reads the saved lines; a line the scheme discounted is the merchant's and must stay."""
    item = make_item("Tata tea case", "500", stock="50")
    _scheme(owner, code="TATA", rule="per_unit", item_id=str(item.id), amount="40", company="Tata Consumer")
    made = draft(owner, party_id=str(make_party().id), lines=[line(item, "3")]).json()["data"]
    issued = issue(owner, made["id"], version=made["version"]).json()["data"]
    assert len(issued["lines"]) == 1
    assert Decimal(issued["lines"][0]["discount_amount"]) == Decimal("120.00")
    assert Decimal(issued["lines"][0]["scheme_claim"]) == Decimal("120.00")
