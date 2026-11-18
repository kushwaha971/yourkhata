"""G4 — `GET /reports/schedule-h`: the Schedule H register (design Reports, medical)."""

from __future__ import annotations

from typing import Any

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.common.constants import ModuleCode
from apps.common.exceptions import NotFound
from apps.common.permissions import HasPermission, ModuleEnabled
from apps.common.responses import StandardResponse
from apps.common.tenancy import get_effective_tenant
from apps.sales.services import schedule_h


class ScheduleHRegisterView(APIView):
    def get_permissions(self) -> list[Any]:
        return [
            IsAuthenticated(),
            ModuleEnabled(ModuleCode.SALES)(),
            HasPermission("reports.basic.read")(),
            HasPermission("sales.invoice.read")(),
        ]

    def initial(self, request: Any, *args: Any, **kwargs: Any) -> None:
        super().initial(request, *args, **kwargs)
        from apps.platform_app.selectors.business_words import features_of

        if "batches" not in features_of(get_effective_tenant(request)):
            raise NotFound("The Schedule H register is kept by medical stores.")

    def get(self, request: Any) -> Any:
        result = schedule_h.register(
            tenant=get_effective_tenant(request),
            date_from=request.query_params.get("date_from"),
            date_to=request.query_params.get("date_to"),
        )
        return StandardResponse.ok(result["rows"], meta={"counts": result["counts"]})
