"""BP-11 regressions: shared codenames must not bypass per-app grants."""

from decimal import Decimal

import pytest
from django.test import override_settings

from apps.payments.models import Payment
from apps.platform_app.models import MembershipAppGrant
from tests.factories.parties import PartyFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def books(tenant, api_as, system_roles):
    modules = list(dict.fromkeys([*tenant.enabled_modules, "khata", "library", "lending", "dues"]))
    tenant.enabled_modules = modules
    tenant.save(update_fields=["enabled_modules"])
    tenant.plan.modules = modules
    tenant.plan.save(update_fields=["modules"])
    tenant.partner.allowed_modules = modules
    tenant.partner.save(update_fields=["allowed_modules"])
    party = PartyFactory(tenant=tenant, balance=Decimal("1234.56"), shop_balance=Decimal("987.65"))

    def client_for(**apps):
        client, member = api_as(tenant, role="admin")
        for app, role in apps.items():
            MembershipAppGrant.objects.create(membership=member, app=app, role=system_roles[role])
        return client, member

    with override_settings(UB_UNRELEASED_MODULES=True):
        yield tenant, party, client_for


@pytest.mark.parametrize("url", ["/ledger/summary", "/ledger/aging", "/ledger-entries"])
def test_khata_grant_cannot_read_shop_ledger(books, url):
    """Previously a khata-only reader could change book=shop."""
    _, party, make = books
    client, _ = make(khata="staff")
    assert client.get(f"/api/v1{url}", {"book": "shop", "party": str(party.id)}).status_code == 403


def test_shop_grant_cannot_read_default_main_statement(books):
    """Omitting book must not bypass a denied main-book grant."""
    _, party, make = books
    client, _ = make(shop="staff")
    assert client.get(f"/api/v1/parties/{party.id}/statement").status_code == 403
    assert client.get("/api/v1/ledger/summary").status_code == 403


def test_contact_identity_does_not_include_other_book_money(books):
    """The contact detail used to serialize the private main balance for Shop staff."""
    _, party, make = books
    client, _ = make(shop="staff")
    response = client.get(f"/api/v1/parties/{party.id}", {"book": "shop"})
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["name"] == party.name
    assert not {"balance", "summary", "credit"} & data.keys()
    assert "shop" in data
    identity = client.get("/api/v1/parties").json()
    assert "balance" not in identity["data"][0]
    assert "receivable" not in identity["meta"]["totals"]


def test_khata_cannot_receive_shop_contact_figures(books):
    """Shared contact-read did not enforce Shop financial projection."""
    _, party, make = books
    client, _ = make(khata="staff")
    response = client.get(f"/api/v1/parties/{party.id}")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["balance"] == "1234.56"
    assert "shop_balance" not in data
    assert client.get("/api/v1/parties", {"book": "shop"}).status_code == 403


def test_one_apps_read_only_role_cannot_borrow_another_apps_write(books):
    """Shop staff used to borrow its write codename for accountant-only Udhaar."""
    _, party, make = books
    client, _ = make(shop="staff", khata="accountant")
    assert (
        client.post(
            "/api/v1/ledger-entries", {"party_id": str(party.id), "amount": "10.00"}, format="json"
        ).status_code
        == 403
    )


def test_payments_scope_lists_totals_and_direct_ids(books):
    """No bucket filter previously returned other apps' receipts under the shared read right."""
    tenant, party, make = books
    client, _ = make(shop="admin")

    def payment(bucket, number):
        return Payment.objects.create(
            tenant=tenant,
            party=party,
            number=number,
            direction="in",
            payment_date="2026-10-18",
            amount="50",
            primary_mode="cash",
            mode_breakup=[{"mode": "cash", "amount": "50.00", "reference": ""}],
            bucket=bucket,
        )

    own = payment("shop", "R-1")
    other = payment("library", "R-2")
    response = client.get("/api/v1/payments")
    assert response.status_code == 200
    assert [p["id"] for p in response.json()["data"]] == [str(own.id)]
    assert client.get(f"/api/v1/payments/{other.id}").status_code == 404
    assert (
        client.post(
            f"/api/v1/payments/{other.id}/void", {"reason": "No access"}, format="json"
        ).status_code
        == 404
    )
    assert client.get("/api/v1/payments", {"bucket": "library"}).status_code == 403


