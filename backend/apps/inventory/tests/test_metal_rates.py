"""G1 — a jeweller's rate for the day (design §G1 "Today's rate")."""

from __future__ import annotations

import datetime as dt
from typing import Any

import pytest
from django.urls import reverse

from apps.common.constants import RoleCode
from apps.inventory.models import MetalRate

pytestmark = pytest.mark.django_db

TODAY = reverse("v1:metal-rate-today")
HISTORY = reverse("v1:metal-rate-history")


@pytest.fixture
def jeweller(tenant: Any) -> Any:
    tenant.business_type = "jewellery"
    tenant.save(update_fields=["business_type"])
    return tenant


@pytest.fixture
def owner(api_as: Any, jeweller: Any, main: Any, reference: Any) -> Any:
    return api_as(jeweller, RoleCode.OWNER.value)[0]


def test_saved_rates_are_read_back_with_who_set_them(owner: Any) -> None:
    """The figures typed are the figures served, per purity, with a name and time."""
    res = owner.put(TODAY, {"gold_24k": "12710", "gold_22k": "11,650", "gold_18k": "", "silver": "150.5"}, format="json")
    assert res.status_code == 200, res.content
    got = owner.get(TODAY).json()["data"]["today"]
    assert got["rates"] == {"gold_24k": "12710.00", "gold_22k": "11650.00", "gold_18k": None, "silver": "150.50"}
    assert got["set_by"] and got["set_at"]


def test_saving_again_today_replaces_today_only(owner: Any, jeweller: Any) -> None:
    """Changing the rate later today rewrites today's row; yesterday's stays."""
    today = dt.date.fromisoformat(owner.get(TODAY).json()["data"]["day"])
    MetalRate.objects.create(tenant=jeweller, day=today - dt.timedelta(days=1), gold_22k="11595")
    owner.put(TODAY, {"gold_22k": "11650"}, format="json")
    owner.put(TODAY, {"gold_22k": "11700"}, format="json")
    data = owner.get(TODAY).json()["data"]
    assert data["today"]["rates"]["gold_22k"] == "11700.00"
    assert data["yesterday"]["rates"]["gold_22k"] == "11595.00"
    assert MetalRate.objects.filter(tenant=jeweller).count() == 2


@pytest.mark.parametrize(
    "body,field",
    [({"gold_22k": "0"}, "gold_22k"), ({"silver": "abc"}, "silver"), ({"gold_24k": "1.234"}, "gold_24k"), ({}, "gold_22k")],
)
def test_a_wrong_rate_is_refused_and_named(owner: Any, body: dict, field: str) -> None:
    res = owner.put(TODAY, body, format="json")
    assert res.status_code == 400
    assert field in res.json()["error"]["details"]


def test_history_lists_the_month_newest_first(owner: Any, jeweller: Any) -> None:
    for day, rate in [(dt.date(2026, 10, 29), "11595"), (dt.date(2026, 10, 30), "11650"), (dt.date(2026, 9, 30), "1")]:
        MetalRate.objects.create(tenant=jeweller, day=day, gold_22k=rate)
    rows = owner.get(HISTORY + "?month=2026-10").json()["data"]["rows"]
    assert [(r["day"], r["rates"]["gold_22k"]) for r in rows] == [("2026-10-30", "11650.00"), ("2026-10-29", "11595.00")]


def test_staff_read_the_rate_and_cannot_set_it(api_as: Any, jeweller: Any, main: Any, reference: Any) -> None:
    staff = api_as(jeweller, RoleCode.STAFF.value)[0]
    assert staff.get(TODAY).status_code == 200
    assert staff.put(TODAY, {"gold_22k": "1"}, format="json").status_code == 403


def test_another_kind_never_sees_it(api_as: Any, tenant: Any, main: Any, reference: Any) -> None:
    """Part G: each module is behind its own switch; a kirana gets 404."""
    tenant.business_type = "kirana"
    tenant.save(update_fields=["business_type"])
    client = api_as(tenant, RoleCode.OWNER.value)[0]
    assert client.get(TODAY).status_code == 404
    assert client.put(TODAY, {"gold_22k": "1"}, format="json").status_code == 404
