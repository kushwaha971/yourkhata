"""The old private Money Book is gone (owner, 11 Nov 2026).

It was a hidden extra business per user whose people and entries lived in the
Shop's tables. The Money Book is now its own app (`apps/moneybook`) with its own
tables, so this link table goes. `manage.py purge_personal_books --apply` (the
commit before this one) removed every such book and its rows first; this
migration refuses to run while any row is left rather than orphan a hidden
business.
"""

from django.db import migrations


def refuse_if_books_remain(apps, schema_editor):
    if apps.get_model("parties", "PersonalBook").objects.exists():
        raise RuntimeError(
            "Private books still exist. Run `manage.py purge_personal_books --apply` "
            "from the commit before this migration, then migrate again."
        )


class Migration(migrations.Migration):
    dependencies = [("parties", "0014_custom_order")]
    operations = [
        migrations.RunPython(refuse_if_books_remain, migrations.RunPython.noop),
        migrations.DeleteModel(name="PersonalBook"),
    ]
