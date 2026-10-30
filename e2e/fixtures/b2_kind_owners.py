"""B2 — one local TEST owner per shop kind, to look at each kind's menu.

Run inside the backend (`python manage.py shell < ../e2e/fixtures/b2_kind_owners.py`).
Idempotent. Test values only, for the local e2e stack: every owner signs in at
/login/email with `b2-<kind>@yourkhata.test` and the password below.
"""

from django.db import transaction

from apps.platform_app.models import Membership, Tenant, User
from apps.platform_app.services import onboarding, tenant_settings
from apps.common.context import Ctx

PASSWORD = "B2-Kinds-Test-2026!"
KINDS = [
    # (kind, business name, wholesale)
    ("hardware", "Balaji Hardware & Paints", False),
    ("medical", "Sai Medical Store", False),
    ("kirana", "Shree Ganesh Kirana", False),
    ("kirana", "Gupta Traders", True),
    ("jewellery", "Laxmi Jewellers", False),
]

for kind, name, wholesale in KINDS:
    email = f"b2-{kind}{'-wholesale' if wholesale else ''}@yourkhata.test"
    user = User.objects.filter(email=email).first()
    if user is None:
        user = User.objects.create_user(email=email, password=PASSWORD, full_name="Test Owner", locale="en")
    existing = Membership.objects.filter(user=user).select_related("tenant").first()
    if existing is not None:
        tenant = existing.tenant
        if tenant.onboarding_step < 4:
            onboarding.apply_preset(tenant=tenant, actor=user)
            Tenant.objects.filter(pk=tenant.pk).update(onboarding_step=4)
        print("ready", email, tenant.business_type)
        continue
    with transaction.atomic():
        membership = onboarding.create_tenant(
            user=user, name=name, business_type=kind, state_code="27", apps=["shop"]
        )
        tenant = membership.tenant
        if wholesale:
            tenant_settings.set_shop_choices(
                tenant=tenant,
                values={"shop.wholesale": {"value": True}},
                ctx=Ctx(tenant=tenant, actor=user, actor_type="user"),
            )
        # The wizard's last step: seed the kind's preset, mark setup done.
        onboarding.apply_preset(tenant=tenant, actor=user)
        Tenant.objects.filter(pk=tenant.pk).update(onboarding_step=4)
    print("made", email, tenant.business_type, Tenant.objects.get(pk=tenant.pk).onboarding_step)
