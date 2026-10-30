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


def test_a_kirana_sends_only_its_kind_and_no_orders() -> None:
    """A kirana uses the shared people words, so only its kind is sent; no orders rows."""
    rows: dict = {}
    assert words_of(_tenant("kirana"), "en", rows) == {"business.kind": "Kirana"}
    assert "orders" not in features_of(_tenant("kirana"), rows)


def test_a_medical_store_says_distributors_in_both_languages() -> None:
    """Design BT.medical: Supplier → Distributor, in EN and HI."""
    rows: dict = {}
    en = words_of(_tenant("medical"), "en", rows)
    hi = words_of(_tenant("medical"), "hi", rows)
    assert en["business.kind"] == "Medical"
    assert en["nav.suppliers"] == "Distributors"
    assert en["nav.section.parties"] == "Customers & distributors"
    assert en["parties.list.supplier.title"] == "Distributors"
    assert en["parties.list.supplier.add"] == "Add distributor"
    assert en["parties.list.supplier.empty.title"] == "No distributors yet"
    assert "nav.parties" not in en  # customers keep the shared word
    assert hi["nav.suppliers"] == "वितरक"
    assert hi["parties.list.supplier.add"] == "वितरक जोड़ें"


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



def test_the_session_carries_both_languages(tenant) -> None:
    """Prevents (found by b2-menus): a Hindi screen showing "Distributors" because
    the words were resolved in the account's saved locale, not the one on screen."""
    from apps.platform_app.selectors.business_words import business_block

    tenant.business_type = "medical"
    tenant.save(update_fields=["business_type"])
    words = business_block(tenant)["words"]
    assert words["en"]["nav.suppliers"] == "Distributors"
    assert words["hi"]["nav.suppliers"] == "वितरक"
    assert words["hi"]["business.kind"] == "मेडिकल"
