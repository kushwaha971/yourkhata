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
