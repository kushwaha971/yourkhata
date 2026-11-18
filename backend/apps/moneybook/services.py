"""Every write to a Money Book. Money moves only here, inside one transaction
with the person's row locked, so two taps or two tabs can never move it twice
or read a balance half-way."""

from __future__ import annotations

import datetime as dt
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.common.exceptions import BusinessRuleViolation, NotFound, ValidationFailed
from apps.moneybook.constants import MAX_AMOUNT, NAME_MAX, NOTE_MAX, REASON_MAX, EntryKind, EntryStatus
from apps.moneybook.models import Entry, Person

IST = ZoneInfo("Asia/Kolkata")


def today() -> dt.date:
    return timezone.now().astimezone(IST).date()


# ── people ──────────────────────────────────────────────────────────────────


def _clean_name(name: Any) -> str:
    value = " ".join(str(name or "").split())
    if not value:
        raise ValidationFailed(details={"name": [_("Enter a name.")]})
    if len(value) > NAME_MAX:
        raise ValidationFailed(details={"name": [_("Use 120 letters or fewer.")]})
    return value


def _clean_mobile(mobile: Any) -> str:
    digits = "".join(ch for ch in str(mobile or "") if ch.isdigit())
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if digits and (len(digits) != 10 or digits[0] not in "6789"):
        raise ValidationFailed(details={"mobile": [_("Enter a 10-digit mobile number.")]})
    return digits


def _same_name(owner: Any, name: str, *, exclude: Any = None) -> Person | None:
    rows = Person.objects.filter(owner=owner, archived_at__isnull=True, name__iexact=name)
    if exclude is not None:
        rows = rows.exclude(pk=exclude)
    return rows.first()


def _person_exists(existing: Person) -> BusinessRuleViolation:
    return BusinessRuleViolation(
        "person_exists",
        _("%(name)s is already in your book.") % {"name": existing.name},
        details={"id": str(existing.pk)},
    )


def create_person(*, owner: Any, name: Any, mobile: Any = "") -> Person:
    clean = _clean_name(name)
    existing = _same_name(owner, clean)
    if existing:
        raise _person_exists(existing)
    try:
        with transaction.atomic():
            return Person.objects.create(owner=owner, name=clean, mobile=_clean_mobile(mobile))
    except IntegrityError:
        # Two taps on two devices: the unique index decided, so say who won.
        raise _person_exists(_same_name(owner, clean)) from None


def get_person(*, owner: Any, person_id: Any, lock: bool = False) -> Person:
    rows = Person.objects.filter(owner=owner, pk=person_id)
    if lock:
        rows = rows.select_for_update()
    person = rows.first()
    if person is None:
        raise NotFound(_("This person is not in your book."))
    return person


def update_person(*, owner: Any, person_id: Any, data: dict) -> Person:
    with transaction.atomic():
        person = get_person(owner=owner, person_id=person_id, lock=True)
        if "name" in data:
            clean = _clean_name(data["name"])
            existing = _same_name(owner, clean, exclude=person.pk)
            if existing and person.archived_at is None:
                raise _person_exists(existing)
            person.name = clean
        if "mobile" in data:
            person.mobile = _clean_mobile(data["mobile"])
        person.save()
        return person


def archive_person(*, owner: Any, person_id: Any) -> Person:
    """Refused unless the balance is exactly ₹0.00 — no tolerance band."""
    with transaction.atomic():
        person = get_person(owner=owner, person_id=person_id, lock=True)
        if person.balance != 0:
            raise BusinessRuleViolation(
                "balance_not_settled",
                _("Settle %(name)s's money first. Only a person at ₹0 can be put away.")
                % {"name": person.name},
                details={"balance": str(person.balance)},
            )
        if person.archived_at is None:
            person.archived_at = timezone.now()
            person.save(update_fields=["archived_at", "updated_at"])
        return person


def restore_person(*, owner: Any, person_id: Any) -> Person:
    with transaction.atomic():
        person = get_person(owner=owner, person_id=person_id, lock=True)
        if person.archived_at is not None:
            existing = _same_name(owner, person.name, exclude=person.pk)
            if existing:
                raise _person_exists(existing)
            person.archived_at = None
            person.save(update_fields=["archived_at", "updated_at"])
        return person


# ── entries ─────────────────────────────────────────────────────────────────


def _clean_entry(data: dict) -> dict:
    errors: dict[str, list[str]] = {}
    kind = data.get("kind")
    if kind not in EntryKind.values:
        errors["kind"] = [_("Choose Gave money or Got money.")]
    try:
        amount = Decimal(str(data.get("amount", "")).replace(",", "")).quantize(Decimal("0.01"))
    except Exception:  # noqa: BLE001 - any unparsable input is the same answer
        amount = None
    if amount is None or not amount.is_finite() or amount <= 0:
        errors["amount"] = [_("Enter an amount more than ₹0.")]
    elif amount > MAX_AMOUNT:
        errors["amount"] = [_("That is too large. Check the zeros.")]
    note = " ".join(str(data.get("note") or "").split())
    if len(note) > NOTE_MAX:
        errors["note"] = [_("Use 200 letters or fewer.")]
    raw_date = data.get("entry_date")
    entry_date = today()
    if raw_date:
        try:
            entry_date = dt.date.fromisoformat(str(raw_date))
        except ValueError:
            errors["entry_date"] = [_("Choose a date.")]
        else:
            if entry_date > today():
                errors["entry_date"] = [_("The date cannot be after today.")]
    if errors:
        raise ValidationFailed(details=errors)
    return {"kind": kind, "amount": amount, "note": note, "entry_date": entry_date}


