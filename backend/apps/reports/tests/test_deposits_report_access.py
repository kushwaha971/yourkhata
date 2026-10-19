"""R-DEC-18 access audit: the "Deposits held" report follows the deposit's app.

BP-11 scoped `/deposits` to the module that owns each deposit. The same rows
are also listed by the module report `payments.deposits_held`, gated only by
`reports.financial.read` (a Shop capability), so a Shop-only member read every
Library member's deposit through `/reports/payments.deposits_held`.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from django.test import override_settings

from apps.common.context import Ctx
from apps.platform_app.models import MembershipAppGrant
from tests.factories.parties import PartyFactory

pytestmark = pytest.mark.django_db

URL = "/api/v1/reports/payments.deposits_held"


@pytest.fixture
def library_deposit(tenant, api_as, system_roles):
    from apps.payments.services.deposits import open_deposit

    modules = list(
        dict.fromkeys([*tenant.enabled_modules, "khata", "library", "lending", "dues", "reports"])
    )
    tenant.enabled_modules = modules
    tenant.save(update_fields=["enabled_modules"])
    tenant.plan.modules = modules
    tenant.plan.save(update_fields=["modules"])
    tenant.partner.allowed_modules = modules
    tenant.partner.save(update_fields=["allowed_modules"])
    party = PartyFactory(tenant=tenant, name="Radhe Krishna Enterprises", balance=Decimal("0"))

    def client_for(**apps):
        client, member = api_as(tenant, role="admin")
        for app, role in apps.items():
            MembershipAppGrant.objects.create(membership=member, app=app, role=system_roles[role])
        return client

    with override_settings(UB_UNRELEASED_MODULES=True):
        open_deposit(
            ctx=Ctx.system(tenant),
            party_id=party.id,
            module="library",
            subject_type="library_membership",
            subject_id=uuid.uuid4(),
            purpose="Seat deposit",
            expected_amount="750.00",
        )
        yield client_for


def test_shop_only_member_does_not_see_library_deposits_in_report(library_deposit):
    shop = library_deposit(shop="admin")
    response = shop.get(URL, {"status": "all"})
    assert response.status_code in (200, 403), response.content
    if response.status_code == 200:
        data = response.json()["data"]
        assert data["rows"] == [], data["rows"]
        assert all(Decimal(v) == 0 for v in data["totals"].values())
    forged = shop.get(URL, {"status": "all", "_modules": "*"})
    assert forged.status_code != 200 or forged.json()["data"]["rows"] == []
    csv = shop.get(URL, {"status": "all", "format": "csv"})
    body = b"".join(csv.streaming_content) if hasattr(csv, "streaming_content") else csv.content
    assert b"Radhe Krishna" not in body


def test_owner_still_sees_library_deposits_in_report(library_deposit, tenant, api_as):
    owner, _ = api_as(tenant)
    with override_settings(UB_UNRELEASED_MODULES=True):
        response = owner.get(URL, {"status": "all"})
    assert response.status_code == 200, response.content
    assert [row["module"] for row in response.json()["data"]["rows"]] == ["library"]
