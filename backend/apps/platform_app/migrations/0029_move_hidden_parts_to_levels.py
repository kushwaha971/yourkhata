"""Owner, 14 Nov 2026 — parts hidden with the first per-member switches move to
access levels.

Those switches (commit f424778a6) hid a part by writing its codenames into
`Membership.permissions_override["deny"]`. Access groups replace them with a
level per part on `MemberAppAccess`, so each hidden part becomes an "off"
exception there and its codenames leave the deny list. A deny the parts never
wrote (canon §0.9's per-member stock adjust) is left alone. The codename lists
are frozen here, as a migration must not read the live registry.
"""

from django.db import migrations

OLD_PARTS = {
    ("shop", "sales"): {"sales.credit_note.write", "sales.estimate.read", "sales.estimate.write",
                        "sales.invoice.read", "sales.invoice.void", "sales.invoice.write"},
    ("shop", "purchases"): {"purchases.bill.read", "purchases.bill.void", "purchases.bill.write",
                            "purchases.order.write"},
    ("shop", "stock"): {"inventory.stock.adjust", "inventory.stock.read"},
    ("shop", "payments"): {"payments.payment.read", "payments.payment.void", "payments.payment.write",
                           "payments.request.write"},
    ("shop", "expenses"): {"expenses.expense.read", "expenses.expense.void", "expenses.expense.write"},
    ("library", "library_students"): {"library.member.write"},
    ("library", "library_fees"): {"library.fee.create"},
    ("lending", "lending_lend"): {"lending.loan.create"},
    ("lending", "lending_collect"): {"lending.collection.create"},
}  # fmt: skip


def forward(apps, schema_editor):
    Membership = apps.get_model("platform", "Membership")
    MemberAppAccess = apps.get_model("platform", "MemberAppAccess")
    for membership in Membership.objects.exclude(permissions_override={}):
        override = dict(membership.permissions_override or {})
        deny = set(override.get("deny", []))
        moved = set()
        for (app, part), codes in OLD_PARTS.items():
            if codes <= deny:
                row, _ = MemberAppAccess.objects.get_or_create(membership=membership, app=app)
                row.levels = {**(row.levels or {}), part: "off"}
                row.save(update_fields=["levels"])
                moved |= codes
        if moved:
            override["deny"] = [c for c in override.get("deny", []) if c not in moved]
            if not override["deny"]:
                override.pop("deny")
            membership.permissions_override = override
            membership.save(update_fields=["permissions_override"])


class Migration(migrations.Migration):
    dependencies = [("platform", "0028_access_groups")]
    operations = [migrations.RunPython(forward, migrations.RunPython.noop)]
