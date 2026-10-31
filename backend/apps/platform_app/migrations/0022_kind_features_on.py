"""A–D certification: a medical store keeps batches, a clothes shop sizes.

The presets for medical and garments started without them, and the sign-up
wizard asks these switches only of the "Other" kinds, so every medical and
clothes business made before this carries a `false` it never chose. Turned on
here; a business can still turn either off in its settings.
"""

from django.db import migrations

KIND_FEATURE = {"medical": "batches", "garments": "variants"}


def forwards(apps, schema_editor):
    TenantSetting = apps.get_model("platform", "TenantSetting")
    for kind, feature in KIND_FEATURE.items():
        TenantSetting.objects.filter(
            tenant__business_type=kind,
            key=f"shop.features.{feature}",
            value={"value": False},
        ).update(value={"value": True})


class Migration(migrations.Migration):
    dependencies = [("platform", "0021_business_type_other_kinds")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
