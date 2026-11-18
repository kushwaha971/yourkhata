"""`GET`/`POST /reports/cash-counts` — BP-17, the Shop's counted drawer.

Who: a reader of the Shop's cash by its records, which is
`reports.financial.read` in the Shop book — the same gate as Home's "Cash by
your records" tile, because a count is stored beside that figure and its
variance discloses it. Staff without it neither see nor record counts.

POST is idempotent: a counter on a weak connection that taps Save twice, or
retries after a timeout, records one count.
"""

from __future__ import annotations

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

CODENAME = "reports.financial.read"
#: The history a screen shows; older counts stay in the table and the audit log.
HISTORY_LIMIT = 30


class CashCountWriteSerializer(serializers.Serializer):
    counted_amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0"))
    note = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")


class CashCountView(BookAccessMixin, TenantScopeMixin, APIView):
    permission_classes = [
        IsAuthenticated,
        ModuleEnabled(ModuleCode.REPORTS),
        HasPermission(CODENAME),
    ]
    throttle_classes = [ScopedUserRateThrottle]

    def permission_books(self, request: Any, codename: str) -> tuple[str, ...]:
        # Always the Shop's drawer, checked by HasPermission BEFORE an
        # idempotent replay could hand back a stored response.
        return ("shop",)

    def get(self, request: Any, *args: Any, **kwargs: Any) -> Any:
        from apps.common.dates import tenant_today
        from apps.reports.selectors.cash_count import count_view, counts_for
        from apps.reports.selectors.dashboard import cash_in_hand

        tenant = self.get_tenant()
        expected_now = cash_in_hand(tenant=tenant, today=tenant_today(tenant))
        rows = list(counts_for(tenant=tenant)[:HISTORY_LIMIT])
        data = [
            count_view(row, expected_now=expected_now if index == 0 else None)
            for index, row in enumerate(rows)
        ]
        response = StandardResponse.ok(data, meta={"expected_now": str(expected_now)})
        response["Cache-Control"] = "private, no-store"
        return response

    @idempotent("cash_count_create")
    def post(self, request: Any, *args: Any, **kwargs: Any) -> Any:
        from apps.reports.selectors.cash_count import count_view
        from apps.reports.services.cash_count import record_cash_count

        serializer = CashCountWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        count = record_cash_count(
            ctx=Ctx.from_request(request),
            counted_amount=serializer.validated_data["counted_amount"],
            note=serializer.validated_data["note"].strip(),
        )
        return StandardResponse.created(count_view(count, expected_now=count.expected_amount))
