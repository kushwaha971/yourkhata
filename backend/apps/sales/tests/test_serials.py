"""D P3 — a phone's IMEI: bought once, sold once, back on a return."""

from __future__ import annotations

from typing import Any

import pytest
from django.urls import reverse

from apps.inventory.models import Serial
from apps.sales.tests.conftest import CREDIT_NOTES, draft, issue, issue_note, line

pytestmark = pytest.mark.django_db


@pytest.fixture
def phone(make_item: Any, shop: Any) -> Any:
    """Redmi 13C, tracked by IMEI, 12 months warranty, two in stock (bought)."""
    from apps.common.context import Ctx
    from apps.inventory.services.serials import receive
    from apps.inventory.services.stock import MovementLine, post_movements

    item = make_item("Redmi 13C", "9999.00", "GST18", stock=None, tracking="serial", warranty_months=12)
    import datetime as dt

    from apps.common.dates import tenant_today

    post_movements(
        ctx=Ctx.system(shop),
        lines=[
            MovementLine(
                item=item, qty=2, movement_type="purchase_in", movement_date=tenant_today(shop) - dt.timedelta(days=1),
                source_type="purchase_document", unit_cost=8000,
            )
        ],
    )

    class Doc:
        id = None

    receive(ctx=Ctx.system(shop), document=Doc(), rows=[{"item": item, "serials": ["IMEI111", "IMEI222"]}])
    return item


def test_a_phone_is_sold_once_and_its_warranty_starts(owner: Any, phone: Any, make_party: Any) -> None:
    party = make_party()
    made = draft(owner, party_id=str(party.id), lines=[line(phone, "1", serials=["imei111"])]).json()["data"]
    response = issue(owner, made["id"], version=made["version"])
    assert response.status_code == 200, response.json()
    sold = Serial.objects.get(serial="IMEI111")
    assert sold.status == "sold" and sold.warranty_until is not None
    found = owner.get(reverse("v1:serial-detail", args=["IMEI111"])).json()["data"]
    assert found["status"] == "sold" and found["item"]["name"] == "Redmi 13C"
    # The same phone on a second bill is refused.
    again = draft(owner, party_id=str(party.id), lines=[line(phone, "1", serials=["IMEI111"])]).json()["data"]
    refused = issue(owner, again["id"], version=again["version"])
    assert refused.status_code == 409 and refused.json()["error"]["code"] == "serial_not_in_stock"


def test_a_bill_needs_one_imei_per_phone(owner: Any, phone: Any, make_party: Any) -> None:
    made = draft(owner, party_id=str(make_party().id), lines=[line(phone, "2", serials=["IMEI111"])]).json()["data"]
    refused = issue(owner, made["id"], version=made["version"])
    assert refused.status_code == 400
    assert "lines.0.serials" in refused.json()["error"]["details"]


def test_a_return_puts_the_phone_back_in_stock(owner: Any, phone: Any, make_party: Any) -> None:
    made = draft(owner, party_id=str(make_party().id), lines=[line(phone, "1", serials=["IMEI222"])]).json()["data"]
    invoice = issue(owner, made["id"], version=made["version"]).json()["data"]
    created = owner.post(
        reverse(CREDIT_NOTES),
        {"against_id": invoice["id"], "reason": "sales_return", "lines": [{"against_line_id": invoice["lines"][0]["id"], "qty": "1"}]},
        format="json",
    ).json()["data"]
    assert issue_note(owner, created["id"]).status_code == 200
    assert Serial.objects.get(serial="IMEI222").status == "in_stock"
