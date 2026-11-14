"""Sanity limits for a bill line — one owner for sales and purchases (FB-020).

The columns can hold far more (`QuantityField`, `MoneyField`: 14 digits), and
until these limits the only ceiling was the column's: a quantity and rate of
99999999 were accepted and a draft saved with a grand total of
₹8,79,99,99,99,99,99,99,900.00 (found by seeded monkey testing, A3). One
extra-zeros typo at a counter makes a bill like that.

These are generous for a small Indian business and refuse only the absurd:
- quantity per line: up to 9,99,999.999;
- rate per unit: up to ₹9,99,99,999.99;
- a line's quantity × rate: up to ₹9,99,99,999.99.
The client (`src/constants.ts`) holds the same numbers so the field says why
before the server refuses.
"""

from __future__ import annotations

from decimal import Decimal

LINE_QTY_LIMIT = Decimal("999999.999")
LINE_RATE_LIMIT = Decimal("99999999.99")
LINE_AMOUNT_LIMIT = Decimal("99999999.99")

QTY_TOO_LARGE = "Quantity is too large: up to 9,99,999.999."
RATE_TOO_LARGE = "Rate is too large: up to ₹9,99,99,999.99."
AMOUNT_TOO_LARGE = "This line is more than ₹9,99,99,999.99. Check the quantity and rate."


def line_limit_errors(qty: Decimal | None, rate: Decimal | None) -> dict[str, str]:
    """Which of quantity, rate or their product is over its limit, by field.

    Returns `{"qty": message}`, `{"rate": message}` or `{"amount": message}` —
    the caller maps them onto its own field names (sales `unit_price`,
    purchases `unit_cost`). Values that are missing or negative are the
    caller's other rules, not these.
    """
    errors: dict[str, str] = {}
    if qty is not None and qty > LINE_QTY_LIMIT:
        errors["qty"] = QTY_TOO_LARGE
    if rate is not None and rate > LINE_RATE_LIMIT:
        errors["rate"] = RATE_TOO_LARGE
    if not errors and qty is not None and rate is not None and qty * rate > LINE_AMOUNT_LIMIT:
        errors["amount"] = AMOUNT_TOO_LARGE
    return errors
