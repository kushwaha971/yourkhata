"""The Library's own tables (docs/revamp/library/01-model-and-api.md).

Rebuilt from scratch on 12 Nov 2026. A library belongs to the business
(tenant). Nothing here points at a Shop table or another app's table: a student
is not a party, a fee is not a ledger entry, an expense is not the Shop's.
"""

from __future__ import annotations

from django.db import models
from django.db.models import Q

from apps.common.db.fields import MoneyField
from apps.common.models import TenantModel
from apps.library.constants import (
    DEFAULT_DUE_SOON_DAYS,
    NAME_MAX,
    NOTE_MAX,
    REASON_MAX,
    ExpenseHead,
    MessageKind,
    PayMode,
    RowStatus,
    StudentStatus,
)


class Shift(TenantModel):
    """Morning, Evening, Full day… A full-day seat is taken in every shift."""

    name = models.CharField(max_length=40)
    starts_at = models.TimeField(null=True, blank=True)
    ends_at = models.TimeField(null=True, blank=True)
    monthly_fee = MoneyField(default=0)
    is_full_day = models.BooleanField(default=False)
    sort = models.PositiveSmallIntegerField(default=0)
    active = models.BooleanField(default=True)

    class Meta:
        db_table = "library_shift"
        ordering = ["sort", "created_at"]


class Seat(TenantModel):
    number = models.PositiveIntegerField()
    active = models.BooleanField(default=True)

    class Meta:
        db_table = "library_seat"
        ordering = ["number"]
        constraints = [
            models.UniqueConstraint(fields=["tenant", "number"], name="uq_library_seat_number"),
        ]


class Student(TenantModel):
    name = models.CharField(max_length=NAME_MAX)
    mobile = models.CharField(max_length=10, blank=True, default="")
    seat = models.ForeignKey(Seat, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    shift = models.ForeignKey(Shift, on_delete=models.PROTECT, related_name="+")
    monthly_fee = MoneyField()
    joined_on = models.DateField()
    # Caches moved only by a payment in the same transaction; `recalc` re-derives them.
    paid_to = models.DateField(null=True, blank=True)
    credit = MoneyField(default=0)
    status = models.CharField(max_length=8, choices=StudentStatus.choices, default=StudentStatus.ACTIVE)
    hold_until = models.DateField(null=True, blank=True)
    note = models.CharField(max_length=NOTE_MAX, blank=True, default="")

    class Meta:
        db_table = "library_student"
        constraints = [
            # A seat in a shift has one student; the full-day rule is the service's.
            models.UniqueConstraint(
                fields=["tenant", "seat", "shift"],
                condition=Q(seat__isnull=False) & ~Q(status=StudentStatus.LEFT),
                name="uq_library_student_seat_shift",
            ),
        ]
        indexes = [
            models.Index(fields=["tenant", "status", "paid_to"], name="ix_library_student_due"),
            models.Index(fields=["tenant", "name"], name="ix_library_student_name"),
        ]


class Payment(TenantModel):
    """One fee paid. Never edited, never deleted (migration 0002's trigger)."""

    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name="payments")
    amount = MoneyField()
    mode = models.CharField(max_length=4, choices=PayMode.choices)
    paid_on = models.DateField()
    # What this payment did to the student: whole months moved and the dates covered.
    months = models.SmallIntegerField(default=0)
    from_date = models.DateField(null=True, blank=True)
    to_date = models.DateField(null=True, blank=True)
    # The student's caches before this row, so a removal can put them back exactly.
    paid_to_before = models.DateField(null=True, blank=True)
    credit_before = MoneyField(default=0)
    status = models.CharField(max_length=8, choices=RowStatus.choices, default=RowStatus.LIVE)
    removes = models.OneToOneField(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="removed_by"
    )
    reason = models.CharField(max_length=REASON_MAX, blank=True, default="")

    class Meta:
        db_table = "library_payment"
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="ck_library_payment_amount_positive"),
        ]
        indexes = [
            models.Index(fields=["student", "-created_at"], name="ix_library_payment_student"),
            models.Index(fields=["tenant", "paid_on"], name="ix_library_payment_day"),
        ]


class Attendance(TenantModel):
    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name="attendance")
    day = models.DateField()
    in_at = models.DateTimeField()
    out_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "library_attendance"
        constraints = [
            models.UniqueConstraint(fields=["student", "day"], name="uq_library_attendance_day"),
        ]
        indexes = [models.Index(fields=["tenant", "day"], name="ix_library_attendance_day")]


class Expense(TenantModel):
    spent_on = models.DateField()
    head = models.CharField(max_length=12, choices=ExpenseHead.choices)
    amount = MoneyField()
    note = models.CharField(max_length=NOTE_MAX, blank=True, default="")
    status = models.CharField(max_length=8, choices=RowStatus.choices, default=RowStatus.LIVE)
    reason = models.CharField(max_length=REASON_MAX, blank=True, default="")

    class Meta:
        db_table = "library_expense"
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="ck_library_expense_amount_positive"),
        ]
        indexes = [models.Index(fields=["tenant", "spent_on"], name="ix_library_expense_day")]


class Book(TenantModel):
    title = models.CharField(max_length=NAME_MAX)
    author = models.CharField(max_length=NAME_MAX, blank=True, default="")
    copies = models.PositiveSmallIntegerField(default=1)
    note = models.CharField(max_length=NOTE_MAX, blank=True, default="")
    # The barcode on the book (its ISBN, or a label the library printed), so the
    # counter scans instead of typing: give and take back by one scan.
    code = models.CharField(max_length=40, blank=True, default="")

    class Meta:
        db_table = "library_book"
        ordering = ["title"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "code"], condition=~Q(code=""), name="uq_library_book_code"
            ),
        ]


class BookIssue(TenantModel):
    """A copy given to a student; out while `back_on` is empty."""

    book = models.ForeignKey(Book, on_delete=models.PROTECT, related_name="issues")
    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name="books")
    given_on = models.DateField()
    back_on = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "library_book_issue"
        indexes = [models.Index(fields=["book", "back_on"], name="ix_library_issue_out")]


class Message(TenantModel):
    """A record that WhatsApp was OPENED with this text. Nothing is sent (DEC-012)."""

    student = models.ForeignKey(Student, on_delete=models.PROTECT, related_name="messages")
    kind = models.CharField(max_length=8, choices=MessageKind.choices)
    text = models.TextField()

    class Meta:
        db_table = "library_message"
        indexes = [models.Index(fields=["tenant", "-created_at"], name="ix_library_message_recent")]


class Settings(models.Model):
    tenant = models.OneToOneField(
        "platform.Tenant", primary_key=True, on_delete=models.RESTRICT, related_name="+"
    )
    sign_as = models.CharField(max_length=NAME_MAX, blank=True, default="")
    upi_id = models.CharField(max_length=60, blank=True, default="")
    due_soon_days = models.PositiveSmallIntegerField(default=DEFAULT_DUE_SOON_DAYS)

    class Meta:
        db_table = "library_settings"
