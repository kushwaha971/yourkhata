"""`/api/v1/moneybook/…` — the Money Book's API (01-model-and-api.md).

Every view answers for the SIGNED-IN person's own book and nobody else's: the
owner is `request.user`, never a parameter. A support session (impersonation)
is refused outright: this is a private book.
"""

from __future__ import annotations

import csv
import datetime as dt
import io
from typing import Any

from django.http import HttpResponse
from django.utils.translation import gettext as _
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.common.exceptions import BusinessRuleViolation, ValidationFailed
from apps.common.idempotency import idempotent
from apps.common.responses import StandardResponse
from apps.moneybook import selectors, services
from apps.moneybook.constants import ReminderChannel, ReminderTone
from apps.moneybook.models import Entry, Person, Reminder, Settings
from apps.moneybook.reminders import reminder_text

PAGE_SIZE = 25
PAGE_MAX = 100


def person_json(p: Person) -> dict:
    return {
        "id": str(p.pk),
        "name": p.name,
        "mobile": p.mobile,
        "balance": f"{p.balance:.2f}",
        "last_entry_at": p.last_entry_at.isoformat() if p.last_entry_at else None,
        "last_entry_date": p.last_entry_date.isoformat() if p.last_entry_date else None,
        "last_entry_note": p.last_entry_note,
        "archived": p.archived_at is not None,
        "since": p.created_at.date().isoformat(),
    }


def entry_json(e: Entry) -> dict:
    data = {
        "id": str(e.pk),
        "person_id": str(e.person_id),
        "kind": e.kind,
        "amount": f"{e.amount:.2f}",
        "note": e.note,
        "entry_date": e.entry_date.isoformat(),
        "status": e.status,
        "removes_id": str(e.removes_id) if e.removes_id else None,
        "replaces_id": str(e.replaces_id) if e.replaces_id else None,
        "reason": e.reason,
        "created_at": e.created_at.isoformat(),
    }
    if hasattr(e, "balance_after"):
        data["balance_after"] = f"{e.balance_after:.2f}"
    return data


def reminder_json(r: Reminder) -> dict:
    return {
        "id": str(r.pk),
        "person_id": str(r.person_id),
        "person_name": r.person.name,
        "tone": r.tone,
        "channel": r.channel,
        "text": r.text,
        "attached_report": r.attached_report,
        "opened_at": r.opened_at.isoformat(),
    }


def _page(request: Any) -> tuple[int, int]:
    try:
        page = max(1, int(request.query_params.get("page", 1)))
        size = min(PAGE_MAX, max(1, int(request.query_params.get("page_size", PAGE_SIZE))))
    except ValueError:
        raise ValidationFailed(details={"page": [_("Enter a page number.")]}) from None
    return page, size


def _date(value: Any, field: str) -> dt.date | None:
    if not value:
        return None
    try:
        return dt.date.fromisoformat(str(value))
    except ValueError:
        raise ValidationFailed(details={field: [_("Choose a date.")]}) from None


class OwnBook(APIView):
    """The signed-in person's own book; a support session may not open it."""

    permission_classes = [IsAuthenticated]

    def initial(self, request: Any, *args: Any, **kwargs: Any) -> None:
        super().initial(request, *args, **kwargs)
        if (getattr(request, "auth_claims", {}) or {}).get("imp"):
            raise PermissionDenied(_("A Money Book is private."))

    @property
    def owner(self) -> Any:
        return self.request.user


class PeopleView(OwnBook):
    def get(self, request: Any) -> Any:
        p = request.query_params
        rows = selectors.people(
            owner=self.owner, q=p.get("q", ""), balance=p.get("balance", "all"),
            status=p.get("status", "active"), sort=p.get("sort", "last_entry"),
        )
        page, size = _page(request)
        total = rows.count()
        data = [person_json(x) for x in rows[(page - 1) * size : page * size]]
        meta = {"page": page, "page_size": size, "total": total, "totals": selectors.totals(rows)}
        return StandardResponse.ok(data, meta=meta)

    @idempotent("moneybook.person.create", keyed_by="user")
    def post(self, request: Any) -> Any:
        person = services.create_person(
            owner=self.owner, name=request.data.get("name"), mobile=request.data.get("mobile", "")
        )
        return StandardResponse.created(person_json(person))


