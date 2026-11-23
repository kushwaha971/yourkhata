"""BP-17 — `reports_cash_count`, append-only by trigger as well as by the model.

`ImmutableModel` stops `save()`/`delete()`; `QuerySet.update()`, `.delete()` and
raw SQL bypass it, so the guarantee is this trigger (the ledger's reasoning,
`ledger/migrations/0002`). Unlike `ledger_entry` nothing at all may change: a
count is never corrected in place, a new count is the correction. A tenant
deletion job that must remove these rows disables the trigger in its own code.
"""

import django.db.models.deletion
import django.db.models.expressions
from django.conf import settings
from django.db import migrations, models

import apps.common.db.fields

FORBID = """
CREATE OR REPLACE FUNCTION reports_cash_count_forbid_change() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'reports_cash_count is append-only: record a new count instead'
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reports_cash_count_forbid_update_delete
    BEFORE UPDATE OR DELETE ON reports_cash_count
    FOR EACH ROW EXECUTE FUNCTION reports_cash_count_forbid_change();
"""

DROP = """
DROP TRIGGER IF EXISTS reports_cash_count_forbid_update_delete ON reports_cash_count;
DROP FUNCTION IF EXISTS reports_cash_count_forbid_change();
"""


class Migration(migrations.Migration):

    dependencies = [
        ("platform", "0019_membership_explicit_app_grants"),
        ("reports", "0002_snapshot"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CashCount",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "id",
                    models.UUIDField(
                        default=apps.common.db.fields.uuid7,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("business_date", models.DateField()),
                ("counted_amount", models.DecimalField(decimal_places=2, max_digits=14)),
                ("expected_amount", models.DecimalField(decimal_places=2, max_digits=14)),
                ("variance", models.DecimalField(decimal_places=2, max_digits=14)),
                ("note", models.CharField(blank=True, default="", max_length=200)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.RESTRICT,
                        related_name="+",
                        to="platform.tenant",
                    ),
                ),
            ],
            options={
                "verbose_name": "cash count",
                "verbose_name_plural": "cash counts",
                "db_table": "reports_cash_count",
                "indexes": [
                    models.Index(
                        fields=["tenant", "-created_at"], name="ix_cash_count_tenant_created"
                    )
                ],
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(("counted_amount__gte", 0)),
                        name="ck_cash_count_counted_nonneg",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(
                            (
                                "variance",
                                django.db.models.expressions.CombinedExpression(
                                    models.F("counted_amount"), "-", models.F("expected_amount")
                                ),
                            )
                        ),
                        name="ck_cash_count_variance",
                    ),
                ],
            },
        ),
        migrations.RunSQL(FORBID, DROP),
    ]
