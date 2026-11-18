"""The Items list's kind column reads the page's own data and each kind its own."""

from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace
from unittest import mock

from apps.inventory.services import kind_column


def test_first_feature_in_design_order_wins():
    """A kind with several features must show the design's column, not whichever came first."""
    with mock.patch.object(kind_column, "features_of", return_value={"variants", "alt_units"}):
        assert kind_column.column_of(object()) == "alt_units"
    with mock.patch.object(kind_column, "features_of", return_value={"orders"}):
        assert kind_column.column_of(object()) is None


def test_no_column_reads_nothing():
    """A kirana has no such column, so it must not pay for a query."""
    assert kind_column.lines(key=None, items=[SimpleNamespace(id=1)]) == {}


def test_variant_line_comes_from_the_row():
    """The line is the item's own size and colour, keyed by id as a string."""
    item = SimpleNamespace(id=7, attributes={"size": "M", "colour": "Blue"})
    assert kind_column.lines(key="variants", items=[item]) == {"7": {"size": "M", "colour": "Blue"}}


def test_quantity_has_no_trailing_zeros():
    """"12.000" in a cell would read as twelve thousand to a shopkeeper."""
    assert kind_column._qty(Decimal("12.000")) == "12"
    assert kind_column._qty(Decimal("1.500")) == "1.5"
