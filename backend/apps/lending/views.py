"""`/api/v1/lending/…` — Loans & Collections' API (docs/revamp/lending/01-model-and-api.md).

Reads need `lending.loan.read`; collecting and Not paid `lending.collection.create`;
a new loan or borrower `lending.loan.create`; routes, settings and closing a
loan `lending.settings.manage`.
"""

from __future__ import annotations

import datetime as dt
from typing import Any

from django.utils.translation import gettext as _
from rest_framework.permissions import SAFE_METHODS, IsAuthenticated
from rest_framework.views import APIView

from apps.common.exceptions import ValidationFailed
from apps.common.idempotency import idempotent
from apps.common.permissions import HasPermission, ModuleEnabled
from apps.common.responses import StandardResponse
from apps.common.tenancy import get_effective_tenant
from apps.lending import book, messages, selectors, services
from apps.lending.constants import MessageKind
from apps.lending.models import Message, Route

READ = "lending.loan.read"
COLLECT = "lending.collection.create"
LEND = "lending.loan.create"
MANAGE = "lending.settings.manage"


def _date(value: Any, field: str) -> dt.date | None:
    if not value:
        return None
    try:
        return dt.date.fromisoformat(str(value))
    except ValueError:
        raise ValidationFailed(details={field: [_("Choose a date.")]}) from None


def position_json(p: book.Position) -> dict:
    return {
        "collected": selectors.money(p.collected), "late": selectors.money(p.late), "late_days": p.late_days,
        "due_today": selectors.money(p.due_today), "left": selectors.money(p.left), "paid_count": p.paid_count,
        "next_due": p.next_due.isoformat() if p.next_due else None,
    }


class LendingView(APIView):
    read = READ
    write = COLLECT
    scope_exempt = (
        "A small lender's people share one book: the owner and the collector see every "
        "loan on every route. There is no per-collector slice yet."
    )

    def get_permissions(self) -> list:
        code = self.read if self.request.method in SAFE_METHODS else self.write
        return [IsAuthenticated(), ModuleEnabled("lending")(), HasPermission(code)()]

    @property
    def tenant(self) -> Any:
        return get_effective_tenant(self.request)

    @property
    def locale(self) -> str:
        return self.request.query_params.get("lang") or getattr(self.request.user, "locale", "en")


class TodayView(LendingView):
    def get(self, request: Any) -> Any:
        day = _date(request.query_params.get("day"), "day")
        data = selectors.round_for(self.tenant, route=request.query_params.get("route", ""), day=day)
        data["book"] = selectors.book_figures(self.tenant, services.today(self.tenant))
        data["routes"] = [{"id": str(r.pk), "name": r.name} for r in Route.objects.filter(tenant=self.tenant, active=True)]
        name = messages.lender_name(self.tenant, services.settings_for(self.tenant))
        data["name"] = name
        return StandardResponse.ok(data)


class RoutesView(LendingView):
    write = MANAGE

    def get(self, request: Any) -> Any:
        rows = Route.objects.filter(tenant=self.tenant).order_by("sort", "name")
        return StandardResponse.ok([{"id": str(r.pk), "name": r.name, "active": r.active} for r in rows])

    @idempotent("lending.route.create")
    def post(self, request: Any) -> Any:
        r = services.save_route(tenant=self.tenant, user=request.user, data=request.data)
        return StandardResponse.created({"id": str(r.pk), "name": r.name, "active": r.active})


class RouteView(LendingView):
    write = MANAGE

    def patch(self, request: Any, pk: Any) -> Any:
        r = services.save_route(tenant=self.tenant, user=request.user, data=request.data, route_id=pk)
        return StandardResponse.ok({"id": str(r.pk), "name": r.name, "active": r.active})


class BorrowersView(LendingView):
    write = LEND

    def get(self, request: Any) -> Any:
        return StandardResponse.ok(selectors.borrowers_list(self.tenant, request.query_params.get("q", "")))

    @idempotent("lending.borrower.create")
    def post(self, request: Any) -> Any:
        b = services.save_borrower(tenant=self.tenant, user=request.user, data=request.data)
        return StandardResponse.created({"id": str(b.pk), "name": b.name})


class BorrowerView(LendingView):
    write = LEND

    def get(self, request: Any, pk: Any) -> Any:
        b = services.get_borrower(tenant=self.tenant, borrower_id=pk)
        row = next((x for x in selectors.borrowers_list(self.tenant) if x["id"] == str(b.pk)), None) or {
            "id": str(b.pk), "name": b.name, "mobile": b.mobile, "work": b.work, "note": b.note,
            "route_id": str(b.route_id) if b.route_id else None, "route": b.route.name if b.route_id else "",
            "loans": 0, "left": "0.00", "late": "0.00",
        }
        row["all_loans"] = [x for x in selectors.loans_list(self.tenant, status="all") if x["borrower_id"] == str(b.pk)]
        return StandardResponse.ok(row)

    def patch(self, request: Any, pk: Any) -> Any:
        b = services.save_borrower(tenant=self.tenant, user=request.user, data=request.data, borrower_id=pk)
        return StandardResponse.ok({"id": str(b.pk), "name": b.name})