def test_reminder_cannot_quote_other_book(books):
    """The shared reminder right previously allowed a khata user to quote Shop dues."""
    _, party, make = books
    client, _ = make(khata="staff")
    assert (
        client.post(
            "/api/v1/reminders/preview", {"party_id": str(party.id), "book": "shop"}, format="json"
        ).status_code
        == 403
    )


@pytest.mark.parametrize(
    "params",
    [
        {"balance": "owes_me"},
        {"credit": "over_limit"},
        {"collection": "today"},
        {"ordering": "balance"},
        {"format": "csv"},
    ],
)
def test_identity_reader_cannot_infer_private_money_via_filters_or_export(books, params):
    """Omitting financial fields is insufficient when filters still reveal their sign."""
    _, _, make = books
    client, _ = make(shop="staff")
    assert client.get("/api/v1/parties", params).status_code == 403


def test_shop_list_keeps_its_own_balance_after_private_projection(books):
    """Removing the main balance must not erase the selected Shop list amount."""
    _, _, make = books
    client, _ = make(shop="staff")
    response = client.get("/api/v1/parties", {"book": "shop", "type": "customer"})
    assert response.status_code == 200
    assert "balance" in response.json()["data"][0]
    assert "receivable" in response.json()["meta"]["totals"]


def test_wrong_app_payment_write_is_refused_before_validation_or_idempotency(books):
    """The optional bucket is an authorization choice, not only an allocation hint."""
    _, party, make = books
    client, _ = make(shop="admin")
    assert (
        client.post(
            "/api/v1/payments",
            {"bucket": "library", "party_id": str(party.id)},
            format="json",
            HTTP_IDEMPOTENCY_KEY="book-boundary-1",
        ).status_code
        == 403
    )
    assert (
        client.get(
            "/api/v1/payments/open-documents", {"party_id": str(party.id), "bucket": "library"}
        ).status_code
        == 403
    )


def test_denied_or_revoked_app_grant_cannot_use_another_app(books, system_roles):
    """A changed grant must affect the next request, even with an existing token."""
    _, _, make = books
    client, member = make(shop="staff", khata="staff")
    assert client.get("/api/v1/ledger/summary").status_code == 200
    MembershipAppGrant.objects.filter(membership=member, app="khata").delete()
    assert client.get("/api/v1/ledger/summary").status_code == 403


def test_shop_role_cannot_write_another_apps_read_only_grant(books):
    """Library accountant must not borrow Shop admin's shared payment.write."""
    _, party, make = books
    client, _ = make(shop="admin", library="accountant")
    assert (
        client.post(
            "/api/v1/payments", {"bucket": "library", "party_id": str(party.id)}, format="json"
        ).status_code
        == 403
    )


def test_explicitly_empty_grants_never_restore_legacy_access(books):
    """Removing the final app grant previously restored all business-role rights."""
    _, _, make = books
    client, member = make(shop="staff")
    member.app_grants_configured = True
    member.save(update_fields=["app_grants_configured"])
    MembershipAppGrant.objects.filter(membership=member).delete()
    assert client.get("/api/v1/payments").status_code == 403
    assert client.get("/api/v1/parties").status_code == 403


def test_deposit_module_and_receipt_scope_follow_the_same_app(books):
    """A Shop payment reader must not see or move a Library deposit by its id."""
    import uuid

    from apps.common.context import Ctx
    from apps.payments.services.deposits import open_deposit

    tenant, party, make = books
    deposit = open_deposit(
        ctx=Ctx.system(tenant),
        party_id=party.id,
        module="library",
        subject_type="library_membership",
        subject_id=uuid.uuid4(),
        purpose="Deposit",
        expected_amount="50.00",
    )
    shop, _ = make(shop="admin")
    assert shop.get(f"/api/v1/deposits/{deposit.id}").status_code == 404
    assert shop.post(f"/api/v1/deposits/{deposit.id}/receive", {}, format="json").status_code == 404
    assert shop.get("/api/v1/deposits").json()["data"] == []
    library, _ = make(library="accountant")
    assert library.get(f"/api/v1/deposits/{deposit.id}").status_code == 200
    assert (
        library.post(f"/api/v1/deposits/{deposit.id}/receive", {}, format="json").status_code == 403
    )


