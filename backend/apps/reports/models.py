"""Models for the reports app.

Read-only projections over other apps' selectors — plus the two tables this app
writes: `reports_export`, a file somebody asked for that was too big to stream
in the request (Part 21 §21.3.11, IMP-02 FR-6/FR-7), and `reports_snapshot`,
a computed report kept for a short while so the next reader does not pay for
it again (CR-106, RPT-01 FR-1).
"""

from __future__ import annotations

from django.db import models

from apps.common.models import ImmutableModel, TenantModel


class ExportStatus(models.TextChoices):
    """§17.8.0's export vocabulary, verbatim."""

    QUEUED = "queued", "Queued"
    RUNNING = "running", "Running"
    READY = "ready", "Ready"
    FAILED = "failed", "Failed"
    EXPIRED = "expired", "Expired"


class Export(TenantModel):
    """One queued export (§21.3.11 plus CR-098's accepted columns).

    `params` holds what the scheduler needs to rebuild the file — the list's
    filters, the columns the requester was allowed, the view that owns the
    list and the codename a download re-checks — and, on failure, the error.
    The row survives its file's expiry as history (BR-6).
    """

    report_name = models.CharField(max_length=64)
    #: CR-098 — the list resource for `report_name = 'list:{resource}'`.
    resource = models.CharField(max_length=32, null=True, blank=True)
    params = models.JSONField(default=dict, blank=True)
    format = models.CharField(max_length=8, default="csv")
    status = models.CharField(
        max_length=16, choices=ExportStatus.choices, default=ExportStatus.QUEUED
    )
    file_attachment = models.ForeignKey(
        "files.Attachment", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    row_count = models.IntegerField(null=True, blank=True)
    #: CR-098.
    size_bytes = models.BigIntegerField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "reports_export"
        verbose_name = "export"
        verbose_name_plural = "exports"
        indexes = [
            models.Index(fields=["tenant", "-created_at"], name="ix_export_tenant_created"),
            models.Index(fields=["status", "expires_at"], name="ix_export_status_expires"),
        ]

    def __str__(self) -> str:
        return f"{self.report_name}:{self.id}:{self.status}"


class Snapshot(TenantModel):
    """One computed report, held for re-use (CR-106's columns, verbatim).

    RPT-01 is the first writer: the dashboard's whole payload, one row per
    tenant per business day, fresh for sixty seconds (`computed_at`) and
    deleted the moment a write lands that could move one of its figures
    (`apps.reports.signals`). A row is a CACHE and never a record: deleting
    every row in this table loses nothing but the next request's speed, which
    is why PLT-10's full export leaves it out.

    `params_hash` is what the payload was computed FOR. The dashboard stores
    the unfiltered, all-permissions payload once and trims it per reader on the
    way out, so its hash names the payload's shape version rather than a
    reader — two members of one shop share one row, and neither can be served
    the other's view because the trim runs on every response.
    """

    report_name = models.CharField(max_length=64)
    as_of = models.DateField()
    params_hash = models.CharField(max_length=64)
    payload = models.JSONField(default=dict)
    row_count = models.IntegerField(null=True, blank=True)
    computed_at = models.DateTimeField()

    class Meta:
        db_table = "reports_snapshot"
        verbose_name = "report snapshot"
        verbose_name_plural = "report snapshots"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "report_name", "as_of", "params_hash"],
                name="uq_reports_snapshot",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover - admin convenience
        return f"{self.report_name}:{self.as_of}:{self.computed_at:%H:%M:%S}"


class CashCount(TenantModel, ImmutableModel):
    """BP-17 (R-DEC-26) — the Shop's drawer as somebody COUNTED it, once.

    An observation, never a posting. `expected_amount` is the Shop's cash by
    its records (`money_position`, the day book's and the Home tile's one
    definition) computed by the server inside the same transaction that writes
    the row, so it is the figure the count was compared with and never a tile
    the browser had been holding. `variance` is `counted - expected`, stored
    so the history reads exactly what the merchant was shown; a CHECK keeps
    the three in step.

    Nothing else moves: no ledger line, no cash payment, no opening balance,
    no adjustment. A short or over drawer is something the owner reads and
    decides about; turning it into money would need its own business rule.
    Append-only, by the model and by a trigger (migration 0003).
    """

    business_date = models.DateField()
    counted_amount = models.DecimalField(max_digits=14, decimal_places=2)
    expected_amount = models.DecimalField(max_digits=14, decimal_places=2)
    variance = models.DecimalField(max_digits=14, decimal_places=2)
    note = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        db_table = "reports_cash_count"
        verbose_name = "cash count"
        verbose_name_plural = "cash counts"
        indexes = [
            models.Index(fields=["tenant", "-created_at"], name="ix_cash_count_tenant_created"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(counted_amount__gte=0), name="ck_cash_count_counted_nonneg"
            ),
            models.CheckConstraint(
                condition=models.Q(
                    variance=models.F("counted_amount") - models.F("expected_amount")
                ),
                name="ck_cash_count_variance",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover - admin convenience
        return f"cash count {self.business_date} {self.counted_amount}"
