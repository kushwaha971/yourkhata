"""Real API flow: shared products never make supplier/customer money interchangeable."""

from decimal import Decimal

import pytest
from django.urls import reverse

from apps.inventory.models import ItemStock
from apps.parties.selectors.shop import shop_party_facts
from apps.purchases.tests.conftest import bill_url, line, recorded_bill
from apps.sales.tests.conftest import invoice_url, issued_invoice
from tests.factories.parties import PartyFactory

pytestmark = pytest.mark.django_db


def test_two_suppliers_and_two_customers_share_products_with_independent_prices(
    owner, shop, make_item, make_supplier
):
    """Guard the merchant's many-to-many flow: independent bill prices, WAC stock and role balances."""
    shop.name = "Radhe Krishna Enterprises"
    shop.save(update_fields=["name"])
    bulb, switch = make_item("LED bulb", "40.00"), make_item("Electrical switch", "80.00")
    suppliers = [make_supplier(name="Supplier A"), make_supplier(name="Supplier B")]
    purchases = []
    for supplier, bulb_cost, switch_cost in zip(suppliers, ["40", "42"], ["80", "84"], strict=True):
        purchases.append(
            recorded_bill(
                owner,
                party_id=str(supplier.id),
                lines=[line(bulb, "10", bulb_cost), line(switch, "10", switch_cost)],
            )
        )
    assert ItemStock.objects.get(item=bulb).avg_cost == Decimal("41.0000")
    assert ItemStock.objects.get(item=switch).avg_cost == Decimal("82.0000")
    first = owner.get(bill_url(purchases[0]["id"])).json()["data"]
    assert [Decimal(row["unit_cost"]) for row in first["lines"]] == [Decimal("40"), Decimal("80")]
    customers = [
        PartyFactory(tenant=shop, name=name, is_customer=True, is_supplier=False, state_code="27")
        for name in ["Customer X", "Customer Y"]
    ]
    bulb.refresh_from_db()
    defaults = (bulb.purchase_price, bulb.selling_price)
    sales = []
    for customer, qty, bulb_price, switch_price in zip(
        customers, ["2", "3"], ["50", "48"], ["100", "96"], strict=True
    ):
        sales.append(
            issued_invoice(
                owner,
                customer,
                [
                    dict(item_id=str(bulb.id), qty=qty, unit_price=bulb_price),
                    dict(item_id=str(switch.id), qty=qty, unit_price=switch_price),
                ],
            )
        )
    first_sale = owner.get(invoice_url(sales[0]["id"])).json()["data"]
    second_sale = owner.get(invoice_url(sales[1]["id"])).json()["data"]
    assert [Decimal(row["unit_price"]) for row in first_sale["lines"]] == [
        Decimal("50"),
        Decimal("100"),
    ]
    assert [Decimal(row["unit_price"]) for row in second_sale["lines"]] == [
        Decimal("48"),
        Decimal("96"),
    ]
    bulb.refresh_from_db()
    assert (bulb.purchase_price, bulb.selling_price) == defaults
    assert ItemStock.objects.get(item=bulb).on_hand == Decimal("15")
    assert ItemStock.objects.get(item=switch).on_hand == Decimal("15")
    assert ItemStock.objects.get(item=bulb).avg_cost == Decimal("41.0000")
    for supplier, bill in zip(suppliers, purchases, strict=True):
        facts = shop_party_facts(tenant=shop, party_id=supplier.id)
        assert facts.shop_supplier_balance == Decimal(bill["grand_total"])
        assert facts.shop_customer_balance == 0
    for customer, invoice in zip(customers, sales, strict=True):
        facts = shop_party_facts(tenant=shop, party_id=customer.id)
        assert facts.shop_customer_balance == Decimal(invoice["grand_total"])
        assert facts.shop_supplier_balance == 0
    for kind, people in [("supplier", suppliers), ("customer", customers)]:
        response = owner.get(reverse("v1:party-list"), {"book": "shop", "type": kind})
        assert response.status_code == 200
        assert {row["id"] for row in response.json()["data"]} == {
            str(person.id) for person in people
        }
