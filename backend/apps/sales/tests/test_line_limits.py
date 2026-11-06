"""FB-020 — a bill line's quantity, rate and amount have sanity limits.

Found by seeded monkey testing (A3): a quantity and a rate of 99999999 were
accepted and a draft saved with a grand total of ₹8,79,99,99,99,99,99,99,900.00.
The only ceiling was the column's. One extra-zeros typo at a counter makes such
a bill; the server refuses it, and the message names the field.
"""

from __future__ import annotations

from typing import Any

import pytest

from apps.common.limits import AMOUNT_TOO_LARGE, QTY_TOO_LARGE, RATE_TOO_LARGE
from apps.sales.tests.conftest import draft, line

pytestmark = pytest.mark.django_db


def _details(response: Any) -> dict:
    assert response.status_code == 400, response.content
    return response.json()["error"]["details"]


def test_a_quantity_above_the_limit_is_refused(owner: Any, make_item: Any) -> None:
    details = _details(draft(owner, lines=[line(make_item(), "1000000")]))
    assert details["lines.0.qty"] == [QTY_TOO_LARGE]


def test_a_rate_above_the_limit_is_refused(owner: Any, make_item: Any) -> None:
    details = _details(draft(owner, lines=[line(make_item(), "1", unit_price="100000000")]))
    assert details["lines.0.unit_price"] == [RATE_TOO_LARGE]


def test_a_line_whose_quantity_times_rate_is_absurd_is_refused(owner: Any, make_item: Any) -> None:
    """Each figure alone is allowed; together they make ₹50 crore on one line."""
    details = _details(draft(owner, lines=[line(make_item(), "500000", unit_price="1000")]))
    assert details["lines.0.qty"] == [AMOUNT_TOO_LARGE]


def test_ordinary_large_lines_still_save(owner: Any, make_item: Any) -> None:
    """A wholesaler's 9,99,999 pieces at ₹99 is fine; the limits refuse only the absurd."""
    response = draft(owner, lines=[line(make_item(), "999999", unit_price="99")])
    assert response.status_code == 201, response.content
