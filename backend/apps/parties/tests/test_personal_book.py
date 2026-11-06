"""Personal Udhaar never exposes business contacts or another user's book."""

from uuid import uuid4
import pytest
from tests.factories.parties import PartyFactory
from tests.factories.platform import TenantFactory

pytestmark = pytest.mark.django_db
ROOT = "/api/v1/personal/"


def create(client, name="Ravi", mobile="9876543210"):
    return client.post(
        ROOT + "parties",
        {"name": name, "mobile": mobile},
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )


def test_business_contacts_are_not_personal_people(tenant, api_as):
    """Defect: Shop customers/suppliers leaked into the personal people list."""
    client, _ = api_as(tenant)
    PartyFactory(tenant=tenant, name="Radhe Krishna Enterprises")
    response = client.get(ROOT + "parties")
    assert response.status_code == 200
    assert response.json()["data"] == []
    saved = create(client)
    assert saved.status_code == 201, saved.content
    assert [r["name"] for r in client.get(ROOT + "parties").json()["data"]] == ["Ravi"]
    assert [r["name"] for r in client.get("/api/v1/parties?book=shop").json()["data"]] == [
        "Radhe Krishna Enterprises"
    ]


def test_owner_and_staff_have_independent_books_even_with_same_phone(tenant, api_as):
    """Defect: business membership does not grant access to personal money."""
    owner, _ = api_as(tenant)
    staff, _ = api_as(tenant, role="staff")
    first = create(owner)
    second = create(staff)
    assert first.status_code == second.status_code == 201
    foreign = first.json()["data"]["id"]
    own = second.json()["data"]["id"]
    assert foreign != own
    for suffix in ("", "/ledger-entries", "/statement"):
        assert staff.get(ROOT + f"parties/{foreign}" + suffix).status_code == 404
    denied = staff.post(
        ROOT + f"parties/{foreign}/ledger-entries",
        {
            "direction": "debit",
            "amount": "500.00",
            "entry_date": "2026-10-25",
            "note": "",
            "simple": True,
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )
    assert denied.status_code == 404
    assert owner.get("/api/v1/parties/" + own).status_code == 404


def test_personal_book_follows_user_across_businesses(tenant, api_as):
    """Defect: switching businesses must not replace a user's personal book."""
    client, member = api_as(tenant)
    assert create(client).status_code == 201
    other, _ = api_as(TenantFactory(), user=member.user)
    assert [r["name"] for r in other.get(ROOT + "parties").json()["data"]] == ["Ravi"]


def test_personal_namespace_cannot_reach_shop_or_other_books(tenant, api_as):
    """Private storage must never become a business impersonation door."""
    client, _ = api_as(tenant)
    assert client.get(ROOT + "sales/invoices").status_code == 404
    assert client.get(ROOT + "parties?book=shop").status_code == 403


def test_personal_entries_keep_existing_money_rules_and_retry_safety(tenant, api_as):
    """New scope keeps atomic balances, optional notes and retry keys."""
    client, member = api_as(tenant, role="staff")
    party = create(client).json()["data"]["id"]
    url = ROOT + f"parties/{party}/ledger-entries"
    key = str(uuid4())
    payload = {
        "direction": "debit",
        "amount": "500.00",
        "entry_date": "2026-10-25",
        "note": "",
        "simple": True,
    }
    first = client.post(url, payload, format="json", HTTP_IDEMPOTENCY_KEY=key)
    assert first.status_code == 201, first.content
    assert client.post(url, payload, format="json", HTTP_IDEMPOTENCY_KEY=key).status_code == 201
    payload.update(direction="credit", amount="200.00")
    receipt = client.post(url, payload, format="json", HTTP_IDEMPOTENCY_KEY=str(uuid4()))
    assert receipt.status_code == 201, receipt.content
    detail = client.get(ROOT + f"parties/{party}").json()["data"]
    assert detail["balance"] == "300.00"
    preview = client.post(ROOT + "reminders/preview", {"party_id": party}, format="json")
    assert preview.status_code == 200, preview.content
    foreign, _ = api_as(tenant)
    assert (
        foreign.post(ROOT + "reminders/preview", {"party_id": party}, format="json").status_code
        == 404
    )


def test_private_scope_is_not_a_switchable_business(tenant, api_as):
    """No persisted membership means a business token cannot enter private storage."""
    from apps.parties.models import PersonalBook
    from apps.platform_app.models import Membership

    client, member = api_as(tenant)
    assert create(client).status_code == 201
    book = PersonalBook.objects.get(owner=member.user)
    assert not Membership.objects.filter(tenant=book.tenant).exists()
    assert client.post(
        "/api/v1/auth/switch-tenant", {"tenant_id": str(book.tenant_id)}, format="json"
    ).status_code in (403, 404)
