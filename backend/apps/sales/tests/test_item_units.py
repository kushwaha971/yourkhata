"""D P1a — an item sold in boxes and pieces: stock always moves in pieces."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

import pytest
from django.urls import reverse

from apps.inventory.models import ItemStock, StockMovement, Unit
from apps.sales.tests.conftest import CREDIT_NOTES, issue_note, issued_invoice, line, recalc_clean

pytestmark = pytest.mark.django_db


def box() -> Unit:
    return Unit.objects.get(tenant__isnull=True, code="BOX")


@pytest.fixture
def switch(make_item: Any) -> Any:
    """Anchor switch: ₹28 a piece, 200 in stock at ₹20; a box of 20 at ₹520."""
    return make_item(
        "Anchor switch 6A",
        "28.00",
        "GST18",
        stock="200",
        units=[{"unit_id": str(box().id), "factor": "20", "selling_price": "520.00", "barcode": "8901234500017"}],
    )


def on_hand(item: Any) -> Decimal:
    return ItemStock.objects.get(item=item).on_hand


def test_one_box_sold_takes_twenty_pieces(owner: Any, switch: Any, make_party: Any) -> None:
    """U5 — the line is "1 BOX at ₹520"; stock falls by 20, never by 1."""
    invoice = issued_invoice(owner, make_party(), [line(switch, "1", unit_code="BOX")])
    only = invoice["lines"][0]
    assert (only["unit_code"], only["unit_factor"], only["unit_price"]) == ("BOX", "20.000", "520.0000")
    assert on_hand(switch) == Decimal("180.000")
    move = StockMovement.objects.get(item=switch, movement_type="sale_out")
    assert move.qty == Decimal("-20.000") and move.unit_cost == Decimal("380.0000")


def test_a_box_with_no_price_sells_at_the_piece_price_times_twenty(
    owner: Any, make_item: Any, make_party: Any
) -> None:
    """Decision 2 — no box price: ₹28 × 20 = ₹560."""
    plain = make_item(
        "Switch plate", "28.00", "GST18", stock="100", units=[{"unit_id": str(box().id), "factor": "20"}]
    )
    from apps.sales.tests.conftest import draft

    made = draft(owner, party_id=str(make_party().id), lines=[line(plain, "1", unit_code="BOX")])
    assert made.status_code == 201, made.json()
    assert made.json()["data"]["lines"][0]["unit_price"] == "560.0000"


def test_the_cost_on_a_box_line_is_a_box_cost(owner: Any, switch: Any, make_party: Any) -> None:
    """Profit multiplies the snapshot by the line's qty, so a box line's cost is
    20 × the average (₹380 × 20), not a piece's: 1 box would otherwise show ₹140 profit
    on ₹520 instead of a loss of ₹7,080."""
    invoice = issued_invoice(owner, make_party(), [line(switch, "1", unit_code="BOX")])
    from apps.sales.models import SalesDocumentLine

    assert SalesDocumentLine.objects.get(pk=invoice["lines"][0]["id"]).unit_cost_snapshot == Decimal(
        "7600.0000"
    )


def test_returning_a_box_puts_twenty_back(owner: Any, switch: Any, make_party: Any) -> None:
    """U7 — a credit note for the box line restocks 20 pieces at the piece cost."""
    invoice = issued_invoice(owner, make_party(), [line(switch, "1", unit_code="BOX")])
    created = owner.post(
        reverse(CREDIT_NOTES),
        {"against_id": invoice["id"], "reason": "sales_return", "lines": [{"against_line_id": invoice["lines"][0]["id"], "qty": "1"}]},
        format="json",
    ).json()["data"]
    assert issue_note(owner, created["id"]).status_code == 200
    assert on_hand(switch) == Decimal("200.000")
    back = StockMovement.objects.get(item=switch, movement_type="sale_return_in")
    assert back.qty == Decimal("20.000") and back.unit_cost == Decimal("380.0000")
    recalc_clean()


def test_pieces_still_sell_as_pieces(owner: Any, switch: Any, make_party: Any) -> None:
    """U8 — a line without a unit is the item's own unit, as every line was before."""
    invoice = issued_invoice(owner, make_party(), [line(switch, "3")])
    assert invoice["lines"][0]["unit_code"] == "NOS" and invoice["lines"][0]["unit_factor"] == "1.000"
    assert on_hand(switch) == Decimal("197.000")


def test_the_box_barcode_finds_the_item_and_names_the_box(owner: Any, switch: Any) -> None:
    """U6 — scanning the box's own code answers the item with `scanned_unit` BOX."""
    data = owner.get(reverse("v1:item-lookup") + "?barcode=8901234500017").json()["data"]
    assert data["id"] == str(switch.id) and data["scanned_unit"] == "BOX"
    assert data["units"] == [
        {"code": "BOX", "factor": "20.000", "barcode": "8901234500017", "selling_price": "520.00", "allow_decimal": False}
    ]


def test_bad_units_are_refused_with_the_field_named(owner: Any, make_item: Any) -> None:
    """A unit that is the item's own, a factor of 1, and a barcode another item has."""
    from apps.common.exceptions import ValidationFailed

    make_item("Other", "10.00", "GST18", stock=None, barcode="8900000000001")
    nos = Unit.objects.get(tenant__isnull=True, code="NOS")
    with pytest.raises(ValidationFailed) as refused:
        make_item(
            "Bad", "10.00", "GST18", stock=None,
            units=[
                {"unit_id": str(nos.id), "factor": "20"},
                {"unit_id": str(box().id), "factor": "1"},
            ],
        )
    assert set(refused.value.details) >= {"units.0.unit_id", "units.1.factor"}
    with pytest.raises(ValidationFailed) as taken:
        make_item("Bad2", "10.00", "GST18", stock=None, units=[{"unit_id": str(box().id), "factor": "12", "barcode": "8900000000001"}])
    assert "units.0.barcode" in taken.value.details
