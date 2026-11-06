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
