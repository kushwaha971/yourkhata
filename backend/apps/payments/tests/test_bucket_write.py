"""UX16 / DEC-019: automatic fee collection must retain its app at the API boundary."""

from decimal import Decimal
from typing import Any

import pytest
from django.test import override_settings

from apps.payments.tests.conftest import cash_lines, pay
from apps.sales.models import SalesDocument

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("bucket", ["main", "loan", "unknown"])
def test_invalid_automatic_payment_bucket_is_not_silently_replaced_with_shop(
    owner: Any, make_party: Any, bucket: str
) -> None:
    party = make_party()
    response = pay(
        owner,
        party_id=str(party.id),
        bucket=bucket,
        allocations="auto",
        mode_breakup=cash_lines("10.00"),
    )
    assert response.status_code == 400, response.json()
    assert "bucket" in response.json()["error"]["details"]