class PersonView(OwnBook):
    def get(self, request: Any, pk: Any) -> Any:
        return StandardResponse.ok(person_json(services.get_person(owner=self.owner, person_id=pk)))

    def patch(self, request: Any, pk: Any) -> Any:
        data = {k: request.data[k] for k in ("name", "mobile") if k in request.data}
        return StandardResponse.ok(person_json(services.update_person(owner=self.owner, person_id=pk, data=data)))


class ArchiveView(OwnBook):
    @idempotent("moneybook.person.archive", keyed_by="user")
    def post(self, request: Any, pk: Any) -> Any:
        return StandardResponse.ok(person_json(services.archive_person(owner=self.owner, person_id=pk)))


class RestoreView(OwnBook):
    @idempotent("moneybook.person.restore", keyed_by="user")
    def post(self, request: Any, pk: Any) -> Any:
        return StandardResponse.ok(person_json(services.restore_person(owner=self.owner, person_id=pk)))


class EntriesView(OwnBook):
    def get(self, request: Any, pk: Any) -> Any:
        person = services.get_person(owner=self.owner, person_id=pk)
        include = request.query_params.get("include_removed") == "true"
        rows = selectors.entries(person=person, include_removed=include)
        page, size = _page(request)
        data = [entry_json(e) for e in rows[(page - 1) * size : page * size]]
        return StandardResponse.ok(data, meta={"page": page, "page_size": size, "total": len(rows)})

    @idempotent("moneybook.entry.create", keyed_by="user")
    def post(self, request: Any, pk: Any) -> Any:
        if request.query_params.get("preview") == "true":
            result = services.preview_entry(owner=self.owner, person_id=pk, data=request.data)
            return StandardResponse.ok({k: f"{v:.2f}" for k, v in result.items()})
        entry = services.add_entry(owner=self.owner, person_id=pk, data=request.data)
        person = services.get_person(owner=self.owner, person_id=pk)
        return StandardResponse.created(entry_json(entry), meta={"person": person_json(person)})


class RemoveEntryView(OwnBook):
    @idempotent("moneybook.entry.remove", keyed_by="user")
    def post(self, request: Any, pk: Any) -> Any:
        removal = services.remove_entry(owner=self.owner, entry_id=pk, reason=request.data.get("reason", ""))
        person = services.get_person(owner=self.owner, person_id=removal.person_id)
        return StandardResponse.ok(entry_json(removal), meta={"person": person_json(person)})


class ReplaceEntryView(OwnBook):
    @idempotent("moneybook.entry.replace", keyed_by="user")
    def post(self, request: Any, pk: Any) -> Any:
        entry = services.replace_entry(owner=self.owner, entry_id=pk, data=request.data)
        person = services.get_person(owner=self.owner, person_id=entry.person_id)
        return StandardResponse.created(entry_json(entry), meta={"person": person_json(person)})


