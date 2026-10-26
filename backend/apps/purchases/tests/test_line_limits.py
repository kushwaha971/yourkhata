"""FB-020 — purchase lines share the sales lines' sanity limits (apps.common.limits).

The purchase editor shares the sales editor's lines, and its only quantity
ceiling was the column's (`MAX_QTY`, ten billion). The same absurd typo is
refused here with the same words.
"""

from __future__ import annotations

from typing import Any

import pytest

from apps.common.limits import AMOUNT_TOO_LARGE, QTY_TOO_LARGE, RATE_TOO_LARGE
from apps.purchases.tests.conftest import draft, line

pytestmark = pytest.mark.django_db


def _details(response: Any) -> dict:
    assert response.status_code == 400, response.content
    return response.json()["error"]["details"]


def test_purchase_quantity_rate_and_amount_limits(
    owner: Any, make_item: Any, make_supplier: Any
) -> None:
    supplier = str(make_supplier().id)
    item = make_item()
    assert _details(draft(owner, party_id=supplier, lines=[line(item, "1000000", "1")]))[
        "lines.0.qty"
    ] == [QTY_TOO_LARGE]
    assert _details(draft(owner, party_id=supplier, lines=[line(item, "1", "100000000")]))[
        "lines.0.unit_cost"
    ] == [RATE_TOO_LARGE]
    assert _details(draft(owner, party_id=supplier, lines=[line(item, "500000", "1000")]))[
        "lines.0.qty"
    ] == [AMOUNT_TOO_LARGE]


def test_ordinary_large_purchase_lines_still_save(
    owner: Any, make_item: Any, make_supplier: Any
) -> None:
    response = draft(
        owner, party_id=str(make_supplier().id), lines=[line(make_item(), "999999", "99")]
    )
    assert response.status_code == 201, response.content
