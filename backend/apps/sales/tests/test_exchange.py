"""G6 — exchange at the counter: one credit note and one bill, together or not at all."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.urls import reverse

from apps.inventory.models import ItemStock
from apps.sales.models import SalesDocument
from apps.sales.tests.conftest import cash, draft, issue, line, recalc_clean

pytestmark = pytest.mark.django_db
URL = "v1:exchanges"


@pytest.fixture
def clothes(shop: Any) -> Any:
    from apps.platform_app.models import TenantSetting

    TenantSetting.objects.update_or_create(
        tenant=shop, key="shop.features.variants", defaults={"value": {"value": True}}
    )
    return shop


def _post(client: Any, body: dict, key: str | None = None) -> Any:
    return client.post(
        reverse(URL), body, format="json", HTTP_IDEMPOTENCY_KEY=key or str(uuid.uuid4())
    )


def _sold(owner: Any, make_item: Any, make_party: Any, rate: str = "500") -> tuple[Any, Any, dict]:
    party = make_party()
    item = make_item("Cotton shirt M", rate, stock="10")
    total = draft(owner, party_id=str(party.id), lines=[line(item, "2")]).json()["data"]
    paid = cash(total["grand_total"])
    bill = issue(owner, total["id"], version=total["version"], payment=paid).json()["data"]
    return party, item, bill


def _stock(item: Any) -> Decimal:
    return ItemStock.objects.filter(item=item).first().on_hand


def test_a_shop_without_sizes_has_no_exchange(owner: Any) -> None:
    assert _post(owner, {}).status_code == 404


def test_a_same_price_swap_makes_both_documents_and_leaves_nothing_to_pay(
    clothes: Any, owner: Any, make_item: Any, make_party: Any
) -> None:
    """Design "Nothing to pay": the note pays the new bill, stock moves both ways."""
    party, item, bill = _sold(owner, make_item, make_party)
    other = make_item("Cotton shirt L", "500", stock="5")
    before = _stock(item)
    made = _post(owner, {
        "against_id": bill["id"],
        "returns": [{"against_line_id": bill["lines"][0]["id"], "qty": "1"}],
        "lines": [line(other, "1")],
    })
    assert made.status_code == 201, made.json()
    data = made.json()["data"]
    assert Decimal(data["invoice"]["amount_due"]) == 0
    assert Decimal(data["credit_note"]["open_credit"]) == 0
    assert _stock(item) == before + 1
    assert _stock(other) == Decimal("4")
    recalc_clean()


def test_taking_less_leaves_open_credit_never_cash(
    clothes: Any, owner: Any, make_item: Any, make_party: Any
) -> None:
    party, item, bill = _sold(owner, make_item, make_party)
    cheap = make_item("Socks", "100", stock="5")
    data = _post(owner, {
        "against_id": bill["id"],
        "returns": [{"against_line_id": bill["lines"][0]["id"], "qty": "1"}],
        "lines": [line(cheap, "1")],
    }).json()["data"]
    assert Decimal(data["invoice"]["amount_due"]) == 0
    note = SalesDocument.objects.get(pk=data["credit_note"]["id"])
    assert note.amount_due == Decimal(data["credit_note"]["open_credit"])
    assert (note.meta or {}).get("settlement") == "hold_advance"


def test_a_refused_new_bill_leaves_no_credit_note(
    clothes: Any, owner: Any, make_item: Any, make_party: Any
) -> None:
    """Both or neither: a bad going-out line must not strand a credit note."""
    party, item, bill = _sold(owner, make_item, make_party)
    notes = SalesDocument.objects.filter(kind="credit_note").count()
    before = _stock(item)
    bad = _post(owner, {
        "against_id": bill["id"],
        "returns": [{"against_line_id": bill["lines"][0]["id"], "qty": "1"}],
        "lines": [{"item_id": str(uuid.uuid4()), "qty": "1"}],
    })
    assert bad.status_code >= 400
    assert SalesDocument.objects.filter(kind="credit_note").count() == notes
    assert _stock(item) == before


def test_returning_more_than_was_sold_is_refused(
    clothes: Any, owner: Any, make_item: Any, make_party: Any
) -> None:
    party, item, bill = _sold(owner, make_item, make_party)
    other = make_item("Cotton shirt L", "500", stock="5")
    bad = _post(owner, {
        "against_id": bill["id"],
        "returns": [{"against_line_id": bill["lines"][0]["id"], "qty": "3"}],
        "lines": [line(other, "1")],
    })
    assert bad.status_code >= 400


def test_a_double_tap_is_one_exchange(
    clothes: Any, owner: Any, make_item: Any, make_party: Any
) -> None:
    party, item, bill = _sold(owner, make_item, make_party)
    other = make_item("Cotton shirt L", "500", stock="5")
    body = {
        "against_id": bill["id"],
        "returns": [{"against_line_id": bill["lines"][0]["id"], "qty": "1"}],
        "lines": [line(other, "1")],
    }
    key = str(uuid.uuid4())
    first, second = _post(owner, body, key), _post(owner, body, key)
    assert first.json()["data"]["invoice"]["id"] == second.json()["data"]["invoice"]["id"]
    assert SalesDocument.objects.filter(kind="credit_note").count() == 1


def test_nothing_ticked_is_refused(clothes: Any, owner: Any) -> None:
    bad = _post(owner, {"against_id": str(uuid.uuid4()), "returns": [], "lines": []})
    assert bad.status_code == 400 or bad.status_code == 422


def test_the_preview_tells_the_truth_and_leaves_nothing_behind(
    clothes: Any, owner: Any, make_item: Any, make_party: Any
) -> None:
    """The dock's figures must equal what Done then makes, and looking changes nothing."""
    party, item, bill = _sold(owner, make_item, make_party)
    cheap = make_item("Socks", "100", stock="5")
    body = {
        "against_id": bill["id"],
        "returns": [{"against_line_id": bill["lines"][0]["id"], "qty": "1"}],
        "lines": [line(cheap, "1")],
    }
    count = SalesDocument.objects.count()
    seen = owner.post(reverse("v1:exchange-preview"), body, format="json").json()["data"]
    assert SalesDocument.objects.count() == count
    assert _stock(cheap) == Decimal("5")
    made = _post(owner, body).json()["data"]
    assert Decimal(seen["to_pay"]) == Decimal(made["invoice"]["amount_due"])
    assert Decimal(seen["credit_left"]) == Decimal(made["credit_note"]["open_credit"])


