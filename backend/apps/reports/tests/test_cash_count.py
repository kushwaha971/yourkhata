"""BP-17 (R-DEC-26) — a counted Shop drawer is an observation, never a posting.

Each test names the way a count could mislead the owner or move money:

* the expected figure must be the SERVER's, computed when the count is saved,
  never a figure the browser sends (a tile loaded a minute ago is stale);
* recording a count must post nothing — no ledger line, payment or expense;
* it must be append-only, by the database and not only the ORM;
* a retry or double tap must record one count;
* only a reader of the Shop's cash may see or record one, and only their own
  business's.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.db import DatabaseError, transaction

from apps.common.audit import AuditAction
from apps.common.dates import tenant_today
from apps.expenses.tests.test_cashbook import received
from apps.reports.models import CashCount
from tests.factories.parties import PartyFactory

pytestmark = pytest.mark.django_db

URL = "/api/v1/reports/cash-counts"


def count(client: Any, body: dict, key: str | None = None) -> Any:
    return client.post(URL, body, format="json", HTTP_IDEMPOTENCY_KEY=key or str(uuid.uuid4()))


@pytest.fixture
def owner(tenant: Any, api_as: Any) -> Any:
    return api_as(tenant)[0]


@pytest.fixture
def drawer(tenant: Any, owner: Any) -> Decimal:
    """₹1,500 of cash in the Shop's drawer by its records."""
    party = PartyFactory(tenant=tenant, name="Mohan Stores")
    received(owner, party, "1500.00", tenant_today(tenant).isoformat())
    return Decimal("1500.00")


def test_a_count_is_compared_with_the_servers_figure_not_the_browsers(owner, drawer):
    response = count(owner, {"counted_amount": "1450.00", "expected_amount": "99999.00"})
    assert response.status_code == 201, response.json()
    data = response.json()["data"]
    assert data["expected_amount"] == "1500.00"
    assert data["counted_amount"] == "1450.00"
    assert data["variance"] == "-50.00"
    assert data["moved_since"] == "0.00"
    assert data["counted_by"]["id"]


def test_recording_a_count_posts_nothing(tenant, owner, drawer):
    from apps.expenses.models import Expense
    from apps.ledger.models import LedgerEntry
    from apps.payments.models import Payment

    before = (Payment.objects.count(), LedgerEntry.objects.count(), Expense.objects.count())
    assert count(owner, {"counted_amount": "2000.00"}).status_code == 201
    after = (Payment.objects.count(), LedgerEntry.objects.count(), Expense.objects.count())
    assert before == after
    # And the records' figure is what it was: an over count is not money.
    listed = owner.get(URL).json()
    assert listed["meta"]["expected_now"] == "1500.00"


def test_zero_count_and_a_negative_records_figure(tenant, owner):
    """No cash recorded yet is a ₹0 drawer; counting ₹0 is a real answer."""
    response = count(owner, {"counted_amount": "0"})
    assert response.status_code == 201, response.json()
    assert response.json()["data"]["variance"] == "0.00"


@pytest.mark.parametrize(
    "body",
    [
        {"counted_amount": "-1.00"},
        {"counted_amount": "10.005"},
        {"counted_amount": "abc"},
        {},
        {"counted_amount": "10.00", "note": "x" * 201},
    ],
)
def test_refuses_what_is_not_a_count(owner, body):
    assert count(owner, body).status_code == 400
    assert CashCount.objects.count() == 0


def test_a_retry_records_one_count(owner, drawer):
    key = str(uuid.uuid4())
    first = count(owner, {"counted_amount": "1500.00"}, key=key)
    again = count(owner, {"counted_amount": "1500.00"}, key=key)
    assert first.status_code == 201
    assert again.status_code == 201
    assert again["Idempotent-Replayed"] == "true"
    assert CashCount.objects.count() == 1


def test_a_count_is_audited(tenant, owner, drawer):
    from apps.platform_app.models import AuditLog

    data = count(owner, {"counted_amount": "1400.00", "note": "Two notes torn"}).json()["data"]
    row = AuditLog.objects.get(action=AuditAction.CASH_COUNTED)
    assert str(row.entity_id) == data["id"]
    assert row.after["variance"] == "-100.00"
    assert row.after["note"] == "Two notes torn"


def test_counts_are_append_only_in_the_database(owner, drawer):
    count(owner, {"counted_amount": "1500.00"})
    with pytest.raises(DatabaseError), transaction.atomic():
        CashCount.objects.update(counted_amount=Decimal("1.00"))
    with pytest.raises(DatabaseError), transaction.atomic():
        CashCount.objects.all().delete()
    assert CashCount.objects.get().counted_amount == Decimal("1500.00")


def test_history_is_newest_first_and_says_what_moved_since(tenant, owner, drawer):
    count(owner, {"counted_amount": "1500.00"})
    count(owner, {"counted_amount": "1490.00", "note": "Later"})
    party = PartyFactory(tenant=tenant, name="Later Customer")
    received(owner, party, "200.00", tenant_today(tenant).isoformat())
    rows = owner.get(URL).json()["data"]
    assert [row["counted_amount"] for row in rows] == ["1490.00", "1500.00"]
    # The newest count was against ₹1,500; ₹200 has come in since.
    assert rows[0]["moved_since"] == "200.00"
    assert "moved_since" not in rows[1]


def test_home_shows_the_last_count_beside_the_records_figure(tenant, owner, drawer):
    count(owner, {"counted_amount": "1450.00"})
    tiles = owner.get("/api/v1/reports/dashboard").json()["data"]["tiles"]
    last = tiles["shop_cash_in_hand"]["last_count"]
    assert last["counted_amount"] == "1450.00"
    assert last["variance"] == "-50.00"
    assert last["moved_since"] == "0.00"


def test_home_has_no_last_count_until_one_is_recorded(owner, drawer):
    tiles = owner.get("/api/v1/reports/dashboard").json()["data"]["tiles"]
    assert tiles["shop_cash_in_hand"]["last_count"] is None


@pytest.mark.parametrize("role", ["staff"])
def test_staff_without_the_cash_figure_can_neither_see_nor_record(tenant, api_as, drawer, role):
    client, _ = api_as(tenant, role=role)
    assert client.get(URL).status_code == 403
    assert count(client, {"counted_amount": "1.00"}).status_code == 403
    assert CashCount.objects.count() == 0


def test_another_business_sees_none_of_its_counts(tenant, other_tenant, api_as, owner, drawer):
    count(owner, {"counted_amount": "1500.00"})
    stranger, _ = api_as(other_tenant)
    assert stranger.get(URL).json()["data"] == []


def test_a_replay_is_refused_to_a_member_without_the_shop_cash(tenant, api_as, owner, drawer):
    """The book check runs before an idempotent replay could hand back a stored count."""
    key = str(uuid.uuid4())
    assert count(owner, {"counted_amount": "1500.00"}, key=key).status_code == 201
    staff, _ = api_as(tenant, role="staff")
    assert count(staff, {"counted_amount": "1500.00"}, key=key).status_code == 403
