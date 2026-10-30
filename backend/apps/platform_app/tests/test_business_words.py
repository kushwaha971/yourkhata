"""B2 / BP-22 #1–#2 — the session says each business's own words and features.

Tier 1: these decide what every Shop screen of a business is called and shows.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from apps.platform_app.selectors.business_words import features_of, words_of

pytestmark = pytest.mark.django_db


def _tenant(kind: str) -> SimpleNamespace:
    return SimpleNamespace(business_type=kind, pk=None, id=None)


def test_a_kirana_sends_no_words_and_no_orders() -> None:
    """A kirana uses the shared words, so nothing is sent; no orders rows."""
    rows: dict = {}
    assert words_of(_tenant("kirana"), "en", rows) == {}
    assert "orders" not in features_of(_tenant("kirana"), rows)


def test_a_medical_store_says_distributors_in_both_languages() -> None:
    """Design BT.medical: Supplier → Distributor, in EN and HI."""
    rows: dict = {}
    en = words_of(_tenant("medical"), "en", rows)
    hi = words_of(_tenant("medical"), "hi", rows)
    assert en == {"nav.suppliers": "Distributors", "nav.section.parties": "Customers & distributors"}
    assert hi["nav.suppliers"] == "वितरक"


def test_a_wholesaler_says_retailers_and_companies() -> None:
    """`shop.wholesale` on with labels from the wholesale preset."""
    rows = {"shop.wholesale": {"value": True}, "parties.labels": {"customer": "Retailer", "supplier": "Company"}}
    words = words_of(_tenant("kirana"), "en", rows)
    assert words["nav.parties"] == "Retailers"
    assert words["nav.suppliers"] == "Companies"
    assert {"wholesale", "orders"} <= set(features_of(_tenant("kirana"), {**rows, "shop.features.orders": {"value": True}}))


def test_owner_typed_words_are_sent_as_typed() -> None:
    """R-DEC-51 #6: English required, Hindi optional — a typed word is shown as typed."""
    rows = {"parties.labels": {"customer": "Patient", "supplier": "Supplier"}}
    assert words_of(_tenant("medical"), "hi", rows)["nav.parties"] == "Patients"


def test_a_switch_the_owner_turned_off_wins_over_the_kind() -> None:
    rows = {"shop.features.orders": {"value": False}}
    assert "orders" not in features_of(_tenant("hardware"), rows)
