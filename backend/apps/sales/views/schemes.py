"""G9 — company schemes. Only a business with the `schemes` feature has them
(wholesale and distribution by default); any other answers 404."""

from __future__ import annotations

from typing import Any

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.common.constants import ModuleCode
from apps.common.context import Ctx
from apps.common.dates import tenant_today
from apps.common.exceptions import NotFound
from apps.common.permissions import HasPermission, ModuleEnabled
from apps.common.responses import StandardResponse
from apps.common.tenancy import get_effective_tenant
from apps.sales.services import schemes
from apps.sales.services.payload import _parse_date


class _View(APIView):
    def get_permissions(self) -> list[Any]:
        code = "sales.invoice.read" if self.request.method == "GET" else "sales.invoice.write"
        return [IsAuthenticated(), ModuleEnabled(ModuleCode.SALES)(), HasPermission(code)()]

    def initial(self, request: Any, *args: Any, **kwargs: Any) -> None:
        super().initial(request, *args, **kwargs)
        from apps.platform_app.selectors.business_words import features_of

        if "schemes" not in features_of(get_effective_tenant(request)):
            raise NotFound("Schemes are kept by wholesale shops.")


class SchemesView(_View):
    def get(self, request: Any) -> Any:
        return StandardResponse.ok(
            schemes.list_schemes(tenant=get_effective_tenant(request), q=request.query_params.get("q", ""))
        )

    def post(self, request: Any) -> Any:
        ctx = Ctx.from_request(request)
        scheme, created = schemes.create_scheme(ctx=ctx, data=request.data)
        body = schemes.view(scheme, {}, tenant_today(ctx.tenant))
        return StandardResponse.created(body) if created else StandardResponse.ok(body)


class RunningSchemesView(_View):
    def get(self, request: Any) -> Any:
        tenant = get_effective_tenant(request)
        on = _parse_date(request.query_params.get("on"), "on", {}) if request.query_params.get("on") else None
        return StandardResponse.ok(schemes.running_for_bill(tenant=tenant, on=on or tenant_today(tenant)))


class SchemeDetailView(_View):
    def patch(self, request: Any, pk: Any) -> Any:
        ctx = Ctx.from_request(request)
        scheme = schemes.set_active(ctx=ctx, scheme_id=pk, active=request.data.get("active"))
        return StandardResponse.ok(schemes.view(scheme, {}, tenant_today(ctx.tenant)))
