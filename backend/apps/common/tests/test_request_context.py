"""R-DEC-18: client intent can reject a stale context, never grant an identity or tenant."""

import pytest

from tests.factories.parties import PartyFactory

pytestmark = pytest.mark.django_db


def test_wrong_expected_actor_is_refused_before_read_or_write(tenant, api_as):
    """BP-13: an old tab formerly acted as the next cookie user before detecting it."""
    client, member = api_as(tenant)
    _, another = api_as(tenant)
    party = PartyFactory(tenant=tenant, name="Radhe Krishna Enterprises electrical buyer")
    headers = {"HTTP_X_EXPECTED_USER_ID": str(another.user_id)}
    assert client.get("/api/v1/parties", **headers).status_code == 409
    assert (
        client.patch(
            f"/api/v1/parties/{party.id}",
            {"name": "Wrong actor wrote this"},
            format="json",
            **headers,
        ).status_code
        == 409
    )
    party.refresh_from_db()
    assert party.name == "Radhe Krishna Enterprises electrical buyer"
    assert member.user_id != another.user_id


def test_expected_business_cannot_select_another_tenant(tenant, other_tenant, api_as):
    """BP-13: response-only guards formerly let old forms write in the new business."""
    client, member = api_as(tenant)
    party = PartyFactory(tenant=tenant, name="LED bulb buyer")
    headers = {"HTTP_X_EXPECTED_TENANT_ID": str(other_tenant.id)}
    assert client.get("/api/v1/parties", **headers).status_code == 409
    assert (
        client.patch(
            f"/api/v1/parties/{party.id}", {"name": "Wrong business"}, format="json", **headers
        ).status_code
        == 409
    )
    party.refresh_from_db()
    assert party.name == "LED bulb buyer"
    correct = {
        "HTTP_X_EXPECTED_USER_ID": str(member.user_id),
        "HTTP_X_EXPECTED_TENANT_ID": str(tenant.id),
    }
    assert client.get("/api/v1/parties", **correct).status_code == 200
    assert client.get("/api/v1/parties").status_code == 200


def test_scoped_response_exposes_authenticated_identity_and_revision(tenant, api_as):
    """A late read can be rejected without another query or a user-facing payload change."""
    client, member = api_as(tenant)
    response = client.get("/api/v1/parties")
    assert response.status_code == 200
    assert response["X-User-Id"] == str(member.user_id)
    assert response["X-Membership-Version"] == str(member.permissions_version)
    assert {"data", "meta"} <= response.json().keys()


def test_context_preconditions_are_available_through_cors(tenant, api_as):
    """Browser development must not silently lose the stale-context safeguard at preflight."""
    from django.test import override_settings

    client, _ = api_as(tenant)
    with override_settings(CORS_ALLOWED_ORIGINS=["http://localhost:3000"]):
        response = client.options(
            "/api/v1/parties",
            HTTP_ORIGIN="http://localhost:3000",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="PATCH",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="x-expected-user-id,x-expected-tenant-id,x-csrf-token,content-type",
        )
    assert response.status_code == 200
    allowed = response["Access-Control-Allow-Headers"].lower()
    assert "x-expected-user-id" in allowed and "x-expected-tenant-id" in allowed
