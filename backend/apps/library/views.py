"""`/api/v1/library/…` — the Library's API (docs/revamp/library/01-model-and-api.md).

Every view answers for the business on the request and nothing else. Reads
need `library.member.read`; collecting a fee `library.fee.create`; enrolling,
moving and editing `library.member.write`; seats, shifts, settings, expenses
and books' set-up `library.settings.manage`.
"""

from __future__ import annotations

import datetime as dt
from typing import Any

from django.utils.translation import gettext as _
from rest_framework.permissions import SAFE_METHODS, IsAuthenticated
from rest_framework.views import APIView

from apps.common.plain_requests import PlainBodyMixin, date_of as _date, page_of

from apps.common.exceptions import ValidationFailed
from apps.common.idempotency import idempotent
from apps.common.permissions import HasPermission, ModuleEnabled
from apps.common.responses import StandardResponse
from apps.common.tenancy import get_effective_tenant
from apps.library import messages, selectors, services
from apps.library.constants import FeeStatus, MessageKind, RowStatus
from apps.library.models import Attendance, Expense, Message, Payment, Shift

READ = "library.member.read"
WRITE = "library.member.write"
COLLECT = "library.fee.create"
MANAGE = "library.settings.manage"
PAGE_SIZE = 25
PAGE_MAX = 200


def payment_json(p: Payment) -> dict:
    return {
        "id": str(p.pk),
        "student_id": str(p.student_id),
        "amount": selectors.money(p.amount),
        "mode": p.mode,
        "paid_on": p.paid_on.isoformat(),
        "months": p.months,
        "from_date": p.from_date.isoformat() if p.from_date else None,
        "to_date": p.to_date.isoformat() if p.to_date else None,
        "status": p.status,
        "reason": p.removed_by.reason if p.status == RowStatus.REMOVED and hasattr(p, "removed_by") else "",
        "created_at": p.created_at.isoformat(),
    }


def _page(request: Any) -> tuple[int, int]:
    return page_of(request, size=PAGE_SIZE, size_max=PAGE_MAX)


class LibraryView(PlainBodyMixin, APIView):
    """Reads take `read`; a write takes the view's `write` codename."""

    read = READ
    write = WRITE
    scope_exempt = (
        "A study library's team works one counter: everybody with the library's read "
        "permission sees every student. There is no per-member slice (no route, no branch)."
    )

    def get_permissions(self) -> list:
        code = self.read if self.request.method in SAFE_METHODS else self.write
        return [IsAuthenticated(), ModuleEnabled("library")(), HasPermission(code)()]

    @property
    def tenant(self) -> Any:
        return get_effective_tenant(self.request)

    @property
    def locale(self) -> str:
        return self.request.query_params.get("lang") or getattr(self.request.user, "locale", "en")

    def state_of(self, student: Any) -> Any:
        settings = services.settings_for(self.tenant)
        return selectors.fee_of(student, day=services.today(self.tenant), due_soon_days=settings.due_soon_days)

    def student_json(self, student: Any) -> dict:
        return selectors.student_json(student, self.state_of(student))


class HomeView(LibraryView):
    def get(self, request: Any) -> Any:
        return StandardResponse.ok(selectors.home(self.tenant))


class ShiftsView(LibraryView):
    write = MANAGE

    def get(self, request: Any) -> Any:
        return StandardResponse.ok(selectors.shift_counts(self.tenant))

    @idempotent("library.shift.create")
    def post(self, request: Any) -> Any:
        shift = services.save_shift(tenant=self.tenant, user=request.user, data=request.data)
        return StandardResponse.created({"id": str(shift.pk), "name": shift.name})


class ShiftView(LibraryView):
    write = MANAGE

    def patch(self, request: Any, pk: Any) -> Any:
        shift = services.save_shift(tenant=self.tenant, user=request.user, data=request.data, shift_id=pk)
        return StandardResponse.ok({"id": str(shift.pk), "name": shift.name})


