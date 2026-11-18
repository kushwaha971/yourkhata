"""Export on Estimates and Credit notes (Part F design, owner 11 Nov 2026).

The design gives both lists an Export button; it downloads the list as
filtered, the same contract Bills' export keeps, so a file never holds rows
the merchant filtered out.
"""

from __future__ import annotations

from typing import Any

import pytest
from django.urls import reverse

from apps.sales.tests.conftest import CREDIT_NOTES, ESTIMATES, line
from apps.sales.tests.test_credit_notes import issued_invoice, note_draft, returning

pytestmark = pytest.mark.django_db


def _rows(response: Any) -> list[str]:
    assert response.status_code == 200, response.content
    return b"".join(response.streaming_content).decode().splitlines()


def test_the_estimates_export_is_the_tab_on_screen(
    owner: Any, make_item: Any, make_party: Any
) -> None:
    party = make_party()
    created = owner.post(
        reverse(ESTIMATES), {"party_id": str(party.id), "lines": [line(make_item())]}, format="json"
    )
    assert created.status_code == 201, created.json()
    rows = _rows(owner.get(reverse(ESTIMATES), {"format": "csv", "tab": "draft"}))
    assert len(rows) == 2 and party.name in rows[1]
    sent = owner.get(reverse(ESTIMATES), {"format": "csv", "tab": "sent"})
    assert sent.status_code == 400 and sent.json()["error"]["code"] == "nothing_to_export"


def test_the_credit_notes_export_names_the_bill_it_returns(
    owner: Any, make_item: Any, make_party: Any
) -> None:
    invoice = issued_invoice(owner, make_party(), [line(make_item(), "2")])
    assert note_draft(owner, against_id=invoice["id"], lines=returning(invoice, "1")).status_code == 201
    rows = _rows(owner.get(reverse(CREDIT_NOTES), {"format": "csv", "tab": "draft"}))
    assert len(rows) == 2 and invoice["number"] in rows[1]
