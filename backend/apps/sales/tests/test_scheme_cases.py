"""G9 — the shared cases: the server applies a scheme exactly as the bill screen previews it."""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

import pytest

from apps.sales.services.schemes import apply

CASES = json.loads(
    (
        Path(__file__).resolve().parents[4]
        / "frontend/src/modules/DigiKhaato/features/sales/view-model/schemeCases.json"
    ).read_text()
)["cases"]


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_scheme_case(case: dict) -> None:
    discounts, free = apply(case["lines"], case["schemes"])
    assert discounts == case["discounts"]
    assert [{**f, "qty": str(Decimal(f["qty"]).normalize())} for f in free] == case["free"]
