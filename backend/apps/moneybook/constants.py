from decimal import Decimal

from django.db import models
from django.utils.translation import gettext_lazy as _


class EntryKind(models.TextChoices):
    """The two things that happen in a Money Book, in the book's own words."""

    GAVE = "gave", _("Gave money")
    GOT = "got", _("Got money")


class EntryStatus(models.TextChoices):
    LIVE = "live", _("Live")
    # Undone by a removal row; kept for ever, shown only on request.
    REMOVED = "removed", _("Removed")


class ReminderTone(models.TextChoices):
    POLITE = "polite", _("Polite")
    DUE_DATE = "due_date", _("Due date")
    THANK_YOU = "thank_you", _("Thank you")


class ReminderChannel(models.TextChoices):
    WHATSAPP = "whatsapp", _("WhatsApp")
    SMS = "sms", _("SMS")


#: The largest single entry: a typo of extra zeros (E7) is refused, not stored.
MAX_AMOUNT = Decimal("9999999999.99")
NAME_MAX = 120
NOTE_MAX = 200
REASON_MAX = 200
DEFAULT_OLD_DUES_DAYS = 30
