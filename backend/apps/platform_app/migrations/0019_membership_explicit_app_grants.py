"""Distinguish explicit revocation from never-configured legacy app grants."""

from django.db import migrations, models


def mark_existing_grants(apps, schema_editor):
    Membership = apps.get_model("platform", "Membership")
    Grant = apps.get_model("platform", "MembershipAppGrant")
    alias = schema_editor.connection.alias
    Membership.objects.using(alias).filter(
        pk__in=Grant.objects.using(alias).values("membership_id")
    ).update(app_grants_configured=True)


class Migration(migrations.Migration):
    dependencies = [("platform", "0018_release_khata")]
    operations = [
        migrations.AddField(
            model_name="membership",
            name="app_grants_configured",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(mark_existing_grants, migrations.RunPython.noop),
    ]