def _signed(kind: str, amount: Decimal) -> Decimal:
    return amount if kind == EntryKind.GAVE else -amount


def preview_entry(*, owner: Any, person_id: Any, data: dict) -> dict:
    """The sheet's "After this: ₹8,000 to get" — the same rule as a save."""
    clean = _clean_entry(data)
    person = get_person(owner=owner, person_id=person_id)
    return {"balance": person.balance, "balance_after": person.balance + _signed(clean["kind"], clean["amount"])}


def _refresh_last(person: Person) -> None:
    last = (
        Entry.objects.filter(person=person, status=EntryStatus.LIVE, removes__isnull=True)
        .order_by("-entry_date", "-sort_at", "-id")
        .first()
    )
    person.last_entry_at = last.created_at if last else None
    person.last_entry_date = last.entry_date if last else None
    person.last_entry_note = last.note if last else ""


def _post(
    person: Person, *, kind: str, amount: Decimal, note: str, entry_date: dt.date, sort_at: Any = None, **extra: Any
) -> Entry:
    entry = Entry.objects.create(
        owner_id=person.owner_id, person=person, kind=kind, amount=amount, note=note,
        entry_date=entry_date, sort_at=sort_at or timezone.now(), **extra,
    )
    person.balance += _signed(kind, amount)
    return entry


def _must_be_in_book(person: Person) -> None:
    """A person put away is at ₹0 and stays there: no entry is added, removed or
    corrected until they are brought back."""
    if person.archived_at is not None:
        raise BusinessRuleViolation(
            "person_archived", _("%(name)s is put away. Bring them back first.") % {"name": person.name}
        )


def add_entry(*, owner: Any, person_id: Any, data: dict) -> Entry:
    clean = _clean_entry(data)
    with transaction.atomic():
        person = get_person(owner=owner, person_id=person_id, lock=True)
        _must_be_in_book(person)
        entry = _post(person, **clean)
        _refresh_last(person)
        person.save()
        return entry


def _clean_reason(reason: Any) -> str:
    value = " ".join(str(reason or "").split())
    if len(value) > REASON_MAX:
        raise ValidationFailed(details={"reason": [_("Use 200 letters or fewer.")]})
    return value


def _undo(person: Person, original: Entry, reason: str) -> Entry:
    """The removal row: the opposite of the original, pointing back at it."""
    if original.status != EntryStatus.LIVE or original.removes_id is not None:
        raise BusinessRuleViolation("entry_already_reversed", _("This entry was already removed."))
    opposite = EntryKind.GOT if original.kind == EntryKind.GAVE else EntryKind.GAVE
    removal = _post(
        person, kind=opposite, amount=original.amount, note="", entry_date=original.entry_date,
        removes=original, reason=reason, status=EntryStatus.REMOVED, sort_at=original.sort_at,
    )
    # The one change a posted entry may take (the trigger allows status only).
    Entry.objects.filter(pk=original.pk).update(status=EntryStatus.REMOVED)
    return removal


def _locked_entry(owner: Any, entry_id: Any) -> tuple[Person, Entry]:
    entry = Entry.objects.filter(owner=owner, pk=entry_id).first()
    if entry is None:
        raise NotFound(_("This entry is not in your book."))
    person = get_person(owner=owner, person_id=entry.person_id, lock=True)
    _must_be_in_book(person)
    entry = Entry.objects.get(pk=entry.pk)  # re-read under the person's lock
    return person, entry


def remove_entry(*, owner: Any, entry_id: Any, reason: Any = "") -> Entry:
    with transaction.atomic():
        person, original = _locked_entry(owner, entry_id)
        removal = _undo(person, original, _clean_reason(reason))
        _refresh_last(person)
        person.save()
        return removal


def replace_entry(*, owner: Any, entry_id: Any, data: dict) -> Entry:
    """A correction: undo the original and post the right one, together."""
    clean = _clean_entry(data)
    with transaction.atomic():
        person, original = _locked_entry(owner, entry_id)
        reason = _clean_reason(data.get("reason"))
        _undo(person, original, reason)
        replacement = _post(person, **clean, replaces=original, reason=reason, sort_at=original.sort_at)
        _refresh_last(person)
        person.save()
        return replacement


def recalc_balance(person: Person) -> Decimal:
    """The balance from every row, by a different route from the cache."""
    sums = {
        row["kind"]: row["total"]
        for row in Entry.objects.filter(person=person).values("kind").annotate(total=Sum("amount"))
    }
    return (sums.get(EntryKind.GAVE) or Decimal("0")) - (sums.get(EntryKind.GOT) or Decimal("0"))
