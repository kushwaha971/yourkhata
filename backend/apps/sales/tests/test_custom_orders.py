"""G3a — a jeweller's custom orders: the advance, the fixed rate, the statuses."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.urls import reverse

from apps.payments.models import Payment

pytestmark = pytest.mark.django_db
URL = "v1:custom-orders"


@pytest.fixture
def jeweller(shop: Any) -> Any:
    shop.business_type = "jewellery"
    shop.save(update_fields=["business_type"])
    return shop


def _body(party: Any, **extra: Any) -> dict:
    return {
        "party_id": str(party.id),
        "what": "Mangalsutra, 2 lines, black beads",
        "approx_weight_g": "18.0",
        "purity": "gold_22k",
        "deliver_on": "2099-11-07",
        "client_key": str(uuid.uuid4()),
        **extra,
    }


def _rate(owner: Any) -> None:
    assert owner.put(reverse("v1:metal-rate-today"), {"gold_22k": "11650"}, format="json").status_code in (200, 201)


def test_an_order_with_an_advance_fixes_the_rate_and_is_a_real_receipt(jeweller: Any, owner: Any, make_party: Any) -> None:
    _rate(owner)
    res = owner.post(reverse(URL), _body(make_party(), advance="50000", advance_mode="upi", fix_rate=True), format="json")
    assert res.status_code == 201, res.content
    data = res.json()["data"]
    assert data["number"] == "ORD-0001" and data["fixed_rate"] == "11650.00" and data["status"] == "open"
    payment = Payment.objects.get(pk=data["advance_payment_id"])
    assert payment.amount == Decimal("50000.00") and payment.primary_mode == "upi"
    listed = owner.get(reverse(URL)).json()["data"]
    assert listed["open"] == 1 and listed["advance_held"] == "50000.00"


def test_the_advance_is_held_for_the_order_until_it_is_delivered(jeweller: Any, owner: Any, make_party: Any) -> None:
    """Earmarked, no other bill applies it automatically; delivered, it is open to the bill."""
    from apps.payments.selectors.payments import open_advances

    party = make_party()
    data = owner.post(reverse(URL), _body(party, advance="1000"), format="json").json()["data"]
    assert not open_advances(tenant=jeweller, party_id=party.id).exists()
    status = reverse("v1:custom-order-status", args=[data["id"]])
    assert owner.post(status, {"status": "delivered"}, format="json").status_code == 409  # not ready yet
    assert owner.post(status, {"status": "ready"}, format="json").status_code == 200
    assert owner.post(status, {"status": "delivered"}, format="json").status_code == 200
    assert open_advances(tenant=jeweller, party_id=party.id).count() == 1
    assert owner.get(reverse(URL)).json()["data"]["advance_held"] == "0.00"


def test_a_double_tapped_save_is_one_order_and_one_receipt(jeweller: Any, owner: Any, make_party: Any) -> None:
    body = _body(make_party(), advance="1000")
    first = owner.post(reverse(URL), body, format="json")
    second = owner.post(reverse(URL), body, format="json")
    assert first.status_code == 201 and second.status_code == 200
    assert first.json()["data"]["id"] == second.json()["data"]["id"]
    assert Payment.objects.filter(amount=Decimal("1000.00")).count() == 1


def test_refusals_are_said_under_their_fields(jeweller: Any, owner: Any, make_party: Any) -> None:
    res = owner.post(reverse(URL), {"what": "", "purity": "x", "deliver_on": "2000-01-01", "fix_rate": True}, format="json")
    details = res.json()["error"]["details"]
    assert res.status_code == 400 and {"party_id", "what", "purity", "deliver_on", "fix_rate"} <= set(details)


def test_a_shop_that_is_not_a_jeweller_has_no_custom_orders(owner: Any) -> None:
    assert owner.get(reverse(URL)).status_code == 404


def _tag_item(owner: Any, make_item: Any) -> Any:
    item = make_item("Gold chain 22K", "0", "GST0", stock=None, tracking="serial")
    tag = {"tag_no": "OB-1", "purity": "gold_22k", "gross_g": "1.000", "net_g": "1.000", "making_type": "pct", "making_value": "0"}
    assert owner.post(reverse("v1:item-tags", args=[item.id]), tag, format="json").status_code == 201
    return item


def test_a_bill_delivers_the_order_and_applies_its_advance(jeweller: Any, owner: Any, make_party: Any, make_item: Any) -> None:
    """₹1,000 advance on an ₹11,650 piece: ₹10,650 is due, the order is delivered and
    names the bill; the bill's balance and the receipt agree."""
    from apps.sales.tests.conftest import draft, issue, line

    _rate(owner)
    party = make_party()
    order = owner.post(reverse(URL), _body(party, advance="1000"), format="json").json()["data"]
    item = _tag_item(owner, make_item)
    body = line(item, "1", serials=["OB-1"], jewel={})
    made = draft(owner, party_id=str(party.id), lines=[body], custom_order_id=order["id"]).json()["data"]
    assert made["custom_order"]["number"] == order["number"]
    done = issue(owner, made["id"], version=made["version"])
    assert done.status_code == 200, done.content
    data = done.json()["data"]
    assert Decimal(data["amount_paid"]) == Decimal("1000.00")
    assert Decimal(data["amount_due"]) == Decimal(data["grand_total"]) - Decimal("1000.00")
    after = owner.get(reverse("v1:custom-order-detail", args=[order["id"]])).json()["data"]
    assert after["status"] == "delivered" and after["invoice_id"] == made["id"]
    assert Payment.objects.get(pk=order["advance_payment_id"]).unallocated_amount == 0


