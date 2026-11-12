"""Loans & Collections' own tables (docs/revamp/lending/01-model-and-api.md).

Rebuilt from scratch on 12 Nov 2026. A lender belongs to the business (tenant).
Nothing here points at a Shop table or another app's: a borrower is not a
party, a collection is not a payment, a schedule is not a dues schedule.
"""

from __future__ import annotations

from django.db import models
from django.db.models import Q

from apps.common.db.fields import MoneyField
from apps.common.models import TenantModel
from apps.lending.constants import (
    NAME_MAX,
    NOTE_MAX,
    REASON_MAX,
    CloseReason,
    Frequency,
    LoanStatus,
    MessageKind,
    PayMode,
    RowStatus,
)


class Route(TenantModel):
    name = models.CharField(max_length=NAME_MAX)
    sort = models.PositiveSmallIntegerField(default=0)
    active = models.BooleanField(default=True)

    class Meta:
        db_table = "lending_route"
        ordering = ["sort", "name"]


class Borrower(TenantModel):
    name = models.CharField(max_length=NAME_MAX)
    mobile = models.CharField(max_length=10, blank=True, default="")
    # What they do, as the round names them: "Tea stall", "Vegetables".
    work = models.CharField(max_length=NAME_MAX, blank=True, default="")
    route = models.ForeignKey(Route, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    note = models.CharField(max_length=NOTE_MAX, blank=True, default="")
    active = models.BooleanField(default=True)

    class Meta:
        db_table = "lending_borrower"
        indexes = [models.Index(fields=["tenant", "name"], name="ix_lending_borrower_name")]


class Loan(TenantModel):
    number = models.CharField(max_length=16)
    borrower = models.ForeignKey(Borrower, on_delete=models.PROTECT, related_name="loans")
    route = models.ForeignKey(Route, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    lent = MoneyField()
    charges = MoneyField(default=0)
    frequency = models.CharField(max_length=8, choices=Frequency.choices)
    count = models.PositiveSmallIntegerField()
    each = MoneyField()
    starts_on = models.DateField()
    skip_sundays = models.BooleanField(default=True)
    status = models.CharField(max_length=8, choices=LoanStatus.choices, default=LoanStatus.ACTIVE)
    closed_on = models.DateField(null=True, blank=True)
    close_reason = models.CharField(max_length=12, choices=CloseReason.choices, blank=True, default="")
    note = models.CharField(max_length=NOTE_MAX, blank=True, default="")

    class Meta:
        db_table = "lending_loan"
        constraints = [
            models.UniqueConstraint(fields=["tenant", "number"], name="uq_lending_loan_number"),
            models.CheckConstraint(condition=Q(lent__gt=0) & Q(each__gt=0) & Q(charges__gte=0), name="ck_lending_loan_amounts"),
        ]
        indexes = [models.Index(fields=["tenant", "status", "route"], name="ix_lending_loan_round")]


class Due(TenantModel):
    """One row of the schedule, written once with the loan."""

    loan = models.ForeignKey(Loan, on_delete=models.PROTECT, related_name="dues")
    seq = models.PositiveSmallIntegerField()
    due_on = models.DateField()
    amount = MoneyField()

    class Meta:
        db_table = "lending_due"
        ordering = ["seq"]
        constraints = [models.UniqueConstraint(fields=["loan", "seq"], name="uq_lending_due_seq")]
        indexes = [models.Index(fields=["tenant", "due_on"], name="ix_lending_due_day")]


class Collection(TenantModel):
    """Money collected on a loan. Never edited, never deleted (migration 0002)."""

    loan = models.ForeignKey(Loan, on_delete=models.PROTECT, related_name="collections")
    amount = MoneyField()
    mode = models.CharField(max_length=4, choices=PayMode.choices)
    collected_on = models.DateField()
    status = models.CharField(max_length=8, choices=RowStatus.choices, default=RowStatus.LIVE)
    removes = models.OneToOneField("self", null=True, blank=True, on_delete=models.PROTECT, related_name="removed_by")
    reason = models.CharField(max_length=REASON_MAX, blank=True, default="")

    class Meta:
        db_table = "lending_collection"
        constraints = [models.CheckConstraint(condition=Q(amount__gt=0), name="ck_lending_collection_positive")]
        indexes = [
            models.Index(fields=["loan", "collected_on"], name="ix_lending_collection_loan"),
            models.Index(fields=["tenant", "collected_on"], name="ix_lending_collection_day"),
        ]


class Visit(TenantModel):
    """A "Not paid" at the door, with why and when they promised."""

    loan = models.ForeignKey(Loan, on_delete=models.PROTECT, related_name="visits")
    day = models.DateField()
    reason = models.CharField(max_length=REASON_MAX, blank=True, default="")
    promised_on = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "lending_visit"
        constraints = [models.UniqueConstraint(fields=["loan", "day"], name="uq_lending_visit_day")]


class Message(TenantModel):
    """A record that WhatsApp was OPENED with this text. Nothing is sent (DEC-012)."""

    loan = models.ForeignKey(Loan, on_delete=models.PROTECT, related_name="messages")
    kind = models.CharField(max_length=12, choices=MessageKind.choices)
    text = models.TextField()

    class Meta:
        db_table = "lending_message"
        indexes = [models.Index(fields=["tenant", "-created_at"], name="ix_lending_message_recent")]


class Settings(models.Model):
    tenant = models.OneToOneField("platform.Tenant", primary_key=True, on_delete=models.RESTRICT, related_name="+")
    sign_as = models.CharField(max_length=NAME_MAX, blank=True, default="")
    upi_id = models.CharField(max_length=60, blank=True, default="")

    class Meta:
        db_table = "lending_settings"
