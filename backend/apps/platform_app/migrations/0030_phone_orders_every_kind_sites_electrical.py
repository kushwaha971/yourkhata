"""Owner, 14 Nov 2026: businesses made before this get the new defaults too.

Phone orders for every kind of shop, and Sites for an electrical shop. A switch
the owner already set either way is kept, so nobody's choice is undone.
"""

from django.db import migrations


def forwards(apps, schema_editor):
    Tenant = apps.get_model("platform", "Tenant")
    TenantSetting = apps.get_model("platform", "TenantSetting")
    for tenant in Tenant.objects.all():
        keys = ["phone_orders"] + (["sites"] if tenant.business_type == "electronics" else [])
        for key in keys:
            TenantSetting.objects.get_or_create(
                tenant=tenant, key=f"shop.features.{key}", defaults={"value": {"value": True}}
            )


class Migration(migrations.Migration):
    dependencies = [("platform", "0029_move_hidden_parts_to_levels")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
