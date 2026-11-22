"""Your profile (design settings-and-profile S2, owner-approved 14 Nov 2026).

`PATCH /auth/me` changes only the signed-in person's own name and language. It is
the person's, not a business's: any role may change their own, nobody can change
somebody else's through it, and the session that comes back already says it.
"""

from __future__ import annotations

from typing import Any

import pytest
from django.urls import reverse

pytestmark = pytest.mark.django_db
URL = "v1:auth-me"


@pytest.mark.parametrize("role", ["owner", "admin", "accountant", "staff"])
def test_every_role_changes_their_own_name_and_language(
    tenant: Any, api_as: Any, role: str
) -> None:
    """A staff member or an accountant is the owner of their own profile."""
    client, member = api_as(tenant, role=role)
    response = client.patch(
        reverse(URL), {"full_name": "  Mohan  Lal ", "locale": "hi"}, format="json"
    )
    assert response.status_code == 200, response.content
    member.user.refresh_from_db()
    assert member.user.full_name == "Mohan Lal"
    assert member.user.locale == "hi"
    assert response.json()["data"]["user"]["full_name"] == "Mohan Lal"


def test_an_empty_name_is_refused_and_nothing_changes(tenant: Any, api_as: Any) -> None:
    client, member = api_as(tenant)
    before = member.user.full_name
    response = client.patch(reverse(URL), {"full_name": "   "}, format="json")
    assert response.status_code == 400
    member.user.refresh_from_db()
    assert member.user.full_name == before


def test_an_unknown_language_is_refused(tenant: Any, api_as: Any) -> None:
    client, _ = api_as(tenant)
    assert client.patch(reverse(URL), {"locale": "fr"}, format="json").status_code == 400


def test_the_mobile_and_email_cannot_be_changed_here(tenant: Any, api_as: Any) -> None:
    """The mobile is the sign-in; changing it needs a code on the new number,
    which is its own step. Sending them here is ignored, never applied."""
    client, member = api_as(tenant)
    email, mobile = member.user.email, member.user.mobile
    response = client.patch(
        reverse(URL),
        {"full_name": "Ramesh", "email": "x@y.test", "mobile": "+919999999999"},
        format="json",
    )
    assert response.status_code == 200
    member.user.refresh_from_db()
    assert (member.user.email, member.user.mobile) == (email, mobile)


def test_signed_out_cannot_change_a_profile(anonymous_client: Any) -> None:
    assert (
        anonymous_client.patch(reverse(URL), {"full_name": "X"}, format="json").status_code == 401
    )