class LoansView(LendingView):
    write = LEND

    def get(self, request: Any) -> Any:
        p = request.query_params
        return StandardResponse.ok(
            selectors.loans_list(self.tenant, status=p.get("status", "active"), route=p.get("route", ""), q=p.get("q", ""))
        )

    @idempotent("lending.loan.create")
    def post(self, request: Any) -> Any:
        if request.query_params.get("preview") == "true":
            return StandardResponse.ok(services.preview_loan(tenant=self.tenant, data=request.data))
        loan = services.create_loan(tenant=self.tenant, user=request.user, data=request.data)
        return StandardResponse.created(selectors.loan_detail(self.tenant, loan))


class LoanView(LendingView):
    def get(self, request: Any, pk: Any) -> Any:
        return StandardResponse.ok(selectors.loan_detail(self.tenant, services.get_loan(tenant=self.tenant, loan_id=pk)))


class CollectView(LendingView):
    @idempotent("lending.collection.create")
    def post(self, request: Any, pk: Any) -> Any:
        if request.query_params.get("preview") == "true":
            pos = services.preview_collection(tenant=self.tenant, loan_id=pk, data=request.data)
            loan = services.get_loan(tenant=self.tenant, loan_id=pk)
            data = position_json(pos)
            data["days_to_go"] = book.days_to_go(dues=services.dues_of(loan), day=services.today(self.tenant))
            return StandardResponse.ok(data)
        row = services.collect(tenant=self.tenant, user=request.user, loan_id=pk, data=request.data)
        loan = services.get_loan(tenant=self.tenant, loan_id=pk)
        detail = selectors.loan_detail(self.tenant, loan)
        pos = book.position(dues=services.dues_of(loan), collected=services.collected_on_loan(loan), day=services.today(self.tenant))
        receipt = messages.receipt_text(
            tenant=self.tenant, loan=loan, amount=row.amount, mode=row.mode, on=row.collected_on, pos=pos,
            settings=services.settings_for(self.tenant), locale=self.locale,
        )
        return StandardResponse.created({"id": str(row.pk)}, meta={"loan": detail, "receipt": receipt})


class RemoveCollectionView(LendingView):
    @idempotent("lending.collection.remove")
    def post(self, request: Any, pk: Any) -> Any:
        loan = services.remove_collection(tenant=self.tenant, user=request.user, collection_id=pk, reason=request.data.get("reason"))
        return StandardResponse.ok(selectors.loan_detail(self.tenant, loan))


class NotPaidView(LendingView):
    @idempotent("lending.visit.not_paid")
    def post(self, request: Any, pk: Any) -> Any:
        v = services.not_paid(tenant=self.tenant, user=request.user, loan_id=pk, data=request.data)
        return StandardResponse.ok({"day": v.day.isoformat(), "reason": v.reason,
                                    "promised_on": v.promised_on.isoformat() if v.promised_on else None})


class CloseView(LendingView):
    write = MANAGE

    @idempotent("lending.loan.close")
    def post(self, request: Any, pk: Any) -> Any:
        loan = services.close_loan(tenant=self.tenant, loan_id=pk, data=request.data)
        return StandardResponse.ok(selectors.loan_detail(self.tenant, loan))


class RemindView(LendingView):
    def get(self, request: Any) -> Any:
        kind = request.query_params.get("kind", MessageKind.LATE)
        if kind not in (MessageKind.LATE, MessageKind.DUE_TODAY, MessageKind.DUE_TOMORROW):
            raise ValidationFailed(details={"kind": [_("Choose Late, Due today or Due tomorrow.")]})
        return StandardResponse.ok(selectors.remind_list(self.tenant, kind), meta={"counts": selectors.remind_counts(self.tenant)})


class MessageTextView(LendingView):
    def get(self, request: Any) -> Any:
        loan = services.get_loan(tenant=self.tenant, loan_id=request.query_params.get("loan"))
        kind = request.query_params.get("kind", MessageKind.LATE)
        if kind not in (MessageKind.LATE, MessageKind.DUE_TODAY, MessageKind.DUE_TOMORROW):
            raise ValidationFailed(details={"kind": [_("Choose a message.")]})
        pos = book.position(dues=services.dues_of(loan), collected=services.collected_on_loan(loan), day=services.today(self.tenant))
        text = messages.remind_text(tenant=self.tenant, loan=loan, pos=pos, kind=kind,
                                    settings=services.settings_for(self.tenant), locale=self.locale)
        return StandardResponse.ok({"text": text, "mobile": loan.borrower.mobile})


class MessagesView(LendingView):
    def get(self, request: Any) -> Any:
        rows = Message.objects.filter(tenant=self.tenant).select_related("loan__borrower").order_by("-created_at")[:100]
        return StandardResponse.ok([
            {"id": str(m.pk), "loan_id": str(m.loan_id), "number": m.loan.number, "borrower": m.loan.borrower.name,
             "kind": m.kind, "text": m.text, "opened_at": m.created_at.isoformat()}
            for m in rows
        ])

    @idempotent("lending.message.open")
    def post(self, request: Any) -> Any:
        m = services.record_message(tenant=self.tenant, user=request.user, loan_id=request.data.get("loan_id"),
                                    kind=request.data.get("kind"), text=request.data.get("text"))
        return StandardResponse.created({"id": str(m.pk)})


class SettingsView(LendingView):
    write = MANAGE

    def _json(self) -> dict:
        s = services.settings_for(self.tenant)
        return {"sign_as": s.sign_as, "name": messages.lender_name(self.tenant, s), "upi_id": s.upi_id}

    def get(self, request: Any) -> Any:
        return StandardResponse.ok(self._json())

    def patch(self, request: Any) -> Any:
        services.update_settings(tenant=self.tenant, data=request.data)
        return StandardResponse.ok(self._json())
