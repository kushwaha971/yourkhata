"""The Payments register's Export is the filtered set, so a filtered download
never carries rows the merchant had filtered away."""

from __future__ import annotations

from typing import Any

import pytest
from django.urls import reverse

from apps.payments.tests.conftest import PAYMENTS, cash_lines, pay

pytestmark = pytest.mark.django_db


def test_export_lists_only_the_rows_the_filter_keeps(owner: Any, make_party: Any) -> None:
    kept = make_party(name="Kept Person")
    other = make_party(name="Other Person")
    assert pay(owner, party_id=str(kept.id), mode_breakup=cash_lines("120.00")).status_code == 201
    assert pay(owner, party_id=str(other.id), mode_breakup=cash_lines("70.00")).status_code == 201

    response = owner.get(reverse(PAYMENTS), {"format": "csv", "party_id": str(kept.id)})

    assert response.status_code == 200
    text = b"".join(response.streaming_content).decode("utf-8-sig")
    assert "Kept Person" in text and "120.00" in text
    assert "Other Person" not in text
