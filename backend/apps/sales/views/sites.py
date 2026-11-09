"""G7 — a contractor's sites. Only a business with the `sites` feature has them
(a hardware shop by default); any other answers 404."""

from __future__ import annotations

from typing import Any

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.common.constants import ModuleCode
from apps.common.context import Ctx
from apps.common.exceptions import NotFound
from apps.common.idempotency import idempotent
from apps.common.permissions import HasPermission, ModuleEnabled
from apps.common.responses import StandardResponse
from apps.common.tenancy import get_effective_tenant
from apps.common.dates import tenant_today
from apps.sales.services import sites


class _View(APIView):
    write_permission = "sales.invoice.write"

    def get_permissions(self) -> list[Any]:
        code = "sales.invoice.read" if self.request.method == "GET" else self.write_permission
        return [IsAuthenticated(), ModuleEnabled(ModuleCode.SALES)(), HasPermission(code)()]

    def initial(self, request: Any, *args: Any, **kwargs: Any) -> None:
        super().initial(request, *args, **kwargs)
        from apps.platform_app.selectors.business_words import features_of

        if "sites" not in features_of(get_effective_tenant(request)):
            raise NotFound("Sites are kept by shops that sell to contractors.")


class SitesView(_View):
    def get(self, request: Any) -> Any:
        return StandardResponse.ok(
            sites.list_sites(
                tenant=get_effective_tenant(request),
                q=request.query_params.get("q", ""),
                party_id=request.query_params.get("party") or None,
            )
        )

    def post(self, request: Any) -> Any:
        ctx = Ctx.from_request(request)
        site, created = sites.create_site(ctx=ctx, data=request.data)
        site = sites.get_site(tenant=ctx.tenant, site_id=site.id)
        body = sites.view(site, today=tenant_today(ctx.tenant))
        return StandardResponse.created(body) if created else StandardResponse.ok(body)


class SiteDetailView(_View):
    def get(self, request: Any, pk: Any) -> Any:
        tenant = get_effective_tenant(request)
        site = sites.get_site(tenant=tenant, site_id=pk)
        return StandardResponse.ok(
            {**sites.view(site, today=tenant_today(tenant)), "bill_rows": sites.site_bills(site=site)}
        )


class SitePaymentView(_View):
    write_permission = "payments.payment.write"

    @idempotent("sales_site_payment")
    def post(self, request: Any) -> Any:
        return StandardResponse.created(sites.split_payment(ctx=Ctx.from_request(request), data=request.data))
