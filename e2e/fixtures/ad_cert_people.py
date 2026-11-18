"""A–D certification — isolated TEST businesses and people, local stack only.

Run inside the backend (`python manage.py shell < ../e2e/fixtures/ad_cert_people.py`).
Idempotent. Test values only: everyone signs in at /login/email with
`<name>@adcert.test` and the password below. Nothing here touches any other
business: every record is created in the three QA businesses.

  QA Kirana  (kirana)       owner qa-owner · admin qa-admin · accountant qa-acct
                            · staff qa-staff · staff qa-mixed
  QA Medical (medical)      owner qa-owner (one person, two businesses)
  QA Mobile  (electronics)  owner qa-mixed (staff in one, owner in another)
  QA Jewellery (jewellery)  owner qa-jeweller · staff qa-jstaff (Part G: G1 today's rate)
"""

from django.db import transaction

from apps.platform_app.models import Membership, Role, Tenant, User
from apps.platform_app.services import onboarding

PASSWORD = "AdCert-Test-2026!"


def person(name: str) -> User:
    email = f"{name}@adcert.test"
    user = User.objects.filter(email=email).first()
    if user is None:
        user = User.objects.create_user(email=email, password=PASSWORD, full_name=name.replace("-", " ").title(), locale="en")
    return user


def business(owner: User, name: str, kind: str) -> Tenant:
    found = Tenant.objects.filter(name=name, memberships__user=owner).first()
    if found is not None:
        return found
    with transaction.atomic():
        membership = onboarding.create_tenant(user=owner, name=name, business_type=kind, state_code="27", apps=["shop"])
        tenant = membership.tenant
        onboarding.apply_preset(tenant=tenant, actor=owner)
        Tenant.objects.filter(pk=tenant.pk).update(onboarding_step=4)
    return Tenant.objects.get(pk=tenant.pk)


def member(user: User, tenant: Tenant, role_code: str, default: bool = False) -> None:
    role = Role.objects.filter(tenant__isnull=True, code=role_code).first()
    membership = Membership.objects.filter(user=user, tenant=tenant).first()
    if membership is None:
        Membership.objects.create(user=user, tenant=tenant, role=role, status="active", is_default=default)
    elif membership.role_id != role.id or membership.status != "active":
        membership.role = role
        membership.status = "active"
        membership.save(update_fields=["role", "status"])


owner = person("qa-owner")
mixed = person("qa-mixed")
kirana = business(owner, "QA Kirana", "kirana")
medical = business(owner, "QA Medical", "medical")
mobile = business(mixed, "QA Mobile", "electronics")
member(person("qa-admin"), kirana, "admin", default=True)
member(person("qa-acct"), kirana, "accountant", default=True)
member(person("qa-staff"), kirana, "staff", default=True)
member(mixed, kirana, "staff")
jeweller = person("qa-jeweller")
jewellery = business(jeweller, "QA Jewellery", "jewellery")
member(person("qa-jstaff"), jewellery, "staff", default=True)
# G1: yesterday's rates, so Same as yesterday and "Up/Down from yesterday" have
# something to read. Only ever yesterday's row; today's is the harness's to set.
import datetime as _dt
from apps.common.dates import tenant_today
from apps.inventory.models import MetalRate

MetalRate.objects.get_or_create(
    tenant=jewellery,
    day=tenant_today(jewellery) - _dt.timedelta(days=1),
    defaults={"gold_24k": "12650", "gold_22k": "11595", "gold_18k": "9485", "silver": "151", "set_by_name": "Qa Jeweller"},
)
# Three earlier days (the design's history: 27–29 Oct figures), so Rate history
# has a month to show and the month picker something to pick.
for back, rates in ((2, ("12665", "11610", "9495", "151")), (3, ("12590", "11540", "9440", "149")), (4, ("12600", "11550", "9450", "150"))):
    MetalRate.objects.get_or_create(
        tenant=jewellery,
        day=tenant_today(jewellery) - _dt.timedelta(days=back),
        defaults=dict(zip(("gold_24k", "gold_22k", "gold_18k", "silver"), rates), set_by_name="Qa Jeweller"),
    )
print("ready", kirana.id, medical.id, mobile.id, jewellery.id)
