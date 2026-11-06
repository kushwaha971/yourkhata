"""R-DEC-18 access audit: business-wide tag changes need every contact app's right.

A tag is one label shared by every app's contacts. Renaming, merging or
deleting it changes what the Shop, Udhaar, Library and Lending desks all see.
Like the shared-contact archive (BP-11), that needs the right in every app the
business runs that keeps contacts, not just one app's grant. Creating a tag
and tagging contacts stay a single-app action, as editing a contact is.
"""

from __future__ import annotations

import pytest
from django.test import override_settings

from apps.parties.models import Tag
from apps.platform_app.models import MembershipAppGrant

pytestmark = pytest.mark.django_db


@pytest.fixture
def shared_tag(tenant, api_as, system_roles):
    modules = list(dict.fromkeys([*tenant.enabled_modules, "khata", "library"]))
    tenant.enabled_modules = modules
    tenant.save(update_fields=["enabled_modules"])
    tenant.plan.modules = modules
    tenant.plan.save(update_fields=["modules"])
    tenant.partner.allowed_modules = modules
    tenant.partner.save(update_fields=["allowed_modules"])
    owner, _ = api_as(tenant)

    def client_for(**apps):
        client, member = api_as(tenant, role="admin")
        for app, role in apps.items():
            MembershipAppGrant.objects.create(membership=member, app=app, role=system_roles[role])
        return client

    with override_settings(UB_UNRELEASED_MODULES=True):
        made = owner.post("/api/v1/parties/tags", {"name": "Wholesale"}, format="json")
        other = owner.post("/api/v1/parties/tags", {"name": "Electricians"}, format="json")
        assert made.status_code == 201, made.content
        yield made.json()["data"]["id"], other.json()["data"]["id"], client_for, owner


def test_one_app_grant_cannot_delete_rename_or_merge_a_shared_tag(shared_tag):
    tag_id, other_id, make, _ = shared_tag
    library = make(library="admin")
    base = f"/api/v1/parties/tags/{tag_id}"
    assert library.patch(base, {"name": "Renamed"}, format="json").status_code == 403
    assert (
        library.post(f"{base}/merge", {"into_tag_id": other_id}, format="json").status_code == 403
    )
    assert library.delete(base).status_code == 403
    assert Tag.objects.filter(pk=tag_id, name="Wholesale").exists()


def test_one_app_grant_still_creates_and_lists_tags(shared_tag):
    _, _, make, _ = shared_tag
    library = make(library="admin")
    assert library.get("/api/v1/parties/tags").status_code == 200
    assert (
        library.post("/api/v1/parties/tags", {"name": "Seat A"}, format="json").status_code == 201
    )


def test_member_with_every_contact_app_right_can_manage_tags(shared_tag):
    tag_id, _, make, owner = shared_tag
    every = make(shop="admin", khata="admin", library="admin")
    response = every.patch(f"/api/v1/parties/tags/{tag_id}", {"name": "Bulk buyers"}, format="json")
    assert response.status_code == 200, response.content
    assert owner.delete(f"/api/v1/parties/tags/{tag_id}").status_code in (200, 204)
