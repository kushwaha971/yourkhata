"""BP-16 (R-DEC-26) — Shop promises: what somebody said they would pay, and when.

Each test names a way a promise could mislead the shopkeeper or reach the
wrong person:

* a promise must move no money and change no bill, due date or balance;
* it belongs to the Shop and to ONE role: a person who is both customer and
  supplier holds one of each, and the Udhaar book's collection date is untouched;
* one open promise per contact and role, even when two arrive at once;
* an edit made against an old screen is refused, not silently applied;
* late is computed on the business's clock, and Home's row carries the
  contact's CURRENT Shop balance;
* only a Shop reader sees promises, only a Shop writer changes them, and only
  within their own business; a retry records one promise.
"""

from __future__ import annotations

import datetime as dt
import uuid
from decimal import Decimal
from typing import Any

import pytest

from apps.common.audit import AuditAction
from apps.common.dates import tenant_today
from apps.parties.models import Party, ShopPromise
from tests.factories.parties import PartyFactory

pytestmark = pytest.mark.django_db


def _post(client: Any, url: str, body: dict, key: str | None = None, method: str = "post") -> Any:
    return getattr(client, method)(
        url, body, format="json", HTTP_IDEMPOTENCY_KEY=key or str(uuid.uuid4())
    )


def promises_url(party: Party) -> str:
    return f"/api/v1/parties/{party.id}/shop-promises"


def promise_url(pid: str, action: str = "") -> str:
    return f"/api/v1/parties/shop-promises/{pid}{'/' + action if action else ''}"


@pytest.fixture
def owner(tenant: Any, api_as: Any) -> Any:
    return api_as(tenant)[0]


@pytest.fixture
def both(tenant: Any) -> Party:
    """Sharma buys from the shop and also supplies it."""
    return PartyFactory(
        tenant=tenant, name="Sharma General Store", is_customer=True, is_supplier=True
    )


def add(client: Any, party: Party, role: str = "customer", days: int = 0, **extra: Any) -> Any:
    today = tenant_today(party.tenant)
    body = {"role": role, "promised_on": (today + dt.timedelta(days=days)).isoformat(), **extra}
    return _post(client, promises_url(party), body)


def test_a_promise_moves_no_money_and_leaves_the_udhaar_date_alone(tenant, owner, both):
    from apps.ledger.models import LedgerEntry
    from apps.payments.models import Payment

    before = (Payment.objects.count(), LedgerEntry.objects.count())
    response = add(owner, both, amount="1500.00", note="After the market")
    assert response.status_code == 201, response.json()
    data = response.json()["data"]
    assert data["amount"] == "1500.00"
    assert data["state"] == "open"
    assert data["days_late"] == 0
    assert (Payment.objects.count(), LedgerEntry.objects.count()) == before
    both.refresh_from_db()
    assert both.collection_date is None
    assert both.shop_balance == Decimal("0.00")


def test_a_person_in_both_roles_holds_one_promise_per_role(owner, both):
    assert add(owner, both, "customer", amount="1500.00").status_code == 201
    assert add(owner, both, "supplier", days=3, amount="4200.00").status_code == 201
    customer = owner.get(promises_url(both), {"role": "customer"}).json()["data"]
    supplier = owner.get(promises_url(both), {"role": "supplier"}).json()["data"]
    assert [row["amount"] for row in customer] == ["1500.00"]
    assert [row["amount"] for row in supplier] == ["4200.00"]


def test_a_role_the_contact_does_not_have_is_refused(tenant, owner):
    customer_only = PartyFactory(tenant=tenant, is_customer=True, is_supplier=False)
    response = add(owner, customer_only, "supplier")
    assert response.status_code == 400
    assert "role" in response.json()["error"]["details"]


def test_one_open_promise_per_contact_and_role(owner, both):
    assert add(owner, both).status_code == 201
    again = add(owner, both, days=2)
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "promise_already_open"
    assert ShopPromise.objects.filter(state="open").count() == 1


def test_a_past_date_is_refused_but_today_and_later_are_fine(owner, both):
    assert add(owner, both, days=-1).status_code == 400
    assert add(owner, both, days=0).status_code == 201


def test_a_retry_records_one_promise(owner, both):
    key = str(uuid.uuid4())
    body = {"role": "customer", "promised_on": tenant_today(both.tenant).isoformat()}
    first = _post(owner, promises_url(both), body, key=key)
    again = _post(owner, promises_url(both), body, key=key)
    assert first.status_code == again.status_code == 201
    assert again["Idempotent-Replayed"] == "true"
    assert ShopPromise.objects.count() == 1


def test_a_change_needs_the_current_version(owner, both):
    created = add(owner, both, amount="1500.00").json()["data"]
    later = (tenant_today(both.tenant) + dt.timedelta(days=4)).isoformat()
    changed = _post(
        owner,
        promise_url(created["id"]),
        {"version": 1, "promised_on": later, "amount": "1000.00"},
        method="patch",
    )
    assert changed.status_code == 200, changed.json()
    assert changed.json()["data"]["version"] == 2
    assert changed.json()["data"]["promised_on"] == later
    # A second screen, loaded before that change, tries to clear the amount.
    stale = _post(owner, promise_url(created["id"]), {"version": 1, "amount": None}, method="patch")
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "stale_version"
    assert ShopPromise.objects.get().amount == Decimal("1000.00")


