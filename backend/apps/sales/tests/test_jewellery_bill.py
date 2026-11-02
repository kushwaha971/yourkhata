"""G2b — a jeweller's bill: a scanned tag priced by its weight at the day's rate."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

import pytest
from django.urls import reverse

from apps.inventory.models import Serial
from apps.sales.tests.conftest import draft, issue, line

pytestmark = pytest.mark.django_db

CHAIN = {
    "tag_no": "GC-1042",
    "purity": "gold_22k",
    "gross_g": "12.900",
    "stone_g": "0.560",
    "net_g": "12.340",
    "making_type": "pct",
    "making_value": "12",
    "wastage_pct": "0",
    "huid": "7K2P9X",
}


@pytest.fixture
def jeweller(shop: Any) -> Any:
    shop.business_type = "jewellery"
    shop.save(update_fields=["business_type"])
    return shop


@pytest.fixture
def chain(jeweller: Any, owner: Any, make_item: Any) -> Any:
    item = make_item("Gold chain 22K", "0", "GST3", stock=None, tracking="serial")
    assert owner.post(reverse("v1:item-tags", args=[item.id]), CHAIN, format="json").status_code == 201
    return item


def _rate(owner: Any, gold_22k: str = "11650") -> None:
    res = owner.put(reverse("v1:metal-rate-today"), {"gold_22k": gold_22k}, format="json")
    assert res.status_code in (200, 201), res.content


def test_the_design_example_prices_to_the_paisa(chain: Any) -> None:
    """D2: 12.340 g × ₹11,650 = ₹1,43,761.00; making 12% = ₹17,251.32; total
    ₹1,61,012.32. Each part is rounded, and the parts add up to the total."""
    from apps.inventory.services.tags import price_piece

    parts = price_piece(
        net_g=Decimal("12.340"), rate=Decimal("11650"), making_type="pct",
        making_value=Decimal("12"), wastage_pct=Decimal("0"), stone_charge=Decimal("0"),
    )
    assert parts == {
        "metal": Decimal("143761.00"), "making": Decimal("17251.32"), "wastage": Decimal("0.00"),
        "stone": Decimal("0.00"), "total": Decimal("161012.32"),
    }
    per_gram = price_piece(
        net_g=Decimal("3.850"), rate=Decimal("11650"), making_type="per_g",
        making_value=Decimal("850"), wastage_pct=Decimal("0"), stone_charge=Decimal("4500"),
    )
    assert per_gram["making"] == Decimal("3272.50") and per_gram["total"] == Decimal("52625.00")


def test_a_scanned_tag_comes_back_priced_at_todays_rate(owner: Any, chain: Any) -> None:
    _rate(owner)
    found = owner.get(reverse("v1:jewel-tag-lookup"), {"tag": "gc-1042"}).json()["data"]
    assert found["item_id"] == str(chain.id)
    assert found["jewel"]["rate"] == "11650.00" and found["jewel"]["total"] == "161012.32"
    assert owner.get(reverse("v1:jewel-tag-lookup"), {"tag": "NOPE"}).status_code == 404


def test_the_bill_prices_the_line_and_keeps_its_rate(owner: Any, chain: Any, make_party: Any) -> None:
    """The client's price is ignored: the server's is the snapshot's total, GST
    3% added on top. A rate changed after the bill does not move it."""
    _rate(owner)
    body = line(chain, "1", serials=["GC-1042"], jewel={}, unit_price="1")
    made = draft(owner, party_id=str(make_party().id), lines=[body]).json()["data"]
    row = made["lines"][0]
    assert Decimal(row["unit_price"]) == Decimal("161012.32")
    assert Decimal(row["taxable_value"]) == Decimal("161012.32")
    assert row["jewel"]["rate"] == "11650.00" and row["jewel"]["huid"] == "7K2P9X"
    assert issue(owner, made["id"], version=made["version"]).status_code == 200
    _rate(owner, "12000")
    again = owner.get(reverse("v1:sales-invoice-detail", args=[made["id"]])).json()["data"]
    assert again["lines"][0]["jewel"]["rate"] == "11650.00"
    assert Serial.objects.get(serial="GC-1042").status == "sold"
    assert owner.get(reverse("v1:jewel-tag-lookup"), {"tag": "GC-1042"}).status_code == 404


def test_the_counter_may_change_the_line_but_never_the_tag(owner: Any, chain: Any, make_party: Any) -> None:
    _rate(owner)
    body = line(chain, "1", serials=["GC-1042"], jewel={"rate": "11000", "making_type": "per_g", "making_value": "800"})
    row = draft(owner, party_id=str(make_party().id), lines=[body]).json()["data"]["lines"][0]
    # 12.340 × 11,000 = 1,35,740.00; 12.340 × 800 = 9,872.00.
    assert Decimal(row["unit_price"]) == Decimal("145612.00")
    tag = owner.get(reverse("v1:item-tags", args=[chain.id])).json()["data"][0]
    assert tag["making_type"] == "pct" and tag["making_value"] == "12.00"


def test_no_rate_today_is_said_under_the_line(owner: Any, chain: Any, make_party: Any) -> None:
    body = line(chain, "1", serials=["GC-1042"], jewel={})
    made = draft(owner, party_id=str(make_party().id), lines=[body])
    assert made.status_code == 400, made.content
    assert made.json()["error"]["details"]["lines.0.jewel.rate"] == ["Set today's rate first."]


# ── G2c: old gold taken in ──────────────────────────────────────────────────

OLD = {"weight_g": "8.200", "purity": "gold_22k", "less_pct": "2"}


def test_old_gold_is_priced_as_the_design_shows(owner: Any, chain: Any, make_party: Any) -> None:
    """pOldGold: 8.200 g × ₹11,650 = ₹95,530.00; less 2% = ₹1,910.60; value ₹93,619.40."""
    _rate(owner)
    body = line(chain, "1", serials=["GC-1042"], jewel={})
    made = draft(owner, party_id=str(make_party().id), lines=[body], old_gold=OLD).json()["data"]
    assert made["old_gold"] == {
        "weight_g": "8.200", "purity": "gold_22k", "rate": "11650.00", "less_pct": "2.00",
        "gross": "95530.00", "less": "1910.60", "value": "93619.40",
    }


def test_old_gold_comes_off_a_party_bill_without_touching_the_cash(owner: Any, chain: Any, make_party: Any) -> None:
    """The bill keeps its full value (GST on all of it); the old gold settles its
    part as no money moved, so the cashbook never counts it; the rest is due."""
    from apps.inventory.models import OldGold
    from apps.payments.models import Payment

    _rate(owner)
    party = make_party()
    made = draft(owner, party_id=str(party.id), lines=[line(chain, "1", serials=["GC-1042"], jewel={})], old_gold=OLD).json()["data"]
    issued = issue(owner, made["id"], version=made["version"]).json()["data"]
    total = Decimal(issued["grand_total"])
    assert Decimal(issued["amount_paid"]) == Decimal("93619.40")
    assert Decimal(issued["amount_due"]) == total - Decimal("93619.40")
    row = OldGold.objects.get(document_id=made["id"])
    assert (row.weight_g, row.purity, row.value) == (Decimal("8.200"), "gold_22k", Decimal("93619.40"))
    assert Payment.objects.get(pk=row.payment_id).primary_mode == "adjustment"


def test_a_quick_sale_pays_the_rest_after_old_gold(owner: Any, chain: Any) -> None:
    _rate(owner)
    made = draft(owner, lines=[line(chain, "1", serials=["GC-1042"], jewel={})], old_gold=OLD).json()["data"]
    total = Decimal(made["grand_total"])
    rest = f"{total - Decimal('93619.40'):.2f}"
    full = issue(owner, made["id"], version=made["version"], payment={"mode_breakup": [{"mode": "cash", "amount": made["grand_total"]}]})
    assert full.status_code == 400  # the whole bill in cash would be paid twice
    paid = issue(owner, made["id"], version=made["version"], payment={"mode_breakup": [{"mode": "upi", "amount": rest}]})
    assert paid.status_code == 200, paid.content
    assert paid.json()["data"]["status"] == "paid"


def test_old_gold_worth_more_than_the_bill_is_refused(owner: Any, chain: Any, make_party: Any) -> None:
    _rate(owner)
    big = {"weight_g": "30.000", "purity": "gold_22k", "less_pct": "0"}
    made = draft(owner, party_id=str(make_party().id), lines=[line(chain, "1", serials=["GC-1042"], jewel={})], old_gold=big).json()["data"]
    refused = issue(owner, made["id"], version=made["version"])
    assert refused.status_code == 409 and refused.json()["error"]["code"] == "old_gold_over_bill"


def test_a_voided_quick_sale_hands_the_old_gold_back(owner: Any, chain: Any) -> None:
    """Its receipts are voided over the counter, so its old gold leaves the old-gold stock."""
    from apps.inventory.models import OldGold
    from apps.sales.tests.conftest import invoice_url

    _rate(owner)
    made = draft(owner, lines=[line(chain, "1", serials=["GC-1042"], jewel={})], old_gold=OLD).json()["data"]
    rest = f"{Decimal(made['grand_total']) - Decimal('93619.40'):.2f}"
    issue(owner, made["id"], version=made["version"], payment={"mode_breakup": [{"mode": "cash", "amount": rest}]})
    assert OldGold.objects.filter(document_id=made["id"]).exists()
    voided = owner.post(invoice_url(made["id"], "void"), {"reason": "Wrong piece"}, format="json")
    assert voided.status_code == 200, voided.content
    assert not OldGold.objects.filter(document_id=made["id"]).exists()


# ── G2d: PAN at ₹2 lakh, and the cash limit ─────────────────────────────────


def _big_bill(owner: Any, chain: Any, **extra: Any) -> dict:
    """GC-1042 at ₹11,650/g with 12% making is ₹1,61,012.32; at ₹15,000/g it is
    12.340 × 15,000 × 1.12 = ₹2,07,312 — over ₹2 lakh."""
    _rate(owner, "15000")
    return draft(owner, lines=[line(chain, "1", serials=["GC-1042"], jewel={})], **extra).json()["data"]


def test_a_bill_of_two_lakh_needs_the_pan(owner: Any, chain: Any) -> None:
    made = _big_bill(owner, chain)
    rest = {"mode_breakup": [{"mode": "upi", "amount": made["grand_total"]}]}
    refused = issue(owner, made["id"], version=made["version"], payment=rest)
    assert refused.status_code == 400
    assert refused.json()["error"]["details"]["pan"] == ["PAN is needed because the bill is ₹2 lakh or more."]


def test_a_wrong_pan_is_said_under_the_box(owner: Any, chain: Any) -> None:
    res = draft(owner, lines=[line(chain, "1", serials=["GC-1042"], jewel={})], pan="ABC123")
    assert res.status_code == 400 and "pan" in res.json()["error"]["details"]


def test_with_its_pan_the_bill_issues_and_keeps_it(owner: Any, chain: Any) -> None:
    made = _big_bill(owner, chain, pan="abcpk1234l")
    assert made["pan"] == "ABCPK1234L"
    paid = issue(owner, made["id"], version=made["version"], payment={"mode_breakup": [{"mode": "upi", "amount": made["grand_total"]}]})
    assert paid.status_code == 200, paid.content
    assert paid.json()["data"]["pan"] == "ABCPK1234L"


def test_two_lakh_in_cash_on_one_bill_is_refused(owner: Any, chain: Any) -> None:
    """s.269ST: ₹1,99,999 cash is taken; ₹2,00,000 is not, and the rest goes by UPI."""
    made = _big_bill(owner, chain, pan="ABCPK1234L")
    total = Decimal(made["grand_total"])
    over = {"mode_breakup": [{"mode": "cash", "amount": "200000.00"}, {"mode": "upi", "amount": f"{total - 200000:.2f}"}]}
    refused = issue(owner, made["id"], version=made["version"], payment=over)
    assert refused.status_code == 400 and "payment" in refused.json()["error"]["details"]
    under = {"mode_breakup": [{"mode": "cash", "amount": "199999.00"}, {"mode": "upi", "amount": f"{total - 199999:.2f}"}]}
    assert issue(owner, made["id"], version=made["version"], payment=under).status_code == 200


def test_a_shop_that_is_not_a_jeweller_is_not_asked(owner: Any, make_item: Any) -> None:
    """The limits are drawn for the jeweller only (BP-22)."""
    big = make_item("Tractor part", "250000.00", "GST0", stock="1")
    made = draft(owner, lines=[line(big, "1")]).json()["data"]
    assert issue(owner, made["id"], version=made["version"], payment={"mode_breakup": [{"mode": "cash", "amount": made["grand_total"]}]}).status_code == 200
