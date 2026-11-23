"""G10: a sweets, bakery or café business made before open orders existed gets them too."""

from django.db import migrations


def forwards(apps, schema_editor):
    Tenant = apps.get_model("platform", "Tenant")
    TenantSetting = apps.get_model("platform", "TenantSetting")
    for tenant in Tenant.objects.filter(business_type="food"):
        TenantSetting.objects.get_or_create(
            tenant=tenant, key="shop.features.cafe_orders", defaults={"value": {"value": True}}
        )


class Migration(migrations.Migration):
    dependencies = [("platform", "0024_wholesale_schemes_on")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
