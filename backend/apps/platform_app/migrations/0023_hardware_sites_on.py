"""G7: a hardware shop made before sites existed gets them too; it can turn them off."""

from django.db import migrations


def forwards(apps, schema_editor):
    Tenant = apps.get_model("platform", "Tenant")
    TenantSetting = apps.get_model("platform", "TenantSetting")
    for tenant in Tenant.objects.filter(business_type="hardware"):
        TenantSetting.objects.get_or_create(
            tenant=tenant, key="shop.features.sites", defaults={"value": {"value": True}}
        )


class Migration(migrations.Migration):
    dependencies = [("platform", "0022_kind_features_on")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
