"""Counter Mode must not mix role/app/tenant money or silently repeat postings."""

import datetime as dt
from decimal import Decimal
from zoneinfo import ZoneInfo
import pytest
from apps.reports.selectors.counter import counter_data, role_lane
from apps.reports.tests import builders as b

pytestmark = pytest.mark.django_db
NOW = dt.datetime(2026, 10, 19, 16, 40, tzinfo=ZoneInfo("Asia/Kolkata"))


def test_lanes_never_net_roles_and_bands_reconcile(tenant):
    """One trader is customer and supplier: keep both debts, not a ₹400 net."""
    who = b.party(tenant, "Radhe Krishna Enterprises", is_customer=True, is_supplier=True)
    sale = b.sale(tenant, NOW.date(), "1000", party=who)
    type(sale).objects.filter(pk=sale.pk).update(due_on=NOW.date() - dt.timedelta(days=42))
    bill = b.purchase(tenant, NOW.date(), "600", party=who)
    type(bill).objects.filter(pk=bill.pk).update(due_on=NOW.date() + dt.timedelta(days=2))
    customer = role_lane(tenant=tenant, today=NOW.date(), supplier=False, can_mobile=False)
    supplier = role_lane(tenant=tenant, today=NOW.date(), supplier=True, can_mobile=False)
    assert customer["total"] == "1000.00" and supplier["total"] == "600.00"
    assert customer["people"][0]["days_late"] == 42
    assert supplier["people"][0]["days_late"] == 0
    assert customer["people"][0]["mobile"] is None
    for lane in [customer, supplier]:
        assert sum(Decimal(band["amount"]) for band in lane["bands"]) == Decimal(lane["total"])


def test_counter_omits_unreadable_sources(tenant):
    assert set(
        counter_data(
            tenant=tenant, granted=frozenset(), modules=frozenset({"sales", "parties"}), now=NOW
        )
    ) == {"as_of"}


def test_counter_endpoint_requires_shop_book(tenant, api_as, system_roles, settings):
    from apps.platform_app.models import MembershipAppGrant

    settings.UB_UNRELEASED_MODULES = True
    client, member = api_as(tenant, role="admin")
    MembershipAppGrant.objects.create(membership=member, app="khata", role=system_roles["admin"])
    assert client.get("/api/v1/reports/dashboard/counter").status_code == 403
    owner, _ = api_as(tenant)
    response = owner.get("/api/v1/reports/dashboard/counter")
    assert response.status_code == 200, response.content
    assert response["Cache-Control"] == "private, no-store"


def test_repeat_sources_are_real_recent_shop_documents_and_never_write(
    tenant, django_assert_num_queries
):
    from apps.reports.selectors.counter import repeat_sources
    from apps.sales.models import SalesDocument

    who = b.party(tenant, "Radhe Krishna Enterprises", is_customer=True, is_supplier=True)
    sale = b.sale(tenant, NOW.date(), "900", party=who)
    b.sale(tenant, NOW.date(), "100", party=who, status="draft")
    b.sale(tenant, NOW.date(), "100", party=who, status="void")
    b.purchase(tenant, NOW.date(), "500", party=who)
    b.expense(tenant, NOW.date(), "60", note="Electrical shop delivery")
    count = SalesDocument.objects.count()
    sources = repeat_sources(
        tenant=tenant,
        today=NOW.date(),
        granted=frozenset({"sales.invoice.read", "purchases.bill.read", "expenses.expense.read"}),
        modules=frozenset({"sales", "purchases", "expenses"}),
    )
    assert {r["kind"] for r in sources} == {"sale", "purchase", "expense"}
    assert next(r for r in sources if r["kind"] == "sale")["id"] == str(sale.id)
    assert next(r for r in sources if r["kind"] == "expense")["expense"]["reference"] == ""
    assert SalesDocument.objects.count() == count


def test_counter_tenant_isolation(tenant):
    from tests.factories.platform import TenantFactory

    other = TenantFactory()
    b.sale(other, NOW.date(), "999999", party=b.party(other))
    data = counter_data(
        tenant=tenant,
        granted=frozenset({"sales.invoice.read", "parties.party.read"}),
        modules=frozenset({"sales", "parties"}),
        now=NOW,
    )
    assert data["customers"]["total"] == "0.00"