class SeatsView(LibraryView):
    write = MANAGE

    def get(self, request: Any) -> Any:
        return StandardResponse.ok(selectors.seat_map(self.tenant, shift_id=request.query_params.get("shift", "")))

    def put(self, request: Any) -> Any:
        n = services.set_seat_count(tenant=self.tenant, user=request.user, count=request.data.get("count"))
        return StandardResponse.ok({"count": n})


class StudentsView(LibraryView):
    def get(self, request: Any) -> Any:
        p = request.query_params
        fee = p.get("fee", "all")
        if fee not in ("all", *FeeStatus.values):
            raise ValidationFailed(details={"fee": [_("Choose a fee filter.")]})
        data = selectors.students(
            self.tenant, q=p.get("q", ""), fee=fee, shift=p.get("shift", ""), status=p.get("status", "current")
        )
        page, size = _page(request)
        rows = data["rows"]
        out = [selectors.student_json(s, st) for s, st in rows[(page - 1) * size : page * size]]
        meta = {"page": page, "page_size": size, "total": len(rows), "counts": data["counts"], "due": data["due"]}
        return StandardResponse.ok(out, meta=meta)

    @idempotent("library.student.create")
    def post(self, request: Any) -> Any:
        student = services.enrol_student(tenant=self.tenant, user=request.user, data=request.data)
        return StandardResponse.created(self.student_json(student))


class StudentView(LibraryView):
    def get(self, request: Any, pk: Any) -> Any:
        student = services.get_student(tenant=self.tenant, student_id=pk)
        day = services.today(self.tenant)
        month = _date(request.query_params.get("month"), "month") or day
        total, n = selectors.paid_this_year(student, day)
        data = {
            **self.student_json(student),
            "paid_this_year": selectors.money(total),
            "payments_this_year": n,
            "attendance": selectors.attendance_month(student, month),
            "attendance_month": month.replace(day=1).isoformat(),
            "last_in": (
                Attendance.objects.filter(student=student).order_by("-day").values_list("day", flat=True).first()
            ),
            "messages": Message.objects.filter(student=student).count(),
        }
        if data["last_in"]:
            data["last_in"] = data["last_in"].isoformat()
        return StandardResponse.ok(data)

    def patch(self, request: Any, pk: Any) -> Any:
        student = services.update_student(tenant=self.tenant, student_id=pk, data=request.data)
        return StandardResponse.ok(self.student_json(student))


class MoveView(LibraryView):
    @idempotent("library.student.move")
    def post(self, request: Any, pk: Any) -> Any:
        student = services.move_student(tenant=self.tenant, student_id=pk, data=request.data)
        return StandardResponse.ok(self.student_json(student))


class StatusView(LibraryView):
    action_name = ""

    @idempotent("library.student.status")
    def post(self, request: Any, pk: Any) -> Any:
        student = services.set_status(tenant=self.tenant, student_id=pk, action=self.action_name, data=request.data)
        return StandardResponse.ok(self.student_json(student))


class PaymentsView(LibraryView):
    write = COLLECT

    def get(self, request: Any, pk: Any) -> Any:
        student = services.get_student(tenant=self.tenant, student_id=pk)
        include = request.query_params.get("include_removed") == "true"
        rows = selectors.payments_of(student, include_removed=include)
        return StandardResponse.ok([payment_json(p) for p in rows])

    @idempotent("library.fee.create")
    def post(self, request: Any, pk: Any) -> Any:
        if request.query_params.get("preview") == "true":
            return StandardResponse.ok(services.preview_fee(tenant=self.tenant, student_id=pk, data=request.data))
        payment, student = services.collect_fee(tenant=self.tenant, user=request.user, student_id=pk, data=request.data)
        receipt = messages.receipt_text(
            tenant=self.tenant, payment=payment, student=student,
            settings=services.settings_for(self.tenant), locale=self.locale,
        )
        return StandardResponse.created(
            payment_json(payment), meta={"student": self.student_json(student), "receipt": receipt}
        )


class RemovePaymentView(LibraryView):
    write = COLLECT

    @idempotent("library.fee.remove")
    def post(self, request: Any, pk: Any) -> Any:
        student = services.remove_payment(
            tenant=self.tenant, user=request.user, payment_id=pk, reason=request.data.get("reason")
        )
        return StandardResponse.ok({"student": self.student_json(student)})