class ReportView(OwnBook):
    def get(self, request: Any) -> Any:
        p = request.query_params
        date_from, date_to = _date(p.get("from"), "from"), _date(p.get("to"), "to")
        if date_from and date_to and date_from > date_to:
            raise ValidationFailed(details={"from": [_("The start date is after the end date.")]})
        person_id = p.get("person") or None
        if person_id:
            services.get_person(owner=self.owner, person_id=person_id)
        result = selectors.report(owner=self.owner, person_id=person_id, date_from=date_from, date_to=date_to)
        rows = result.pop("rows")
        if p.get("format") == "csv":
            return self._csv(rows)
        page, size = _page(request)
        total = rows.count()
        data = [
            {**entry_json(e), "person_name": e.person.name}
            for e in rows[(page - 1) * size : page * size]
        ]
        return StandardResponse.ok(data, meta={"page": page, "page_size": size, "total": total, "summary": result})

    def _csv(self, rows: Any) -> HttpResponse:
        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerow([_("Date"), _("Name"), _("Entry"), _("Amount"), _("Note")])
        for e in rows:
            writer.writerow([e.entry_date.strftime("%d/%m/%Y"), e.person.name, e.get_kind_display(), f"{e.amount:.2f}", e.note])
        response = HttpResponse(out.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="money-book-report.csv"'
        return response


class OldDuesView(OwnBook):
    def get(self, request: Any) -> Any:
        settings = selectors.settings_for(self.owner)
        try:
            days = int(request.query_params.get("days", settings.old_dues_days))
        except ValueError:
            raise ValidationFailed(details={"days": [_("Enter a number of days.")]}) from None
        rows = selectors.old_dues(owner=self.owner, days=max(1, days), today=services.today())
        page, size = _page(request)
        total = rows.count()
        data = [person_json(x) for x in rows[(page - 1) * size : page * size]]
        return StandardResponse.ok(data, meta={"page": page, "page_size": size, "total": total, "days": days})


class ReminderTextView(OwnBook):
    def get(self, request: Any) -> Any:
        person = services.get_person(owner=self.owner, person_id=request.query_params.get("person"))
        tone = request.query_params.get("tone", ReminderTone.POLITE)
        if tone not in ReminderTone.values:
            raise ValidationFailed(details={"tone": [_("Choose a kind of message.")]})
        settings = selectors.settings_for(self.owner)
        locale = getattr(self.owner, "locale", "en")
        return StandardResponse.ok({"text": reminder_text(person=person, tone=tone, settings=settings, locale=locale)})


class RemindersView(OwnBook):
    def get(self, request: Any) -> Any:
        rows = Reminder.objects.filter(owner=self.owner).select_related("person").order_by("-opened_at", "-id")
        if request.query_params.get("person"):
            rows = rows.filter(person_id=request.query_params["person"])
        page, size = _page(request)
        total = rows.count()
        data = [reminder_json(r) for r in rows[(page - 1) * size : page * size]]
        return StandardResponse.ok(data, meta={"page": page, "page_size": size, "total": total})

    @idempotent("moneybook.reminder.open", keyed_by="user")
    def post(self, request: Any) -> Any:
        person = services.get_person(owner=self.owner, person_id=request.data.get("person_id"))
        tone, channel = request.data.get("tone"), request.data.get("channel")
        text = " ".join(str(request.data.get("text") or "").split(" ")).strip()
        errors = {}
        if tone not in ReminderTone.values:
            errors["tone"] = [_("Choose a kind of message.")]
        if channel not in ReminderChannel.values:
            errors["channel"] = [_("Choose WhatsApp or SMS.")]
        if not text:
            errors["text"] = [_("Write the message.")]
        if errors:
            raise ValidationFailed(details=errors)
        if person.balance <= 0 and tone != ReminderTone.THANK_YOU:
            raise BusinessRuleViolation("nothing_to_remind", _("%(name)s owes you nothing.") % {"name": person.name})
        reminder = Reminder.objects.create(
            owner=self.owner, person=person, tone=tone, channel=channel, text=text,
            attached_report=bool(request.data.get("attached_report")),
        )
        return StandardResponse.created(reminder_json(reminder))


class SettingsView(OwnBook):
    def _json(self, s: Settings) -> dict:
        return {"upi_id": s.upi_id, "sign_as": s.sign_as, "old_dues_days": s.old_dues_days}

    def get(self, request: Any) -> Any:
        return StandardResponse.ok(self._json(selectors.settings_for(self.owner)))

    def patch(self, request: Any) -> Any:
        s, _created = Settings.objects.get_or_create(owner=self.owner)
        errors = {}
        if "upi_id" in request.data:
            upi = str(request.data["upi_id"] or "").strip()
            if upi and ("@" not in upi or len(upi) > 60):
                errors["upi_id"] = [_("Enter a UPI ID like name@bank.")]
            s.upi_id = upi
        if "sign_as" in request.data:
            s.sign_as = " ".join(str(request.data["sign_as"] or "").split())[:120]
        if "old_dues_days" in request.data:
            try:
                s.old_dues_days = min(365, max(1, int(request.data["old_dues_days"])))
            except (TypeError, ValueError):
                errors["old_dues_days"] = [_("Enter a number of days.")]
        if errors:
            raise ValidationFailed(details=errors)
        s.save()
        return StandardResponse.ok(self._json(s))
