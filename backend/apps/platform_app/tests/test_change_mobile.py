"""Your profile › Change mobile number (design S2, owner-approved 14 Nov 2026).

The mobile is how a person signs in, so it changes only after a code sent to
the NEW number is typed back: `POST /auth/me/mobile` sends it, and
`POST /auth/me/mobile/confirm` checks it and moves the sign-in. Any role, for
their own account only. Prevents: taking a number somebody else signs in with,
moving the sign-in to a number nobody proved they hold, and a code for one
number confirming another.
"""

from __future__ import annotations

from typing import Any

import pytest
from django.urls import reverse

pytestmark = pytest.mark.django_db
SEND = "v1:auth-me-mobile"
CONFIRM = "v1:auth-me-mobile-confirm"
NEW = "+919811122233"


def _send(client: Any, mobile: str = NEW) -> Any:
    return client.post(reverse(SEND), {"mobile": mobile}, format="json")


@pytest.mark.parametrize("role", ["owner", "staff"])
def test_the_sign_in_moves_to_the_new_number_after_its_code(
    tenant: Any, api_as: Any, fixed_otp: str, role: str
) -> None:
    client, member = api_as(tenant, role=role)
    sent = _send(client)
    assert sent.status_code == 200, sent.content
    challenge = sent.json()["data"]["challenge_id"]
    done = client.post(
        reverse(CONFIRM), {"challenge_id": challenge, "code": fixed_otp}, format="json"
    )
    assert done.status_code == 200, done.content
    member.user.refresh_from_db()
    assert member.user.mobile == NEW
    assert done.json()["data"]["user"]["mobile"] == NEW


def test_a_wrong_code_changes_nothing(tenant: Any, api_as: Any, fixed_otp: str) -> None:
    client, member = api_as(tenant)
    before = member.user.mobile
    challenge = _send(client).json()["data"]["challenge_id"]
    wrong = "0" * len(fixed_otp) if fixed_otp != "0" * len(fixed_otp) else "1" * len(fixed_otp)
    done = client.post(reverse(CONFIRM), {"challenge_id": challenge, "code": wrong}, format="json")
    assert done.status_code == 400
    member.user.refresh_from_db()
    assert member.user.mobile == before


def test_a_number_somebody_else_signs_in_with_is_refused(
    tenant: Any, api_as: Any, fixed_otp: str
) -> None:
    from tests.factories.platform import UserFactory

    UserFactory(mobile=NEW)
    client, member = api_as(tenant)
    response = _send(client)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "mobile_taken"


def test_a_login_code_cannot_confirm_a_change(tenant: Any, api_as: Any, fixed_otp: str) -> None:
    """A code sent to sign in is not a code to move somebody's sign-in."""
    from apps.platform_app.services import otp as otp_service

    client, member = api_as(tenant)
    issued = otp_service.request_otp(mobile=NEW, purpose="login")
    done = client.post(
        reverse(CONFIRM),
        {"challenge_id": str(issued.challenge_id), "code": fixed_otp},
        format="json",
    )
    assert done.status_code == 400
    member.user.refresh_from_db()
    assert member.user.mobile != NEW


def test_an_account_named_after_its_number_follows_the_new_number(
    tenant: Any, api_as: Any, fixed_otp: str
) -> None:
    """A mobile-only account's stand-in email is built from its number; it moves too."""
    from apps.platform_app.services.auth import synthetic_email_for
    from tests.factories.platform import UserFactory

    user = UserFactory(mobile="+919800000001", email=synthetic_email_for("+919800000001"))
    client, _ = api_as(tenant, user=user)
    challenge = _send(client).json()["data"]["challenge_id"]
    client.post(reverse(CONFIRM), {"challenge_id": challenge, "code": fixed_otp}, format="json")
    user.refresh_from_db()
    assert user.email == synthetic_email_for(NEW)


def test_signed_out_cannot_change_a_mobile(anonymous_client: Any) -> None:
    assert _send(anonymous_client).status_code == 401
