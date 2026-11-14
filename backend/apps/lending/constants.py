from decimal import Decimal

from django.db import models
from django.utils.translation import gettext_lazy as _


class Frequency(models.TextChoices):
    DAILY = "daily", _("Daily")
    WEEKLY = "weekly", _("Weekly")
    MONTHLY = "monthly", _("Monthly")


class LoanStatus(models.TextChoices):
    ACTIVE = "active", _("Running")
    CLOSED = "closed", _("Closed")


class CloseReason(models.TextChoices):
    PAID = "paid", _("Paid in full")
    WRITTEN_OFF = "written_off", _("Written off")


class PayMode(models.TextChoices):
    CASH = "cash", _("Cash")
    UPI = "upi", _("UPI")


class RowStatus(models.TextChoices):
    LIVE = "live", _("Live")
    REMOVED = "removed", _("Removed")


class StopState(models.TextChoices):
    """A loan on a day, as the round shows it (I8)."""

    LATE = "late", _("Late")
    DUE = "due", _("Due today")
    DONE = "done", _("Collected")
    NOT_PAID = "not", _("Not paid")


class MessageKind(models.TextChoices):
    LATE = "late", _("Late")
    DUE_TODAY = "due_today", _("Due today")
    DUE_TOMORROW = "due_tomorrow", _("Due tomorrow")
    RECEIPT = "receipt", _("Receipt")


MAX_AMOUNT = Decimal("9999999999.99")
MAX_COUNT = 400
NAME_MAX = 120
NOTE_MAX = 200
REASON_MAX = 200
