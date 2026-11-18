from decimal import Decimal

from django.db import models
from django.utils.translation import gettext_lazy as _


class StudentStatus(models.TextChoices):
    ACTIVE = "active", _("Active")
    HOLD = "hold", _("On hold")
    LEFT = "left", _("Left")


class FeeStatus(models.TextChoices):
    """One per student, decided in this order: hold, over, part, soon, paid."""

    HOLD = "hold", _("On hold")
    PART = "part", _("Part paid")
    OVER = "over", _("Overdue")
    SOON = "soon", _("Due soon")
    PAID = "paid", _("Paid")


class PayMode(models.TextChoices):
    CASH = "cash", _("Cash")
    UPI = "upi", _("UPI")


class RowStatus(models.TextChoices):
    LIVE = "live", _("Live")
    # Undone by a removal row; kept for ever.
    REMOVED = "removed", _("Removed")


class MessageKind(models.TextChoices):
    FEE_DUE = "fee_due", _("Fee reminder")
    RECEIPT = "receipt", _("Receipt")
    WELCOME = "welcome", _("Welcome")


class ExpenseHead(models.TextChoices):
    RENT = "rent", _("Rent")
    ELECTRICITY = "electricity", _("Electricity")
    INTERNET = "internet", _("Internet")
    SALARY = "salary", _("Salary")
    CLEANING = "cleaning", _("Cleaning")
    OTHER = "other", _("Other")


MAX_AMOUNT = Decimal("9999999999.99")
NAME_MAX = 120
NOTE_MAX = 200
REASON_MAX = 200
DEFAULT_DUE_SOON_DAYS = 7
MAX_SEATS = 500
MAX_SHIFTS = 6
