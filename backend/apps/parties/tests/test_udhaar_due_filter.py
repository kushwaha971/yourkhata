"""BP-20 / R-DEC-35: Due is both signs, filtered before server paging."""
from decimal import Decimal
from typing import Any
import pytest
from django.urls import reverse
from tests.factories.parties import PartyFactory

pytestmark = pytest.mark.django_db
LIST = "v1:party-list"

def test_due_has_both_sides_including_one_paisa_and_never_shop_money(tenant:Any,api_as:Any)->None:
    """Defect: no nonzero main-book predicate could produce an honest Due page/count."""
    client,_=api_as(tenant)
    for name,balance,shop in [("Radhe Krishna Enterprises", "500.00","0.00"),("Switch supplier", "-200.00","0.00"),("One paisa", "0.01","0.00"),("Settled LED bill", "0.00","900.00")]:
        PartyFactory(tenant=tenant,name=name,balance=Decimal(balance),shop_balance=Decimal(shop))
    PartyFactory(name="Other business",balance=Decimal("9000.00"))
    PartyFactory(tenant=tenant,name="Hidden",balance=Decimal("700.00"),status="archived")
    response=client.get(reverse(LIST),{"balance":"due","status":"active","page_size":1,"ordering":"name"})
    assert response.status_code==200,response.json()
    body=response.json();assert len(body["data"])==1
    assert body["meta"]["total"]==3
    assert body["meta"]["totals"]["receivable"]=="500.01"
    assert body["meta"]["totals"]["payable"]=="200.00"
    names=[]
    for page in [1,2,3]:
        result=client.get(reverse(LIST),{"balance":"due","page_size":1,"page":page,"ordering":"name"}).json()
        names.extend(row["name"] for row in result["data"])
    assert set(names)=={"Radhe Krishna Enterprises","Switch supplier","One paisa"}

def test_due_respects_search_and_hidden_status(tenant:Any,api_as:Any)->None:
    """Default excludes hidden; explicit status still uses the same scoped nonzero predicate."""
    client,_=api_as(tenant)
    PartyFactory(tenant=tenant,name="Radhe LED active",balance=Decimal("1.00"))
    PartyFactory(tenant=tenant,name="Radhe LED hidden",balance=Decimal("-2.00"),status="archived")
    result=client.get(reverse(LIST),{"balance":"due","status":"archived","q":"Radhe LED"})
    assert result.status_code==200,result.json()
    assert [r["name"] for r in result.json()["data"]]==["Radhe LED hidden"]
    assert result.json()["meta"]["totals"]["payable"]=="2.00"

def test_due_is_not_a_new_shop_filter(tenant:Any,api_as:Any)->None:
    """The approval is for Udhaar only; keep the previously rejected Shop value rejected."""
    client,_=api_as(tenant)
    assert client.get(reverse(LIST),{"balance":"due","book":"shop"}).status_code==400
