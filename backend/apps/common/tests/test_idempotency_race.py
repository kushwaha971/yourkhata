"""A key released between losing the claim and reading it back is "try again", not a 500.

Found live on 16 Nov 2026 (e2e/shop-edges-ppi.mjs): two copies of one receipt
sent at once with one Idempotency-Key. The first claimed the key, failed
validation and deleted its row (a refused request must not burn the key); the
second had already lost the INSERT and then `get()` found nothing — DoesNotExist
escaped as a 500. The released key means the first attempt is over, so the honest
answer is the same 409 "still processing" the client already retries on.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest import mock

import pytest
from django.db import IntegrityError

from apps.common import idempotency
from apps.common.exceptions import IdempotencyInProgress


class _Gone(Exception):
    pass


def _model_whose_key_vanished() -> mock.Mock:
    model = mock.Mock()
    model.DoesNotExist = _Gone
    model.objects.create.side_effect = IntegrityError("uq_idempotency_tenant_scope_key")
    model.objects.get.side_effect = _Gone()
    model.objects.filter.return_value.first.return_value = None
    return model


@pytest.mark.django_db
def test_a_key_released_after_a_lost_claim_answers_try_again() -> None:
    calls: list[str] = []

    class View:
        @idempotency.idempotent("probe")
        def post(self, request: object) -> None:
            calls.append("ran")

    request = SimpleNamespace(
        headers={"Idempotency-Key": "k1"},
        method="POST",
        path="/api/v1/payments",
        data={"amount": "5.00"},
        user=SimpleNamespace(is_authenticated=False),
    )
    with (
        mock.patch.object(
            idempotency, "_idempotency_model", return_value=_model_whose_key_vanished()
        ),
        mock.patch("apps.common.tenancy.get_effective_tenant", return_value=object()),
        pytest.raises(IdempotencyInProgress),
    ):
        View().post(request)
    assert calls == [], "the second copy must not run the view while the first decides"
