"""R-DEC-18 access audit: a queued export keeps the book access it was made with.

A file is prepared in the background and downloaded later from the
`export_ready` notification (7 days). The download checked only the merged
export codename, so a member whose Udhaar grant was revoked in between could
still take a file of main-book balances.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from django.test import override_settings

from apps.platform_app.models import MembershipAppGrant
from apps.reports.models import Export
from tests.factories.parties import PartyFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def setup(tenant, api_as, system_roles, monkeypatch):
    import apps.common.exports as exports

    monkeypatch.setattr(exports, "SYNC_MAX_ROWS", 1)
    modules = list(dict.fromkeys([*tenant.enabled_modules, "khata", "parties", "ledger"]))
    tenant.enabled_modules = modules
    tenant.save(update_fields=["enabled_modules"])
    tenant.plan.modules = modules
    tenant.plan.save(update_fields=["modules"])
    tenant.partner.allowed_modules = modules
    tenant.partner.save(update_fields=["allowed_modules"])
    for n in range(2):
        PartyFactory(
            tenant=tenant, name=f"Radhe Krishna Enterprises {n}", balance=Decimal("4321.00")
        )
    client, member = api_as(tenant, role="admin")
    for app in ("khata", "shop"):
        MembershipAppGrant.objects.create(membership=member, app=app, role=system_roles["admin"])
    with override_settings(UB_UNRELEASED_MODULES=True):
        yield client, member


def _queue(client, capture):
    with capture(execute=True):
        response = client.get("/api/v1/parties", {"format": "csv"})
    assert response.status_code == 202, response.content
    export_id = response.json()["data"]["export_id"]
    assert Export.objects.get(pk=export_id).status == "ready"
    return export_id


def test_revoked_main_book_grant_cannot_download_earlier_export(
    setup, django_capture_on_commit_callbacks
):
    client, member = setup
    export_id = _queue(client, django_capture_on_commit_callbacks)
    MembershipAppGrant.objects.filter(membership=member, app="khata").delete()
    response = client.get(f"/api/v1/reports/exports/{export_id}/download")
    body = b"".join(response.streaming_content) if hasattr(response, "streaming_content") else b""
    assert response.status_code == 404, body[:200]
    assert b"4321" not in body


def test_unchanged_grants_still_download(setup, django_capture_on_commit_callbacks):
    client, _ = setup
    export_id = _queue(client, django_capture_on_commit_callbacks)
    response = client.get(f"/api/v1/reports/exports/{export_id}/download")
    assert response.status_code == 200
    assert b"4321" in b"".join(response.streaming_content)


def test_legacy_export_still_checks_its_main_book(setup, django_capture_on_commit_callbacks):
    """R-DEC-18 review: missing new metadata must not grandfather private main-book files."""
    client, member = setup
    export_id = _queue(client, django_capture_on_commit_callbacks)
    export = Export.objects.get(pk=export_id)
    export.params.pop("books", None)
    export.save(update_fields=["params"])
    MembershipAppGrant.objects.filter(membership=member, app="khata").delete()
    assert client.get(f"/api/v1/reports/exports/{export_id}/download").status_code == 404


def test_unrelated_grant_revocation_does_not_block_shop_file(
    setup, django_capture_on_commit_callbacks
):
    """Only the exported book is required; a Shop file does not contain Udhaar money."""
    client, member = setup
    with django_capture_on_commit_callbacks(execute=True):
        response = client.get("/api/v1/parties", {"format": "csv", "book": "shop"})
    assert response.status_code == 202, response.content
    export_id = response.json()["data"]["export_id"]
    MembershipAppGrant.objects.filter(membership=member, app="khata").delete()
    assert client.get(f"/api/v1/reports/exports/{export_id}/download").status_code == 200


def test_item_cost_export_is_denied_after_cost_permission_removed(
    setup, tenant, django_capture_on_commit_callbacks
):
    """Export permission alone must not unlock already-generated purchase-cost columns."""
    from apps.common.context import Ctx
    from apps.common.management.commands.seed_reference_data import seed_tax_rates, seed_units
    from apps.inventory.models import Unit
    from apps.inventory.services.items import create_item

    client, member = setup
    seed_tax_rates()
    seed_units()
    for name in ["LED driver", "MCB switch"]:
        create_item(
            ctx=Ctx.system(tenant),
            payload={
                "name": name,
                "unit_id": str(Unit.objects.get(tenant__isnull=True, code="NOS").id),
                "purchase_price": "4321",
                "selling_price": "5000",
            },
        )
    with django_capture_on_commit_callbacks(execute=True):
        response = client.get("/api/v1/items", {"format": "csv"})
    assert response.status_code == 202, response.content
    export_id = response.json()["data"]["export_id"]
    member.permissions_override = {"deny": ["reports.financial.read"], "allow": []}
    member.save(update_fields=["permissions_override"])
    assert client.get(f"/api/v1/reports/exports/{export_id}/download").status_code == 404


@pytest.mark.parametrize("slug", ["receivables-aging", "payables-aging"])
@pytest.mark.parametrize("format", ["json", "csv"])
def test_aging_report_requires_the_selected_book(setup, slug, format):
    """The report route must not bypass the per-book guard on the ledger aging route."""
    client, member = setup
    assert client.get(f"/api/v1/reports/{slug}", {"format": format}).status_code == 200
    MembershipAppGrant.objects.filter(membership=member, app="khata").delete()
    assert client.get(f"/api/v1/reports/{slug}", {"format": format}).status_code == 403
    response = client.get(f"/api/v1/reports/{slug}", {"format": format, "book": "shop"})
    assert response.status_code == 200, response.content


def test_stored_day_book_rechecks_source_read_rights(
    setup, tenant, django_capture_on_commit_callbacks
):
    """A previously exported sales row is private after invoice-read is revoked."""
    from apps.common.dates import tenant_today
    from apps.reports.tests import builders

    client, member = setup
    for amount in [100, 200]:
        builders.sale(tenant, tenant_today(tenant), amount)
    with django_capture_on_commit_callbacks(execute=True):
        response = client.get("/api/v1/reports/day-book", {"format": "csv"})
    assert response.status_code == 202, response.content
    export_id = response.json()["data"]["export_id"]
    assert client.get(f"/api/v1/reports/exports/{export_id}/download").status_code == 200
    member.permissions_override = {"deny": ["sales.invoice.read"], "allow": []}
    member.save(update_fields=["permissions_override"])
    assert client.get(f"/api/v1/reports/exports/{export_id}/download").status_code == 404


def test_stored_stock_report_rechecks_cost_columns(
    setup, tenant, django_capture_on_commit_callbacks
):
    """The report export must honor cost revocation just like the item CSV."""
    from apps.common.context import Ctx
    from apps.common.management.commands.seed_reference_data import seed_tax_rates, seed_units
    from apps.inventory.models import Unit
    from apps.inventory.services.items import create_item

    client, member = setup
    seed_tax_rates()
    seed_units()
    for name in ["Radhe LED driver", "Radhe MCB"]:
        create_item(
            ctx=Ctx.system(tenant),
            payload={
                "name": name,
                "unit_id": str(Unit.objects.get(tenant__isnull=True, code="NOS").id),
                "purchase_price": "4321",
                "selling_price": "5000",
            },
        )
    with django_capture_on_commit_callbacks(execute=True):
        response = client.get(
            "/api/v1/reports/stock-summary", {"format": "csv", "include_zero": "true"}
        )
    assert response.status_code == 202, response.content
    export_id = response.json()["data"]["export_id"]
    assert client.get(f"/api/v1/reports/exports/{export_id}/download").status_code == 200
    member.permissions_override = {"deny": ["reports.financial.read"], "allow": []}
    member.save(update_fields=["permissions_override"])
    assert client.get(f"/api/v1/reports/exports/{export_id}/download").status_code == 404


def test_stored_list_checks_disabled_source_module(
    setup, tenant, django_capture_on_commit_callbacks
):
    """An enabled reports permission cannot unlock a disabled source module's file."""
    client, _ = setup
    export_id = _queue(client, django_capture_on_commit_callbacks)
    tenant.enabled_modules = [m for m in tenant.enabled_modules if m != "parties"]
    tenant.save(update_fields=["enabled_modules"])
    assert client.get(f"/api/v1/reports/exports/{export_id}/download").status_code == 403


@pytest.mark.parametrize("format", ["json", "csv"])
def test_shop_aging_does_not_expose_udhaar_promise_or_limit(setup, tenant, format):
    """A Shop book grant must not reveal private main-book collection fields."""
    from datetime import date

    from apps.common.dates import tenant_today
    from apps.reports.tests import builders

    client, member = setup
    party = PartyFactory(
        tenant=tenant,
        name="Radhe Krishna Enterprises electrical buyer",
        collection_date=date(2026, 10, 25),
        credit_limit=Decimal("98765"),
    )
    builders.khata(tenant, tenant_today(tenant), 500, party=party, got=False, bucket="shop")
    MembershipAppGrant.objects.filter(membership=member, app="khata").delete()
    response = client.get("/api/v1/reports/receivables-aging", {"book": "shop", "format": format})
    assert response.status_code == 200, response.content
    if format == "json":
        row = next(row for row in response.json()["data"] if row["party"]["id"] == str(party.id))
        assert row["total"] == "500.00"
        assert row["collection_date"] is None
        assert row["credit_limit"] is None
    else:
        body = b"".join(response.streaming_content)
        assert b"98765" not in body
        assert b"2026-10-25" not in body
