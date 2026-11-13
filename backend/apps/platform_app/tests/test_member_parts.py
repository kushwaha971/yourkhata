"""Owner, 14 Nov 2026 — hide one PART of an app from one team member.

Block takes the whole business away and the Apps choice takes a whole app. The
owner also wants the counter boy in Business without Purchases, or a Library
helper who reads students but does not take fees. A part is a set of the
member's permissions, denied through `Membership.permissions_override`, so the
server refuses it whatever the screen does; nothing else about the member, the
app or the business changes.
"""

from __future__ import annotations

from typing import Any

import pytest
from django.urls import reverse

from apps.common.permissions_registry import permissions_for
from apps.platform_app.tests.test_app_grants import (  # noqa: F401 — fixtures
    PASSWORD,
    _business,
    _client,
    _role,
    _verticals_released,
)
from tests.factories.platform import MembershipFactory, UserFactory

pytestmark = pytest.mark.django_db

SHOP_PARTS = ["sales", "purchases", "stock", "payments", "expenses"]
LIBRARY_PARTS = ["library_students", "library_fees"]
LENDING_PARTS = ["lending_lend", "lending_collect"]


@pytest.fixture
def team() -> dict:
    tenant = _business()
    _role("admin")
    owner = UserFactory(password=PASSWORD)
    MembershipFactory(user=owner, tenant=tenant, role=_role("owner"))
    staff_user = UserFactory(password=PASSWORD)
    ravi = MembershipFactory(user=staff_user, tenant=tenant, role=_role("staff"))
    return {"tenant": tenant, "owner": _client(owner), "ravi": ravi, "ravi_client": _client(staff_user)}


def _url(membership: Any) -> str:
    return reverse("v1:member-apps", args=[membership.id])


def _parts(data: dict) -> dict[str, bool]:
    return {row["part"]: row["hidden"] for row in data["parts"]}


def test_the_screen_is_told_each_part_the_member_could_use_and_none_is_hidden(team: dict) -> None:
    data = team["owner"].get(_url(team["ravi"])).json()["data"]
    assert [row["part"] for row in data["parts"]] == LIBRARY_PARTS + LENDING_PARTS + SHOP_PARTS
    assert not any(_parts(data).values())
    assert {row["app"] for row in data["parts"]} == {"library", "lending", "shop"}


def test_hiding_sales_and_fees_refuses_only_those(team: dict) -> None:
    """The member keeps Purchases, keeps enrolling students, keeps the app."""
    got = team["owner"].put(
        _url(team["ravi"]),
        {"hidden": ["sales", "library_fees"]},
        format="json",
    )
    assert got.status_code == 200, got.content
    assert _parts(got.json()["data"])["sales"] is True
    assert _parts(got.json()["data"])["purchases"] is False
    team["ravi"].refresh_from_db()
    held = permissions_for(team["ravi"])
    assert not any(c.startswith("sales.") for c in held)
    assert "library.fee.create" not in held
    assert "purchases.bill.write" in held and "library.member.write" in held
    assert set(got.json()["data"]["opens"]) == {"library", "lending", "shop"}
    # The member's own next request is refused for sales, not for purchases.
    member = team["ravi_client"]
    assert member.get("/api/v1/sales/invoices").status_code in (401, 403)
    member = _client(team["ravi"].user)
    assert member.get("/api/v1/sales/invoices").status_code == 403
    assert member.get("/api/v1/purchases/bills").status_code == 200


def test_showing_a_part_again_gives_it_back_and_keeps_an_unrelated_deny(team: dict) -> None:
    """`permissions_override` may hold a deny the parts never wrote (canon §0.9's
    stock adjust); saving the parts must not wipe it."""
    team["ravi"].permissions_override = {"deny": ["inventory.item.write"]}
    team["ravi"].save(update_fields=["permissions_override"])
    url = _url(team["ravi"])
    team["owner"].put(url, {"hidden": ["purchases"]}, format="json")
    back = team["owner"].put(url, {"hidden": []}, format="json").json()["data"]
    assert not any(_parts(back).values())
    team["ravi"].refresh_from_db()
    assert team["ravi"].permissions_override["deny"] == ["inventory.item.write"]
    assert "purchases.bill.write" in permissions_for(team["ravi"])


def test_a_change_makes_held_sessions_reread(team: dict) -> None:
    before = team["ravi"].permissions_version
    team["owner"].put(_url(team["ravi"]), {"hidden": ["stock"]}, format="json")
    team["ravi"].refresh_from_db()
    assert team["ravi"].permissions_version == before + 1


def test_an_unknown_part_is_refused(team: dict) -> None:
    got = team["owner"].put(_url(team["ravi"]), {"hidden": ["reports"]}, format="json")
    assert got.status_code == 400


def test_an_accountant_is_offered_only_parts_their_role_holds(team: dict) -> None:
    """An accountant never takes fees or gives loans; a switch for it would be a lie."""
    reader = MembershipFactory(tenant=team["tenant"], role=_role("accountant"))
    parts = _parts(team["owner"].get(_url(reader)).json()["data"])
    assert "library_fees" not in parts and "lending_lend" not in parts
    assert "sales" in parts  # they read bills, so hiding Sales means something


def test_staff_cannot_hide_parts_from_anybody(team: dict) -> None:
    got = team["ravi_client"].put(_url(team["ravi"]), {"hidden": ["sales"]}, format="json")
    assert got.status_code == 403
