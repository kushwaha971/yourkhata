"""G3a — a jeweller's custom orders. Only a business with the `jewellery`
feature on sees them; any other answers 404."""

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
from apps.sales.services import custom_orders

_READ = HasPermission("sales.invoice.read")
_WRITE = HasPermission("sales.invoice.write")


class _View(APIView):
    def get_permissions(self) -> list[Any]:
        gate = _READ if self.request.method == "GET" else _WRITE
        return [IsAuthenticated(), ModuleEnabled(ModuleCode.SALES)(), gate()]

    def initial(self, request: Any, *args: Any, **kwargs: Any) -> None:
        super().initial(request, *args, **kwargs)
        from apps.platform_app.selectors.business_words import features_of

        if "jewellery" not in features_of(get_effective_tenant(request)):
            raise NotFound("Custom orders are not used by this business.")


class CustomOrdersView(_View):
    def get(self, request: Any) -> Any:
        return StandardResponse.ok(
            custom_orders.list_orders(
                tenant=get_effective_tenant(request),
                q=request.query_params.get("q", ""),
                scope=request.query_params.get("scope", "open"),
            )
        )

    def post(self, request: Any) -> Any:
        order, created = custom_orders.create_order(ctx=Ctx.from_request(request), data=request.data)
        body = custom_orders.view(order)
        return StandardResponse.created(body) if created else StandardResponse.ok(body)


class CustomOrderStatusView(_View):
    def post(self, request: Any, pk: Any) -> Any:
        order = custom_orders.move_order(ctx=Ctx.from_request(request), order_id=pk, status=request.data.get("status"))
        return StandardResponse.ok(custom_orders.view(order))


class CustomOrderDetailView(_View):
    def get(self, request: Any, pk: Any) -> Any:
        order = custom_orders.get_order(tenant=get_effective_tenant(request), order_id=pk)
        return StandardResponse.ok(custom_orders.view(order))
