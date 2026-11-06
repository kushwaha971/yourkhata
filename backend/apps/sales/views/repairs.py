"""G5 — a mobile shop's repair jobs. Only a business that keeps IMEI / serials
(a mobile shop by default) sees them; any other answers 404."""

from __future__ import annotations

from typing import Any

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.common.constants import ModuleCode
from apps.common.context import Ctx
from apps.common.exceptions import NotFound
from apps.common.permissions import HasPermission, ModuleEnabled
from apps.common.responses import StandardResponse
from apps.common.tenancy import get_effective_tenant
from apps.sales.services import repairs

_READ = HasPermission("sales.invoice.read")
_WRITE = HasPermission("sales.invoice.write")


class _View(APIView):
    def get_permissions(self) -> list[Any]:
        gate = _READ if self.request.method == "GET" else _WRITE
        return [IsAuthenticated(), ModuleEnabled(ModuleCode.SALES)(), gate()]

    def initial(self, request: Any, *args: Any, **kwargs: Any) -> None:
        super().initial(request, *args, **kwargs)
        from apps.platform_app.selectors.business_words import features_of

        if "serials" not in features_of(get_effective_tenant(request)):
            raise NotFound("Repairs are kept by mobile shops.")


class RepairJobsView(_View):
    def get(self, request: Any) -> Any:
        result = repairs.list_jobs(
            tenant=get_effective_tenant(request),
            q=request.query_params.get("q", ""),
            stage=request.query_params.get("stage", "open"),
        )
        return StandardResponse.ok(result["rows"], meta={"counts": result["counts"]})

    def post(self, request: Any) -> Any:
        job, created = repairs.create_job(ctx=Ctx.from_request(request), data=request.data)
        body = repairs.view(job)
        return StandardResponse.created(body) if created else StandardResponse.ok(body)


class RepairJobDetailView(_View):
    def get(self, request: Any, pk: Any) -> Any:
        from apps.common.dates import tenant_today

        tenant = get_effective_tenant(request)
        return StandardResponse.ok(repairs.view(repairs.get_job(tenant=tenant, job_id=pk), today=tenant_today(tenant)))


class RepairJobStageView(_View):
    def post(self, request: Any, pk: Any) -> Any:
        body = request.data if isinstance(request.data, dict) else {}
        job = repairs.move_job(ctx=Ctx.from_request(request), job_id=pk, status=body.get("status"))
        return StandardResponse.ok(repairs.view(job))
