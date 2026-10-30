"""C3 — stock count over HTTP (R-DEC-67): what each owner decision prevents."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.common.constants import RoleCode
from apps.inventory.constants import MovementSource, MovementType
from apps.inventory.models import StockCount, StockMovement
from apps.inventory.services.stock import MovementLine, post_movements
from apps.inventory.tests.conftest import stock_of
from tests.fixtures import build_access_token

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner(api_as: Any, tenant: Any, main: Any, reference: Any) -> Any:
    return api_as(tenant, RoleCode.OWNER.value)[0]


def start(client: Any) -> dict:
    response = client.post(reverse("v1:stock-count-open"), format="json")
    assert response.status_code == 200, response.json()
    return response.json()["data"]


def put(client: Any, count_id: str, item: Any, **body: Any) -> Any:
    url = reverse("v1:stock-count-count", kwargs={"pk": count_id, "item_id": str(item.id)})
    return client.put(url, body, format="json")


def save(client: Any, count_id: str) -> Any:
    return client.post(reverse("v1:stock-count-save", kwargs={"pk": count_id}), format="json")


def sell(ctx: Any, item: Any, qty: str) -> None:
    import datetime as dt

    post_movements(
        ctx=ctx,
        lines=[
            MovementLine(
                item=item,
                qty=-Decimal(qty),
                movement_type=MovementType.SALE_OUT,
                movement_date=dt.date.today(),
                source_type=MovementSource.SALES_DOCUMENT,
            )
        ],
    )


def test_a_count_posts_only_the_differences_as_stock_take(owner: Any, make_item: Any) -> None:
    """S9 — 10 in books, 7 on the shelf → one stocktake_out of 3; a "Same" item
    posts nothing. Prevents a count saving every counted item as a movement."""
    soap = make_item("Soap", opening=("10", "20"))
    salt = make_item("Salt", opening=("5", "10"))
    count = start(owner)
    assert put(owner, count["id"], soap, qty="7").json()["data"]["difference"] == "-3.000"
    put(owner, count["id"], salt, qty="5")
    response = save(owner, count["id"])
    assert response.status_code == 200, response.json()
    assert response.json()["data"]["status"] == "saved"
    moves = list(StockMovement.objects.filter(source_type="stock_count", source_id=count["id"]))
    assert [(m.item_id, m.movement_type, str(m.qty)) for m in moves] == [
        (soap.id, "stocktake_out", "-3.000")
    ]
    assert stock_of(soap)[0] == Decimal("7.000")
    assert stock_of(salt)[0] == Decimal("5.000")


def test_a_sale_after_counting_is_not_a_shortage(owner: Any, ctx: Any, make_item: Any) -> None:
    """R-DEC-67 #2 — counted 10 at 4:15 (books 10), sold 1 at 4:20: the count
    must save NO difference and leave the books at 9, not report a missing soap."""
    soap = make_item("Soap", opening=("10", "20"))
    count = start(owner)
    put(owner, count["id"], soap, qty="10")
    sell(ctx, soap, "1")
    assert save(owner, count["id"]).status_code == 200
    assert not StockMovement.objects.filter(source_type="stock_count").exists()
    assert stock_of(soap)[0] == Decimal("9.000")


def test_stock_found_comes_in_at_the_average_cost(owner: Any, make_item: Any) -> None:
    """Found goods are not a purchase: they come in at the average, so the
    average does not move. Prevents a count inventing a new cost."""
    rice = make_item("Rice", opening=("4", "50"))
    count = start(owner)
    put(owner, count["id"], rice, qty="6")
    save(owner, count["id"])
    on_hand, avg = stock_of(rice)
    assert (on_hand, avg) == (Decimal("6.000"), Decimal("50.0000"))
    move = StockMovement.objects.get(source_type="stock_count")
    assert move.movement_type == "stocktake_in" and str(move.qty) == "2.000"


def test_scans_add_and_a_second_phone_joins_the_same_count(
    owner: Any, api_as: Any, tenant: Any, make_item: Any
) -> None:
    """R-DEC-67 #1 — one open count per shop; a scan is +1 and two phones'
    scans both land. Prevents two counts of one shop or a lost scan."""
    soap = make_item("Soap", opening=("10", "20"))
    first = start(owner)
    other_phone = api_as(tenant, RoleCode.OWNER.value)[0]
    assert start(other_phone)["id"] == first["id"]
    put(owner, first["id"], soap, add=1)
    put(other_phone, first["id"], soap, add=1)
    data = put(owner, first["id"], soap, add=1).json()["data"]
    assert data["counted_qty"] == "3.000"
    assert data["summary"]["counted"] == 1 and data["summary"]["differ"] == 1


def test_saving_twice_posts_once(owner: Any, make_item: Any) -> None:
    """A double tap on Save: the second is refused and moves nothing."""
    soap = make_item("Soap", opening=("10", "20"))
    count = start(owner)
    put(owner, count["id"], soap, qty="8")
    assert save(owner, count["id"]).status_code == 200
    again = save(owner, count["id"])
    assert again.status_code == 409 and again.json()["error"]["code"] == "count_saved"
    assert StockMovement.objects.filter(source_type="stock_count").count() == 1
    assert put(owner, count["id"], soap, qty="1").status_code == 409


def test_more_than_a_hundred_differences_save_in_one_go(owner: Any, make_item: Any) -> None:
    """R-DEC-67 #3 — the stock adjustment's 100-line cap does not apply."""
    items = [make_item(f"Item {n}", opening=("5", "1")) for n in range(105)]
    count = start(owner)
    for item in items:
        put(owner, count["id"], item, qty="4")
    assert save(owner, count["id"]).status_code == 200
    assert StockMovement.objects.filter(source_type="stock_count").count() == 105


