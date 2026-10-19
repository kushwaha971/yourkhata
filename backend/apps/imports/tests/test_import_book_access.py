"""R-DEC-18 access audit: imports must honour BP-11 per-app book grants.

The party drawer (`POST /parties` with an opening balance) already requires a
main-book `ledger.entry.write`. The import engine checked the merged codename
set instead, so a Shop-only grant could post opening balances into the Udhaar
(main) book through `/imports`.
"""

from __future__ import annotations

import pytest
from django.test import override_settings
from django.urls import reverse

from apps.imports.tests.helpers import PARTY_HEADER, commit, upload
from apps.ledger.models import LedgerEntry
from apps.platform_app.models import MembershipAppGrant

pytestmark = pytest.mark.django_db

ROW = "Radhe Krishna Enterprises,+919811100001,customer,2300.00,to_receive,01/04/2026,,,"
NO_OPENING = "Radhe Krishna Enterprises,+919811100002,customer,,,,,,"


@pytest.fixture
def granted(tenant, api_as, system_roles):
    modules = list(
        dict.fromkeys([*tenant.enabled_modules, "khata", "import_export", "parties", "ledger"])
    )
    tenant.enabled_modules = modules
    tenant.save(update_fields=["enabled_modules"])
    tenant.plan.modules = modules
    tenant.plan.save(update_fields=["modules"])
    tenant.partner.allowed_modules = modules
    tenant.partner.save(update_fields=["allowed_modules"])

    def client_for(**apps):
        client, member = api_as(tenant, role="admin")
        for app, role in apps.items():
            MembershipAppGrant.objects.create(membership=member, app=app, role=system_roles[role])
        return client

    with override_settings(UB_UNRELEASED_MODULES=True):
        yield tenant, client_for


@pytest.fixture
def owner_of(granted, api_as):
    tenant, _ = granted
    client, _member = api_as(tenant)
    return client


def test_shop_only_grant_cannot_import_main_book_opening_balances(
    granted, django_capture_on_commit_callbacks
):
    """Shop admin without an Udhaar grant used to post a main-book opening entry."""
    tenant, make = granted
    client = make(shop="admin")
    response = upload(
        client, "parties", f"{PARTY_HEADER}\n{ROW}\n", capture=django_capture_on_commit_callbacks
    )
    if response.status_code == 201:
        commit(client, response.json()["data"]["id"], django_capture_on_commit_callbacks)
    assert response.status_code == 403, response.content
    assert not LedgerEntry.objects.filter(tenant=tenant).exists()


def test_khata_grant_keeps_party_import(granted):
    _, make = granted
    client = make(khata="admin")
    assert upload(client, "parties", f"{PARTY_HEADER}\n{ROW}\n").status_code == 201


def test_shop_only_reader_cannot_see_main_book_openings_in_import_jobs(
    granted, owner_of, django_capture_on_commit_callbacks
):
    """Jobs, row previews and the problem file carry Udhaar opening balances."""
    _, make = granted
    bad = "Radhe Krishna Enterprises,+919811100003,customer,99x,to_receive,01/04/2026,,,"
    job = upload(
        owner_of,
        "parties",
        f"{PARTY_HEADER}\n{ROW}\n{bad}\n",
        capture=django_capture_on_commit_callbacks,
    ).json()["data"]["id"]
    reader = make(shop="admin")
    assert reader.get(reverse("v1:import-detail", args=[job])).status_code == 404
    assert reader.get(reverse("v1:import-rows", args=[job])).status_code == 404
    assert reader.get(reverse("v1:import-errors", args=[job])).status_code == 404
    assert reader.get(reverse("v1:import-list")).json()["data"] == []


def test_khata_reader_still_sees_party_import_jobs(
    granted, owner_of, django_capture_on_commit_callbacks
):
    _, make = granted
    job = upload(
        owner_of, "parties", f"{PARTY_HEADER}\n{ROW}\n", capture=django_capture_on_commit_callbacks
    ).json()["data"]["id"]
    assert make(khata="admin").get(reverse("v1:import-detail", args=[job])).status_code == 200
