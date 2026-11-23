"""BP-16 — Shop promises (R-DEC-26).

    GET  /parties/{id}/shop-promises?role=customer   the open one + history
    POST /parties/{id}/shop-promises                  add (idempotent)
    PATCH /parties/shop-promises/{pid}                change date/amount/note
    POST /parties/shop-promises/{pid}/kept            close as kept
    POST /parties/shop-promises/{pid}/cancel          close as off
    GET  /parties/shop-promises?until=YYYY-MM-DD      open ones due by then (Home)

Who: reading is `parties.party.read` in the Shop book; writing is
`parties.party.write` in the Shop book — the same pair that lets counter staff
set the Udhaar book's collection date (`STAFF_PATCH_KEYS`), because taking a
customer's "I'll pay Friday" is counter work. The Udhaar book's grant reaches
none of these: every check names the Shop (DEC-019).

Every write is idempotent, so a double tap or a retry after a timeout records
one promise or one change; the book check runs before a replay can answer.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal
from typing import Any

from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.common.book_access import BookAccessMixin
from apps.common.constants import ModuleCode
from apps.common.context import Ctx
from apps.common.idempotency import idempotent
from apps.common.permissions import HasPermission, ModuleEnabled
from apps.common.responses import StandardResponse
from apps.common.throttling import ScopedUserRateThrottle
from apps.common.viewsets import TenantScopeMixin
from apps.parties.constants import ShopPromiseRole, ShopPromiseState

READ = "parties.party.read"
WRITE = "parties.party.write"
#: Home asks for a week ahead by default; never more than 31 days.
DEFAULT_AHEAD = 7
MAX_AHEAD = 31


class _ShopPromiseBase(BookAccessMixin, TenantScopeMixin, APIView):
    permission_classes = [
        IsAuthenticated,
        ModuleEnabled(ModuleCode.PARTIES),
        HasPermission({"read": READ, "write": WRITE}),
    ]
    throttle_classes = [ScopedUserRateThrottle]

    def initial(self, request: Any, *args: Any, **kwargs: Any) -> None:
        # HasPermission maps by `action`; an APIView has none, so name it from
        # the method before the permission check runs.
        self.action = "read" if request.method in ("GET", "HEAD", "OPTIONS") else "write"
        super().initial(request, *args, **kwargs)

    def permission_books(self, request: Any, codename: str) -> tuple[str, ...]:
        return ("shop",)  # never the Udhaar book's grant (DEC-019)


class PromiseCreateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=ShopPromiseRole.choices)
    promised_on = serializers.DateField()
    amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01"), required=False, allow_null=True
    )
    note = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")


class PromiseChangeSerializer(serializers.Serializer):
    version = serializers.IntegerField(min_value=1)
    promised_on = serializers.DateField(required=False)
    amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01"), required=False, allow_null=True
    )
    note = serializers.CharField(max_length=200, required=False, allow_blank=True)


class PromiseCloseSerializer(serializers.Serializer):
    version = serializers.IntegerField(min_value=1)


def _no_store(response: Any) -> Any:
    response["Cache-Control"] = "private, no-store"
    return response


class PartyShopPromisesView(_ShopPromiseBase):
    def get(self, request: Any, party_id: Any) -> Any:
        from apps.common.dates import tenant_today
        from apps.common.exceptions import NotFound, ValidationFailed
        from apps.parties.models import Party
        from apps.parties.selectors.shop_promises import party_promises, promise_view

        tenant = self.get_tenant()
        role = request.query_params.get("role", ShopPromiseRole.CUSTOMER)
        if role not in ShopPromiseRole.values:
            raise ValidationFailed({"role": ["Choose customer or supplier."]})
        if not Party.objects.for_tenant(tenant).filter(pk=party_id).exists():
            raise NotFound()
        today = tenant_today(tenant)
        rows = party_promises(tenant=tenant, party_id=party_id, role=role)
        return _no_store(StandardResponse.ok([promise_view(row, today=today) for row in rows]))

    @idempotent("shop_promise_create")
    def post(self, request: Any, party_id: Any) -> Any:
        from apps.common.dates import tenant_today
        from apps.parties.selectors.shop_promises import promise_view
        from apps.parties.services.shop_promises import create_promise

        serializer = PromiseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        promise = create_promise(
            ctx=Ctx.from_request(request),
            party_id=party_id,
            role=data["role"],
            promised_on=data["promised_on"],
            amount=data.get("amount"),
            note=data["note"].strip(),
        )
        return StandardResponse.created(promise_view(promise, today=tenant_today(promise.tenant)))


class ShopPromiseView(_ShopPromiseBase):
    @idempotent("shop_promise_change")
    def patch(self, request: Any, promise_id: Any) -> Any:
        from apps.common.dates import tenant_today
        from apps.parties.selectors.shop_promises import promise_view
        from apps.parties.services.shop_promises import change_promise

        serializer = PromiseChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        if "note" in data:
            data["note"] = data["note"].strip()
        promise = change_promise(ctx=Ctx.from_request(request), promise_id=promise_id, **data)
        return StandardResponse.ok(promise_view(promise, today=tenant_today(promise.tenant)))


class ShopPromiseCloseView(_ShopPromiseBase):
    state: str = ShopPromiseState.KEPT

    @idempotent("shop_promise_close")
    def post(self, request: Any, promise_id: Any) -> Any:
        from apps.common.dates import tenant_today
        from apps.parties.selectors.shop_promises import promise_view
        from apps.parties.services.shop_promises import close_promise

        serializer = PromiseCloseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        promise = close_promise(
            ctx=Ctx.from_request(request),
            promise_id=promise_id,
            version=serializer.validated_data["version"],
            state=self.state,
        )
        return StandardResponse.ok(promise_view(promise, today=tenant_today(promise.tenant)))


class ShopPromiseCancelView(ShopPromiseCloseView):
    state = ShopPromiseState.CANCELLED


class OpenShopPromisesView(_ShopPromiseBase):
    """Home's Follow-ups: open promises due by `until` (default a week ahead)."""

    def get(self, request: Any) -> Any:
        from apps.common.dates import tenant_today
        from apps.common.exceptions import ValidationFailed
        from apps.parties.selectors.shop import serialize_shop_facts
        from apps.parties.selectors.shop_promises import open_promises, promise_view

        tenant = self.get_tenant()
        today = tenant_today(tenant)
        raw = request.query_params.get("until")
        try:
            until = dt.date.fromisoformat(raw) if raw else today + dt.timedelta(days=DEFAULT_AHEAD)
        except ValueError as exc:
            raise ValidationFailed({"until": ["Use a date like 2026-10-31."]}) from exc
        until = min(until, today + dt.timedelta(days=MAX_AHEAD))
        roles = tuple(
            role
            for role in request.query_params.get("role", "customer,supplier").split(",")
            if role in ShopPromiseRole.values
        ) or tuple(ShopPromiseRole.values)
        data = []
        for item in open_promises(tenant=tenant, until=until, roles=roles):
            promise, party = item["promise"], item["party"]
            row = promise_view(promise, today=today)
            if party is not None:
                facts = serialize_shop_facts(party, today=today, kind=promise.role)
                row["balance"] = facts[f"{promise.role}_balance"]
                row["days_overdue"] = facts["days_overdue"]
                row["party"]["mobile"] = party.mobile
            data.append(row)
        return _no_store(StandardResponse.ok(data, meta={"until": until.isoformat()}))