def test_owner_setting_empty_grants_persists_no_apps(books, system_roles):
    """The management API must persist explicit empty, not merely rely on a UI flag."""
    from apps.common.context import Ctx
    from apps.common.permissions_registry import permissions_for
    from apps.platform_app.apps_registry import accessible_apps
    from apps.platform_app.services.memberships import set_app_grants

    tenant, _, make = books
    client, member = make(shop="staff")
    owner_client, owner = make()
    owner.role = system_roles["owner"]
    owner.save(update_fields=["role"])
    set_app_grants(
        tenant=tenant,
        membership_id=member.id,
        grants=[],
        actor=owner.user,
        ctx=Ctx(tenant=tenant, actor=owner.user),
    )
    member.refresh_from_db()
    assert member.app_grants_configured
    assert accessible_apps(member, permissions_for(member)) == ()
    assert client.get("/api/v1/parties").status_code in (401, 403)


def test_ledger_direct_id_cannot_bypass_book_scope_or_disclose_existence(books):
    """A query book must not authorize a stored entry in another financial book."""
    import uuid

    from apps.ledger.models import LedgerEntry

    tenant, party, make = books
    client, _ = make(shop="admin")
    entry = LedgerEntry.objects.create(
        tenant=tenant,
        party=party,
        entry_date="2026-10-18",
        entry_type="manual_gave",
        direction="debit",
        amount="10.00",
        bucket="main",
    )
    assert client.get(f"/api/v1/ledger-entries/{entry.id}", {"book": "shop"}).status_code == 404
    assert client.get(f"/api/v1/ledger-entries/{uuid.uuid4()}", {"book": "shop"}).status_code == 404
    assert (
        client.post(
            f"/api/v1/ledger-entries/{entry.id}/reverse", {"reason": "Denied"}, format="json"
        ).status_code
        == 404
    )


def test_shop_only_recent_contact_picker_needs_explicit_shop_context(books):
    """The shared frontend picker used an unscoped money-activity sort, yielding 403 for Shop staff."""
    _, _, make = books
    client, _ = make(shop="staff")
    assert client.get("/api/v1/parties", {"ordering": "-last_activity_at"}).status_code == 403
    response = client.get("/api/v1/parties", {"ordering": "-last_activity_at", "book": "shop"})
    assert response.status_code == 200
    assert "summary" not in response.json()["data"][0]


def test_shop_only_staff_keeps_authorized_role_list_money_without_main_money(books):
    """Preserve authorized role-list money while continuing to redact private Udhaar money."""
    from apps.common.dates import tenant_today
    from apps.purchases.models import PurchaseDocument
    from apps.sales.models import SalesDocument

    tenant, party, make = books
    party.is_supplier = True
    party.is_customer = True
    party.save(update_fields=["is_supplier", "is_customer"])
    today = tenant_today(tenant)
    PurchaseDocument.objects.create(
        tenant=tenant,
        party=party,
        kind="purchase_bill",
        status="recorded",
        number="PB-STAFF",
        fy_label="26-27",
        document_date=today,
        grand_total="600",
        amount_due="600",
    )
    SalesDocument.objects.create(
        tenant=tenant,
        party=party,
        kind="invoice",
        status="issued",
        number="INV-STAFF",
        fy_label="26-27",
        document_date=today,
        place_of_supply_state="27",
        grand_total="1000",
        amount_due="1000",
    )
    client, _ = make(shop="staff")
    for kind, expected in [("supplier", "-600.00"), ("customer", "1000.00")]:
        result = client.get("/api/v1/parties", {"book": "shop", "type": kind})
        assert result.status_code == 200
        row = result.json()["data"][0]
        assert row.get("balance") == expected
        assert not {"summary", "credit", "credit_limit"} & row.keys()
    assert (
        "balance" not in client.get(f"/api/v1/parties/{party.id}", {"book": "shop"}).json()["data"]
    )
    assert "balance" not in client.get("/api/v1/parties").json()["data"][0]