def test_staff_count_but_cannot_save_or_see_value(
    owner: Any, api_as: Any, tenant: Any, make_item: Any
) -> None:
    """R-DEC-67 #4 — staff may count; saving needs inventory.stock.adjust; the
    ₹ value change is left out (not zeroed) without the cost right."""
    soap = make_item("Soap", opening=("10", "20"))
    staff, member = api_as(tenant, RoleCode.STAFF.value)
    count = start(staff)
    assert "value_change" not in count
    data = put(staff, count["id"], soap, qty="9").json()["data"]
    assert "value_change" not in data["summary"]
    rows = staff.get(reverse("v1:stock-count-lines", kwargs={"pk": count["id"]})).json()["data"]
    assert rows and all("value_change" not in row for row in rows)
    assert save(staff, count["id"]).status_code == 403
    assert start(owner)["value_change"] == "-20.00"
    member.permissions_override = {"allow": ["inventory.stock.adjust"]}
    member.permissions_version += 1
    member.save()
    granted = APIClient()
    granted.credentials(HTTP_AUTHORIZATION=f"Bearer {build_access_token(member)}")
    assert save(granted, count["id"]).status_code == 200


def test_a_service_is_not_counted(owner: Any, make_item: Any) -> None:
    """A service keeps no stock, so the count refuses it and says why."""
    service = make_item("Repair", item_type="service")
    count = start(owner)
    refused = put(owner, count["id"], service, qty="1")
    assert refused.status_code == 400
    assert refused.json()["error"]["code"] == "track_stock_not_allowed"
    assert StockCount.objects.filter(status="open").count() == 1


def test_an_unknown_item_id_is_not_found(owner: Any) -> None:
    """Canon §0.11 rule 2 — an id from nowhere (or another shop) is a 404."""
    count = start(owner)
    url = reverse(
        "v1:stock-count-count",
        kwargs={"pk": count["id"], "item_id": "01a18dba-0000-7000-8000-000000000000"},
    )
    assert owner.put(url, {"qty": "1"}, format="json").status_code == 404


def test_lines_put_what_was_just_counted_first(owner: Any, make_item: Any) -> None:
    """The phone list shows the item just scanned at the top, then the rest."""
    for name in ("Apple", "Banana", "Cherry"):
        make_item(name, opening=("1", "1"))
    cherry = make_item("Date", opening=("2", "1"))
    count = start(owner)
    put(owner, count["id"], cherry, qty="2")
    rows = owner.get(reverse("v1:stock-count-lines", kwargs={"pk": count["id"]})).json()["data"]
    assert rows[0]["name"] == "Date" and rows[0]["difference"] == "0.000"
    assert [row["name"] for row in rows[1:4]] == ["Apple", "Banana", "Cherry"]
    assert rows[1]["counted_qty"] is None
