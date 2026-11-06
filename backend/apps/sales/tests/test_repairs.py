"""G5 — a mobile shop's repair jobs: the job card, its advance, its stages and its bill."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.urls import reverse

from apps.payments.models import Payment

pytestmark = pytest.mark.django_db
URL = "v1:repairs"


@pytest.fixture
def mobile(shop: Any) -> Any:
    from apps.platform_app.models import TenantSetting

    TenantSetting.objects.update_or_create(
        tenant=shop, key="shop.features.serials", defaults={"value": {"value": True}}
    )
    return shop


def _body(**extra: Any) -> dict:
    return {
        "phone_model": "Redmi Note 12",
        "imei": "8642 1190 2231 905",
        "fault": "Screen cracked, touch not working",
        "came_with": ["phone", "back_cover", "not-a-thing"],
        "estimate": "2400",
        "ready_by": "2099-10-31",
        "client_key": str(uuid.uuid4()),
        **extra,
    }


def _advance_of(job: dict) -> Payment | None:
    return Payment.objects.filter(meta__job_number=job["number"]).first()


def test_a_shop_that_keeps_no_imei_has_no_repairs(owner: Any) -> None:
    assert owner.get(reverse(URL)).status_code == 404


def test_a_walk_in_leaves_a_phone_with_a_mobile_and_no_advance(mobile: Any, owner: Any) -> None:
    """Design "Walk-in · 99230 18764": the job needs a number to call, not a saved customer."""
    made = owner.post(reverse(URL), _body(walk_in_mobile="+91 99230 18764"), format="json")
    assert made.status_code == 201, made.json()
    job = made.json()["data"]
    assert (job["number"], job["walk_in_mobile"], job["status"]) == ("JOB-0001", "9923018764", "open")
    assert job["came_with"] == ["phone", "back_cover"]
    assert job["imei"] == "864211902231905"


def test_an_advance_needs_a_saved_customer_and_is_a_held_receipt(mobile: Any, owner: Any, make_party: Any) -> None:
    """The advance is real money in the shop book, earmarked so no other bill
    takes it; a walk-in cannot leave one because a payment belongs to someone."""
    refused = owner.post(reverse(URL), _body(walk_in_mobile="9923018764", advance="500"), format="json")
    assert refused.status_code == 400 and "advance" in refused.json()["error"]["details"]

    party = make_party()
    job = owner.post(reverse(URL), _body(party_id=str(party.id), advance="500"), format="json").json()["data"]
    payment = _advance_of(job)
    assert payment is not None and payment.amount == Decimal("500.00")
    assert (payment.meta or {}).get("earmark", {}).get("subject_id") == job["id"]
    party.refresh_from_db()
    assert party.shop_balance == Decimal("-500.00")


def test_a_double_tapped_save_is_one_job_and_one_receipt(mobile: Any, owner: Any, make_party: Any) -> None:
    body = _body(party_id=str(make_party().id), advance="500")
    first = owner.post(reverse(URL), body, format="json")
    second = owner.post(reverse(URL), body, format="json")
    assert (first.status_code, second.status_code) == (201, 200)
    assert first.json()["data"]["id"] == second.json()["data"]["id"]
    assert Payment.objects.filter(amount=Decimal("500.00")).count() == 1


def test_stages_move_and_cancelling_frees_the_advance(mobile: Any, owner: Any, make_party: Any) -> None:
    from apps.payments.selectors.payments import open_advances

    party = make_party()
    job = owner.post(reverse(URL), _body(party_id=str(party.id), advance="500"), format="json").json()["data"]
    stage = reverse("v1:repair-stage", args=[job["id"]])
    assert owner.post(stage, {"status": "waiting"}, format="json").json()["data"]["status"] == "waiting"
    assert owner.post(stage, {"status": "delivered"}, format="json").status_code == 409  # only a bill delivers
    assert owner.get(reverse(URL), {"stage": "waiting"}).json()["meta"]["counts"]["waiting"] == 1
    assert not open_advances(tenant=mobile, party_id=party.id).exists()
    assert owner.post(stage, {"status": "cancelled"}, format="json").status_code == 200
    assert open_advances(tenant=mobile, party_id=party.id).count() == 1


def test_a_bill_delivers_the_repair_and_applies_its_advance(
    mobile: Any, owner: Any, make_party: Any, make_item: Any
) -> None:
    """₹500 advance, a ₹2,400 repair charge and a ₹600 part: the bill is ₹3,000,
    ₹2,500 is due, the part leaves stock, and the job names its bill."""
    from apps.inventory.models import ItemStock
    from apps.sales.tests.conftest import draft, issue, line

    party = make_party()
    job = owner.post(reverse(URL), _body(party_id=str(party.id), advance="500"), format="json").json()["data"]
    part = make_item("Display Redmi Note 12", "600.00", "GST0", stock="5")
    charge = make_item("Repair charge", "2400.00", "GST0", stock=None, item_type="service", track_stock=False, hsn_sac="998719")
    made = draft(
        owner,
        party_id=str(party.id),
        lines=[line(charge, "1"), line(part, "1")],
        repair_job_id=job["id"],
    ).json()["data"]
    assert made["repair_job"]["number"] == job["number"]
    done = issue(owner, made["id"], version=made["version"])
    assert done.status_code == 200, done.content
    data = done.json()["data"]
    assert Decimal(data["grand_total"]) == Decimal("3000.00")
    assert Decimal(data["amount_paid"]) == Decimal("500.00")
    assert Decimal(data["amount_due"]) == Decimal("2500.00")
    after = owner.get(reverse("v1:repair-detail", args=[job["id"]])).json()["data"]
    assert (after["status"], after["invoice_id"]) == ("delivered", made["id"])
    assert _advance_of(job).unallocated_amount == 0
    assert sum(s.on_hand for s in ItemStock.objects.filter(item_id=part.id)) == Decimal("4")


def test_another_customers_bill_cannot_deliver_the_repair(
    mobile: Any, owner: Any, make_party: Any, make_item: Any
) -> None:
    from apps.sales.tests.conftest import draft, issue, line

    job = owner.post(reverse(URL), _body(party_id=str(make_party().id), advance="500"), format="json").json()["data"]
    other = make_party(name="Someone Else")
    charge = make_item("Repair charge", "2400.00", "GST0", stock=None, item_type="service", track_stock=False, hsn_sac="998719")
    made = draft(owner, party_id=str(other.id), lines=[line(charge, "1")], repair_job_id=job["id"]).json()["data"]
    refused = issue(owner, made["id"], version=made["version"])
    assert refused.status_code == 409