def test_an_advance_bigger_than_the_bill_leaves_the_rest_usable(jeweller: Any, owner: Any, make_party: Any, make_item: Any) -> None:
    from apps.payments.selectors.payments import open_advances
    from apps.sales.tests.conftest import draft, issue, line

    _rate(owner)
    party = make_party()
    order = owner.post(reverse(URL), _body(party, advance="20000"), format="json").json()["data"]
    item = _tag_item(owner, make_item)
    made = draft(owner, party_id=str(party.id), lines=[line(item, "1", serials=["OB-1"], jewel={})], custom_order_id=order["id"]).json()["data"]
    data = issue(owner, made["id"], version=made["version"]).json()["data"]
    assert data["status"] == "paid"
    assert open_advances(tenant=jeweller, party_id=party.id).count() == 1


def test_another_customers_bill_cannot_take_the_order(jeweller: Any, owner: Any, make_party: Any, make_item: Any) -> None:
    from apps.sales.tests.conftest import draft, issue, line

    _rate(owner)
    order = owner.post(reverse(URL), _body(make_party(), advance="1000"), format="json").json()["data"]
    item = _tag_item(owner, make_item)
    other = make_party(name="Someone else")
    made = draft(owner, party_id=str(other.id), lines=[line(item, "1", serials=["OB-1"], jewel={})], custom_order_id=order["id"]).json()["data"]
    refused = issue(owner, made["id"], version=made["version"])
    assert refused.status_code == 409 and refused.json()["error"]["code"] == "custom_order_status"
    assert Payment.objects.get(pk=order["advance_payment_id"]).meta.get("earmark")


# ── G3b: karigars ───────────────────────────────────────────────────────────


def _karigar(owner: Any, limit: str = "1.5") -> dict:
    res = owner.post(reverse("v1:karigars"), {"name": "Raju Soni", "wastage_limit_pct": limit}, format="json")
    assert res.status_code == 201, res.content
    return res.json()["data"]


def _issue(owner: Any, karigar: dict, weight: str = "37.400", **extra: Any) -> dict:
    res = owner.post(
        reverse("v1:karigar-issue", args=[karigar["id"]]),
        {"weight_g": weight, "purity": "gold_22k", "client_key": str(uuid.uuid4()), **extra},
        format="json",
    )
    assert res.status_code == 201, res.content
    return res.json()["data"]


def _row(owner: Any) -> dict:
    return owner.get(reverse("v1:karigars")).json()["data"]["rows"][0]


def test_gold_given_and_received_back_works_out_the_wastage(jeweller: Any, owner: Any) -> None:
    """The design's figures: 37.400 g given, 36.880 g back = 1.4%, within 1.5%."""
    lot = _issue(owner, _karigar(owner))
    data = owner.get(reverse("v1:karigars")).json()["data"]
    assert data["gold_with_karigars"] == "37.400" and data["rows"][0]["wastage_pct"] is None
    back = owner.post(reverse("v1:karigar-receive", args=[lot["id"]]), {"received_g": "36.880"}, format="json")
    assert back.status_code == 200, back.content
    row = _row(owner)
    assert (row["issued_g"], row["received_g"], row["with_g"], row["wastage_pct"]) == ("37.400", "36.880", "0.000", "1.4")
    assert row["over_limit"] is False


def test_over_the_limit_is_shown_and_never_refused(jeweller: Any, owner: Any) -> None:
    lot = _issue(owner, _karigar(owner), "10.000")
    assert owner.post(reverse("v1:karigar-receive", args=[lot["id"]]), {"received_g": "9.000"}, format="json").status_code == 200
    assert _row(owner)["over_limit"] is True


