"""G10 — a café's open orders and advance orders. Only a business that keeps
them (sweets, bakery and café by default) sees them; any other answers 404."""

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
from apps.sales.services import cafe_orders

_READ = HasPermission("sales.invoice.read")
_WRITE = HasPermission("sales.invoice.write")


class _View(APIView):
    def get_permissions(self) -> list[Any]:
        gate = _READ if self.request.method == "GET" else _WRITE
        return [IsAuthenticated(), ModuleEnabled(ModuleCode.SALES)(), gate()]

    def initial(self, request: Any, *args: Any, **kwargs: Any) -> None:
        super().initial(request, *args, **kwargs)
        from apps.platform_app.selectors.business_words import features_of

        if "cafe_orders" not in features_of(get_effective_tenant(request)):
            raise NotFound("Open orders are kept by cafés and sweet shops.")


class CafeOrdersView(_View):
    def get(self, request: Any) -> Any:
        result = cafe_orders.list_orders(
            tenant=get_effective_tenant(request), scope=request.query_params.get("scope", "open")
        )
        return StandardResponse.ok(result["rows"], meta={"counts": result["counts"], "soon": result["soon"]})

    def post(self, request: Any) -> Any:
        order, created = cafe_orders.create_order(ctx=Ctx.from_request(request), data=request.data)
        body = cafe_orders.view(order)
        return StandardResponse.created(body) if created else StandardResponse.ok(body)


class CafeOrderDetailView(_View):
    def get(self, request: Any, pk: Any) -> Any:
        return StandardResponse.ok(cafe_orders.view(cafe_orders.get_order(tenant=get_effective_tenant(request), order_id=pk)))

    def patch(self, request: Any, pk: Any) -> Any:
        order = cafe_orders.update_order(ctx=Ctx.from_request(request), order_id=pk, data=request.data)
        return StandardResponse.ok(cafe_orders.view(order))