def _quick_sale(owner: Any, make_item: Any, **walk_in: Any) -> tuple[Any, dict]:
    item = make_item("Cotton shirt M", "500", stock="10")
    made = draft(owner, lines=[line(item, "2")], **walk_in).json()["data"]
    paid = cash(made["grand_total"])
    return item, issue(owner, made["id"], version=made["version"], payment=paid).json()["data"]


def _swap(bill: dict, other: Any, **extra: Any) -> dict:
    full = SalesDocument.objects.get(pk=bill["id"]).lines.first()
    return {
        "against_id": bill["id"],
        "returns": [{"against_line_id": str(full.id), "qty": "1"}],
        "lines": [line(other, "1")],
        **extra,
    }


def test_a_quick_sale_exchange_saves_the_customer_and_links_the_bill(
    clothes: Any, owner: Any, make_item: Any
) -> None:
    """A walk-in's leftover credit must belong to somebody, or it is lost."""
    item, bill = _quick_sale(owner, make_item, walk_in_name="Sita")
    other = make_item("Socks", "100", stock="5")
    made = _post(owner, _swap(bill, other, customer={"name": "Sita", "mobile": "9876500011"}))
    assert made.status_code == 201, made.content
    old = SalesDocument.objects.get(pk=bill["id"])
    assert old.party.mobile == "9876500011" and old.walk_in_name is None
    data = made.json()["data"]
    assert Decimal(data["credit_note"]["open_credit"]) > 0
    recalc_clean()


def test_a_quick_sale_exchange_uses_the_customer_already_saved_on_that_mobile(
    clothes: Any, owner: Any, make_item: Any, make_party: Any
) -> None:
    """The same mobile twice is one customer, not a refused exchange."""
    party = make_party(mobile="9876500012")
    _item, bill = _quick_sale(owner, make_item, walk_in_name="Sita")
    other = make_item("Socks", "100", stock="5")
    made = _post(owner, _swap(bill, other, customer={"name": "Sita", "mobile": "9876500012"}))
    assert made.status_code == 201, made.content
    assert SalesDocument.objects.get(pk=bill["id"]).party_id == party.id


def test_a_quick_sale_exchange_needs_a_mobile_and_a_refusal_links_nothing(
    clothes: Any, owner: Any, make_item: Any
) -> None:
    """No mobile, no exchange; the bill stays a quick sale."""
    _item, bill = _quick_sale(owner, make_item, walk_in_name="Sita")
    other = make_item("Socks", "100", stock="5")
    assert _post(owner, _swap(bill, other)).status_code == 400
    assert SalesDocument.objects.get(pk=bill["id"]).party_id is None


def test_the_preview_of_a_quick_sale_saves_nobody(clothes: Any, owner: Any, make_item: Any) -> None:
    """Typing a mobile on the screen must not make a customer."""
    from apps.parties.models import Party

    _item, bill = _quick_sale(owner, make_item, walk_in_name="Sita")
    other = make_item("Socks", "100", stock="5")
    seen = owner.post(
        reverse("v1:exchange-preview"),
        _swap(bill, other, customer={"name": "Sita", "mobile": "9876500013"}),
        format="json",
    )
    assert seen.status_code == 200, seen.content
    assert not Party.objects.filter(mobile="9876500013").exists()
    assert SalesDocument.objects.get(pk=bill["id"]).party_id is None
