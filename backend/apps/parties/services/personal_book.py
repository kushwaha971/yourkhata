"""Private Udhaar scopes reuse the existing atomic money and audit services."""

from django.db import transaction
from rest_framework.exceptions import PermissionDenied

from apps.parties.models import PersonalBook
from apps.platform_app.models import Membership, Role, Tenant, User


@transaction.atomic
def personal_tenant(*, user, business, version):
    # Serialise first access: concurrent tabs must never create two books.
    User.objects.select_for_update().get(pk=user.pk)
    book = (
        PersonalBook.objects.select_related("tenant__partner", "tenant__plan")
        .filter(owner=user)
        .first()
    )
    if book is None:
        if business is None:
            raise PermissionDenied("Open your account before adding people.")
        storage = Tenant.objects.create(
            partner=business.partner,
            plan=business.plan,
            name=user.full_name or "Personal book",
            business_type=business.business_type,
            state_code=business.state_code,
            phone=user.mobile or "",
            enabled_modules=["platform", "khata", "parties", "ledger", "notifications"],
            timezone=business.timezone,
            locale=user.locale,
        )
        book = PersonalBook.objects.create(owner=user, tenant=storage)
    storage = book.tenant
    role = Role.objects.filter(tenant__isnull=True, code="owner").first()
    if role is None:
        raise PermissionDenied("Your book could not be opened. Try again.")
    storage._ub_personal_owner = user.pk
    storage._ub_membership = Membership(
        user=user,
        tenant=storage,
        role=role,
        status="active",
        permissions_version=version,
        permissions_override={},
    )
    return storage