class FeesView(LibraryView):
    def get(self, request: Any) -> Any:
        fee = request.query_params.get("fee", "over")
        if fee not in ("all", *FeeStatus.values):
            raise ValidationFailed(details={"fee": [_("Choose a fee filter.")]})
        return StandardResponse.ok(selectors.fees_page(self.tenant, fee=fee))


class MessageTextView(LibraryView):
    def get(self, request: Any) -> Any:
        student = services.get_student(tenant=self.tenant, student_id=request.query_params.get("student"))
        kind = request.query_params.get("kind", MessageKind.FEE_DUE)
        settings = services.settings_for(self.tenant)
        state = self.state_of(student)
        if kind == MessageKind.WELCOME:
            text = messages.welcome_text(tenant=self.tenant, student=student, state=state, settings=settings, locale=self.locale)
        elif kind == MessageKind.FEE_DUE:
            text = messages.fee_text(tenant=self.tenant, student=student, state=state, settings=settings, locale=self.locale)
        else:
            raise ValidationFailed(details={"kind": [_("Choose a message.")]})
        return StandardResponse.ok({"text": text, "mobile": student.mobile})


class MessagesView(LibraryView):
    def get(self, request: Any) -> Any:
        rows = Message.objects.filter(tenant=self.tenant).select_related("student").order_by("-created_at", "-id")
        if request.query_params.get("student"):
            rows = rows.filter(student_id=request.query_params["student"])
        page, size = _page(request)
        total = rows.count()
        data = [
            {"id": str(m.pk), "student_id": str(m.student_id), "student": m.student.name, "kind": m.kind,
             "text": m.text, "opened_at": m.created_at.isoformat()}
            for m in rows[(page - 1) * size : page * size]
        ]
        return StandardResponse.ok(data, meta={"page": page, "page_size": size, "total": total})

    @idempotent("library.message.open")
    def post(self, request: Any) -> Any:
        m = services.record_message(
            tenant=self.tenant, user=request.user, student_id=request.data.get("student_id"),
            kind=request.data.get("kind"), text=request.data.get("text"),
        )
        return StandardResponse.created({"id": str(m.pk)})


class AttendanceView(LibraryView):
    write = COLLECT

    def get(self, request: Any) -> Any:
        day = _date(request.query_params.get("day"), "day") or services.today(self.tenant)
        rows = selectors.attendance_day(self.tenant, day)
        data = [
            {"id": str(a.pk), "student_id": str(a.student_id), "student": a.student.name,
             "seat": a.student.seat.number if a.student.seat_id else None,
             "in_at": a.in_at.isoformat(), "out_at": a.out_at.isoformat() if a.out_at else None}
            for a in rows
        ]
        return StandardResponse.ok(data, meta={"day": day.isoformat()})

    @idempotent("library.attendance.mark")
    def post(self, request: Any) -> Any:
        sid = request.data.get("student_id")
        if request.data.get("out"):
            row = services.mark_out(tenant=self.tenant, student_id=sid)
        else:
            row = services.mark_in(tenant=self.tenant, user=request.user, student_id=sid)
        return StandardResponse.ok({"id": str(row.pk), "in_at": row.in_at.isoformat(),
                                    "out_at": row.out_at.isoformat() if row.out_at else None})


class MoneyView(LibraryView):
    def get(self, request: Any) -> Any:
        day = services.today(self.tenant)
        start = _date(request.query_params.get("from"), "from") or day.replace(day=1)
        end = _date(request.query_params.get("to"), "to") or day
        if start > end:
            raise ValidationFailed(details={"from": [_("The start date is after the end date.")]})
        return StandardResponse.ok(selectors.money_report(self.tenant, start=start, end=end))


def expense_json(e: Expense) -> dict:
    return {"id": str(e.pk), "spent_on": e.spent_on.isoformat(), "head": e.head, "amount": selectors.money(e.amount),
            "note": e.note, "status": e.status, "reason": e.reason}


