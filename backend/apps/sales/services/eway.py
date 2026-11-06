"""D P5 (first slice) — the e-way bill file for the GST portal (design D10).

Plan §P5: "A JSON export for manual upload to the portal ships first (~1 week,
no provider) so the feature is useful before the integration." The bill keeps
its transport details in `meta.eway` (transporter, vehicle no., distance,
mode), and this builds the portal's bulk-upload JSON ("billLists") from the
issued bill. No portal call is made and nothing about the bill's money or
stock changes.

Offered when goods worth over ₹50,000 go to another state (D10: "E-way bill is
offered on a bill over ₹50,000 going to another state").
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from apps.common.exceptions import BusinessRuleViolation, ValidationFailed

THRESHOLD = Decimal("50000")
MODES = {"road": "1", "rail": "2", "air": "3", "ship": "4"}


def offered(document: Any) -> bool:
    return (
        document.status not in ("draft", "void")
        and Decimal(document.grand_total or 0) > THRESHOLD
        and str(document.place_of_supply_state or "") != str(document.tenant.state_code or "")
    )


def save_transport(document: Any, payload: dict) -> dict:
    errors: dict = {}
    transporter = " ".join(str(payload.get("transporter") or "").split())[:100]
    vehicle = "".join(str(payload.get("vehicle_number") or "").split()).upper()[:15]
    mode = str(payload.get("mode") or "road")
    try:
        distance = int(payload.get("distance_km") or 0)
    except (TypeError, ValueError):
        distance = -1
    if not vehicle:
        errors["vehicle_number"] = ["Enter the vehicle number."]
    if not (0 < distance <= 4000):
        errors["distance_km"] = ["Enter the distance in km (1 to 4000)."]
    if mode not in MODES:
        errors["mode"] = ["Choose road, rail, air or ship."]
    if errors:
        raise ValidationFailed(errors)
    eway = {"transporter": transporter, "vehicle_number": vehicle, "distance_km": distance, "mode": mode}
    document.meta = {**(document.meta or {}), "eway": eway}
    document.save(update_fields=["meta", "updated_at"])
    return eway


def portal_json(document: Any) -> dict:
    if document.status in ("draft", "void"):
        raise BusinessRuleViolation("eway_not_issued", "Issue the bill before making its e-way bill.")
    eway = (document.meta or {}).get("eway")
    if not eway:
        raise ValidationFailed({"vehicle_number": ["Add the transport details first."]})
    tenant = document.tenant
    party = document.party
    addr = tenant.address or {}
    to_addr = (party.billing_address or {}) if party is not None else {}
    lines = list(document.lines.all())
    inter = str(document.place_of_supply_state) != str(tenant.state_code)

    def num(value: Any) -> float:
        return float(Decimal(value or 0))

    bill = {
        "userGstin": tenant.gstin or "",
        "supplyType": "O",
        "subSupplyType": 1,
        "docType": "INV",
        "docNo": document.number or "",
        "docDate": document.document_date.strftime("%d/%m/%Y"),
        "transType": 1,
        "fromGstin": tenant.gstin or "",
        "fromTrdName": tenant.name,
        "fromAddr1": addr.get("line1", ""),
        "fromAddr2": addr.get("line2", ""),
        "fromPlace": addr.get("city", ""),
        "fromPincode": int(addr.get("pincode") or 0),
        "fromStateCode": int(tenant.state_code or 0),
        "actualFromStateCode": int(tenant.state_code or 0),
        "toGstin": (getattr(party, "gstin", None) or "URP") if party is not None else "URP",
        "toTrdName": party.name if party is not None else (document.walk_in_name or ""),
        "toAddr1": to_addr.get("line1", ""),
        "toAddr2": to_addr.get("line2", ""),
        "toPlace": to_addr.get("city", ""),
        "toPincode": int(to_addr.get("pincode") or 0),
        "toStateCode": int(document.place_of_supply_state or 0),
        "actualToStateCode": int(document.place_of_supply_state or 0),
        "totalValue": num(document.taxable_total if hasattr(document, "taxable_total") else 0),
        "cgstValue": num(getattr(document, "cgst_total", 0)),
        "sgstValue": num(getattr(document, "sgst_total", 0)),
        "igstValue": num(getattr(document, "igst_total", 0)),
        "cessValue": num(getattr(document, "cess_total", 0)),
        "totInvValue": num(document.grand_total),
        "transMode": MODES[eway["mode"]],
        "transDistance": str(eway["distance_km"]),
        "transporterName": eway.get("transporter", ""),
        "transporterId": "",
        "transDocNo": "",
        "transDocDate": "",
        "vehicleNo": eway["vehicle_number"],
        "vehicleType": "R",
        "mainHsnCode": int((lines[0].hsn_sac or "0") if lines else 0),
        "itemList": [
            {
                "itemNo": index + 1,
                "productName": line.description[:100],
                "productDesc": line.description[:100],
                "hsnCode": int(line.hsn_sac or 0),
                "quantity": num(line.qty),
                "qtyUnit": line.unit_code,
                "taxableAmount": num(line.taxable_value),
                "sgstRate": 0 if inter else num(line.tax_rate) / 2,
                "cgstRate": 0 if inter else num(line.tax_rate) / 2,
                "igstRate": num(line.tax_rate) if inter else 0,
                "cessRate": num(line.cess_rate),
            }
            for index, line in enumerate(lines)
        ],
    }
    return {"version": "1.0.0621", "billLists": [bill]}
