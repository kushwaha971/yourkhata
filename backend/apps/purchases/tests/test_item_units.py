"""D P1a — buying boxes: stock comes in as pieces at the piece cost."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

import pytest

from apps.inventory.models import Item, ItemStock, StockMovement, Unit
from apps.purchases.tests.conftest import line, recorded_bill, void

pytestmark = pytest.mark.django_db


def test_two_boxes_bought_add_forty_pieces_at_the_piece_cost(
    owner: Any, make_item: Any, make_supplier: Any
) -> None:
    """Decision 3 — 2 BOX at ₹400 (GST0) = 40 pieces at ₹20; the last purchase
    cost the item remembers is a piece's, and a void takes the 40 back out."""
    box = Unit.objects.get(tenant__isnull=True, code="BOX")
    item = make_item("Anchor switch", "18.00", "GST0", units=[{"unit_id": str(box.id), "factor": "20"}])
    bill = recorded_bill(
        owner,
        party_id=str(make_supplier().id),
        lines=[line(item, "2", "400.00", unit_code="BOX")],
    )
    assert bill["lines"][0]["unit_factor"] == "20.000"
    move = StockMovement.objects.get(item=item, movement_type="purchase_in")
    assert move.qty == Decimal("40.000") and move.unit_cost == Decimal("20.0000")
    assert ItemStock.objects.get(item=item).on_hand == Decimal("40.000")
    assert Item.objects.get(pk=item.pk).purchase_price == Decimal("20.00")
    assert void(owner, bill["id"]).status_code == 200
    assert ItemStock.objects.get(item=item).on_hand == Decimal("0.000")


def test_a_box_line_defaults_to_twenty_times_the_piece_cost(
    owner: Any, make_item: Any, make_supplier: Any
) -> None:
    from apps.purchases.tests.conftest import draft

    box = Unit.objects.get(tenant__isnull=True, code="BOX")
    item = make_item("Switch plate", "18.00", "GST0", units=[{"unit_id": str(box.id), "factor": "20"}])
    made = draft(owner, party_id=str(make_supplier().id), lines=[line(item, "1", unit_code="BOX")])
    assert made.status_code == 201, made.json()
    assert made.json()["data"]["lines"][0]["unit_cost"] == "360.0000"
