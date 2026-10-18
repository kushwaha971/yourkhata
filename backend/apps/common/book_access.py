"""App-aware authorization for shared financial engines (BP-11).

An enabled capability and a merged codename are not permission to read every
book using that engine. These helpers use the existing per-app grant resolver;
never the selected app, a client tenant header, or a frontend filter.
"""

from __future__ import annotations

from typing import Any

from rest_framework.exceptions import PermissionDenied

from apps.common.tenancy import get_effective_tenant

BOOK_APPS = {"main": "khata", "shop": "shop", "loan": "lending", "library": "library"}


def allowed_books(request: Any, codename: str) -> frozenset[str]:
    from apps.common.permissions_registry import permissions_for, permissions_for_app
    from apps.platform_app.apps_registry import is_business_owner, uses_explicit_app_grants

    tenant = get_effective_tenant(request)
    member = getattr(tenant, "_ub_membership", None) if tenant else None
    if member is None or codename not in permissions_for(member):
        return frozenset()
    # Owners and legacy grant-less members retain their existing explicit
    # business-role permissions. Restricting legacy grants is a separate migration.
    if is_business_owner(member) or not uses_explicit_app_grants(member):
        return frozenset((*BOOK_APPS, "deposit"))
    return frozenset(
        book for book, app in BOOK_APPS.items() if codename in permissions_for_app(member, app)
    )


def require_book(request: Any, book: str, codename: str) -> None:
    if book not in allowed_books(request, codename):
        raise PermissionDenied("You do not have permission to access this book.")


class BookAccessMixin:
    """HasPermission calls this before an idempotency wrapper can replay data."""

    def permission_books(self, request: Any, codename: str) -> tuple[str, ...]:
        return ("shop" if request.query_params.get("book") == "shop" else "main",)

    def authorize_book(self, request: Any, codename: str) -> bool:
        for book in self.permission_books(request, codename):
            require_book(request, book, codename)
        return True


def allowed_app_modules(request: Any, codename: str) -> frozenset[str]:
    """Owners/legacy preserve core access; explicit grants use their own role."""
    from apps.common.permissions_registry import permissions_for, permissions_for_app
    from apps.platform_app.apps_registry import (
        is_business_owner,
        registered_apps,
        uses_explicit_app_grants,
    )

    tenant = get_effective_tenant(request)
    member = getattr(tenant, "_ub_membership", None) if tenant else None
    if member is None or codename not in permissions_for(member):
        return frozenset()
    if is_business_owner(member) or not uses_explicit_app_grants(member):
        return frozenset({"*"})
    return frozenset(
        app.code for app in registered_apps() if codename in permissions_for_app(member, app.code)
    )
