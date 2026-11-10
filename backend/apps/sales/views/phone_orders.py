"""G11 — a kirana's phone and WhatsApp orders. Only a business that keeps them
(a kirana by default) sees them; any other answers 404."""

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
from apps.sales.services import phone_orders

_READ = HasPermission("sales.invoice.read")
_WRITE = HasPermission("sales.invoice.write")


class _View(APIView):
    def get_permissions(self) -> list[Any]:
        gate = _READ if self.request.method == "GET" else _WRITE
        return [IsAuthenticated(), ModuleEnabled(ModuleCode.SALES)(), gate()]

    def initial(self, request: Any, *args: Any, **kwargs: Any) -> None:
        super().initial(request, *args, **kwargs)
        from apps.platform_app.selectors.business_words import features_of

        if "phone_orders" not in features_of(get_effective_tenant(request)):
            raise NotFound("Phone orders are kept by kirana shops.")


class PhoneOrdersView(_View):
    def get(self, request: Any) -> Any:
        result = phone_orders.list_orders(
            tenant=get_effective_tenant(request),
            q=request.query_params.get("q", ""),
            stage=request.query_params.get("stage", "to_pack"),
        )
        return StandardResponse.ok(result["rows"], meta={"counts": result["counts"]})

    def post(self, request: Any) -> Any:
        order, created = phone_orders.create_order(ctx=Ctx.from_request(request), data=request.data)
        body = phone_orders.view(order)
        return StandardResponse.created(body) if created else StandardResponse.ok(body)


class PhoneOrderDetailView(_View):
    def get(self, request: Any, pk: Any) -> Any:
        return StandardResponse.ok(phone_orders.view(phone_orders.get_order(tenant=get_effective_tenant(request), order_id=pk)))


class PhoneOrderStatusView(_View):
    def post(self, request: Any, pk: Any) -> Any:
        body = request.data if isinstance(request.data, dict) else {}
        order = phone_orders.move_order(ctx=Ctx.from_request(request), order_id=pk, status=body.get("status"))
        return StandardResponse.ok(phone_orders.view(order))


class PhoneOrderReadListView(_View):
    """POST, so a long list never travels in an address; it writes nothing."""

    def post(self, request: Any) -> Any:
        body = request.data if isinstance(request.data, dict) else {}
        return StandardResponse.ok(phone_orders.read_list(tenant=get_effective_tenant(request), text=body.get("text")))