def test_kept_and_cancelled_close_it_and_keep_it_as_history(owner, both):
    first = add(owner, both, amount="1500.00").json()["data"]
    kept = _post(owner, promise_url(first["id"], "kept"), {"version": 1})
    assert kept.status_code == 200
    assert kept.json()["data"]["state"] == "kept"
    assert kept.json()["data"]["closed_at"] is not None
    # Closed is closed: no change, and a second close is refused.
    again = _post(owner, promise_url(first["id"], "cancel"), {"version": 2})
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "promise_closed"
    # A new one can now be added, and the page lists open first, then history.
    second = add(owner, both, days=2).json()["data"]
    _post(owner, promise_url(second["id"], "cancel"), {"version": 1})
    third = add(owner, both, days=5).json()["data"]
    rows = owner.get(promises_url(both), {"role": "customer"}).json()["data"]
    assert [row["id"] for row in rows] == [third["id"], second["id"], first["id"]]
    assert [row["state"] for row in rows] == ["open", "cancelled", "kept"]


def test_every_change_is_audited_with_before_and_after(owner, both):
    from apps.platform_app.models import AuditLog

    created = add(owner, both, amount="1500.00").json()["data"]
    _post(owner, promise_url(created["id"]), {"version": 1, "amount": "900.00"}, method="patch")
    _post(owner, promise_url(created["id"], "kept"), {"version": 2})
    actions = list(
        AuditLog.objects.filter(entity_id=created["id"])
        .order_by("created_at")
        .values_list("action", flat=True)
    )
    assert actions == [
        AuditAction.SHOP_PROMISE_CREATED,
        AuditAction.SHOP_PROMISE_CHANGED,
        AuditAction.SHOP_PROMISE_KEPT,
    ]
    change = AuditLog.objects.get(action=AuditAction.SHOP_PROMISE_CHANGED)
    assert change.before["amount"] == "1500.00"
    assert change.after["amount"] == "900.00"


def test_home_lists_open_promises_due_by_the_date_with_the_current_balance(tenant, owner, both):
    from apps.parties.tests.test_shop_counter_facts import sale

    sale(tenant, both, amount="3100.00", days=42)  # Sharma owes the Shop ₹3,100
    other = PartyFactory(tenant=tenant, name="Lakshmi Provisions", is_customer=True)
    add(owner, both, "customer", amount="1500.00")
    add(owner, other, "customer", days=3)
    add(owner, both, "supplier", days=20)
    rows = owner.get("/api/v1/parties/shop-promises").json()["data"]
    # A week ahead by default: the supplier promise 20 days out is not due yet.
    assert [(row["party"]["name"], row["role"]) for row in rows] == [
        ("Sharma General Store", "customer"),
        ("Lakshmi Provisions", "customer"),
    ]
    # Today's balance in that role, not a figure remembered from the promise.
    assert rows[0]["balance"] == "3100.00"
    assert rows[0]["days_overdue"] == 42
    assert "mobile" in rows[0]["party"]
    wider = owner.get("/api/v1/parties/shop-promises", {"until": "2099-01-01"}).json()
    assert len(wider["data"]) == 3  # capped at 31 days ahead, which covers 20


def test_a_promise_is_late_by_the_businesss_clock(tenant, owner, both):
    created = add(owner, both).json()["data"]
    ShopPromise.objects.filter(pk=created["id"]).update(
        promised_on=tenant_today(tenant) - dt.timedelta(days=3)
    )
    rows = owner.get("/api/v1/parties/shop-promises").json()["data"]
    assert rows[0]["days_late"] == 3


def test_an_archived_contact_takes_no_new_promise(tenant, owner):
    archived = PartyFactory(tenant=tenant, status="archived")
    response = add(owner, archived)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "party_archived"


def test_a_reader_may_see_but_not_write(tenant, api_as, owner, both):
    created = add(owner, both).json()["data"]
    accountant, _ = api_as(tenant, role="accountant")
    assert accountant.get(promises_url(both)).status_code == 200
    assert accountant.get("/api/v1/parties/shop-promises").status_code == 200
    assert add(accountant, both, "supplier").status_code == 403
    assert _post(accountant, promise_url(created["id"], "kept"), {"version": 1}).status_code == 403


def test_counter_staff_may_take_a_promise(tenant, api_as, both):
    staff, _ = api_as(tenant, role="staff")
    assert add(staff, both).status_code == 201


def test_a_member_without_contacts_sees_nothing(tenant, api_as, owner, both):
    add(owner, both)
    client, member = api_as(tenant, role="staff")
    member.permissions_override = {"deny": ["parties.party.read", "parties.party.write"]}
    member.save(update_fields=["permissions_override"])
    assert client.get("/api/v1/parties/shop-promises").status_code == 403
    assert client.get(promises_url(both)).status_code == 403


def test_another_business_sees_none_and_cannot_touch_one(tenant, other_tenant, api_as, owner, both):
    created = add(owner, both).json()["data"]
    stranger, _ = api_as(other_tenant)
    assert stranger.get("/api/v1/parties/shop-promises").json()["data"] == []
    assert stranger.get(promises_url(both)).status_code == 404
    assert _post(stranger, promise_url(created["id"], "kept"), {"version": 1}).status_code == 404
    assert ShopPromise.objects.get().state == "open"