def test_a_lot_comes_back_once_and_never_heavier(jeweller: Any, owner: Any) -> None:
    lot = _issue(owner, _karigar(owner), "10.000")
    url = reverse("v1:karigar-receive", args=[lot["id"]])
    assert owner.post(url, {"received_g": "10.001"}, format="json").status_code == 400
    assert owner.post(url, {"received_g": "9.900"}, format="json").status_code == 200
    again = owner.post(url, {"received_g": "9.900"}, format="json")
    assert again.status_code == 409 and again.json()["error"]["code"] == "karigar_lot_received"


def test_a_double_tapped_issue_is_one_lot(jeweller: Any, owner: Any) -> None:
    karigar = _karigar(owner)
    body = {"weight_g": "5", "purity": "gold_22k", "client_key": str(uuid.uuid4())}
    url = reverse("v1:karigar-issue", args=[karigar["id"]])
    assert owner.post(url, body, format="json").status_code == 201
    assert owner.post(url, body, format="json").status_code == 200
    assert _row(owner)["issued_g"] == "5.000"


def test_an_order_says_who_has_its_gold(jeweller: Any, owner: Any, make_party: Any) -> None:
    order = owner.post(reverse(URL), _body(make_party()), format="json").json()["data"]
    _issue(owner, _karigar(owner), "18.200", order_id=order["id"])
    row = owner.get(reverse(URL)).json()["data"]["rows"][0]
    assert row["with_karigar"] == {"name": "Raju Soni", "issued_g": "18.200"}


def test_a_shop_that_is_not_a_jeweller_has_no_karigars(owner: Any) -> None:
    assert owner.get(reverse("v1:karigars")).status_code == 404


# ── G3c: receiving makes tags ───────────────────────────────────────────────


TAG = {"purity": "gold_22k", "gross_g": "12.000", "net_g": "12.000", "making_type": "pct", "making_value": "12"}


def _back_lot(owner: Any) -> dict:
    lot = _issue(owner, _karigar(owner), "37.400")
    assert owner.post(reverse("v1:karigar-receive", args=[lot["id"]]), {"received_g": "36.880"}, format="json").status_code == 200
    return lot


def _item(make_item: Any) -> Any:
    return make_item("Gold chain 22K", "0", "GST0", stock=None, tracking="serial")


def test_a_received_lot_makes_tags_in_stock_costed_with_labour(jeweller: Any, owner: Any, make_item: Any) -> None:
    """Metal 12 g × ₹11,650 + labour 12 g × ₹350 = ₹1,44,000 is what the piece cost."""
    from apps.inventory.models import ItemStock

    _rate(owner)
    lot, item = _back_lot(owner), _item(make_item)
    res = owner.post(
        reverse("v1:karigar-make-tag", args=[lot["id"]]),
        {"item_id": str(item.id), "labour_per_g": "350", "tag": {**TAG, "tag_no": "KR-1"}},
        format="json",
    )
    assert res.status_code == 201, res.content
    assert res.json()["data"]["lot"]["tagged_g"] == "12.000"
    assert owner.get(reverse("v1:jewel-tag-lookup"), {"tag": "KR-1"}).status_code == 200
    stock = ItemStock.objects.get(item=item)
    assert stock.on_hand == 1 and stock.avg_cost == Decimal("144000.0000")


def test_gold_not_back_makes_no_tag_and_done_clears_the_lot(jeweller: Any, owner: Any, make_item: Any) -> None:
    lot = _issue(owner, _karigar(owner), "10.000")
    url = reverse("v1:karigar-make-tag", args=[lot["id"]])
    body = {"item_id": str(_item(make_item).id), "tag": {**TAG, "tag_no": "KR-2"}}
    refused = owner.post(url, body, format="json")
    assert refused.status_code == 409 and refused.json()["error"]["code"] == "karigar_lot_not_back"
    owner.post(reverse("v1:karigar-receive", args=[lot["id"]]), {"received_g": "9.900"}, format="json")
    assert len(owner.get(reverse("v1:karigars")).json()["data"]["to_tag"]) == 1
    assert owner.post(reverse("v1:karigar-tags-done", args=[lot["id"]]), {}, format="json").status_code == 200
    assert owner.get(reverse("v1:karigars")).json()["data"]["to_tag"] == []


def test_the_same_tag_no_twice_is_refused_and_counts_once(jeweller: Any, owner: Any, make_item: Any) -> None:
    lot, item = _back_lot(owner), _item(make_item)
    url = reverse("v1:karigar-make-tag", args=[lot["id"]])
    body = {"item_id": str(item.id), "tag": {**TAG, "tag_no": "KR-3"}}
    assert owner.post(url, body, format="json").status_code == 201
    assert owner.post(url, body, format="json").status_code == 400
    assert owner.get(reverse("v1:karigars")).json()["data"]["to_tag"][0]["tag_count"] == 1
