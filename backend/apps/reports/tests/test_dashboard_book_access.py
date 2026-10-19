"""R-DEC-18 access audit: the Shop home's figures stay inside the reader's books.

`tiles.cash_in_hand` is every book's cash (kept for Udhaar-only businesses);
the Shop's own drawer is `shop_cash_in_hand`. Both were gated only by the Shop
permission `reports.financial.read`, so a Shop-only member received a cash
figure that includes the Udhaar and Library books.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from django.test import override_settings

from apps.payments.models import Payment
from apps.platform_app.models import MembershipAppGrant
from tests.factories.parties import PartyFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def cash_in_other_books(tenant, api_as, system_roles):
    from apps.common.dates import tenant_today

    modules = list(dict.fromkeys([*tenant.enabled_modules, "khata", "library", "dues"]))
    tenant.enabled_modules = modules
    tenant.save(update_fields=["enabled_modules"])
    tenant.plan.modules = modules
    tenant.plan.save(update_fields=["modules"])
    tenant.partner.allowed_modules = modules
    tenant.partner.save(update_fields=["allowed_modules"])
    party = PartyFactory(tenant=tenant, name="Radhe Krishna Enterprises")
    today = tenant_today(tenant).isoformat()
    for bucket, number in (("main", "R-U1"), ("library", "R-L1")):
        Payment.objects.create(
            tenant=tenant,
            party=party,
            number=number,
            direction="in",
            payment_date=today,
            amount="4321.00",
            primary_mode="cash",
            mode_breakup=[{"mode": "cash", "amount": "4321.00", "reference": ""}],
            bucket=bucket,
        )

    def client_for(**apps):
        client, member = api_as(tenant, role="admin")
        for app, role in apps.items():
            MembershipAppGrant.objects.create(membership=member, app=app, role=system_roles[role])
        return client

    with override_settings(UB_UNRELEASED_MODULES=True):
        yield client_for, api_as(tenant)[0]


def _tiles(client):
    response = client.get("/api/v1/reports/dashboard", {"refresh": "true"})
    assert response.status_code == 200, response.content
    return response.json()["data"]["tiles"]


def test_shop_only_member_gets_no_every_book_cash(cash_in_other_books):
    make, _ = cash_in_other_books
    tiles = _tiles(make(shop="admin"))
    assert "cash_in_hand" not in tiles, tiles.get("cash_in_hand")
    if "shop_cash_in_hand" in tiles:
        assert Decimal(str(tiles["shop_cash_in_hand"].get("amount", "0"))) < Decimal("4321")


def test_owner_keeps_every_book_cash(cash_in_other_books):
    _, owner = cash_in_other_books
    tiles = _tiles(owner)
    assert Decimal(tiles["cash_in_hand"]["amount"]) >= Decimal("8642.00")
