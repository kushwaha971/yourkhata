"""R-DEC-18 access audit: `/files/{id}` is the branding-image route, not a
second door to import and export files.

Import uploads and export CSVs are stored as tenant attachments. Their own
routes (`/imports/{id}/…`, `/reports/exports/{id}/download`) check the kind's
permission and, since this audit, the book. `/files/{id}` checked only "active
member of this business", so a direct id streamed the same file to a member
who is refused on the proper route.
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
def main_book_export(tenant, api_as, monkeypatch, django_capture_on_commit_callbacks):
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
    owner, _ = api_as(tenant)
    with override_settings(UB_UNRELEASED_MODULES=True):
        with django_capture_on_commit_callbacks(execute=True):
            response = owner.get("/api/v1/parties", {"format": "csv"})
        assert response.status_code == 202, response.content
        export = Export.objects.get(pk=response.json()["data"]["export_id"])
        assert export.status == "ready"
        yield export


def test_shop_only_member_cannot_stream_main_book_export_by_file_id(
    main_book_export, tenant, api_as, system_roles
):
    client, member = api_as(tenant, role="admin")
    MembershipAppGrant.objects.create(membership=member, app="shop", role=system_roles["admin"])
    proper = client.get(f"/api/v1/reports/exports/{main_book_export.id}/download")
    assert proper.status_code == 404
    response = client.get(f"/api/v1/files/{main_book_export.file_attachment_id}")
    body = b"".join(response.streaming_content) if hasattr(response, "streaming_content") else b""
    assert response.status_code == 404, body[:200]