def test_same_phone_contact_can_own_another_business_without_cross_access(
    books, other_tenant, api_as
):
    """A Party mobile is not login membership or permission to the other business's records."""
    from tests.factories.platform import UserFactory

    tenant, contact, make = books
    phone = "+919876500321"
    contact.mobile = phone
    contact.save(update_fields=["mobile"])
    other_contact = PartyFactory(tenant=other_tenant, mobile=phone, name="Electrical buyer")
    login = UserFactory(mobile=phone, full_name="Radhe Krishna Enterprises owner")
    owner_elsewhere, _ = api_as(other_tenant, user=login)
    own_rows = owner_elsewhere.get("/api/v1/parties", {"q": phone}).json()["data"]
    assert {row["id"] for row in own_rows} == {str(other_contact.id)}
    assert owner_elsewhere.get(f"/api/v1/parties/{contact.id}").status_code == 404
    assert (
        owner_elsewhere.patch(
            f"/api/v1/parties/{contact.id}", {"name": "Changed"}, format="json"
        ).status_code
        == 404
    )
    shop_staff, _ = make(shop="staff")
    assert (
        shop_staff.get(f"/api/v1/parties/{other_contact.id}", {"book": "shop"}).status_code == 404
    )
    contact.refresh_from_db()
    assert contact.tenant_id == tenant.id and contact.name != "Changed"


def test_notification_list_badge_and_read_actions_share_app_recipient_scope(books):
    """A Shop role must not borrow ledger rights for Udhaar or see targeted Library rows."""
    from apps.notifications.models import Notification
    from apps.notifications.services.notify import notify

    tenant, _, make = books
    client, member = make(shop="admin")
    own = notify(tenant, "low_stock", params={"count": 1})
    khata = notify(tenant, "reminder_due", params={"count": 1})
    library = notify(tenant, "library.overdue_today", user=member.user, params={"count": 1})
    other_client, other_member = make(shop="admin")
    another_user = notify(tenant, "low_stock", user=other_member.user, params={"count": 1})
    rows = client.get("/api/v1/notifications").json()
    assert {row["id"] for row in rows["data"]} == {str(own.id)}
    assert (
        rows["meta"]["unread_count"]
        == client.get("/api/v1/notifications/unread-count").json()["data"]["count"]
        == 1
    )
    for forbidden in [khata, library, another_user]:
        assert client.post(f"/api/v1/notifications/{forbidden.id}/read").status_code == 404
    assert (
        client.post("/api/v1/notifications/read-all", {}, format="json").json()["data"]["marked"]
        == 1
    )
    library.refresh_from_db()
    khata.refresh_from_db()
    assert library.read_at is None and khata.read_by == []
    assert Notification.objects.filter(pk=another_user.id, read_at__isnull=True).exists()


def test_targeted_module_notice_disappears_when_app_grant_is_revoked(books):
    """An addressed notification must not outlive the user's permission to its module."""
    from apps.notifications.services.notify import notify

    tenant, _, make = books
    client, member = make(shop="admin", library="staff")
    member.app_grants_configured = True
    member.save(update_fields=["app_grants_configured"])
    notice = notify(tenant, "library.overdue_today", user=member.user, params={"count": 1})
    assert str(notice.id) in {
        row["id"] for row in client.get("/api/v1/notifications").json()["data"]
    }
    MembershipAppGrant.objects.filter(membership=member, app="library").delete()
    assert client.get("/api/v1/notifications/unread-count").json()["data"]["count"] == 0
    assert client.get("/api/v1/notifications").json()["data"] == []
    assert client.post(f"/api/v1/notifications/{notice.id}/read").status_code == 404


def test_disabled_module_notice_is_hidden_even_with_an_old_grant(books):
    """Turning an app off must hide its previous notifications, including targeted rows."""
    from apps.notifications.services.notify import notify

    tenant, _, make = books
    client, member = make(shop="admin", library="staff")
    notice = notify(tenant, "library.overdue_today", user=member.user, params={"count": 1})
    tenant.enabled_modules = [code for code in tenant.enabled_modules if code != "library"]
    tenant.save(update_fields=["enabled_modules"])
    assert client.get("/api/v1/notifications").json()["data"] == []
    assert client.post(f"/api/v1/notifications/{notice.id}/read").status_code == 404
