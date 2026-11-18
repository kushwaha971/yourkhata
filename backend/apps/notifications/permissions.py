"""Permission classes for the notifications app (canon §0.9, Part 20 §20.5.5)."""

from __future__ import annotations

from typing import Any

from rest_framework.permissions import BasePermission

from apps.common.permissions_registry import permissions_for
from apps.common.tenancy import get_effective_tenant


class IsTenantMember(BasePermission):
    """NTF-01 §12 — the bell and one's own inbox need only an active membership.

    There is no codename for "may have an inbox": every member has one. What a
    member SEES in it is filtered by permission per row type (BR-1), in the
    selector, which is where the real boundary is.
    """

    def has_permission(self, request: Any, view: Any) -> bool:
        user = getattr(request, "user", None)
        if not (user and user.is_authenticated and user.is_active):
            return False
        tenant = get_effective_tenant(request)
        return tenant is not None and getattr(tenant, "_ub_membership", None) is not None


def member_permissions(request: Any) -> frozenset[str]:
    tenant = get_effective_tenant(request)
    membership = getattr(tenant, "_ub_membership", None)
    return permissions_for(membership) if membership is not None else frozenset()


def member_notification_types(request: Any) -> frozenset[str] | None:
    """Explicit app grants constrain both targeted rows and broadcasts, not the selected UI app.

    Legacy never-configured memberships retain their documented broad role. Business/account
    events have no app origin; recipient and existing broadcast permissions still apply.
    """
    from apps.common.permissions_registry import permissions_for_app
    from apps.notifications.services.notify import REGISTRY
    from apps.platform_app.apps_registry import app_spec, apps_of_business, uses_explicit_app_grants

    tenant = get_effective_tenant(request)
    membership = getattr(tenant, "_ub_membership", None) if tenant else None
    if membership is None:
        return frozenset()
    if not uses_explicit_app_grants(membership):
        return None
    enabled = {app.code for app in apps_of_business(tenant)}
    origins = {"reminder_due": "khata", "reminder_failed": "khata", "low_stock": "shop"}
    grants: dict[str, frozenset[str]] = {}
    allowed = set()
    for code, spec in REGISTRY.items():
        prefix = code.partition(".")[0]
        origin = origins.get(code) or (prefix if app_spec(prefix) else None)
        if origin is None:
            allowed.add(code)
            continue
        if origin not in grants:
            grants[origin] = (
                permissions_for_app(membership, origin) if origin in enabled else frozenset()
            )
        if spec.required_permission in grants[origin]:
            allowed.add(code)
    return frozenset(allowed)
