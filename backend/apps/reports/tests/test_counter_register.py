"""Home register metadata is a Shop read, never another app's document facts."""

import datetime as dt
from decimal import Decimal
from uuid import uuid4

import pytest

from apps.reports.selectors.dashboard import document_tiles, recent_activity
from apps.reports.selectors.dashboard_charts import _Span, sales_series
from apps.reports.tests import builders as b

pytestmark = pytest.mark.django_db
TODAY = dt.date(2026, 10, 20)


def sources(tenant):
    who = b.party(tenant, "Radhe Krishna Enterprises", is_customer=True)
    shop = b.sale(tenant, TODAY, "100", party=who)
    vertical = b.sale(
        tenant,
        TODAY,
        "900",
        party=who,
        origin_module="library",
        origin_type="membership",
        origin_id=uuid4(),
    )
    return shop, vertical


def test_shop_register_excludes_another_apps_sales_document(tenant):
    """Defect: the Shop feed exposed an origin-app invoice as an ordinary Shop bill."""
    shop, vertical = sources(tenant)
    ids = {row["source"]["id"] for row in recent_activity(tenant=tenant)}
    assert str(shop.id) in ids
    assert str(vertical.id) not in ids


def test_shop_billed_and_graph_exclude_origin_app_sales(tenant):
    """Defect: Library-origin billing inflated the Shop billed tile and its sales graph."""
    sources(tenant)
    assert document_tiles(tenant=tenant, today=TODAY)["today_sales"]["amount"] == "100.00"
    assert sales_series(_Span(tenant, TODAY, TODAY, "day")) == [Decimal("100.00")]


def test_non_shop_app_grant_cannot_read_shop_home(tenant, api_as, system_roles, settings):
    """Defect: a shared reports capability must not authorize another app's Home."""
    from apps.platform_app.models import MembershipAppGrant

    settings.UB_UNRELEASED_MODULES = True
    client, member = api_as(tenant, role="admin")
    MembershipAppGrant.objects.create(membership=member, app="khata", role=system_roles["admin"])
    assert client.get("/api/v1/reports/dashboard").status_code == 403
    assert client.get("/api/v1/reports/dashboard/charts").status_code == 403


def add_line(document, no, qty="1"):
    from apps.sales.models import SalesDocumentLine

    return SalesDocumentLine.objects.create(
        document=document,
        line_no=no,
        description="Electrical circuit breaker",
        qty=Decimal(qty),
        unit_code="NOS",
        tax_code="GST0",
    )


def test_register_counts_lines_not_quantity_and_reads_current_state(
    tenant, django_assert_num_queries
):
    """The item label counts bill lines; a payment/cancel must not leave an old paid badge."""
    from apps.reports.selectors.counter_documents import document_facts, parse_document_refs

    shop, vertical = sources(tenant)
    add_line(shop, 1, "10")
    add_line(shop, 2, "2.5")
    type(shop).objects.filter(pk=shop.pk).update(due_on=TODAY - dt.timedelta(days=1))
    refs = parse_document_refs(f"sales_document:{shop.pk},sales_document:{vertical.pk}")
    args = dict(
        tenant=tenant,
        refs=refs,
        granted=frozenset({"sales.invoice.read"}),
        modules=frozenset({"sales"}),
        today=TODAY,
    )
    with django_assert_num_queries(1):
        facts = document_facts(**args)
    key = f"sales_document:{shop.pk}"
    assert facts == {
        key: {"kind": "invoice", "status": "overdue", "amount_due": "100.00", "item_count": 2}
    }
    type(shop).objects.filter(pk=shop.pk).update(status="paid", amount_due=0, amount_paid=100)
    assert document_facts(**args)[key]["status"] == "paid"
    type(shop).objects.filter(pk=shop.pk).update(status="void")
    assert document_facts(**args)[key]["status"] == "void"


def test_register_metadata_omits_foreign_tenant_and_denied_sources(
    tenant, django_assert_num_queries
):
    """Guessed IDs and another source grant must never reveal status or even a count."""
    from apps.reports.selectors.counter_documents import document_facts, parse_document_refs
    from tests.factories.platform import TenantFactory

    who = b.party(tenant, "Radhe Krishna Enterprises", is_customer=True, is_supplier=True)
    sale = b.sale(tenant, TODAY, "100", party=who)
    purchase = b.purchase(tenant, TODAY, "80", party=who)
    foreign = b.sale(TenantFactory(), TODAY, "999999")
    refs = parse_document_refs(
        f"sales_document:{sale.pk},purchase_document:{purchase.pk},sales_document:{foreign.pk}"
    )
    with django_assert_num_queries(1):
        facts = document_facts(
            tenant=tenant,
            refs=refs,
            granted=frozenset({"sales.invoice.read"}),
            modules=frozenset({"sales", "purchases"}),
            today=TODAY,
        )
    assert set(facts) == {f"sales_document:{sale.pk}"}
    with django_assert_num_queries(0):
        assert not document_facts(
            tenant=tenant,
            refs=refs,
            granted=frozenset(),
            modules=frozenset({"sales", "purchases"}),
            today=TODAY,
        )


def test_register_metadata_is_bounded_and_additive(tenant, api_as):
    """Reject malformed/unbounded IDs and keep the pre-existing no-parameter response shape."""
    client, _ = api_as(tenant)
    shop, vertical = sources(tenant)
    add_line(shop, 1)
    endpoint = "/api/v1/reports/dashboard/counter"
    assert "documents" not in client.get(endpoint).json()["data"]
    refs = f"sales_document:{shop.pk},sales_document:{vertical.pk}"
    response = client.get(endpoint, {"documents": refs})
    assert response.status_code == 200
    assert response["Cache-Control"] == "private, no-store"
    assert set(response.json()["data"]["documents"]) == {f"sales_document:{shop.pk}"}
    assert response.json()["data"]["documents"][f"sales_document:{shop.pk}"]["item_count"] == 1
    for bad in [
        "sales_document:no-uuid",
        f"payment:{shop.pk}",
        ",".join([f"sales_document:{shop.pk}"] * 11),
    ]:
        assert client.get(endpoint, {"documents": bad}).status_code == 400


def test_shop_all_time_range_does_not_start_from_another_books_payment(tenant):
    """Defect: an old personal receipt disclosed its date and stretched the Shop graph."""
    from apps.reports.selectors.dashboard_charts import window

    b.payment(tenant, dt.date(2001, 1, 1), {"cash": "999"}, bucket="main")
    assert window("all", TODAY, tenant=tenant) == (TODAY, TODAY)
