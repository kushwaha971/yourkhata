"""The Money Book's own tables (docs/revamp/moneybook/01-model-and-api.md).

Every row carries `owner` — the signed-in person whose book it is. There is no
tenant: the book follows its owner across businesses and no business can read
it (R-DEC-45/46). Nothing here points at a Shop table.
"""

from __future__ import annotations

from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

from apps.common.db.fields import MoneyField, uuid7_pk
from apps.common.models import TimeStampedModel
from apps.moneybook.constants import (
    DEFAULT_OLD_DUES_DAYS,
    NAME_MAX,
    NOTE_MAX,
    REASON_MAX,
    EntryKind,
    EntryStatus,
    ReminderChannel,
    ReminderTone,
)


class Person(TimeStampedModel):
    """Somebody the owner keeps money with: a friend, the milkman, a sister."""

    id = uuid7_pk()
    owner = models.ForeignKey("platform.User", on_delete=models.PROTECT, related_name="+")
    name = models.CharField(max_length=NAME_MAX)
    mobile = models.CharField(max_length=10, blank=True, default="")
    # + they owe the owner (to get), − the owner owes them (to give). A cache,
    # moved only by an entry in the same transaction; `recalc_balance` re-derives it.
    balance = MoneyField(default=0)
    last_entry_at = models.DateTimeField(null=True, blank=True)
    # The last live entry's date and note, for the list's "Today · Rent share".
    last_entry_date = models.DateField(null=True, blank=True)
    last_entry_note = models.CharField(max_length=NOTE_MAX, blank=True, default="")
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "moneybook_person"
        constraints = [
            models.UniqueConstraint(
                "owner",
                Lower("name"),
                condition=Q(archived_at__isnull=True),
                name="uq_moneybook_person_active_name",
            ),
        ]
        indexes = [
            models.Index(
                "owner",
                models.F("last_entry_at").desc(nulls_last=True),
                "id",
                name="ix_moneybook_person_recent",
            ),
        ]


class Entry(models.Model):
    """One amount given or got. Never edited, never deleted (migration 0001's
    trigger): a mistake is undone by a removal row, which is the history."""

    id = uuid7_pk()
    owner = models.ForeignKey("platform.User", on_delete=models.PROTECT, related_name="+")
    person = models.ForeignKey(Person, on_delete=models.PROTECT, related_name="entries")
    kind = models.CharField(max_length=4, choices=EntryKind.choices)
    amount = MoneyField()
    note = models.CharField(max_length=NOTE_MAX, blank=True, default="")
    entry_date = models.DateField()
    status = models.CharField(max_length=8, choices=EntryStatus.choices, default=EntryStatus.LIVE)
    # Set on a removal row: the entry it undoes.
    removes = models.OneToOneField(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="removed_by"
    )
    # Set on the new entry of a correction: the entry it replaces.
    replaces = models.OneToOneField(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="replaced_by"
    )
    reason = models.CharField(max_length=REASON_MAX, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    # Where the entry sits within its day. A correction's new entry takes the
    # place of the one it replaces: ordered by its own later created_at, every
    # entry typed in between showed a balance that was never true ("Bal ₹400
    # to give" for a person who never owed — the old book, 11 Nov round).
    sort_at = models.DateTimeField()

    class Meta:
        db_table = "moneybook_entry"
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="ck_moneybook_entry_amount_positive"),
        ]
        indexes = [
            models.Index(
                "person", "entry_date", "sort_at", "id", name="ix_moneybook_entry_order"
            ),
            models.Index("owner", "entry_date", name="ix_moneybook_entry_owner_date"),
        ]

    @property
    def signed(self):  # noqa: ANN201 - Decimal
        """What this entry does to the balance: gave adds (they owe more)."""
        return self.amount if self.kind == EntryKind.GAVE else -self.amount


class Reminder(models.Model):
    """A record that the owner OPENED WhatsApp or SMS with this text.

    Nothing is sent by the product (DEC-012); this is the owner's own log, so
    "Reminded 2 days ago" is something they did, not something we claim.
    """

    id = uuid7_pk()
    owner = models.ForeignKey("platform.User", on_delete=models.PROTECT, related_name="+")
    person = models.ForeignKey(Person, on_delete=models.PROTECT, related_name="reminders")
    tone = models.CharField(max_length=10, choices=ReminderTone.choices)
    channel = models.CharField(max_length=8, choices=ReminderChannel.choices)
    text = models.TextField()
    attached_report = models.BooleanField(default=False)
    opened_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "moneybook_reminder"
        indexes = [models.Index(fields=["owner", "-opened_at"], name="ix_moneybook_reminder_recent")]


class Settings(models.Model):
    """One row per owner: the words a reminder is signed with."""

    owner = models.OneToOneField(
        "platform.User", primary_key=True, on_delete=models.PROTECT, related_name="+"
    )
    upi_id = models.CharField(max_length=60, blank=True, default="")
    sign_as = models.CharField(max_length=NAME_MAX, blank=True, default="")
    old_dues_days = models.PositiveSmallIntegerField(default=DEFAULT_OLD_DUES_DAYS)

    class Meta:
        db_table = "moneybook_settings"
