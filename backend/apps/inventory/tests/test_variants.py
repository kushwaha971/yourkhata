"""D P2 — a garment in sizes and colours: each is its own item and stock."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from django.urls import reverse

from apps.common.constants import RoleCode
from apps.inventory.models import Item, Product
from apps.inventory.tests.conftest import unit

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner(api_as: Any, tenant: Any, main: Any, reference: Any) -> Any:
    return api_as(tenant, RoleCode.OWNER.value)[0]


def shirt(client: Any, **extra: Any) -> Any:
    body = {
        "name": "Cotton shirt",
        "unit_id": str(unit("PCS").id),
        "selling_price": "599",
        "tax_code": "GST5",
        "variants": {"sizes": ["S", "M", "L", "XL"], "colours": ["Blue", "White"]},
        **extra,
    }
    return client.post(reverse("v1:item-list"), body, format="json", HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()))


def test_four_sizes_in_two_colours_make_eight_items(owner: Any) -> None:
    """D3 "This makes 8 items": one product, eight items with their own SKU."""
    response = shirt(owner)
    assert response.status_code == 201, response.json()
    assert response.json()["meta"]["variants"] == 8
    product = Product.objects.get()
    items = list(Item.objects.filter(product=product).order_by("name"))
    assert len(items) == 8 and len({i.sku for i in items}) == 8
    assert "Cotton shirt · Blue · M" in [i.name for i in items]
    assert product.attributes == {"size": ["S", "M", "L", "XL"], "colour": ["Blue", "White"]}


def test_the_bill_picker_lists_one_garments_sizes(owner: Any) -> None:
    shirt(owner)
    product = Product.objects.get()
    rows = owner.get(reverse("v1:item-list") + f"?product_id={product.id}&page_size=50").json()["data"]
    assert len(rows) == 8
    assert {tuple(sorted(r["attributes"].items())) for r in rows} >= {(("colour", "Blue"), ("size", "M"))}
    assert rows[0]["product"] == {"id": str(product.id), "name": "Cotton shirt"}


def test_a_shared_barcode_or_opening_stock_is_refused(owner: Any) -> None:
    """A barcode or opening stock names no single size; refused, nothing made."""
    refused = shirt(owner, barcode="8901725133917")
    assert refused.status_code == 400 and "barcode" in refused.json()["error"]["details"]
    assert not Product.objects.exists() and not Item.objects.exists()


def test_home_strip_counts_sold_out_sizes(owner: Any) -> None:
    """D12 — a clothes shop's Home strip: sizes with nothing in stock."""
    shirt(owner)
    tiles = owner.get(reverse("v1:stock-home-strip")).json()["data"]
    assert {"key": "soldOutSizes", "count": 8} in tiles
