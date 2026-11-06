"""G4 — a Schedule H medicine's prescription kept with the bill (design D1 medical)."""

from __future__ import annotations

from typing import Any

import pytest

from apps.sales.tests.conftest import draft

pytestmark = pytest.mark.django_db


def test_the_doctor_and_patient_ride_with_the_bill_and_clear_when_blank(
    owner: Any, make_item: Any
) -> None:
    """The Schedule H register reads meta.rx; a cleared field must not leave
    yesterday's doctor on today's bill."""
    item = make_item("Azithral 500", "119.00", "GST5", stock="10")
    body = {
        "lines": [{"item_id": str(item.id), "qty": "1"}],
        "rx_doctor": "  Dr. S.  Kulkarni ",
        "rx_patient": "Meena Jadhav",
    }
    made = draft(owner, **body)
    assert made.status_code == 201, made.json()
    assert made.json()["data"]["rx"] == {"doctor": "Dr. S. Kulkarni", "patient": "Meena Jadhav"}
    doc_id = made.json()["data"]["id"]
    from django.urls import reverse

    url = reverse("v1:sales-invoice-detail", args=[doc_id])
    version = made.json()["data"]["version"]
    cleared = owner.patch(url, {"rx_doctor": "", "rx_patient": "", "version": version}, format="json")
    assert cleared.status_code == 200, cleared.json()
    assert cleared.json()["data"]["rx"] is None


def test_the_schedule_h_register_lists_scheduled_sales_with_their_prescription(
    owner: Any, make_item: Any, shop: Any
) -> None:
    """The register lists every issued sale of a scheduled medicine, with or
    without a doctor written, and nothing else; a kirana is told it is not theirs."""
    import datetime as dt

    from django.urls import reverse

    from apps.inventory.models import Item
    from apps.platform_app.models import TenantSetting
    from apps.sales.tests.conftest import cash, issue

    url = reverse("v1:schedule-h-register")
    today = dt.date.today().isoformat()
    assert owner.get(url, {"date_from": today, "date_to": today}).status_code == 404
    TenantSetting.objects.update_or_create(
        tenant=shop, key="shop.features.batches", defaults={"value": {"value": True}}
    )
    azithral = make_item("Azithral 500", "119.00", "GST5", stock="10")
    Item.objects.filter(pk=azithral.id).update(schedule="H")
    soap = make_item("Lifebuoy", "40.00", "GST18", stock="10")
    with_rx = draft(owner, lines=[{"item_id": str(azithral.id), "qty": "1"}], rx_doctor="Dr. S. Kulkarni", rx_patient="Meena Jadhav").json()["data"]
    without = draft(owner, lines=[{"item_id": str(azithral.id), "qty": "2"}]).json()["data"]
    plain = draft(owner, lines=[{"item_id": str(soap.id), "qty": "1"}]).json()["data"]
    for doc in (with_rx, without, plain):
        # A quick sale is paid at the counter in full.
        issued = issue(owner, doc["id"], version=doc["version"], payment=cash(doc["grand_total"]))
        assert issued.status_code == 200, issued.json()

    body = owner.get(url, {"date_from": today, "date_to": today}).json()
    assert body["meta"]["counts"] == {"bills": 2, "without_doctor": 1}
    doctors = sorted((row["doctor"] or "") for row in body["data"])
    assert doctors == ["", "Dr. S. Kulkarni"]
    assert all(row["medicines"][0]["schedule"] == "H" for row in body["data"])
