"""D P5 — the e-way bill file for the GST portal (design D10, first slice)."""

from __future__ import annotations

from typing import Any

import pytest

from apps.sales.tests.conftest import invoice_url, issued_invoice, line

pytestmark = pytest.mark.django_db


def test_an_inter_state_bill_over_50000_gets_its_portal_file(
    owner: Any, make_item: Any, make_party: Any
) -> None:
    """Offered over ₹50,000 to another state; the file carries the bill, the
    vehicle and the distance, IGST, and one item per line."""
    tiles = make_item("Floor tile", "800.00", "GST18", stock="200")
    party = make_party(state_code="29", name="Patil Kirana Stores")
    invoice = issued_invoice(owner, party, [line(tiles, "80")])
    assert owner.get(invoice_url(invoice["id"], "eway")).json()["data"]["offered"] is True
    refused = owner.post(invoice_url(invoice["id"], "eway"), {"vehicle_number": ""}, format="json")
    assert refused.status_code == 400
    saved = owner.post(
        invoice_url(invoice["id"], "eway"),
        {"transporter": "Shree Logistics", "vehicle_number": "mh 14 gu 2290", "distance_km": 840, "mode": "road"},
        format="json",
    )
    assert saved.status_code == 200, saved.json()
    bill = owner.get(invoice_url(invoice["id"], "eway")).json()["data"]["file"]["billLists"][0]
    assert (bill["docNo"], bill["vehicleNo"], bill["transDistance"], bill["toStateCode"]) == (
        invoice["number"], "MH14GU2290", "840", 29
    )
    assert bill["igstValue"] > 0 and bill["cgstValue"] == 0
    assert bill["itemList"][0]["quantity"] == 80.0 and bill["itemList"][0]["igstRate"] == 18.0


def test_a_small_local_bill_is_not_offered(owner: Any, make_item: Any, make_party: Any) -> None:
    rice = make_item()
    invoice = issued_invoice(owner, make_party(), [line(rice, "1")])
    assert owner.get(invoice_url(invoice["id"], "eway")).json()["data"]["offered"] is False


def test_an_auto_parts_bill_keeps_the_vehicle_and_mechanic(owner: Any, make_item: Any, make_party: Any) -> None:
    """D1 auto parts "Vehicle no." and "Mechanic", cleaned and read back."""
    from apps.sales.tests.conftest import draft

    made = draft(
        owner,
        party_id=str(make_party().id),
        lines=[line(make_item(), "1")],
        vehicle_number="mh 12 kt 4471",
        mechanic=" Raju  Garage ",
    ).json()["data"]
    assert made["vehicle"] == {"number": "MH12KT4471", "mechanic": "Raju Garage"}
