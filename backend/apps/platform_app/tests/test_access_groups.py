"""Access groups (owner, 14 Nov 2026; design docs/revamp/design/access-groups.html).

Team follows the open business AND app. A group belongs to one app of one
business and holds off / view / full per part; members in it get those levels
there and nowhere else; a member may carry exceptions. Each test names what an
owner would see go wrong without it.
"""

from __future__ import annotations

from typing import Any

import pytest
from django.urls import reverse

from apps.common.permissions_registry import PERMISSIONS, permissions_for
from apps.platform_app.models import AccessGroup, Membership, MemberAppAccess
from apps.platform_app.services.access_groups import PARTS
from apps.platform_app.tests.test_app_grants import (  # noqa: F401 — fixtures
    PASSWORD,
    _business,
    _client,
    _role,
    _verticals_released,
)
from tests.factories.platform import MembershipFactory, UserFactory

pytestmark = pytest.mark.django_db

GROUPS = reverse("v1:access-group-list")


def _access(m: Any) -> str:
    return reverse("v1:member-access", args=[m.id])


@pytest.fixture
def shop() -> dict:
    tenant = _business()
    _role("admin")
    owner = UserFactory(password=PASSWORD)
    MembershipFactory(user=owner, tenant=tenant, role=_role("owner"))
    ravi_user = UserFactory(password=PASSWORD)
    ravi = MembershipFactory(user=ravi_user, tenant=tenant, role=_role("staff"))
    return {"tenant": tenant, "owner": _client(owner), "ravi": ravi}


def _group(client: Any, app: str = "shop", **levels: str) -> dict:
    got = client.post(GROUPS, {"app": app, "name": "Counter staff", "levels": levels}, format="json")
    assert got.status_code == 201, got.content
    return got.json()["data"]


def _held(m: Membership) -> frozenset[str]:
    m = Membership.objects.get(pk=m.pk)
    return permissions_for(m)


def test_every_codename_of_a_business_part_is_in_a_part() -> None:
    """A codename added to sales/purchases/payments/expenses or stock later and left
    out of PARTS would stay usable by a member whose group says Off."""
    covered = {c for parts in PARTS.values() for p in parts for c in p.see + p.change}
    for prefix in ("sales.", "purchases.", "payments.", "expenses.", "inventory.stock.", "lending.loan.create",
                   "lending.collection.create", "library.member.write", "library.fee.create"):  # fmt: skip
        missing = {c for c in PERMISSIONS if c.startswith(prefix)} - covered
        assert not missing, missing


def test_a_group_narrows_its_member_in_that_app_only(shop: dict) -> None:
    group = _group(shop["owner"], sales="view", purchases="off", stock="view")
    got = shop["owner"].put(_access(shop["ravi"]) + "?app=shop", {"group_id": group["id"]}, format="json")
    assert got.status_code == 200, got.content
    held = _held(shop["ravi"])
    assert "sales.invoice.read" in held and "sales.invoice.write" not in held  # view
    assert not any(c.startswith("purchases.") for c in held)  # off
    assert "inventory.stock.read" in held and "inventory.stock.adjust" not in held
    assert "payments.payment.write" in held  # not in the group: full
    assert "library.fee.create" in held and "lending.collection.create" in held  # other apps untouched


def test_changing_the_group_changes_every_member_in_it(shop: dict) -> None:
    group = _group(shop["owner"], purchases="off")
    other = MembershipFactory(tenant=shop["tenant"], role=_role("staff"))
    for m in (shop["ravi"], other):
        shop["owner"].put(_access(m) + "?app=shop", {"group_id": group["id"]}, format="json")
    versions = {m.pk: Membership.objects.get(pk=m.pk).permissions_version for m in (shop["ravi"], other)}
    got = shop["owner"].patch(reverse("v1:access-group-detail", args=[group["id"]]), {"levels": {"purchases": "full", "sales": "off"}}, format="json")
    assert got.status_code == 200 and got.json()["data"]["members"] == 2
    for m in (shop["ravi"], other):
        held = _held(m)
        assert "purchases.bill.write" in held and "sales.invoice.read" not in held
        assert Membership.objects.get(pk=m.pk).permissions_version == versions[m.pk] + 1


def test_an_exception_beats_the_group_and_use_group_again_clears_it(shop: dict) -> None:
    group = _group(shop["owner"], sales="view")
    url = _access(shop["ravi"]) + "?app=shop"
    shop["owner"].put(url, {"group_id": group["id"], "exceptions": {"sales": "full"}}, format="json")
    data = shop["owner"].get(url).json()["data"]
    sales = next(p for p in data["parts"] if p["part"] == "sales")
    assert sales == {"part": "sales", "levels": ["off", "view", "full"], "group_level": "view", "level": "full"}
    assert data["changes"] == 1 and "sales.invoice.write" in _held(shop["ravi"])
    shop["owner"].put(url, {"exceptions": {}}, format="json")
    assert "sales.invoice.write" not in _held(shop["ravi"])


def test_a_level_never_gives_more_than_the_role(shop: dict) -> None:
    """Staff never adjust stock; a Full exception must not hand it to them."""
    url = _access(shop["ravi"]) + "?app=shop"
    shop["owner"].put(url, {"exceptions": {"stock": "full"}}, format="json")
    assert "inventory.stock.adjust" not in _held(shop["ravi"])


