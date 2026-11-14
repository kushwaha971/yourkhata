"""G9: a wholesale or distribution business made before schemes existed gets them too."""

from django.db import migrations


def forwards(apps, schema_editor):
    Tenant = apps.get_model("platform", "Tenant")
    TenantSetting = apps.get_model("platform", "TenantSetting")
    for tenant in Tenant.objects.filter(business_type__in=["wholesale", "distribution"]):
        TenantSetting.objects.get_or_create(
            tenant=tenant, key="shop.features.schemes", defaults={"value": {"value": True}}
        )


class Migration(migrations.Migration):
    dependencies = [("platform", "0023_hardware_sites_on")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
