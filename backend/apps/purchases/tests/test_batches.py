"""D P4 — medicine batches: bought with expiry, sold earliest-expiry first."""

from __future__ import annotations

import datetime as dt
from decimal import Decimal
from typing import Any

import pytest
from django.urls import reverse

from apps.inventory.models import Batch
from apps.purchases.tests.conftest import line, recorded_bill

pytestmark = pytest.mark.django_db


def test_purchases_fill_batches_and_a_sale_takes_the_earliest_first(
    owner: Any, make_item: Any, make_supplier: Any, shop: Any
) -> None:
    """D6 / D7 and FEFO: two batches bought; a sale of 12 takes all 10 of the
    one expiring first and 2 of the next; an expired batch is never sold; the
    expiry list shows what is near."""
    from apps.common.dates import tenant_today
    from apps.sales.tests.conftest import draft as sale_draft
    from apps.sales.tests.conftest import issue as sale_issue
    from tests.factories.parties import PartyFactory

    today = tenant_today(shop)
    dolo = make_item("Dolo 650", "24.00", "GST0", tracking="batch")
    supplier = make_supplier()
    for number, days, qty in (("OLD1", -5, "4"), ("NEAR", 20, "10"), ("LATE", 300, "30")):
        recorded_bill(
            owner,
            party_id=str(supplier.id),
            lines=[
                line(
                    dolo,
                    qty,
                    "24.00",
                    batches=[{"batch_no": number, "expiry": (today + dt.timedelta(days=days)).isoformat(), "mrp": "32"}],
                )
            ],
        )
    assert {b.batch_no: b.qty for b in Batch.objects.all()} == {
        "OLD1": Decimal("4.000"), "NEAR": Decimal("10.000"), "LATE": Decimal("30.000")
    }
    party = PartyFactory(tenant=shop, name="Ramesh", state_code="27")
    made = sale_draft(owner, party_id=str(party.id), lines=[{"item_id": str(dolo.id), "qty": "12", "unit_price": "32"}]).json()["data"]
    issued = sale_issue(owner, made["id"], version=made["version"])
    assert issued.status_code == 200, issued.json()
    taken = issued.json()["data"]["lines"][0]["batches"]
    assert [(t["batch_no"], t["qty"]) for t in taken] == [("NEAR", "10.000"), ("LATE", "2.000")]
    assert {b.batch_no: b.qty for b in Batch.objects.all()}["OLD1"] == Decimal("4.000")
    near = owner.get(reverse("v1:stock-expiry") + "?within=30").json()
    assert near["meta"]["counts"]["expired"] == 1
    assert [r["batch_no"] for r in near["data"]] == []  # NEAR is used up
    expired = owner.get(reverse("v1:stock-expiry") + "?within=expired").json()["data"]
    assert [(r["batch_no"], r["qty"]) for r in expired] == [("OLD1", "4.000")]


def test_a_batch_purchase_needs_its_number_and_expiry(owner: Any, make_item: Any, make_supplier: Any) -> None:
    from apps.purchases.tests.conftest import draft, record

    dolo = make_item("Dolo 650", "24.00", "GST0", tracking="batch")
    made = draft(owner, party_id=str(make_supplier().id), lines=[line(dolo, "5", "24.00")]).json()["data"]
    refused = record(owner, made["id"], version=made["version"])
    assert refused.status_code == 400
    assert {"lines.0.batch_no", "lines.0.expiry"} <= set(refused.json()["error"]["details"])


def test_an_expiring_batch_names_the_bill_it_came_in_on(
    owner: Any, make_item: Any, make_supplier: Any, shop: Any
) -> None:
    """D7 "Return to distributor": the expiry row carries the recorded purchase
    bill the batch was bought on, so the return opens THAT bill's debit note."""
    from apps.common.dates import tenant_today

    today = tenant_today(shop)
    dolo = make_item("Dolo 650", "24.00", "GST0", tracking="batch")
    bill = recorded_bill(
        owner,
        party_id=str(make_supplier().id),
        lines=[line(dolo, "6", "24.00", batches=[{"batch_no": "DL1", "expiry": (today + dt.timedelta(days=10)).isoformat()}])],
    )
    row = owner.get(reverse("v1:stock-expiry") + "?within=30").json()["data"][0]
    assert row["batch_no"] == "DL1" and row["purchase_id"] == bill["id"]