def test_a_group_belongs_to_one_business_and_one_app(shop: dict) -> None:
    library = _group(shop["owner"], app="library", library_fees="off")
    got = shop["owner"].put(_access(shop["ravi"]) + "?app=shop", {"group_id": library["id"]}, format="json")
    assert got.status_code == 400  # a Library group cannot run Business
    listed = shop["owner"].get(GROUPS + "?app=shop").json()["data"]["groups"]
    assert library["id"] not in {g["id"] for g in listed}
    other = _business()
    stranger = UserFactory(password=PASSWORD)
    MembershipFactory(user=stranger, tenant=other, role=_role("owner"))
    elsewhere = _client(stranger)
    assert elsewhere.get(GROUPS + "?app=library").json()["data"]["groups"] == []
    assert elsewhere.patch(reverse("v1:access-group-detail", args=[library["id"]]), {"name": "x"}, format="json").status_code == 404


def test_one_default_group_per_app(shop: dict) -> None:
    a = shop["owner"].post(GROUPS, {"app": "shop", "name": "A", "is_default": True}, format="json").json()["data"]
    b = shop["owner"].post(GROUPS, {"app": "shop", "name": "B", "is_default": True}, format="json").json()["data"]
    lib = shop["owner"].post(GROUPS, {"app": "library", "name": "L", "is_default": True}, format="json").json()["data"]
    assert not AccessGroup.objects.get(pk=a["id"]).is_default
    assert AccessGroup.objects.get(pk=b["id"]).is_default and AccessGroup.objects.get(pk=lib["id"]).is_default


def test_a_group_with_members_cannot_be_deleted(shop: dict) -> None:
    group = _group(shop["owner"])
    url = reverse("v1:access-group-detail", args=[group["id"]])
    shop["owner"].put(_access(shop["ravi"]) + "?app=shop", {"group_id": group["id"]}, format="json")
    refused = shop["owner"].delete(url)
    assert refused.status_code == 409 and refused.json()["error"]["code"] == "group_has_members"
    shop["owner"].put(_access(shop["ravi"]) + "?app=shop", {"group_id": None}, format="json")
    assert shop["owner"].delete(url).status_code == 200


def test_admins_are_not_put_in_groups(shop: dict) -> None:
    admin = MembershipFactory(tenant=shop["tenant"], role=_role("admin"))
    group = _group(shop["owner"], sales="off")
    got = shop["owner"].put(_access(admin) + "?app=shop", {"group_id": group["id"]}, format="json")
    assert got.status_code == 400


def test_switching_one_app_off_keeps_the_others_and_never_the_last(shop: dict) -> None:
    url = _access(shop["ravi"])
    shop["owner"].put(url + "?app=library", {"can_use": False}, format="json")
    opens = shop["owner"].get(reverse("v1:member-apps", args=[shop["ravi"].id])).json()["data"]["opens"]
    assert "library" not in opens and {"lending", "shop"} <= set(opens)
    shop["owner"].put(url + "?app=lending", {"can_use": False}, format="json")
    last = shop["owner"].put(url + "?app=shop", {"can_use": False}, format="json")
    assert last.status_code == 400


def test_adding_from_an_app_gives_that_app_in_the_default_group(shop: dict) -> None:
    group = shop["owner"].post(GROUPS, {"app": "library", "name": "Library desk", "is_default": True, "levels": {"library_fees": "off"}}, format="json").json()["data"]
    made = shop["owner"].post(reverse("v1:member-list"), {"full_name": "Suresh Patil", "mobile": "+919822041178", "role": "staff", "app": "library"}, format="json")
    assert made.status_code == 201, made.content
    member = Membership.objects.get(tenant=shop["tenant"], user__mobile="+919822041178")
    opens = shop["owner"].get(reverse("v1:member-apps", args=[member.id])).json()["data"]["opens"]
    assert opens == ["library"]
    assert MemberAppAccess.objects.get(membership=member, app="library").group_id is not None
    assert str(MemberAppAccess.objects.get(membership=member, app="library").group_id) == group["id"]
    assert "library.fee.create" not in _held(member)
    # Added again from Business: they gain Business, keep Library.
    again = shop["owner"].post(reverse("v1:member-list"), {"full_name": "Suresh Patil", "mobile": "+919822041178", "role": "staff", "app": "shop"}, format="json")
    assert again.status_code == 200 and again.json()["data"]["added_to_app"] == "shop"
    assert again.json()["data"]["password"] is None and again.json()["data"]["member"]["id"] == str(member.id)
    opens = shop["owner"].get(reverse("v1:member-apps", args=[member.id])).json()["data"]["opens"]
    assert set(opens) == {"library", "shop"}


def test_the_members_list_for_an_app_shows_each_group_and_changes(shop: dict) -> None:
    group = _group(shop["owner"], sales="view")
    shop["owner"].put(_access(shop["ravi"]) + "?app=shop", {"group_id": group["id"], "exceptions": {"sales": "full"}}, format="json")
    rows = shop["owner"].get(reverse("v1:member-list") + "?app=shop").json()["data"]
    mine = next(r for r in rows if r["id"] == str(shop["ravi"].id))
    assert mine["access"] == {"can_use": True, "group_id": group["id"], "group_name": "Counter staff", "changes": 1}


def test_the_parts_and_the_example_come_from_the_server(shop: dict) -> None:
    data = shop["owner"].get(GROUPS + "?app=library").json()["data"]
    assert [p["part"] for p in data["parts"]] == ["library_students", "library_fees"]
    assert data["parts"][1]["levels"] == ["off", "full"]  # an action has no view
    assert data["suggested"]["name"] == "Library desk"
    assert shop["owner"].get(GROUPS + "?app=nope").status_code == 400


def test_staff_cannot_manage_groups(shop: dict) -> None:
    staff = _client(shop["ravi"].user)
    assert staff.get(GROUPS + "?app=shop").status_code == 403
    assert staff.post(GROUPS, {"app": "shop", "name": "x"}, format="json").status_code == 403