class ExpensesView(LibraryView):
    write = MANAGE

    def get(self, request: Any) -> Any:
        day = services.today(self.tenant)
        start = _date(request.query_params.get("from"), "from") or day.replace(day=1)
        end = _date(request.query_params.get("to"), "to") or day
        rows = Expense.objects.filter(tenant=self.tenant, spent_on__gte=start, spent_on__lte=end)
        if request.query_params.get("include_removed") != "true":
            rows = rows.filter(status=RowStatus.LIVE)
        return StandardResponse.ok([expense_json(e) for e in rows.order_by("-spent_on", "-created_at")])

    @idempotent("library.expense.create")
    def post(self, request: Any) -> Any:
        return StandardResponse.created(expense_json(services.add_expense(tenant=self.tenant, user=request.user, data=request.data)))


class RemoveExpenseView(LibraryView):
    write = MANAGE

    @idempotent("library.expense.remove")
    def post(self, request: Any, pk: Any) -> Any:
        row = services.remove_expense(tenant=self.tenant, expense_id=pk, reason=request.data.get("reason"))
        return StandardResponse.ok(expense_json(row))


class BooksView(LibraryView):
    def get(self, request: Any) -> Any:
        return StandardResponse.ok(selectors.books(
            self.tenant, request.query_params.get("q", ""), request.query_params.get("code", "")
        ))

    @idempotent("library.book.create")
    def post(self, request: Any) -> Any:
        book = services.add_book(tenant=self.tenant, user=request.user, data=request.data)
        return StandardResponse.created({"id": str(book.pk)})


class BookView(LibraryView):
    def patch(self, request: Any, pk: Any) -> Any:
        book = services.add_book(tenant=self.tenant, user=request.user, data=request.data, book_id=pk)
        return StandardResponse.ok({"id": str(book.pk)})


class GiveBookView(LibraryView):
    @idempotent("library.book.give")
    def post(self, request: Any, pk: Any) -> Any:
        issue = services.give_book(tenant=self.tenant, user=request.user, book_id=pk, student_id=request.data.get("student_id"))
        return StandardResponse.created({"id": str(issue.pk)})


class TakeBackView(LibraryView):
    @idempotent("library.book.back")
    def post(self, request: Any, pk: Any) -> Any:
        issue = services.take_back(tenant=self.tenant, issue_id=pk)
        return StandardResponse.ok({"id": str(issue.pk), "back_on": issue.back_on.isoformat()})


class SettingsView(LibraryView):
    write = MANAGE

    def _json(self) -> dict:
        s = services.settings_for(self.tenant)
        return {"sign_as": s.sign_as, "name": messages.library_name(self.tenant, s), "upi_id": s.upi_id,
                "due_soon_days": s.due_soon_days,
                "seats": selectors.Seat.objects.filter(tenant=self.tenant, active=True).count(),
                "shifts": Shift.objects.filter(tenant=self.tenant, active=True).count()}

    def get(self, request: Any) -> Any:
        return StandardResponse.ok(self._json())

    def patch(self, request: Any) -> Any:
        services.update_settings(tenant=self.tenant, data=request.data)
        return StandardResponse.ok(self._json())


class PosterView(LibraryView):
    """The fee poster for the wall (I7): the library's name, each shift's fee and
    a UPI QR with no amount, so a student pays whatever their month is."""

    def get(self, request: Any) -> Any:
        from apps.common.qr import encode, matrix_rows
        from apps.common.upi import build_upi_url, valid_vpa

        settings = services.settings_for(self.tenant)
        name = messages.library_name(self.tenant, settings)
        qr = None
        if valid_vpa(settings.upi_id):
            matrix = encode(build_upi_url(pa=settings.upi_id, pn=name or settings.upi_id))
            qr = {"size": len(matrix), "modules": matrix_rows(matrix)}
        return StandardResponse.ok({
            "name": name,
            "upi_id": settings.upi_id,
            "shifts": [
                {"name": s["name"], "monthly_fee": s["monthly_fee"], "full_day": s["full_day"]}
                for s in selectors.shift_counts(self.tenant)
            ],
            "qr": qr,
        })
