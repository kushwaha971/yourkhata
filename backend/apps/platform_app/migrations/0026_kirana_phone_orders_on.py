"""G11: a kirana made before phone orders and loose-by-amount existed gets them too."""

from django.db import migrations


def forwards(apps, schema_editor):
    Tenant = apps.get_model("platform", "Tenant")
    TenantSetting = apps.get_model("platform", "TenantSetting")
    for tenant in Tenant.objects.filter(business_type="kirana"):
        for key in ("phone_orders", "loose_amount"):
            TenantSetting.objects.get_or_create(
                tenant=tenant, key=f"shop.features.{key}", defaults={"value": {"value": True}}
            )


class Migration(migrations.Migration):
    dependencies = [("platform", "0025_food_cafe_orders_on")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
